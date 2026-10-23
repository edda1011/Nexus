import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {Store} from '../store.mjs';
import {PostgresDatabase} from '../database.mjs';
import {migrateToPostgres} from '../tools/setup-neon.mjs';
import {verifyEvidence} from '../verify-evidence.mjs';
import {evaluateEnergy} from '../platform.js';

const manager={username:'manager',role:'manager'},staff={username:'staff',role:'staff'},driver={username:'driver',role:'resident'},rider={username:'rider',role:'resident'};
const password='isolated-integration-test-only';
test('real Postgres migration, concurrent approvals, telemetry rollback, wallets and restart retain signed evidence', {skip:!process.env.DATABASE_URL,timeout:240000},async t=>{
  // Never run fixtures in the user's public schema. Only this generated schema is dropped.
  const schema='nexus_test_'+randomBytes(8).toString('hex'),admin=new PostgresDatabase(process.env.DATABASE_URL),opened=[];
  const directory=mkdtempSync(path.join(tmpdir(),'nexus-pg-test-')),source=await Store.open(directory,{testPassword:password});
  t.after(async()=>{
    for(const store of opened)await store.close();await source.close();
    assert.match(schema,/^nexus_test_[a-f0-9]{16}$/);
    await admin.exec('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.close();
  });
  await admin.exec('CREATE SCHEMA '+schema);
  // Migrate non-empty local evidence too, preserving exact hashes and identity.
  await source.login('manager',password);
  await source.ingest({batchId:'before-migration',source:'Isolated test fixture',classification:'simulation',readings:[{assetId:'tank-a',kind:'tank-volume',at:new Date(Date.now()-10000).toISOString(),value:43,unit:'m³'}]},manager);
  const before=await source.export(),target=new PostgresDatabase(process.env.DATABASE_URL,{schema});
  try{assert.equal((await migrateToPostgres(source,target)).alreadyInitialised,false);assert.equal((await migrateToPostgres(source,target)).alreadyInitialised,true);}finally{await target.close();}
  const signingKey=readFileSync(path.join(directory,'signing-private.pem')).toString('base64');
  async function open(){const store=await Store.open(null,{database:new PostgresDatabase(process.env.DATABASE_URL,{schema}),signingKey});opened.push(store);return store;}
  const a=await open(),b=await open();
  assert.equal(a.fingerprint,source.fingerprint);assert.equal(JSON.stringify((await a.export()).events),JSON.stringify(before.events));
  assert.ok(verifyEvidence(await a.export(),source.fingerprint).valid);
  await assert.rejects(()=>a.login('manager','wrong'),/Incorrect/);
  const login=await a.login('manager',password);assert.equal((await b.session(login.token)).user.role,'manager');
  const results=await Promise.allSettled([a.waterAction('dry',0,manager,'approve'),b.waterAction('dry',0,manager,'approve')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
  let water=await b.read('water:dry');assert.equal(water.revision,1);
  water=await a.waterAction('dry',water.revision,driver,'book');water=await b.waterAction('dry',water.revision,driver,'checkin',{kg:20});water=await a.waterAction('dry',water.revision,staff,'weigh',{kg:20});
  await assert.rejects(()=>b.waterAction('dry',water.revision,staff,'weigh',{kg:20}));assert.equal((await a.workspace(driver)).credits[0].credits,60);
  for(const task of ['inspect','transfer','mulch'])water=await b.waterAction('dry',water.revision,staff,'task',{task});
  water=await a.waterAction('dry',water.revision,manager,'verify');assert.equal(water.observation.avoided,39.33);
  const at=new Date(Date.now()-5000).toISOString(),point={assetId:'tank-a',kind:'tank-volume',at,value:42,unit:'m³'},batch={batchId:'after-migration',source:'Isolated test gateway',readings:[point]};
  assert.equal((await b.ingest(batch,{username:'registered-device',role:'device'},{provider:true})).accepted,1);
  assert.equal((await a.ingest(batch,{username:'registered-device',role:'device'},{provider:true})).duplicate,true);
  const count=(await a.events()).length;
  await assert.rejects(()=>a.ingest({...batch,batchId:'rollback-duplicate',readings:[{...point,at:new Date(Date.now()-3000).toISOString()},point]},manager),/Choose user-supplied/);
  await assert.rejects(()=>a.ingest({...batch,batchId:'rollback-duplicate',classification:'user-supplied',readings:[{...point,at:new Date(Date.now()-3000).toISOString()},point]},manager),/already/);
  assert.equal((await a.events()).length,count);assert.equal((await b.telemetry()).length,2);
  assert.equal((await b.db.prepare('SELECT COUNT(*) AS n FROM batches WHERE id=?').get('rollback-duplicate')).n,'0');
  let energy=await a.read('energy');energy=await b.energyAction(energy.revision,manager,'approve',{reviewKey:evaluateEnergy(energy).reviewKey,note:'Isolated existing maintenance shift.'});energy=await a.energyAction(energy.revision,staff,'complete');assert.equal(energy.completed,true);assert.equal(energy.status,'MOBILISED');
  const now=Date.now();let rides=await a.read('rides');rides=await a.ridesAction(rides.revision,manager,'assumptions',{startsAt:new Date(now-1000).toISOString(),endsAt:new Date(now+600000).toISOString()},null,now);
  rides=await b.ridesAction(rides.revision,manager,'approve',{},null,now);rides=await a.ridesAction(rides.revision,driver,'offer',{consent:true},null,now);rides=await b.ridesAction(rides.revision,rider,'join',{consent:true},null,now);
  rides=await a.ridesAction(rides.revision,driver,'confirm',{tripId:rides.trip.id,consent:true},null,now);rides=await b.ridesAction(rides.revision,rider,'confirm',{tripId:rides.trip.id,consent:true},null,now);
  assert.equal((await a.workspace(rider)).credits[0].credits,30);assert.equal((await a.workspace(driver)).credits[0].credits,90);
  for(const table of ['audit','telemetry','credits'])await assert.rejects(()=>a.db.exec('DELETE FROM '+table),/append-only/);
  const evidence=await b.export();assert.ok(verifyEvidence(evidence,source.fingerprint).valid);
  const c=await open();assert.equal((await c.session(login.token)).user.username,'manager');assert.equal((await c.read('water:dry')).status,'SIMULATED_VERIFIED');assert.equal((await c.verifyAudit()).count,evidence.events.length);
  for(let i=0;i<15;i++)assert.equal(await (i%2?a:b).loginAttempt('test-ip'),true);assert.equal(await c.loginAttempt('test-ip'),false);await a.clearLoginAttempts('test-ip');assert.equal(await c.loginAttempt('test-ip'),true);
  await c.logout(login.token,manager);assert.equal(await a.session(login.token),null);
});
