# HackOut’26 Implementation Plan

> **Implementation status — 13 September 2026:** The integrated local demo now shares the Teammate A scenario across consumer offers, activity editing, operator events, meter playback, verification, rewards and in-app notifications. Absorb/Protect scheduling, battery guidance, what-if preview, reports, solar/wind estimator boundaries, ranked operator guidance and a forecast evaluation lab are implemented. Consumer presets also cover washing machine, dishwasher, irrigation pump, pool pump, cold-storage pre-cooling and e-bike charging. A no-hardware evidence-review path accepts a strict meter/charger CSV for untrusted assessment and never releases a reward. Older dated notes below record previous milestones; use [the current workflow verification](docs/WORKFLOW_VERIFICATION.md) for the implemented scope and deployment gaps. The authenticated Supabase consumer RPC path is still separate from the shared in-memory operator demo. Open-Meteo weather previews and an account-scoped mirror of authoritative consumer state are integrated. Live utility/device/payment integration, trusted meter adapters, production forecast training and installable/offline PWA behavior remain follow-on work.

## 1. Product scope

Build one mobile-first web application called **VidyutSutra** for the selected problem statement: **Smart Demand-Response & Load-Shifting System**.

The single product flow is:

```
Renewable estimate → surplus/shortage detection → personalised offer
→ user decision → schedule/reminder → simulated/device reading → verification → points/reward
```

The prototype coordinates flexible demand. It recommends storage, backup review and curtailment review to an authorised operator; it does not control generators, curtailment or real grid equipment. Solar and wind are used for the first demonstration, while the provider interface can later accept hydro, biomass or other scheduled renewable sources. All simulated generation, readings and illustrative rewards are labelled clearly.

The user-facing promise is: **tell us what must be done and by when; we find a useful time, show the reward and verify the result.** The forecasting module supports this demand-response experience; it is not presented as a second product.

## 2. Final technical approach

Use a single modular Next.js application:

```
Next.js App Router + TypeScript
├── React consumer and operator screens
├── Next.js Route Handlers for server operations
├── Supabase Auth, Postgres and Row Level Security
├── Forecast provider (simulation first, public weather later)
├── Renewable estimation and scheduling modules
├── Meter simulator with a future device-adapter contract
├── Verification, points and reward ledger
└── Event, notification and audit modules
```

Next.js App Router route handlers in `app/api/**/route.ts` are the backend boundary. Shared business logic is in `src/domain`, so it can be tested without rendering a page. Supabase stores the shared state and provides authentication and realtime updates. Vercel hosts the application.

Use `pnpm`, TypeScript strict mode, Zod for request validation, Recharts for graphs and Vitest for domain tests. Use `shadcn/ui` components installed into the repository, Tailwind CSS, Lucide React icons, `next-themes` for dark mode and `date-fns` for slot formatting. Use `sonner` for action feedback and `framer-motion` only for the single dashboard entrance and offer-state transition. Do not add a separate Python server, microservices, queue or optimisation package during the MVP.

## 3. Fixed simulation contract

- One simulated day with 48 half-hour slots.
- Timezone: `Asia/Kolkata`.
- Energy is kWh; limits and demand are kW.
- Renewable sources initially: solar and wind.
- Scenario contains renewable generation, fixed demand, activities and one battery.
- Every generated value includes a `data_source` field: `simulation`, `weather_estimate` or `device_reading`.

Shared types in `src/domain/types.ts`:

```
Scenario, TimeSlot, ForecastSlot, Activity, ScheduleEntry,
Offer, MeterReading, VerificationResult, RewardLedgerEntry,
BatteryState, LeaderboardRow
```

Every `Activity` has `type`, `requiredEnergyKWh`, `earliestStart`, `latestFinish`, `powerLimitKW`, `durationSlots`, `interruptible`, `baselineStart` and `status`.

Activity statuses are `recommended`, `accepted`, `skipped`, `completed`, `verified` and `failed`. Verification outcomes are separate: `pending`, `verified`, `partial`, `failed` or `needs_review`; missing evidence stays pending.

## 4. Supabase data model

Create migrations for these tables:

