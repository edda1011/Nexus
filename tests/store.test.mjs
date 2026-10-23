import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store} from '../store.mjs';
import {verifyEvidence} from '../verify-evidence.mjs';
import {normaliseLiveWeather} from '../live.js';
import {evaluate,SCENARIOS} from '../engine.js';
import {evaluateEnergy} from '../platform.js';
const manager={username:'manager',role:'manager'},staff={username:'staff',role:'staff'},driver={username:'driver',role:'resident'},rider={username:'rider',role:'resident'};
async function create(t){const directory=mkdtempSync(path.join(tmpdir(),'nexus-test-')),store=await Store.open(directory,{testPassword:'test-only-long-password'});t.after(()=>store.close());return {store,directory};}
test('server water workflow enforces roles, revision conflicts, credit uniqueness and signed persistence',async t=>{
 const {store,directory}=await create(t);await assert.rejects(()=>store.login('manager','wrong'));const session=(await store.login('manager','test-only-long-password'));assert.equal((await store.session(session.token)).user.role,'manager');
 await assert.rejects(()=>store.waterAction('dry',0,driver,'approve'),/role/);
 let s=(await store.waterAction('dry',0,manager,'approve'));await assert.rejects(()=>store.waterAction('dry',0,manager,'approve'),/changed/);
 await assert.rejects(()=>store.waterAction('dry',s.revision,driver,'weigh',{kg:20}),/role/);
 s=(await store.waterAction('dry',s.revision,driver,'book'));await assert.rejects(()=>store.waterAction('dry',s.revision,rider,'checkin',{kg:20}),/owner/);
 s=(await store.waterAction('dry',s.revision,driver,'checkin',{kg:20}));s=(await store.waterAction('dry',s.revision,staff,'weigh',{kg:20}));assert.equal((await store.workspace(driver)).credits[0].credits,60);
 await assert.rejects(()=>store.waterAction('dry',s.revision,staff,'weigh',{kg:20}));assert.equal((await store.workspace(driver)).credits[0].credits,60);
 for(const task of ['inspect','transfer','mulch'])s=(await store.waterAction('dry',s.revision,staff,'task',{task}));s=(await store.waterAction('dry',s.revision,manager,'verify'));assert.equal(s.observation.avoided,39.33);
 const exported=(await store.export());assert.ok(verifyEvidence(exported,store.fingerprint).valid);await assert.rejects(()=>store.db.exec("UPDATE audit SET action='changed' WHERE seq=1"),/append-only/);
 const reopened=await Store.open(directory);assert.equal((await reopened.read('water:dry')).status,'SIMULATED_VERIFIED');assert.ok((await reopened.verifyAudit()).valid);(await reopened.close());
 const changed=structuredClone(exported);changed.events[0].action='forged';assert.throws(()=>verifyEvidence(changed));const truncated=structuredClone(exported);truncated.events.pop();assert.throws(()=>verifyEvidence(truncated));assert.throws(()=>verifyEvidence(exported,'wrong-identity'));
});
test('telemetry validates units, capacity, time, source class and batch idempotency atomically',async t=>{
 const {store}=await create(t),point={assetId:'tank-a',kind:'tank-volume',at:new Date(Date.now()-1000).toISOString(),value:45,unit:'m³'},body={batchId:'test-tank-001',source:'Local test gateway',classification:'user-supplied',readings:[point]};
 assert.equal((await store.ingest(body,manager)).accepted,1);assert.equal((await store.ingest(body,manager)).duplicate,true);assert.ok((await store.verifyAudit()).valid);
 for(const reading of [{...point,value:61},{...point,unit:'litres'},{...point,at:new Date(Date.now()+3600000).toISOString()},{...point,value:null}])await assert.rejects(()=>store.ingest({...body,batchId:'invalid-'+String(Math.random()).slice(2),readings:[reading]},manager));
 await assert.rejects(()=>store.ingest({...body,batchId:'spoof-provider',classification:'provider'},manager));
 await assert.rejects(()=>store.ingest({...body,batchId:'duplicate-point'},manager),/already/);assert.equal((await store.telemetry()).length,1);
 const saved=(await store.export());assert.ok(verifyEvidence(saved).valid);
 await store.db.prepare("UPDATE records SET value='{}' WHERE id='water:dry'").run(); // pristine revision-zero fixtures are not operational evidence.
 await assert.rejects(()=>store.waterAction('dry',0,manager,'approve'));
});
test('server grants RideShare credits once to separate real sessions and rejects expired confirmation',async t=>{
 const {store}=await create(t),now=Date.now();let s=(await store.read('rides'));s=(await store.ridesAction(s.revision,manager,'assumptions',{startsAt:new Date(now-1000).toISOString(),endsAt:new Date(now+600000).toISOString()},null,now));
 s=(await store.ridesAction(s.revision,manager,'approve',{},null,now));s=(await store.ridesAction(s.revision,driver,'offer',{consent:true},null,now));s=(await store.ridesAction(s.revision,rider,'join',{consent:true},null,now));
 await assert.rejects(()=>store.ridesAction(s.revision,driver,'confirm',{tripId:s.trip.id,consent:true},null,now+700000),/window/);
 s=(await store.ridesAction(s.revision,driver,'confirm',{tripId:s.trip.id,consent:true},null,now));s=(await store.ridesAction(s.revision,rider,'confirm',{tripId:s.trip.id,consent:true},null,now));assert.equal((await store.workspace(driver)).credits[0].credits,30);assert.equal((await store.workspace(rider)).credits[0].credits,30);
 await assert.rejects(()=>store.ridesAction(s.revision,rider,'confirm',{tripId:s.trip.id,consent:true},null,now));assert.ok(verifyEvidence((await store.export())).valid);
});
test('supplied tank evidence changes live capacity, requires reviewed permissions and cannot change silently at approval',async t=>{
 const {store}=await create(t),now=Date.now(),raw=JSON.parse(readFileSync(new URL('./fixtures/public-weather.json',import.meta.url),'utf8')),date=new Date(now+8*3600000).toISOString().slice(0,16),start=Date.parse(date.slice(0,10)+'T00:00:00Z');
 raw.current.time=date;raw.daily.time=Array.from({length:14},(_,i)=>new Date(start+i*86400000).toISOString().slice(0,10));raw.hourly.time=raw.hourly.time.map((_,i)=>new Date(start+i*3600000).toISOString().slice(0,16));raw.daily.precipitation_sum=Array(14).fill(0);raw.daily.et0_fao_evapotranspiration=Array(14).fill(5);const weather=normaliseLiveWeather(raw);
 let s=(await store.waterAction('live',0,manager,'live-inputs',{},weather));
 const point=(id,value,offset)=>({batchId:id,source:'Isolated test gateway',readings:[{assetId:'tank-a',kind:'tank-volume',at:new Date(now+offset).toISOString(),value,unit:'m³'}]});
 (await store.ingest(point('test-tank-first',25,-2000),{username:'registered-device',role:'device'},{provider:true}));
 await assert.rejects(()=>store.waterAction('live',s.revision,manager,'site-inputs',{}),/quality/);
 const docs={qualityReference:'TEST-QA-001',qualityAt:new Date(now-3600000).toISOString(),qualityExpiresAt:new Date(now+86400000).toISOString(),routeReference:'TEST-OWNER-001',reviewed:true};
 s=(await store.waterAction('live',s.revision,manager,'site-inputs',docs));assert.equal(evaluate(s).maxWater,20);assert.equal(s.requested,20);assert.equal(s.siteInputs.tank.class,'provider');
 (await store.ingest(point('test-tank-changed',24,-1000),{username:'registered-device',role:'device'},{provider:true}));
 await assert.rejects(()=>store.waterAction('live',s.revision,manager,'approve',{note:'Testing operator-reviewed supplied inputs.'},weather),/Tank evidence changed/);
 s=(await store.waterAction('live',s.revision,manager,'site-inputs',docs));s=(await store.waterAction('live',s.revision,manager,'approve',{note:'Testing operator-reviewed supplied inputs.'},weather));assert.equal(s.reservation,19);assert.ok(verifyEvidence((await store.export())).valid);
 const edited=(await store.export());edited.telemetry[0].value=50;assert.throws(()=>verifyEvidence(edited),/Telemetry/);
});
test('imported water and energy outcomes require complete separate batches and retain their provenance',async t=>{
 const {store}=await create(t);let water=(await store.waterAction('dry',0,manager,'approve'));for(const task of ['inspect','transfer','mulch'])water=(await store.waterAction('dry',water.revision,staff,'task',{task}));
 const batch=(id,kind,assetId,count,startDate,value)=>({batchId:id,source:'Test-only supplied meter fixture',classification:'user-supplied',readings:Array.from({length:count},(_,i)=>({assetId,kind,at:new Date(Date.parse(startDate)+i*86400000).toISOString(),value,unit:kind==='water-use'?'m³/day':'kWh/day'}))});
 (await store.ingest(batch('test-water-outcome','water-use','zone-b',14,'2025-07-01T12:00:00Z',10),manager));
 water=(await store.waterAction('dry',water.revision,manager,'verify-import',{batchId:'test-water-outcome'}));assert.equal(water.status,'EVIDENCE_REVIEWED');assert.equal(water.observation.potable,140);assert.equal(water.observation.conservation,null);assert.equal(water.observation.class,'user-supplied');assert.equal(water.observation.avoided,Math.round((SCENARIOS.dry.baseline-140)*100)/100);
 water=(await store.waterAction('dry',water.revision,driver,'book'));assert.equal(water.collection.owner,'driver');
 let energy=(await store.read('energy'));const reviewKey=evaluateEnergy(energy).reviewKey;await assert.rejects(()=>store.energyAction(energy.revision,manager,'approve',{reviewKey:'different'}),/source changed/);
 energy=(await store.energyAction(energy.revision,manager,'approve',{reviewKey,note:'Using an existing maintenance shift.'}));energy=(await store.energyAction(energy.revision,staff,'complete'));
 (await store.ingest(batch('test-energy-base','grid-import','community-hall',30,'2025-01-01T12:00:00Z',120),manager));(await store.ingest(batch('test-energy-post','grid-import','community-hall',30,'2025-02-01T12:00:00Z',100),manager));
 await assert.rejects(()=>store.energyAction(energy.revision,manager,'verify-import',{baselineBatch:'test-energy-base',actualBatch:'test-energy-base'}),/Baseline/);
 energy=(await store.energyAction(energy.revision,manager,'verify-import',{baselineBatch:'test-energy-base',actualBatch:'test-energy-post'}));assert.equal(energy.outcome.avoidedKWh,20);assert.equal(energy.status,'EVIDENCE_REVIEWED');assert.ok((await store.verifyAudit()).valid);
});
