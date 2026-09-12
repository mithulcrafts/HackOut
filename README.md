# Smart Demand-Response & Load-Shifting System

This repository contains the VidyutSutra HackOut prototype: a mobile-first Next.js application for coordinating flexible demand against estimated renewable availability. The current branch combines the deterministic Teammate A energy/operator track with the consumer authentication, activity, offer, simulated-reading, verification and reward flow.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The operator demo runs without external data; the authenticated consumer flow additionally requires the Supabase variables in `.env.local` and the migrations under `supabase/migrations`. Both use one simulated day with 48 half-hour slots in `Asia/Kolkata`.

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
- `/operator/verification`, `/operator/rewards` and `/operator/reports` make evidence, illustrative budget and event-funnel states explicit. These operator summary pages are ready for the shared persistence integration.

## Current consumer flow

- `/consumer/today` loads a renewable-aligned offer and supports accept, skip, simulated reading and verification.
- `/consumer/activities` stores timing constraints for EV charging, water heating, industrial processes and custom activities.
- `/consumer/offers`, `/consumer/rewards` and `/consumer/profile` provide the consumer navigation and trust/reward views.
- Consumer writes are bounded server-side by Supabase RPCs and row-level security; rewards remain illustrative simulation values.

The operator simulation remains session-scoped memory for the hackathon playback, while the consumer offer, readings, verification and reward ledger are Supabase-backed. Consumer decisions and verified results are mirrored into the same browser demo session so the operator summary can reflect the consumer journey. Saved custom activities are added to that session and receive a scheduling preview; event publication for arbitrary activity types remains a future extension. Neither path represents real meter credentials, real grid control or real payments. Every forecast, reading and reward is labelled according to the workflow contract.

The product workflow remains:

```text
forecast → Absorb/Protect classification → eligible activity → offer
→ user decision → agreed schedule → simulated/device reading
→ server verification → reward ledger and impact history
```
