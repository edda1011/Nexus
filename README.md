# NEXUS Studio

Resource intelligence. Connected action.

A local, interactive prototype for the Sime Darby Property hackathon. One Water + BioLoop intervention connects rainwater, existing processed mulch, facilities work and a resident replenishment mission. Seri Murni is a fictional demonstration community; the map is a schematic, not actual property geography.

## Run in VS Code

Requires Node.js 20+. Open this repository folder in VS Code, then Terminal → New Terminal:

```powershell
npm.cmd start
```

Open http://localhost:5173. No npm install, API key or database setup is needed. Keep the terminal running; Ctrl+C stops it. If an earlier prototype is running, stop it and restart so the new weather endpoint is available. Use `npm.cmd test` for the engine/data checks.

## Readability and comparison controls (v0.4)

The product navigation no longer includes Identity and `/brand.html` returns 404; the original SVG logo assets remain in the repository. Manrope remains the interface family, with a 16px root/body, 14px desktop navigation and larger headings and captions. Mobile scenario choices use two columns, and the header reserves space for search and weather.

Action studio adds Max reuse, No mulch effect, Dedicated delivery and Restore plan defaults. They use the existing constraint/cost engine and append an assumption-change event; approval locks them. Defaults restore plan parameters without clearing history or the operator note. Copy plan summary includes the assumption and simulation disclosures, with selectable text if clipboard access is denied. Overview adds previous/next/day-zero controls and an interruptible focus-on-map camera move. Evidence filters distinguish public references from site assumptions.

## Live data and action animation (v0.3)

