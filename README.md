# NEXUS Studio · v0.6

Resource intelligence. Connected action.

An interactive hackathon prototype connecting Water + BioLoop, Energy scheduling and bounded RideShare missions through Sense → Optimise → Mobilise → Verify. Seri Murni is a fictional community. Public weather is real model data; site assumptions and demo outcomes remain explicitly labelled.

## Start in VS Code

Requires **Node.js 24.x**, including built-in SQLite. Check `node --version`. Run `npm.cmd install` once after cloning or pulling this deployment update. With `DATABASE_URL` blank, no external database setup is needed. Stop any older prototype terminal with Ctrl+C, then:

```powershell
cd C:\Users\eddac\source\repos\Nexus
npm.cmd start
```

Open http://localhost:5173. Keep that terminal running. In a second terminal:

```powershell
npm.cmd run accounts
```

This prints the different random passwords generated at first startup. Sign in through **Connections & audit**. Keep `.nexus/` private: it contains credentials, the device token, database and signing key; Git ignores it. Guest demo requires no sign-in and uses separate browser storage.

| Account | Server permissions |
| --- | --- |
| manager | Edit/approve plans, review outcomes and supplied site evidence. |
| staff | Record work, nursery weights/processing and Energy execution; import readings. |
| driver / rider | Separate resident participants; own bookings/check-ins/trip attestations. |
| auditor | Read-only workspace and signed export. |

## Deploy to Vercel with Neon

The same application can use Neon Postgres instead of local SQLite. Calculations, role permissions, workflows and API routes remain the same. Do not deploy a local SQLite database to a serverless filesystem.

1. Create a Neon Postgres project near the application (Singapore), then privately add the pooled `postgresql://…` connection string as `DATABASE_URL` in local `.env`.
2. Stop the old local server before migration. Run `npm.cmd run db:setup`. This verifies and copies existing local accounts/password hashes, records, telemetry, credits and the signed audit into an empty database in one transaction. It retains the original SQLite files. Local browser sessions are deliberately not copied; sign in again. Re-running setup on the same identity retains the existing cloud data; it does not resynchronise later local changes or overwrite a different identity.
3. Setup saves the original signing key as `NEXUS_SIGNING_KEY` privately in `.env`. Back up `.nexus/` and `.env` securely. Do not rotate this key on redeploy: the database fingerprint must continue to match it.
4. Commit/push source changes, then import the repository in Vercel with the **Node** preset and root `./`. The committed configuration selects Singapore and runs `npm run build`. Leave Output Directory at its default; do not set it to the repository root.
5. Add `DATABASE_URL`, `NEXUS_SIGNING_KEY` and the existing `NEXUS_ORS_API_KEY`, route endpoints and ThingSpeak settings from `.env` to Vercel's **Production** environment. Never add private values to Git or frontend code. Leave `PORT` and `NEXUS_DATA_DIR` unset on Vercel. Vercel provides deployment/production origins automatically; for a custom domain, set `NEXUS_PUBLIC_ORIGIN=https://your-domain.example` (no trailing slash). Preview deployments should use a separate Neon branch/database and matching setup, rather than sharing the production workspace.
6. Deploy, then verify login, Connections & audit, a signed export and public data refresh. An upstream API outage still displays its honest unavailable/stale state. A successful local test is not a guarantee of provider availability during deployment.

`npm.cmd run build` copies only the explicit static allowlist into generated `public/`. It obtains General Sans from official Fontshare if the locally licensed copy is missing, so the font need not be redistributed through Git. Private files and backend source are not public assets. Hosted cookies use Secure + HttpOnly + SameSite=Strict; exact-origin/CSRF checks remain enforced. Sessions, rate limits, records and checkpoints persist in Postgres. Database transactions use a per-township advisory lock to preserve audit ordering and reject concurrent stale revisions. This intentionally serialises one prototype township; it is not a multi-tenant throughput claim.

Validation: `npm.cmd test` runs local regression tests. `npm.cmd run test:postgres` uses the configured Neon connection but creates and removes only a random `nexus_test_…` schema, keeping synthetic test records out of the production `public` schema. The website remains a prototype: public reference streams do not become physical site telemetry through hosting.

## Implemented modules

