import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { activityDatabaseError } from "@/lib/activity-errors";

function storageError(code: string) {
  const failure = activityDatabaseError(code);
  return NextResponse.json({ error: failure.error }, { status: failure.status });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid activity link." }, { status: 400 });
  let db;
  try { db = await createClient(); } catch { return storageError("STORAGE_UNCONFIGURED"); }
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view activity details." }, { status: 401 });
  const { data: activity, error } = await db.from("activities")
    .select("id,name,type,earliest_start,latest_finish,baseline_start,duration_minutes,interruptible,status,created_at,power_kw,required_kwh")
    .eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (error) return storageError(error.code);
  // Same response for absent and other users' records.
  if (!activity) return NextResponse.json({ error: "Activity not found." }, { status: 404 });
  const result = await db.from("offers")
    .select("id,name,source,version,decision,baseline_start,proposed_start,duration_slots,deadline_slot,required_kwh,power_kw,simulation_run,completion_slot")
    .eq("activity_id", id).eq("owner_id", user.id).order("created_at", { ascending: false });
  if (result.error) return storageError(result.error.code);
  const offers = [];
  for (const offer of result.data ?? []) {
    const [readings, verification, rewards] = await Promise.all([
      db.from("meter_readings").select("slot,cumulative_kwh").eq("offer_id", offer.id).eq("owner_id", user.id).order("slot"),
      db.from("verifications").select("status,reason,recorded_kwh,eligible_kwh,baseline_kwh,created_at").eq("offer_id", offer.id).eq("owner_id", user.id).maybeSingle(),
      db.from("reward_ledger").select("id,points,illustrative_rupees,state,created_at").eq("offer_id", offer.id).eq("owner_id", user.id),
    ]);
    const evidenceError = readings.error ?? verification.error ?? rewards.error;
    if (evidenceError) return storageError(evidenceError.code);
    offers.push({ offer, readings: readings.data ?? [], verification: verification.data, rewards: rewards.data ?? [] });
  }
  return NextResponse.json({ activity, offers });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid activity link." }, { status: 400 });
  let db;
  try { db = await createClient(); } catch { return storageError("STORAGE_UNCONFIGURED"); }
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update activities." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = z.object({ type: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(80), earliestStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), latestFinish: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), durationHours: z.coerce.number().min(.5).max(12).refine((value) => Number.isInteger(value * 2), "Duration must use 30-minute increments."), interruptible: z.boolean(), powerKW: z.coerce.number().positive().max(500) }).strict().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the activity timing and power limit." }, { status: 400 });
  const v=parsed.data; const minutes=Math.round(v.durationHours*60);
  const { data: existing, error: existingError } = await db.from("activities").select("baseline_start,earliest_start").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (existingError) return storageError(existingError.code);
  if (!existing) return NextResponse.json({ error: "Activity not found." }, { status: 404 });
  const baselineStart = existing.baseline_start ?? existing.earliest_start;
  const { data, error } = await db.rpc("edit_consumer_activity", { target_id:id, activity_data:{type:v.type,name:v.name,earliest_start:v.earliestStart,latest_finish:v.latestFinish,baseline_start:baselineStart,duration_minutes:minutes,interruptible:v.interruptible,power_kw:v.powerKW} });
  if(error) return NextResponse.json({ error: error.code === "P0002" ? "Activity not found." : error.message.includes("linked offer") ? error.message : "Unable to update activity." }, { status: error.code === "P0002" ? 404 : 409 });
  return NextResponse.json({ activity:data });
}
