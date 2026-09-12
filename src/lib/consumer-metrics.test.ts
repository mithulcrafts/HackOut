import { describe, expect, it } from "vitest";
import { rewardSummary } from "./consumer-metrics";

const verified = (id: string, kWh: number) => ({ id, offer_id: `offer-${id}`, status: "verified" as const, reason: "Evidence matched.", recorded_kwh: kWh, eligible_kwh: kWh, baseline_kwh: kWh, created_at: `2026-09-${id}T12:00:00+05:30` });

describe("verified participation rewards", () => {
  it("awards progress from verified eligible flexibility only", () => {
    const summary = rewardSummary([
      { id: "r1", offer_id: "o1", points: 30, illustrative_rupees: 3, state: "verified", created_at: "2026-09-01T00:00:00Z" },
    ], [verified("01", 2), { ...verified("02", 20), status: "partial" }]);
    expect(summary.verifiedActions).toBe(1);
    expect(summary.shiftedKWh).toBe(2);
    expect(summary.badges).toEqual(["First verified shift"]);
    expect(summary.nextMilestone).toEqual({ target: 3, completed: 1, label: "3 verified shifts" });
    expect(summary.impactScore).toBe(35);
  });
});
