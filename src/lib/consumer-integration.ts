import type { MeterReading, Offer, Scenario, VerificationResult } from "@/domain/types";
import type { ConsumerState } from "./consumer";
import { getScenario, setScenario, OPERATOR_SHARED_SESSION } from "./demo-store";

function timestampForSlot(date: string, slot: number) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + Math.floor(slot / 48));
  const withinDay = ((slot % 48) + 48) % 48;
  return `${day.toISOString().slice(0, 10)}T${String(Math.floor(withinDay / 2)).padStart(2, "0")}:${withinDay % 2 ? "30" : "00"}:00+05:30`;
}

function normalizeReading(session: string, scenario: Scenario, offer: Offer, reading: ConsumerState["readings"][number], completionSlot: number | null): MeterReading {
  if (!Number.isInteger(reading.slot) || reading.slot < 0 || reading.slot > 48) throw new Error("Consumer evidence contains an invalid interval.");
  const cumulativeKWh = Number(reading.cumulative_kwh);
  if (!Number.isFinite(cumulativeKWh) || cumulativeKWh < 0) throw new Error("Consumer evidence contains an invalid meter value.");
  const key = `consumer-${session}-${offer.id}-${reading.slot}`;
  return { id: key, eventId: offer.eventId, activityId: offer.activityId, deviceId: `consumer-${session}`, timestamp: timestampForSlot(scenario.date, reading.slot), cumulativeKWh, serviceComplete: completionSlot === reading.slot, readingKey: key, data_source: "simulation" };
}

function decisionFor(state: ConsumerState["offer"]) {
  if (!state) return "pending" as const;
  return state.decision === "accepted" ? "accept" as const : state.decision === "skipped" ? "skip" as const : state.decision === "overridden" ? "override" as const : "pending" as const;
}

