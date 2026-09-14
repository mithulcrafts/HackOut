# VidyutSutra

### Predict renewable availability. Move flexible demand. Reward verified action.

Electricity demand does not wait for the sun. An EV is plugged in when its owner returns, while solar may have peaked hours earlier. A factory may have a flexible process that can start later, while an evening demand peak is approaching. Renewable power can be available when demand is low, then the grid is under pressure when demand returns.

**VidyutSutra is a renewable flexibility coordinator for the Smart Demand-Response & Load-Shifting System problem statement.** It predicts when renewable energy is likely to be more available, finds flexible activities that can move safely, gives people a clear choice, verifies what actually happened and rewards reliable participation.

> **The same task. A better time. A reward for making the shift.**

Built by **Commit Crew — Nama Mithul and Rohinth S** for **HackOut’26 at DA-IICT / Dhirubhai Ambani University, Gandhinagar**.

## Live deployment

- **Production app:** [VidyutSutra on Vercel](https://vidyutsutra-pzrjkox86-rohinths-projects-137795ca.vercel.app/)
- **Consumer experience:** [Open the consumer flow](https://vidyutsutra-pzrjkox86-rohinths-projects-137795ca.vercel.app/consumer/today?demo=1)

The links above are publicly accessible and point to the latest verified production deployment.

---

## Why timing matters

Renewable generation and electricity use follow different patterns. Solar availability rises and falls during the day. Wind changes with weather and site conditions. EV charging, water heating, appliances and industrial work follow human routines or production schedules.

When these patterns do not align, useful renewable generation can go unused while later peaks put pressure on the grid. Demand response turns the flexible part of demand into an option: the task still finishes, but its timing works better for the programme.

VidyutSutra focuses on one practical question:

> **Which activity can move, to which time window, by how much, and can we prove that it happened?**

---

## The solution

```text
Weather and generation inputs
        ↓
Expected renewable availability
        ↓
Surplus / shortage classification
        ↓
Flexible activity matching
        ↓
Personalised offer and reward estimate
        ↓
Accept · modify · skip · override
        ↓
Agreed schedule and reminder
        ↓
Meter or charger evidence
        ↓
Verification against baseline and deadline
        ↓
Points, badges and programme reward ledger
```

The consumer receives a useful time window, rather than a technical forecast to interpret. The authorised programme operator receives an aggregated view of expected flexibility, accepted commitments, verified delivery, storage opportunities and remaining risk.

---

## Forecasting is the heart of the product

The forecasting layer turns weather into a planning signal for demand response.

1. **Collect local weather inputs.** A weather provider supplies solar radiation, cloud cover, temperature, wind speed, wind direction and a forecast timeline for the user’s selected area.
2. **Estimate renewable output.** Installation capacity and source characteristics convert those inputs into expected solar and wind availability for 30-minute slots. The architecture is renewable-source agnostic: solar and wind are used for the initial demonstration, while hydro, biomass and other sources can use the same contract later.
3. **Improve the estimate with open-source ML.** The forecasting path accepts an open-source model trained on historical generation and weather features. Models can be evaluated against time-ordered holdout data and compared with a simple baseline. The forecast interface returns expected availability plus an uncertainty band.
4. **Compare supply with demand.** Expected renewable availability is compared with fixed demand, accepted schedules, site limits and battery state. This identifies renewable-rich windows for absorption and high-demand or low-renewable windows that need protection.
5. **Explain the recommendation.** Each offer shows the original activity time, suggested time, deadline, power limit, expected renewable condition and proposed reward.

Forecast output is an estimate of availability, not measured plant generation or a guarantee of supply. The product uses “renewable-aligned time window” and “higher expected renewable availability”; it does not claim that an individual receives exclusively renewable electricity.

---

## Two coordinated operating modes

### Absorb mode

When renewable availability is expected to be high, the platform encourages EV charging, water heating, suitable appliances, industrial processes and battery charging. It reports remaining surplus risk for operator review.

### Protect mode

When renewable availability is expected to be low or demand is high, the platform delays flexible activities, reduces non-essential demand, recommends battery discharge, surfaces approved backup review and escalates remaining supply risk to the authorised operator.

The prototype provides recommendations. It does not issue automatic curtailment, generator-control or backup commands.

---

## Consumer experience

Users manage activities they already understand:

- EV charging and water heating.
- Washing machine and dishwasher use.
- Irrigation and pool pumps.
- Cold-storage pre-cooling and e-bike charging.
- Approved business or industrial processes.
- Custom flexible activities.

They provide a practical deadline, earliest start, approximate duration, power limit and whether the task can pause. Presets reduce the need to know exact kWh values, while custom activities support household, farm, campus and workplace routines.

### Example

An EV owner needs the vehicle ready by 5 PM. VidyutSutra predicts a renewable-aligned period from 1 PM to 3 PM and offers a reward for moving the charging session. The owner sees the original window, proposed window and reward estimate, then accepts, modifies, skips or overrides the offer. Charging remains complete before departure. A reward is released only after the accepted schedule is checked against recorded evidence.

Skipping an unsuitable offer never carries a penalty.

---

## Verification makes the reward credible

An accepted offer is a commitment, not proof of delivery. The verification layer compares:

- The accepted schedule and frozen baseline window.
- The actual meter or charger reading.
- Required energy and equipment power limit.
- Completion time and deadline.
- Rebound or additional consumption.

Production adapters can connect EV charger APIs, smart plugs, submeters, industrial meters and energy-management systems. The prototype uses clearly labelled scenario readings and an evidence-review path. A manual button or bill scan can support review, but cannot be treated as trusted slot-level meter verification.

The result is `verified`, `partial` or `failed`. Missing or inconsistent evidence does not release a reward.

---

## Incentives people can understand

The wallet separates:

- **Pending:** waiting for evidence review.
- **Verified:** earned from a verified eligible shift.
- **Redeemable:** released to the programme wallet after verification.

```text
Reward = verified eligible shifted energy × approved reward rate
Example: 8 kWh × ₹1.50/kWh = ₹12 illustrative reward
```

Points, badges, monthly challenges and optional community rankings encourage repeated participation. Leaderboards use verified reliability relative to available opportunities, rather than total electricity use. Possible cashback, bill credits or vouchers would be funded by an approved utility, aggregator, employer, campus or sponsor; the prototype does not make real payments.

The product reports **energy shifted** and **peak reduction** separately. Moving a task in time is not automatically the same as saving energy.

---

## Multilingual and voice-first access

Energy flexibility should work outside English-first urban workflows. Sarvam AI supports:

- Preferred-language selection in the profile.
- English plus native-language labels where the layout allows.
- Voice entry for activity names and descriptions.
- Spoken offers and notifications.
- Native-language explanations of timing and rewards.

The browser never receives the Sarvam API key. If the language service is unavailable, the core activity, scheduling and reward flow continues in English.

---

## Operator view: prepare before the peak

The operator dashboard turns the same forecast into an early planning view. It shows renewable availability, expected demand, Absorb and Protect opportunities, eligible activities, accepted commitments, verified response, battery recommendations, reward budget and event reports.

This gives utilities, campuses, commercial sites and authorised energy managers time to organise demand response, storage and approved supply actions before conditions become urgent. The operator sees recommended actions and evidence; the system does not pretend to be a grid-control authority.

---

## Technology and architecture

VidyutSutra uses a modular monolith so a two-person team can build and validate one complete flow while keeping production boundaries clear.

```text
Next.js App Router + TypeScript
├── Mobile-first React consumer screens
├── Operator dashboards and event workflows
├── Server route handlers with Zod validation
├── Supabase Auth, Postgres and Row Level Security
├── Forecast provider and renewable estimation layer
├── Open-source ML forecast adapter with uncertainty output
├── Rule-based constrained load scheduler
├── Meter/device adapter contract
├── Server-side verification and reward ledger
├── Sarvam translation and text-to-speech routes
└── Recharts visualisations and accessible data tables
```

Core domain functions include:

```text
generate_renewable_forecast()
estimate_solar_and_wind_output()
detect_surplus_or_shortage()
find_flexible_tasks()
create_schedule()
generate_offer()
verify_task()
calculate_reward()
```

Every activity carries its type, required energy, earliest start, latest finish, power limit, default schedule, accepted schedule, actual reading and status. Scheduling, verification and rewards remain server-side. Supabase RLS keeps consumer records account-scoped, while operator actions require an authorised role.

---

## Impact model

The platform measures outcomes a programme can audit:

```text
Eligible shifted energy = energy moved into the agreed window
Peak reduction = baseline demand during the peak − accepted demand during the peak
Verified participation = verified activities ÷ accepted eligible activities
Reward cost = verified eligible energy × approved reward rate
```

For an illustrative scenario, 1,000 participants each shifting 2 kWh would move 2 MWh into better-aligned windows. Actual peak reduction depends on overlap, power limits, forecast confidence, baseline behaviour and programme rules.

---

## Ecosystem fit

The use case is relevant to utilities, distribution companies, campuses, commercial facilities, sustainability programmes and public innovation bodies. HackOut’26 partners such as GUVNL, BSES, Smart Energy Learning Center, Gujarat Informatics Limited, Gujarat DST / SSIP, GEDA, the Gujarat Climate Change Department and DA-IICT provide valuable ecosystem context for this problem.

Partner logos indicate hackathon ecosystem relevance only. VidyutSutra does not claim partner data access, endorsement, guaranteed pilot support or an existing payment programme.

---

## Live deployment

[Open the Vercel deployment](https://vidyutsutra-rohinths-projects-137795ca.vercel.app)

## Run locally

### Requirements

- Node.js 20 or newer.
- pnpm 11.
- A Supabase project for authenticated consumer flows.

### Setup

```bash
pnpm install
Copy-Item .env.example .env.local
```

Set these values in `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SARVAM_API_KEY=your-sarvam-api-key
```

Apply the SQL migrations in `supabase/migrations` to the Supabase project, then start the application:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The application continues to show a repeatable labelled planning dataset when a weather provider or device integration is unavailable. This keeps the product flow testable while making the data source visible.

---

## Product flow at a glance

### Consumer

```text
Sign in
→ choose language and activity
→ set deadline and flexibility
→ receive renewable-aligned offer
→ accept, modify, skip or override
→ complete the activity
→ evidence is checked
→ points and reward status update
```

### Operator

```text
Review forecast and demand
→ identify Absorb or Protect opportunity
→ publish event and reward policy
→ monitor offers and commitments
→ review verified response
→ plan storage and approved supply actions
→ publish an auditable event report
```

---

## Data and trust boundaries

Every value is labelled by provenance:

- **Scenario estimate:** repeatable data for the hackathon flow.
- **Weather estimate:** calculated from public weather inputs and installation assumptions.
- **Device reading:** supplied by an authorised charger, meter or submeter adapter.
- **Illustrative reward:** a proposed programme value, not a guaranteed payment.

Live utility data, production-trained site models, trusted hardware adapters, regulated grid control and payment settlement require provider agreements and deployment controls beyond this prototype. The interfaces are designed so those capabilities can be added without changing the core promise.

