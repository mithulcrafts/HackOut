import type { ActivityType, DemandResponseEvent, Offer, Scenario } from "./types";
import { activityPowerKW } from "./scheduling/engine";

export function createEvent(input: Pick<DemandResponseEvent, "name" | "objective" | "windowStart" | "windowEnd" | "requestedFlexibilityKW" | "eligibleActivityTypes" | "rewardRatePerKWh" | "budget" | "offerExpiresAt">, id = "event-" + Date.now()): DemandResponseEvent {
  return { ...input, id, status: "draft" };
}

export function publishEvent(scenario: Scenario, eventId: string): Scenario {
  const event = scenario.events.find((item) => item.id === eventId);
  if (!event) throw new Error("Event not found.");
  const updatedEvent = { ...event, status: "active" as const, frozenBaselineVersion: scenario.schedules[0]?.version ?? 1 };
  if (event.status !== "draft") throw new Error("Only draft events can be published.");
  const offers: Offer[] = scenario.activities.filter((activity) => event.eligibleActivityTypes.includes(activity.type as ActivityType)).map((activity) => {
    const schedule = scenario.schedules.find((item) => item.activityId === activity.id);
    const proposedStart = schedule?.startSlot ?? activity.baselineStart;
    const insideEvent = proposedStart < event.windowEnd && proposedStart + activity.durationSlots > event.windowStart;
    const eligible = insideEvent && proposedStart !== activity.baselineStart;
    const alignment = scenario.forecast.slice(proposedStart, proposedStart + activity.durationSlots).reduce((sum, slot) => sum + slot.renewableKW, 0);
    return { id: "offer-" + event.id + "-" + activity.id, eventId: event.id, activityId: activity.id, originalStart: activity.baselineStart, proposedStart, proposedEnd: proposedStart + activity.durationSlots, deadline: activity.latestFinish, renewableAlignment: Number(alignment.toFixed(1)), rewardEstimate: eligible ? Number((activity.requiredEnergyKWh * event.rewardRatePerKWh).toFixed(2)) : 0, decision: "pending" as const, version: schedule?.version ?? 1, status: "recommended" as const, expiresAt: event.offerExpiresAt, data_source: "simulation" as const };
  }).filter((offer) => offer.rewardEstimate > 0);
  return { ...scenario, events: scenario.events.map((item) => item.id === eventId ? updatedEvent : item), offers: [...scenario.offers.filter((offer) => offer.eventId !== eventId), ...offers] };
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
  const verified = scenario.activities.filter((activity) => activityIds.has(activity.id) && activity.status === "verified").length;
  const completed = scenario.activities.filter((activity) => activityIds.has(activity.id) && ["completed", "verified"].includes(activity.status)).length;
  const acceptedKW = scenario.schedules.filter((schedule) => schedule.accepted && activityIds.has(schedule.activityId)).reduce((sum, schedule) => sum + schedule.powerKW, 0);
  return { event, funnel: { recommended: offers.length, accepted, completed, verified }, acceptedKW, pendingReadings: scenario.readings.filter((reading) => activityIds.has(reading.activityId)).length, data_source: "simulation" as const };
}

export function decideOffer(scenario: Scenario, offerId: string, decision: "accept" | "modify" | "skip" | "override", proposedStart?: number, expectedVersion?: number): Scenario {
  const offer = scenario.offers.find((item) => item.id === offerId);
  if (!offer) throw new Error("Offer not found.");
  const activity = scenario.activities.find((item) => item.id === offer.activityId);
  if (!activity) throw new Error("Activity not found.");
  if (expectedVersion !== undefined && expectedVersion !== offer.version) throw new Error("Offer changed. Refresh before trying again.");
  const start = proposedStart ?? offer.proposedStart;
  if (decision === "skip") return { ...scenario, offers: scenario.offers.map((item) => item.id === offerId ? { ...item, decision: "skip", status: "skipped" } : item), activities: scenario.activities.map((item) => item.id === activity.id ? { ...item, status: "skipped" } : item) };
  if (decision === "override") return { ...scenario, offers: scenario.offers.map((item) => item.id === offerId ? { ...item, decision: "override", status: "recommended" } : item), schedules: scenario.schedules.map((item) => item.activityId === activity.id ? { ...item, accepted: false, version: item.version + 1 } : item), activities: scenario.activities.map((item) => item.id === activity.id ? { ...item, status: "recommended" } : item) };
  if (start < activity.earliestStart || start + activity.durationSlots > activity.latestFinish) throw new Error("The selected time does not meet the activity deadline.");
  const powerKW = activityPowerKW(activity);
  const conflicts = Array.from({ length: activity.durationSlots }, (_, offset) => start + offset).some((slot) => {
    const acceptedPower = scenario.schedules.filter((item) => item.accepted && item.activityId !== activity.id && slot >= item.startSlot && slot < item.endSlot).reduce((sum, item) => sum + item.powerKW, 0);
    return (scenario.forecast[slot]?.fixedDemandKW ?? 0) + acceptedPower + powerKW > scenario.sitePowerLimitKW;
  });
  if (conflicts) throw new Error("The selected time exceeds the site power limit.");
  return { ...scenario, offers: scenario.offers.map((item) => item.id === offerId ? { ...item, decision: decision === "modify" ? "modify" : "accept", proposedStart: start, proposedEnd: start + activity.durationSlots, version: item.version + 1, status: "accepted" } : item), schedules: scenario.schedules.map((item) => item.activityId === activity.id ? { ...item, startSlot: start, endSlot: start + activity.durationSlots, powerKW, accepted: true, version: item.version + 1 } : item), activities: scenario.activities.map((item) => item.id === activity.id ? { ...item, status: "accepted" } : item) };
}