The app now opens in **Live outlook**, connected to [Open-Meteo's forecast API](https://open-meteo.com/en/docs) for Shah Alam. It requests actual current-model temperature, humidity, precipitation, weather code, wind, hourly numeric precipitation/chance, and fourteen daily rainfall/FAO ET₀ forecasts. No API key is needed for this non-commercial prototype. Modelled current conditions are not an on-site weather-station feed; outside native 15-minute regions they use interpolated hourly weather-model data.

- The visible app polls `/api/live-weather` every 60 seconds. The local server shares a 60-second cache and a single in-flight request, with a 6.5-second upstream timeout. Numbers change only when the source changes; polling never fabricates movement.
- The main weather panel shows the source time, retrieval time and connection status. Missing/invalid data is rejected. Failure retains the last successful values, labels them **last known**, and blocks new live approvals. With no previous data, the server returns 503 and the model waits. The client fetch has a nine-second timeout. Returning to a hidden tab triggers a new check.
- Live outlook uses the forecast's numeric rain and ET₀ in the irrigation model. The map balance, allocation cap, sensitivity, economics and calculation receipt use that same captured forecast. Historical scenarios remain independent.
- A pending plan adopts changed forecasts after field editing ends. Approval freezes the exact forecast, source time and retrieval time for that plan. New weather cannot rewrite its costs, reservations or result baseline. Export includes both the current public feed and the plan's captured reference.
- Tank A, the water meter, stock, quality receipts and post-intervention readings remain **unconnected / simulated**. A real device feed needs its provider endpoint, access details and server-side accounting. The app does not manufacture IoT readings.

Try **Live outlook → Review live plan**. Inspect the source, change allocation/cost assumptions and approve the demo. Approval draws the water → work → community connection; transfer completion animates the tank's actual before/after *simulation* balance; mulch completion covers the beds; staff weighing moves credits toward the wallet; reconciliation reveals the linked accounting result. Each action updates state immediately; animation does not create an artificial processing delay. The result card can be dismissed and mobilisation can be replayed without creating another action. Reduced-motion preferences preserve the result text without spatial animation. Routes pause when hidden/offscreen.

Current weather may produce low demand or negative net benefit. Keep that result visible; the historical Dry reference remains the repeatable teaching/demo case. Its fixed numbers below are not a claim about today's weather.

## What is real, derived, or simulated?

| Input | Evidence class | Implementation |
| --- | --- | --- |
| Shah Alam live weather + numeric forecast | Updating public model API | Open-Meteo through `/api/live-weather`; drives Live outlook with original source / retrieval times. |
| Petaling district forecast | Official public forecast | MET Malaysia via data.gov.my, refreshed through `/api/weather`; original validity dates and retrieval time retained. Saved fallback is visibly labelled. |
| Rainfall and reference evapotranspiration | Public gridded reanalysis | Open-Meteo / ERA5, 1–14 July 2025, Shah Alam vicinity. Retained daily records; not a local gauge or live sensor. |
| Non-domestic water tariff | Published tariff | Air Selangor schedule effective 1 September 2025; hypothetical meter category is an assumption. |
| Irrigation demand | Derived site model | Public climate inputs plus explicit area, Kc, efficiency and effective-rain assumptions. |
| Tanks, nursery stock, routes, receipts and budgets | Site assumptions | Fictional assets with declared constraints, ready-stock accounting and cost sensitivity. |
| Residents, staff, work completion and outcome readings | Simulation | No personal data, real dispatch, field verification or cash rewards. |

The dry reference uses the retained climate values: 11.20 mm rain and 67.63 mm ET₀ across the fortnight. The other two scenarios are transparent stress transformations, not observed seasons: Seasonal baseline uses rainfall ×2.2 and ET₀ ×0.90; Storm stress-test uses rainfall ×8 and ET₀ ×0.82. MET district descriptions remain context only. Live outlook uses a separate numeric Open-Meteo forecast; the three historical scenarios retain their reference window. A thunderstorm description is never converted into invented rainfall millimetres.

## Five-minute demonstration

1. Choose **Dry reference** for this repeatable walkthrough. **Overview:** select the three assets, pan/zoom the schematic map, change resource layers and scrub/play the 14-day model timeline. Playback previews a model; it does not finish work or create verified savings. The source button opens the evidence registry.
2. **Action studio:** change allocation, the 0–15% mulch sensitivity and delivery arrangement. Default dry reference: 277.59 m³ modelled irrigation, 41.85 m³ potential potable avoidance, RM 20.29 estimated net benefit. Dedicated delivery changes net benefit to −RM 99.71. Open Calculation receipt and constraints before approving.
3. **Community:** approval opens the local mission. Book a drop-off and simulate QR check-in for 20.1 kg. No credits appear yet. Return to the staff collection desk and confirm the weight: 60 demo credits are issued once.
4. **Action studio:** simulate 11.05 kg accepted processed output after seven model days. Complete all three work orders. The pilot uses 1,500 kg of existing processed mulch; the new contribution replenishes a future cycle.
5. **Impact ledger:** load the 14-day synthetic result. Default dry: 3.33 m³ less total demand + 36 m³ rainwater substitution = 39.33 m³ potable avoidance. This demonstrates reconciliation, not a measured site saving or proof of mulch causality. Export evidence JSON with public inputs, assumptions and the event trail.
6. **Storm stress-test:** missing quality evidence blocks approval. Reset clears the current scenario only. Cancellation is possible before work/collection starts; simulated failure preserves the trail and credits while releasing the remaining reservation.

Keyboard: Ctrl/Cmd+K searches views, assets and evidence; 1–4 changes views outside fields; the focused map supports arrow-key panning. Mobile uses bottom navigation and a resource detail sheet. Reduced-motion preferences disable transitions and numeric animation.

## Model and economics

Daily irrigation m³ = `max(ET₀ × 0.8 − rainfall × 0.70, 0) × 4500 ÷ 0.75 ÷ 1000`. This simplified daily water balance omits soil moisture storage and needs local calibration. FAO's 75% sprinkler efficiency is indicative guidance, not a measured system efficiency.

Mulch requirement = `300 m² × 0.05 m × 100 kg/m³ = 1500 kg`. Default 10% demand reduction applies only to the 300 m² pilot beds, or 6.7% of the landscape. It is unvalidated; the slider includes zero. Ready stock starts at an assumed 1,800 kg. A 55% processing yield and seven-day interval are placeholders, not a verified composting protocol.

Potable avoidance = total-demand reduction + eligible rainwater substitution. Stored rainwater, potential future roof inflow and delivered water are separate; rain is not counted twice. Allocation cannot exceed stock minus reserve, transport capacity or eligible demand. Credits and material kg are not added to water m³ or converted to unsupported carbon claims.

Published non-domestic tariff: first 35 m³ at RM 3.51/m³, above 35 m³ at RM 3.83/m³, minimum monthly bill RM 36. Avoided cost is a difference between monthly bills with an assumed 100 m³ of other use, keeping the comparison in the upper tier. The bill includes the model window within a hypothetical month; the app does not compare a 14-day volume with an actual monthly invoice.

Incremental delivery RM 40 on an existing run, dedicated delivery RM 160, handling RM 40, and the full 200 kg campaign reward cap RM 60 are provisional assumptions, not quotes. Positive water benefit need not mean positive financial benefit. Ranking is an illustrative weighted score, not an optimisation solver or calibrated confidence estimate.

## Sources and retained records

- [Air Selangor tariff appendix](https://content.airselangor.com/cmi-prod-blobstorageanon-001-sea/media/uigh3doj/appendix-b.pdf).
- [MET Malaysia API documentation](https://developer.data.gov.my/realtime-api/weather); fixed Petaling ID `Ds057`.
- [Open-Meteo historical weather documentation](https://open-meteo.com/en/docs/historical-weather-api); the full request and provenance are in `data.js`, with the original response in `data/climate-july-2025.json`.
- [FAO indicative irrigation efficiency](https://www.fao.org/4/t7202e/t7202e08.htm) and [crop water requirements](https://www.fao.org/aquastat/en/data-analysis/irrig-water-use/irrig-water-requirement/index.html).
- [Open-Meteo / ERA5 data attribution](https://open-meteo.com/en/docs/historical-weather-api). Open-Meteo data are provided under CC BY 4.0; ERA5 is produced by ECMWF through Copernicus Climate Change Service. This app uses reanalysis without site validation.

`data/README.md` records scope, retrieval dates and regeneration requirements. Do not change an old snapshot's retrieval date without actually fetching new data.

## Brand assets

Logo source files are retained in `assets/nexus-logo.svg`, `nexus-logo-light.svg` and `nexus-mark.svg`. The interlocking N represents the operations/community connection. SVG paths have no font dependency. The UI ships the official Manrope variable font locally under its SIL Open Font License in `assets/FONT-LICENSE.txt`.

## Architecture and prototype limits

Buildless ES modules, CSS and Node standard library; no installed packages. `engine.js` owns calculations and guarded transitions. `app.js` renders four connected views, local persistence and JSON export. `data.js` embeds retained public reference data; `weather.js` validates MET responses; `live.js` validates the numeric current/forecast feed and freshness; `motion.js` owns dismissible action feedback; `live.css` styles the live panel and action choreography. `server.mjs` serves an explicit file allowlist and fixed public forecast endpoints. MET uses a ten-minute cache and labelled retained snapshot; the live feed uses a one-minute cache, 6.5-second timeout and last-success / unavailable behavior described above.

The explanation is template-generated, not an LLM integration. Staff/resident roles are simulated; there is no authentication, real QR scanner, telemetry, payments, external dispatch or immutable audit backend. The editable localStorage trail is demonstration evidence only. Each scenario has one plan; multi-plan concurrency requires server-side transactional stock and permissions. Real pilot work needs measured stock, quality and route evidence, calibrated demand, supplier quotes, an approved processing method and outcome collection. No water-safety certification or regulatory compliance is implied by demo receipts.

The scope can serve Malaysian communities beyond one developer. Energy and mobility remain future modules, not implemented features.
