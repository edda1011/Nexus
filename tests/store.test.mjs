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
function create(t){const directory=mkdtempSync(path.join(tmpdir(),'nexus-test-')),store=new Store(directory,{testPassword:'test-only-long-password'});t.after(()=>store.close());return {store,directory};}
test('server water workflow enforces roles, revision conflicts, credit uniqueness and signed persistence',t=>{
 const {store,directory}=create(t);assert.throws(()=>store.login('manager','wrong'));const session=store.login('manager','test-only-long-password');assert.equal(store.session(session.token).user.role,'manager');
 assert.throws(()=>store.waterAction('dry',0,driver,'approve'),/role/);
 let s=store.waterAction('dry',0,manager,'approve');assert.throws(()=>store.waterAction('dry',0,manager,'approve'),/changed/);
 assert.throws(()=>store.waterAction('dry',s.revision,driver,'weigh',{kg:20}),/role/);
 s=store.waterAction('dry',s.revision,driver,'book');assert.throws(()=>store.waterAction('dry',s.revision,rider,'checkin',{kg:20}),/owner/);
 s=store.waterAction('dry',s.revision,driver,'checkin',{kg:20});s=store.waterAction('dry',s.revision,staff,'weigh',{kg:20});assert.equal(store.workspace(driver).credits[0].credits,60);
 assert.throws(()=>store.waterAction('dry',s.revision,staff,'weigh',{kg:20}));assert.equal(store.workspace(driver).credits[0].credits,60);
 for(const task of ['inspect','transfer','mulch'])s=store.waterAction('dry',s.revision,staff,'task',{task});s=store.waterAction('dry',s.revision,manager,'verify');assert.equal(s.observation.avoided,39.33);
 const exported=store.export();assert.ok(verifyEvidence(exported,store.fingerprint).valid);assert.throws(()=>store.db.exec("UPDATE audit SET action='changed' WHERE seq=1"),/append-only/);
 const reopened=new Store(directory);assert.equal(reopened.read('water:dry').status,'SIMULATED_VERIFIED');assert.ok(reopened.verifyAudit().valid);reopened.close();
 const changed=structuredClone(exported);changed.events[0].action='forged';assert.throws(()=>verifyEvidence(changed));const truncated=structuredClone(exported);truncated.events.pop();assert.throws(()=>verifyEvidence(truncated));assert.throws(()=>verifyEvidence(exported,'wrong-identity'));
});
test('telemetry validates units, capacity, time, source class and batch idempotency atomically',t=>{
 const {store}=create(t),point={assetId:'tank-a',kind:'tank-volume',at:new Date(Date.now()-1000).toISOString(),value:45,unit:'m³'},body={batchId:'test-tank-001',source:'Local test gateway',classification:'user-supplied',readings:[point]};
 assert.equal(store.ingest(body,manager).accepted,1);assert.equal(store.ingest(body,manager).duplicate,true);assert.ok(store.verifyAudit().valid);
 for(const reading of [{...point,value:61},{...point,unit:'litres'},{...point,at:new Date(Date.now()+3600000).toISOString()},{...point,value:null}])assert.throws(()=>store.ingest({...body,batchId:'invalid-'+String(Math.random()).slice(2),readings:[reading]},manager));
 assert.throws(()=>store.ingest({...body,batchId:'spoof-provider',classification:'provider'},manager));
 assert.throws(()=>store.ingest({...body,batchId:'duplicate-point'},manager),/already/);assert.equal(store.telemetry().length,1);
 const saved=store.export();assert.ok(verifyEvidence(saved).valid);
 store.db.prepare("UPDATE records SET value='{}' WHERE id='water:dry'").run(); // pristine revision-zero fixtures are not operational evidence.
 assert.throws(()=>store.waterAction('dry',0,manager,'approve'));
});
test('server grants RideShare credits once to separate real sessions and rejects expired confirmation',t=>{
 const {store}=create(t),now=Date.now();let s=store.read('rides');s=store.ridesAction(s.revision,manager,'assumptions',{startsAt:new Date(now-1000).toISOString(),endsAt:new Date(now+600000).toISOString()},null,now);
 s=store.ridesAction(s.revision,manager,'approve',{},null,now);s=store.ridesAction(s.revision,driver,'offer',{consent:true},null,now);s=store.ridesAction(s.revision,rider,'join',{consent:true},null,now);
 assert.throws(()=>store.ridesAction(s.revision,driver,'confirm',{tripId:s.trip.id,consent:true},null,now+700000),/window/);
 s=store.ridesAction(s.revision,driver,'confirm',{tripId:s.trip.id,consent:true},null,now);s=store.ridesAction(s.revision,rider,'confirm',{tripId:s.trip.id,consent:true},null,now);assert.equal(store.workspace(driver).credits[0].credits,30);assert.equal(store.workspace(rider).credits[0].credits,30);
 assert.throws(()=>store.ridesAction(s.revision,rider,'confirm',{tripId:s.trip.id,consent:true},null,now));assert.ok(verifyEvidence(store.export()).valid);
});
test('supplied tank evidence changes live capacity, requires reviewed permissions and cannot change silently at approval',t=>{
 const {store}=create(t),now=Date.now(),raw=JSON.parse(readFileSync(new URL('./fixtures/public-weather.json',import.meta.url),'utf8')),date=new Date(now+8*3600000).toISOString().slice(0,16),start=Date.parse(date.slice(0,10)+'T00:00:00Z');
 raw.current.time=date;raw.daily.time=Array.from({length:14},(_,i)=>new Date(start+i*86400000).toISOString().slice(0,10));raw.hourly.time=raw.hourly.time.map((_,i)=>new Date(start+i*3600000).toISOString().slice(0,16));raw.daily.precipitation_sum=Array(14).fill(0);raw.daily.et0_fao_evapotranspiration=Array(14).fill(5);const weather=normaliseLiveWeather(raw);
 let s=store.waterAction('live',0,manager,'live-inputs',{},weather);
 const point=(id,value,offset)=>({batchId:id,source:'Isolated test gateway',readings:[{assetId:'tank-a',kind:'tank-volume',at:new Date(now+offset).toISOString(),value,unit:'m³'}]});
 store.ingest(point('test-tank-first',25,-2000),{username:'registered-device',role:'device'},{provider:true});
 assert.throws(()=>store.waterAction('live',s.revision,manager,'site-inputs',{}),/quality/);
 const docs={qualityReference:'TEST-QA-001',qualityAt:new Date(now-3600000).toISOString(),qualityExpiresAt:new Date(now+86400000).toISOString(),routeReference:'TEST-OWNER-001',reviewed:true};
 s=store.waterAction('live',s.revision,manager,'site-inputs',docs);assert.equal(evaluate(s).maxWater,20);assert.equal(s.requested,20);assert.equal(s.siteInputs.tank.class,'provider');
 store.ingest(point('test-tank-changed',24,-1000),{username:'registered-device',role:'device'},{provider:true});
 assert.throws(()=>store.waterAction('live',s.revision,manager,'approve',{note:'Testing operator-reviewed supplied inputs.'},weather),/Tank evidence changed/);
 s=store.waterAction('live',s.revision,manager,'site-inputs',docs);s=store.waterAction('live',s.revision,manager,'approve',{note:'Testing operator-reviewed supplied inputs.'},weather);assert.equal(s.reservation,19);assert.ok(verifyEvidence(store.export()).valid);
 const edited=store.export();edited.telemetry[0].value=50;assert.throws(()=>verifyEvidence(edited),/Telemetry/);
});
test('imported water and energy outcomes require complete separate batches and retain their provenance',t=>{
 const {store}=create(t);let water=store.waterAction('dry',0,manager,'approve');for(const task of ['inspect','transfer','mulch'])water=store.waterAction('dry',water.revision,staff,'task',{task});
 const batch=(id,kind,assetId,count,startDate,value)=>({batchId:id,source:'Test-only supplied meter fixture',classification:'user-supplied',readings:Array.from({length:count},(_,i)=>({assetId,kind,at:new Date(Date.parse(startDate)+i*86400000).toISOString(),value,unit:kind==='water-use'?'m³/day':'kWh/day'}))});
 store.ingest(batch('test-water-outcome','water-use','zone-b',14,'2025-07-01T12:00:00Z',10),manager);
 water=store.waterAction('dry',water.revision,manager,'verify-import',{batchId:'test-water-outcome'});assert.equal(water.status,'EVIDENCE_REVIEWED');assert.equal(water.observation.potable,140);assert.equal(water.observation.conservation,null);assert.equal(water.observation.class,'user-supplied');assert.equal(water.observation.avoided,Math.round((SCENARIOS.dry.baseline-140)*100)/100);
 water=store.waterAction('dry',water.revision,driver,'book');assert.equal(water.collection.owner,'driver');
 let energy=store.read('energy');const reviewKey=evaluateEnergy(energy).reviewKey;assert.throws(()=>store.energyAction(energy.revision,manager,'approve',{reviewKey:'different'}),/source changed/);
 energy=store.energyAction(energy.revision,manager,'approve',{reviewKey,note:'Using an existing maintenance shift.'});energy=store.energyAction(energy.revision,staff,'complete');
 store.ingest(batch('test-energy-base','grid-import','community-hall',30,'2025-01-01T12:00:00Z',120),manager);store.ingest(batch('test-energy-post','grid-import','community-hall',30,'2025-02-01T12:00:00Z',100),manager);
 assert.throws(()=>store.energyAction(energy.revision,manager,'verify-import',{baselineBatch:'test-energy-base',actualBatch:'test-energy-base'}),/Baseline/);
 energy=store.energyAction(energy.revision,manager,'verify-import',{baselineBatch:'test-energy-base',actualBatch:'test-energy-post'});assert.equal(energy.outcome.avoidedKWh,20);assert.equal(energy.status,'EVIDENCE_REVIEWED');assert.ok(store.verifyAudit().valid);
});
