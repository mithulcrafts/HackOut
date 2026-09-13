import { describe, expect, it } from "vitest";
import { createDemoScenario } from "@/domain/fixtures";
import type { ConsumerState } from "./consumer";
import { syncConsumerToOperator } from "./consumer-integration";
import { getScenario, setScenario, OPERATOR_SHARED_SESSION } from "./demo-store";

const acceptedState: ConsumerState = {
  offer: { id: "db-offer", name: "Scooter", version: 2, decision: "accepted", baseline_start: 20, proposed_start: 26, duration_slots: 4, deadline_slot: 34, required_kwh: 8, power_kw: 4, simulation_run: true, completion_slot: 30 },
  readings: [{ slot: 0, cumulative_kwh: 0 }, { slot: 48, cumulative_kwh: 8 }],
  verification: { status: "verified", reason: "Authoritative RPC result", recorded_kwh: 8, eligible_kwh: 8, baseline_kwh: 0, created_at: "2026-09-13T10:00:00+05:30" },
  rewards: [{ id: "db-reward", points: 80, illustrative_rupees: 4, state: "verified", created_at: "2026-09-13T10:00:00+05:30" }],
  notifications: [],
};

describe("authenticated consumer projection", () => {
  it("keeps each user's operator simulation namespace isolated", async () => {
    const first = await syncConsumerToOperator("load", acceptedState, "user-one");
    const second = await syncConsumerToOperator("load", { ...acceptedState, readings: [], rewards: [] }, "user-two");
    const firstScenario = getScenario(first);
    const secondScenario = getScenario(second);
    expect(first).toBe("operator-user-one");
    expect(second).toBe("operator-user-two");
    expect(firstScenario.readings).toHaveLength(2);
    expect(firstScenario.rewardLedger?.[0]?.illustrativeRupees).toBe(4);
    expect(firstScenario.schedules.find((entry) => entry.activityId === "activity-ev")).toMatchObject({ startSlot: 26, endSlot: 30, powerKW: 4, accepted: true });
    expect(firstScenario.activities.find((entry) => entry.id === "activity-ev")).toMatchObject({ baselineStart: 20, durationSlots: 4, powerLimitKW: 4, requiredEnergyKWh: 8 });
    expect(secondScenario.readings).toHaveLength(0);
    expect(secondScenario.rewardLedger ?? []).toHaveLength(0);
  });

  it("publishes the consumer projection to the authenticated operator programme view", async () => {
    await syncConsumerToOperator("load", acceptedState, "consumer-account");
    const operatorScenario = getScenario(OPERATOR_SHARED_SESSION);
    expect(operatorScenario.offers.find((offer) => offer.activityId === "activity-ev")).toMatchObject({ decision: "accept", proposedStart: 26 });
    expect(operatorScenario.readings).toHaveLength(2);
    expect(operatorScenario.results?.[operatorScenario.offers[0].id]?.outcome).toBe("verified");
    expect(operatorScenario.rewardLedger?.[0]).toMatchObject({ points: 80, illustrativeRupees: 4, state: "verified" });
  });

  it("does not invent readings or rewards when the authoritative snapshot has none", async () => {
    const session = "operator-empty-user";
    setScenario(session, createDemoScenario());
    const state: ConsumerState = { ...acceptedState, readings: [], verification: null, rewards: [] };
    await syncConsumerToOperator("load", state, "empty-user");
    const scenario = getScenario(session);
    expect(scenario.readings).toHaveLength(0);
    expect(scenario.rewardLedger ?? []).toHaveLength(0);
  });

  it("clears a verified projection on reset and mirrors a changed accepted window", async () => {
    await syncConsumerToOperator("load", acceptedState, "reset-user");
    await syncConsumerToOperator("reset", { ...acceptedState, offer: null, readings: [], verification: null, rewards: [] }, "reset-user");
    const reset = getScenario("operator-reset-user");
    expect(Object.keys(reset.results ?? {})).toHaveLength(0);
    expect(reset.offers.find((item) => item.activityId === "activity-ev")?.decision).toBe("pending");
    expect(reset.schedules.find((item) => item.activityId === "activity-ev")?.accepted).toBe(false);
    await syncConsumerToOperator("accept", { ...acceptedState, offer: { ...acceptedState.offer!, version: 3, proposed_start: 28 }, readings: [], verification: null, rewards: [] }, "reset-user");
    const scenario = getScenario("operator-reset-user");
    const offer = scenario.offers.find((item) => item.activityId === "activity-ev");
    expect(offer?.decision).toBe("accept");
    expect(offer?.proposedStart).toBe(28);
    expect(scenario.readings).toHaveLength(0);
    expect(scenario.rewardLedger ?? []).toHaveLength(0);
    expect(Object.keys(scenario.results ?? {})).toHaveLength(0);
  });

  it("preserves ledger entries belonging to other activities", async () => {
    const base = createDemoScenario();
    const current = base.offers[0];
    setScenario("operator-ledger-user", { ...base, rewardLedger: [{ id: "other-reward", offerId: "other-offer", points: 10, illustrativeRupees: 1, state: "verified", createdAt: "2026-09-13T10:00:00+05:30" }] });
    await syncConsumerToOperator("load", acceptedState, "ledger-user");
    const scenario = getScenario("operator-ledger-user");
    expect(scenario.rewardLedger?.some((entry) => entry.offerId === "other-offer")).toBe(true);
    expect(current && scenario.rewardLedger?.some((entry) => entry.offerId === current.id)).toBe(true);
    await syncConsumerToOperator("load", { ...acceptedState, rewards: [] }, "ledger-user");
    expect(getScenario("operator-ledger-user").rewardLedger?.some((entry) => entry.offerId === "other-offer")).toBe(true);
  });

  it("preserves raw evidence and completion markers and rejects invalid meter values", async () => {
    await syncConsumerToOperator("load", { ...acceptedState, readings: [{ slot: 26, cumulative_kwh: 14 }, { slot: 30, cumulative_kwh: 22 }] }, "evidence-user");
    const readings = getScenario("operator-evidence-user").readings;
    expect(readings.map((entry) => entry.cumulativeKWh)).toEqual([14, 22]);
    expect(readings.map((entry) => entry.serviceComplete)).toEqual([false, true]);
    await expect(syncConsumerToOperator("load", { ...acceptedState, readings: [{ slot: 26, cumulative_kwh: -1 }] }, "evidence-user")).rejects.toThrow("invalid meter value");
    expect(getScenario("operator-evidence-user").readings).toEqual(readings);
  });
});
