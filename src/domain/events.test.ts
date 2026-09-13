import { describe, expect, it } from "vitest";
import { createDemoScenario } from "./fixtures";
import { decideOffer, eventCommittedFlexibilityKW, eventEligibleActivities, eventProjectedFlexibilityKW, eventProjectedShiftedEnergyKWh, eventReport, isOfferExpired, publishEvent, repairSchedule, validateEvent } from "./events";
import type { Activity, Scenario } from "./types";

function eventScenario(objective: "absorb" | "protect", activities?: Activity[]): Scenario {
  const base = createDemoScenario();
  const selected = activities ?? [{ ...base.activities[0], baselineStart: 20, earliestStart: 18, latestFinish: 34, status: "recommended" as const }];
  return {
    ...base,
    activities: selected,
    offers: [],
    schedules: selected.map((activity) => ({ activityId: activity.id, startSlot: activity.baselineStart, endSlot: activity.baselineStart + activity.durationSlots, powerKW: activity.requiredEnergyKWh / (activity.durationSlots * .5), accepted: false, version: 1, data_source: "simulation" })),
    events: [{ ...base.events[0], objective, status: "draft", windowStart: objective === "protect" ? 20 : 26, windowEnd: objective === "protect" ? 24 : 30 }],
  };
}

describe("event orchestration", () => {
  it("does not create a reward offer for an unchanged baseline window", () => {
    const scenario = createDemoScenario();
    const baseline = { ...scenario, schedules: scenario.schedules.map((schedule) => schedule.activityId === scenario.activities[0].id ? { ...schedule, startSlot: scenario.activities[0].baselineStart, endSlot: scenario.activities[0].baselineStart + scenario.activities[0].durationSlots } : schedule), events: [{ ...scenario.events[0], status: "draft" as const, windowStart: scenario.activities[0].baselineStart, windowEnd: scenario.activities[0].baselineStart + scenario.activities[0].durationSlots }] };
    const published = publishEvent(baseline, baseline.events[0].id);
    expect(published.offers.some((offer) => offer.activityId === scenario.activities[0].id)).toBe(false);
  });

  it("keeps accepted state separate and reports the event funnel", () => {
    const scenario = createDemoScenario();
    const published = publishEvent({ ...scenario, events: scenario.events.map((event) => ({ ...event, status: "draft" as const })) }, "event-absorb-demo");
    const offer = published.offers[0];
    const accepted = decideOffer(published, offer.id, "accept");
    const report = eventReport(accepted, "event-absorb-demo");
    expect(accepted.activities.find((activity) => activity.id === offer.activityId)?.status).toBe("accepted");
    expect(report.funnel.accepted).toBe(1);
    expect(report.funnel.verified).toBe(0);
  });

  it("counts verification and shifted energy from the offer-keyed result", () => {
    const scenario = createDemoScenario();
    const published = publishEvent({ ...scenario, events: scenario.events.map((event) => ({ ...event, status: "draft" as const })) }, "event-absorb-demo");
    const offer = published.offers[0];
    const accepted = decideOffer(published, offer.id, "accept");
    const withResult = {
      ...accepted,
      results: {
        [offer.id]: {
          activityId: offer.activityId,
          outcome: "verified" as const,
          requiredEnergyKWh: 8,
          recordedEnergyKWh: 8,
          eligibleShiftedKWh: 8,
          acceptedWindow: { startSlot: offer.proposedStart, endSlot: offer.proposedEnd },
          reason: "Reading matched the accepted window.",
          data_source: "simulation" as const,
          createdAt: "2026-09-12T16:00:00+05:30",
        },
      },
    };
    const report = eventReport(withResult, offer.eventId);
    expect(report.funnel.verified).toBe(1);
    expect(report.shiftedKWh).toBe(8);
    expect(report.verifiedKW).toBe(4);
  });

  it("supports a version-checked modify decision", () => {
    const base = eventScenario("absorb");
    const scenario = publishEvent({ ...base, events: [{ ...base.events[0], windowEnd: 34 }] }, base.events[0].id);
    const offer = scenario.offers[0];
    const alternative = offer.proposedStart === 26 ? 27 : 26;
    const modified = decideOffer(scenario, offer.id, "modify", alternative, offer.version);
    expect(modified.offers[0].decision).toBe("modify");
    expect(modified.offers[0].version).toBe(offer.version + 1);
    expect(modified.schedules[0].accepted).toBe(false);
    expect(modified.activities[0].status).toBe("recommended");
    expect(() => decideOffer(scenario, offer.id, "accept", undefined, offer.version + 1)).toThrow("Offer changed");
  });

  it("moves Protect baseline demand entirely outside the event window", () => {
    const scenario = eventScenario("protect");
    const published = publishEvent(scenario, scenario.events[0].id);
    expect(published.offers).toHaveLength(1);
    const offer = published.offers[0];
    expect(offer.proposedEnd <= 20 || offer.proposedStart >= 24).toBe(true);
    expect(offer.originalStart).toBe(20);
    expect(offer.proposedStart).toBeGreaterThanOrEqual(18);
    expect(offer.proposedEnd).toBeLessThanOrEqual(34);
    expect(offer.rewardEstimate).toBe(12);
    const accepted = decideOffer(published, offer.id, "accept", undefined, offer.version);
    expect(accepted.schedules[0].accepted).toBe(true);
    expect(() => decideOffer(published, offer.id, "modify", 21, offer.version)).toThrow("outside the protected period");
  });

  it("does not offer Protect rewards to loads whose baseline misses the peak", () => {
    const scenario = eventScenario("protect");
    const outside = { ...scenario, activities: scenario.activities.map((activity) => ({ ...activity, baselineStart: 26 })) };
    expect(publishEvent(outside, outside.events[0].id).offers).toHaveLength(0);
  });

  it("leaves a load without an offer when no safe outside-peak window exists", () => {
    const scenario = eventScenario("protect");
    const constrained = { ...scenario, activities: scenario.activities.map((activity) => ({ ...activity, earliestStart: 20, latestFinish: 24 })) };
    expect(publishEvent(constrained, constrained.events[0].id).offers).toHaveLength(0);
  });

  it("keeps Absorb proposals inside the event and rejects changing back to baseline", () => {
    const scenario = eventScenario("absorb");
    const published = publishEvent(scenario, scenario.events[0].id);
    const offer = published.offers[0];
    expect(offer.proposedStart).toBe(26);
    expect(offer.proposedEnd).toBe(30);
    expect(() => decideOffer(published, offer.id, "modify", 27, offer.version)).toThrow("inside the renewable-rich event period");
    expect(() => decideOffer(published, offer.id, "modify", offer.originalStart, offer.version)).toThrow("unchanged baseline");
  });

  it("does not pay for moving a task already fully inside the Absorb period", () => {
    const scenario = eventScenario("absorb");
    const aligned = { ...scenario, activities: scenario.activities.map((activity) => ({ ...activity, baselineStart: 27 })), events: [{ ...scenario.events[0], windowEnd: 34 }] };
    expect(publishEvent(aligned, aligned.events[0].id).offers).toHaveLength(0);
  });

  it("does not publish rewards beyond the event budget", () => {
    const scenario = eventScenario("absorb");
    const underfunded = { ...scenario, events: [{ ...scenario.events[0], budget: 11 }] };
    expect(publishEvent(underfunded, underfunded.events[0].id).offers).toHaveLength(0);
  });

  it("respects an event maximum participation cap", () => {
    const scenario = eventScenario("absorb");
    const capped = { ...scenario, activities: [scenario.activities[0], { ...scenario.activities[0], id: "second-activity", name: "Second load", baselineStart: 20 }] , events: [{ ...scenario.events[0], maxParticipants: 1 }], schedules: scenario.schedules.map((schedule) => schedule.activityId === scenario.activities[0].id ? schedule : { ...schedule, activityId: "second-activity" }) };
    expect(publishEvent(capped, capped.events[0].id).offers).toHaveLength(1);
  });

  it("enforces requested flexibility as an instantaneous kW cap while allowing non-overlap", () => {
    const base = eventScenario("absorb", [
      { ...createDemoScenario().activities[0], id: "first", baselineStart: 20, earliestStart: 18, latestFinish: 34, status: "recommended" },
      { ...createDemoScenario().activities[0], id: "second", baselineStart: 20, earliestStart: 18, latestFinish: 34, status: "recommended" },
    ]);
    const constrainedEvent = { ...base.events[0], windowStart: 26, windowEnd: 34, requestedFlexibilityKW: 4 };
    const published = publishEvent({ ...base, events: [constrainedEvent] }, constrainedEvent.id);
    // Each 4 kW load can use the target sequentially, but two overlapping
    // commitments may never exceed the event's instantaneous request.
    expect(published.offers.length).toBeGreaterThan(0);
    expect(eventProjectedFlexibilityKW(published, constrainedEvent.id)).toBeLessThanOrEqual(4);
    expect(eventCommittedFlexibilityKW(published, constrainedEvent.id)).toBeLessThanOrEqual(4);
    const first = published.offers[0];
    const accepted = decideOffer(published, first.id, "accept", undefined, first.version);
    const second = accepted.offers.find((offer) => offer.id !== first.id);
    if (second) {
      expect(() => decideOffer(accepted, second.id, "accept", first.proposedStart, second.version)).toThrow("requested flexibility capacity");
    }
  });

  it("caps Protect relief at the frozen baseline peak, not the replacement window", () => {
    const seed = createDemoScenario();
    const first = { ...seed.activities[0], id: "protect-first", baselineStart: 20, earliestStart: 18, latestFinish: 34, status: "recommended" as const };
    const second = { ...seed.activities[0], id: "protect-second", baselineStart: 20, earliestStart: 18, latestFinish: 34, status: "recommended" as const };
    const base = eventScenario("protect", [first, second]);
    const event = { ...base.events[0], windowStart: 20, windowEnd: 24, requestedFlexibilityKW: 4 };
    const published = publishEvent({ ...base, events: [event] }, event.id);
    expect(published.offers).toHaveLength(1);
    expect(eventProjectedFlexibilityKW(published, event.id)).toBe(4);
  });

  it("rejects expired decisions at an injected time but keeps replay decisions deterministic", () => {
    const base = createDemoScenario();
    const offer = base.offers[0];
    expect(isOfferExpired(base, offer, "2026-09-12T15:59:59+05:30")).toBe(false);
    expect(isOfferExpired(base, offer, "2026-09-12T16:00:00+05:30")).toBe(true);
    expect(() => decideOffer(base, offer.id, "accept", undefined, offer.version, "2026-09-12T16:00:00+05:30")).toThrow("expired");
    // The fixed replay clock is before the seeded 16:00 expiry, regardless of
    // the host date on which the test is run.
    expect(() => decideOffer(base, offer.id, "accept", undefined, offer.version)).not.toThrow();
  });

  it("does not publish offers for paused activities", () => {
    const scenario = createDemoScenario();
    const paused = { ...scenario, activities: scenario.activities.map((activity, index) => index === 0 ? { ...activity, status: "paused" as const } : activity), offers: [], events: scenario.events.map((event) => ({ ...event, status: "draft" as const })) };
    const published = publishEvent(paused, "event-absorb-demo");
    expect(published.offers.some((offer) => offer.activityId === paused.activities[0].id)).toBe(false);
  });

  it("uses the same participant-level eligibility rules in previews and publication", () => {
    const scenario = createDemoScenario();
    const event = { ...scenario.events[0], status: "draft" as const };
    const pausedId = scenario.activities[1].id;
    const committedId = scenario.activities[2].id;
    const prepared = {
      ...scenario,
      events: [event],
      activities: scenario.activities.map((activity) => activity.id === pausedId ? { ...activity, status: "paused" as const } : activity),
      schedules: scenario.schedules.map((schedule) => schedule.activityId === committedId ? { ...schedule, accepted: true } : schedule),
    };
    const eligible = eventEligibleActivities(prepared, event);
    const published = publishEvent(prepared, event.id);
    expect(eligible.map((activity) => activity.id)).toEqual([scenario.activities[0].id]);
    expect(published.offers.map((offer) => offer.activityId)).toEqual([scenario.activities[0].id]);
  });

  it("projects shifted energy independently when an event has no cash reward rate", () => {
    const scenario = eventScenario("absorb");
    const event = { ...scenario.events[0], rewardRatePerKWh: 0, budget: 0 };
    const published = publishEvent({ ...scenario, events: [event] }, event.id);
    expect(published.offers).toHaveLength(1);
    expect(published.offers[0].rewardEstimate).toBe(0);
    expect(eventProjectedShiftedEnergyKWh(published, event.id)).toBeGreaterThan(0);
    expect(() => decideOffer(published, published.offers[0].id, "accept", undefined, published.offers[0].version)).not.toThrow();
  });

  it("rechecks the active event, budget and capacity at acceptance", () => {
    const scenario = eventScenario("absorb");
    const published = publishEvent(scenario, scenario.events[0].id);
    const offer = published.offers[0];
    const closed = { ...published, events: [{ ...published.events[0], status: "closed" as const }] };
    expect(() => decideOffer(closed, offer.id, "accept", undefined, offer.version)).toThrow("not active");
    const underfunded = { ...published, events: [{ ...published.events[0], budget: 11 }] };
    expect(() => decideOffer(underfunded, offer.id, "accept", undefined, offer.version)).toThrow("budget is exhausted");
    const constrained = { ...published, sitePowerLimitKW: 1 };
    expect(() => decideOffer(constrained, offer.id, "accept", undefined, offer.version)).toThrow("equipment or site power limit");
    expect(decideOffer(closed, offer.id, "skip", undefined, offer.version).offers[0].decision).toBe("skip");
  });

  it("preserves accepted commitments when publishing another event", () => {
    const scenario = eventScenario("absorb");
    const published = publishEvent(scenario, scenario.events[0].id);
    const accepted = decideOffer(published, published.offers[0].id, "accept");
    const next = { ...accepted, events: [...accepted.events, { ...accepted.events[0], id: "another-event", status: "draft" as const }] };
    const replanned = publishEvent(next, "another-event");
    expect(replanned.schedules).toEqual(accepted.schedules);
    expect(replanned.offers.filter((offer) => offer.eventId === "another-event")).toHaveLength(0);
  });

  it("does not erase an accepted commitment when a different offer is skipped", () => {
    const scenario = eventScenario("absorb");
    const published = publishEvent(scenario, scenario.events[0].id);
    const accepted = decideOffer(published, published.offers[0].id, "accept");
    const duplicateOffer = { ...published.offers[0], id: "other-pending-offer", eventId: "another-event" };
    const withAnotherOffer = { ...accepted, offers: [...accepted.offers, duplicateOffer] };
    const skipped = decideOffer(withAnotherOffer, duplicateOffer.id, "skip");
    expect(skipped.activities[0].status).toBe("accepted");
    expect(skipped.schedules[0].accepted).toBe(true);
  });

  it("records an opt-out recovery gap and preserves voluntary replacement options", () => {
    const seeded = createDemoScenario();
    const offer = seeded.offers.find((item) => item.activityId === "activity-ev")!;
    const accepted = decideOffer(seeded, offer.id, "accept", undefined, offer.version);
    const recovered = repairSchedule(accepted, offer.activityId, "2026-09-12T12:00:00+05:30");
    const released = recovered.offers.find((item) => item.id === offer.id)!;
    expect(released.decision).toBe("override");
    expect(recovered.schedules.find((item) => item.activityId === offer.activityId)?.accepted).toBe(false);
    expect(recovered.recovery).toHaveLength(1);
    expect(recovered.recovery?.[0]).toMatchObject({ eventId: offer.eventId, lostActivityId: offer.activityId, lostPowerKW: 4, unresolvedGapKW: expect.any(Number) });
    expect(recovered.recovery?.[0].replacementOfferIds.every((id) => recovered.offers.some((item) => item.id === id && ["pending", "modify"].includes(item.decision)))).toBe(true);
  });

  it("prices Protect rewards only for baseline energy removed from the peak", () => {
    const scenario = eventScenario("protect");
    const narrowPeak = { ...scenario, events: [{ ...scenario.events[0], windowStart: 21, windowEnd: 22 }] };
    const offer = publishEvent(narrowPeak, narrowPeak.events[0].id).offers[0];
    expect(offer.rewardEstimate).toBe(3); // One half-hour of a 4 kW load, at ₹1.50/kWh.
  });

  it("rejects an accepted shift that would overload an unaccepted baseline load", () => {
    const base = createDemoScenario();
    const offer = base.offers.find((item) => item.activityId === "activity-ev");
    if (!offer) throw new Error("Fixture must contain an EV offer.");
    const targetStart = offer.proposedStart;
    const other = { ...base.activities.find((item) => item.id === "activity-water")!, baselineStart: targetStart, status: "skipped" as const };
    const target = base.activities.find((item) => item.id === offer.activityId)!;
    const targetPower = target.requiredEnergyKWh / (target.durationSlots * 0.5);
    const otherPower = other.requiredEnergyKWh / (other.durationSlots * 0.5);
    const forecast = base.forecast.map((slot) => slot.index >= targetStart && slot.index < offer.proposedEnd ? { ...slot, fixedDemandKW: 5 } : slot);
    const schedules = base.schedules.map((schedule) => schedule.activityId === other.id ? { ...schedule, startSlot: 0, endSlot: other.durationSlots, accepted: false } : schedule);
    const constrained = { ...base, forecast, activities: base.activities.map((item) => item.id === other.id ? other : item), schedules, sitePowerLimitKW: 5 + targetPower + otherPower - 0.1 };
    expect(() => decideOffer(constrained, offer.id, "accept", undefined, offer.version)).toThrow("equipment or site power limit");
  });

  it("reports pending evidence once per accepted offer until verification settles", () => {
    const base = createDemoScenario();
    const offer = base.offers[0];
    const accepted = decideOffer(base, offer.id, "accept", undefined, offer.version);
    const readings = [0, 1].map((slot) => ({ id: `reading-${slot}`, eventId: offer.eventId, activityId: offer.activityId, deviceId: "simulator", timestamp: `${accepted.date ?? "2026-09-12"}T00:0${slot}:00+05:30`, cumulativeKWh: slot, serviceComplete: false, readingKey: `key-${slot}`, data_source: "simulation" as const }));
    expect(eventReport({ ...accepted, readings }, offer.eventId).pendingReadings).toBe(1);
    expect(eventReport({ ...accepted, readings: [] }, offer.eventId).pendingReadings).toBe(1);
  });

  it("validates event expiry against the deterministic scenario decision clock", () => {
    const scenario = createDemoScenario();
    const event = { ...scenario.events[0], status: "draft" as const, offerExpiresAt: "2026-09-12T08:00:00+05:30" };
    expect(() => validateEvent(scenario, event)).toThrow("after the scenario decision time");
    expect(() => publishEvent({ ...scenario, events: [event] }, event.id)).toThrow("after the scenario decision time");
  });

  it("reports the operator fields needed to reconcile an event", () => {
    const scenario = createDemoScenario();
    const published = publishEvent({ ...scenario, events: scenario.events.map((event) => ({ ...event, status: "draft" as const })) }, "event-absorb-demo");
    const offer = published.offers[0];
    const accepted = decideOffer(published, offer.id, "accept", undefined, offer.version);
    const report = eventReport(accepted, offer.eventId);
    expect(report).toMatchObject({ requestedKW: 10, acceptedKW: 4, verifiedKW: 0, shiftedKWh: 0, renewableAlignedConsumptionKWh: 0, participantCount: 1, pendingRewardCost: offer.rewardEstimate, disputedActivities: 0, unresolvedGapKW: 10 });
    expect(report.peakReductionKW).toBeGreaterThanOrEqual(0);
  });
});
