import { describe, expect, it } from "vitest";
import { createDemoScenario } from "@/domain/fixtures";
import { decideOffer } from "@/domain/events";
import type { Activity } from "@/domain/types";
import { activityToDomain, addActivityToScenario, scheduleSavedActivities } from "./activity-integration";
import { scheduleDemoActivity } from "./demo-activities";

const saved = { id: "custom-a", name: "Laundry batch", type: "Custom", earliest_start: "10:00", latest_finish: "17:00", duration_minutes: 60, interruptible: false, status: "recommended", power_kw: 1 };
describe("saved activity scheduling bridge", () => {
  it("requires valid timing and explicit custom power", () => {
    expect(activityToDomain(saved)?.type).toBe("custom");
    expect(activityToDomain({ ...saved, power_kw: undefined })).toBeNull();
    expect(activityToDomain({ ...saved, earliest_start: "10:15" })).toBeNull();
    expect(activityToDomain({ ...saved, power_kw: -1 })).toBeNull();
    expect(activityToDomain({ ...saved, required_kwh: 100 })).toBeNull();
  });
  it("retains other loads and links custom activities to an eligible event", () => {
    const scenario = createDemoScenario();
    const updated = addActivityToScenario(saved, scenario);
    expect(updated.activities).toHaveLength(scenario.activities.length + 1);
    expect(updated.offers.some((entry) => entry.activityId === saved.id)).toBe(true);
    const blocked = scheduleSavedActivities([saved], { ...scenario, sitePowerLimitKW: 0 });
    expect(blocked[0].startSlot).toBeNull();
    expect(blocked[0].reason).toContain("No safe window");
  });

  it("keeps existing event commitments in the cap when adding an activity", () => {
    const seeded = createDemoScenario();
    const evOffer = seeded.offers.find((offer) => offer.activityId === "activity-ev");
    if (!evOffer) throw new Error("Fixture must contain an EV offer.");
    const accepted = decideOffer(seeded, evOffer.id, "accept", undefined, evOffer.version);
    const event = accepted.events.find((item) => item.id === evOffer.eventId);
    if (!event) throw new Error("Fixture must contain the EV event.");
    const focused: typeof accepted = {
      ...accepted,
      forecast: accepted.forecast.map((slot) => ({ ...slot, fixedDemandKW: 0, renewableKW: 20, solarKW: 20, windKW: 0 })),
      sitePowerLimitKW: 20,
      activities: accepted.activities.filter((activity) => activity.id === "activity-ev"),
      schedules: accepted.schedules.filter((schedule) => schedule.activityId === "activity-ev"),
      offers: accepted.offers.filter((offer) => offer.id === evOffer.id),
      events: accepted.events.map((item) => item.id === event.id ? { ...item, eligibleActivityTypes: ["custom" as const], requestedFlexibilityKW: 10 } : item),
    };
    const custom: Activity = { id: "activity-custom-cap", name: "Custom load", type: "custom", requiredEnergyKWh: 14, earliestStart: evOffer.proposedStart, latestFinish: evOffer.proposedEnd, powerLimitKW: 7, durationSlots: 2, interruptible: true, baselineStart: evOffer.proposedStart, status: "recommended" };
    const result = scheduleDemoActivity(focused, custom);
    expect(result.offer).toBeNull();
    expect(result.message).toContain("No safe reward window");
  });
});
