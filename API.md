# NEXUS local API · v0.6

Local prototype only, Node 24+, loopback binding. JSON bodies up to 512 KB; no cross-origin access. Credentials, device token and private signing key live in ignored `.nexus/`. Do not put them in source, screenshots or a public demo. Source labels describe provenance, not independent truth.

## Browser session

`POST /api/login` with `{ "username":"manager", "password":"YOUR_GENERATED_PASSWORD" }` returns user, csrf and expiry; sets an HttpOnly, SameSite=Strict two-hour cookie. `GET /api/session` returns the current user/CSRF or null, never passwords. Authenticated POSTs need the cookie plus `X-Nexus-CSRF`. `POST /api/logout` clears the session. Bad sign-ins are limited to 15/minute/IP. Browser Origin must match the local Host. Roles are server-derived; a payload cannot select its actor.

| Route | Purpose |
| --- | --- |
| GET /api/live-weather | Current public model weather, 48-hour precipitation chance, next-day irradiance and 14-day rain/ET₀. Public; source timestamps retained. |
| GET /api/weather | MET district forecast context; labelled cache/snapshot fallback. |
| GET /api/workspace | Authenticated module records, latest 500 readings, batch metadata, own/authorised credit totals and integrity summary. |
| POST /api/water/action | `{scenario,revision,action,payload}`; current revision required. |
| POST /api/energy/action | `{revision,action,payload}`; current revision required. |
| POST /api/rides/action | `{revision,action,payload}`; current revision required. |
| POST /api/telemetry | Provider Bearer token or manager/staff session+CSRF. |
| GET /api/integrity | Authenticated chain/checkpoint/fingerprint verification summary. |
| GET /api/evidence | Manager/staff/auditor signed evidence export; no passwords, token or private key. |

Water scenarios: `live`, `normal`, `dryspell`, `dry`, `monsoon`. Manager actions: assumptions, approve, reject, cancel, reset, verify, verify-import, live-inputs, site-inputs. Staff: task, fail, weigh, process. Residents: book/checkin with ownership checks. Energy manager handles drafts/approval/reconciliation/reset; staff handles complete. RideShare manager controls mission; residents offer/join/confirm their own trip with consent. All actions have deterministic guards. 401 unauthenticated, 403 role/CSRF/origin, 409 stale revision or conflicting/idempotent-key content, 400 invalid workflow/data, 503 unavailable required forecast. Refresh after 409 and review again; do not silently replay approvals.

Approving Live/Energy/rain-triggered RideShare requires the same current public source shown in the review. Supplied tank capture must still match the latest recent reading at approval. Negative Water/Energy economics require a meaningful operator reason. Approved inputs freeze; changing weather cannot rewrite the model baseline. Browser control payloads can be inspected in `workspace-ui.js`; pure transitions in `engine.js`/`platform.js` are shared with the server.

## Reading ingestion

```json
{
  "batchId": "gateway-unique-batch-001",
  "source": "Your instrument / export reference",
  "readings": [
    {"assetId":"tank-a","kind":"tank-volume","at":"2026-10-22T12:00:00+08:00","value":45,"unit":"m³"}
  ]
}
```

Provider: `Authorization: Bearer YOUR_LOCAL_DEVICE_TOKEN`; classification is forced to `provider`. Browser imports require `classification: "user-supplied"` or `"simulation"`; they cannot label themselves provider. Replace the example timestamp with the actual source time. A bearer sender is trusted to identify its source, not guaranteed physically truthful by cryptography.

| Asset | Kind | Exact unit | Allowed value |
| --- | --- | --- | --- |
| tank-a | tank-volume | m³ | 0–60 |
| tank-a | water-delivery | m³ | 0–40 |
| zone-b | water-use | m³/day | 0–100,000 |
| zone-b | soil-moisture | % | 0–100 |
| community-hall | grid-import / solar-generation | kWh/day | 0–100,000 |
| school-corridor / office-corridor | traffic-count | vehicles/hour | 0–100,000 |

1–1,000 rows per batch. ISO source timestamp must include timezone; future tolerance is five minutes. Values must be finite/nonnegative. Batch IDs: 3–80 letters/digits/hyphen/underscore. Source reference: 3–200 characters. Wrong asset/unit/range/duplicates reject the entire batch. Timestamps normalise to UTC. One asset/kind/source instant cannot be inserted twice even under a new batch ID. Same ID + same canonical source/class/content returns `duplicate:true,accepted:0`; changed content under that ID returns 409.

PowerShell provider example (local only; do not print the token or send it to an external service):

