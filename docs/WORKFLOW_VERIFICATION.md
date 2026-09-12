# Workflow verification

This note maps the HackOut’26 workflow to the current runnable prototype. It describes what is implemented in the local demo and separates it from production integrations that still require approved utility data or Supabase deployment.

## Central journey

The implemented demo follows:

```text
scenario forecast → Absorb/Protect classification → eligible activity → offer
→ accept/modify/skip/override → agreed schedule
→ simulated meter playback → evidence verification → reward ledger
```

The shared scenario is created by `src/lib/demo-store.ts`. A browser receives an HTTP-only `hackout_demo_session` cookie from `?demo=1`; consumer and operator routes then read the same in-memory scenario.

## Consumer flow

| Workflow step | Current implementation |
|---|---|
| Enter demo | `/login` links to `/consumer/today?demo=1`; `/src/proxy.ts` establishes demo access. |
| Today recommendation | `/consumer/today` renders `ConsumerEvent` from `/api/consumer`. The seeded event can match EV, water-heating, industrial, laundry, dishwasher, irrigation, pool-pump, cold-storage and e-bike loads. |
| Offer inbox | `/consumer/offers` uses the same event surface and can select an offer by `offerId`. |
| Add activity | `/consumer/activities` posts timing and power constraints to `/api/activities`; demo scheduling uses the domain scheduler and active event window. Presets cover nine deferrable load types; custom loads receive an offer when the active programme includes `custom`. |
| Decision | `/api/consumer` accepts `accept`, `modify`, `skip` and `override` through `src/domain/events.ts`. Modify remains pending until accepted; skip and override have no penalty. |
| Activity detail | `/consumer/activities/[id]` reads `/api/activities/[id]` and shows requirements, schedule, evidence and reward state. |
| Simulated evidence | `/api/consumer` uses `src/domain/playback.ts`; operator `/operator/simulation` can replay success, partial, late, rebound or missing readings. |
| Verification | `verifyScenarioOffer()` validates ordered, complete, device-matched intervals, deadlines, limits, baseline change and rebound. Missing data stays pending. |
| Rewards | `scenario.rewardLedger` is projected by `/api/rewards`; verified entries can be marked redeemable in the demo. Values are illustrative. |
| In-app notifications | Offer and verification state generate messages. Mark-all-read persists within the demo session; later changes appear unread. No external push/SMS is sent. |
| Evidence review without hardware | `/consumer/evidence` accepts a strict, user-supplied meter/charger CSV and assesses it against an accepted window. It is explicitly untrusted review evidence and cannot alter schedules or release a reward. |

## Operator flow

| Workflow step | Current implementation |
|---|---|
| Overview | `/operator/overview` uses `summarizeScenario()` and `effectiveSchedules()` so every activity remains represented once. It includes renewable-mix, baseline/scheduled, battery and selected-slot ranked-recommendation charts; all are simulated and read-only. |
| Events | `/operator/events` creates draft Absorb or Protect events, publishes offers and closes active/verifying events. |
| Flexibility | `/operator/flexibility` shows offers, accepted kW, verified kW and per-offer pending evidence. |
| Verification | `/operator/verification` links to labelled playback and displays the evidence queue. |
| Rewards | `/operator/rewards` sums the simulated reward ledger and shows the illustrative event budget. |
| Reports | `/operator/reports` uses the event funnel: recommended → accepted → completed → verified. |
| Simulation | `/operator/simulation` provides deterministic or Open-Meteo weather previews plus accepted-activity playback. The source, weather date and unchanged commitments remain visible. |
| Forecast evaluation | `/operator/forecast-lab` compares time-ordered predictions with public Elexon BMRS observations when available, and falls back to a clearly labelled offline replay. It reports MAE, RMSE, MAPE (when non-zero) and prediction-interval coverage against a simple baseline. |
| Settings | `/operator/settings` shows deterministic site and battery limits. |

## Numerical and truthfulness rules

- An unaccepted recommendation remains at its frozen baseline in operator demand calculations.
- An accepted schedule replaces that activity’s baseline exactly once; it does not add a duplicate load.
- `acceptedKW` means committed schedule power. `verifiedKW` is derived from evidence-backed eligible shifted energy.
- Rewards are released only after verification and are marked illustrative; no payment is sent.
- Renewable generation, demand, meter readings and battery dispatch are labelled simulation unless an approved provider or device supplies them.
- Operator actions are recommendations. The prototype does not issue curtailment, backup, charger or grid-control commands.

## Local demo limits

The unified consumer/operator state is an in-memory map scoped to one demo cookie and one Node.js process. It is suitable for a repeatable hackathon demonstration, but it is not durable storage and is not shared across serverless workers or multiple app instances. Restarting the server resets the scenario.

Authenticated Supabase consumer RPCs remain authoritative for account data. Their returned state is mirrored into an isolated operator simulation keyed by the verified account ID; this does not grant operator access or set a demo cookie. Reset clears only that offer's projected evidence and rewards. This is not a durable, programme-wide operator database. User-uploaded CSV evidence is never treated as a trusted meter source. Real AMI/device readings, trained site generation models, device control, external push/SMS notifications and cash/bill-credit settlement remain production integration work. The app is browser-based; installable/offline PWA support remains a follow-on task. No cloud migration was applied during this verification pass.

The canonical forecast conversion is `src/domain/forecast/estimation.ts`, with weather contracts in `provider.ts`: irradiance is W/m² and wind speed is m/s. An optional Open-Meteo provider uses approximate profile city lookup; it does not request device GPS. Its current-day estimates are explicitly a what-if input alongside the fixed simulation day, not measured plant output. Missing city/data or service errors retain synthetic data with fallback metadata. Provider conversion and fallback are tested with injected weather responses. The forecast lab's Elexon path is a best-effort public-observation comparison, not a Gujarat plant accuracy claim; it falls back offline when outbound access is unavailable.

## Verification command

Run the full local smoke journey with a server running:

```bash
pnpm dev
pnpm test:smoke
```

The smoke script resets the demo before and after its scenarios, checks all consumer/operator routes, exercises all three sample activities, verifies idempotent reward release, and covers partial, late, rebound and missing-reading recovery.

Verification on 13 September 2026: lint, TypeScript, 81 automated tests and the production build passed after the latest feature additions. The earlier merged production build passed 99 HTTP checks, including a published Protect event, custom activity previews, invalid weather inputs, preview isolation, notifications and separate browser-session wallets. A live weather request in this environment used the labelled fallback because outbound provider requests failed; injected-provider tests cover successful conversion and metadata. Browser testing exercised accept → simulated readings → verification → reward wallet release. The new forecast evaluation and evidence-review endpoints are covered by domain/type/build checks; a public-observation response was not available in this sandbox. These checks establish tested prototype behavior; they do not certify a live utility deployment or guarantee absence of every possible defect.