- `profiles`: user ID, display name, authorization role (`consumer` or `operator`), `user_type` (household, EV owner, business or campus), active site, points.
- `sites`: home, campus, business or industrial site and programme membership.
- `programmes`: operator-owned event programme, reward policy and funding status.
- `scenarios`: simulated date, site power limit, reward rate and mode.
- `forecast_slots`: slot start, solar kW, wind kW, renewable kW, fixed demand kW, source.
- `activities`: owner, device type, energy, timing constraints, baseline and status.
- `schedules`: event, activity, slot, planned kW, immutable baseline version and accepted flag.
- `offers`: event, activity, proposed slots, reward estimate, decision, expiry and version.
- `events`: objective (`absorb` or `protect`), window, eligible site, requested flexibility, budget and status.
- `event_participants`: event, activity, commitment and delivery status.
- `meter_readings`: event, activity/device, timestamp, cumulative kWh, service/process-complete flag, source and unique reading key.
- `verifications`: event, activity, frozen baseline energy, shifted energy, completion result, reason and status.
- `reward_ledger`: event, user, activity, points, illustrative cash amount, state and unique activity key.
- `notifications`: recipient, event/activity, channel, message, read state and delivery status.
- `audit_log`: actor, action, object, timestamp and human-readable reason.
- `battery_state`: scenario, capacity, current kWh, charge/discharge limits.

Enable RLS on every exposed table. Consumers read their own activities, offers, readings and rewards. Operators read the selected scenario and aggregate results. Only server-side route handlers may perform schedule reservations, verification and reward-ledger writes.

## 5. Feature implementation

### 5.1 Authentication and roles

Use Supabase email/password authentication with `@supabase/ssr`. Create a profile row after signup. Add middleware to refresh the session and protect `/consumer` and `/operator`. Check the role again in every server operation; never rely only on hiding a button in React.

### 5.2 Scenario seed, programme events and simulation controls

Implement `POST /api/scenarios/seed`. It creates one deterministic scenario, 48 slots, fixed demand, three activities and a battery. Use a fixed random seed so the demo is repeatable. Add `POST /api/scenarios/:id/reset` to restore it. Implement a small event wizard for operators: objective, window, eligible activities, reward rate, budget and expiry. Seed one Absorb event and one Protect event.

An event has the lifecycle `draft → active → verifying → closed` for the MVP. Every offer, accepted schedule, reading, verification and reward references its event. At publication, freeze the baseline demand and reward terms; previews and later opt-outs must never rewrite that baseline. A later release may add a separate published approval state.

Expose these event operations:

```text
POST /api/events                 create draft event
GET  /api/events                 list operator events and statuses
POST /api/events/:id/publish     activate event and generate eligible offers
POST /api/events/:id/close       close after verification
GET  /api/events/:id/report      recommended → accepted → completed → verified funnel
GET  /api/events/:id/participants aggregate participant status
```

The event report is the shared source for the consumer history and operator dashboard.

The operator simulation panel edits renewable multiplier, demand multiplier, acceptance rate, reward rate and battery capacity. `POST /api/scenarios/:id/preview` calculates against an in-memory copy and does not modify accepted offers.

### 5.3 Consumer activity creation

Provide preset cards for EV, water heater, industrial process, washing machine, dishwasher, irrigation pump, pool pump, cold-storage pre-cooling and e-bike charging. These are deferrable or interruptible examples; a user supplies the practical requirement and deadline, while each preset provides an editable default power and duration. Store values through `POST /api/activities` after Zod validation. A Custom card remains available for other safe-to-shift loads.

Current activity storage setup: apply `supabase/migrations/20260912135906_create_consumer_activities.sql`, then `20260912141231_allow_custom_activity_types.sql` to the Supabase project used by `.env.local`. Pushing application code does not apply these SQL files. The Custom card uses the same timing fields and allows a user-defined activity name. Save and reload are authenticated; energy/power presets and scheduling remain subsequent work. These two SQL files were applied through the dashboard to the development project on 12 September 2026; dashboard execution does not record CLI migration history, so reconcile that history before adopting `supabase db push` on this existing project.

Do not require users to know exact consumption in the MVP. Later readings can update typical energy and duration. A bill upload may estimate a monthly baseline, but cannot verify a particular time slot.

### 5.4 Weather and renewable estimation

Define:

```ts
interface ForecastProvider {
  getForecast(location, start, end): Promise<WeatherSlot[]>;
}
```

`SyntheticForecastProvider` is the default and creates solar curves, wind variation and cloud events. `OpenMeteoForecastProvider` is added later and maps forecast radiation, temperature and wind speed into the same `WeatherSlot` type.

