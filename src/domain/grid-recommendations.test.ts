import { describe, expect, it } from "vitest";
import { createDemoScenario } from "./fixtures";
import { rankGridRecommendations } from "./grid-recommendations";

describe("rankGridRecommendations", () => {
  it("returns transparent ranked actions for a selected slot", () => {
    const scenario = createDemoScenario();
    scenario.battery = { ...scenario.battery, currentKWh: scenario.battery.capacityKWh };
    const results = rankGridRecommendations(scenario, 26);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThanOrEqual(results.at(-1)!.score);
    expect(results[0].factors.map((factor) => factor.label)).toEqual(["Grid urgency", "Feasibility", "Expected relief"]);
    expect(results.every((item) => item.caveats.some((caveat) => caveat.includes("Cost impact")))).toBe(true);
  });

  it("does not count an accepted activity as movable capacity twice", () => {
    const scenario = createDemoScenario();
    scenario.schedules = scenario.schedules.map((entry) => ({ ...entry, accepted: true }));
    const results = rankGridRecommendations(scenario, 26).filter((item) => item.action === "shift_demand");
    expect(results[0]?.impact.powerKW ?? 0).toBe(0);
  });

  it("offers storage and an escalation path for a deficit", () => {
    const scenario = createDemoScenario();
    scenario.battery.currentKWh = scenario.battery.capacityKWh;
    scenario.forecast = scenario.forecast.map((slot, index) => index === 30 ? { ...slot, renewableKW: 0, solarKW: 0, windKW: 0, fixedDemandKW: 12 } : slot);
    const results = rankGridRecommendations(scenario, 30);
    expect(results.some((item) => item.action === "discharge_battery")).toBe(true);
    expect(results.some((item) => item.action === "import_backup_review")).toBe(true);
  });

  it("separates a site overload from a renewable deficit", () => {
    const scenario = createDemoScenario();
    scenario.sitePowerLimitKW = 5;
    const results = rankGridRecommendations(scenario, 26);
    expect(results.some((item) => item.action === "site_capacity_review")).toBe(true);
    expect(results.filter((item) => item.action === "import_backup_review")).toHaveLength(0);
    expect(results.some((item) => item.caveats.some((caveat) => caveat.includes("site overload")))).toBe(true);
  });

  it.each(["skipped", "completed", "verified", "failed", "paused"] as const)("does not count a %s activity as movable flexibility", (status) => {
    const scenario = createDemoScenario();
    scenario.activities = scenario.activities.map((activity) => ({ ...activity, status }));
    const results = rankGridRecommendations(scenario, 26);
    expect(results.some((item) => item.action === "shift_demand")).toBe(false);
  });

  it("requires a matching active event and a renewable-safe full activity window", () => {
    const scenario = createDemoScenario();
    scenario.activities = scenario.activities.map((activity, index) => ({ ...activity, status: index === 0 ? "recommended" as const : "paused" as const }));
    scenario.events = scenario.events.map((event) => ({ ...event, eligibleActivityTypes: ["water_heater"] }));
    expect(rankGridRecommendations(scenario, 26).some((item) => item.action === "shift_demand")).toBe(false);

    scenario.events = scenario.events.map((event) => ({ ...event, eligibleActivityTypes: ["ev"] }));
    scenario.forecast = scenario.forecast.map((slot) => slot.index === 27 ? { ...slot, renewableKW: 0, solarKW: 0, windKW: 0 } : slot);
    expect(rankGridRecommendations(scenario, 26).some((item) => item.action === "shift_demand")).toBe(false);
  });
});
