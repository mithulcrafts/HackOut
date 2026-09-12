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
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view activity details." }, { status: 401 });
  const { data: activity, error } = await db.from("activities")
    .select("id,name,type,earliest_start,latest_finish,duration_minutes,interruptible,status,created_at")
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
