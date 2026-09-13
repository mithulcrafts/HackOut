import { NextResponse } from "next/server";
import { createClient } from "./supabase/server";
import { consumerActionSchema, type ConsumerState } from "./consumer";
import { consumerView } from "./consumer-view";
import { readDemoSession, setDemoCookie, getOrCreateDemoSession } from "./demo-cookie";
import { getScenario, setScenario, resetScenario } from "./demo-store";
import { decideOffer, isOfferExpired, offerEligibleShiftedEnergyKWh } from "@/domain/events";
import { recordSimulatedOffer, verifyScenarioOffer } from "@/domain/playback";
import type { Scenario } from "@/domain/types";
import { getDemoNotificationReads, getDemoProfile } from "./demo-preferences";
import { syncConsumerToOperator } from "./consumer-integration";

/**
 * Convert the domain mutation state into the status a participant should
 * see.  Expiry is a presentation concern: the underlying offer remains in
 * the audit trail as `pending`/`modify`, while the inbox tells the user that
 * its response window has closed and leaves the normal schedule untouched.
 */
export function presentationDecision(scenario: Scenario, offer: Scenario["offers"][number]) {
  if (offer.decision === "accept") return "accepted" as const;
  if (offer.decision === "skip") return "skipped" as const;
  if (offer.decision === "override") return "overridden" as const;
  const event = scenario.events.find((item) => item.id === offer.eventId);
  if (event?.status === "closed" || isOfferExpired(scenario, offer)) return "expired" as const;
  return "pending" as const;
}

