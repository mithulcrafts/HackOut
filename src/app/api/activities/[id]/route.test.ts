import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
const id = "00000000-0000-4000-8000-000000000001";
const offerId = "00000000-0000-4000-8000-000000000002";
type Result = { data: unknown; error: null | { code: string } };

function setup(results: Record<string, Result>, signedIn = true) {
  const queries: { table: string; filters: [string, unknown][] }[] = [];
  const from = vi.fn((table: string) => {
    const query = { table, filters: [] as [string, unknown][] };
    queries.push(query);
    const chain = {
      select: () => chain,
      eq: (key: string, value: unknown) => { query.filters.push([key, value]); return chain; },
      order: () => chain,
      maybeSingle: () => chain,
      then: (resolve: (value: Result) => unknown) => Promise.resolve(results[table]).then(resolve),
    };
    return chain;
  });
  createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: "owner" } : null } }) }, from });
  return { from, queries };
}
const request = (activityId = id) => GET(new Request(`http://localhost/api/activities/${activityId}`), { params: Promise.resolve({ id: activityId }) });

describe("activity detail access and evidence", () => {
  beforeEach(() => vi.resetAllMocks());
  it("rejects an invalid identifier without accessing storage", async () => {
    expect((await request("invalid")).status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });
  it("requires authentication before any record lookup", async () => {
    const { from } = setup({}, false);
    expect((await request()).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it("hides absent or foreign activities and never loads their offers", async () => {
    const { queries } = setup({ activities: { data: null, error: null } });
    expect((await request()).status).toBe(404);
    expect(queries).toEqual([{ table: "activities", filters: [["id", id], ["owner_id", "owner"]] }]);
  });
  it("returns no evidence for an activity with no linked offer", async () => {
    const { queries } = setup({ activities: { data: { id }, error: null }, offers: { data: [], error: null } });
    const response = await request();
    expect(await response.json()).toEqual({ activity: { id }, offers: [] });
    expect(queries[1].filters).toEqual([["activity_id", id], ["owner_id", "owner"]]);
    expect(queries).toHaveLength(2);
  });
  it("scopes every evidence lookup to the linked offer and current user", async () => {
    const verification = { status: "verified", eligible_kwh: 8 };
    const readings = [{ slot: 26, cumulative_kwh: 0 }];
    const rewards = [{ points: 120, state: "verified" }];
    const { queries } = setup({
      activities: { data: { id }, error: null }, offers: { data: [{ id: offerId }], error: null },
      meter_readings: { data: readings, error: null }, verifications: { data: verification, error: null },
      reward_ledger: { data: rewards, error: null },
    });
    const response = await request();
    expect(response.status).toBe(200);
    expect((await response.json()).offers).toEqual([{ offer: { id: offerId }, readings, verification, rewards }]);
    for (const query of queries.slice(2)) expect(query.filters).toEqual([["offer_id", offerId], ["owner_id", "owner"]]);
  });
  it("reports unavailable evidence instead of presenting an empty successful result", async () => {
    setup({
      activities: { data: { id }, error: null }, offers: { data: [{ id: offerId }], error: null },
      meter_readings: { data: null, error: { code: "42P01" } },
      verifications: { data: null, error: null }, reward_ledger: { data: [], error: null },
    });
    expect((await request()).status).toBe(503);
  });
});
