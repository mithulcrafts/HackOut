import { describe, expect, it } from "vitest";
import { createDemoScenario } from "@/domain/fixtures";
import { demoNotifications } from "./consumer-server";
import { markDemoNotificationsRead } from "./demo-preferences";

describe("demo notification lifecycle", () => {
  it("marks the current snapshot read while surfacing a later state change", () => {
    const session = `notification-test-${Date.now()}`;
    const scenario = createDemoScenario();
    const initial = demoNotifications(session, scenario);
    expect(initial.length).toBeGreaterThan(0);
    markDemoNotificationsRead(session, initial.map(item => item.id));
    expect(demoNotifications(session, scenario).every(item => item.read_at)).toBe(true);

    const offer = scenario.offers[0];
    offer.decision = "accept";
    scenario.results = { [offer.id]: { outcome: "verified", recordedEnergyKWh: 8, eligibleShiftedKWh: 8, reason: "Verified", createdAt: new Date().toISOString(), activityId: offer.activityId, requiredEnergyKWh: 8, acceptedWindow: { startSlot: 26, endSlot: 30 }, data_source: "simulation" } };
    const changed = demoNotifications(session, scenario);
    expect(changed.some(item => item.id.endsWith(":verified") && !item.read_at)).toBe(true);
  });
});
