# Workflow verification

This note maps the HackOut’26 workflow to the current runnable prototype. It records what is implemented locally and separates labelled scenario/weather estimates from production integrations that still require approved utility data or Supabase deployment.

## Central journey

The shared prototype follows:

```text
scenario forecast → Absorb/Protect classification → eligible activity → offer
→ accept/modify/skip/override → agreed schedule
→ simulated meter playback → evidence verification → reward ledger
```

The operator can also preview an event before publishing it. The preview reports eligible activities, projected shifted energy, projected concurrent flexibility and any remaining flexibility target. Publishing and later acceptance enforce the event’s requested kW cap. A browser receives an HTTP-only `hackout_demo_session` cookie from `?demo=1`; consumer and operator routes then read the same in-memory scenario.

## Consumer flow

| Workflow step | Current implementation |
|---|---|
| Enter demo | `/login` links to `/consumer/today?demo=1`; `/src/proxy.ts` establishes demo access. `/consumer/onboarding` offers consumer account types plus a programme-operator entry to the operator workspace. |
| Today recommendation | `/consumer/today` renders `ConsumerEvent` from `/api/consumer`. The seeded event can match EV, water-heating, industrial, laundry, dishwasher, irrigation, pool-pump, cold-storage and e-bike loads. The home screen also shows a timing explanation and daily reward/activity summary. |
| Offer inbox | `/consumer/offers` uses the same event surface and can select an offer by `offerId`. |
| Add activity | `/consumer/activities` posts timing and power constraints to `/api/activities`; demo scheduling uses the domain scheduler and active event window. Presets cover nine deferrable load types; custom loads receive an offer when the active programme includes `custom`. Saved rows show status, schedule preview and links to edit/pause/resume/remove. |
| Decision | `/api/consumer` accepts `accept`, `modify`, `skip` and `override` through `src/domain/events.ts`. Modify remains pending until accepted; skip and override have no penalty. Decisions are version checked, expiry checked against the deterministic replay clock (or an injected time), and rejected when they would exceed the event flexibility cap. |
| Activity detail | `/consumer/activities/[id]` reads `/api/activities/[id]` and shows requirements, schedule, evidence and reward state. |
| Simulated evidence | `/api/consumer` uses `src/domain/playback.ts`; operator `/operator/simulation` can replay success, partial, late, rebound or missing readings. |
| Verification | `verifyScenarioOffer()` validates ordered, complete, device-matched intervals, deadlines, limits, baseline change and rebound. Missing data stays pending. |
| Rewards | `scenario.rewardLedger` is projected by `/api/rewards`; verified entries can be marked redeemable in the demo. Values are illustrative. |
| In-app notifications | Offer and verification state generate messages. Mark-all-read persists within the demo session; reminder and reward preferences are captured during onboarding/profile; later changes appear unread. No external push/SMS is sent. |
| Evidence review without hardware | `/consumer/evidence` accepts a strict, user-supplied meter/charger CSV and assesses it against an accepted window. It is explicitly untrusted review evidence and cannot alter schedules or release a reward. |

The consumer renewable outlook uses monotone curves and a light area fill so the supply trend is easy to read. The load schedule intentionally uses step edges because dispatch is represented in discrete half-hour intervals. Both charts include a value table below the visual for accessible review.

## Operator flow

