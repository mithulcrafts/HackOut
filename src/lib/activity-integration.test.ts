import { describe, expect, it } from "vitest";
import { createDemoScenario } from "@/domain/fixtures";
import { activityToDomain, addActivityToScenario, scheduleSavedActivities } from "./activity-integration";

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
});
