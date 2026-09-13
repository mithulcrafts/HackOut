import { NextResponse } from "next/server";
import { z } from "zod";
import { createEvent, publishEvent } from "@/domain/events";
import { getScenario } from "@/lib/demo-store";
import { requireOperatorAccess } from "@/lib/operator-access";

const eventSchema = z.object({
  name: z.string().trim().min(3).max(80),
  objective: z.enum(["absorb", "protect"]),
  windowStart: z.number().int().min(0).max(47),
  windowEnd: z.number().int().min(1).max(48),
  requestedFlexibilityKW: z.number().positive().max(10000),
  eligibleActivityTypes: z.array(z.enum(["ev", "water_heater", "industrial_process", "washing_machine", "dishwasher", "irrigation_pump", "pool_pump", "cold_storage", "e_bike", "custom"])).min(1),
  participantGroup: z.string().trim().min(2).max(80).default("All enrolled participants"),
  minParticipants: z.number().int().min(0).max(100000).default(0),
  maxParticipants: z.number().int().min(1).max(100000).optional(),
  rewardRatePerKWh: z.number().min(0).max(100),
  budget: z.number().nonnegative().max(1_000_000),
  offerExpiresAt: z.string().datetime({ offset: true }),
}).refine((value) => value.windowEnd > value.windowStart, { message: "Event window must end after it starts.", path: ["windowEnd"] }).refine((value) => value.maxParticipants === undefined || value.maxParticipants >= value.minParticipants, { message: "Maximum participation must be at least the minimum.", path: ["maxParticipants"] });

/** Project an event against a copy of the current scenario. This endpoint has no write path. */
export async function POST(request: Request) {
  const access = await requireOperatorAccess(request);
  if (access.mode === "error") return access.response;
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid event window, flexibility target, reward rate and budget." }, { status: 400 });
  try {
    const scenario = getScenario(access.session);
    const event = createEvent(parsed.data, `preview-${crypto.randomUUID()}`);
    const projected = publishEvent({ ...scenario, events: [...scenario.events, event] }, event.id);
    const offers = projected.offers.filter((offer) => offer.eventId === event.id);
    const offerActivityIds = new Set(offers.map((offer) => offer.activityId));
    const eligibleActivities = scenario.activities.filter((activity) => event.eligibleActivityTypes.includes(activity.type));
    const projectedEnergyKWh = offers.reduce((sum, offer) => sum + (event.rewardRatePerKWh > 0 ? offer.rewardEstimate / event.rewardRatePerKWh : 0), 0);
    const rewardCost = offers.reduce((sum, offer) => sum + offer.rewardEstimate, 0);
    return NextResponse.json({
      preview: {
        eligibleParticipants: eligibleActivities.length,
        offerCount: offers.length,
        participantGroup: event.participantGroup,
        minParticipants: event.minParticipants,
        maxParticipants: event.maxParticipants ?? null,
        minParticipationMet: offers.length >= (event.minParticipants ?? 0),
        participationGap: Math.max(0, (event.minParticipants ?? 0) - offers.length),
        projectedShiftedEnergyKWh: Number(projectedEnergyKWh.toFixed(2)),
        estimatedRewardCost: Number(rewardCost.toFixed(2)),
        requestedFlexibilityKW: event.requestedFlexibilityKW,
        uncoveredEligibleActivities: eligibleActivities.filter((activity) => !offerActivityIds.has(activity.id)).map((activity) => ({ id: activity.id, name: activity.name, reason: "No safe window met the event, deadline or site-capacity constraints." })),
        data_source: "simulation",
      },
      data_source: "simulation",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to calculate an event preview." }, { status: 400 });
  }
}
