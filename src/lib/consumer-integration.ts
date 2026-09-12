import type { ConsumerState } from "./consumer";
import { decideOffer } from "@/domain/events";
import { getOrCreateDemoSession } from "./demo-cookie";
import { getScenario, setScenario } from "./demo-store";
import type { Scenario } from "@/domain/types";

/** Bridges the deterministic consumer fixture to the operator demo session. */
export async function syncConsumerToOperator(command: string, state: ConsumerState) {
  const session = await getOrCreateDemoSession();
  let scenario: Scenario = getScenario(session);
  const operatorOffer = scenario.offers.find(offer => offer.activityId === "activity-ev");
  if (!operatorOffer || !state.offer) return session;
  const decision = command === "accept" ? "accept" : command === "modify" ? "modify" : command === "skip" ? "skip" : command === "override" ? "override" : null;
  if (decision) {
    try { scenario = decideOffer(scenario, operatorOffer.id, decision, state.offer.proposed_start, operatorOffer.version); } catch { /* The consumer RPC remains authoritative if the parallel demo is stale. */ }
  }
  const verified = state.verification?.status === "verified";
  scenario = {
    ...scenario,
    activities: scenario.activities.map(activity => activity.id === operatorOffer.activityId ? { ...activity, status: verified ? "verified" : state.offer?.decision === "accepted" ? "accepted" : activity.status } : activity),
    readings: state.readings.length ? [{ id: "consumer-reading", eventId: operatorOffer.eventId, activityId: operatorOffer.activityId, deviceId: "consumer-simulator", timestamp: `${scenario.date}T15:00:00+05:30`, cumulativeKWh: state.verification?.recorded_kwh ?? 0, serviceComplete: verified, readingKey: "consumer-simulator-latest", data_source: "simulation" }] : scenario.readings,
  };
  setScenario(session, scenario);
  return session;
}
