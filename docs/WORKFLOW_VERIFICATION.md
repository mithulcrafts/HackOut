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
| Today recommendation | `/consumer/today` renders `ConsumerEvent` from `/api/consumer`. The seeded event contains EV, water-heating and industrial offers. |
| Offer inbox | `/consumer/offers` uses the same event surface and can select an offer by `offerId`. |
| Add activity | `/consumer/activities` posts timing constraints to `/api/activities`; demo scheduling uses the domain scheduler and active event window. |
| Decision | `/api/consumer` accepts `accept`, `modify`, `skip` and `override` through `src/domain/events.ts`. Modify remains pending until accepted; skip and override have no penalty. |
| Activity detail | `/consumer/activities/[id]` reads `/api/activities/[id]` and shows requirements, schedule, evidence and reward state. |
| Simulated evidence | `/api/consumer` uses `src/domain/playback.ts`; operator `/operator/simulation` can replay success, partial, late, rebound or missing readings. |
| Verification | `verifyScenarioOffer()` validates ordered, complete, device-matched intervals, deadlines, limits, baseline change and rebound. Missing data stays pending. |
| Rewards | `scenario.rewardLedger` is projected by `/api/rewards`; verified entries can be marked redeemable in the demo. Values are illustrative. |
| In-app notifications | Offer and verification state generate messages. Mark-all-read persists within the demo session; later changes appear unread. No external push/SMS is sent. |

## Operator flow

| Workflow step | Current implementation |
|---|---|
| Overview | `/operator/overview` uses `summarizeScenario()` and `effectiveSchedules()` so every activity remains represented once. Charts and slot tables are simulated and read-only. |
| Events | `/operator/events` creates draft Absorb or Protect events, publishes offers and closes active/verifying events. |
| Flexibility | `/operator/flexibility` shows offers, accepted kW, verified kW and per-offer pending evidence. |
| Verification | `/operator/verification` links to labelled playback and displays the evidence queue. |
| Rewards | `/operator/rewards` sums the simulated reward ledger and shows the illustrative event budget. |
| Reports | `/operator/reports` uses the event funnel: recommended → accepted → completed → verified. |
| Simulation | `/operator/simulation` provides what-if forecast/demand preview and deterministic playback controls. |
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

The authenticated Supabase consumer path remains separately implemented through consumer RPCs and migrations. It should not be described as sharing the demo scenario until the shared production activity/event contract, RLS policies and settlement integration are deployed. Real AMI/device readings, live weather-provider forecasting, ML training, device control, external push/SMS notifications and cash/bill-credit settlement remain production integration work. The app is currently browser-based; installable/offline PWA support remains a follow-on task. No cloud migration was applied during this verification pass.

The forecast boundary now includes pure, unit-labelled solar and wind estimators in `src/domain/forecast/provider.ts`: irradiance is accepted in W/m² and wind speed in m/s, with configured capacity and cut-in/rated/cut-out limits. `SyntheticForecastProvider` emits plausible simulated weather inputs. A live weather provider and trained forecast model are still pending integrations.

## Verification command

Run the full local smoke journey with a server running:

```bash
pnpm dev
pnpm test:smoke
```

The smoke script resets the demo before and after its scenarios, checks all consumer/operator routes, exercises all three sample activities, verifies idempotent reward release, and covers partial, late, rebound and missing-reading recovery.

Verification on 13 September 2026: lint, TypeScript and production build passed. The HTTP smoke suite passed 94 checks against both the development server and the production build, including a published Protect event, preview isolation, notifications and separate browser-session wallets. Browser testing exercised accept → simulated readings → verification → reward wallet release. These checks establish the tested prototype behavior; they do not certify a live utility deployment or guarantee absence of every possible defect.
