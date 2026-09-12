import { describe, expect, it } from "vitest";
import { createDemoScenario } from "./fixtures";
import { decideOffer } from "./events";
import { recordSimulatedOffer, verifyScenarioOffer, verifyReadings } from "./playback";

function accepted() {
  const scenario = createDemoScenario();
  const offer = scenario.offers.find((item) => item.activityId === "activity-ev")!;
  return { scenario: decideOffer(scenario, offer.id, "accept", undefined, offer.version), offerId: offer.id };
}

describe("shared simulated meter verification and settlement", () => {
  it("completes all three sample activities using evidence with one reward per offer", () => {
    let scenario = createDemoScenario();
    expect(scenario.offers).toHaveLength(3);
    for (const offer of scenario.offers) {
      scenario = decideOffer(scenario, offer.id, "accept", undefined, offer.version);
      scenario = recordSimulatedOffer(scenario, offer.id, "success");
      scenario = verifyScenarioOffer(scenario, offer.id);
      expect(scenario.results?.[offer.id].outcome).toBe("verified");
      const event = scenario.events.find((item) => item.id === offer.eventId)!;
      expect(scenario.rewardLedger?.find((item) => item.offerId === offer.id)?.points).toBeLessThanOrEqual(Math.floor(offer.rewardEstimate / event.rewardRatePerKWh * 15));
      const ledger = scenario.rewardLedger;
      scenario = verifyScenarioOffer(scenario, offer.id);
      expect(scenario.rewardLedger).toBe(ledger);
    }
    expect(scenario.rewardLedger).toHaveLength(3);
    expect(scenario.rewardLedger!.reduce((sum, row) => sum + row.illustrativeRupees, 0)).toBeLessThanOrEqual(scenario.events[0].budget);
  });
  it("keeps missing evidence pending and can complete when readings arrive", () => {
    const { scenario, offerId } = accepted();
    const pending = verifyScenarioOffer(recordSimulatedOffer(scenario, offerId, "missing"), offerId);
    expect(pending.results?.[offerId].outcome).toBe("pending");
    expect(pending.rewardLedger).toHaveLength(0);
    const completed = verifyScenarioOffer(recordSimulatedOffer(pending, offerId, "success"), offerId);
    expect(completed.results?.[offerId].outcome).toBe("verified");
  });
  it.each(["partial", "late", "rebound"] as const)("does not pay a full reward for %s delivery", (outcome) => {
    const { scenario, offerId } = accepted();
    const checked = verifyScenarioOffer(recordSimulatedOffer(scenario, offerId, outcome), offerId);
    expect(checked.results?.[offerId].outcome).not.toBe("verified");
    expect(checked.rewardLedger).toHaveLength(0);
  });
  it("rejects replaying readings and unaccepted activities", () => {
    const { scenario, offerId } = accepted();
    const recorded = recordSimulatedOffer(scenario, offerId, "success");
    expect(() => recordSimulatedOffer(recorded, offerId, "success")).toThrow("already exist");
    expect(() => recordSimulatedOffer(createDemoScenario(), offerId, "success")).toThrow("Accept");
  });
  it("reviews reversed counters and leaves incomplete traces pending", () => {
    const { scenario, offerId } = accepted();
    const recorded = recordSimulatedOffer(scenario, offerId, "success");
    const activity = scenario.activities.find((item) => item.id === "activity-ev")!;
    const schedule = scenario.schedules.find((item) => item.activityId === activity.id)!;
    const reset = recorded.readings.map((r, i) => i === 30 ? { ...r, cumulativeKWh: -1 } : r);
    expect(verifyReadings(scenario.date, activity, schedule, reset).outcome).toBe("needs_review");
    expect(verifyReadings(scenario.date, activity, schedule, recorded.readings.filter((_, i) => i !== 29)).outcome).toBe("pending");
    expect(verifyReadings(scenario.date, activity, schedule, recorded.readings.slice(schedule.startSlot, schedule.endSlot + 1)).outcome).toBe("pending");
  });
  it("never settles more than remaining event funds", () => {
    const { scenario, offerId } = accepted();
    const capped = { ...scenario, events: scenario.events.map((event) => ({ ...event, budget: 2 })) };
    const checked = verifyScenarioOffer(recordSimulatedOffer(capped, offerId, "success"), offerId);
    expect(checked.rewardLedger?.[0].illustrativeRupees).toBe(2);
  });
});
