---
name: NEXUS Resource Mission Control
description: A botanical operations workspace for traceable township resource decisions.
colors:
  live-forest: "#214c3b"
  live-text: "#f2f8ef"
  rain-highlight: "#95cce3"
  credit-highlight: "#dbeabf"
  forest: "#183f33"
  green: "#276b4b"
  mint: "#d8e9ce"
  ink: "#253f35"
  muted: "#596d5e"
  canvas: "#f3f6f1"
  line: "#e0e7dd"
  water: "#54889b"
  amber: "#956021"
  white: "#ffffff"
  supporting-olive: "#63745b"
  asset-caption: "#52684f"
  focus: "#81ad5c"
  logo-forest: "#164d3c"
  logo-canopy: "#5dad82"
  logo-wordmark: "#173f34"
  logo-light: "#f1f7ed"
  logo-light-canopy: "#92d9aa"
  brand-mist: "#eef3ed"
typography:
  weather-display:
    fontFamily: "Manrope, 'Segoe UI', sans-serif"
    fontSize: "68px"
    fontWeight: 500
    lineHeight: 1.16
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope, 'Segoe UI', sans-serif"
    fontSize: "32px"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Manrope, 'Segoe UI', sans-serif"
    fontSize: "22px"
    fontWeight: 750
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  subheading:
    fontFamily: "Manrope, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 750
    lineHeight: 1.5
  body:
    fontFamily: "Manrope, 'Segoe UI', sans-serif"
    fontSize: "16px"
    lineHeight: 1.7
  metric:
    fontFamily: "Manrope, 'Segoe UI', sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.04em"
  button:
    fontFamily: "Manrope, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 750
    lineHeight: 1.45
    letterSpacing: "-0.01em"
  receipt:
    fontFamily: "Consolas, monospace"
    fontSize: "14px"
    lineHeight: 1.9
rounded:
  field: "7px"
  control: "8px"
  chip: "5px"
  navigation: "11px"
  panel: "15px"
  wallet: "25px"
  mobile-sheet: "22px 22px 0 0"
spacing:
  control-gap: "8px"
  mobile-gutter: "17px"
  workspace-gap: "20px"
  panel-inset: "21px"
  section-gap: "22px"
  desktop-gutter: "28px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "11px 15px"
  button-outline:
    backgroundColor: "{colors.white}"
    textColor: "#425b44"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "11px 15px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "#667b65"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "11px 15px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "#405b39"
    rounded: "{rounded.field}"
    padding: "10px 11px"
  panel:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  status-chip:
    backgroundColor: "#ecf4e7"
    textColor: "#507644"
    rounded: "{rounded.chip}"
    padding: "6px 8px"
  rail-link:
    backgroundColor: "transparent"
    textColor: "#c4d3c2"
    rounded: "{rounded.navigation}"
    padding: "10px 5px"
  rail-link-active:
    backgroundColor: "#d8e8cc"
    textColor: "#21482f"
    rounded: "{rounded.navigation}"
    padding: "10px 5px"
---

# Design System: NEXUS v2

## Overview

**Creative North Star: "Resource mission control"**

NEXUS uses a forest navigation rail, a pale botanical working canvas and a precise schematic resource map. Its identity is two interlocking paths that form an N, connecting township operations with community participation. The interface is compact and operational: balances lead to an asset, the asset leads to a plan, and the plan leads to an inspectable record.

This records the existing v2 visual direction with v3 live data and v4 readability/interaction refinements. The metaphor is drawn from the opening direction contract in `index.html`; it is not a newly approved brand statement. The contract's `nexus-resource-studio-02` string identifies the implementation direction and does not establish an externally approved design seed or image comp. The code is the authority for this record; route-specific composition is recorded in `.impeccable/surfaces/index-html.md`.

**Key Characteristics:**

- Compact navigation and restrained white panels on botanical tonal fields.
- Schematic assets and connected controls carry the resource story.
- Locally bundled variable type, tabular numerals and readable operational labels.
- Visible distinctions between public inputs, derived models, site assumptions and simulated outcomes.
- Desktop inspection becomes a native modal resource sheet on a phone.

## Colors

