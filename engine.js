import { CLIMATE } from './data.js';
import {isLiveFresh} from './live.js';
import {waterEvidence} from './evidence.js';
export const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const ASSUMPTIONS = {
  tariff: 3.83, lowerTariff: 3.51, tariffThreshold: 35, minimumBill: 36, otherMonthlyUse: 100,
  landscapeArea: 4500, cropCoefficient: 0.8, irrigationEfficiency: 0.75, effectiveRainFraction: 0.70,
  treatedArea: 300, mulchDepth: 0.05, mulchDensity: 100, mulchReduction: 0.10, mulchRequired: 1500, mulchReady: 1800,
  deliveryCost: 40, dedicatedDeliveryCost: 160, handlingCost: 40,
  campaignKg: 200, creditsPerKg: 2, multiplier: 1.5, creditValue: 0.10, yield: 0.55,
  collectionEfficiency: 0.80, catchmentArea: 500, tankCapacity: 60
};
export const SOURCES = [
  {id:'live',category:'Updating public feed',title:'Open-Meteo · Shah Alam current weather and 14-day forecast',date:'Source time and retrieval time shown in Live outlook',url:'https://open-meteo.com/en/docs',detail:'Current model weather and numeric daily rain / FAO ET₀ forecasts refresh from the public API every minute while the app is visible. Model values update on the provider’s schedule, not on every poll. Live outlook calculations use this numeric forecast. The source is not a township sensor; assumptions about assets and simulated outcomes remain separate.'},
  { id: 'tariff', category: 'Published tariff', title: 'Air Selangor · non-domestic water tariff', date: 'Effective 1 Sep 2025', url: 'https://content.airselangor.com/cmi-prod-blobstorageanon-001-sea/media/uigh3doj/appendix-b.pdf', detail: 'First 35 m³: RM 3.51/m³; above 35 m³: RM 3.83/m³; minimum RM 36. Applicability to the hypothetical park meter is an assumption. Avoided cost uses a monthly bill difference with 100 m³ other usage, not a fabricated RM 3 rate.' },
  { id: 'climate', category: 'Public reanalysis', title: 'Open-Meteo / ERA5 · Shah Alam vicinity', date: '1–14 Jul 2025', url: CLIMATE.sourceUrl, detail: '14 retained daily precipitation and FAO reference evapotranspiration values. Requested 3.0738°N, 101.5183°E; returned grid centre 3.0°N, 101.5°E. ERA5 is a gridded model informed by observations, not a local gauge or live township sensor. Dry reference uses the source values; other scenarios explicitly scale them.' },
  { id: 'weather', category: 'Official forecast', title: 'MET Malaysia via data.gov.my · Petaling', date: 'Forecast validity shown with each record', url: 'https://developer.data.gov.my/realtime-api/weather', detail: 'Daily-updated general forecasts: descriptions and min/max temperature. Refreshed through the local server. Cached fallback is labelled with retrieval time. Forecasts supply operational context only; categories are never converted into invented rainfall millimetres.' },
  { id: 'method', category: 'Reference method', title: 'FAO · crop water balance and efficiency', date: 'Indicative guidance', url: 'https://www.fao.org/4/t7202e/t7202e08.htm', detail: 'Indicative sprinkler application efficiency 75%. Daily demand is max(ET₀ × Kc − effective rainfall, 0) × area ÷ efficiency ÷ 1000. Area, Kc, effective-rain fraction and omission of soil storage require local calibration. This simplified model is not an engineered irrigation design.' },
  { id: 'site', category: 'Site assumptions', title: 'Pilot assets, stock and budgets', date: 'Illustrative site model', url: null, detail: '4,500 m² landscape; 500 m² roof; 60 m³ tank; 45 m³ starting stock in the dry scenario; 5 m³ reserve; 40 m³ fortnightly transfer cap. 300 m² treated beds × 0.05 m depth × 100 kg/m³ = 1,500 kg existing mulch. Stock, quality receipts, routes, handling fees and reward budgets are simulated; they are not SDP operational records.' },
  { id: 'effect', category: 'Sensitivity assumption', title: 'Mulch effect and outcome model', date: 'Unvalidated pilot parameters', url: null, detail: 'Default 10% irrigation reduction applies only to the 300 m² treated beds, not the entire 4,500 m² park. Slider explores 0–15%. Raw-to-processed yield 55% and 7-day processing are placeholders pending material validation. Post-intervention readings are synthetic and cannot prove real savings or causal attribution.' }
];
const scenarioFactors = { normal: { rain: 2.2, et: 0.90 }, dryspell: {rain:2.2,et:0.90,demand:1.3}, dry: { rain: 1, et: 1 }, monsoon: { rain: 8, et: 0.82 } };
export function dailyModel(key, liveInputs=null) {
  const source=key==='live'?liveInputs:CLIMATE;
  if(key==='live'&&!source)return [];
  const factors = key==='live'?{rain:1,et:1}:scenarioFactors[key];
  if (!factors) throw new Error('Unknown scenario');
  return source.daily.time.map((date, index) => {
    const sourceRain = source.daily.precipitation_sum[index];
    const sourceEt = source.daily.et0_fao_evapotranspiration[index];
    if (!Number.isFinite(sourceRain) || !Number.isFinite(sourceEt) || sourceRain < 0 || sourceEt < 0) throw new Error('Missing public climate inputs; calculation blocked.');
    const rain = sourceRain * factors.rain, et0 = sourceEt * factors.et;
    const demand = Math.max(0, et0 * ASSUMPTIONS.cropCoefficient - rain * ASSUMPTIONS.effectiveRainFraction) * ASSUMPTIONS.landscapeArea / ASSUMPTIONS.irrigationEfficiency / 1000 * (factors.demand??1);
    return { date, sourceRain, sourceEt, rain: round(rain), et0: round(et0), demand: round(demand) };
  });
}
const baselineFor = key => round(dailyModel(key).reduce((sum, day) => sum + day.demand, 0));
const normalBaseline = baselineFor('normal');
export const SCENARIOS = Object.fromEntries([
  ['normal', 'Seasonal baseline', 35, 20, true], ['dryspell','Dry spell +30%',45,40,true], ['dry', 'Dry reference', 45, 40, true], ['monsoon', 'Storm stress-test', 45, 30, false]
].map(([key, name, tank, target, quality]) => {
  const baseline = baselineFor(key);
  return [key, { name, baseline, historical: normalBaseline, tank, reserve: 5, transport: 40, quality, target,
    description: key==='dryspell'?'Synthetic demand stress +30% against the seasonal model':key === 'dry' ? `ERA5 reference · ${Math.round((baseline / normalBaseline - 1) * 100)}% above modelled baseline` : key === 'normal' ? 'Scaled reference · rainfall ×2.2 / ET₀ ×0.9' : 'Scaled reference · rainfall ×8 / ET₀ ×0.82',
    observedDemand: round(baseline * 0.988), observedRain: ['dry','dryspell'].includes(key) ? 36 : key === 'normal' ? 18 : 0,
    rainfall: round(dailyModel(key).reduce((sum, day) => sum + day.rain, 0)), factors: scenarioFactors[key] }];
}));

