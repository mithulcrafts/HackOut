import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readDemoSession } from "@/lib/demo-cookie";
import { isDemoSessionId } from "@/lib/demo-session-id";

const DEMO_COOKIE = "hackout_demo_session";

export type OperatorAccess =
  | { mode: "demo"; session: string }
  | { mode: "operator"; userId: string; session: string }
  | { mode: "error"; response: NextResponse };

function demoEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true";
}

function requestDemoSession(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${DEMO_COOKIE}=([^;]+)`));
  const value = match?.[1] ?? null;
  return isDemoSessionId(value) ? value : null;
}

function isExplicitDemoRequest(request: Request) {
  try {
    return new URL(request.url).searchParams.get("demo") === "1";
  } catch {
    return false;
  }
}

/**
 * Authorize operator API calls independently of the route proxy. The
 * in-memory scenario is deliberately available through an explicit demo
 * request (query flag or demo cookie) or an authenticated operator role;
 * production requests must have an authenticated operator role. Operators receive an isolated
 * simulation namespace; a persistent store can replace that namespace later
 * without changing the authorization boundary.
 */
export async function requireOperatorAccess(request: Request): Promise<OperatorAccess> {
  const demoSession = requestDemoSession(request);
  if (demoEnabled() && (demoSession || isExplicitDemoRequest(request))) {
    return { mode: "demo", session: demoSession ?? `demo-${crypto.randomUUID()}` };
  }

  let db;
  try {
    db = await createClient();
  } catch {
    return {
      mode: "error",
      response: NextResponse.json({ error: "Operator access is not configured for this environment." }, { status: 503 }),
    };
  }

  const { data, error } = await db.auth.getUser();
  if (error || !data.user) {
    return { mode: "error", response: NextResponse.json({ error: "Sign in as an operator to continue." }, { status: 401 }) };
  }

  // Roles are provisioned by the trusted auth/admin path. user_metadata is
  // user-editable and must never grant operator access.
  const role = data.user.app_metadata?.role;
  if (role !== "operator") {
    return { mode: "error", response: NextResponse.json({ error: "Operator role required." }, { status: 403 }) };
  }

  return { mode: "operator", userId: data.user.id, session: `operator-${data.user.id}` };
}

/**
 * Resolve the namespace used by server-rendered operator pages. This mirrors
 * requireOperatorAccess without a Request object, so an authorized operator
 * sees the same session across page loads instead of a newly generated demo
 * scenario on every request.
 */
export async function resolveOperatorSession(): Promise<{ mode: "demo" | "operator"; session: string } | null> {
  if (demoEnabled()) {
    const demoSession = await readDemoSession();
    if (demoSession?.startsWith("demo-")) return { mode: "demo", session: demoSession };
  }

  try {
    const db = await createClient();
    const { data, error } = await db.auth.getUser();
    if (error || !data.user || data.user.app_metadata?.role !== "operator") return null;
    return { mode: "operator", session: `operator-${data.user.id}` };
  } catch {
    return null;
  }
}
