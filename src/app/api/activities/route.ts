import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { activityInputSchema } from "@/lib/activities";
import { activityDatabaseError } from "@/lib/activity-errors";
import { readDemoSession } from "@/lib/demo-cookie";
import { getScenario, setScenario } from "@/lib/demo-store";
import { scheduleDemoActivity, demoActivityRecord } from "@/lib/demo-activities";
import type { Activity as DomainActivity, ActivityType as DomainActivityType } from "@/domain/types";
import { addActivityToScenario, scheduleSavedActivities } from "@/lib/activity-integration";
import { activityDefaults, activityTypeMap } from "@/lib/activities";

function databaseFailure(code: string) {
  console.error("Activity database request failed", { code });
  const failure = activityDatabaseError(code);
  return NextResponse.json({ error: failure.error }, { status: failure.status });
}

const demoTypes: Record<string, DomainActivityType> = activityTypeMap;

function slotFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 2 + minutes / 30;
}

export async function GET() {
  const demo = await readDemoSession();
  if (demo && (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true")) {
    const scenario = getScenario(demo);
    const activities = scenario.activities.map((activity) => demoActivityRecord(activity, scenario.date));
    return NextResponse.json({ activities, schedulePreview: scheduleSavedActivities(activities, scenario) });
  }
  let supabase;
  try { supabase = await createClient(); } catch { return NextResponse.json({ error: "Activity storage is not configured for this environment." }, { status: 503 }); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view activities." }, { status: 401 });
  const { data, error } = await supabase.from("activities").select("id,type,name,earliest_start,latest_finish,baseline_start,duration_minutes,interruptible,status,created_at,power_kw,required_kwh").eq("owner_id", user.id).order("created_at", { ascending: false });
  if (error) return databaseFailure(error.code);
  const activities = data ?? [];
  return NextResponse.json({ activities, schedulePreview: scheduleSavedActivities(activities, getScenario(`operator-${user.id}`)) });
}

export async function POST(request: Request) {
  const demo = await readDemoSession();
  if (demo && (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true")) {
    const parsed = activityInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid activity." }, { status: 400 });
    const v = parsed.data;
    const domainType = demoTypes[v.type];
    if (!domainType) return NextResponse.json({ error: "Choose a supported flexible activity." }, { status: 400 });
    const earliest = slotFromTime(v.earliestStart); const latest = slotFromTime(v.latestFinish);
    if (![earliest, latest].every(Number.isInteger) || earliest < 0 || latest > 48 || latest <= earliest) return NextResponse.json({ error: "Use 30-minute times within the simulated day." }, { status: 400 });
    const power = v.powerKW ?? activityDefaults[v.type as keyof typeof activityDefaults]?.power;
    if (!power) return NextResponse.json({ error: "Enter the expected power for this activity." }, { status: 400 });
    const activity: DomainActivity = { id: `activity-${crypto.randomUUID()}`, name: v.name, type: domainType, requiredEnergyKWh: Number((power * v.durationHours).toFixed(2)), earliestStart: earliest, latestFinish: latest, powerLimitKW: power, durationSlots: Math.round(v.durationHours * 2), interruptible: v.interruptible, baselineStart: earliest, status: "recommended" };
    const result = scheduleDemoActivity(getScenario(demo), activity);
    setScenario(demo, result.scenario);
    const record = demoActivityRecord(activity, result.scenario.date);
    const response = NextResponse.json({ activity: record, schedulePreview: scheduleSavedActivities([record], result.scenario), offer: result.offer, data_source: "simulation", message: result.message }, { status: 201 });
    return response;
  }
  let supabase;
  try { supabase = await createClient(); } catch { return NextResponse.json({ error: "Activity storage is not configured for this environment." }, { status: 503 }); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to save an activity." }, { status: 401 });
  const parsed = activityInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid activity." }, { status: 400 });
  const v = parsed.data;
  const powerKW = v.powerKW ?? activityDefaults[v.type as keyof typeof activityDefaults]?.power ?? 1;
  const { data, error } = await supabase.from("activities").insert({ owner_id: user.id, type: v.type, name: v.name, earliest_start: v.earliestStart, latest_finish: v.latestFinish, baseline_start:v.earliestStart, duration_minutes: Math.round(v.durationHours * 60), interruptible: v.interruptible, power_kw:powerKW, required_kwh:powerKW*v.durationHours, status: "recommended" }).select("id,type,name,earliest_start,latest_finish,duration_minutes,interruptible,status,created_at,power_kw,required_kwh").single();
  if (error) return databaseFailure(error.code);
  const { data: offer, error: offerError } = await supabase.rpc("create_consumer_offer", { target_activity: data.id });
  if (offerError) return databaseFailure(offerError.code);
  const session = `operator-${user.id}`;
  const scenario = addActivityToScenario(data, getScenario(session));
  setScenario(session, scenario);
  return NextResponse.json({ activity: data, offer, schedulePreview: scheduleSavedActivities([data], scenario) }, { status: 201 });
}