export function getScenario(state){
  if(state.scenario!=='live')return SCENARIOS[state.scenario];
  const input=state.liveInputs,days=dailyModel('live',input),baseline=round(days.reduce((sum,d)=>sum+d.demand,0));
  const supplied=state.siteInputs;
  return {...SCENARIOS.dry,...(supplied?{tank:supplied.tank.value,quality:!!supplied.quality?.reference&&(state.status!=='PENDING_HUMAN_REVIEW'||Date.parse(supplied.quality.expiresAt)>Date.now())}:{}),name:'Live outlook',baseline,historical:normalBaseline,target:Math.min(40,Math.floor(baseline)),description:'Current public forecast · declared site inputs',rainfall:round(days.reduce((sum,d)=>sum+d.rain,0)),factors:{rain:1,et:1},observedDemand:round(baseline*.988),observedRain:round(Math.min(36,baseline*.988)),window:input?input.daily.time[0]+' → '+input.daily.time.at(-1):'Waiting for public forecast'};
}

export function nonDomesticBill(volume) {
  if (!Number.isFinite(volume) || volume < 0) throw new Error('Monthly volume must be non-negative.');
  return round(Math.max(ASSUMPTIONS.minimumBill, Math.min(volume, 35) * 3.51 + Math.max(0, volume - 35) * 3.83));
}
export const processingLimit = kg => Math.floor(kg * ASSUMPTIONS.yield * 100 + 1e-9) / 100;
export function initialState(scenario = 'dry',liveInputs=null) {
  if (scenario!=='live'&&!SCENARIOS[scenario]) throw new Error('Unknown scenario');
  const state={ version: 2, scenario, requested: scenario==='live'?Math.min(40,Math.floor(getScenario({scenario,liveInputs}).baseline)):SCENARIOS[scenario].target, ...(scenario==='live'?{liveInputs}:{}), parameters: { mulchEffect: 0.10, deliveryMode: 'shared' }, status: 'PENDING_HUMAN_REVIEW', reservation: 0, tasks: { inspect: false, transfer: false, mulch: false }, collection: { status: 'AVAILABLE', claimedKg: 20, verifiedKg: 0, credits: 0, processedKg: 0 }, events: [{ sequence: 1, day: 0, actor: 'Resource engine', action: 'Opportunity modelled', detail: `${scenario==='live'?'Live outlook':SCENARIOS[scenario].name}; public weather reference and tariff; hypothetical site and outcomes.` }], observation: null, note: '' };
  const original=state.events[0],score=evaluate(state);
  state.events=[{...original,action:'Opportunity detected',detail:original.detail+' Candidate status: DETECTED.'},{sequence:2,day:0,actor:'Deterministic engine',action:'Opportunity scored',detail:'SCORED: '+score.score+'/100; '+score.checks.filter(c=>c.ok).length+'/'+score.checks.length+' hard constraints pass; evidence '+score.evidence.score+'/100 rules index.'},{sequence:3,day:0,actor:'Workflow router',action:'Pending human review',detail:'PENDING_HUMAN_REVIEW. No work, allocation or credits executed.'}];
  return state;
}
export function evaluate(state) {
  const s = getScenario(state);
  const a = ASSUMPTIONS;
  const requested = Number(state.requested);
  const maxWater = Math.max(0, Math.min(s.tank - s.reserve, s.transport, s.baseline));
  const valid = Number.isFinite(requested) && requested > 0 && requested <= maxWater;
  const checks = [
    { id: 'CAP_01', ok: valid, name: 'Available water and delivery capacity', detail: `${s.tank} m³ stored − ${s.reserve} m³ reserve; ${s.transport} m³ delivery capacity / 14 days. Request must be 0 < volume ≤ ${maxWater} m³.` },
    { id: 'QUALITY_02', ok: s.quality, name: 'Non-potable quality evidence', detail:state.siteInputs?(s.quality?'Operator-reviewed reference '+state.siteInputs.quality.reference+'. User attestation; not regulatory certification.':'A current operator-reviewed water-quality reference is required.'):(s.quality ? 'Synthetic lab receipt WQ-DEMO-21 is present. Real deployment requires local review.' : 'Quality receipt is missing after heavy rainfall. Allocation is blocked.') },
    { id: 'USE_03', ok: true, name: 'Landscape irrigation only', detail: 'Demo end-use is non-potable irrigation. This is a scenario rule, not regulatory certification.' },
    { id: 'OWN_04', ok:state.siteInputs?!!state.siteInputs.routeReference:true, name: 'Asset owner and route consent', detail:state.siteInputs?'Operator-reviewed route / owner consent: '+state.siteInputs.routeReference:'Simulated permissions for Tank A and the nursery; bowser route available.' },
    { id: 'BIO_05', ok: a.mulchReady >= a.mulchRequired, name: 'Existing processed mulch', detail: `${a.mulchReady} kg ready stock covers ${a.mulchRequired} kg application. New green waste replenishes a future cycle.` }
  ];
  if(state.siteInputs)checks.push({id:'SUPPLY_07',ok:state.status!=='PENDING_HUMAN_REVIEW'||Date.now()-Date.parse(state.siteInputs.tank.at)<=90*60000,name:'Supplied tank reading is current',detail:state.siteInputs.tank.source+' · '+state.siteInputs.tank.at+'. Approved supply evidence is frozen with the plan.'});
  const water = valid && s.quality ? requested : 0;
  if(state.scenario==='live')checks.push({id:'LIVE_06',ok:!!state.liveInputs&&(state.status!=='PENDING_HUMAN_REVIEW'||isLiveFresh(state.liveInputs)),name:'Current public forecast',detail:state.liveInputs?'Forecast captured '+state.liveInputs.fetchedAt+'. Approved inputs freeze; new weather never rewrites an approved plan.':'Waiting for a current public forecast. Approval is unavailable.'});
  const effect = state.parameters.mulchEffect;
  const conservation = round(s.baseline * (a.treatedArea / a.landscapeArea) * effect);
  const predictedTotal = s.baseline - conservation;
  const substitution = Math.min(water, predictedTotal);
  const avoided = conservation + substitution;
  const rewardBudget = a.campaignKg * a.creditsPerKg * a.multiplier * a.creditValue;
  const deliveryCost = state.parameters.deliveryMode === 'shared' ? a.deliveryCost : a.dedicatedDeliveryCost;
  const extraCost=state.parameters.extraCost??0;
  const cost = deliveryCost + a.handlingCost + rewardBudget+extraCost;
  const benefit = round(nonDomesticBill(a.otherMonthlyUse + s.baseline) - nonDomesticBill(a.otherMonthlyUse + predictedTotal - substitution));
  const evidence=waterEvidence(state);
  const scoreParts = { water: Math.round(50 * Math.min(1, avoided / Math.max(1,s.baseline) / 0.30)), cost: Math.round(30 * Math.min(1, benefit / cost)), data: Math.round(20*evidence.score/100) };
  return { checks,evidence,extraCost, feasible: checks.every(c => c.ok), maxWater, water, conservation, predictedTotal: round(predictedTotal), substitution: round(substitution), avoided: round(avoided), predictedPotable: round(predictedTotal - substitution), rewardBudget, deliveryCost, cost, benefit, net: round(benefit - cost), scoreParts, score: checks.every(c => c.ok) ? Object.values(scoreParts).reduce((x, y) => x + y, 0) : 0, collectedRain: round(s.rainfall / 1000 * a.catchmentArea * a.collectionEfficiency), uncertainty: [round(substitution), round(substitution + s.baseline * a.treatedArea / a.landscapeArea * 0.15)] };
}
function record(state, actor, action, detail, day) {
  const currentDay = state.events.at(-1)?.day ?? 0;
  state.events.push({ sequence: state.events.length + 1, day: Math.max(currentDay, day ?? currentDay), actor, action, detail });
}
export function transition(current, action, payload = {}) {
  const state = structuredClone(current);
  const active = state.status === 'MOBILISED';
  const collectionActive = active || ['SIMULATED_VERIFIED','EVIDENCE_REVIEWED'].includes(state.status);
  const a = ASSUMPTIONS;
  switch (action) {
    case 'live-inputs': {
      if(state.scenario!=='live'||state.status!=='PENDING_HUMAN_REVIEW')throw new Error('Approved forecast inputs are frozen.');
      if(!isLiveFresh(payload.data)||payload.data.daily?.time?.length!==14)throw new Error('A current and complete public forecast is required.');
      const first=!state.liveInputs;state.liveInputs=structuredClone(payload.data);const s=getScenario(state);
      state.requested=Math.min(first?40:state.requested,Math.floor(Math.min(s.baseline,s.tank-s.reserve,s.transport)));
      record(state,'Public weather API','Forecast inputs refreshed',state.liveInputs.daily.time[0]+' to '+state.liveInputs.daily.time.at(-1)+'; source '+state.liveInputs.observedAt+'; retrieved '+state.liveInputs.fetchedAt+'. Site stock remains an assumption.');break;
    }

    case 'assumptions': {
      if (state.status !== 'PENDING_HUMAN_REVIEW') throw new Error('Approved assumptions are locked. Start a new demo to change them.');
      const value = Number(payload.volume);
      if (!Number.isFinite(value) || value <= 0) throw new Error('Enter a positive water volume.');
      const mulchEffect = Number(payload.mulchEffect ?? state.parameters.mulchEffect);
      const deliveryMode = payload.deliveryMode ?? state.parameters.deliveryMode;
      const extraCost=Number(payload.extraCost??state.parameters.extraCost??0);
      if (!Number.isFinite(mulchEffect) || mulchEffect < 0 || mulchEffect > 0.15 || !['shared', 'dedicated'].includes(deliveryMode)) throw new Error('Invalid sensitivity parameters.');
      state.requested = value;
      if(!Number.isFinite(extraCost)||extraCost<0||extraCost>100000)throw new Error('Additional costs must be between RM0 and RM100,000.');
      state.parameters = { mulchEffect, deliveryMode,extraCost };
      record(state, 'Township manager (demo)', 'Plan assumptions updated', `${value} m³ requested; ${Math.round(mulchEffect * 100)}% effect on ${a.treatedArea} m² beds only; ${deliveryMode} delivery. Constraints and economics recalculated.`);
      break;
    }
    case 'approve': {
      if (state.status !== 'PENDING_HUMAN_REVIEW') throw new Error('This playbook has already been reviewed.');
      if (!evaluate(state).feasible) throw new Error('Resolve all hard constraints before approval.');
      state.reservation = Number(state.requested);
      state.reviewedAt=new Date().toISOString();
      state.status = 'APPROVED_BY_OPERATOR';
      state.note = String(payload.note || 'Reviewed the synthetic inputs, existing mulch stock and delivery budget.').slice(0, 500);
      record(state, 'Township manager (demo)', 'Playbook approved', `${state.reservation} m³ reserved. ${state.note}`);
      state.status = 'MOBILISED';
      record(state, 'Workflow router', 'Playbook mobilised', 'Three simulated work orders and one resident replenishment mission opened. No real dispatch.');
      break;
    }
    case 'reject':
      if (state.status !== 'PENDING_HUMAN_REVIEW') throw new Error('Only a pending playbook can be rejected.');
      state.status = 'REJECTED';
      record(state, 'Township manager (demo)', 'Playbook rejected', String(payload.note || 'Operator declined this intervention.').slice(0, 500));
      break;
    case 'cancel':
      if (!active || Object.values(state.tasks).some(Boolean) || state.collection.status !== 'AVAILABLE') throw new Error('Cancellation is available only before work or collection starts.');
      state.reservation = 0; state.status = 'CANCELLED';
      record(state, 'Township manager (demo)', 'Playbook cancelled', 'Water reservation released; resident mission closed.');
      break;
    case 'book':
      if (!collectionActive || state.collection.status !== 'AVAILABLE') throw new Error('An active mission is required, and a booking can only be made once.');
      state.collection.status = 'BOOKED';
      record(state, 'Resident (demo)', 'Drop-off booked', 'Nursery collection point · Saturday 09:00–11:00.');
      break;
    case 'checkin': {
      if (!collectionActive || state.collection.status !== 'BOOKED') throw new Error('Book a drop-off before checking in.');
      const kg = Number(payload.kg);
      if (!Number.isFinite(kg) || kg <= 0 || kg > 200) throw new Error('Enter a weight above 0 and at most 200 kg.');
      state.collection.claimedKg = kg; state.collection.status = 'AWAITING_WEIGHT';
      record(state, 'Resident (demo)', 'Demo collection code checked in', `${kg} kg claimed; staff weighing pending. No credits issued.`);
      break;
    }
    case 'weigh': {
      if (!collectionActive || state.collection.status !== 'AWAITING_WEIGHT') throw new Error('This collection is not awaiting weighing.');
      const kg = Number(payload.kg);
      if (!Number.isFinite(kg) || kg <= 0 || kg > a.campaignKg) throw new Error('Verified weight must be above 0 and within the 200 kg campaign cap.');
      state.collection.verifiedKg = kg;
      state.collection.credits = Math.floor(kg * a.creditsPerKg * a.multiplier);
      state.collection.status = 'VERIFIED';
      record(state, 'Nursery staff (demo)', 'Collection weight confirmed', `${kg} kg accepted; ${state.collection.credits} demo credits issued once. Material remains unprocessed.`);
      break;
    }
    case 'process': {
      if (!collectionActive || state.collection.status !== 'VERIFIED') throw new Error('Confirm the collection weight before processing.');
      const kg = Number(payload.kg);
      if (!Number.isFinite(kg) || kg <= 0 || kg > processingLimit(state.collection.verifiedKg) || Math.abs(kg * 100 - Math.round(kg * 100)) > 1e-7) throw new Error('Processed output must use at most two decimals and stay within the assumed 55% yield ceiling.');
      state.collection.processedKg = Math.round(kg * 100) / 100;
      state.collection.status = 'PROCESSED';
      record(state, 'Nursery staff (demo)', 'Processed batch released', `${state.collection.processedKg} kg added to ready stock after a simulated 7-day processing and quality check.`, (state.events.at(-1)?.day ?? 0) + 7);
      break;
    }
    case 'task': {
      if (!active || !Object.hasOwn(state.tasks, payload.task) || state.tasks[payload.task]) throw new Error('This work order cannot be completed again.');
      state.tasks[payload.task] = true;
      const detail = { inspect: 'Valve inspected; timer corrected in the simulation. No separate leak-saving claim recorded.', transfer: `${Math.min(getScenario(state).observedRain, Number(state.requested))} m³ delivered in the synthetic outcome, within reservation.`, mulch: `${a.mulchRequired} kg from existing ready stock applied to ${a.treatedArea} m² pilot beds. New collected waste is future replenishment.` };
      record(state, 'Facilities / landscape staff (demo)', `Work order completed: ${payload.task}`, detail[payload.task]);
      break;
    }
    case 'fail':
      if (!active) throw new Error('Only an active playbook can fail.');
      state.status = 'FAILED'; state.reservation = 0;
      record(state, 'Facilities staff (demo)', 'Execution failed', 'Bowser unavailable. Remaining reservation released; completed work and any issued credits retained. No verified saving claimed.');
      break;
    case 'verify': {
      if (!active || !Object.values(state.tasks).every(Boolean)) throw new Error('Complete all three work orders before loading the outcome.');
      const s = getScenario(state);
      const total = s.observedDemand;
      const rain = Math.min(s.observedRain, state.reservation);
      state.observation = { adjustedBaseline: s.baseline, total, rain, potable: round(total - rain), avoided: round(s.baseline - (total - rain)), conservation: round(s.baseline - total), days: 14 };
      state.status = 'SIMULATED_VERIFIED'; state.reservation = 0;
      record(state, 'Township manager (demo)', 'Simulated outcome reviewed', '14-day synthetic meter batch DEMO-POST-14 reconciled against a weather-adjusted synthetic baseline. Combined outcome only; causal attribution unproven.', 14);
      break;
    }
    default: throw new Error('Unknown action');
  }
  return state;
}
export function inventory(state) {
  const delivered = state.tasks.transfer ? Math.min(getScenario(state).observedRain, Number(state.requested)) : 0;
  const ready = ASSUMPTIONS.mulchReady + state.collection.processedKg - (state.tasks.mulch ? ASSUMPTIONS.mulchRequired : 0);
  return { delivered, tank: getScenario(state).tank - delivered, reserved: state.reservation ? Math.max(0, state.reservation - delivered) : 0, ready, unprocessed: state.collection.status === 'VERIFIED' ? state.collection.verifiedKg : 0 };
}
