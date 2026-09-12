import type { Activity, DemandResponseEvent, Offer, Scenario, ScheduleEntry } from "./types";
import { activityPowerKW } from "./scheduling/engine";

export function createEvent(input: Pick<DemandResponseEvent, "name" | "objective" | "windowStart" | "windowEnd" | "requestedFlexibilityKW" | "eligibleActivityTypes" | "rewardRatePerKWh" | "budget" | "offerExpiresAt">, id = "event-" + Date.now()): DemandResponseEvent {
  return { ...input, id, status: "draft" };
}

function overlapSlots(start: number, end: number, otherStart: number, otherEnd: number) {
  return Math.max(0, Math.min(end, otherEnd) - Math.max(start, otherStart));
}

/** Only the part of a load actually moved into/out of the event is eligible. */
function eligibleEnergy(activity: Activity, event: DemandResponseEvent, start: number, baselineStart = activity.baselineStart) {
  const end = start + activity.durationSlots;
  if (start === baselineStart) return 0;
  if (event.objective === "protect") {
    if (overlapSlots(start, end, event.windowStart, event.windowEnd) > 0) return 0;
    return overlapSlots(baselineStart, baselineStart + activity.durationSlots, event.windowStart, event.windowEnd) * activityPowerKW(activity) * 0.5;
  }
  if (start < event.windowStart || end > event.windowEnd) return 0;
  const alreadyInWindow = overlapSlots(event.windowStart, event.windowEnd, baselineStart, baselineStart + activity.durationSlots);
  return (activity.durationSlots - alreadyInWindow) * activityPowerKW(activity) * 0.5;
}

function feasibleStart(scenario: Scenario, activity: Activity, start: number, reservations: ScheduleEntry[]) {
  if (!Number.isInteger(start) || !Number.isInteger(activity.durationSlots) || activity.durationSlots <= 0 || activity.requiredEnergyKWh <= 0 || start < activity.earliestStart || start < 0 || start + activity.durationSlots > activity.latestFinish || start + activity.durationSlots > scenario.forecast.length) return false;
  const powerKW = activityPowerKW(activity);
  if (powerKW <= 0 || powerKW > activity.powerLimitKW) return false;
  // Capacity must include every other load exactly once. During publication,
  // reservations contains proposed windows; during acceptance it contains
  // accepted windows. Activities without a reservation keep their frozen
  // baseline schedule, so an unaccepted offer cannot hide existing demand.
  const occupiedByActivity = new Map<string, ScheduleEntry>();
  for (const schedule of scenario.schedules) {
    if (schedule.activityId !== activity.id && schedule.accepted) occupiedByActivity.set(schedule.activityId, schedule);
  }
  for (const reservation of reservations) {
    if (reservation.activityId !== activity.id) occupiedByActivity.set(reservation.activityId, reservation);
  }
  for (const other of scenario.activities) {
    if (other.id === activity.id || occupiedByActivity.has(other.id)) continue;
    if (Number.isInteger(other.baselineStart) && other.baselineStart >= 0 && other.baselineStart + other.durationSlots <= scenario.forecast.length) {
      occupiedByActivity.set(other.id, { activityId: other.id, startSlot: other.baselineStart, endSlot: other.baselineStart + other.durationSlots, powerKW: activityPowerKW(other), accepted: false, version: 0, data_source: "simulation" });
    }
  }
  const occupied = [...occupiedByActivity.values()];
  return Array.from({ length: activity.durationSlots }, (_, offset) => start + offset).every((slot) => {
    const reservedKW = occupied.filter((item) => slot >= item.startSlot && slot < item.endSlot).reduce((sum, item) => sum + item.powerKW, 0);
    return (scenario.forecast[slot]?.fixedDemandKW ?? Number.POSITIVE_INFINITY) + reservedKW + powerKW <= scenario.sitePowerLimitKW;
  });
}

function proposalScore(scenario: Scenario, activity: Activity, start: number) {
  const window = scenario.forecast.slice(start, start + activity.durationSlots);
  return window.reduce((score, slot) => score + slot.renewableKW - slot.fixedDemandKW * 0.25, 0) - Math.abs(start - activity.baselineStart) * 0.12;
}

