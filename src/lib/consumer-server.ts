import { NextResponse } from "next/server";
import { createClient } from "./supabase/server";
import { consumerActionSchema, type ConsumerState } from "./consumer";
import { consumerView } from "./consumer-view";
import { readDemoSession, setDemoCookie, getOrCreateDemoSession } from "./demo-cookie";
import { getScenario, setScenario, resetScenario } from "./demo-store";
import { decideOffer } from "@/domain/events";
import { recordSimulatedOffer, verifyScenarioOffer } from "@/domain/playback";
import type { Scenario } from "@/domain/types";
import { getDemoNotificationReads } from "./demo-preferences";
import { syncConsumerToOperator } from "./consumer-integration";

export function demoNotifications(session: string, scenario: Scenario): ConsumerState["notifications"] {
  const reads = getDemoNotificationReads(session);
  const notifications: ConsumerState["notifications"] = [];
  for (const offer of scenario.offers) {
    const activity = scenario.activities.find((item) => item.id === offer.activityId);
    const name = activity?.name ?? "Your flexible activity";
    const result = scenario.results?.[offer.id];
    let id: string;
    let message: string;
    let createdAt = `${scenario.date}T08:00:00+05:30`;
    if (offer.decision === "accept" && result?.outcome === "verified") {
      id = `offer:${offer.id}:verified`; message = `${name} was verified. Your illustrative reward is ready to review.`; createdAt = result.createdAt;
    } else if (offer.decision === "accept" && result?.outcome === "pending") {
      id = `offer:${offer.id}:pending-verification`; message = `We are waiting for complete readings for ${name}.`; createdAt = result.createdAt;
    } else if (offer.decision === "accept" && result) {
      id = `offer:${offer.id}:review`; message = `${name} needs review before an illustrative reward can be released.`; createdAt = result.createdAt;
    } else if (offer.decision === "accept") {
      id = `offer:${offer.id}:accepted`; message = `${name} is accepted for the renewable-aligned window. Complete it before the deadline.`;
    } else if (offer.decision === "skip") {
      id = `offer:${offer.id}:skipped`; message = `${name} was skipped. There is no penalty for declining an offer.`;
    } else if (offer.decision === "override") {
      id = `offer:${offer.id}:overridden`; message = `${name} was overridden. Your original routine remains unchanged.`;
    } else {
      id = `offer:${offer.id}:pending`; message = `A renewable-aligned time is available for ${name}. Review the offer and choose what works.`;
    }
    notifications.push({ id, message, created_at: createdAt, read_at: reads.get(id) ?? null });
  }
  return notifications;
}

export function demoRewardEntries(session: string) {
  const scenario = getScenario(session);
  const entries = (scenario.rewardLedger ?? []).map((entry) => ({ id: entry.id, offer_id: entry.offerId, points: entry.points, illustrative_rupees: entry.illustrativeRupees, state: entry.state as "pending" | "verified" | "redeemable", created_at: entry.createdAt }));
  const pending = scenario.offers.filter((offer) => offer.decision === "accept" && (!scenario.results?.[offer.id] || scenario.results[offer.id].outcome === "pending")).map((offer) => {
    const event = scenario.events.find((item) => item.id === offer.eventId);
    return { id: `pending-${offer.id}`, offer_id: offer.id, points: event?.rewardRatePerKWh ? Math.floor(offer.rewardEstimate / event.rewardRatePerKWh * 15) : 0, illustrative_rupees: offer.rewardEstimate, state: "pending" as const, created_at: `${scenario.date}T00:00:00+05:30` };
  });
  return [...entries, ...pending];
}

export function demoState(session: string, scenario: Scenario, selectedOfferId?: string) {
  const offer = (selectedOfferId ? scenario.offers.find((item) => item.id === selectedOfferId) : scenario.offers[0]) ?? null;
  const activity = offer ? scenario.activities.find((item) => item.id === offer.activityId) : undefined;
  const event = offer ? scenario.events.find((item) => item.id === offer.eventId) : undefined;
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
  return consumerView({
    availableOffers: scenario.offers.map((item) => ({ id: item.id, name: scenario.activities.find((a) => a.id === item.activityId)?.name ?? "Activity", decision: item.decision })),
    offer: offer ? { id: offer.id, name: activity?.name ?? "Flexible activity", version: offer.version, decision: offer.decision === "accept" ? "accepted" : offer.decision === "skip" ? "skipped" : offer.decision === "override" ? "overridden" : "pending", baseline_start: offer.originalStart, proposed_start: offer.proposedStart, duration_slots: offer.proposedEnd - offer.proposedStart, deadline_slot: offer.deadline, required_kwh: activity?.requiredEnergyKWh ?? 0, power_kw: activity ? activity.requiredEnergyKWh / (activity.durationSlots * .5) : 0, simulation_run: Boolean(scenario.simulatedOfferIds?.includes(offer.id) || sourceReadings.length), completion_slot: completion ? (Date.parse(completion.timestamp) - midnight) / 1800000 : null } : null,
    readings, verification, rewards: demoRewardEntries(session).filter((entry) => entry.offer_id === offer?.id), notifications: demoNotifications(session, scenario),
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
  if (v.command === "reset" || v.command === "seed") return demoResponse(session, resetScenario(session), "Shared demo scenario reset to its three sample activities.");
  const offer = scenario.offers.find((item) => item.id === v.offerId);
  if (!offer || v.version !== offer.version) return NextResponse.json({ error: "Offer changed. Refresh before trying again." }, { status: 409 });
  try {
    if (["accept", "skip", "modify", "override"].includes(v.command)) {
      if (scenario.readings.some((item) => item.activityId === offer.activityId && item.eventId === offer.eventId)) throw new Error("This activity already has evidence. Verify it before starting another event.");
      scenario = decideOffer(scenario, offer.id, v.command as "accept" | "skip" | "modify" | "override", v.startSlot, v.version);
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
  if(!user) return NextResponse.json({error:"Sign in to use your consumer demo."},{status:401});
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