Implement `estimateSolarKWh()` using configured panel capacity, radiation, efficiency and loss factor. Implement `estimateWindKWh()` using a configured turbine power-curve lookup. Store output per half-hour slot. Do not claim weather forecast equals measured plant generation.

### 5.5 Demand balance and Absorb/Protect mode

For each slot calculate:

```
balanceKW = renewableKW - (fixedDemandKW + scheduledFlexibleDemandKW)
```

Positive balance is an **Absorb** opportunity; negative balance is a **Protect** condition. Also flag slots that exceed the site power limit. Implement this as a pure function so scenario previews use exactly the same calculation.

Return a typed, read-only `gridActions` recommendation for each relevant slot. In Absorb mode it proposes flexible demand, storage charging, export and finally curtailment review. In Protect mode it proposes demand delay/reduction, storage discharge, backup review and escalation. These are operator recommendations, never automatic grid commands.

The operator overview also calls `rankGridRecommendations()`. It scores available actions from transparent factors (grid urgency, feasibility and expected relief), reports kW/kWh impact and distinguishes a site-capacity breach from a renewable deficit. The score is a prioritisation aid, not a probability or forecast-accuracy claim; tariff and market cost data are called out as required production inputs.

### 5.6 Scheduling

Implement `createSchedule(scenarioId)` as a deterministic greedy scheduler. Sort activities by least scheduling freedom, try each legal start slot, reject deadline/power-limit violations and score remaining choices by renewable alignment, user inconvenience and peak impact.

Reserve slots using a schedule version. An accepted offer is not overwritten by a later preview. Return unscheduled activities with a human-readable reason.

### 5.7 Offers, notifications and user decisions

`POST /api/offers/:id/decision` accepts `accept`, `modify`, `skip` or `override`. Acceptance rechecks the current schedule version before reserving slots. Modification validates the new window and reruns scheduling. Skip releases the offer without penalty. Override releases the accepted reservation and calls recovery. Create a notification for a new offer, starting window, deadline risk and verification result. Keep notification delivery simulated in the MVP.

The consumer screen shows original schedule, proposed window, deadline, expected renewable availability, reward estimate and data-source label.

### 5.8 Opt-out recovery

Implement `repairSchedule(scenarioId, lostActivityId)`. Calculate lost kW and slots, search uncommitted eligible activities, create replacement offers and evaluate the battery for the remaining gap. Never move another accepted user without consent. Record an unresolved gap for the operator.

If a forecast changes after an offer is accepted, notify the user and request consent for any changed schedule. A what-if preview runs on a copy and cannot mutate a published event or an accepted record.

### 5.9 Battery simulation

Implement a pure `dispatchBattery()` function with capacity, current energy, charge/discharge limits and efficiency. Charge in Absorb slots and discharge in Protect slots after demand shifting. Store each action for the operator chart; do not send control commands to real equipment.

### 5.10 Meter simulator and adapter boundary

Implement `POST /api/meter-readings` accepting event ID, device ID, activity ID, timestamp, cumulative kWh, service/process-complete flag, source and unique reading key. Reject unauthenticated devices and duplicate keys.

Build a simulator that advances one slot at a time and emits successful, partial, overridden and missing-reading cases. A future charger, smart plug or sub-meter adapter submits the same payload. Whole-home bills are not sufficient for appliance-level slot verification.

### 5.11 Verification

Implement `verifyActivity(activityId)` on the server. Derive interval energy from cumulative readings, compare the frozen baseline window with the accepted window, check required energy and deadline, and classify the result as verified, partial or failed. Do not reward a manual completion click without readings; simulation controls must be labelled as such.

### 5.12 Rewards, points and leaderboard

After verification, insert one idempotent reward-ledger row:

```
eligible shifted kWh × approved illustrative rate
```

Use `pending → verified → redeemable` states. Award points only once per verified activity. Rank the leaderboard by verified participation relative to eligible opportunities, not total consumption. Cash redemption is simulated and labelled as proposed funding.

### 5.13 Notifications, offline and exception states

Generate notifications for an offer, an accepted window starting, a deadline risk, a verification result and a reward update. In the MVP these can be in-app notifications. Every screen must also have explicit states for no valid window, device offline, missing reading, budget exhausted, deadline missed, all offers rejected and forecast update. Each state explains what happened and provides a safe next action; none silently fails.

### 5.14 Consumer and operator dashboards