| Workflow step | Current implementation |
|---|---|
| Overview | `/operator/overview` uses `summarizeScenario()` and `effectiveSchedules()` so every activity remains represented once. It includes supply/demand, renewable-mix, baseline/scheduled, battery and selected-slot charts, plus ranked operator recommendations with transparent factors and an accessible slot table. Values are read-only scenario records. |
| Events | `/operator/events` previews eligible impact without writing, creates draft Absorb or Protect events, publishes offers, shows participant counts/status and closes active/verifying events. The seed contains a published Midday Absorb event and a visible draft Evening Protect event; Protect capacity is measured against the frozen baseline peak. |
| Flexibility | `/operator/flexibility` shows requested targets, offers, accepted kW, verified kW, participant windows and evidence outcomes. |
| Verification | `/operator/verification` displays an offer-level evidence queue with reading counts, result, recorded/eligible energy and reason, and links to labelled playback. |
| Rewards | `/operator/rewards` shows programme budget, pending commitments, verified ledger value, remaining illustrative budget and per-offer settlement preview. |
| Reports | `/operator/reports` uses the event funnel: recommended → accepted → completed → verified, with accepted/verified capacity, shifted energy, pending readings, failures and CSV export. |
| Simulation | `/operator/simulation` provides deterministic or Open-Meteo weather previews, solar/wind installation inputs, battery/recommendation output and accepted-activity playback. The source, weather date and unchanged commitments remain visible. |
| Forecast evaluation | `/operator/forecast-lab` compares a time-ordered causal forecast with a held-out target and a persistence baseline. It uses public Elexon BMRS observations when available and falls back to a clearly labelled deterministic replay. The page reports MAE, RMSE, MAPE (when non-zero), prediction-interval coverage and improvement against the baseline, with a smooth observed/predicted/baseline chart and value table. Public Elexon data is a method demonstration, not a Gujarat plant accuracy claim. |
| Settings | `/operator/settings` now edits site power, battery capacity/current energy, charge/discharge limits, round-trip efficiency, default illustrative reward and draft-event budget through `PATCH /api/scenarios`. Published event terms remain frozen. |

## Numerical and truthfulness rules

- An unaccepted recommendation remains at its frozen baseline in operator demand calculations.
- An accepted schedule replaces that activity’s baseline exactly once; it does not add a duplicate load.
- `acceptedKW` means committed schedule power. `verifiedKW` is derived from evidence-backed eligible shifted energy.
- `requestedFlexibilityKW` is enforced as an instantaneous concurrent kW cap. Absorb contributions are measured in the proposed renewable window; Protect contributions are measured as load removed from the protected baseline window.
- Offer expiry is checked at acceptance or modification. The local fixed-date replay uses a deterministic scenario-day clock so a repeatable fixture does not expire when the host date changes; a production caller can inject an authoritative current timestamp.
- `pendingReadings` is counted once per accepted offer with no terminal verification result (including `pending` or `needs_review`), never once per raw reading row.
- Rewards are released only after verification and are marked illustrative; no payment is sent.
- Renewable generation, demand, meter readings and battery dispatch are labelled simulation unless an approved provider or device supplies them.
- Operator actions are recommendations. The prototype does not issue curtailment, backup, charger or grid-control commands.

## Local demo limits

The unified consumer/operator state is an in-memory map scoped to one demo cookie and one Node.js process. It is suitable for a repeatable local demonstration, but it is not durable storage and is not shared across serverless workers or multiple app instances. Restarting the server resets the scenario.

Authenticated Supabase consumer RPCs remain authoritative for account data. Their returned state is mirrored into a shared in-memory operator programme namespace after each consumer read or action; this does not grant operator access or set a demo cookie. The separate authenticated operator account can therefore see the running-session commitments and evidence, but this is not a durable, multi-programme operator database. User-uploaded CSV evidence is never treated as a trusted meter source. Real AMI/device readings, trained site-generation models, device control, external push/SMS notifications and cash/bill-credit settlement remain production integration work. The app includes a manifest and lightweight service-worker shell for installability where supported; data mutations still require a connection.

The canonical forecast conversion is `src/domain/forecast/estimation.ts`, with weather contracts in `provider.ts`: irradiance is W/m² and wind speed is m/s. An optional Open-Meteo provider uses approximate profile city lookup; it does not request device GPS. Its current-day estimates are explicitly a what-if input alongside the fixed simulation day, not measured plant output. Missing city/data or service errors retain synthetic data with fallback metadata. Provider conversion and fallback are tested with injected weather responses. The forecast lab's Elexon path is a best-effort public-observation comparison, not a Gujarat plant accuracy claim; it falls back offline when outbound access is unavailable.

## Verification commands

Run the local checks with:

```bash
pnpm lint
pnpm typecheck
pnpm test -- --runInBand
pnpm dev
pnpm test:smoke
```

The automated suite covers the shared event lifecycle, requested flexibility limits, deterministic expiry, Protect scheduling, forecast evaluation, playback/verification, rewards, activity lifecycle, profile preferences, operator settings and route contracts. Smoke testing should be run with the server running and should reset the scenario before and after the journey.

The checks establish tested prototype behavior; they do not certify a live utility deployment or guarantee absence of every possible defect. A live weather request may use the labelled fallback when outbound provider access is unavailable; injected-provider tests cover successful conversion and metadata.
