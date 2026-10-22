# Proposal traceability and judging review · v0.5

Reviewed 22 October 2026 against the supplied Iteration 3 proposal and organiser clarification. “Implemented” means executable software prototype, not field deployment or externally proven impact.

| Proposal requirement | Implementation and review location | Status / boundary |
| --- | --- | --- |
| Sense → Optimise → Mobilise → Verify | Overview/queue → Action studio → work/community → ledger; server actors/revisions | Implemented prototype |
| Rule feasibility before weighted score | Water checks, Energy operating/grid limits, RideShare bounded trigger/time/capacity; queue 50/30/20 | Implemented deterministic rules, not global optimisation |
| Multiple opportunities, hard constraints | Shared/dedicated Water alternatives, Energy shift, RideShare mission; exclusive Water group | Implemented for declared illustrative assets |
| Per-input sources/times/confidence | Evidence readiness rows, source weights/completeness/freshness and missing feeds | Implemented rules index, not calibrated confidence |
| Structured explanation or constrained LLM | Template-generated explanations, formula receipts and constraint IDs | Implemented via allowed template option; no paid LLM needed |
| Human approval before action | Guarded state transitions and server manager role; frozen snapshots | Implemented; approvals are prototype records |
| DETECTED/SCORED/PENDING/APPROVED/MOBILISED/VERIFIED | Water trail logs first phases; approval event then mobilisation; labelled synthetic/imported result states | Implemented; final labels avoid overstating verification |
| Capacity, quality, permitted use, transport/owner | Water checks, non-potable landscape use; manager capture of supplied tank/quality/route references | Implemented guards and attestation, not legal/lab certification |
| Overview + three scenarios | Live plus seasonal, explicit +30% dry spell, original dry reference, monsoon | Implemented; stress scenarios clearly synthetic |
| Playbook calculation/cost/constraint audit | Allocation/mulch/delivery/extra-cost controls, receipts, negative economics | Implemented; labour/vendor/capital estimates still assumptions |
| Resident wallet, 1.5× booking/QR/weighed contribution | Separate booking/check-in/weighing, no credit until staff weighing; processing delay/raw-ready stock | Implemented; QR/check-in and physical receipt are simulated |
| Predicted vs actual 14-day ledger | Labelled synthetic model reconciliation or matching imported meter batch | Implemented; imported values not independently/causally verified |
| No double counting / ledger | Distinct quantities, exclusive intervention, unique award keys, server transactions | Implemented local prototype |
| Immutable audit vision | SQLite update/delete triggers, hash links, Ed25519 events/checkpoint, offline verifier | Tamper-evident under pinned key; not absolute host-admin immutability |
| Energy complements CREAM | Public next-day irradiance, same-load schedule, ticket, cycle comparison | Implemented load-shifting pilot; no electrical network/trading/settlement |
| Demand-triggered RideShare | School/office assumption or live forecast-rain threshold; bounded mission | Implemented one-pair pilot; live traffic/GPS absent |
| Verified shared-trip rewards | Separate consenting participants and two once-only attestations | Self-attested, not independent journey proof |
| Realistic / live data | Real public model weather/irradiance and retained official references; labelled CSV/provider ingress | Public source connected; physical devices not supplied |
| Malaysia applicability | Configurable assumptions/contract/roles; pilot rollout notes | Architecture path; current schema is one illustrative site |
| Pitch/governance/scalability/evidence | PITCH.md and PILOT.md | Content prepared; actual organiser-template deck/team details pending |

The original story's 200 kg raw → 110 kg mulch → 18 m³ immediate savings is not defensible as a measured conversion. This prototype uses 1,500 kg existing ready mulch over 300 m², explicitly models response sensitivity, keeps new collection for a future cycle and never claims synthetic results as field evidence. The +25 m³ weekly anomaly is reproduced in a labelled historical fixture. This is a deliberate correction to physical/accounting integrity.

## Published criteria

Source: [Sime Darby Property University Hackathon](https://www.simedarbyproperty.com/universityhackathon/), checked 22 October 2026. This is a qualitative readiness assessment, not a predicted judge score.

| Criterion | Weight | Current strength | Evidence needed to improve |
| --- | --- | --- | --- |
| Strategic Fit & Theme Relevance | 15% | Township resource workflow; circular material/community loop and operational energy/mobility | Crisp PLANET/theme framing and Malaysian pilot owner |
| Impact & Sustainability Value | 25% | Auditable water/energy accounting, synthetic vs supplied separation; negative cases visible | Actual baseline and post readings, uncertainty, controlled mulch pilot; no unsupported carbon |
| Innovation & Differentiation | 20% | A feasible action routed across operators and residents with an evidence trail | Primary-source competitor comparison, user workflow evidence; don't claim first/unique without research |
| Feasibility & Deliverability | 20% | Working UI, server roles, import contracts, deterministic tests and clear deployment boundaries | Supplier/route/quality review, device access, actual effort/cost quotations |
| Commercial & Value Multiplication | 10% | Shared-run economics and phased multi-township rollout hypotheses | Willingness-to-pay interviews, full lifecycle costs, approved reward funding |
| Team, Evidence & Pitch Quality | 10% | Repeatable demo, source registry, receipts, script, test evidence | Real team responsibilities, interview records, official template slides and rehearsal |

The strongest software areas are feasibility, traceability and mechanism demonstration. The biggest judging gaps are external validation and commercial evidence; more interface features alone do not close those gaps. No actual corporate dataset is required under the organiser's clarification, so disclosed synthetic inputs are acceptable; fabricated on-site readings are not.

## Verification and limitations

27 automated tests cover original Water/live models plus new readiness, schedules, ranking, +30% stress/costs, CSV, roles/revisions, credits, signatures/tampering/truncation, atomic ingestion, supplied tank guards, imported Water/Energy periods and HTTP session/CSRF/origin/device contracts. Browser QA covers desktop and phone, guest Energy and two-party RideShare, manager/staff login and Energy approval/execution, labelled CSV import, source refresh, module navigation and a clean console. Tests do not establish real-world savings or production security certification.

Outstanding external inputs: real meter/gateway access; actual water-quality/route/site permissions; calibrated irrigation response; genuine operating costs; physical staff execution; independent trip proof if required; real interviews, pilot results, reward funding and team names. The organiser's slide template could not be read through the available web tool; slide-ready content is supplied without pretending the template was populated. These remain visible delivery boundaries, not silently simulated evidence.