```powershell
$localNexusCredentials = Get-Content .nexus/bootstrap.json -Raw | ConvertFrom-Json
$localNexusPayload = @{
  batchId = 'tank-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  source = 'YOUR_ACTUAL_GATEWAY_REFERENCE'
  readings = @(@{assetId='tank-a'; kind='tank-volume'; at=[DateTimeOffset]::UtcNow.ToString('o'); value=45; unit='m³'})
} | ConvertTo-Json -Depth 5
# Replace value=45 with your actual measurement before running.
Invoke-RestMethod -Uri http://localhost:5173/api/telemetry -Method Post -ContentType 'application/json; charset=utf-8' -Headers @{Authorization=('Bearer ' + $localNexusCredentials.deviceToken)} -Body ([Text.Encoding]::UTF8.GetBytes($localNexusPayload))
```

CSV UI header: `assetId,kind,at,value,unit`. A blank template and clearly synthetic anomaly fixture are in `samples/`. Importing a historical fixture never makes it current. Tank freshness is 90 minutes; daily grid readings 36 hours. Water anomaly compares last seven readings against the declared 10 m³/day baseline, not a learned/validated leak detector.

## Evidence review contracts

Supplied Live tank inputs: manager captures latest non-synthetic tank reading no older than 90 minutes, water-quality document reference, sample time, future review expiry within seven days, owner/route reference and explicit reviewed attestation. The app records references; it does not inspect a laboratory document or certify water safety. Review expiry also guards execution of the transfer task.

Water outcomes: completed three work orders, one non-synthetic `zone-b/water-use` batch with exactly 14 distinct contiguous daily rows matching that plan's model window. Result is model-baseline minus imported potable use; no missing rain/conservation measurements are invented. Status is imported evidence reviewed, not independently verified savings.

Energy: two distinct, non-overlapping non-synthetic `community-hall/grid-import` batches, each 28–31 contiguous daily readings, actual cycle later than baseline. Values normalise per day. Occupancy/weather/load changes are not isolated; no causal saving claim.

RideShare: a distinct resident offers, another joins; both attest the same trip within its approved window, with consent. One-sided/replayed confirmations award nothing. Final class is self-attested. One driver/passenger pair is implemented per mission even if declared vehicle capacity is greater.

## Offline verification

Export in Connections, then `node verify-evidence.mjs exported.json PINNED_FINGERPRINT`. Verification checks Ed25519 signatures, links/sequence, signed checkpoint, revisioned record snapshots and telemetry batch digests. Keep the initial public-key fingerprint/checkpoint outside this machine. Host administrator control of the private key remains outside the guarantee. For production, replace local bootstrap accounts and shared gateway token with managed identities, scoped per-device credentials, HTTPS, rotation and durable external checkpoints.

## External service endpoints

GET-only same-origin routes, mounted before the authenticated operational actions:

| Route | Content | Access |
| --- | --- | --- |
| `/api/services/status` | Configuration flags and attribution, no keys | Public local client |
| `/api/services/warnings` | MET national advisory text with issue/validity times in MYT | Public local client |
| `/api/services/electricity` | Latest 24 available national total-sector monthly rows, million kWh/month | Public local client |
| `/api/services/flood` | 14 UTC model days of river discharge in m³/s for grid near Shah Alam | Public local client |
| `/api/services/route?corridor=school` | Configured school or office driving-car geometry, distance and duration | Public local client; server key required |
| `/api/services/thingspeak` | Selected channel field with original timestamps and declared unit | Public for a public channel; manager/staff/auditor for configured private read key |

Attempted source retrievals return `status` (`available`, `stale`, `unavailable`), `data`, original successful `fetchedAt`, latest `checkedAt`, and an actionable message where applicable. Setup responses use `not_configured` with a message, without retrieval timestamps; `/status` returns configuration flags rather than this envelope. Empty official warnings are valid; malformed provider records are rejected and the river model must declare m³/s. River nulls remain null. ThingSpeak empty/non-numeric fields are not zero; an undeclared unit is shown as `unit not configured` and requires independent review. An unavailable first retrieval contains no invented dataset. No client-provided URL can be fetched. Redirects are rejected; government URLs use their canonical trailing slash. Unknown corridors return HTTP 400 with `status: "invalid"`.

Configuration is loaded once at startup from the local `.env` file. The allowlisted static server does not serve `.env`, `.env.example`, backend modules or `.nexus`. `NEXUS_ORS_API_KEY` and `NEXUS_THINGSPEAK_READ_KEY` remain server-side. See `.env.example` for all variables. Routing targets the current `https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson` endpoint. No automatic site-data import, mission-distance rewrite or reward recalculation is performed from these reference feeds.
