import { describe, expect, it } from "vitest";
import { createDemoScenario } from "@/domain/fixtures";
import { decideOffer } from "@/domain/events";
import { demoRewardEntries, demoState, presentationDecision } from "./consumer-server";
import { resetScenario, setScenario } from "./demo-store";
import { updateDemoProfile } from "./demo-preferences";
import { recordSimulatedOffer, verifyScenarioOffer } from "@/domain/playback";

describe("demo consumer reward summary", () => {
  it("does not count pending offer points as earned points", () => {
    const session = `reward-summary-${crypto.randomUUID()}`;
    const seeded = resetScenario(session);
    const accepted = decideOffer(seeded, seeded.offers[0].id, "accept", undefined, seeded.offers[0].version);
    setScenario(session, accepted);

    const state = demoState(session, accepted);

    expect(state.rewardSummary).toMatchObject({ points: 0, pendingRupees: 12, verifiedRupees: 0 });
  });

  it("includes verified and redeemable points while keeping pending cash separate", () => {
    const session = `reward-summary-${crypto.randomUUID()}`;
    const scenario = createDemoScenario();
    const accepted = decideOffer(scenario, scenario.offers[0].id, "accept", undefined, scenario.offers[0].version);
    const withLedger = {
      ...accepted,
      rewardLedger: [
        { id: "verified-reward", offerId: accepted.offers[0].id, points: 45, illustrativeRupees: 3, state: "verified" as const, createdAt: "2026-09-12T12:00:00+05:30" },
        { id: "redeemable-reward", offerId: accepted.offers[0].id, points: 15, illustrativeRupees: 1, state: "redeemable" as const, createdAt: "2026-09-12T13:00:00+05:30" },
      ],
    };
    setScenario(session, withLedger);

    const state = demoState(session, withLedger);

    expect(state.rewardSummary).toMatchObject({ points: 60, pendingRupees: 12, verifiedRupees: 4 });
  });

  it("shows a closed pending offer as expired without creating a commitment", () => {
    const session = `expired-offer-${crypto.randomUUID()}`;
    const seeded = resetScenario(session);
    const closed = {
      ...seeded,
      events: seeded.events.map((event, index) => index === 0 ? { ...event, status: "closed" as const } : event),
    };
    setScenario(session, closed);

    expect(presentationDecision(closed, closed.offers[0])).toBe("expired");
    const state = demoState(session, closed);
    expect(state.offer?.decision).toBe("expired");
    expect(state.availableOffers?.find((item) => item.id === closed.offers[0].id)?.decision).toBe("expired");
    expect(closed.offers[0].decision).toBe("pending");
    expect(state.presentation.schedule.some((row) => row.proposed > 0)).toBe(true);
    expect(demoRewardEntries(session)).toHaveLength(0);
  });

  it("keeps verified impact while suppressing rewards for an opted-out participant", () => {
    const session = `reward-opt-out-${crypto.randomUUID()}`;
    const seeded = resetScenario(session);
    updateDemoProfile(session, { reward_program_opt_in: false });
    const first = seeded.offers[0];
    const accepted = {
      ...decideOffer({ ...seeded, offers: seeded.offers.map((offer) => offer.id === first.id ? { ...offer, rewardEligible: false, rewardEstimate: 0 } : offer) }, first.id, "accept", undefined, first.version),
      offers: seeded.offers.map((offer) => offer.id === first.id ? { ...offer, rewardEligible: false, rewardEstimate: 0, decision: "accept" as const, status: "accepted" as const, version: offer.version + 1 } : offer),
    };
    const verified = verifyScenarioOffer(recordSimulatedOffer(accepted, first.id, "success"), first.id);
    setScenario(session, verified);
    const state = demoState(session, verified);
    expect(verified.results?.[first.id]?.outcome).toBe("verified");
    expect(verified.rewardLedger ?? []).toHaveLength(0);
    expect(demoRewardEntries(session)).toHaveLength(0);
    expect(state.offer?.reward_eligible).toBe(false);
    expect(state.presentation.estimatedRupees).toBe(0);
  });
});
