import type { Activity, DemandResponseEvent, Offer, Scenario, ScheduleEntry } from "./types";
import { activityPowerKW, dispatchBattery } from "./scheduling/engine";
import { effectiveSchedules } from "./summary";

const EPSILON = 0.001;
export type OfferDecisionTime = string | Date;

/**
 * Validate event terms at the domain boundary as well as in the HTTP form.
 * UI validation is useful feedback, but a preview/publish caller must not be
 * able to create an active event which can never accept an offer.
 */
export function validateEvent(scenario: Scenario, event: DemandResponseEvent): void {
  if (!event.name?.trim() || !["absorb", "protect"].includes(event.objective)) throw new Error("Event name and objective are required.");
  if (!Number.isInteger(event.windowStart) || !Number.isInteger(event.windowEnd) || event.windowStart < 0 || event.windowEnd > scenario.forecast.length || event.windowEnd <= event.windowStart) throw new Error("Event window must be a valid interval inside the scenario day.");
  if (!Number.isFinite(event.requestedFlexibilityKW) || event.requestedFlexibilityKW <= 0) throw new Error("Requested flexibility must be positive.");
  if (!Number.isFinite(event.rewardRatePerKWh) || event.rewardRatePerKWh < 0 || !Number.isFinite(event.budget) || event.budget < 0) throw new Error("Reward rate and budget must be non-negative.");
  if (!Array.isArray(event.eligibleActivityTypes) || event.eligibleActivityTypes.length === 0 || new Set(event.eligibleActivityTypes).size !== event.eligibleActivityTypes.length) throw new Error("Select at least one unique eligible activity type.");
  if ((event.minParticipants ?? 0) < 0 || (event.maxParticipants !== undefined && event.maxParticipants < (event.minParticipants ?? 0))) throw new Error("Maximum participation must be at least the minimum.");
  const expiry = parseDecisionTime(event.offerExpiresAt);
  const replay = parseDecisionTime(replayDecisionTime(scenario));
  if (expiry === undefined) throw new Error("Event offer expiry is invalid.");
  if (replay !== undefined && expiry <= replay) throw new Error("Offer expiry must be after the scenario decision time.");
}

export function createEvent(input: Pick<DemandResponseEvent, "name" | "objective" | "windowStart" | "windowEnd" | "requestedFlexibilityKW" | "eligibleActivityTypes" | "participantGroup" | "minParticipants" | "maxParticipants" | "rewardRatePerKWh" | "budget" | "offerExpiresAt">, id = "event-" + Date.now()): DemandResponseEvent {
  return { ...input, participantGroup: input.participantGroup ?? "All enrolled participants", minParticipants: input.minParticipants ?? 0, id, status: "draft" };
}

function overlapSlots(start: number, end: number, otherStart: number, otherEnd: number) {
  return Math.max(0, Math.min(end, otherEnd) - Math.max(start, otherStart));
}

/**
 * Activities which pass the event's participant-level publication rules.
 * Capacity, timing-window and budget checks are intentionally left to the
 * per-offer planner so the preview can explain why an otherwise eligible
 * activity did not receive a safe offer.
 */
export function eventEligibleActivities(scenario: Scenario, event: DemandResponseEvent): Activity[] {
  const committedActivityIds = new Set([
    ...scenario.schedules.filter((schedule) => schedule.accepted).map((schedule) => schedule.activityId),
    ...scenario.offers.filter((offer) => offer.decision === "accept").map((offer) => offer.activityId),
  ]);
  return scenario.activities.filter((activity) =>
    event.eligibleActivityTypes.includes(activity.type)
    && !committedActivityIds.has(activity.id)
    && !["completed", "verified", "failed", "paused"].includes(activity.status)
    && [activity.earliestStart, activity.latestFinish, activity.durationSlots].every(Number.isInteger)
    && activity.durationSlots > 0
    && activity.earliestStart >= 0
    && activity.latestFinish <= scenario.forecast.length,
  );
}

/**
 * The local prototype is replayed against a fixed scenario day.  Using a
 * deterministic morning clock represents a participant deciding before the
 * day's event windows begin, keeps the seeded event usable when the host's
 * wall clock has moved on, and still lets callers inject a real clock.
 */
