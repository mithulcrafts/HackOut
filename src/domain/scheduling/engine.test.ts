import { describe, expect, it } from "vitest";
import { createSyntheticForecast } from "../forecast/synthetic";
import { createSchedule, dispatchBattery, classifyBalance } from "./engine";
import { createDemoScenario } from "../fixtures";

describe("demand response energy engine", () => {
  it("creates 48 deterministic forecast slots with half-hour intervals", () => {
    const forecast = createSyntheticForecast();
    expect(forecast).toHaveLength(48);
    expect(forecast[0].data_source).toBe("simulation");
    expect(forecast[24].start).toBe("12:00");
  });

  it("keeps schedules within the deadline and site power limit", () => {
    const scenario = createDemoScenario();
    for (const schedule of scenario.schedules) {
      const activity = scenario.activities.find((item) => item.id === schedule.activityId)!;
      expect(schedule.endSlot).toBeLessThanOrEqual(activity.latestFinish);
      expect(schedule.startSlot).toBeGreaterThanOrEqual(activity.earliestStart);
      expect(schedule.powerKW).toBeLessThanOrEqual(scenario.sitePowerLimitKW);
    }
  });

  it("classifies positive and negative balance without mutating schedules", () => {
    const scenario = createDemoScenario();
    const before = structuredClone(scenario.schedules);
    const results = classifyBalance(scenario.forecast, scenario.schedules, scenario.sitePowerLimitKW);
    expect(results).toHaveLength(48);
    expect(results.some((result) => result.mode === "absorb")).toBe(true);
    expect(results.some((result) => result.mode === "protect")).toBe(true);
    expect(scenario.schedules).toEqual(before);
  });

  it("never exceeds battery limits or creates simultaneous actions", () => {
    const scenario = createDemoScenario();
    const dispatch = dispatchBattery(scenario.forecast, scenario.schedules, scenario.battery);
    expect(dispatch).toHaveLength(48);
    expect(dispatch.every((item) => item.stateOfChargeKWh >= 0 && item.stateOfChargeKWh <= scenario.battery.capacityKWh)).toBe(true);
    expect(dispatch.filter((item) => item.action === "charge" && item.mode === "protect")).toHaveLength(0);
  });

  it("reports a human-readable reason when no legal slot exists", () => {
    const forecast = createSyntheticForecast();
    const activity = { ...createDemoScenario().activities[0], earliestStart: 0, latestFinish: 1 };
    const result = createSchedule([activity], forecast, 18);
    expect(result.schedules).toHaveLength(0);
    expect(result.unscheduled[0].reason).toContain("No safe window");
  });

  it("includes fixed demand when enforcing the site power limit", () => {
    const forecast = createSyntheticForecast().map((slot) => ({ ...slot, fixedDemandKW: 17.5 }));
    const activity = { ...createDemoScenario().activities[0], earliestStart: 20, latestFinish: 24, durationSlots: 2, requiredEnergyKWh: 4, powerLimitKW: 4 };
    const result = createSchedule([activity], forecast, 18);
    expect(result.schedules).toHaveLength(0);
    expect(result.unscheduled[0].reason).toContain("No safe window");
  });

  it("keeps battery dispatch bounded for an invalid efficiency input", () => {
    const scenario = createDemoScenario();
    const dispatch = dispatchBattery(scenario.forecast, scenario.schedules, { ...scenario.battery, roundTripEfficiency: 0 });
    expect(dispatch.every((item) => item.stateOfChargeKWh >= 0 && item.stateOfChargeKWh <= scenario.battery.capacityKWh)).toBe(true);
  });
});