Install `recharts` and create reusable chart components under `src/components/charts`. Every chart receives typed arrays from the server and displays its unit, time range and data-source label. Do not put scheduling calculations inside chart components.

The consumer dashboard contains:

- **Renewable outlook:** area/line chart with expected solar, wind and combined renewable kW across the day.
- **My schedule:** timeline or stacked bar showing baseline activity versus accepted activity.
- **Offer impact card:** shifted kWh, deadline, expected renewable alignment and illustrative reward.
- **Verification card:** required energy, recorded energy, completion time and verification status.
- **Points progress:** progress bar toward the next badge and a compact participation history.

The operator dashboard contains:

- **Supply-demand chart:** two lines for renewable availability and total demand, with shaded Absorb and Protect regions.
- **Before/after demand chart:** grouped bars comparing baseline demand with scheduled demand per slot.
- **Flexibility funnel:** cards or a bar chart for recommended, accepted, completed and verified kW.
- **Peak comparison:** baseline peak kW, scheduled peak kW and reduction percentage.
- **Battery chart:** state of charge over time with charge/discharge markers.
- **Gap and budget cards:** unresolved kW gap, verified shifted kWh and reward budget used.

Use colour and text together: amber for Absorb, coral for Protect, blue for accepted and violet for verified. Add tooltips with exact slot time and units. Include an accessible table below each important chart so the demo remains understandable without relying on colour.

Consumer pages: Today, Activities, Offers, Rewards/Impact and Profile. The activity detail page contains schedule and verification evidence. Operator pages use the charts above, Supabase subscriptions for refreshes and a reset button for the deterministic demo. The operator event page contains event creation, participant status, verification, budget and report export.

Current consumer detail implementation (12 September): saved activity links open `/consumer/activities/[id]`. Its authenticated API returns saved requirements and only offers linked to that activity, with their meter readings, verification and reward records. Every query is scoped to the signed-in owner. Unscheduled activities show an explicit empty state; the separate EV simulation cannot verify an unrelated custom activity. The Profile form contains account information, display name, location, user type and simulated device status; the preferred flexible activity selector has been removed. Existing stored preference values are left untouched. Custom-activity scheduling still requires integration with the scheduling track.

The consumer track now includes a reusable event surface on Today and Offers: accept, modify, skip, override, simulator outcomes (success, partial, missing, late and rebound), verification retry/error states, in-app notifications and an explicit demo reset. Rewards are read from the ledger and verification records, can be released to a simulated redeemable wallet idempotently, and show a verified-impact chart. The optional leaderboard is opt-in and uses an alias plus verified/accepted reliability; it does not expose names or rank total consumption. Renewable outlook and baseline/accepted schedule charts use a clearly labelled deterministic fixture until Teammate A's forecast contract is connected. A Supabase-backed session proxy, loading/error/offline states and consumer route error boundary are in place. The additive consumer completion migration is `20260912220000_consumer_completion.sql`; it is applied to the configured Supabase project.

### 5.14 Playback demonstration

Add `Advance 30 minutes`. It generates the next simulated meter readings, runs verification and refreshes charts. The seeded script must demonstrate one successful verification and one opt-out recovery without internet access.

## 6. Delivery phases

The hackathon delivery is intentionally limited to two phases. The application should feel like one usable product; seeded values are an implementation fallback and must not appear as a separate “demo mode” in the main consumer journey.

**Phase 1 — Product foundation (complete):** authentication, profiles, activities, seeded renewable-aligned recommendations, scheduling, accept/modify/skip/override, server-side verification using controlled readings, points/reward ledger, notifications and consumer/operator summaries.

**Phase 2 — Demo-ready product finish (active):** remove simulator-oriented controls from the primary experience; make the end-to-end activity journey reliable; connect custom activities to offers and rewards; make operator metrics reflect the consumer journey; present clean mobile and operator dashboards. Weather-powered forecasting, ML, hardware readings and payment rails are later extensions after the demo flow is stable.

### Multilingual accessibility (Phase 2)

Store each user's preferred Indic language (`en-IN`, `gu-IN`, `hi-IN`, `mr-IN`, `ta-IN`, `te-IN` or `bn-IN`). Sarvam is accessed only from server routes using `SARVAM_API_KEY`; the browser never receives the key. Use translation for user-authored activity text and programme copy, and text-to-speech for offers and notifications. If Sarvam is unavailable, retain the original English text and use the browser speech capability where supported. Never block activity scheduling or rewards on language services.