export function replayDecisionTime(scenario: Scenario): string {
  return `${scenario.date}T08:00:00+05:30`;
}

function parseDecisionTime(value: OfferDecisionTime): number | undefined {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

/** Return true when an offer cannot be acted on at the supplied replay time. */
export function isOfferExpired(scenario: Scenario, offer: Offer, asOf: OfferDecisionTime = replayDecisionTime(scenario)): boolean {
  const expiry = parseDecisionTime(offer.expiresAt);
  const current = parseDecisionTime(asOf);
  // Fail closed for malformed timestamps. API validation prevents these in
  // normal use, but domain callers should never be able to bypass expiry with
  // an invalid date.
  return expiry === undefined || current === undefined || current >= expiry;
}

function eventContributionSchedule(event: DemandResponseEvent, activity: Activity, offer: Offer, schedule?: ScheduleEntry): ScheduleEntry | undefined {
  const powerKW = schedule?.powerKW ?? activityPowerKW(activity);
  if (!Number.isFinite(powerKW) || powerKW <= 0) return undefined;
  if (event.objective === "protect") {
    // Protect capacity is the load removed from the protected peak, so its
    // contribution is measured at the frozen baseline window rather than at
    // the replacement (outside-peak) schedule.
    const baselineStart = Number.isInteger(offer.originalStart) ? offer.originalStart : activity.baselineStart;
    const startSlot = Math.max(baselineStart, event.windowStart);
    const endSlot = Math.min(baselineStart + activity.durationSlots, event.windowEnd);
    if (endSlot <= startSlot) return undefined;
    return { activityId: activity.id, startSlot, endSlot, powerKW, accepted: offer.decision === "accept", version: schedule?.version ?? offer.version, data_source: schedule?.data_source ?? "simulation" };
  }
  return { activityId: activity.id, startSlot: offer.proposedStart, endSlot: offer.proposedEnd, powerKW, accepted: offer.decision === "accept", version: schedule?.version ?? offer.version, data_source: schedule?.data_source ?? "simulation" };
}

function eventOfferSchedules(scenario: Scenario, eventId: string, decisions: Offer["decision"][]): ScheduleEntry[] {
  const event = scenario.events.find((item) => item.id === eventId);
  if (!event) return [];
  return scenario.offers
    .filter((offer) => offer.eventId === eventId && decisions.includes(offer.decision))
    .map((offer) => {
      const activity = scenario.activities.find((item) => item.id === offer.activityId);
      return activity ? eventContributionSchedule(event, activity, offer, scenario.schedules.find((schedule) => schedule.activityId === offer.activityId)) : undefined;
    })
    .filter((schedule): schedule is ScheduleEntry => Boolean(schedule));
}

function eventAcceptedSchedules(scenario: Scenario, eventId: string): ScheduleEntry[] {
  return eventOfferSchedules(scenario, eventId, ["accept"]);
}

function eventProjectedSchedules(scenario: Scenario, eventId: string): ScheduleEntry[] {
  return eventOfferSchedules(scenario, eventId, ["pending", "modify", "accept"]);
}

function maxConcurrentPower(schedules: ScheduleEntry[]): number {
  const boundaries = new Set<number>();
  schedules.forEach((schedule) => { for (let slot = schedule.startSlot; slot < schedule.endSlot; slot++) boundaries.add(slot); });
  return [...boundaries].reduce((highest, slot) => {
    const concurrent = schedules.filter((schedule) => slot >= schedule.startSlot && slot < schedule.endSlot).reduce((sum, schedule) => sum + schedule.powerKW, 0);
    return Math.max(highest, concurrent);
  }, 0);
}

/**
 * Requested flexibility is an instantaneous kW programme cap.  A non-overlap
 * sequence of loads can therefore use the same cap, while overlapping loads
 * must stay below it at every half-hour slot.
 */
function respectsFlexibilityCap(existing: ScheduleEntry[], candidate: ScheduleEntry, capKW: number): boolean {
  if (!Number.isFinite(capKW) || capKW < 0 || candidate.endSlot <= candidate.startSlot) return false;
  for (let slot = candidate.startSlot; slot < candidate.endSlot; slot++) {
    const occupied = existing
      .filter((schedule) => schedule.activityId !== candidate.activityId && slot >= schedule.startSlot && slot < schedule.endSlot)
      .reduce((sum, schedule) => sum + schedule.powerKW, 0);
    if (occupied + candidate.powerKW > capKW + EPSILON) return false;
  }
  return true;
}

/** Maximum concurrent committed flexibility for an event, rounded for UI/API use. */
export function eventCommittedFlexibilityKW(scenario: Scenario, eventId: string): number {
  return Number(maxConcurrentPower(eventAcceptedSchedules(scenario, eventId)).toFixed(2));
}

/** Maximum concurrent proposed or committed flexibility for an event. */
export function eventProjectedFlexibilityKW(scenario: Scenario, eventId: string): number {
  return Number(maxConcurrentPower(eventProjectedSchedules(scenario, eventId)).toFixed(2));
}

/** Maximum concurrent kW represented by evidence-backed eligible energy. */
export function eventVerifiedFlexibilityKW(scenario: Scenario, eventId: string): number {
  const event = scenario.events.find((item) => item.id === eventId);
  if (!event) return 0;
  const verified: ScheduleEntry[] = scenario.offers
    .filter((offer) => offer.eventId === eventId && offer.decision === "accept")
    .map((offer) => {
      const result = scenario.results?.[offer.id] ?? scenario.results?.[offer.activityId];
      const activity = scenario.activities.find((item) => item.id === offer.activityId);
      if (!result || result.outcome !== "verified" || !activity || activity.durationSlots <= 0) return undefined;
       const schedule = eventContributionSchedule(event, activity, offer, scenario.schedules.find((item) => item.activityId === activity.id));
       if (!schedule) return undefined;
       const hours = (schedule.endSlot - schedule.startSlot) * 0.5;
       if (hours <= 0) return undefined;
       return { ...schedule, powerKW: result.eligibleShiftedKWh / hours };
    })
    .filter((schedule): schedule is ScheduleEntry => Boolean(schedule));
  return Number(maxConcurrentPower(verified).toFixed(2));
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

/** Energy genuinely moved by one offer, independent of the cash reward rate. */
export function offerEligibleShiftedEnergyKWh(scenario: Scenario, offer: Offer): number {
  const activity = scenario.activities.find((item) => item.id === offer.activityId);
  const event = scenario.events.find((item) => item.id === offer.eventId);
  if (!activity || !event || !["pending", "modify", "accept"].includes(offer.decision)) return 0;
  return Number(eligibleEnergy(activity, event, offer.proposedStart, offer.originalStart).toFixed(3));
}

/** Participant energy projected for an event; does not infer energy by dividing money by a tariff. */
export function eventProjectedShiftedEnergyKWh(scenario: Scenario, eventId: string): number {
  return Number(scenario.offers
    .filter((offer) => offer.eventId === eventId)
    .reduce((sum, offer) => sum + offerEligibleShiftedEnergyKWh(scenario, offer), 0)
    .toFixed(3));
}

/**
 * Release an accepted activity without moving anybody else silently.  The
 * remaining pending offers are surfaced as recovery options; if there is an
 * eligible activity that did not yet have an offer, a fresh proposal is
 * generated against the same event budget and constraints.  The unresolved
 * target is recorded for the operator so a released commitment cannot vanish
 * from the programme metrics.
 */
export function repairSchedule(scenario: Scenario, lostActivityId: string, createdAt = new Date().toISOString()): Scenario {
  const acceptedSchedule = scenario.schedules
    .filter((schedule) => schedule.activityId === lostActivityId && schedule.accepted)
    .sort((a, b) => b.version - a.version)[0];
  const acceptedOffer = scenario.offers.find((offer) => offer.activityId === lostActivityId && offer.decision === "accept");
  if (!acceptedSchedule || !acceptedOffer) throw new Error("Only an accepted activity can be released.");
  const event = scenario.events.find((item) => item.id === acceptedOffer.eventId);
  if (!event) throw new Error("The accepted event could not be found.");

  const releasedOffers = scenario.offers.map((offer) => offer.id === acceptedOffer.id
    ? { ...offer, decision: "override" as const, status: "recommended" as const, version: offer.version + 1 }
    : offer);
  const releasedSchedules = scenario.schedules.map((schedule) => schedule.activityId === lostActivityId
    ? { ...schedule, accepted: false, version: schedule.version + 1 }
    : schedule);
  const releasedActivities = scenario.activities.map((activity) => activity.id === lostActivityId
    ? { ...activity, status: "recommended" as const }
    : activity);
  const released: Scenario = { ...scenario, offers: releasedOffers, schedules: releasedSchedules, activities: releasedActivities };

  const existingEventOffers = released.offers.filter((offer) => offer.eventId === event.id);
  const reservedBudget = existingEventOffers
    .filter((offer) => ["pending", "modify", "accept"].includes(offer.decision))
    .reduce((sum, offer) => sum + Math.max(0, offer.rewardEstimate), 0);
  const candidates = eventEligibleActivities(released, event).filter((activity) =>
    activity.id !== lostActivityId
    && !existingEventOffers.some((offer) => offer.activityId === activity.id && ["pending", "modify", "accept"].includes(offer.decision)),
  );

  let replacementOffers: Offer[] = [];
  let replacementSchedules: ScheduleEntry[] = [];
  if (candidates.length && event.status === "active") {
    const previewEvent = { ...event, status: "draft" as const, budget: Math.max(0, event.budget - reservedBudget) };
    const projected = publishEvent({
      ...released,
      activities: candidates,
      offers: [],
      events: released.events.map((item) => item.id === event.id ? previewEvent : item),
    }, event.id);
    const existingIds = new Set(released.offers.map((offer) => offer.id));
    replacementOffers = projected.offers.filter((offer) => offer.eventId === event.id).map((offer, index) => existingIds.has(offer.id)
      ? { ...offer, id: `${offer.id}-recovery-${index + 1}` }
      : offer);
    const candidateIds = new Set(candidates.map((activity) => activity.id));
    replacementSchedules = projected.schedules.filter((schedule) => candidateIds.has(schedule.activityId));
  }

  const replacementByActivity = new Map(replacementSchedules.map((schedule) => [schedule.activityId, schedule]));
  const schedules = released.schedules.map((schedule) => replacementByActivity.get(schedule.activityId) ?? schedule);
  for (const schedule of replacementSchedules) {
    if (!schedules.some((existing) => existing.activityId === schedule.activityId)) schedules.push(schedule);
  }
  const offers = [...released.offers, ...replacementOffers];
  const committedFlexibility = eventCommittedFlexibilityKW({ ...released, offers, schedules }, event.id);
  const unresolvedGapKW = Number(Math.max(0, event.requestedFlexibilityKW - committedFlexibility).toFixed(2));
  const dispatch = dispatchBattery(released.forecast, effectiveSchedules({ ...released, schedules }), released.battery);
  const batterySupportKW = Number(Math.max(0, ...dispatch
    .filter((point) => point.slot >= event.windowStart && point.slot < event.windowEnd)
    .filter((point) => event.objective === "protect" ? point.action === "discharge" : point.action === "charge")
    .map((point) => point.powerKW), 0).toFixed(2));
  const recovery = {
    id: `recovery-${event.id}-${lostActivityId}-${crypto.randomUUID()}`,
    eventId: event.id,
    lostActivityId,
    lostPowerKW: Number(acceptedSchedule.powerKW.toFixed(2)),
    lostStartSlot: acceptedSchedule.startSlot,
    lostEndSlot: acceptedSchedule.endSlot,
    replacementOfferIds: [
      ...offers.filter((offer) => offer.eventId === event.id && offer.id !== acceptedOffer.id && ["pending", "modify"].includes(offer.decision)).map((offer) => offer.id),
    ],
    batterySupportKW,
    unresolvedGapKW,
    createdAt,
    data_source: "simulation" as const,
  };
  return { ...released, offers, schedules, recovery: [...(scenario.recovery ?? []), recovery] };
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
  validateEvent(scenario, event);
  const updatedEvent = { ...event, status: "active" as const, frozenBaselineVersion: scenario.schedules[0]?.version ?? 1 };
  const reservations = scenario.schedules.filter((item) => item.accepted);
  // Keep a separate reservation list for the event's requested kW cap. Site
  // capacity and programme capacity are different constraints: an event may
  // use several non-overlapping loads, but never exceed its instantaneous
  // flexibility request in one slot.
  const eventReservations = eventAcceptedSchedules(scenario, event.id);
  const schedules = [...scenario.schedules];
  const offers: Offer[] = [];
  let remainingBudget = event.budget;

  for (const activity of eventEligibleActivities(scenario, event)) {
    if (event.maxParticipants !== undefined && offers.length >= event.maxParticipants) break;
    let best: { start: number; energy: number; score: number } | undefined;
    for (let start = activity.earliestStart; start + activity.durationSlots <= activity.latestFinish; start++) {
      const energy = eligibleEnergy(activity, event, start);
      if (energy <= 0 || !feasibleStart(scenario, activity, start, reservations)) continue;
      const cost = Number((energy * event.rewardRatePerKWh).toFixed(2));
      if (cost < 0 || cost > remainingBudget + 0.001) continue;
      const score = proposalScore(scenario, activity, start);
      if (!best || score > best.score) best = { start, energy, score };
    }
    if (!best) continue;
    const existing = schedules.find((item) => item.activityId === activity.id);
    const version = (existing?.version ?? 0) + 1;
    const schedule: ScheduleEntry = { activityId: activity.id, startSlot: best.start, endSlot: best.start + activity.durationSlots, powerKW: activityPowerKW(activity), accepted: false, version, data_source: "simulation" };
    const rewardEstimate = Number((best.energy * event.rewardRatePerKWh).toFixed(2));
    const candidateOffer: Offer = { id: "offer-" + event.id + "-" + activity.id, eventId: event.id, activityId: activity.id, originalStart: activity.baselineStart, proposedStart: best.start, proposedEnd: best.start + activity.durationSlots, deadline: activity.latestFinish, renewableAlignment: Number(scenario.forecast.slice(best.start, best.start + activity.durationSlots).reduce((sum, slot) => sum + slot.renewableKW, 0).toFixed(1)), rewardEstimate, decision: "pending", version, status: "recommended", expiresAt: event.offerExpiresAt, data_source: "simulation" };
    const contribution = eventContributionSchedule(event, activity, candidateOffer, schedule);
    if (!contribution || !respectsFlexibilityCap(eventReservations, contribution, event.requestedFlexibilityKW)) continue;
    const scheduleIndex = schedules.findIndex((item) => item.activityId === activity.id);
    if (scheduleIndex >= 0) schedules[scheduleIndex] = schedule;
    else schedules.push(schedule);
    // Proposals reserve room within this publication, but only an accepted
    // offer becomes committed demand. Acceptance checks the cap again.
    reservations.push(schedule);
    eventReservations.push(contribution);
    remainingBudget -= rewardEstimate;
    offers.push(candidateOffer);
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
  const accepted = offers.filter((offer) => offer.status === "accepted").length;
  const acceptedOffers = offers.filter((offer) => offer.status === "accepted");
  // Playback stores results by offer id. Keep the activity-id fallback for
  // older persisted snapshots created before offers became the ledger key.
  const resultFor = (offer: Offer) => scenario.results?.[offer.id] ?? scenario.results?.[offer.activityId];
  const activityFor = (offer: Offer) => scenario.activities.find((activity) => activity.id === offer.activityId);
  const verified = acceptedOffers.filter((offer) => resultFor(offer)?.outcome === "verified" || (!resultFor(offer) && activityFor(offer)?.status === "verified")).length;
  const completed = acceptedOffers.filter((offer) => {
    const result = resultFor(offer);
    return result ? ["verified", "partial", "failed"].includes(result.outcome) : ["completed", "verified", "failed"].includes(activityFor(offer)?.status ?? "");
  }).length;
  const acceptedKW = eventCommittedFlexibilityKW(scenario, eventId);
  const verifiedOffers = acceptedOffers.filter((offer) => resultFor(offer)?.outcome === "verified");
  const verifiedKW = eventVerifiedFlexibilityKW(scenario, eventId);
  const shiftedKWh = verifiedOffers.reduce((sum, offer) => sum + (resultFor(offer)?.eligibleShiftedKWh ?? 0), 0);
  const rewardCost = scenario.rewardLedger?.filter((entry) => offers.some((offer) => offer.id === entry.offerId)).reduce((sum, entry) => sum + entry.illustrativeRupees, 0) ?? 0;
  const failed = acceptedOffers.filter((offer) => ["failed", "partial"].includes(resultFor(offer)?.outcome ?? "") || activityFor(offer)?.status === "failed").length;
  const acceptanceRate = offers.length ? Number((accepted / offers.length * 100).toFixed(1)) : 0;
  // Pending evidence is an offer-level metric. A raw meter trace can contain
  // partial, duplicate or incomplete intervals, so its row count must never
  // make an accepted participant disappear from the evidence queue. Once a
  // terminal result is recorded (verified, partial or failed), it leaves this
  // queue and is represented by the corresponding funnel counter.
  const pendingReadings = acceptedOffers.filter((offer) => {
    const result = resultFor(offer);
    return !result || result.outcome === "pending" || result.outcome === "needs_review";
  }).length;
  const unresolvedGapKW = Number(Math.max(0, event.requestedFlexibilityKW - eventVerifiedFlexibilityKW(scenario, eventId)).toFixed(2));
  const pendingRewardCost = acceptedOffers
    .filter((offer) => {
      const outcome = resultFor(offer)?.outcome;
      return !outcome || outcome === "pending" || outcome === "needs_review";
    })
    .reduce((sum, offer) => sum + Math.max(0, offer.rewardEstimate), 0);
  const participantCount = new Set(acceptedOffers.map((offer) => offer.activityId)).size;
  const disputedActivities = acceptedOffers.filter((offer) => resultFor(offer)?.outcome === "needs_review").length;
  const baselineSchedules = scenario.activities.map((activity) => ({ activityId: activity.id, startSlot: activity.baselineStart, endSlot: activity.baselineStart + activity.durationSlots, powerKW: activityPowerKW(activity), accepted: true, version: 0, data_source: "simulation" as const }));
  const acceptedActivityIds = new Set(acceptedOffers.map((offer) => offer.activityId));
  const effective = baselineSchedules.map((baseline) => {
    if (!acceptedActivityIds.has(baseline.activityId)) return baseline;
    return scenario.schedules.find((schedule) => schedule.activityId === baseline.activityId && schedule.accepted) ?? baseline;
  });
  const peakFor = (schedules: ScheduleEntry[]) => Math.max(0, ...scenario.forecast.map((slot) => slot.fixedDemandKW + schedules.filter((schedule) => slot.index >= schedule.startSlot && slot.index < schedule.endSlot).reduce((sum, schedule) => sum + schedule.powerKW, 0)));
  const baselinePeakKW = peakFor(baselineSchedules);
  const scheduledPeakKW = peakFor(effective);
  const peakReductionKW = Number(Math.max(0, baselinePeakKW - scheduledPeakKW).toFixed(2));
  const peakReductionPercent = baselinePeakKW > 0 ? Number((peakReductionKW / baselinePeakKW * 100).toFixed(1)) : 0;
  // This is deliberately evidence-backed: it is the verified eligible shift,
  // not a claim that the participant received exclusively renewable power.
  const renewableAlignedConsumptionKWh = Number(shiftedKWh.toFixed(2));
  return {
    event,
    funnel: { recommended: offers.length, accepted, completed, verified },
    requestedKW: Number(event.requestedFlexibilityKW.toFixed(2)),
    acceptedKW: Number(acceptedKW.toFixed(2)),
    verifiedKW: Number(verifiedKW.toFixed(2)),
    shiftedKWh: Number(shiftedKWh.toFixed(2)),
    renewableAlignedConsumptionKWh,
    peakReductionKW,
    peakReductionPercent,
    participantCount,
    rewardCost: Number(rewardCost.toFixed(2)),
    pendingRewardCost: Number(pendingRewardCost.toFixed(2)),
    failed,
    disputedActivities,
    acceptanceRate,
    pendingReadings,
    unresolvedGapKW,
    data_source: "simulation" as const,
  };
}

export function decideOffer(scenario: Scenario, offerId: string, decision: "accept" | "modify" | "skip" | "override", proposedStart?: number, expectedVersion?: number, asOf?: OfferDecisionTime): Scenario {
  const offer = scenario.offers.find((item) => item.id === offerId);
  if (!offer) throw new Error("Offer not found.");
  const activity = scenario.activities.find((item) => item.id === offer.activityId);
  if (!activity) throw new Error("Activity not found.");
  if (expectedVersion !== undefined && expectedVersion !== offer.version) throw new Error("Offer changed. Refresh before trying again.");
  if (["accept", "modify", "skip"].includes(decision) && !["pending", "modify"].includes(offer.decision)) throw new Error("Only pending offers can be changed.");
  if (decision === "override" && offer.decision !== "accept") throw new Error("Only an accepted offer can be overridden.");
  // Expiry blocks accepting or changing an offer, but never blocks Skip or
  // Override: a participant must retain a safe way to decline or release a
  // commitment after the response window has elapsed.
  if ((decision === "accept" || decision === "modify") && isOfferExpired(scenario, offer, asOf)) {
    throw new Error("This offer has expired. Continue with your normal schedule without penalty.");
  }
  if (decision === "skip") {
    const hasAnotherCommitment = scenario.offers.some((item) => item.id !== offer.id && item.activityId === activity.id && item.decision === "accept");
    return { ...scenario, offers: scenario.offers.map((item) => item.id === offerId ? { ...item, decision: "skip", status: "skipped", version: item.version + 1 } : item), activities: scenario.activities.map((item) => item.id === activity.id && !hasAnotherCommitment ? { ...item, status: "skipped" } : item) };
  }
  if (decision === "override") {
    if (scenario.readings.some((reading) => reading.activityId === activity.id)) throw new Error("Activity evidence has already been recorded. Request a review instead of changing the completed schedule.");
    return repairSchedule(scenario, activity.id);
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
  if (rewardEstimate < 0 || reservedCost + rewardEstimate > event.budget + 0.001) throw new Error("The event reward budget is exhausted. Continue with your normal schedule without penalty.");
  const accepted = decision !== "modify";
  const existingSchedule = scenario.schedules.find((item) => item.activityId === activity.id);
  const updatedSchedule: ScheduleEntry = { activityId: activity.id, startSlot: start, endSlot: start + activity.durationSlots, powerKW: activityPowerKW(activity), accepted, version: (existingSchedule?.version ?? offer.version) + 1, data_source: "simulation" };
  const candidateOffer: Offer = { ...offer, proposedStart: start, proposedEnd: start + activity.durationSlots, decision: accepted ? "accept" : "modify" };
  const contribution = eventContributionSchedule(event, activity, candidateOffer, updatedSchedule);
  if (!contribution || !respectsFlexibilityCap(eventAcceptedSchedules(scenario, event.id), contribution, event.requestedFlexibilityKW)) {
    throw new Error("This shift would exceed the event's requested flexibility capacity.");
  }
  const schedules = existingSchedule ? scenario.schedules.map((item) => item.activityId === activity.id ? updatedSchedule : item) : [...scenario.schedules, updatedSchedule];
  return { ...scenario, offers: scenario.offers.map((item) => item.id === offerId ? { ...item, decision: decision === "modify" ? "modify" : "accept", proposedStart: start, proposedEnd: start + activity.durationSlots, rewardEstimate, version: item.version + 1, status: accepted ? "accepted" : "recommended" } : item), schedules, activities: scenario.activities.map((item) => item.id === activity.id ? { ...item, status: accepted ? "accepted" : "recommended" } : item) };
}