- **Opportunity queue:** four computed candidates; physical constraints before 50/30/20 impact/cost/evidence scoring, mutually exclusive Water delivery alternatives and recorded-workflow status. A labelled seven-day fixture demonstrates the proposal's +25 m³ anomaly.
- **Evidence readiness:** each input has value, unit, source, time, freshness and weight. This is a transparent rules index, not calibrated statistical confidence.
- **Water + BioLoop:** four connected views, Live outlook, seasonal, explicit Dry spell +30%, dry reference and storm stress test; additional pilot costs, inventory constraints, human approval, work orders, simulated QR/check-in, staff-confirmed once-only credits, processing and outcome reconciliation.
- **Energy:** 24-hour public irradiance → assumed PV model, flexible equipment/window/grid-limit checks, interactive hourly chart, frozen approved schedule, staff attestation and synthetic or supplied billing-cycle outcomes. Scheduling only; no electricity rewiring, trading or CREAM settlement.
- **RideShare:** declared school/office or current forecast-rain trigger, bounded time window, consent, separate driver/passenger and two attestations before once-only demo credits. One-pair pilot workflow; self-attestation is not GPS or independent travel verification.
- **Server and connections:** account/role/CSRF checks, revision conflicts, transactional SQLite records/credits, signed audit, CSV and provider-token ingestion, reviewed tank/quality/route references and offline export verification. Missing devices remain missing.
- **UI:** forest identity, local Manrope and readable text; resource/approval/collection motion, chart controls, drafts/filters, keyboard/reduced-motion support and native mobile module selector. Identity page remains removed; source SVGs remain.

## Demonstration

Stay in Demo sandbox → Dry reference → Action studio. Compare Shared/Dedicated delivery and costs, inspect the receipt, approve. Community → book → simulated QR check-in. Check-in awards nothing; staff weighing awards once. Record processing after its declared model interval, complete all three work orders, then Impact ledger → load synthetic outcomes and export.

Dry fixture: 277.59 m³ modelled 14-day demand, 41.85 m³ potential potable avoidance, RM 20.29 net on a shared run. Synthetic reconciliation: 3.33 m³ reduced demand + 36 m³ substitution = 39.33 m³ potable avoidance. These are model/fixture values, not measured savings or mulch causality. The current intervention uses 1,500 kg already processed mulch; new collection replenishes a later cycle.

Energy → change PV/tariff/load choices → save/recalculate → inspect an hour → approve → staff execution → synthetic 30-day cycle. RideShare → current 90-minute test window → save → approve → consent → demo driver offers → different demo passenger joins → separately confirm both. Credits appear only after the second confirmation.

For real server permissions, manager approves, staff executes, manager reconciles. In RideShare, use the two resident accounts separately. Connections can import `samples/synthetic-water-week.csv` with **Synthetic / simulated** selected and a unique ID; its historical timestamps remain historical.

Keyboard: Ctrl/Cmd+K search; 1–4 Water views outside fields; map pan/zoom and arrow keys. Mobile uses bottom Water navigation and the module selector.

## Live data and evidence