/** Project an authoritative consumer RPC snapshot into one user's isolated operator namespace. */
export async function syncConsumerToOperator(_command: string, state: ConsumerState, userId: string) {
  if (!userId) throw new Error("Authenticated user is required for operator projection.");
  const session = `operator-${userId}`;
  const persist = (next: Scenario) => { setScenario(session, next); setScenario(OPERATOR_SHARED_SESSION, next); return next; };
  const scenario = getScenario(session);
  const operatorOffer = scenario.offers.find((offer) => offer.activityId === "activity-ev") ?? scenario.offers[0];
  if (!operatorOffer) return session;

  const keptReadings = scenario.readings.filter((reading) => !(reading.eventId === operatorOffer.eventId && reading.activityId === operatorOffer.activityId));
  const keptResults = { ...(scenario.results ?? {}) };
  delete keptResults[operatorOffer.id];
  const keptLedger = (scenario.rewardLedger ?? []).filter((entry) => entry.offerId !== operatorOffer.id);
  if (!state.offer) {
    persist({ ...scenario, readings: keptReadings, results: keptResults, rewardLedger: keptLedger, simulatedOfferIds: (scenario.simulatedOfferIds ?? []).filter((id) => id !== operatorOffer.id), offers: scenario.offers.map((offer) => offer.id === operatorOffer.id ? { ...offer, decision: "pending", status: "recommended", proposedStart: offer.originalStart, proposedEnd: offer.originalStart + (offer.proposedEnd - offer.proposedStart), version: offer.version + 1 } : offer), schedules: scenario.schedules.map((schedule) => schedule.activityId === operatorOffer.activityId ? { ...schedule, startSlot: operatorOffer.originalStart, endSlot: operatorOffer.originalStart + (operatorOffer.proposedEnd - operatorOffer.proposedStart), accepted: false, version: schedule.version + 1 } : schedule), activities: scenario.activities.map((activity) => activity.id === operatorOffer.activityId ? { ...activity, status: "recommended" } : activity) });
    return session;
  }

  const offerState = state.offer;
  const decision = decisionFor(offerState);
  const numericFields = [offerState.baseline_start, offerState.proposed_start, offerState.duration_slots, offerState.deadline_slot, offerState.required_kwh, offerState.power_kw, offerState.version];
  if (!numericFields.every(Number.isFinite) || !Number.isInteger(offerState.baseline_start) || !Number.isInteger(offerState.proposed_start) || !Number.isInteger(offerState.duration_slots) || !Number.isInteger(offerState.deadline_slot) || offerState.baseline_start < 0 || offerState.proposed_start < 0 || offerState.duration_slots <= 0 || offerState.required_kwh <= 0 || offerState.power_kw <= 0 || offerState.deadline_slot > scenario.forecast.length || offerState.proposed_start + offerState.duration_slots > offerState.deadline_slot || offerState.baseline_start + offerState.duration_slots > scenario.forecast.length) throw new Error("Consumer offer contains an invalid schedule.");
  const proposedEnd = offerState.proposed_start + offerState.duration_slots;
  const updatedOffer: Offer = { ...operatorOffer, originalStart: offerState.baseline_start, proposedStart: offerState.proposed_start, proposedEnd, deadline: offerState.deadline_slot, decision, status: decision === "accept" ? "accepted" : decision === "skip" ? "skipped" : "recommended", version: Math.max(operatorOffer.version, offerState.version) };
  const updatedSchedule = scenario.schedules.find((schedule) => schedule.activityId === operatorOffer.activityId);
  const schedules = updatedSchedule ? scenario.schedules.map((schedule) => schedule.activityId === operatorOffer.activityId ? { ...schedule, startSlot: decision === "accept" ? offerState.proposed_start : offerState.baseline_start, endSlot: (decision === "accept" ? proposedEnd : offerState.baseline_start + offerState.duration_slots), powerKW: offerState.power_kw, accepted: decision === "accept", version: updatedOffer.version } : schedule) : [...scenario.schedules, { activityId: operatorOffer.activityId, startSlot: decision === "accept" ? offerState.proposed_start : offerState.baseline_start, endSlot: decision === "accept" ? proposedEnd : offerState.baseline_start + offerState.duration_slots, powerKW: offerState.power_kw, accepted: decision === "accept", version: updatedOffer.version, data_source: "simulation" as const }];
  const incomingReadings = state.readings.map((reading) => normalizeReading(session, scenario, updatedOffer, reading, offerState.completion_slot));
  const verification = state.verification;
  if (verification && ![verification.recorded_kwh, verification.eligible_kwh, verification.baseline_kwh].every((value) => Number.isFinite(value) && value >= 0)) throw new Error("Consumer snapshot contains invalid verification evidence.");
  const results = verification ? { ...keptResults, [updatedOffer.id]: { activityId: operatorOffer.activityId, outcome: verification.status, requiredEnergyKWh: offerState.required_kwh, recordedEnergyKWh: verification.recorded_kwh, acceptedWindow: { startSlot: offerState.proposed_start, endSlot: proposedEnd }, reason: verification.reason, data_source: "simulation" as const, eligibleShiftedKWh: verification.eligible_kwh, baselineRecordedKWh: verification.baseline_kwh, createdAt: verification.created_at } satisfies VerificationResult & { eligibleShiftedKWh: number; baselineRecordedKWh?: number; createdAt: string } } : keptResults;
  const reward = state.rewards.find((entry) => entry.state !== "pending");
  if (reward && ![reward.points, reward.illustrative_rupees].every((value) => Number.isFinite(value) && value >= 0)) throw new Error("Consumer snapshot contains an invalid reward.");
  const rewardLedger = reward ? [...keptLedger, { id: `consumer-${session}-${reward.id}`, offerId: updatedOffer.id, points: reward.points, illustrativeRupees: reward.illustrative_rupees, state: reward.state === "redeemable" ? "redeemable" as const : "verified" as const, createdAt: reward.created_at }] : keptLedger;
  persist({ ...scenario, offers: scenario.offers.map((offer) => offer.id === operatorOffer.id ? updatedOffer : offer), schedules, readings: [...keptReadings, ...incomingReadings], results, rewardLedger, simulatedOfferIds: offerState.simulation_run ? [...new Set([...(scenario.simulatedOfferIds ?? []), updatedOffer.id])] : (scenario.simulatedOfferIds ?? []).filter((id) => id !== updatedOffer.id), activities: scenario.activities.map((activity) => activity.id === operatorOffer.activityId ? { ...activity, name: offerState.name, baselineStart: offerState.baseline_start, durationSlots: offerState.duration_slots, latestFinish: offerState.deadline_slot, powerLimitKW: offerState.power_kw, requiredEnergyKWh: offerState.required_kwh, status: verification?.status === "verified" ? "verified" : verification?.status === "failed" ? "failed" : decision === "accept" ? "accepted" : decision === "skip" ? "skipped" : "recommended" } : activity) });
  return session;
}