Forest and action green anchor the workspace; pale green neutrals support its density, while water blue and amber carry resource and constraint meaning. Frontmatter values are normative; source artwork retains its additional illustration colors.

### Primary

- **Forest:** persistent desktop rail and dark identity presentation.
- **Action Green:** primary controls, action links and affirmative resource intent.
- **Botanical Mint:** pale green field; active navigation uses the specific component variant recorded above.

### Secondary

- **Water Blue:** water-related vocabulary. The schematic and charts also use lighter blue and grey-green fills from their source artwork.
- **Evidence Amber:** constraint warnings and blocked-plan copy. Negative economics uses a brown treatment and explicit wording.

### Neutral

- **Ink:** main text and numeric hierarchy.
- **Muted:** descriptive copy on the working canvas; the implemented pair has approximately 5.10:1 contrast.
- **Canvas:** working background outside panels.
- **Line:** separators, panel boundaries and structural rules.
- **White:** cards, raised map labels and primary-button text.
- **Supporting Olive:** recurring small supporting labels and icons defined directly in the stylesheet.
- **Asset Caption:** small SVG caption text on white asset labels; the implemented pair has approximately 6.08:1 contrast.
- **Focus:** keyboard focus outline.

The SVG identity has its own **Logo Forest**, **Logo Canopy** and **Logo Wordmark** values. The light logo uses **Logo Light** and **Logo Light Canopy**. The identity board's **Brand Mist** is an asset-presentation swatch, not a replacement application canvas. Preserve supplied SVGs rather than redrawing their path lettering with a font.

**The Evidence Label Rule.** Color never upgrades an input's authority: public, derived, assumed and simulated status must remain stated in words.

## Typography

**Display and Body Font:** Manrope, with Segoe UI and sans-serif fallbacks. `assets/manrope.ttf` is bundled locally, preloaded by the workspace, declared as a variable face covering weights 400–800, and uses `font-display: swap`. There is no network font dependency.

**Receipt Font:** Consolas, with a monospace fallback, for calculation blocks only.

**Character:** Rounded, compact workhorse typography supports approachable operational controls. Tight tracking gives headings and balances hierarchy without a separate display face. Strong text, outputs, asset values, metrics and outcome charts use tabular numerals.

### Hierarchy

- **Headline:** 32px default page titles, 30px on mobile. Section titles normally 22px; task titles 16–18px.
- **Body:** 16px root and ordinary explanatory prose, generally 1.7–1.8 line height. Controls use 14–16px with 44px primary target heights. Plan prose is capped at 68ch.
- **Metric:** larger balances retain their role, with a 68px weather temperature. Tabular numerals preserve alignment.
- **Label:** desktop navigation 14px, mobile navigation 12px; secondary metadata 12–14px. Schematic SVG labels remain geographic annotations, with labelled HTML asset buttons below the map. Chart date labels use HTML so they do not shrink with the plot.
- **Tracking:** retain the existing Manrope voice; negative tracking stops at -0.04em.

## Layout

The desktop shell uses a fixed forest rail (112px) and a white top bar (76px). The remaining shell fills `100dvh`, with main content scrolling independently. Content starts with 25px top padding and 28px side gutters. Four resource balances share a row with vertical rules. Flexible minimum-zero columns keep data from dictating page width.

Overview pairs a flexible map with a 295px inspector and a 20px gap. The default map has a 360px minimum height and a 900 × 490 SVG coordinate system. A model timeline/chart sits below it. Action studio pairs work content with a 360px sticky control panel; the ledger uses a 310px breakdown. Community combines explanatory content, a 355px wallet column and a 210px contribution trail; the wallet itself is capped at 380px.