export function demoNotifications(session: string, scenario: Scenario): ConsumerState["notifications"] {
  const reads = getDemoNotificationReads(session);
  const profile = getDemoProfile(session);
  type Notification = ConsumerState["notifications"][number];
  type Kind = NonNullable<Notification["kind"]>;
  type Candidate = Notification & { kind: Kind; priority: NonNullable<Notification["priority"]> };
  const candidates: Candidate[] = [];
  const slotTime = (slot: number) => {
    const hours = Math.floor(slot / 2);
    const minutes = slot % 2 ? "30" : "00";
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  };
  const timestampAt = (slot: number, minuteOffset = 0) => {
    const midnight = Date.parse(`${scenario.date}T00:00:00+05:30`);
    const timestamp = midnight + (slot * 30 + minuteOffset) * 60_000;
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : `${scenario.date}T08:00:00+05:30`;
  };
  const importantKinds = new Set<Kind>([
    "upcoming", "start", "activity_status", "deadline", "verification_pending", "verification", "review", "reward", "recovery",
  ]);
  const quietHoursUrgentKinds = new Set<Kind>(["deadline", "verification_pending", "verification", "review", "reward", "recovery"]);
  const istHour = (createdAt: string) => {
    const timestamp = Date.parse(createdAt);
    if (!Number.isFinite(timestamp)) return 12;
    // India has no daylight-saving transition. Adding the fixed IST offset
    // makes the quiet-hours rule deterministic for both ISO and +05:30 dates.
    return new Date(timestamp + 330 * 60_000).getUTCHours();
  };
  const isOutsideQuietHours = (createdAt: string) => {
    const hour = istHour(createdAt);
    return hour < 8 || hour >= 20;
  };
  const shouldInclude = (candidate: Candidate) => {
    const important = importantKinds.has(candidate.kind) || candidate.priority === "important";
    const selectedActivities = profile.reminder_activity_ids ?? [];
    const activityScoped = Boolean(candidate.activity_id && selectedActivities.length > 0 && !selectedActivities.includes(candidate.activity_id));
    // A participant can mute routine reminders for selected activities while
    // still receiving verification, reward and recovery notices that require
    // a safe follow-up.
    if (activityScoped && !["verification_pending", "verification", "review", "reward", "recovery"].includes(candidate.kind)) return false;
    // `none` and `important_only` are delivery preferences for non-critical
    // messages. Verification, deadline and recovery messages remain visible so
    // a participant is never left without a safe next action.
    if (profile.reminder_channel === "none" || profile.reminder_channel === "important_only" || profile.reminder_frequency === "important") return important;
    if (profile.reminder_frequency === "quiet_hours" && isOutsideQuietHours(candidate.created_at) && !quietHoursUrgentKinds.has(candidate.kind)) return false;
    return true;
  };
  const add = (input: Omit<Candidate, "read_at">) => {
    const candidate: Candidate = { ...input, read_at: reads.get(input.id) ?? null };
    if (shouldInclude(candidate)) candidates.push(candidate);
  };

  for (const offer of scenario.offers) {
    const activity = scenario.activities.find((item) => item.id === offer.activityId);
    const name = activity?.name ?? "Your flexible activity";
    const displayDecision = presentationDecision(scenario, offer);
    const result = scenario.results?.[offer.id] ?? scenario.results?.[offer.activityId];
    const readings = scenario.readings.filter((reading) => reading.eventId === offer.eventId && reading.activityId === offer.activityId);
    const latestReading = readings
      .slice()
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
    const base = { offer_id: offer.id, activity_id: offer.activityId };
    const decisionAt = timestampAt(16); // 08:00 IST: participant planning point for the replay.

    if (offer.decision === "accept" && result?.outcome === "verified") {
      add({ ...base, id: `offer:${offer.id}:verified`, kind: "verification", priority: "important", message: `${name} was verified. Your demand shift is complete and the result is ready to review.`, created_at: result.createdAt });
      const reward = scenario.rewardLedger?.find((entry) => entry.offerId === offer.id);
      if (reward && reward.illustrativeRupees > 0) {
        add({ ...base, id: `offer:${offer.id}:reward`, kind: "reward", priority: "important", message: `₹${reward.illustrativeRupees.toFixed(2)} moved from Pending to Verified for ${name}.`, created_at: reward.createdAt });
      } else if (offer.rewardEligible === false) {
        add({ ...base, id: `offer:${offer.id}:reward`, kind: "reward", priority: "important", message: `${name} was verified. Rewards are turned off for this activity by your preference; verified impact is still recorded.`, created_at: result.createdAt });
      } else {
        add({ ...base, id: `offer:${offer.id}:reward`, kind: "reward", priority: "important", message: `${name} was verified, but no illustrative reward was issued because no eligible shift was recorded.`, created_at: result.createdAt });
      }
    } else if (offer.decision === "accept" && result?.outcome === "pending") {
      add({ ...base, id: `offer:${offer.id}:pending-verification`, kind: "verification_pending", priority: "important", message: `Verification is waiting for complete readings for ${name}. Missing data is not a penalty.`, created_at: result.createdAt });
    } else if (offer.decision === "accept" && result) {
      const message = result.outcome === "partial"
        ? `${name} was partly completed. The result needs review before any illustrative reward can be released.`
        : result.outcome === "failed"
          ? `${name} was not verified because the accepted window or deadline was not met. No illustrative reward was issued.`
          : `${name} needs review before an illustrative reward can be released.`;
      add({ ...base, id: `offer:${offer.id}:review`, kind: "review", priority: "important", message, created_at: result.createdAt });
    } else if (offer.decision === "accept") {
      add({ ...base, id: `offer:${offer.id}:accepted`, kind: "accepted", priority: "normal", message: `${name} is accepted for the renewable-aligned window. Complete it before ${slotTime(offer.deadline)} IST.`, created_at: decisionAt });
      // A half-hour slot is the product's planning granularity. The upcoming
      // reminder is emitted 15 minutes before the proposed start so the copy
      // remains useful even when the user opens the app well in advance.
      add({ ...base, id: `offer:${offer.id}:upcoming`, kind: "upcoming", priority: "important", message: `Your accepted ${name} window begins in 15 minutes.`, created_at: timestampAt(offer.proposedStart, -15) });
      add({ ...base, id: `offer:${offer.id}:start`, kind: "start", priority: "important", message: `Your accepted ${name} window starts now. Start when convenient.`, created_at: timestampAt(offer.proposedStart) });
      const deadlineAt = timestampAt(offer.deadline, -30);
      add({ ...base, id: `offer:${offer.id}:deadline`, kind: "deadline", priority: "important", message: `Your ${name} still needs to be completed before ${slotTime(offer.deadline)} IST.`, created_at: deadlineAt });
    } else if (offer.decision === "skip") {
      add({ ...base, id: `offer:${offer.id}:skipped`, kind: "skipped", priority: "normal", message: `${name} was skipped. There is no penalty for declining an offer.`, created_at: decisionAt });
    } else if (offer.decision === "override") {
      add({ ...base, id: `offer:${offer.id}:overridden`, kind: "overridden", priority: "normal", message: `${name} was released from the accepted plan. Your original routine remains unchanged.`, created_at: decisionAt });
    } else if (displayDecision === "expired") {
      add({ ...base, id: `offer:${offer.id}:expired`, kind: "expired", priority: "normal", message: `${name} offer is no longer active. Continue with your normal schedule; no penalty applies.`, created_at: offer.expiresAt || decisionAt });
    } else {
      add({ ...base, id: `offer:${offer.id}:pending`, kind: "offer", priority: "normal", message: offer.decision === "modify" ? `Your updated renewable-aligned time for ${name} is ready to review.` : `You have a new renewable-aligned offer for ${name}. Review the offer and choose what works.`, created_at: decisionAt });
    }

    // A trace is evidence of activity, not proof of verification. Surface a
    // separate status update so users can distinguish “reading received” from
    // the later verification and reward events.
    if (offer.decision === "accept" && readings.length > 0) {
      const completion = readings.find((reading) => reading.serviceComplete);
      const statusMessage = result?.outcome === "verified"
        ? `${name} completed according to the recorded activity trace.`
        : result?.outcome === "pending"
          ? `${readings.length} reading${readings.length === 1 ? "" : "s"} received for ${name}; verification is still in progress.`
          : `${name} activity data was received. The accepted window is being checked.`;
      add({ ...base, id: `offer:${offer.id}:status`, kind: "activity_status", priority: "important", message: statusMessage, created_at: completion?.timestamp ?? latestReading?.timestamp ?? decisionAt });
    }
  }

  for (const recovery of scenario.recovery ?? []) {
    const id = `recovery:${recovery.id}`;
    const activity = scenario.activities.find((item) => item.id === recovery.lostActivityId);
    add({
      id,
      kind: "recovery",
      priority: "important",
      activity_id: recovery.lostActivityId,
      message: `${activity?.name ?? "An accepted activity"} was released. ${recovery.unresolvedGapKW.toFixed(1)} kW remains open for the programme; no penalty was applied.`,
      created_at: recovery.createdAt,
    });
  }

  for (const request of scenario.evidenceReviewRequests ?? []) {
    const activity = scenario.activities.find((item) => item.id === request.activityId);
    add({
      id: `evidence-review:${request.id}`,
      kind: "review",
      priority: "important",
      offer_id: request.offerId,
      activity_id: request.activityId,
      message: request.status === "open"
        ? `Your evidence review request for ${activity?.name ?? "the accepted activity"} is in the operator queue.`
        : `Your evidence review request for ${activity?.name ?? "the accepted activity"} was acknowledged.`,
      created_at: request.createdAt,
    });
  }

  // Newest updates first, with the original insertion order retained for an
  // identical timestamp. Stable IDs make read/unread state survive refreshes.
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => {
      const difference = Date.parse(b.candidate.created_at) - Date.parse(a.candidate.created_at);
      return Number.isFinite(difference) && difference !== 0 ? difference : a.index - b.index;
    })
    .map(({ candidate }) => candidate);
}

