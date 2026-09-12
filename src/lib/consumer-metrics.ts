import type { ConsumerState } from "./consumer";
import { slotTime } from "./consumer";

export type RewardEntry = ConsumerState["rewards"][number] & { offer_id?: string };
export type HistoryEntry = NonNullable<ConsumerState["verification"]> & { id: string; offer_id: string };
export function rewardSummary(entries: RewardEntry[], history: HistoryEntry[]) {
  const totals = { pending: 0, verified: 0, redeemable: 0 };
  for (const entry of entries) totals[entry.state] += Number(entry.points);
  const totalPoints = totals.verified + totals.redeemable;
  const successful = history.filter(item => item.status === "verified");
  const shiftedKWh = successful.reduce((sum, item) => sum + Math.max(0, Number(item.eligible_kwh) || 0), 0);
  const badges = [
    successful.length >= 1 ? "First verified shift" : null,
    successful.length >= 3 ? "Reliable participant" : null,
    shiftedKWh >= 10 ? "Renewable ally · 10 kWh" : null,
  ].filter((badge): badge is string => Boolean(badge));
  const nextTarget = successful.length < 1 ? 1 : successful.length < 3 ? 3 : 5;
  return {
    ...totals, totalPoints, verifiedActions: successful.length,
    shiftedKWh,
    badge: successful.length >= 3 ? "Reliable Participant" : successful.length ? "First Verified Shift" : null,
    badges,
    impactScore: Math.round(successful.length * 25 + shiftedKWh * 5),
    challenge: { target: 3, completed: Math.min(3, successful.length) },
    nextMilestone: { target: nextTarget, completed: Math.min(nextTarget, successful.length), label: nextTarget === 1 ? "first verified shift" : `${nextTarget} verified shifts` },
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
