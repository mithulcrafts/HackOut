# Smart Demand-Response & Load-Shifting System

This repository contains the Teammate A foundation for the HackOut prototype. It is a mobile-first Next.js application for coordinating flexible demand against estimated renewable availability. The current branch includes the deterministic energy engine and operator track; consumer authentication, consumer screens, Supabase persistence, meter verification and rewards remain the integration work described in `IMPLEMENTATION_PLAN.md`.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`, choose **Try operator demo**, and use the operator navigation. The demo uses one simulated day with 48 half-hour slots in `Asia/Kolkata`.

Useful checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Current operator flow

- `/operator/overview` shows the simulated renewable/demand outlook, Absorb/Protect classification, read-only grid action recommendations, battery dispatch and an accessible selected-slot table.
- `/operator/events` creates draft events and publishes eligible offers against a frozen baseline.
- `/operator/simulation` changes renewable/demand multipliers in an in-memory preview, resets the seed and replays labelled simulated reading cases.
- `/operator/verification`, `/operator/rewards` and `/operator/reports` make the pending evidence and illustrative budget states explicit while Teammate B’s trust track is unfinished.

The local demo adapter is session-scoped memory only. Restarting the server clears it. It does not represent production authentication, Supabase RLS, durable persistence, real meter credentials, real grid control or real payments. Every forecast, reading and reward is labelled according to the workflow contract.

The product workflow remains:

```text
forecast → Absorb/Protect classification → eligible activity → offer
→ user decision → agreed schedule → simulated/device reading
→ server verification → reward ledger and impact history
```
