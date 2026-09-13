import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rewardSummary } from "@/lib/consumer-metrics";
import { readDemoSession } from "@/lib/demo-cookie";
import { demoRewardEntries, redeemDemo } from "@/lib/consumer-server";
import { getScenario } from "@/lib/demo-store";

export async function GET() {
  const demo = await readDemoSession();
  if (demo && (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true")) {
    const scenario = getScenario(demo);
    const entries = demoRewardEntries(demo);
    const history = Object.entries(scenario.results ?? {}).map(([offerId, result]) => ({ id: `demo-verification-${offerId}`, offer_id: offerId, status: result.outcome, reason: result.reason, recorded_kwh: result.recordedEnergyKWh, eligible_kwh: result.eligibleShiftedKWh, baseline_kwh: result.requiredEnergyKWh, created_at: result.createdAt }));
    return NextResponse.json({ ...rewardSummary(entries, history), entries, history });
  }
  let db;
  try {
    db = await createClient();
  } catch {
    return NextResponse.json({ error: "Reward storage is not configured for this environment." }, { status: 503 });
  }
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view rewards." }, { status: 401 });
  const [ledger, history] = await Promise.all([
    db.from("reward_ledger").select("id,offer_id,points,illustrative_rupees,state,created_at").eq("owner_id", user.id).order("created_at", { ascending: false }),
    db.from("verifications").select("id,offer_id,status,reason,recorded_kwh,eligible_kwh,baseline_kwh,created_at").eq("owner_id", user.id).order("created_at", { ascending: false }),
  ]);
  if (ledger.error || history.error) return NextResponse.json({ error: "Rewards storage is unavailable. Apply the consumer migration." }, { status: 503 });
  return NextResponse.json({ ...rewardSummary(ledger.data ?? [], history.data ?? []), entries: ledger.data ?? [], history: history.data ?? [] });
}

export async function POST(request: Request) {
  const demo = await readDemoSession();
  const parsed = z.object({ rewardId: z.string().min(1) }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid reward." }, { status: 400 });
  if (demo && (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true")) {
    if (!getScenario(demo).rewardLedger?.some((entry) => entry.id === parsed.data.rewardId)) return NextResponse.json({ error: "That verified reward is not available." }, { status: 404 });
    redeemDemo(demo, parsed.data.rewardId); return NextResponse.json({ message: "Verified points are now available in your wallet. Cash values remain estimates." });
  }
  if (!z.string().uuid().safeParse(parsed.data.rewardId).success) return NextResponse.json({ error: "Choose a valid reward." }, { status: 400 });
  let db;
  try {
    db = await createClient();
  } catch {
    return NextResponse.json({ error: "Reward storage is not configured for this environment." }, { status: 503 });
  }
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { error } = await db.rpc("release_demo_reward", { target_reward: parsed.data.rewardId });
  if (error) return NextResponse.json({ error: "Reward could not be released. Refresh and check that it is verified." }, { status: 409 });
  return NextResponse.json({ message: "Verified points are now available in your wallet. Cash values remain estimates." });
}