Production integrations are deliberately outside the hackathon scope: real charger/meter adapters, historical ML training, utility control and approved payment settlement will be added only when reliable data and approvals exist.

## 7. Parallel work division

The split is by **vertical feature track**, not by “frontend versus backend”. Each teammate owns a complete user-visible slice and can demo it independently against the shared seeded scenario.

### Phase 0 — Joint contract session

Both teammates create the app, Supabase project, migration, `src/domain/types.ts`, deterministic fixtures and API examples. Freeze these files before parallel work begins. This is the only planned waiting point.

### Teammate A — Energy intelligence and operator track

Own:

- `src/domain/forecast/*`: synthetic provider, weather-provider interface and solar/wind estimation.
- `src/domain/scheduling/*`: balance calculation, Absorb/Protect classification, greedy scheduling and battery dispatch.
- `app/api/scenarios/*` and `app/api/forecast/*` route handlers.
- Operator pages and all operator charts in `app/(operator)`.
- Scenario seed/reset, what-if preview and playback APIs.
- Domain tests for forecast conversion, slot limits, scheduling and battery behaviour.

Deliver a stable fixture response for each endpoint so Teammate B can build without waiting. Do not edit consumer components or reward UI.

### Teammate B — Consumer event and trust track

Own:

- Supabase Auth screens, role-aware navigation and consumer pages in `app/(consumer)`.
- Activity form, preset device data and offer cards.
- Offer decision routes: accept, modify, skip and override.
- Meter simulator UI and `POST /api/meter-readings` integration.
- Verification, points, reward ledger and leaderboard screens, using the frozen domain contracts.
- Consumer charts: renewable outlook, baseline-versus-accepted schedule and verification history.
- UI tests for the complete consumer event journey.

Use Teammate A’s seeded scenario and schedule response; do not reimplement forecast or scheduling logic in the UI. If an endpoint is not ready, use the agreed fixture JSON and replace it later without changing the component contract.

### Integration order

1. Both commit the contract and fixtures.
2. A makes the operator dashboard work entirely from seeded data; B makes the consumer journey work from the same seeded data.
3. A exposes the real scenario/schedule routes; B connects the consumer decisions.
4. B exposes simulated readings and verification; A connects verified metrics to operator charts.
5. Both run the full playback scenario and resolve contract issues in one shared integration branch.

### Conflict rules

- A owns `src/domain/forecast`, `src/domain/scheduling`, scenario/event orchestration and `src/app/operator`; B owns `src/domain/verification`, `src/domain/rewards`, `src/app/consumer` and trust/reward routes. Public URL segments are real `operator`/`consumer` directories, not route-group names.
- Shared types, migrations and UI primitives require a message before editing.
- Never move business rules into page components to bypass an unfinished API.
- Keep commits small and named by feature; merge one track at a time.
- Neither teammate resets, force-pushes or overwrites the other’s branch.

## 8. Validation and demo gates

At the end of each phase run:

