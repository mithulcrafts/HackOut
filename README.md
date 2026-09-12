# Smart Demand-Response & Load-Shifting System

This repository contains the VidyutSutra HackOut prototype: a mobile-first Next.js application for coordinating flexible demand against estimated renewable availability. The current branch combines the deterministic Teammate A energy/operator track with the consumer authentication, activity, offer, simulated-reading, verification and reward flow.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The operator demo runs without external data; the authenticated consumer flow additionally requires the Supabase variables in `.env.local` and the migrations under `supabase/migrations`. Both use one simulated day with 48 half-hour slots in `Asia/Kolkata`.

For the integrated demo, open `/consumer/today?demo=1` or `/operator/overview?demo=1` in the same browser. The demo cookie connects both views. For a local production build, set `DEMO_MODE=true` in the server environment before `pnpm start`; keep this simulation switch disabled on a real programme deployment.

Useful checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The end-to-end demo smoke test expects a running local server. In two terminals:

```bash
pnpm dev
pnpm test:smoke
```

`test:smoke` uses a cookie-backed demo session, walks the three sample activities through acceptance, simulated evidence, verification and reward redemption, then checks the consumer and operator routes. Set `SMOKE_BASE_URL` when the server is running on another URL.

## Current operator flow

- `/operator/overview` shows the simulated renewable/demand outlook, Absorb/Protect classification, read-only grid action recommendations, battery dispatch and an accessible selected-slot table.
- `/operator/events` creates draft events and publishes eligible offers against a frozen baseline.
- `/operator/simulation` changes renewable/demand multipliers in an in-memory preview, resets the seed and replays labelled simulated reading cases.
- `/operator/verification`, `/operator/rewards` and `/operator/reports` make evidence, illustrative budget and event-funnel states explicit. These operator summary pages are ready for the shared persistence integration.

## Current consumer flow

- `/consumer/today` loads a renewable-aligned offer and supports accept, skip, simulated reading and verification.
- `/consumer/activities` stores timing constraints for EV charging, water heating and industrial processes.
- `/consumer/offers`, `/consumer/rewards` and `/consumer/profile` provide the consumer navigation and trust/reward views.
- Demo writes use the shared server-side domain engine. Authenticated consumer writes use Supabase RPCs and row-level security; rewards remain illustrative simulation values.

See [workflow verification](docs/WORKFLOW_VERIFICATION.md) for implemented behavior, verification coverage and remaining deployment work.

The demo adapter is session-scoped memory in one Node.js process. Consumer and operator demo routes use the same scenario, so a decision or verified reading is visible on both sides during a run. Restarting the server clears it; multiple serverless workers do not share this state. The authenticated Supabase consumer RPC path remains a separate production integration until the shared activity/event contract is deployed. Neither path represents real meter credentials, real grid control or real payments. Every forecast, reading and reward is labelled according to the workflow contract.

The product workflow remains:

```text
forecast → Absorb/Protect classification → eligible activity → offer
→ user decision → agreed schedule → simulated/device reading
→ server verification → reward ledger and impact history
```