export function demoRewardEntries(session: string) {
  const scenario = getScenario(session);
  const entries = (scenario.rewardLedger ?? []).map((entry) => ({ id: entry.id, offer_id: entry.offerId, points: entry.points, illustrative_rupees: entry.illustrativeRupees, state: entry.state as "pending" | "verified" | "redeemable", created_at: entry.createdAt }));
  const pending = scenario.offers.filter((offer) => offer.decision === "accept" && offer.rewardEligible !== false && (!scenario.results?.[offer.id] || ["pending", "needs_review"].includes(scenario.results[offer.id].outcome))).map((offer) => {
    const eligibleKWh = offerEligibleShiftedEnergyKWh(scenario, offer);
    return { id: `pending-${offer.id}`, offer_id: offer.id, points: Math.floor(eligibleKWh * 15), illustrative_rupees: offer.rewardEstimate, state: "pending" as const, created_at: `${scenario.date}T00:00:00+05:30` };
  });
  return [...entries, ...pending];
}

export function demoState(session: string, scenario: Scenario, selectedOfferId?: string) {
  // Keep an explicitly selected offer stable. When Today is opened without an
  // offerId, prefer a committed offer so the schedule reflects the user's
  // latest choice instead of silently falling back to the first pending offer.
  const defaultOffer = scenario.offers.find((item) => item.decision === "accept")
    ?? scenario.offers.find((item) => ["pending", "modify"].includes(item.decision))
    ?? scenario.offers[0];
  const offer = (selectedOfferId ? scenario.offers.find((item) => item.id === selectedOfferId) : defaultOffer) ?? null;
  const activity = offer ? scenario.activities.find((item) => item.id === offer.activityId) : undefined;
  const event = offer ? scenario.events.find((item) => item.id === offer.eventId) : undefined;
  const offerDisplayDecision = offer ? presentationDecision(scenario, offer) : null;
  const midnight = Date.parse(`${scenario.date}T00:00:00+05:30`);
  const sourceReadings = offer ? scenario.readings.filter((item) => item.activityId === offer.activityId && item.eventId === offer.eventId) : [];
  const readings = sourceReadings.map((item) => ({ slot: (Date.parse(item.timestamp) - midnight) / 1800000, cumulative_kwh: item.cumulativeKWh }));
  const result = offer ? scenario.results?.[offer.id] : null;
  const verification: ConsumerState["verification"] = result ? { status: result.outcome, reason: result.reason, recorded_kwh: result.recordedEnergyKWh, eligible_kwh: result.eligibleShiftedKWh, baseline_kwh: activity?.requiredEnergyKWh ?? 0, created_at: result.createdAt } : null;
  const allowedStarts: number[] = [];
  if (offer && activity && ["pending", "modify"].includes(offer.decision)) {
    for (let start = activity.earliestStart; start + activity.durationSlots <= activity.latestFinish; start++) {
      try { decideOffer(scenario, offer.id, "modify", start, offer.version); allowedStarts.push(start); } catch { /* Infeasible windows are omitted. */ }
    }
  }
  const outlook = scenario.forecast.map((slot) => ({ slot: slot.index, solarKW: slot.solarKW, windKW: slot.windKW, renewableKW: slot.renewableKW }));
  const completion = sourceReadings.find((item) => item.serviceComplete);
  const allRewardEntries = demoRewardEntries(session);
  const rewardSummary = {
    verifiedRupees: Number(allRewardEntries.filter((entry) => entry.state === "verified" || entry.state === "redeemable").reduce((sum, entry) => sum + Number(entry.illustrative_rupees), 0).toFixed(2)),
    pendingRupees: Number(allRewardEntries.filter((entry) => entry.state === "pending").reduce((sum, entry) => sum + Number(entry.illustrative_rupees), 0).toFixed(2)),
    // Points are participation credit, so they unlock only after evidence
    // verifies the accepted activity. Keep pending points visible in the
    // wallet, but do not report them as earned on the Today summary.
    points: allRewardEntries
      .filter((entry) => entry.state === "verified" || entry.state === "redeemable")
      .reduce((sum, entry) => sum + Number(entry.points), 0),
  };
  const upcoming = scenario.offers.map((item) => {
    const linked = scenario.activities.find((candidate) => candidate.id === item.activityId);
    return { id: item.id, name: linked?.name ?? "Flexible activity", proposed_start: item.proposedStart, duration_slots: item.proposedEnd - item.proposedStart, deadline_slot: item.deadline, decision: presentationDecision(scenario, item) };
  });
  const latestReview = offer
    ? (scenario.evidenceReviewRequests ?? [])
      .filter((request) => request.offerId === offer.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
    : undefined;
  return consumerView({
    availableOffers: scenario.offers.map((item) => ({ id: item.id, name: scenario.activities.find((a) => a.id === item.activityId)?.name ?? "Activity", decision: presentationDecision(scenario, item) })), upcoming, rewardSummary,
    offer: offer ? { id: offer.id, name: activity?.name ?? "Flexible activity", version: offer.version, decision: offerDisplayDecision!, reward_eligible: offer.rewardEligible !== false, baseline_start: offer.originalStart, proposed_start: offer.proposedStart, duration_slots: offer.proposedEnd - offer.proposedStart, deadline_slot: offer.deadline, required_kwh: activity?.requiredEnergyKWh ?? 0, power_kw: activity ? activity.requiredEnergyKWh / (activity.durationSlots * .5) : 0, simulation_run: Boolean(scenario.simulatedOfferIds?.includes(offer.id) || sourceReadings.length), completion_slot: completion ? (Date.parse(completion.timestamp) - midnight) / 1800000 : null, expires_at: offer.expiresAt } : null,
    readings, verification, rewards: demoRewardEntries(session).filter((entry) => entry.offer_id === offer?.id), notifications: demoNotifications(session, scenario),
    reviewRequest: latestReview ? { id: latestReview.id, offer_id: latestReview.offerId, status: latestReview.status, created_at: latestReview.createdAt } : null,
    recovery: scenario.recovery?.at(-1) ? {
      eventId: scenario.recovery.at(-1)!.eventId,
      lostActivityId: scenario.recovery.at(-1)!.lostActivityId,
      lostPowerKW: scenario.recovery.at(-1)!.lostPowerKW,
      replacementOfferIds: scenario.recovery.at(-1)!.replacementOfferIds,
      batterySupportKW: scenario.recovery.at(-1)!.batterySupportKW,
      unresolvedGapKW: scenario.recovery.at(-1)!.unresolvedGapKW,
      createdAt: scenario.recovery.at(-1)!.createdAt,
    } : null,
  }, outlook, "Shared scenario simulation · solar + wind", { allowedStarts, rewardRate: event?.rewardRatePerKWh ?? 0, rewardCap: offer?.rewardEstimate ?? 0, objective: event?.objective ?? "absorb" });
}

export function redeemDemo(session: string, rewardId: string) {
  const scenario = getScenario(session);
  const entry = scenario.rewardLedger?.find((item) => item.id === rewardId);
  if (!entry) throw new Error("Only a verified reward can be released.");
  setScenario(session, { ...scenario, rewardLedger: scenario.rewardLedger?.map((item) => item.id === rewardId ? { ...item, state: "redeemable" } : item) });
}
function demoResponse(session: string, scenario: Scenario, message?: string, selectedOfferId?: string) {
  const response = NextResponse.json({ ...demoState(session, scenario, selectedOfferId), ...(message ? { message } : {}) });
  setDemoCookie(response, session);
  return response;
}
async function demoAction(request: Request, allowed?: string[]) {
  const parsed = consumerActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (allowed && !allowed.includes(parsed.data.command))) return NextResponse.json({ error: "Invalid consumer action." }, { status: 400 });
  const session = await getOrCreateDemoSession();
  let scenario = getScenario(session);
  const v = parsed.data;
  if (v.command === "reset" || v.command === "seed") return demoResponse(session, resetScenario(session), "Scenario reset to its three sample activities.");
  const offer = scenario.offers.find((item) => item.id === v.offerId);
  if (!offer || v.version !== offer.version) return NextResponse.json({ error: "Offer changed. Refresh before trying again." }, { status: 409 });
  try {
    if (["accept", "skip", "modify", "override"].includes(v.command)) {
      if (scenario.readings.some((item) => item.activityId === offer.activityId && item.eventId === offer.eventId)) throw new Error("This activity already has evidence. Verify it before starting another event.");
      // Reward eligibility is frozen at the first scheduling decision. An
      // opted-out participant can still help the grid, but accepting or
      // modifying the offer must not create a pending cash/points promise.
      const profile = getDemoProfile(session);
      const rewardOptedIn = profile.reward_program_opt_in !== false;
      const decisionScenario = !rewardOptedIn && (v.command === "accept" || v.command === "modify") && offer.decision !== "accept"
        ? { ...scenario, offers: scenario.offers.map((item) => item.id === offer.id ? { ...item, rewardEligible: false, rewardEstimate: 0 } : item) }
        : scenario;
      scenario = decideOffer(decisionScenario, offer.id, v.command as "accept" | "skip" | "modify" | "override", v.startSlot, v.version);
    } else if (v.command === "simulate") scenario = recordSimulatedOffer(scenario, offer.id, v.outcome ?? "success");
    else if (v.command === "verify") scenario = verifyScenarioOffer(scenario, offer.id);
    setScenario(session, scenario);
    return demoResponse(session, scenario, v.command === "skip" || v.command === "override" ? "Your choice is saved. No penalty." : "Shared activity state updated.", offer.id);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update this activity." }, { status: 409 }); }
}

function authenticatedView(state: ConsumerState, session: string) {
  const scenario = getScenario(session);
  const outlook = scenario.forecast.map((slot) => ({ slot: slot.index, solarKW: slot.solarKW, windKW: slot.windKW, renewableKW: slot.renewableKW }));
  const offer = scenario.offers.find((item) => item.activityId === "activity-ev") ?? scenario.offers[0];
  const event = offer ? scenario.events.find((item) => item.id === offer.eventId) : undefined;
  return consumerView(state, outlook, "Shared scenario simulation · solar + wind", { allowedStarts: [26, 27, 28], rewardRate: event?.rewardRatePerKWh ?? 1.5, rewardCap: offer?.rewardEstimate ?? 12, objective: event?.objective ?? "absorb" });
}

export async function readConsumer(request?: Request) {
  const demo = await readDemoSession();
  if (demo && (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true")) return demoResponse(demo, getScenario(demo), undefined, request ? new URL(request.url).searchParams.get("offerId") ?? undefined : undefined);
  let db;
  try { db=await createClient(); } catch { return NextResponse.json({error:"Consumer storage is not configured for this environment."},{status:503}); }
  const {data:{user}}=await db.auth.getUser();
  if(!user) return NextResponse.json({error:"Sign in to use your consumer account."},{status:401});
  const {data,error}=await db.rpc("consumer_snapshot");
  if(error) return NextResponse.json({error:"Consumer storage is unavailable. Please retry."},{status:503});
  let session: string;
  try { session = await syncConsumerToOperator("load", data, user.id); } catch { return NextResponse.json({ error: "Consumer data was saved, but the operator projection is temporarily unavailable." }, { status: 503 }); }
  return NextResponse.json(authenticatedView(data, session));
}
export async function actConsumer(request:Request, allowed?:string[]) {
  if ((await readDemoSession()) && (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true")) return demoAction(request, allowed);
  const parsed=consumerActionSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success || (allowed && !allowed.includes(parsed.data.command))) return NextResponse.json({error:"Invalid consumer action."},{status:400});
  let db;
  try { db=await createClient(); } catch { return NextResponse.json({error:"Consumer storage is not configured for this environment."},{status:503}); }
  const {data:{user}}=await db.auth.getUser();
  if(!user) return NextResponse.json({error:"Sign in to continue."},{status:401});
  const v=parsed.data;
  const {data,error}=await db.rpc("consumer_action",{command:v.command,target_offer:v.offerId??null,expected_version:v.version??null,start_slot:v.startSlot??null,outcome:v.outcome??null});
  if(error) {
    const safeCodes=["P0001","P0002","40001"];
    return NextResponse.json({error:safeCodes.includes(error.code)?error.message:"Consumer storage is unavailable. Please retry."},{status:safeCodes.includes(error.code)?409:503});
  }
  let session: string;
  try { session = await syncConsumerToOperator(v.command, data, user.id); } catch { return NextResponse.json({ error: "Your action was saved, but the operator projection is temporarily unavailable." }, { status: 503 }); }
  return NextResponse.json(authenticatedView(data, session));
}