```
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Phase 1 is accepted only when a seeded EV event can be accepted, rescheduled, supplied with simulated readings, verified and awarded points. Phase 2 is accepted only when changing weather or demand changes the recommendation. Phase 3 is accepted only when a what-if preview leaves accepted data unchanged.

## 9. Shared truthfulness and safety rules

- Say “estimated renewable availability,” never guaranteed renewable supply.
- Label simulation, modelled weather estimates and illustrative rewards in the UI and demo.
- Do not claim partner data, endorsement, real payments or real grid control.
- Skipping or overriding an offer never penalises the user.
- Report shifted energy and peak reduction separately; shifting is not energy saving.
- Do not train or claim ML accuracy without matched historical generation records.

## 10. Mobile-first product and visual specification

The primary product is a **mobile web app/PWA**. Design at 390px width first, then expand to tablet and desktop operator layouts. Use Tailwind responsive breakpoints; every screen must work with one thumb, large tap targets (minimum 44px), safe-area padding, keyboard navigation and visible focus states. Do not create a separate native mobile application during the hackathon.

### Visual direction

Use the aesthetic stance **“Gridline Daylight”**: a warm off-white canvas, white surfaces, graphite text and teal utility actions. Use solar amber for Absorb moments, coral for Protect conditions, blue for planned or accepted actions and violet for verified outcomes. Keep the interface calm and government-ready with solid surfaces, quiet 1px borders, modest shadows and a single amber energy accent; avoid glass, neon, gradients and decorative 3D effects. The memorable anchor is a circular **day pulse** that shows the current slot, renewable level and the next recommended action. This is a product identity, not decoration.

Use `next/font/google` with **Space Grotesk** for headings and **DM Sans** for body text. Define all colours, radii, shadows, spacing and chart colours as CSS variables in `app/globals.css`; do not scatter hex values through components. Use shadcn/ui primitives (`Button`, `Card`, `Badge`, `Dialog`, `Drawer`, `Sheet`, `Tabs`, `Progress`, `Tooltip`, `Table`, `Skeleton`, `Toast`) as the accessible base, then style them to the VidyutSutra system. Use Lucide icons with labels or tooltips; never use emoji as UI icons.

### Mobile navigation and screen hierarchy

Consumer navigation is a fixed bottom bar with **Today**, **Activities**, **Offers**, **Rewards** and **Profile**. The Today screen has, in order: day pulse, current Absorb/Protect state, one primary offer card, next deadline and a compact schedule. Offers is the inbox for pending and expired recommendations; Rewards includes verified impact history. Details open in a bottom sheet rather than a desktop modal.

Operator navigation is a compact top bar with **Overview**, **Events**, **Flexibility**, **Verification**, **Rewards/Reports**, **Simulation** and **Settings**. On mobile, charts are horizontally scrollable cards with a summary value first. On desktop, the same cards become a two-column grid.

### Required visual components

- `DayPulse`: SVG/CSS circular slot indicator with renewable level, mode and next action.
- `OfferCard`: original time, proposed time, deadline, reward, source label and three decision actions.
- `ScheduleTimeline`: accessible horizontal slot strip; selected activity opens a detail sheet.
- `SupplyDemandChart`: Recharts `ComposedChart` with renewable area, demand line and Absorb/Protect bands.
- `BeforeAfterChart`: Recharts grouped bars with baseline and scheduled demand.
- `FlexibilityFunnel`: recommended → accepted → completed → verified values.
- `BatteryChart`: state-of-charge area and charge/discharge markers.
- `EvidenceReceipt`: baseline, accepted window, readings, eligible kWh and verification reason.
- `MetricCard`, `StatusBadge`, `EmptyState`, `LoadingSkeleton` and `ErrorState`.

Charts must have legends, units, tooltips and a text/table alternative. Use `ResponsiveContainer`; lazy-load the operator chart bundle if it is not visible. Avoid 3D charts, pie charts with many categories and animation that delays interaction.

### Interaction and copy rules

The first screen must answer: “What should I do now, and what do I get?” Use plain copy such as **“Move charging to 1–3 PM”**, **“Ready by 5 PM”** and **“Reward after verified reading.”** Every mutation has a pending state, success toast and recoverable error. Skip and override require no penalty language. Use `prefers-reduced-motion` and never rely on colour alone for mode or status.

## 11. Complete application surface

### Consumer routes

```text
/login                 authentication
/consumer/today        day pulse, current offer and schedule
/consumer/activities   list, add and edit activities
/consumer/activities/[id] activity detail and evidence
/consumer/offers       pending, accepted, expired and skipped offers
/consumer/rewards      points, badges, reward ledger and impact history
/consumer/profile      location, preferences and device simulator
```

### Operator routes

```text
/operator/overview     supply-demand, mode and peak metrics
/operator/events       create, monitor and close Absorb/Protect events
/operator/flexibility  accepted/verified capacity and unresolved gaps
/operator/verification readings, exceptions and review queue
/operator/rewards      budget, ledger and programme settlement preview
/operator/reports      event outcomes and CSV export
/operator/simulation   controls, playback and reset
/operator/settings     site limits, source capacities and reward budget
```

### Cross-cutting states

Implement loading, empty, error, offline and no-valid-window states for every route. Add a global error boundary and route-level `loading.tsx`. Provide a demo-mode banner showing whether values are simulated, weather-estimated or device-supplied.

## 12. External resources and dependency rules

Use the official shadcn CLI to add only the components listed above; components are copied into `components/ui` so their code is reviewable. Use official Tailwind responsive utilities, Lucide React for icons and Recharts for visualisations. Use Supabase’s Next.js SSR client with cookie sessions and RLS. Use Open-Meteo only through `ForecastProvider` and cache its response in `forecast_slots`.

Before adding a package, record its purpose in this section and confirm it works with the current Next.js/React versions. Prefer native browser APIs and existing components. Do not add UI template kits, arbitrary “20th.dev” snippets or copied code that conflicts with the VidyutSutra system. External assets must have a licence suitable for a hackathon and must not be required for the offline demo.

## 13. Agent execution protocol

Repository-local workflow instructions are discovered through [AGENTS.md](AGENTS.md) and [skills/README.md](skills/README.md). Read only the applicable skill files. This plan remains the product/architecture source of truth; the skills define execution and verification discipline. The current branch contains the Next.js/TypeScript scaffold, deterministic Teammate A energy engine, operator routes and APIs, and focused Vitest tests. Supabase, consumer, verification and rewards paths remain integration targets. Recheck the repository state on subsequent tasks.

Every Codex session starts by reading `AGENTS.md`, this plan and the current Git status. The agent states the feature it is implementing, reads the relevant existing files and makes the smallest coherent change. It must not redesign the schema, rename API fields or replace the visual system without updating this document first.

### Definition of done for a feature

1. The feature works on a 390px viewport and desktop where applicable.
2. Loading, empty, error and success states exist.
3. Server mutations validate input with Zod and enforce role/access checks.
4. Domain rules have focused Vitest tests.
5. Charts have units, tooltips and a text alternative.
6. Simulation labels and truthfulness rules are preserved.
7. `pnpm lint`, `pnpm typecheck`, relevant tests and `pnpm build` pass.

### Integration discipline

Use one branch per teammate and feature-named commits. Pull/rebase before integration. Never force-push or reset shared history. A change to `src/domain/types.ts`, migrations, API examples, design tokens or shared UI primitives requires a short written note in the commit and an update to the relevant section of this plan. When an external API is unavailable, retain the provider interface and deterministic fixture; never block the rest of the application.

## 14. Final demo script
1. Open the mobile consumer Today screen and show the day pulse in Absorb mode.
2. Show an EV offer with original and proposed schedule, deadline and illustrative reward.
3. Accept the offer and show the schedule update.
4. Advance the simulator to generate readings; show the evidence receipt and verified points.
5. Open the operator overview and show accepted versus verified flexibility and the read-only grid action recommendation.
6. If stretch features are complete, override a second offer, show recovery, then run Protect mode and What-if preview.

The demo must remain understandable if real weather, hardware and payment services are unavailable.

## 15. Teammate A scaffold contract (12 September 2026)

- This branch establishes the first shared types, fixtures and UI primitives; no prior implementation exists to reuse. B should consume these contracts for consumer and trust features.
- The initial runnable A prototype uses a clearly labelled, per-browser demo session in one local Node.js process. It works without weather, Supabase or payment network calls after installation/build; browser access to the local server is still required. Restarting the server clears demo sessions. It is not a production persistence/auth replacement or an offline-installable PWA.
- Supabase Auth, durable persistence, RLS and migrations remain joint Phase 0 integration work; no shared database has been created or modified in this task. Consumer authentication and verification/reward processing remain B-owned.
- All initial values use the contract field `data_source`. Slots are indices 0–47, with end-exclusive boundaries up to 48, representing slot-average kW in Asia/Kolkata. Activity energy is `requiredEnergyKWh`; scheduled power is energy divided by duration, capped by the device limit.
- The frozen baseline includes each flexible activity once. Recommended schedules are projections; only accepted reservations alter committed demand. An unchanged recommended window has zero eligible shift/reward. All operator capacity summaries state whether they are peak or event-average kW.
- Demo operator actions are scoped to an opaque HTTP-only session cookie and same-origin requests. Production use of the memory adapter requires explicit `DEMO_MODE=true`; no real accounts, meter credentials or payments are accepted.
- Initial dependency purposes: Next.js/React for the single app; Tailwind and shadcn/Radix for accessible primitives; Lucide for icons; Recharts for typed operator charts; Zod for request boundaries; sonner for action feedback; Vitest for domain/API behavior. pnpm is the repository package manager. Motion, theming and date libraries are added only when used.
- Stable A-track fixture endpoints are `GET /api/forecast` (forecast plus balance classification), `GET /api/scenarios` (scenario, balance, battery and summary), `POST /api/scenarios/seed`, `POST /api/scenarios/reset`, `POST /api/scenarios/preview`, and `POST /api/scenarios/playback`. Event lifecycle endpoints are listed in section 5.2 and operate on the same session-scoped demo scenario.

