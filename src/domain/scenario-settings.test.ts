import { describe, expect, it } from "vitest";
import { createDemoScenario } from "./fixtures";
import { applyScenarioSettings } from "./scenario-settings";

function settings() {
  return {
    sitePowerLimitKW: 24,
    batteryCapacityKWh: 12,
    batteryCurrentKWh: 5,
    maxChargeKW: 4,
    maxDischargeKW: 4,
    roundTripEfficiency: 0.9,
    rewardRatePerKWh: 2,
    draftEventBudget: 400,
  };
}

describe("applyScenarioSettings", () => {
  it("updates operating limits while preserving published event terms", () => {
    const scenario = createDemoScenario();
    const updated = applyScenarioSettings(scenario, settings());
    expect(updated.sitePowerLimitKW).toBe(24);
    expect(updated.battery).toMatchObject({ capacityKWh: 12, currentKWh: 5, maxChargeKW: 4, maxDischargeKW: 4 });
    expect(updated.events.filter((event) => event.status !== "draft")).toEqual(scenario.events.filter((event) => event.status !== "draft"));
    expect(updated.events.filter((event) => event.status === "draft").every((event) => event.budget === 400 && event.rewardRatePerKWh === 2)).toBe(true);
  });

  it("rejects an impossible battery state of charge", () => {
    expect(() => applyScenarioSettings(createDemoScenario(), { ...settings(), batteryCapacityKWh: 4, batteryCurrentKWh: 5 })).toThrow(/cannot exceed/i);
  });

  it("rejects a site limit below fixed demand", () => {
    expect(() => applyScenarioSettings(createDemoScenario(), { ...settings(), sitePowerLimitKW: 1 })).toThrow(/fixed demand/i);
  });
});
