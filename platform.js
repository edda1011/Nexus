import {evaluate,initialState,round} from './engine.js';
import {assessEvidence,waterEvidence} from './evidence.js';
import {isLiveFresh} from './live.js';

export const ENERGY_LOADS=[
  {id:'hall',name:'Community hall pre-cooling',kw:8,hours:2,original:17,earliest:10,latest:17},
  {id:'pump',name:'Landscape water pump',kw:4,hours:2,original:19,earliest:9,latest:20},
  {id:'charging',name:'Maintenance EV charging',kw:7,hours:3,original:20,earliest:8,latest:21}
];
export const CORRIDORS=[
  {id:'school',name:'Precinct 2 → school & transit',distanceKm:6,seats:3,start:'07:00',end:'09:00',peakDemand:18},
  {id:'office',name:'Precinct 2 → office hub',distanceKm:9,seats:3,start:'17:00',end:'19:00',peakDemand:12}
];
const sum=a=>a.reduce((x,y)=>x+y,0);
export const workflowLabel=value=>({PENDING_HUMAN_REVIEW:'Awaiting human review',MOBILISED:'Approved · action open',SIMULATED_VERIFIED:'Simulation reconciled',EVIDENCE_REVIEWED:'Imported evidence reviewed',SELF_ATTESTED:'Journey self-attested',REJECTED:'Not approved',CANCELLED:'Cancelled',OFFERED:'Seat offered',MATCHED:'Participants matched',PARTLY_CONFIRMED:'Waiting for the other participant',CONFIRMED:'Both participants confirmed'}[value]??value);
const bounded=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
function requireThat(ok,message){if(!ok)throw new Error(message);}
export function energyInitial(){return {revision:0,status:'PENDING_HUMAN_REVIEW',parameters:{pvKw:35,performance:0.8,tariff:0.50,labour:8,gridLimit:40,loadIds:ENERGY_LOADS.map(l=>l.id)},snapshot:null,completed:false,outcome:null,note:'',events:[]};}
export function evaluateEnergy(state,weather=null) {
  const p=state.parameters;
  requireThat(bounded(p.pvKw,0,500)&&bounded(p.performance,.1,1)&&bounded(p.tariff,0,5)&&bounded(p.labour,0,1000)&&bounded(p.gridLimit,5,500),'Invalid energy assumptions.');
  requireThat(Array.isArray(p.loadIds)&&new Set(p.loadIds).size===p.loadIds.length&&p.loadIds.every(id=>ENERGY_LOADS.some(l=>l.id===id)),'Choose valid shiftable loads.');
  if(state.snapshot)return structuredClone(state.snapshot);
  // A fixed synthetic day is the fallback, visibly labelled. No fake live solar output.
  const live=weather?.solar?.length>=24;
  const hours=live?weather.solar.slice(0,24):Array.from({length:24},(_,h)=>({time:`2026-10-21T${String(h).padStart(2,'0')}:00`,radiation:round(Math.max(0,Math.sin((h-6)/12*Math.PI))*750)}));
  const pv=hours.map(h=>round(h.radiation/1000*p.pvKw*p.performance));
  const base=hours.map(h=>{const hour=Number(h.time.slice(11,13));return hour>=8&&hour<=19?9:4;});
  const loads=ENERGY_LOADS.filter(l=>p.loadIds.includes(l.id));
  const baseline=[...base],planned=[...base],schedules=[];
  for(const l of loads)for(let h=l.original;h<l.original+l.hours;h++)baseline[h]+=l.kw;
  const marginal=(start,l)=>sum(Array.from({length:l.hours},(_,i)=>Math.max(0,planned[start+i]+l.kw-pv[start+i])-Math.max(0,planned[start+i]-pv[start+i])));
  // ponytail: enumerate one-hour slots per load; this greedy schedule is not a global optimum.
  for(const l of [...loads].sort((a,b)=>b.kw*b.hours-a.kw*a.hours)){
    const slots=Array.from({length:l.latest-l.earliest+1},(_,i)=>l.earliest+i).filter(start=>start+l.hours<=24&&Array.from({length:l.hours},(_,i)=>Math.max(0,planned[start+i]+l.kw-pv[start+i])).every(kw=>kw<=p.gridLimit));
    const start=slots.sort((a,b)=>marginal(a,l)-marginal(b,l)||a-b)[0];
    if(start===undefined){schedules.push({...l,start:null});continue;}
    for(let h=start;h<start+l.hours;h++)planned[h]+=l.kw;
    schedules.push({...l,start,shifted:start!==l.original});
  }
  const before=baseline.map((v,i)=>Math.max(0,v-pv[i])),after=planned.map((v,i)=>Math.max(0,v-pv[i]));
  const checks=[{id:'LOAD_01',ok:loads.length>0,label:'At least one shiftable operational load'},
    {id:'WINDOW_02',ok:schedules.every(l=>l.start!==null),label:'Every load fits its operating window and grid limit'},
    {id:'ENERGY_03',ok:Math.abs(sum(baseline)-sum(planned))<.01,label:'Same total load energy; no electricity rewiring'},
    {id:'GAIN_04',ok:sum(before)>=sum(after),label:'Grid imports do not increase'},
    ...(live?[{id:'SOURCE_05',ok:isLiveFresh(weather),label:'Public irradiance source is current at review time'}]:[])];
  const avoided=round(sum(before)-sum(after)),benefit=round(avoided*p.tariff),net=round(benefit-p.labour);
  const evidence=assessEvidence([{id:'solar',label:'Solar irradiance',value:hours.length,unit:'W/m² hourly',source:live?'Open-Meteo forecast':'Synthetic day profile',observedAt:live?weather.observedAt:'2026-10-21T00:00:00+08:00',historical:!live,maxAgeMinutes:90,class:live?'public':'simulation'},
    {id:'load',label:'Building / equipment loads',value:sum(baseline),unit:'kWh/day',source:'Illustrative equipment and building profiles',observedAt:'2026-10-21T00:00:00+08:00',historical:true,class:'assumption'}]);
  return {hours,pv,baseline,planned,before,after,schedules,checks,feasible:checks.every(c=>c.ok),avoided,benefit,cost:p.labour,net,totalKWh:round(sum(baseline)),beforeKWh:round(sum(before)),afterKWh:round(sum(after)),evidence,
    source:live?'Public irradiance forecast → assumed PV model':'Synthetic reference day',sourceTime:live?weather.observedAt:null,reviewKey:JSON.stringify([live?weather.observedAt:null,live?hours:null]),parameters:structuredClone(p),window:hours[0].time.slice(0,10),formula:'PV kWh per hour = irradiance W/m² ÷ 1000 × assumed kWp × performance ratio. Grid import = max(load − PV, 0). Benefit = avoided grid kWh × assumed RM/kWh − scheduling labour.'};
}
export function energyTransition(current,action,payload={},actor='Demo operator',weather=null){
  const s=structuredClone(current),event=detail=>s.events.push({at:new Date().toISOString(),actor,action,detail});
  if(action==='assumptions'){requireThat(s.status==='PENDING_HUMAN_REVIEW','Approved schedules are frozen. Create a new cycle.');s.parameters={...s.parameters,...payload};evaluateEnergy(s,weather);event('Energy assumptions changed.');}
  else if(action==='approve'){requireThat(s.status==='PENDING_HUMAN_REVIEW','This schedule has already been reviewed.');const e=evaluateEnergy(s,weather);requireThat(e.feasible,'Resolve schedule constraints.');s.snapshot=e;s.status='MOBILISED';s.note=String(payload.note||'').slice(0,500);requireThat(e.net>=0||s.note.trim().length>=10,'Explain the budget / non-financial reason for a negative-net plan (10 characters minimum).');event('Approved schedule-adjustment ticket; no remote equipment control. '+s.note);}
  else if(action==='reject'){requireThat(s.status==='PENDING_HUMAN_REVIEW','Only a pending schedule may be rejected.');s.status='REJECTED';event(String(payload.note||'Schedule declined.').slice(0,500));}
  else if(action==='complete'){requireThat(s.status==='MOBILISED'&&!s.completed,'An active, incomplete ticket is required.');s.completed=true;event('Facility staff attested schedule execution; physical execution not independently verified.');}
  else if(action==='verify-demo'){requireThat(s.status==='MOBILISED'&&s.completed,'Complete the schedule ticket first.');s.outcome={baselineKWh:s.snapshot.beforeKWh,actualKWh:round(s.snapshot.afterKWh*1.03),days:30,class:'simulation',batchId:'ENERGY-DEMO-30',note:'Daily-normalised 30-day synthetic billing-cycle comparison; weather / occupancy not causally isolated.'};s.outcome.avoidedKWh=round(s.outcome.baselineKWh-s.outcome.actualKWh);s.status='SIMULATED_VERIFIED';event('Loaded synthetic 30-day cycle; no measured electricity saving claimed.');}
  else if(action==='verify-import'){requireThat(s.status==='MOBILISED'&&s.completed,'Complete the ticket before reviewing meter evidence.');const o=payload.outcome;requireThat(o&&bounded(o.baselineKWh,0,1e8)&&bounded(o.actualKWh,0,1e8)&&o.days>=28&&o.batchId,'A complete billing-cycle batch is required.');s.outcome={...o,avoidedKWh:round(o.baselineKWh-o.actualKWh),class:'user-supplied',note:'Imported meter data, operator-reviewed; not independently certified or causally attributed.'};s.status='EVIDENCE_REVIEWED';event('Reviewed imported energy readings '+o.batchId);}
  else if(action==='reset'){return {...energyInitial(),revision:current.revision,events:[...current.events,{at:new Date().toISOString(),actor,action,detail:'New schedule cycle; prior history retained.'}]};}
  else throw new Error('Unknown energy action.');
  return s;
}
export function ridesInitial(now=Date.now()){const start=new Date(now);start.setUTCHours(23,0,0,0);if(start.getTime()<now)start.setUTCDate(start.getUTCDate()+1);return {revision:0,status:'PENDING_HUMAN_REVIEW',trigger:'school-peak',corridor:'school',startsAt:start.toISOString(),endsAt:new Date(start.getTime()+2*3600000).toISOString(),capacity:3,multiplier:1.5,baseCredits:20,trip:null,events:[],note:''};}
export function evaluateRides(s,weather=null,now=Date.now()){
  const corridor=CORRIDORS.find(c=>c.id===s.corridor),rain=weather?.hours?.filter(h=>Date.parse(h.time+'+08:00')>=Date.parse(s.startsAt)&&Date.parse(h.time+'+08:00')<=Date.parse(s.endsAt))||[];
  const demand=rain.length?Math.max(...rain.map(h=>h.probability)):null;
  const checks=[{id:'ROUTE_01',ok:!!corridor,label:'A defined shared corridor and capacity'},
    {id:'TIME_02',ok:Date.parse(s.endsAt)>now&&Date.parse(s.endsAt)>Date.parse(s.startsAt)&&Date.parse(s.endsAt)-Date.parse(s.startsAt)<=3*3600000,label:'An unexpired mission window of at most three hours'},
    {id:'TRIGGER_03',ok:s.trigger==='school-peak'||s.trigger==='office-peak'||(s.trigger==='rain'&&demand>=60&&isLiveFresh(weather,now)),label:s.trigger==='rain'?'At least 60% current public forecast rain probability in the mission window':'Declared school / office peak; demand is an assumption'},
    {id:'SEATS_04',ok:Number.isInteger(s.capacity)&&s.capacity>=1&&s.capacity<=(corridor?.seats??0),label:'Seat count stays within the selected demo vehicle capacity'}];
  return {corridor,rainProbability:demand,checks,feasible:checks.every(c=>c.ok),reviewKey:s.trigger==='rain'?JSON.stringify([weather?.observedAt,rain.map(h=>[h.time,h.probability])]):'declared-peak',creditsPerPerson:Math.floor(s.baseCredits*s.multiplier),avoidedVehicleKm:s.trip?.status==='CONFIRMED'?corridor.distanceKm:0,
    explanation:'A peak or a source-backed rain trigger creates a time-bound shared-trip mission. Approval opens it; separate driver and passenger accounts must confirm the same trip before once-only demo credits. Self-attestation is not GPS or independent journey verification.'};
}
export function ridesTransition(current,action,payload={},actor={username:'demo-driver',role:'resident'},weather=null,now=Date.now()){
  const s=structuredClone(current),add=detail=>s.events.push({at:new Date(now).toISOString(),actor:actor.username,action,detail});
  if(action==='assumptions'){requireThat(s.status==='PENDING_HUMAN_REVIEW','Approved mission parameters are frozen.');for(const k of ['trigger','corridor','startsAt','endsAt','capacity'])if(Object.hasOwn(payload,k))s[k]=payload[k];requireThat(['school-peak','office-peak','rain'].includes(s.trigger),'Invalid mission trigger.');requireThat(CORRIDORS.some(c=>c.id===s.corridor),'Invalid corridor.');requireThat(Number.isFinite(Date.parse(s.startsAt))&&Number.isFinite(Date.parse(s.endsAt)),'Invalid mission times.');add('Mission draft changed.');}
  else if(action==='approve'){requireThat(s.status==='PENDING_HUMAN_REVIEW'&&evaluateRides(s,weather,now).feasible,'Resolve mission constraints before approval.');s.status='MOBILISED';s.note=String(payload.note||'Peak-window community mission.').slice(0,500);s.forecast=weather?{observedAt:weather.observedAt,rainProbability:evaluateRides(s,weather,now).rainProbability}:null;add('Operator approved the bounded mission.');}
  else if(action==='reject'){requireThat(s.status==='PENDING_HUMAN_REVIEW','Only pending missions may be rejected.');s.status='REJECTED';add(String(payload.note||'Mission declined.').slice(0,500));}
  else if(action==='offer'){requireThat(s.status==='MOBILISED'&&!s.trip&&now<Date.parse(s.endsAt),'An active mission without a trip is required.');requireThat(payload.consent===true,'Confirm consent to share the demo trip.');s.trip={id:'TRIP-'+String(now)+'-'+s.revision,driver:actor.username,passenger:null,driverConfirmed:false,passengerConfirmed:false,status:'OFFERED',credits:0,claimClass:'self-attested'};add('Driver offered a seat on the approved corridor.');}
  else if(action==='join'){requireThat(s.status==='MOBILISED'&&s.trip?.status==='OFFERED'&&s.trip.driver!==actor.username&&now<Date.parse(s.endsAt),'A different resident must join an open trip before expiry.');requireThat(payload.consent===true,'Confirm consent to share this trip.');s.trip.passenger=actor.username;s.trip.status='MATCHED';add('Passenger accepted the same corridor and mission window.');}
  else if(action==='confirm'){requireThat(s.status==='MOBILISED'&&['MATCHED','PARTLY_CONFIRMED'].includes(s.trip?.status),'A matched, unconfirmed trip is required.');requireThat(now>=Date.parse(s.startsAt)&&now<=Date.parse(s.endsAt),'Trip confirmation must occur within the approved mission window.');requireThat(payload.tripId===s.trip.id&&payload.consent===true,'Confirm the correct trip and journey attestation.');const role=actor.username===s.trip.driver?'driver':actor.username===s.trip.passenger?'passenger':null;requireThat(role,'Only participants may attest this trip.');requireThat(!s.trip[role+'Confirmed'],'This participant has already confirmed.');s.trip[role+'Confirmed']=true;s.trip.status=s.trip.driverConfirmed&&s.trip.passengerConfirmed?'CONFIRMED':'PARTLY_CONFIRMED';if(s.trip.status==='CONFIRMED'){s.trip.credits=evaluateRides(s,weather,now).creditsPerPerson;s.status='SELF_ATTESTED';}add('Separate '+role+' attestation recorded'+(s.trip.status==='CONFIRMED'?'; demo credits eligible once.':'; awaiting other participant.'));}
  else if(action==='cancel'){requireThat(s.status==='MOBILISED','Only active missions can be cancelled.');s.status='CANCELLED';add('Mission cancelled; no new credits.');}
  else if(action==='reset'){return {...ridesInitial(now),revision:s.revision,events:[...s.events,{at:new Date(now).toISOString(),actor:actor.username,action,detail:'New mission cycle; prior history retained.'}]};}
  else throw new Error('Unknown RideShare action.');
  return s;
}
export function detectAnomalies(rows,expectedDaily=10,now=Date.now()){
  const output=[];const water=rows.filter(r=>r.kind==='water-use'&&r.unit==='m³/day').sort((a,b)=>a.at.localeCompare(b.at));
  if(water.length>=7){const week=water.slice(-7),actual=round(sum(week.map(r=>r.value))),expected=round(expectedDaily*7),excess=round(actual-expected);if(actual>expected*1.3&&excess>0)output.push({id:'water-spike',title:'Zone B irrigation above the declared weekly baseline',detail:`${actual} m³ versus ${expected} m³; +${excess} m³. Inspect the valve / timer before claiming a leak.`,class:week.every(r=>r.class==='simulation')?'simulation':'user-supplied',severity:'review'});}
  for(const kind of ['tank-volume','grid-import']){const last=rows.filter(r=>r.kind===kind).sort((a,b)=>b.at.localeCompare(a.at))[0],ttl=kind==='grid-import'?36*3600000:90*60000;if(!last)output.push({id:kind+'-missing',title:kind+' feed is missing',detail:'No site reading received. The illustrative model does not fill this gap.',class:'missing',severity:'missing'});else if(now-Date.parse(last.at)>ttl)output.push({id:kind+'-stale',title:kind+' source is stale',detail:`Last source reading ${last.at}; retained, not live.`,class:last.class,severity:'stale'});}
  return output;
}
export const DEMO_WATER_WEEK=Array.from({length:7},(_,i)=>({assetId:'zone-b',kind:'water-use',at:`2026-10-${String(i+8).padStart(2,'0')}T00:00:00+08:00`,value:i===6?35:10,unit:'m³/day',class:'simulation',batchId:'DEMO-ANOMALY-25'}));
export function rankOpportunities(water=initialState('dry'),energy=energyInitial(),rides=ridesInitial(),weather=null){
  const direct=evaluate({...water,parameters:{...water.parameters,deliveryMode:'shared'}}),alternative=evaluate({...water,parameters:{...water.parameters,deliveryMode:'dedicated'}}),e=evaluateEnergy(energy,weather),r=evaluateRides(rides,weather);
  const rows=[
    {id:'water-shared',module:'Water + BioLoop',route:'playbook',title:'Zone B: reuse water on an existing maintenance run',unit:'m³',impact:direct.avoided,reference:Math.max(1,direct.maxWater),benefit:direct.benefit,cost:direct.cost,readiness:waterEvidence(water).score,checks:direct.checks,exclusiveGroup:'zone-b-water',delivery:'shared'},
    {id:'water-dedicated',module:'Water + BioLoop',route:'playbook',title:'Zone B: dedicated bowser transfer',unit:'m³',impact:alternative.avoided,reference:Math.max(1,alternative.maxWater),benefit:alternative.benefit,cost:alternative.cost,readiness:waterEvidence(water).score,checks:alternative.checks,exclusiveGroup:'zone-b-water',delivery:'dedicated'},
    {id:'energy-shift',module:'Energy',route:'energy',title:'Move flexible loads toward local solar generation',unit:'kWh/day',impact:e.avoided,reference:50,benefit:e.benefit,cost:e.cost,readiness:e.evidence.score,checks:e.checks,exclusiveGroup:'facility-energy'},
    {id:'ride-peak',module:'RideShare',route:'rideshare',title:'Open a time-bound shared-trip mission',unit:'potential avoided vehicle-km/trip',impact:r.corridor?.distanceKm??0,reference:10,benefit:0,cost:r.creditsPerPerson*.1*2,readiness:r.rainProbability===null?25:45,checks:r.checks,exclusiveGroup:'mobility-window'}
  ];
  return rows.map(v=>{const state=v.module==='Energy'?energy:v.module==='RideShare'?rides:water,actionable=state.status==='PENDING_HUMAN_REVIEW',feasible=v.checks.every(c=>c.ok),net=round(v.benefit-v.cost),parts={impact:Math.round(50*Math.min(1,v.impact/v.reference)),cost:Math.round(30*Math.min(1,v.cost?v.benefit/v.cost:1)),data:Math.round(20*v.readiness/100)};return {...v,actionable,feasible,net,parts,score:feasible?sum(Object.values(parts)):0,decision:!actionable?'Recorded workflow · '+workflowLabel(state.status):!feasible?'Blocked':net<0?'Human budget justification required':'Reviewable'};}).sort((a,b)=>Number(b.actionable)-Number(a.actionable)||Number(b.feasible)-Number(a.feasible)||b.score-a.score||a.id.localeCompare(b.id));
}
export function parseReadingsCSV(text){
  if(typeof text!=='string'||text.length>400000)throw new Error('CSV must be under 400 KB.');
  const rows=[];let row=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell.length)throw new Error('Malformed CSV quote.');else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('Unclosed CSV quote.');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  const header=['assetId','kind','at','value','unit'];if(rows.shift()?.map(v=>v.trim()).join(',')!==header.join(','))throw new Error('Required header: '+header.join(','));
  if(!rows.length||rows.length>1000)throw new Error('CSV needs 1–1,000 data rows.');
  return rows.map((r,i)=>{if(r.length!==5||!r[3].trim()||!Number.isFinite(Number(r[3])))throw new Error('Invalid field count or value on row '+(i+2));return Object.fromEntries(header.map((h,j)=>[h,h==='value'?Number(r[j]):r[j].trim()]));});
}
