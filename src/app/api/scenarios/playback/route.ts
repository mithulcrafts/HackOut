import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateDemoSession, setDemoCookie } from "@/lib/demo-cookie";
import { getScenario, setScenario } from "@/lib/demo-store";
import type { MeterReading } from "@/domain/types";

const playbackSchema = z.object({ activityId: z.string().min(1), outcome: z.enum(["success", "partial", "late", "missing"]).default("success") });

export async function POST(request: Request) {
  const parsed = playbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "activityId and a supported playback outcome are required." }, { status: 400 });
  const session = await getOrCreateDemoSession();
  const scenario = getScenario(session);
  const activity = scenario.activities.find((item) => item.id === parsed.data.activityId);
  if (!activity) return NextResponse.json({ error: "Activity not found." }, { status: 404 });
  if (parsed.data.outcome === "missing") return NextResponse.json({ verificationStatus: "pending", message: "Verification is pending because activity data has not been received.", data_source: "simulation" });
  const schedule = scenario.schedules.find((item) => item.activityId === activity.id && item.accepted);
  if (!schedule) return NextResponse.json({ error: "Only an accepted activity can be played back." }, { status: 409 });
  const multiplier = parsed.data.outcome === "partial" ? 0.55 : parsed.data.outcome === "late" ? 1 : 1;
  const endHour = Math.floor((schedule.endSlot + (parsed.data.outcome === "late" ? 2 : 0)) / 2).toString().padStart(2, "0");
  const endMinute = (schedule.endSlot + (parsed.data.outcome === "late" ? 2 : 0)) % 2 ? "30" : "00";
  const reading: MeterReading = { id: "reading-" + Date.now(), eventId: "event-absorb-demo", activityId: activity.id, deviceId: "simulator", timestamp: scenario.date + "T" + endHour + ":" + endMinute + ":00+05:30", cumulativeKWh: Number((activity.requiredEnergyKWh * multiplier).toFixed(2)), serviceComplete: parsed.data.outcome !== "partial", readingKey: "playback-" + Date.now(), data_source: "simulation" };
  const updated = { ...scenario, readings: [...scenario.readings, reading] };
  const response = NextResponse.json({ reading, verificationStatus: "pending", message: "Simulated reading received. Verification remains a server-side trust-track operation.", data_source: "simulation" });
  setScenario(session, updated);
  setDemoCookie(response, session);
  return response;
}
