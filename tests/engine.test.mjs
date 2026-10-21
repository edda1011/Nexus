import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, evaluate, transition, inventory, SCENARIOS, processingLimit, ASSUMPTIONS as A, round, dailyModel, nonDomesticBill } from '../engine.js';
import { CLIMATE, WEATHER_SNAPSHOT } from '../data.js';
import { normaliseForecast } from '../weather.js';

test('hard constraints block unsafe approvals, including invalid and excessive volumes', () => {
  assert.equal(evaluate(initialState('dry')).maxWater, 40);
  assert.equal(evaluate(initialState('dry')).collectedRain, 4.48);
  assert.throws(() => transition(initialState('monsoon'), 'approve'), /hard constraints/);
  for (const requested of [0, -1, 41, NaN, Infinity]) {
    const s = { ...initialState(), requested };
    assert.equal(evaluate(s).feasible, false);
    assert.throws(() => transition(s, 'approve'));
  }
});
test('approval reserves once, cancellation releases, and assumptions lock', () => {
  const s = transition(initialState(), 'approve');
  assert.equal(s.reservation, 40);
  assert.equal(s.status, 'MOBILISED');
  assert.throws(() => transition(s, 'approve'));
  assert.throws(() => transition(s, 'assumptions', { volume: 30 }));
  assert.equal(transition(s, 'cancel').reservation, 0);
  assert.equal(initialState().status, 'PENDING_HUMAN_REVIEW');
});
test('resident cannot mint credits; staff weighing is idempotent and raw waste is not ready mulch', () => {
  let s = transition(initialState(), 'approve');
  assert.throws(() => transition(s, 'checkin', { kg: 20 }));
  s = transition(s, 'book');
  s = transition(s, 'checkin', { kg: 20 });
  assert.equal(s.collection.credits, 0);
  s = transition(s, 'weigh', { kg: 20 });
  assert.equal(s.collection.credits, 60);
  assert.equal(inventory(s).ready, A.mulchReady);
  assert.equal(inventory(s).unprocessed, 20);
  assert.throws(() => transition(s, 'weigh', { kg: 20 }));
  assert.throws(() => transition(s, 'process', { kg: 12 }));
  s = transition(s, 'process', { kg: 11 });
  assert.equal(inventory(s).ready, A.mulchReady + 11);
  assert.throws(() => transition(s, 'process', { kg: 11 }));
});
test('all feasible scenarios reconcile substitution and conservation without double counting', () => {
  for (const scenario of ['dry', 'normal']) {
    let s = transition(initialState(scenario), 'approve');
    assert.throws(() => transition(s, 'verify'));
    for (const task of ['inspect', 'transfer', 'mulch']) s = transition(s, 'task', { task });
    const stock = inventory(s);
    assert.ok(stock.tank >= SCENARIOS[scenario].reserve);
    assert.equal(stock.ready, A.mulchReady - A.mulchRequired);
    s = transition(s, 'verify');
    assert.equal(s.observation.avoided, round(s.observation.rain + s.observation.conservation));
    assert.equal(round(s.observation.potable + s.observation.rain), s.observation.total);
    assert.equal(s.reservation, 0);
    assert.throws(() => transition(s, 'verify'));
    if (scenario === 'dry') assert.equal(s.observation.avoided, 39.33);
  }
});
test('edited allocation caps outcome delivery and failure never claims savings', () => {
  let s = transition(initialState(), 'assumptions', { volume: 10 });
  s = transition(s, 'approve');
  s = transition(s, 'task', { task: 'transfer' });
  assert.equal(inventory(s).delivered, 10);
  s = transition(s, 'fail');
  assert.equal(s.status, 'FAILED');
  assert.equal(s.reservation, 0);
  assert.equal(s.observation, null);
});