- **At 1600px and above:** gutters become 40px, the inspector becomes 330px, the map minimum height becomes 470px, and community uses a 380px wallet column and 250px trail.
- **At 1350px and below:** community becomes two columns with its trail beneath the introduction; studio and ledger side columns narrow.
- **At 1120px and below:** the rail narrows to 80px, gutters become 22px, search becomes an icon trigger, and the ledger stacks.
- **At 920px and below:** overview and studio become one column. The inspector initially becomes a two-column information block; plan controls move above the work area.
- **At 760px and below:** navigation becomes a fixed 68px bottom bar. The top bar becomes 65px; the shell reserves bottom-bar height; gutters become 17px. Metrics become a two-by-two grid, timeline content stacks and community puts its wallet first. The wallet is capped at 390px with 21px corners and loses its desktop shadow. Ledger tables scroll horizontally with a 630px minimum width.
- **At 390px and below:** gutters become 14px. Scenario choices use a two-column grid; the compact header keeps a 40px search control, weather status and readable location copy. The workspace initial is hidden.

Native dialogs provide source, weather, calculation, constraint, reset and resource details. The standard sheet is right-aligned, at most 540px wide, and fills viewport height. At phone widths, selecting an asset also opens its details in a bottom sheet capped at 88dvh. Keep a clear close control and the surrounding resource context.

## Elevation & Depth

White surfaces and thin borders provide most structure. Ordinary panels have no box shadow. Soft shadows belong to the resident wallet preview, map markers, selected segmented controls, dialogs, guided walkthrough and toast. The sidecar records actual values; the app has no generic elevation scale.

**The Quiet Panel Rule.** Routine containers use tonal separation and a thin boundary; floating feedback and modal content may lift above them.

The modal backdrop darkens and blurs the workspace. Mobile bottom navigation uses translucency. Reduced-transparency preferences remove these filters; higher-contrast preferences darken muted text and boundaries.

## Shapes

Panels, buttons, fields and chips use their dedicated corner roles. The rail logo tile and links have distinct corners; the wallet is more rounded than operational panels. The mobile resource dialog rounds its top corners only. Circular avatars, numbered stages, map markers and selection halos identify people, progress and spatial selection.

Two thick rounded interlocking paths create the N; wordmark lettering is authored SVG geometry with squared stroke ends. Interface icons use a 24px viewBox, 1.7px strokes and rounded caps/joins. Map roads, planting beds, water and markers are schematic geometry, not tiles or aerial imagery.

## Components

### Buttons

Primary, outline and ghost variants share compact, weighty text and a 42px minimum height. Small variants are 35px high with 8px × 11px padding. Primary hover darkens its fill; outline/ghost hover add pale green. Pressing scales to 0.97 over 65ms. Disabled buttons use 0.43 opacity and disabled semantics. Global keyboard focus is a 3px outline with a 4px offset.

### Chips

Status chips pair icon and wording with a pale green field; amber variants mark blocked evidence. Scenario controls form a segmented group with `aria-pressed`, white active segments and a subtle shadow. Dry/monsoon dots supplement labels. The evidence view explicitly distinguishes published/public, derived model, site assumptions and simulated outcome.

### Cards / Containers

White panels have a 1px line-colored boundary, clipped contents and no shadow. Insets depend on purpose: inspector 21px, plan controls 23px, task rows 20px × 24px. Repeated content uses dividing rules. The wallet contains a dark impact-balance card, light mission illustration and bordered mission body.

### Inputs / Fields

Native numbers, selects and textareas use white, a pale green 1px border, field corners and a 41px minimum height. Labels remain visible. Textareas resize vertically. Range controls have a 4px track and a green circular thumb edged in white. Allocation and mulch input immediately update water avoidance, RM benefit/cost and feasibility; changes then commit to the local scenario. Constraints disable inappropriate actions, and rejected transitions produce explanatory error toasts.

### Navigation

Desktop links stack icon over label in the forest rail. The current route uses a pale green tile and `aria-current="page"`. Four destinations become the phone bottom bar. Sense → Optimise → Mobilise → Verify is a separate cross-view progress strip. Ctrl/Cmd+K opens a native command dialog with arrow-key/Enter result navigation; shortcuts 1–4 change views outside inputs/dialogs.

### Schematic Resource Map

Three labelled keyboard-selectable assets link Tank A, Zone B and the nursery. Pointer dragging pans; arrow keys pan the focused map; controls zoom from 0.7× to 2.2×; fit restores the initial transform. Layer controls dim the other resource family. Selection updates the inspector and opens a resource sheet on mobile. The layout explicitly states it is illustrative. Dashed routes animate while the plan is mobilised; the 14-day model scrubber moves a particle and chart inspection point.

