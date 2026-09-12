import { describe, expect, it } from "vitest";
import { createDemoScenario } from "./fixtures";
import { decideOffer, eventReport, publishEvent } from "./events";

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

  it("supports a version-checked modify decision", () => {
    const scenario = createDemoScenario();
    const offer = scenario.offers[0];
    const modified = decideOffer(scenario, offer.id, "modify", offer.proposedStart + 1, offer.version);
    expect(modified.offers[0].decision).toBe("modify");
    expect(modified.offers[0].version).toBe(offer.version + 1);
    expect(() => decideOffer(scenario, offer.id, "accept", undefined, offer.version + 1)).toThrow("Offer changed");
  });
});
