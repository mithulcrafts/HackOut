import { describe, expect, it } from "vitest";
import { createDemoScenario } from "./fixtures";
import { effectiveSchedules, summarizeScenario } from "./summary";

describe("operator summary", () => {
  it("keeps baseline demand when offers are only recommendations", () => {
    const scenario = createDemoScenario();
    const unaccepted = { ...scenario, schedules: scenario.schedules.map((schedule) => ({ ...schedule, accepted: false })) };
    const summary = summarizeScenario(unaccepted);
    expect(effectiveSchedules(unaccepted)).toHaveLength(unaccepted.activities.length);
    expect(summary.scheduledPeakKW).toBe(summary.baselinePeakKW);
    expect(summary.acceptedKW).toBe(0);
  });

  it("moves an accepted activity once while conserving its energy", () => {
    const scenario = createDemoScenario();
    const activity = scenario.activities[0];
    const schedules = scenario.schedules.map((schedule) => schedule.activityId === activity.id
      ? { ...schedule, startSlot: activity.earliestStart, endSlot: activity.earliestStart + activity.durationSlots, accepted: true }
      : { ...schedule, accepted: false });
    const shifted = { ...scenario, schedules };
    const effective = effectiveSchedules(shifted);
    const representedEnergy = effective.reduce((sum, schedule) => sum + schedule.powerKW * (schedule.endSlot - schedule.startSlot) * 0.5, 0);
    const requiredEnergy = shifted.activities.reduce((sum, item) => sum + item.requiredEnergyKWh, 0);
    expect(representedEnergy).toBeCloseTo(requiredEnergy, 5);
    expect(effective.filter((schedule) => schedule.activityId === activity.id)).toHaveLength(1);
    expect(summarizeScenario(shifted).acceptedKW).toBeCloseTo(schedules.find((schedule) => schedule.activityId === activity.id)!.powerKW, 5);
  });

  it("uses verified eligible energy for response capacity and leaves the gap visible", () => {
    const scenario = createDemoScenario();
    const activity = scenario.activities[0];
    const accepted = scenario.schedules.map((schedule) => schedule.activityId === activity.id ? { ...schedule, accepted: true } : { ...schedule, accepted: false });
    const withResult = {
      ...scenario,
      schedules: accepted,
      results: {
        [scenario.offers[0].id]: {
          activityId: activity.id,
          outcome: "verified" as const,
          requiredEnergyKWh: activity.requiredEnergyKWh,
          recordedEnergyKWh: activity.requiredEnergyKWh,
          acceptedWindow: { startSlot: accepted.find((schedule) => schedule.activityId === activity.id)!.startSlot, endSlot: accepted.find((schedule) => schedule.activityId === activity.id)!.endSlot },
          eligibleShiftedKWh: 4,
          reason: "verified",
          data_source: "simulation" as const,
          createdAt: "2026-09-12T10:00:00.000Z",
        },
      },
    };
    const summary = summarizeScenario(withResult);
    expect(summary.verifiedKW).toBeCloseTo(2, 5);
    expect(summary.unresolvedGapKW).toBeCloseTo(Math.max(0, accepted.find((schedule) => schedule.activityId === activity.id)!.powerKW - 2), 5);
  });
});
