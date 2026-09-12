import type { ConsumerState } from "./consumer";
import { slotTime } from "./consumer";

export type RewardEntry = ConsumerState["rewards"][number] & { offer_id?: string };
export type HistoryEntry = NonNullable<ConsumerState["verification"]> & { id: string; offer_id: string };
export function rewardSummary(entries: RewardEntry[], history: HistoryEntry[]) {
  const totals = { pending: 0, verified: 0, redeemable: 0 };
  for (const entry of entries) totals[entry.state] += Number(entry.points);
  const totalPoints = totals.verified + totals.redeemable;
  const successful = history.filter(item => item.status === "verified");
  return {
    ...totals, totalPoints, verifiedActions: successful.length,
    shiftedKWh: successful.reduce((sum, item) => sum + Number(item.eligible_kwh), 0),
    badge: successful.length >= 3 ? "Reliable Participant" : successful.length ? "First Verified Shift" : null,
    challenge: { target: 3, completed: Math.min(3, successful.length) },
  };
}

// Display projections of stored schedules, not a scheduler.
export function scheduleSeries(offer: ConsumerState["offer"]) {
  if (!offer) return [];
  return Array.from({ length: 48 }, (_, slot) => ({
    slot, time: slotTime(slot),
    baseline: slot >= offer.baseline_start && slot < offer.baseline_start + offer.duration_slots ? Number(offer.power_kw) : 0,
    accepted: offer.decision === "accepted" && slot >= offer.proposed_start && slot < offer.proposed_start + offer.duration_slots ? Number(offer.power_kw) : 0,
  }));
}
