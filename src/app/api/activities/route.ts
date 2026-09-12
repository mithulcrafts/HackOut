import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { activityInputSchema } from "@/lib/activities";
import { activityDatabaseError } from "@/lib/activity-errors";

function databaseFailure(code: string) {
  console.error("Activity database request failed", { code });
  const failure = activityDatabaseError(code);
  return NextResponse.json({ error: failure.error }, { status: failure.status });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view activities." }, { status: 401 });
  const { data, error } = await supabase.from("activities").select("id,type,name,earliest_start,latest_finish,duration_minutes,interruptible,status,created_at").eq("owner_id", user.id).order("created_at", { ascending: false });
  if (error) return databaseFailure(error.code);
  return NextResponse.json({ activities: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to save an activity." }, { status: 401 });
  const parsed = activityInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid activity." }, { status: 400 });
  const v = parsed.data;
  const powerKW = v.type === "EV charging" ? 4 : v.type === "Water heating" ? 2 : v.type === "Industrial process" ? 10 : 1;
  const { data, error } = await supabase.from("activities").insert({ owner_id: user.id, type: v.type, name: v.name, earliest_start: v.earliestStart, latest_finish: v.latestFinish, baseline_start:v.earliestStart, duration_minutes: Math.round(v.durationHours * 60), interruptible: v.interruptible, power_kw:powerKW, required_kwh:powerKW*v.durationHours, status: "recommended" }).select("id,type,name,earliest_start,latest_finish,duration_minutes,interruptible,status,created_at,power_kw,required_kwh").single();
  if (error) return databaseFailure(error.code);
  return NextResponse.json({ activity: data }, { status: 201 });
}