[Open-Meteo](https://open-meteo.com/en/docs) provides Shah Alam current-model weather, hourly precipitation/chance/shortwave radiation and 14 daily rainfall/FAO ET₀ forecasts. Visible clients poll every minute; server cache is one minute, upstream timeout 6.5 seconds. Source/retrieval times remain separate. Failure labels last-known values and blocks new live approvals. Drafts follow changed sources; approval freezes inputs. Next-day irradiance is averaged over the preceding hour, converted to assumed PV yield, not measured production.

MET Malaysia/data.gov.my supplies district context with a ten-minute cache and dated fallback. Text descriptions never become invented rainfall. Retained July 2025 ERA5 reanalysis, Air Selangor tariff and FAO guidance are referenced in `data/README.md` and the in-app registry.

On-site tank, water and electricity readings require your provider or labelled CSV. Provider data is reported by the configured sender; manual imports are user-supplied, not independently certified. Public weather cannot replace site stock, laboratory evidence, permissions or outcome measurement. See `API.md`.

## Model and limitations

Daily irrigation = `max(ET₀ × 0.8 − rain × 0.70, 0) × 4500 ÷ 0.75 ÷ 1000` m³. This omits soil storage and needs calibration. Mulch covers 300 m² of 4,500 m²: `300 × 0.05 × 100 = 1500 kg`. Default 10% effect is unvalidated; sensitivity includes zero. A 55% processing yield/seven-model-day interval is a fixture, not a validated composting process. Demand reduction and rainwater substitution are accounted separately; future rain, stock, deliveries and credits are never added as duplicate water savings.

Tariff uses the retained non-domestic monthly bill schedule with an assumed meter class and other monthly use. Transport, handling and reward costs are assumptions, not quotations. Additional cost defaults to zero because unpriced; this is not full lifecycle ROI. Energy greedily enumerates feasible start slots, not a global optimum; capacity/load/tariff/labour/performance remain assumptions. Imported Water results compare 14 matching days with the model baseline without causal attribution. Energy compares 28–31-day daily grid-import cycles normalised by day count; no causal or weather-normalised saving is claimed.

## Audit and local operation

SQLite transactions append SHA-256-linked Ed25519-signed events. Triggers reject audit/telemetry/credit edits. Writes verify chain, record snapshots, import digests and a local signed anchor. Unique award keys prevent replay; revisions reject stale approvals. Reset starts a new cycle retaining signed history. Verify an exported bundle:

```powershell
node verify-evidence.mjs PATH_TO_EXPORTED_JSON OPTIONAL_PINNED_SHA256_FINGERPRINT
```

Keep an original fingerprint/checkpoint outside the server. This detects changes under that pinned identity; it is not absolute immutability against an administrator controlling both data and signing key. Without an independent pin, verification establishes internal consistency. Revision-zero fixtures are not signed field evidence.

Server binds loopback only; do not expose publicly as-is. Sessions expire after two hours. Production needs HTTPS, managed accounts/key rotation, organisation isolation, backups/privacy controls and independent execution evidence. Back up the whole `.nexus/` folder while stopped. `NEXUS_DATA_DIR` changes the private folder; `PORT` changes the port. Node may emit its SQLite experimental-feature notice.

```powershell
npm.cmd test
```

`engine.js`/`platform.js` own deterministic models and transitions; `evidence.js` evidence; `store.mjs` transactions/accounts/signatures; `api.mjs` routes; `workspace-ui.js` new module views alongside `app.js`. No build step or dependencies.

See `PILOT.md` for the real-world validation and governance plan. No physical devices, measured outcomes, interviews, field permissions or team biographies are invented.

Source logos stay in `assets/`; locally bundled Manrope retains its SIL Open Font License. References: [Open-Meteo/ERA5](https://open-meteo.com/en/docs/historical-weather-api), [MET](https://developer.data.gov.my/realtime-api/weather), [Air Selangor tariff](https://content.airselangor.com/cmi-prod-blobstorageanon-001-sea/media/uigh3doj/appendix-b.pdf), [FAO efficiency](https://www.fao.org/4/t7202e/t7202e08.htm).

## Free external services in v0.6

Connections & audit now includes an External data services panel. Water Overview adds official advisories and a 14-day GloFAS river-discharge model for a grid near Shah Alam. Energy includes national monthly electricity statistics; RideShare includes a configurable road route explorer. Charts let you inspect individual source points and export a source receipt.

Open-Meteo weather/irradiance and MET district forecasts remain connected. Official advisories, national electricity and the river model need no key. These sources keep their own scope and dates: national statistics are not this building’s meter, river flow is not tank stock or a street-flood alert, and advisory text must be read for the actual affected area. These references do not automatically change approved plans, issue dispatch or certify safe conditions.

For routing and ThingSpeak, copy `.env.example` to `.env` only if `.env` does not already exist; otherwise merge the required variables into the existing file. Set `NEXUS_ORS_API_KEY` from a free HeiGIT Standard account and your school/office start/end points in longitude,latitude order. Set `NEXUS_THINGSPEAK_CHANNEL_ID`, field number and actual unit; add a read key only for a private channel. Restart the server after changes. The browser shows Setup needed until configuration is supplied. Keys never appear in the browser or source receipts, and `.env` stays ignored by Git.

ThingSpeak is a read-only reference stream, not an automatic import into Tank A or the impact ledger. You must independently establish its field/unit/instrument association. A private channel is readable only by signed-in manager, staff or auditor; logging out clears it from the browser view. Calculated road routes stay separate from assumed mission distances and demo rewards and are not live congestion or GPS proof.

The backend uses fixed provider hosts, an eight-second request timeout, response-size limits, shared in-flight requests and caches: advisories 5 minutes, electricity 24 hours, river model 1 hour, ThingSpeak 1 minute and routes 1 hour. Failed checks preserve the previous successful retrieval as Last known, with a one-minute backoff. The visible client checks connections every five minutes; caching is not a claim that a provider updated its data.

Providers and attribution: [MET/data.gov.my](https://developer.data.gov.my/realtime-api/weather), [electricity dataset](https://data.gov.my/data-catalogue/electricity_consumption), [Open-Meteo/GloFAS](https://open-meteo.com/en/docs/flood-api), [HeiGIT](https://account.heigit.org/), [ThingSpeak](https://www.mathworks.com/help/thingspeak/readdata.html). Open-Meteo free access is for non-commercial evaluation/prototyping; retain source attribution and respect each provider’s free-tier limits.
