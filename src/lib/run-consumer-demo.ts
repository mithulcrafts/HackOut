import type { ConsumerAction, ConsumerState } from "./consumer";

type Send = (url: string, action: ConsumerAction) => Promise<ConsumerState>;

// The fixture is a dedicated demo EV, never a verification of an arbitrary saved task.
export async function runConsumerDemo(send: Send): Promise<ConsumerState> {
  let state = await send("/api/consumer", { command: "seed" });
  if (!state.offer) throw new Error("The demo offer could not be loaded.");
  if (["skipped", "overridden"].includes(state.offer.decision)) {
    throw new Error("The demo offer was skipped or overridden. Open Today to review it; no decision has been changed.");
  }
  if (state.verification) return state;
  if (state.offer.decision === "pending") {
    state = await send("/api/offers/decision", { command: "accept", offerId: state.offer.id, version: state.offer.version });
  }
  if (!state.offer) throw new Error("The demo offer is unavailable.");
  if (!state.offer.simulation_run) {
    state = await send("/api/meter-readings", { command: "simulate", offerId: state.offer.id, version: state.offer.version, outcome: "success" });
  }
  if (!state.offer) throw new Error("The demo offer is unavailable.");
  return send("/api/verification", { command: "verify", offerId: state.offer.id, version: state.offer.version });
}
