import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readDemoSession } from "@/lib/demo-cookie";
import { getScenario, setScenario } from "@/lib/demo-store";
import { demoActivityRecord, scheduleDemoActivity } from "@/lib/demo-activities";

const lifecycleSchema = z.object({ action: z.enum(["pause", "resume", "remove"]) });
const demoAllowed = () => process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = lifecycleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose pause, resume or remove." }, { status: 400 });
  const { action } = parsed.data;
  const demo = await readDemoSession();

  if (demo && demoAllowed() && !z.string().uuid().safeParse(id).success) {
    const current = getScenario(demo);
    const activity = current.activities.find((item) => item.id === id);
    if (!activity) return NextResponse.json({ error: "Activity not found." }, { status: 404 });
    const hasEvidence = current.readings.some((reading) => reading.activityId === id);
    const hasAccepted = current.schedules.some((schedule) => schedule.activityId === id && schedule.accepted) || current.offers.some((offer) => offer.activityId === id && offer.decision === "accept");
    if ((action === "pause" || action === "remove") && (hasEvidence || hasAccepted)) {
      return NextResponse.json({ error: "This activity has an accepted commitment or evidence. Finish or override it before changing participation." }, { status: 409 });
    }
    if (action === "remove") {
      setScenario(demo, {
        ...current,
        activities: current.activities.filter((item) => item.id !== id),
        schedules: current.schedules.filter((item) => item.activityId !== id),
        offers: current.offers.filter((item) => item.activityId !== id),
      });
      return NextResponse.json({ message: "Activity removed from this programme.", removed: true, data_source: "simulation" });
    }
    if (action === "pause") {
      setScenario(demo, {
        ...current,
        activities: current.activities.map((item) => item.id === id ? { ...item, status: "paused" as const } : item),
        schedules: current.schedules.filter((item) => item.activityId !== id),
        offers: current.offers.filter((item) => item.activityId !== id),
      });
      return NextResponse.json({ activity: demoActivityRecord({ ...activity, status: "paused" }, current.date), message: "Participation paused. No new offers will be created until you resume it.", data_source: "simulation" });
    }
    if (activity.status !== "paused") return NextResponse.json({ message: "This activity is already active.", activity: demoActivityRecord(activity, current.date), data_source: "simulation" });
    const resumed = { ...activity, status: "recommended" as const };
    const base = { ...current, activities: current.activities.filter((item) => item.id !== id), schedules: current.schedules.filter((item) => item.activityId !== id), offers: current.offers.filter((item) => item.activityId !== id) };
    const planned = scheduleDemoActivity(base, resumed);
    setScenario(demo, planned.scenario);
    return NextResponse.json({ activity: demoActivityRecord(resumed, current.date), offer: planned.offer, message: planned.offer ? "Participation resumed and a fresh offer is ready." : "Participation resumed. No safe programme window is available yet.", data_source: "simulation" });
  }

  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid activity link." }, { status: 400 });
  let db;
  try { db = await createClient(); } catch { return NextResponse.json({ error: "Activity storage is not configured for this environment." }, { status: 503 }); }
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage this activity." }, { status: 401 });
  const { data: activity, error: activityError } = await db.from("activities").select("id,status").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (activityError) return NextResponse.json({ error: "Activity storage is unavailable. Please retry." }, { status: 503 });
  if (!activity) return NextResponse.json({ error: "Activity not found." }, { status: 404 });
  const { data: offers, error: offersError } = await db.from("offers").select("decision").eq("activity_id", id).eq("owner_id", user.id);
  if (offersError) return NextResponse.json({ error: "Unable to check activity commitments." }, { status: 503 });
  const { count, error: readingsError } = await db.from("meter_readings").select("id", { count: "exact", head: true }).eq("activity_id", id).eq("owner_id", user.id);
  if (readingsError) return NextResponse.json({ error: "Unable to check activity evidence." }, { status: 503 });
  if ((action === "pause" || action === "remove") && ((offers ?? []).some((offer) => offer.decision === "accept") || (count ?? 0) > 0)) {
    return NextResponse.json({ error: "This activity has an accepted commitment or evidence. Finish or override it before changing participation." }, { status: 409 });
  }
  if (action === "remove") {
    const { error } = await db.from("activities").delete().eq("id", id).eq("owner_id", user.id);
    if (error) return NextResponse.json({ error: "Unable to remove activity." }, { status: 503 });
    return NextResponse.json({ message: "Activity removed from your account.", removed: true });
  }
  const nextStatus = action === "pause" ? "paused" : "recommended";
  const { data, error } = await db.from("activities").update({ status: nextStatus }).eq("id", id).eq("owner_id", user.id).select("id,status").single();
  if (error) return NextResponse.json({ error: error.code === "23514" ? "The database needs the activity lifecycle migration before pausing is available." : "Unable to update activity participation." }, { status: error.code === "23514" ? 503 : 503 });
  return NextResponse.json({ activity: data, message: action === "pause" ? "Participation paused. Resume it when you are ready." : "Participation resumed. A new recommendation will be created when a suitable event is available." });
}
