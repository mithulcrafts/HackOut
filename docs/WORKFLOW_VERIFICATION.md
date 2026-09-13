# Workflow verification

This note maps the HackOut’26 workflow to the current runnable application. It separates the scenario-backed fallback used without an approved provider from production integrations that still require utility data or Supabase deployment.

## Central journey

The implemented application follows:

```text
scenario forecast → Absorb/Protect classification → eligible activity → offer
→ accept/modify/skip/override → agreed schedule
→ provider or scenario reading → evidence verification → reward ledger
```

The shared scenario is created by `src/lib/demo-store.ts`. A browser session receives an HTTP-only session cookie; consumer and operator routes then read the same in-memory scenario.

## Consumer flow

| Workflow step | Current implementation |
|---|---|
| Sign in | `/login` establishes the consumer session; the normal journey opens the consumer dashboard. |
| Today recommendation | `/consumer/today` renders `ConsumerEvent` from `/api/consumer`. The seeded event can match EV, water-heating, industrial, laundry, dishwasher, irrigation, pool-pump, cold-storage and e-bike loads. |
| Offer inbox | `/consumer/offers` uses the same event surface and can select an offer by `offerId`. |
| Add activity | `/consumer/activities` posts timing and power constraints to `/api/activities`; the scheduler uses the active event window. Presets cover nine deferrable load types; custom loads receive an offer when the active programme includes `custom`. |
| Decision | `/api/consumer` accepts `accept`, `modify`, `skip` and `override` through `src/domain/events.ts`. Modify remains pending until accepted; skip and override have no penalty. |
| Activity detail | `/consumer/activities/[id]` reads `/api/activities/[id]` and shows requirements, schedule, evidence and reward state. |
| Completion evidence | `/api/consumer` submits completion and the operator `/operator/evidence` reviews the available reading trace. The scenario provider supplies a labelled trace until a trusted device adapter is connected. |
| Verification | `verifyScenarioOffer()` validates ordered, complete, device-matched intervals, deadlines, limits, baseline change and rebound. Missing data stays pending. |
| Rewards | `scenario.rewardLedger` is projected by `/api/rewards`; verified entries can be marked redeemable in the wallet. Cash values remain estimates until an approved programme funds them. |
| In-app notifications | Offer and verification state generate messages. Mark-all-read persists within the current session; later changes appear unread. No external push/SMS is sent. |
| Evidence review without hardware | `/consumer/evidence` accepts a strict, user-supplied meter/charger CSV and assesses it against an accepted window. It is explicitly untrusted review evidence and cannot alter schedules or release a reward. |

## Operator flow

| Workflow step | Current implementation |
|---|---|
| Overview | `/operator/overview` uses `summarizeScenario()` and `effectiveSchedules()` so every activity remains represented once. It includes renewable-mix, baseline/scheduled, battery and selected-slot ranked-recommendation charts; scenario values are labelled estimates and the view is read-only. |
| Events | `/operator/events` creates draft Absorb or Protect events, publishes offers and closes active/verifying events. |
| Flexibility | `/operator/flexibility` shows offers, accepted kW, verified kW and per-offer pending evidence. |
| Verification | `/operator/verification` links to the evidence review queue and displays received readings and exceptions. |
| Rewards | `/operator/rewards` sums the scenario reward ledger and shows the estimated event budget. |
| Reports | `/operator/reports` uses the event funnel: recommended → accepted → completed → verified. |
| Forecast evaluation | Forecast evaluation remains an internal engineering route and is not linked from the operator product navigation. |
| Settings | `/operator/settings` shows deterministic site and battery limits. |

## Numerical and truthfulness rules

- An unaccepted recommendation remains at its frozen baseline in operator demand calculations.
- An accepted schedule replaces that activity’s baseline exactly once; it does not add a duplicate load.
- `acceptedKW` means committed schedule power. `verifiedKW` is derived from evidence-backed eligible shifted energy.
- Rewards are released only after verification and are marked illustrative; no payment is sent.
- Renewable generation, demand, meter readings and battery dispatch are labelled estimates unless an approved provider or device supplies them.
- Operator actions are recommendations. The prototype does not issue curtailment, backup, charger or grid-control commands.

## Scenario fallback limits

The unified consumer/operator state is an in-memory map scoped to one session and one Node.js process. It keeps the product journey usable with scenario estimates, but it is not durable storage and is not shared across serverless workers or multiple app instances. Restarting the server resets the scenario.

Authenticated Supabase consumer RPCs remain authoritative for account data. Their returned state is mirrored into a shared in-memory operator programme namespace after each consumer read or action; this does not grant operator access or set a demo cookie. The separate authenticated operator account therefore sees the same accepted schedules, readings, verification results and reward ledger during the running session. Resetting an internal scenario clears only that offer's projected evidence and rewards. This is not a durable, multi-programme operator database and remains a single-process prototype boundary. User-uploaded CSV evidence is never treated as a trusted meter source. Real AMI/device readings, trained site generation models, device control, external push/SMS notifications and cash/bill-credit settlement remain production integration work. The app is browser-based; installable/offline PWA support remains a follow-on task. No cloud migration was applied during this verification pass.

The canonical forecast conversion is `src/domain/forecast/estimation.ts`, with weather contracts in `provider.ts`: irradiance is W/m² and wind speed is m/s. An optional Open-Meteo provider uses approximate profile city lookup; it does not request device GPS. Its current-day estimates are explicitly a what-if input alongside the fixed simulation day, not measured plant output. Missing city/data or service errors retain synthetic data with fallback metadata. Provider conversion and fallback are tested with injected weather responses. The internal Elexon path is a best-effort public-observation comparison, not a Gujarat plant accuracy claim; it falls back offline when outbound access is unavailable.

## Verification command

Run the full local smoke journey with a server running:

```bash
pnpm dev
pnpm test:smoke
```

The smoke script resets the demo before and after its scenarios, checks all consumer/operator routes, exercises all three sample activities, verifies idempotent reward release, and covers partial, late, rebound and missing-reading recovery.

Verification on 13 September 2026: lint, TypeScript, 81 automated tests and the production build passed after the latest feature additions. The earlier merged production build passed 99 HTTP checks, including a published Protect event, custom activity previews, invalid weather inputs, preview isolation, notifications and separate browser-session wallets. A live weather request in this environment used the labelled fallback because outbound provider requests failed; injected-provider tests cover successful conversion and metadata. Browser testing exercised accept → scenario reading review → verification → reward wallet release. The new forecast evaluation and evidence-review endpoints are covered by domain/type/build checks; a public-observation response was not available in this sandbox. These checks establish tested application behavior; they do not certify a live utility deployment or guarantee absence of every possible defect.


Product-flow cleanup on 13 September 2026: simulator controls, reset/replay choices and the forecast lab entry are removed from the product journey. Evidence review uses /operator/evidence; legacy operator URLs redirect to normal screens. Lint, TypeScript, 85 tests, the production build and 103 HTTP smoke checks passed.