### Evidence and Outcome Views

Source cards expose original links and date context; assumption cards request site/pilot validation. Calculation receipts expose the model working. The weather chip opens MET Malaysia context through local `/api/weather`, whose adapter requests the official data.gov.my Petaling forecast endpoint. Original validity dates survive; unavailable refresh shows a saved public forecast with a notice. Forecast phrases never become invented numeric rainfall.

The ledger keeps m³, kg, demo credits and RM separate, labels outcomes synthetic, and exports evidence JSON. Availability, approval, staff weighing and processing affect the same intervention across views. The trail is editable browser storage, not an authenticated or immutable audit service. No real dispatch, sensors, payments or field verification are implied.

### Live Environment (v0.3)

The default overview starts with a two-column environment panel: a dark forest current-weather surface and a white numeric forecast surface. The current panel contains a source-specific cloud/rain illustration, temperature, humidity, interval precipitation and wind. The forecast side shows forecast-driven irrigation demand, rain total and twelve selectable hourly bars. Mobile stacks these surfaces. The muted device row explicitly says the tank and meter are not connected. Public feed details include source/retrieval times, failure state and model attribution.

Live outlook drives the same map, allocation and economics using a fourteen-day forecast. Its plan notice identifies the captured window and whether the reference updates in draft or is frozen after review. A failed refresh is visibly last known and blocks new live approvals; historical scenarios remain independent. Scoped styles live in live.css.

### Motion and Feedback

The shared easing is recorded in the sidecar. Navigation hover takes 150ms; buttons 140ms; numeric updates 190ms with cubic ease-out. Supported view transitions fade the old workspace over 130ms and introduce the new one over 180ms with a 5px offset. Dialog transforms take 220ms; active map routes use a 1.8s loop. Reduced-motion preferences remove CSS motion and skip JavaScript view/numeric animation. A polite live region announces feedback; state-changing actions restore useful focus.

Action choreography extends the existing motion grammar in v0.3: 320ms result-card entrance; 1100ms resource route draw with three 450ms node arrivals; 1000ms tank-level change from the recorded before/after stock; 950ms credit movement; 500ms bed coverage; 320ms task checks; 550ms result-bar reveal. These are action receipts, not simulated network latency. Each card is dismissible, retains readable final values, and expires after 8.5 seconds. Reduced motion removes spatial animation. Map zoom interpolates from its current presentation over 220ms and can be interrupted. Source spinners represent an actual pending request. Map routes pause offscreen or when the document is hidden.

## Do's and Don'ts

### Do:

- **Do** preserve the forest rail, botanical canvas, local Manrope face and authored interlocking N identity.
- **Do** connect balances, asset selection, plan controls and outcome receipts to the same intervention.
- **Do** keep units adjacent to values and source classes visible where claims are made.
- **Do** preserve keyboard selection, visible focus, dialog semantics, reduced motion and mobile bottom navigation.
- **Do** disclose prototype roles, local records, public forecast dates and simulated outcomes in the relevant flow.

### Don't:

- **Don't** use the old v1 sidebar, Bahnschrift/Segoe UI heading pairing or horizontal mobile navigation as v2 guidance.
- **Don't** present the schematic as geographic truth or the forecast chip as a meter feed.
- **Don't** imply a booking earns credits, raw waste is ready mulch, or community collection creates an additional water/carbon claim.
- **Don't** turn negative model economics or missing evidence into an affirmative green success claim.
- **Don't** describe the direction identifier as an approved seed, invent an approved comp, or add authentication, cloud publishing or an immutable backend to this record.

## v4 functional refinement

The auxiliary Identity route and its CSS are removed; logo SVGs remain in assets. New controls compare existing plan assumptions, retain the operator note and append to the same audit trail. Presets lock after approval. Clipboard summaries contain model/simulation disclosures and offer a selectable-text fallback. Previous/next/day-zero timeline controls never create operational outcomes. Map camera focus interpolates zoom and pan for 260ms, interrupts on drag or keyboard pan, and respects reduced motion. Evidence filters update only the source list and preserve focus. No dependencies or new data claims are introduced.
