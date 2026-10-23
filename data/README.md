# Public data provenance

## Climate reference

`climate-july-2025.json` retains the Open-Meteo archive response fetched on 21 October 2026. The full request is stored as `CLIMATE.sourceUrl` in `data.js`: model ERA5, requested 3.0738°N / 101.5183°E, dates 1–14 July 2025, timezone Asia/Kuala_Lumpur, precipitation_sum, et0_fao_evapotranspiration and minimum/maximum temperature. The returned grid centre is 3.0°N / 101.5°E. Daily rain/ET₀ are mm; temperatures are °C. All 14 rainfall and ET₀ records are finite. Rain sum: 11.20 mm; ET₀ sum: 67.63 mm.

Source: https://open-meteo.com/en/docs/historical-weather-api . Attribution: Open-Meteo, ECMWF ERA5 / Copernicus Climate Change Service. CC BY 4.0 data; this is regional model reanalysis, not a township rain gauge. Results are modified into site demand with explicitly provisional parameters. The two alternate scenarios apply disclosed multipliers; they are not additional real datasets.

## Forecast snapshot

`metmalaysia-snapshot.json` wraps seven official MET Malaysia forecast records for Petaling (`Ds057`) with source URL and an actual retrieval timestamp (2026-10-21T15:38:04.595Z). Forecast validity is 21–27 October 2026. Malay forecast wording is preserved. The server refreshes the fixed official endpoint when online, caches for ten minutes and uses labelled cached/snapshot data if unavailable. A later retrieval does not turn an old forecast into a forecast for today: always inspect each row's date.

API documentation: https://developer.data.gov.my/realtime-api/weather . Numeric rainfall is not available in this response and is never fabricated from the descriptive categories.

## Regeneration

Fetch and validate the original source response, retain it unchanged, record the actual retrieval time, and regenerate the corresponding exported constant in `data.js`. Check completeness and units before using it. Do not replace missing rainfall/ET₀ with zero. Run `npm.cmd test`; if changing the reference window or model parameters, update expected fixtures, displayed dates, provenance and documentation together.

## Site data

No internal Sime Darby Property dataset is included. Asset geometry, stock, collection weights, quality receipts, residents, staff, transport budgets and post-intervention readings are deliberately modelled or simulated. Their provenance is an assumption, not a public-data citation.

## Live feed (v0.3)

The local app requests the Open-Meteo forecast API directly through the local server's fixed `/api/live-weather` endpoint. It does not fall back to the 2025 climate fixture. The full public request is in `live.js`. Current-model conditions and the numeric fourteen-day forecast are validated for completeness, non-negative rain/ET₀, timezone, dates and units. Source time and retrieval time remain separate. One-minute polling does not imply that the upstream weather model changes every minute. Approved plans retain their captured forecast; later values are exported separately.

`tests/fixtures/public-weather.json` is a retained public API response fetched on 22 October 2026 MYT. It is used only by tests, never served as live data. The tests create explicitly synthetic clock-relative and dry/wet variants to check freshness, validation, zero demand, demand recalculation and frozen approval inputs. These test variants never appear in the application. Weather data attribution: Open-Meteo and the upstream weather-model providers, CC BY 4.0. Documentation: https://open-meteo.com/en/docs .

## External context in v0.6
New public responses are fetched on demand through server caches, not saved as fabricated static live snapshots. MET advisories retain issue and validity times (naive official timestamps interpreted as Malaysia time), including upcoming/expired context. Electricity series remains national monthly consumption in million kWh, with its latest published month shown explicitly. GloFAS discharge is modelled flow in m³/s for a returned grid near Shah Alam, at roughly 5 km resolution; UTC model dates are preserved and missing grid values remain missing. It cannot identify the intended local river with certainty or establish street flood safety.

Routing and ThingSpeak wait for local configuration. No public channel is chosen silently. Their field metadata, route estimates and timestamps are references; units and asset association require independent review. Read-only source receipts are separate from signed site telemetry and do not imply a physical device is installed or an intervention succeeded.
