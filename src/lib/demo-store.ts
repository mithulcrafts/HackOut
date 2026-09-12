import { createDemoScenario } from "@/domain/fixtures";
import type { Scenario } from "@/domain/types";
const sessions = new Map<string, Scenario>();
export function getScenario(sessionId: string): Scenario { const existing = sessions.get(sessionId); if (existing) return existing; const scenario = createDemoScenario(); sessions.set(sessionId, scenario); return scenario; }
export function setScenario(sessionId: string, scenario: Scenario) { sessions.set(sessionId, scenario); return scenario; }
export function resetScenario(sessionId: string) { const scenario = createDemoScenario(); sessions.set(sessionId, scenario); return scenario; }
export function newSessionId() { return "demo-" + crypto.randomUUID(); }
