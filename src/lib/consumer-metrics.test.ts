import { describe, expect, it } from "vitest";
import { rewardSummary, scheduleSeries } from "./consumer-metrics";
import type { ConsumerState } from "./consumer";

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

const offer = (decision: NonNullable<ConsumerState["offer"]>["decision"]): NonNullable<ConsumerState["offer"]> => ({
  id: "offer-1", name: "EV charging", version: 1, decision,
  baseline_start: 20, proposed_start: 26, duration_slots: 4, deadline_slot: 34,
  required_kwh: 8, power_kw: 4, simulation_run: false, completion_slot: null,
});

describe("load schedule presentation", () => {
  it("shows a pending recommendation separately from accepted demand", () => {
    const rows = scheduleSeries(offer("pending"));
    expect(rows.filter(row => row.proposed > 0)).toHaveLength(4);
    expect(rows.filter(row => row.accepted > 0)).toHaveLength(0);
    expect(rows.find(row => row.slot === 26)).toMatchObject({ baseline: 0, proposed: 4, accepted: 0 });
  });

  it("moves the visible series from proposed to accepted after acceptance", () => {
    const rows = scheduleSeries(offer("accepted"));
    expect(rows.filter(row => row.proposed > 0)).toHaveLength(0);
    expect(rows.filter(row => row.accepted > 0)).toHaveLength(4);
    expect(rows.find(row => row.slot === 26)).toMatchObject({ baseline: 0, proposed: 0, accepted: 4 });
  });
});
