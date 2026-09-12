import { NextResponse } from "next/server";
import { z } from "zod";
import { createEvent } from "@/domain/events";
import { getOrCreateDemoSession, setDemoCookie } from "@/lib/demo-cookie";
import { getScenario, setScenario } from "@/lib/demo-store";

const eventSchema = z.object({
  name: z.string().trim().min(3).max(80),
  objective: z.enum(["absorb", "protect"]),
  windowStart: z.number().int().min(0).max(47),
  windowEnd: z.number().int().min(1).max(48),
  requestedFlexibilityKW: z.number().positive().max(10000),
  eligibleActivityTypes: z.array(z.enum(["ev", "water_heater", "industrial_process"])).min(1),
  rewardRatePerKWh: z.number().min(0).max(100),
  budget: z.number().nonnegative().max(1_000_000),
  offerExpiresAt: z.string().datetime({ offset: true }),
}).refine((value) => value.windowEnd > value.windowStart, { message: "Event window must end after it starts.", path: ["windowEnd"] });

export async function GET() {
  const session = await getOrCreateDemoSession();
  const scenario = getScenario(session);
  return NextResponse.json({ events: scenario.events, data_source: "simulation" });
}

export async function POST(request: Request) {
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid event", details: parsed.error.flatten() }, { status: 400 });
  const session = await getOrCreateDemoSession();
  const scenario = getScenario(session);
  const event = createEvent(parsed.data);
  const response = NextResponse.json({ event: setScenario(session, { ...scenario, events: [...scenario.events, event] }).events.at(-1), data_source: "simulation" }, { status: 201 });
  setDemoCookie(response, session);
  return response;
}
