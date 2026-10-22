import test from 'node:test';
import assert from 'node:assert/strict';
import {energyInitial,evaluateEnergy,energyTransition,ridesInitial,ridesTransition,evaluateRides,rankOpportunities,detectAnomalies,DEMO_WATER_WEEK,parseReadingsCSV} from '../platform.js';
import {initialState,SCENARIOS,transition,evaluate} from '../engine.js';
import {assessEvidence} from '../evidence.js';
test('evidence readiness penalises missing, stale and synthetic sources without claiming statistical confidence',()=>{
 const base={id:'test',value:5,unit:'m³',source:'device',observedAt:new Date().toISOString(),maxAgeMinutes:90,class:'provider'};
 const score=v=>assessEvidence([v]).score;
 assert.equal(score(base),90);assert.ok(score({...base,class:'simulation'})<score(base));assert.ok(score({...base,value:null})<score(base));assert.ok(score({...base,observedAt:'2020-01-01'})<score(base));assert.match(assessEvidence([base]).method,/Not statistically/);
});
test('energy scheduling preserves consumption, respects all time windows and freezes reviewed inputs',()=>{
 const s=energyInitial(),e=evaluateEnergy(s);assert.ok(e.feasible);assert.ok(e.afterKWh<e.beforeKWh);assert.equal(e.baseline.reduce((a,b)=>a+b,0),e.planned.reduce((a,b)=>a+b,0));
 for(const l of e.schedules){assert.ok(l.start>=l.earliest&&l.start<=l.latest);assert.ok(l.start+l.hours<=24);}
 const approved=energyTransition(s,'approve',{note:'Using the existing facility maintenance shift.'});assert.equal(approved.status,'MOBILISED');assert.deepEqual(evaluateEnergy(approved,{solar:[]}),approved.snapshot);
 assert.throws(()=>energyTransition(approved,'assumptions',{pvKw:100}));assert.throws(()=>energyTransition(approved,'verify-demo'));
 const complete=energyTransition(approved,'complete');assert.equal(energyTransition(complete,'verify-demo').status,'SIMULATED_VERIFIED');
 assert.throws(()=>evaluateEnergy({...s,parameters:{...s.parameters,pvKw:-1}}));assert.throws(()=>evaluateEnergy({...s,parameters:{...s.parameters,loadIds:['invalid']}}));
});
test('ranker computes multiple distinct opportunities, blocks failed constraints and exposes exclusive alternatives',()=>{
 const ranked=rankOpportunities(initialState('dry'));assert.equal(ranked.length,4);assert.ok(ranked.every((r,i)=>!i||Number(ranked[i-1].feasible)>Number(r.feasible)||ranked[i-1].score>=r.score));
 const shared=ranked.find(r=>r.id==='water-shared'),dedicated=ranked.find(r=>r.id==='water-dedicated');assert.ok(shared.net>dedicated.net);assert.equal(shared.exclusiveGroup,dedicated.exclusiveGroup);assert.ok(dedicated.net<0);
 assert.equal(rankOpportunities(initialState('monsoon')).find(r=>r.id==='water-shared').feasible,false);
 const anomaly=detectAnomalies(DEMO_WATER_WEEK).find(r=>r.id==='water-spike');assert.match(anomaly.detail,/\+25 m³/);assert.equal(anomaly.class,'simulation');
 const frozen=energyTransition(energyInitial(),'approve',{note:'Use the existing staff shift.'});const recorded=rankOpportunities(initialState('dry'),frozen);assert.equal(recorded.find(r=>r.module==='Energy').actionable,false);assert.match(recorded.find(r=>r.module==='Energy').decision,/Recorded workflow/);assert.ok(recorded[0].actionable);
 const clock=Date.now(),daily={kind:'grid-import',unit:'kWh/day',value:100,at:new Date(clock-24*3600000).toISOString(),class:'user-supplied'};assert.equal(detectAnomalies([daily],10,clock).some(r=>r.id==='grid-import-stale'),false);assert.ok(detectAnomalies([daily],10,clock+13*3600000).some(r=>r.id==='grid-import-stale'));
});
test('RideShare requires a valid window, distinct participants and two once-only attestations',()=>{
 const now=Date.now(),manager={username:'manager',role:'manager'},driver={username:'driver',role:'resident'},rider={username:'rider',role:'resident'};
 let s=ridesInitial(now);s=ridesTransition(s,'assumptions',{startsAt:new Date(now-1000).toISOString(),endsAt:new Date(now+3600000).toISOString()},manager,null,now);
 assert.ok(evaluateRides(s,null,now).feasible);s=ridesTransition(s,'approve',{},manager,null,now);s=ridesTransition(s,'offer',{consent:true},driver,null,now);
 assert.throws(()=>ridesTransition(s,'join',{consent:true},driver,null,now));s=ridesTransition(s,'join',{consent:true},rider,null,now);
 assert.throws(()=>ridesTransition(s,'confirm',{tripId:'wrong',consent:true},driver,null,now));s=ridesTransition(s,'confirm',{tripId:s.trip.id,consent:true},driver,null,now);assert.equal(s.trip.credits,0);
 assert.throws(()=>ridesTransition(s,'confirm',{tripId:s.trip.id,consent:true},driver,null,now));s=ridesTransition(s,'confirm',{tripId:s.trip.id,consent:true},rider,null,now);assert.equal(s.trip.credits,30);assert.equal(s.status,'SELF_ATTESTED');
 assert.throws(()=>ridesTransition(s,'confirm',{tripId:s.trip.id,consent:true},rider,null,now));
 const rain={...ridesInitial(now),trigger:'rain'};assert.equal(evaluateRides(rain,null,now).feasible,false);
});
test('CSV parser accepts BOM, CRLF, quoted cells and rejects missing / non-finite numbers',()=>{
 const csv='\uFEFFassetId,kind,at,value,unit\r\n"tank-a",tank-volume,2026-10-01T00:00:00+08:00,45,m³\r\n';assert.equal(parseReadingsCSV(csv)[0].value,45);
 for(const v of [csv.replace(',45,',',,'),csv.replace(',45,',',NaN,'),csv.replace('assetId,','asset,'),csv+'"unclosed'])assert.throws(()=>parseReadingsCSV(v));
});
test('explicit dry-spell stress is +30 percent and additional pilot costs change economics without changing water',()=>{
 assert.ok(Math.abs(SCENARIOS.dryspell.baseline/SCENARIOS.normal.baseline-1.3)<.0001);
 const original=evaluate(initialState('dry')),added=evaluate(transition(initialState('dry'),'assumptions',{volume:40,extraCost:100}));assert.equal(added.avoided,original.avoided);assert.equal(added.net,Math.round((original.net-100)*100)/100);assert.throws(()=>transition(initialState('dry'),'assumptions',{volume:40,extraCost:-1}));
});
