import { describe, expect, it } from "vitest";
import { createDemoScenario } from "@/domain/fixtures";
import { demoNotifications, demoState } from "./consumer-server";
import { markDemoNotificationsRead, updateDemoProfile } from "./demo-preferences";

describe("demo notification lifecycle", () => {
  it("marks the current snapshot read while surfacing a later state change", () => {
    const session = `notification-test-${Date.now()}`;
    const scenario = createDemoScenario();
    const initial = demoNotifications(session, scenario);
    expect(initial.length).toBeGreaterThan(0);
    markDemoNotificationsRead(session, initial.map(item => item.id));
    expect(demoNotifications(session, scenario).every(item => item.read_at)).toBe(true);

    const offer = scenario.offers[0];
    offer.decision = "accept";
    scenario.results = { [offer.id]: { outcome: "verified", recordedEnergyKWh: 8, eligibleShiftedKWh: 8, reason: "Verified", createdAt: new Date().toISOString(), activityId: offer.activityId, requiredEnergyKWh: 8, acceptedWindow: { startSlot: 26, endSlot: 30 }, data_source: "simulation" } };
    const changed = demoNotifications(session, scenario);
    expect(changed.some(item => item.id.endsWith(":verified") && !item.read_at)).toBe(true);
  });

  it("keeps an accepted offer visible when Today has no explicit offer selection", () => {
    const session = `selection-test-${Date.now()}`;
    const scenario = createDemoScenario();
    scenario.offers[1].decision = "accept";
    const state = demoState(session, scenario);
    expect(state.offer?.id).toBe(scenario.offers[1].id);
    expect(state.offer?.decision).toBe("accepted");
  });

  it("emits separate lifecycle and reward updates for an accepted activity", () => {
    const session = `notification-lifecycle-${crypto.randomUUID()}`;
    const scenario = createDemoScenario();
    const offer = scenario.offers[0];
    offer.decision = "accept";
    offer.status = "accepted";

    const beforeReadings = demoNotifications(session, scenario).filter(item => item.offer_id === offer.id);
    expect(beforeReadings.map(item => item.kind)).toEqual(expect.arrayContaining(["accepted", "upcoming", "start", "deadline"]));

    scenario.results = {
      [offer.id]: {
        outcome: "verified",
        recordedEnergyKWh: 8,
        eligibleShiftedKWh: 8,
        reason: "Verified",
        createdAt: "2026-09-12T14:00:00+05:30",
        activityId: offer.activityId,
        requiredEnergyKWh: 8,
        acceptedWindow: { startSlot: offer.proposedStart, endSlot: offer.proposedEnd },
        data_source: "simulation",
      },
    };
    scenario.rewardLedger = [{ id: "reward-lifecycle", offerId: offer.id, points: 120, illustrativeRupees: 12, state: "verified", createdAt: "2026-09-12T14:00:00+05:30" }];
    const afterVerification = demoNotifications(session, scenario).filter(item => item.offer_id === offer.id);
    expect(afterVerification.map(item => item.kind)).toEqual(expect.arrayContaining(["verification", "reward"]));
    expect(afterVerification.find(item => item.id === `offer:${offer.id}:reward`)?.message).toContain("₹12.00");
  });

  it("honours important-only preferences while retaining a safe lifecycle path", () => {
    const session = `notification-important-${crypto.randomUUID()}`;
    const scenario = createDemoScenario();
    const offer = scenario.offers[0];
    offer.decision = "accept";
    offer.status = "accepted";
    updateDemoProfile(session, { reminder_channel: "important_only", reminder_frequency: "all" });

    const notifications = demoNotifications(session, scenario).filter(item => item.offer_id === offer.id);
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications.every(item => item.priority === "important")).toBe(true);
    expect(notifications.some(item => item.kind === "deadline")).toBe(true);
    expect(notifications.some(item => item.kind === "accepted")).toBe(false);
  });

  it("keeps reading receipt separate from the scheduled start reminder", () => {
    const session = `notification-reading-${crypto.randomUUID()}`;
    const scenario = createDemoScenario();
    const offer = scenario.offers[0];
    offer.decision = "accept";
    offer.status = "accepted";
    scenario.readings = [{
      id: "reading-status",
      eventId: offer.eventId,
      activityId: offer.activityId,
      deviceId: "simulator-reading-status",
      timestamp: "2026-09-12T13:00:00+05:30",
      cumulativeKWh: 0,
      serviceComplete: false,
      readingKey: "reading-status",
      data_source: "simulation",
    }];

    const notifications = demoNotifications(session, scenario).filter(item => item.offer_id === offer.id);
    expect(notifications.some(item => item.kind === "start" && item.id.endsWith(":start"))).toBe(true);
    expect(notifications.some(item => item.kind === "activity_status" && item.id.endsWith(":status"))).toBe(true);
  });

  it("confirms an evidence review request without settling a reward", () => {
    const session = `notification-review-request-${crypto.randomUUID()}`;
    const scenario = createDemoScenario();
    const offer = scenario.offers[0];
    offer.decision = "accept";
    offer.status = "accepted";
    scenario.evidenceReviewRequests = [{
      id: "review-request-1",
      eventId: offer.eventId,
      offerId: offer.id,
      activityId: offer.activityId,
      note: "No meter trace received.",
      status: "open",
      createdAt: "2026-09-12T18:00:00+05:30",
      data_source: "simulation",
    }];

    const notification = demoNotifications(session, scenario).find(item => item.id === "evidence-review:review-request-1");
    expect(notification).toMatchObject({ kind: "review", priority: "important", offer_id: offer.id });
    expect(notification?.message).toContain("operator queue");
  });

  it("suppresses non-urgent updates outside quiet hours", () => {
    const session = `notification-quiet-${crypto.randomUUID()}`;
    const scenario = createDemoScenario();
    const offer = scenario.offers[0];
    offer.decision = "accept";
    offer.status = "accepted";
    // The fixture's activities normally start in the day. Move only the
    // notification schedule for this focused preference test; no offer action
    // or reward calculation depends on this direct fixture mutation.
    offer.proposedStart = 2;
    offer.proposedEnd = 6;
    offer.deadline = 8;
    updateDemoProfile(session, { reminder_channel: "in_app", reminder_frequency: "quiet_hours" });

    const notifications = demoNotifications(session, scenario).filter(item => item.offer_id === offer.id);
    expect(notifications.some(item => item.kind === "upcoming")).toBe(false);
    expect(notifications.some(item => item.kind === "start")).toBe(false);
    expect(notifications.some(item => item.kind === "deadline")).toBe(true);
  });

  it("honours a selected activity reminder list while retaining critical updates", () => {
    const session = `notification-activity-filter-${crypto.randomUUID()}`;
    const scenario = createDemoScenario();
    const offer = scenario.offers[0];
    offer.decision = "accept";
    offer.status = "accepted";
    updateDemoProfile(session, { reminder_activity_ids: [scenario.activities[1].id] });
    const notifications = demoNotifications(session, scenario).filter(item => item.offer_id === offer.id);
    expect(notifications.some(item => item.kind === "accepted")).toBe(false);
    expect(notifications.some(item => item.kind === "upcoming")).toBe(false);
    // A schedule-specific filter must not hide a verification or review state.
    scenario.results = { [offer.id]: { outcome: "needs_review", recordedEnergyKWh: 0, eligibleShiftedKWh: 0, reason: "Review required", createdAt: "2026-09-12T14:00:00+05:30", activityId: offer.activityId, requiredEnergyKWh: 8, acceptedWindow: { startSlot: offer.proposedStart, endSlot: offer.proposedEnd }, data_source: "simulation" } };
    expect(demoNotifications(session, scenario).some(item => item.kind === "review" && item.offer_id === offer.id)).toBe(true);
  });
});
