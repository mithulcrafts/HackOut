import { describe, expect, it } from "vitest";
import { createDemoScenario } from "../fixtures";
import type { Activity } from "../types";
import { previewForecast } from "./preview";

function activity(id: string, status: Activity["status"]): Activity {
  return {
    id,
    name: id,
    type: "custom",
    requiredEnergyKWh: 2,
    earliestStart: 0,
    latestFinish: 1,
    powerLimitKW: 4,
    durationSlots: 1,
    interruptible: true,
    baselineStart: 0,
    status,
  };
}

describe("forecast preview occupancy", () => {
  it("keeps a non-candidate activity at its physical baseline when planning proposals", () => {
    const scenario = createDemoScenario();
    scenario.activities = [activity("candidate", "recommended"), activity("existing", "skipped")];
    scenario.schedules = [];
    scenario.offers = [];
    scenario.sitePowerLimitKW = 10;
    scenario.forecast = scenario.forecast.map((slot) => ({ ...slot, fixedDemandKW: 3, renewableKW: 12, solarKW: 9, windKW: 3 }));
    const before = JSON.stringify(scenario);

    const preview = previewForecast(scenario, scenario.forecast);

    expect(preview.proposals).toHaveLength(0);
    expect(preview.unscheduled).toEqual([{ activityId: "candidate", reason: "No safe window meets the deadline and site power limit." }]);
    expect(preview.commitmentRisks).toContain(0);
    expect(JSON.stringify(scenario)).toBe(before);
  });
});