export function publishEvent(scenario: Scenario, eventId: string): Scenario {
  const event = scenario.events.find((item) => item.id === eventId);
  if (!event) throw new Error("Event not found.");
  if (event.status !== "draft") throw new Error("Only draft events can be published.");
  const updatedEvent = { ...event, status: "active" as const, frozenBaselineVersion: scenario.schedules[0]?.version ?? 1 };
  const reservations = scenario.schedules.filter((item) => item.accepted);
  const schedules = [...scenario.schedules];
  const offers: Offer[] = [];
  let remainingBudget = event.budget;

  for (const activity of scenario.activities) {
    if (!event.eligibleActivityTypes.includes(activity.type) || reservations.some((item) => item.activityId === activity.id) || ["completed", "verified", "failed"].includes(activity.status)) continue;
    if (![activity.earliestStart, activity.latestFinish, activity.durationSlots].every(Number.isInteger) || activity.durationSlots <= 0 || activity.earliestStart < 0 || activity.latestFinish > scenario.forecast.length) continue;
    let best: { start: number; energy: number; score: number } | undefined;
    for (let start = activity.earliestStart; start + activity.durationSlots <= activity.latestFinish; start++) {
      const energy = eligibleEnergy(activity, event, start);
      if (energy <= 0 || !feasibleStart(scenario, activity, start, reservations)) continue;
      const cost = Number((energy * event.rewardRatePerKWh).toFixed(2));
      if (cost <= 0 || cost > remainingBudget + 0.001) continue;
      const score = proposalScore(scenario, activity, start);
      if (!best || score > best.score) best = { start, energy, score };
    }
    if (!best) continue;
    const existing = schedules.find((item) => item.activityId === activity.id);
    const version = (existing?.version ?? 0) + 1;
    const schedule: ScheduleEntry = { activityId: activity.id, startSlot: best.start, endSlot: best.start + activity.durationSlots, powerKW: activityPowerKW(activity), accepted: false, version, data_source: "simulation" };
    const scheduleIndex = schedules.findIndex((item) => item.activityId === activity.id);
    if (scheduleIndex >= 0) schedules[scheduleIndex] = schedule;
    else schedules.push(schedule);
    // Proposals reserve room within this publication, but only an accepted
    // offer becomes committed demand. Acceptance checks the cap again.
    reservations.push(schedule);
    const rewardEstimate = Number((best.energy * event.rewardRatePerKWh).toFixed(2));
    remainingBudget -= rewardEstimate;
    offers.push({ id: "offer-" + event.id + "-" + activity.id, eventId: event.id, activityId: activity.id, originalStart: activity.baselineStart, proposedStart: best.start, proposedEnd: best.start + activity.durationSlots, deadline: activity.latestFinish, renewableAlignment: Number(scenario.forecast.slice(best.start, best.start + activity.durationSlots).reduce((sum, slot) => sum + slot.renewableKW, 0).toFixed(1)), rewardEstimate, decision: "pending", version, status: "recommended", expiresAt: event.offerExpiresAt, data_source: "simulation" });
  }
  return { ...scenario, schedules, events: scenario.events.map((item) => item.id === eventId ? updatedEvent : item), offers: [...scenario.offers.filter((offer) => offer.eventId !== eventId), ...offers] };
}

export function closeEvent(scenario: Scenario, eventId: string): Scenario {
  const event = scenario.events.find((item) => item.id === eventId);
  if (!event) throw new Error("Event not found.");
  if (event.status !== "active" && event.status !== "verifying") throw new Error("Only active events can be closed.");
  return { ...scenario, events: scenario.events.map((item) => item.id === eventId ? { ...item, status: "closed" as const } : item) };
}

export function eventReport(scenario: Scenario, eventId: string) {
  const event = scenario.events.find((item) => item.id === eventId);
  if (!event) throw new Error("Event not found.");
  const offers = scenario.offers.filter((offer) => offer.eventId === eventId);
  const activityIds = new Set(offers.map((offer) => offer.activityId));
  const accepted = offers.filter((offer) => offer.status === "accepted").length;
  const acceptedOffers = offers.filter((offer) => offer.status === "accepted");
  const resultFor = (offer: Offer) => scenario.results?.[offer.activityId];
  const activityFor = (offer: Offer) => scenario.activities.find((activity) => activity.id === offer.activityId);
  const verified = acceptedOffers.filter((offer) => resultFor(offer)?.outcome === "verified" || (!resultFor(offer) && activityFor(offer)?.status === "verified")).length;
  const completed = acceptedOffers.filter((offer) => {
    const result = resultFor(offer);
    return result ? ["verified", "partial", "failed"].includes(result.outcome) : ["completed", "verified", "failed"].includes(activityFor(offer)?.status ?? "");
  }).length;
  const acceptedKW = scenario.schedules.filter((schedule) => schedule.accepted && activityIds.has(schedule.activityId)).reduce((sum, schedule) => sum + schedule.powerKW, 0);
  const pendingReadings = acceptedOffers.filter((offer) => {
    const result = resultFor(offer);
    if (result) return result.outcome === "pending";
    return !scenario.readings.some((reading) => reading.eventId === eventId && reading.activityId === offer.activityId);
  }).length;
  return { event, funnel: { recommended: offers.length, accepted, completed, verified }, acceptedKW, pendingReadings, data_source: "simulation" as const };
}

