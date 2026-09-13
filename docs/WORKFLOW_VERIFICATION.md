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
| Sign in | `/login` establishes the consumer session; `/consumer/onboarding` captures account type, programme, site, reminder and reward preferences before the consumer dashboard. |
| Today recommendation | `/consumer/today` renders `ConsumerEvent` from `/api/consumer`. The seeded event can match EV, water-heating, industrial, laundry, dishwasher, irrigation, pool-pump, cold-storage and e-bike loads. The home screen also shows a timing explanation and daily reward/activity summary. |
| Offer inbox | `/consumer/offers` uses the same event surface and can select an offer by `offerId`. |
| Add activity | `/consumer/activities` posts timing and power constraints to `/api/activities`; the scheduler uses the active event window. Presets cover nine deferrable load types; custom loads receive an offer when the active programme includes `custom`. Saved rows show status, schedule preview and links to edit, pause, resume or remove. |
| Decision | `/api/consumer` accepts `accept`, `modify`, `skip` and `override` through `src/domain/events.ts`. Modify remains pending until accepted; skip and override have no penalty. |
| Activity detail | `/consumer/activities/[id]` reads `/api/activities/[id]` and shows requirements, schedule, evidence and reward state. |
| Completion evidence | `/api/consumer` submits completion and the operator `/operator/evidence` reviews the available reading trace. The scenario provider supplies a labelled trace until a trusted device adapter is connected. |
| Verification | `verifyScenarioOffer()` validates ordered, complete, device-matched intervals, deadlines, limits, baseline change and rebound. Missing data stays pending. |
| Rewards | `scenario.rewardLedger` is projected by `/api/rewards`; verified entries can be marked redeemable in the wallet. Cash values remain estimates until an approved programme funds them. |
| In-app notifications | Offer and verification state generate messages. Mark-all-read persists within the current session; reminder and reward preferences are captured during onboarding/profile; later changes appear unread. No external push/SMS is sent. |
| Evidence review without hardware | `/consumer/evidence` accepts a strict, user-supplied meter/charger CSV and assesses it against an accepted window. It is explicitly untrusted review evidence and cannot alter schedules or release a reward. |

## Operator flow

| Workflow step | Current implementation |
|---|---|
| Overview | `/operator/overview` uses `summarizeScenario()` and `effectiveSchedules()` so every activity remains represented once. It includes renewable-mix, baseline/scheduled, battery and selected-slot ranked-recommendation charts, plus transparent score, urgency/feasibility factors and an accessible slot table; scenario values are labelled estimates and the view is read-only. |
| Events | `/operator/events` previews eligible impact without writing, creates draft Absorb or Protect events, publishes offers, shows participant counts/status and closes active/verifying events. |
| Flexibility | `/operator/flexibility` shows offers, accepted kW, verified kW and per-offer pending evidence. |
| Verification | `/operator/verification` links to the evidence review queue and displays received readings and exceptions. |
| Rewards | `/operator/rewards` sums the scenario reward ledger and shows the estimated event budget. |
| Reports | `/operator/reports` uses the event funnel: recommended → accepted → completed → verified. |
| Forecast evaluation | The internal evaluation engine compares time-ordered predictions with public Elexon BMRS observations when available, and falls back to a clearly labelled offline replay. It reports MAE, RMSE, MAPE (when non-zero), prediction-interval coverage and improvement against a simple persistence baseline. `/operator/forecast-lab` redirects to overview and `/operator/simulation` redirects to evidence review; neither is linked from product navigation. |
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

Authenticated Supabase consumer RPCs remain authoritative for account data. Their returned state is mirrored into a shared in-memory operator programme namespace after each consumer read or action; this does not grant operator access or set a scenario cookie. The separate authenticated operator account therefore sees the same accepted schedules, readings, verification results and reward ledger during the running session. Reset clears only that offer's projected evidence and rewards. This is not a durable, multi-programme operator database and remains a single-process boundary. User-uploaded CSV evidence is never treated as a trusted meter source. Real AMI/device readings, trained site generation models, device control, external push/SMS notifications and cash/bill-credit settlement remain production integration work. The app includes a manifest and lightweight service-worker shell for installability where supported; private data and mutations still require a connection. Apply the additive lifecycle and onboarding migrations in `supabase/migrations/20260913103000_activity_lifecycle.sql` and `supabase/migrations/20260913103100_consumer_onboarding_preferences.sql` before enabling those fields for authenticated accounts; no cloud migration was applied during this verification pass.

The canonical forecast conversion is `src/domain/forecast/estimation.ts`, with weather contracts in `provider.ts`: irradiance is W/m² and wind speed is m/s. An optional Open-Meteo provider uses approximate profile city lookup; it does not request device GPS. Its current-day estimates are explicitly a what-if input alongside the fixed simulation day, not measured plant output. Missing city/data or service errors retain synthetic data with fallback metadata. Provider conversion and fallback are tested with injected weather responses. The internal Elexon path is a best-effort public-observation comparison, not a Gujarat plant accuracy claim; it falls back offline when outbound access is unavailable.

## Verification command

Run the full local smoke journey with a server running:

```bash
pnpm dev
pnpm test:smoke
```

The smoke script resets the demo before and after its scenarios, checks all consumer/operator routes, exercises all three sample activities, verifies idempotent reward release, and covers partial, late, rebound and missing-reading recovery.

Verification on 13 September 2026: lint, TypeScript, automated tests, the production build and HTTP smoke checks passed after the latest feature additions. The smoke journey covers consumer accept/modify/skip/override, readings, verification, reward retries/redemption, event preview and publication, participant reporting, navigation, activity lifecycle, profile preferences, activity editing, validation, manifest and service-worker availability. A live weather request in this environment used the labelled fallback because outbound provider requests failed; injected-provider tests cover successful conversion and metadata. Browser testing exercised onboarding, the consumer day pulse, operator scored recommendations and the shared navigation with no current console errors. Product-flow cleanup removed simulator controls, reset/replay choices and the forecast-lab entry from normal navigation; evidence review uses `/operator/evidence` and legacy simulation URLs redirect to normal screens. These checks establish tested application behavior; they do not certify a live utility deployment or guarantee absence of every possible defect.
