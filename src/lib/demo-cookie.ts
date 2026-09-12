import { cookies } from "next/headers";
import { newSessionId } from "./demo-store";
export async function readDemoSession() { const jar = await cookies(); return jar.get("hackout_demo_session")?.value ?? null; }
export function setDemoCookie(response: Response, sessionId: string) { response.headers.append("Set-Cookie", "hackout_demo_session=" + sessionId + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800"); }
export async function getOrCreateDemoSession() { return (await readDemoSession()) ?? newSessionId(); }
