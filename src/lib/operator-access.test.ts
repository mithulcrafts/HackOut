import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, readDemoSession } = vi.hoisted(() => ({ createClient: vi.fn(), readDemoSession: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/demo-cookie", () => ({ readDemoSession }));

import { requireOperatorAccess, resolveOperatorSession } from "./operator-access";

function authUser(user: { id: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null) {
  createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) } });
}

describe("operator access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readDemoSession.mockResolvedValue(null);
  });

  it("allows an explicitly requested demo without touching Supabase", async () => {
    const access = await requireOperatorAccess(new Request("https://example.test/api/scenarios?demo=1"));
    expect(access.mode).toBe("demo");
    if (access.mode === "demo") expect(access.session).toMatch(/^demo-[0-9a-f-]{36}$/i);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("accepts only a valid demo cookie and rejects forged operator namespaces", async () => {
    const demo = "demo-123e4567-e89b-12d3-a456-426614174000";
    const demoAccess = await requireOperatorAccess(new Request("https://example.test/api/scenarios", { headers: { cookie: `hackout_demo_session=${demo}` } }));
    expect(demoAccess).toEqual({ mode: "demo", session: demo });

    authUser(null);
    const forged = await requireOperatorAccess(new Request("https://example.test/api/scenarios", { headers: { cookie: "hackout_demo_session=operator-forged" } }));
    expect(forged.mode).toBe("error");
    if (forged.mode === "error") expect(forged.response.status).toBe(401);
  });

  it("requires the trusted app_metadata role and ignores user_metadata escalation", async () => {
    authUser({ id: "user-consumer", app_metadata: { role: "consumer" }, user_metadata: { role: "operator" } });
    const escalated = await requireOperatorAccess(new Request("https://example.test/api/scenarios"));
    expect(escalated.mode).toBe("error");
    if (escalated.mode === "error") expect(escalated.response.status).toBe(403);

    authUser({ id: "user-operator", app_metadata: { role: "operator" }, user_metadata: { role: "consumer" } });
    const first = await requireOperatorAccess(new Request("https://example.test/api/scenarios"));
    const second = await requireOperatorAccess(new Request("https://example.test/api/scenarios"));
    expect(first).toEqual({ mode: "operator", userId: "user-operator", session: "operator-user-operator" });
    expect(second).toEqual(first);
  });

  it("resolves the same operator namespace for server-rendered pages", async () => {
    authUser({ id: "stable-operator", app_metadata: { role: "operator" } });
    const first = await resolveOperatorSession();
    const second = await resolveOperatorSession();
    expect(first).toEqual({ mode: "operator", session: "operator-stable-operator" });
    expect(second).toEqual(first);
  });
});
