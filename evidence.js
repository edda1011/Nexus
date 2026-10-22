// Evidence readiness is a disclosed rules index, never a probability of real savings.
export function assessInput(input, now=Date.now()) {
  const present=input.value!==null&&input.value!==undefined&&input.value!==''&&!(typeof input.value==='number'&&!Number.isFinite(input.value));
  const complete=[present,!!input.source,!!input.unit,!!input.observedAt].filter(Boolean).length/4;
  const time=Date.parse(input.observedAt),ageMinutes=(now-time)/60000;
  const dated=Number.isFinite(time)&&ageMinutes>=-5;
  const fresh=dated&&(input.historical||!input.maxAgeMinutes||ageMinutes<=input.maxAgeMinutes);
  const weight={provider:0.9,public:0.8,reference:0.65,'user-supplied':0.6,assumption:0.35,simulation:0.15}[input.class]??0;
  const score=Math.round(100*complete*weight*(fresh?1:0.2));
  return {...input,present,complete:Math.round(complete*100),ageMinutes:dated?Math.max(0,Math.round(ageMinutes)):null,fresh,score,
    rating:!present?'Missing':!dated?'Invalid timestamp':!fresh?'Stale':input.class==='assumption'||input.class==='simulation'?'Provisional':score>=75?'High evidence readiness':'Medium evidence readiness'};
}
export function assessEvidence(inputs,now=Date.now()) {
  const rows=inputs.map(v=>assessInput(v,now));
  return {rows,score:rows.length?Math.round(rows.reduce((a,r)=>a+r.score,0)/rows.length):0,
    method:'Completeness (value, source, unit, date) × source-class weight × freshness. Weights: provider 0.90, public model 0.80, reference 0.65, user supplied 0.60, assumption 0.35, simulation 0.15. Stale/invalid time ×0.20. Not statistically calibrated confidence.'};
}
export function waterEvidence(state) {
  const live=state.scenario==='live',data=state.liveInputs,date=live?data?.observedAt:'2025-07-14T16:00:00Z';
  return assessEvidence([
    {id:'weather',label:'Rain / reference ET₀',value:live?(data?.daily?.time?.length===14?'14 daily rows':null):'14 retained daily rows',unit:'mm/day',source:live?'Open-Meteo forecast':'Open-Meteo / ERA5 retained response',observedAt:date,class:'public',historical:!live,maxAgeMinutes:90},
    {id:'tank',label:'Tank A starting stock',value:state.siteInputs?.tank.value??45,unit:'m³',source:state.siteInputs?.tank.source??'Illustrative site assumptions',observedAt:state.siteInputs?.tank.at??'2026-10-21T00:00:00+08:00',class:state.siteInputs?.tank.class??'assumption',historical:!state.siteInputs,maxAgeMinutes:90},
    {id:'quality',label:'Water quality / permission receipt',value:state.siteInputs?.quality?.reference??(state.scenario==='monsoon'?null:'WQ-DEMO-21 / simulated consent'),unit:'receipt',source:state.siteInputs?'Operator review; not independent certification':'Synthetic operational fixture',observedAt:state.siteInputs?.quality?.at??'2026-10-21T00:00:00+08:00',class:state.siteInputs?'user-supplied':'simulation',historical:!state.siteInputs,maxAgeMinutes:7*24*60},
    {id:'mulch',label:'Treated-bed irrigation response',value:state.parameters.mulchEffect*100,unit:'%',source:'Unvalidated pilot sensitivity',observedAt:'2026-10-21T00:00:00+08:00',class:'assumption',historical:true},
    {id:'tariff',label:'Non-domestic tariff reference',value:3.83,unit:'RM/m³',source:'Air Selangor published schedule; meter class assumed',observedAt:'2025-09-01T00:00:00+08:00',class:'reference',historical:true}
  ],state.status!=='PENDING_HUMAN_REVIEW'&&Number.isFinite(Date.parse(state.reviewedAt))?Date.parse(state.reviewedAt):Date.now());
}
