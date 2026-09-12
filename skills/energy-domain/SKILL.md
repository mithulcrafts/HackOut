---
name: energy-domain
description: Implement or review renewable estimates, flexible schedules, meter verification, simulation and incentives against the HackOut domain contracts.
---

# Energy and incentive correctness

## Preserve domain boundaries

- Read plan sections 3–6 and existing types/fixtures before changing calculations. Implement only the active phase; future ML/hardware work is not permission to expand scope.
- Keep provider access and persistence outside deterministic calculation functions. Reuse the same engine for live requests, fixtures and previews.
- Preserve forecast uncertainty and data provenance. Weather-derived output is an estimate for a configured installation, not measured grid supply or exclusively renewable electricity.
- A renewable deficit indicates a requirement for other supply, not proof of an outage. Real backup/curtailment actions remain recommendations.

## Units and scheduling checks

- Keep kW and kWh distinct: energy for a constant half-hour slot is kW × 0.5. Document whether values represent slot averages or totals and keep timestamps in the agreed timezone convention.
- Reconcile weather sampling with slot intervals explicitly; do not claim interpolated values were measured. Check the solar equation's dimensions and avoid applying panel efficiency twice to already-rated electrical capacity.
- Preserve deadlines, energy requirements, device/site limits and interruption rules. Moving an activity removes its original scheduled contribution; fixed load must not include it a second time.
- Acceptance must recheck capacity/version atomically. Preview must not mutate accepted schedules, baseline, wallet or live battery state.
- Recovery honors existing commitments and requires consent for replacement activity shifts. Do not treat an unaccepted replacement as delivered flexibility.
- Verify battery state-of-charge limits, efficiency losses and charge/discharge power; prevent simultaneous contradictory actions and energy creation.

## Verification and rewards

- Validate meter ordering, duplicate identity, device association and cumulative counter resets before deriving interval usage. Missing evidence is not successful completion.
- Freeze the agreed baseline before the offer. Compare both original and accepted windows; new-window consumption alone does not prove a shift. Never treat a bill scan or button click as real device evidence.
- Distinguish activity status from verification outcome. Define partial-completion/tolerance behavior in the shared contract before adding a new enum or awarding a reward.
- Cap eligible energy by the agreed requirement and evidenced shift; do not reward added consumption. Calculate monetary values consistently and settle with an idempotent, budget-checked ledger operation.
- Preserve no-penalty skip/override behavior. Participation leaderboards must not reward high absolute consumption or penalize unsuitable opportunities.

## Meaningful regression cases

- No feasible window, exact deadline, overlapping acceptances and stale schedule version.
- Baseline removed exactly once, unchanged total task energy and no preview writes.
- Override with replacement accepted, rejected or unavailable; remaining gap remains visible.
- Missing, repeated, reversed or reset readings; additional consumption without an eligible shift.
- Repeated verification produces one payout; event cap remains intact under concurrent retries.
- Battery starts full/empty and never exceeds limits; weather failure uses a labelled fixture.

Use these cases when the corresponding behavior changes; do not require every case for unrelated document or styling edits.
