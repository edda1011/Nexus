import test from 'node:test';
import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import{normaliseLiveWeather,isLiveFresh}from'../live.js';
import{initialState,transition,evaluate,getScenario}from'../engine.js';
const recorded=JSON.parse(readFileSync(new URL('./fixtures/public-weather.json',import.meta.url),'utf8'));
// Test-only clock-relative variants of the retained public response; never served to the app.
function input(){
 const raw=structuredClone(recorded),now=new Date(),local=new Date(now.getTime()+8*3600000).toISOString().slice(0,16);raw.current.time=local;
 const start=Date.parse(local.slice(0,10)+'T00:00:00Z');raw.daily.time=Array.from({length:14},(_,i)=>new Date(start+i*86400000).toISOString().slice(0,10));
 raw.hourly.time=raw.hourly.time.map((_,i)=>new Date(start+i*3600000).toISOString().slice(0,16));return raw;
}
function current(){return normaliseLiveWeather(input());}
test('live source rejects incomplete data or units instead of inventing readings',()=>{
 const raw=input();assert.equal(normaliseLiveWeather(raw).daily.time.length,14);assert.ok(isLiveFresh(normaliseLiveWeather(raw)));
 for(const change of [r=>r.current.temperature_2m=null,r=>r.daily.precipitation_sum[2]=null,r=>r.daily.et0_fao_evapotranspiration[0]=-1,r=>r.daily.time[1]=r.daily.time[0],r=>r.current_units.precipitation='inch',r=>r.timezone='UTC']){const copy=structuredClone(raw);change(copy);assert.throws(()=>normaliseLiveWeather(copy));}
});
test('live freshness uses source time and retrieval time, including explicit failed-refresh states',()=>{
 const data=current(),now=Date.now();assert.ok(isLiveFresh(data,now));assert.equal(isLiveFresh({...data,mode:'stale'},now),false);
 assert.equal(isLiveFresh({...data,observedAt:new Date(now-91*60000).toISOString()},now),false);
 assert.equal(isLiveFresh({...data,fetchedAt:new Date(now-91*60000).toISOString()},now),false);
 assert.equal(isLiveFresh({...data,observedAt:new Date(now+31*60000).toISOString()},now),false);
});
test('live numeric forecasts change demand and allocation; approved inputs cannot refresh',()=>{
 let state=initialState('live');assert.equal(evaluate(state).feasible,false);assert.throws(()=>transition(state,'approve'));
 const dry=current();dry.daily.precipitation_sum=Array(14).fill(0);dry.daily.et0_fao_evapotranspiration=Array(14).fill(5);
 state=transition(state,'live-inputs',{data:dry});assert.ok(evaluate(state).feasible);assert.equal(state.requested,40);
 const wet=structuredClone(dry);wet.daily.precipitation_sum=Array(14).fill(100);
 const revised=transition(state,'live-inputs',{data:wet});assert.ok(getScenario(revised).baseline<getScenario(state).baseline);assert.equal(revised.requested,0);assert.equal(evaluate(revised).feasible,false);assert.ok(Number.isFinite(evaluate(revised).score));
 state=transition(state,'approve');const captured=structuredClone(state.liveInputs);assert.throws(()=>transition(state,'live-inputs',{data:wet}),/frozen/);assert.deepEqual(state.liveInputs,captured);
});
test('stale live inputs block a new approval while historical demos remain independent',()=>{
 const data=current();data.mode='stale';assert.throws(()=>transition(initialState('live'),'live-inputs',{data}));
 const s=initialState('live',data);assert.equal(evaluate(s).feasible,false);assert.throws(()=>transition(s,'approve'));
 assert.equal(evaluate(initialState('dry')).feasible,true);
});