test('future stock replenishment can finish after outcome review without changing that outcome', () => {
  let s = transition(initialState(), 'approve');
  for (const task of ['inspect', 'transfer', 'mulch']) s = transition(s, 'task', { task });
  s = transition(s, 'verify');
  const outcome = structuredClone(s.observation);
  s = transition(s, 'book');
  s = transition(s, 'checkin', { kg: 20 });
  s = transition(s, 'weigh', { kg: 20 });
  s = transition(s, 'process', { kg: 11 });
  assert.deepEqual(s.observation, outcome);
  assert.equal(s.collection.credits, 60);
  assert.equal(inventory(s).ready, A.mulchReady - A.mulchRequired + 11);
  assert.equal(s.events.at(-1).day, 21);
  assert.ok(s.events.every((event, i) => i === 0 || event.day >= s.events[i - 1].day));
});

test('fractional collection weights never round processed output above the yield ceiling', () => {
  let s = transition(initialState(), 'approve');
  s = transition(s, 'book');
  s = transition(s, 'checkin', { kg: 20.1 });
  s = transition(s, 'weigh', { kg: 20.1 });
  assert.equal(processingLimit(20.1), 11.05);
  assert.throws(() => transition(s, 'process', { kg: 11.06 }));
  assert.throws(() => transition(s, 'process', { kg: 11.055 }));
  s = transition(s, 'process', { kg: processingLimit(20.1) });
  assert.equal(s.collection.processedKg, 11.05);
});

test('retained public data has a complete reference window and explicit units', () => {
  assert.equal(CLIMATE.daily.time.length, 14);
  assert.equal(CLIMATE.daily.time[0], '2025-07-01');
  assert.equal(CLIMATE.daily_units.precipitation_sum, 'mm');
  assert.equal(CLIMATE.daily_units.et0_fao_evapotranspiration, 'mm');
  for (const key of ['precipitation_sum', 'et0_fao_evapotranspiration']) {
    assert.equal(CLIMATE.daily[key].length, 14);
    assert.ok(CLIMATE.daily[key].every(v => Number.isFinite(v) && v >= 0));
  }
  assert.equal(round(CLIMATE.daily.precipitation_sum.reduce((a,b) => a+b,0)), 11.2);
  assert.equal(dailyModel('dry')[0].sourceRain, CLIMATE.daily.precipitation_sum[0]);
  assert.equal(round(dailyModel('dry').reduce((a,d) => a+d.demand,0)), SCENARIOS.dry.baseline);
});
test('tariff calculation respects published tiers and the minimum monthly charge', () => {
  assert.equal(nonDomesticBill(1), 36);
  assert.equal(nonDomesticBill(35), 122.85);
  assert.equal(nonDomesticBill(36), 126.68);
  assert.throws(() => nonDomesticBill(-1));
  const e=evaluate(initialState());
  assert.equal(e.benefit,round(nonDomesticBill(A.otherMonthlyUse+SCENARIOS.dry.baseline)-nonDomesticBill(A.otherMonthlyUse+e.predictedPotable)));
});
test('mulch benefit scales to treated beds and sensitivity/transport changes are honest', () => {
  const s=initialState(), e=evaluate(s);
  assert.equal(e.conservation,round(SCENARIOS.dry.baseline*A.treatedArea/A.landscapeArea*0.10));
  assert.ok(e.conservation < SCENARIOS.dry.baseline*0.01);
  const dedicated=transition(s,'assumptions',{volume:40,deliveryMode:'dedicated'});
  assert.ok(e.net>0);
  assert.ok(evaluate(dedicated).net<0);
  const conservative=transition(s,'assumptions',{volume:40,mulchEffect:0});
  assert.equal(evaluate(conservative).avoided,40);
  assert.throws(()=>transition(s,'assumptions',{volume:40,mulchEffect:0.9}));
});
test('official forecast normalisation rejects missing evidence and retains source dates', () => {
  const forecast=normaliseForecast(WEATHER_SNAPSHOT.records);
  assert.equal(forecast.length,7);
  assert.equal(forecast[0].location.location_id,'Ds057');
  assert.ok(forecast.every((row,i)=>i===0||row.date>=forecast[i-1].date));
  assert.throws(()=>normaliseForecast([{location:{location_id:'Ds057'},date:'2026-10-21',min_temp:null,max_temp:32,summary_forecast:'Unknown'}]));
  assert.throws(()=>normaliseForecast(null));
});
