import { NextResponse } from "next/server";
import { z } from "zod";
import { createEvent, validateEvent } from "@/domain/events";
import { setDemoCookie } from "@/lib/demo-cookie";
import { getScenario, setScenario } from "@/lib/demo-store";
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

export async function GET(request: Request) {
  const access = await requireOperatorAccess(request);
  if (access.mode === "error") return access.response;
  const session = access.session;
  const scenario = getScenario(session);
  return NextResponse.json({ events: scenario.events, data_source: "simulation" });
}

export async function POST(request: Request) {
  const access = await requireOperatorAccess(request);
  if (access.mode === "error") return access.response;
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid event", details: parsed.error.flatten() }, { status: 400 });
  const session = access.session;
  const scenario = getScenario(session);
  const event = createEvent(parsed.data);
  try {
    // Keep the persisted draft valid for the same scenario clock and terms
    // enforced by publish/preview. This prevents an invalid draft from
    // reaching the event list and failing only much later at publication.
    validateEvent(scenario, event);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid event terms." }, { status: 400 });
  }
  const response = NextResponse.json({ event: setScenario(session, { ...scenario, events: [...scenario.events, event] }).events.at(-1), data_source: "simulation" }, { status: 201 });
  if (access.mode === "demo") setDemoCookie(response, session);
  return response;
}
