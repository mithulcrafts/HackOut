import { cookies } from "next/headers";
import { newSessionId } from "./demo-store";
import { isDemoSessionId } from "./demo-session-id";
export async function readDemoSession() {
  // Route unit tests and non-request callers do not have a Next request store.
  // Treat that context as an anonymous user instead of leaking a framework error.
  try {
    const jar = await cookies();
    const value = jar.get("hackout_demo_session")?.value;
    return isDemoSessionId(value) ? value : null;
  } catch {
    return null;
  }
}
export function setDemoCookie(response: Response, sessionId: string) { response.headers.append("Set-Cookie", "hackout_demo_session=" + sessionId + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800"); }
export async function getOrCreateDemoSession() { return (await readDemoSession()) ?? newSessionId(); }