export function decideOffer(scenario: Scenario, offerId: string, decision: "accept" | "modify" | "skip" | "override", proposedStart?: number, expectedVersion?: number): Scenario {
  const offer = scenario.offers.find((item) => item.id === offerId);
  if (!offer) throw new Error("Offer not found.");
  const activity = scenario.activities.find((item) => item.id === offer.activityId);
  if (!activity) throw new Error("Activity not found.");
  if (expectedVersion !== undefined && expectedVersion !== offer.version) throw new Error("Offer changed. Refresh before trying again.");
  if (["accept", "modify", "skip"].includes(decision) && !["pending", "modify"].includes(offer.decision)) throw new Error("Only pending offers can be changed.");
  if (decision === "override" && offer.decision !== "accept") throw new Error("Only an accepted offer can be overridden.");
  if (decision === "skip") {
    const hasAnotherCommitment = scenario.offers.some((item) => item.id !== offer.id && item.activityId === activity.id && item.decision === "accept");
    return { ...scenario, offers: scenario.offers.map((item) => item.id === offerId ? { ...item, decision: "skip", status: "skipped", version: item.version + 1 } : item), activities: scenario.activities.map((item) => item.id === activity.id && !hasAnotherCommitment ? { ...item, status: "skipped" } : item) };
  }
  if (decision === "override") {
    if (scenario.readings.some((reading) => reading.activityId === activity.id)) throw new Error("Activity evidence has already been recorded. Request a review instead of changing the completed schedule.");
    return { ...scenario, offers: scenario.offers.map((item) => item.id === offerId ? { ...item, decision: "override", status: "recommended", version: item.version + 1 } : item), schedules: scenario.schedules.map((item) => item.activityId === activity.id ? { ...item, accepted: false, version: item.version + 1 } : item), activities: scenario.activities.map((item) => item.id === activity.id ? { ...item, status: "recommended" } : item) };
  }
  const event = scenario.events.find((item) => item.id === offer.eventId);
  if (!event || event.status !== "active") throw new Error("This event is not active. Continue with your normal schedule without penalty.");
  if (!event.eligibleActivityTypes.includes(activity.type)) throw new Error("This activity type is not eligible for the event.");
  if (scenario.offers.some((item) => item.id !== offer.id && item.activityId === activity.id && item.decision === "accept")) throw new Error("This activity already has an accepted event. Override that offer before accepting another.");
  const start = proposedStart ?? offer.proposedStart;
  if (start === offer.originalStart) throw new Error("An unchanged baseline is not eligible for a shift reward.");
  if (!Number.isInteger(start) || start < activity.earliestStart || start + activity.durationSlots > activity.latestFinish) throw new Error("The selected time does not meet the activity deadline.");
  const energy = eligibleEnergy(activity, event, start, offer.originalStart);
  if (energy <= 0) throw new Error(event.objective === "protect" ? "Choose a window outside the protected period that moves an existing peak load." : "Choose a window inside the renewable-rich event period.");
  const reservations = scenario.schedules.filter((item) => item.accepted);
  if (!feasibleStart(scenario, activity, start, reservations)) throw new Error("The selected time exceeds the equipment or site power limit.");
  const rewardEstimate = Number((energy * event.rewardRatePerKWh).toFixed(2));
  const reservedCost = scenario.offers.filter((item) => item.eventId === event.id && item.id !== offer.id && item.decision === "accept").reduce((sum, item) => sum + item.rewardEstimate, 0);
  if (rewardEstimate <= 0 || reservedCost + rewardEstimate > event.budget + 0.001) throw new Error("The event reward budget is exhausted. Continue with your normal schedule without penalty.");
  const accepted = decision !== "modify";
  const existingSchedule = scenario.schedules.find((item) => item.activityId === activity.id);
  const updatedSchedule: ScheduleEntry = { activityId: activity.id, startSlot: start, endSlot: start + activity.durationSlots, powerKW: activityPowerKW(activity), accepted, version: (existingSchedule?.version ?? offer.version) + 1, data_source: "simulation" };
  const schedules = existingSchedule ? scenario.schedules.map((item) => item.activityId === activity.id ? updatedSchedule : item) : [...scenario.schedules, updatedSchedule];
  return { ...scenario, offers: scenario.offers.map((item) => item.id === offerId ? { ...item, decision: decision === "modify" ? "modify" : "accept", proposedStart: start, proposedEnd: start + activity.durationSlots, rewardEstimate, version: item.version + 1, status: accepted ? "accepted" : "recommended" } : item), schedules, activities: scenario.activities.map((item) => item.id === activity.id ? { ...item, status: accepted ? "accepted" : "recommended" } : item) };
}
