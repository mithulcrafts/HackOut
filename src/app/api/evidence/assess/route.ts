import { NextResponse } from "next/server";
import { assessEvidenceWithoutMutation, EvidenceInputError } from "@/domain/evidence-review";
import { getScenario } from "@/lib/demo-store";
import { readDemoSession } from "@/lib/demo-cookie";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const offerId = typeof form?.get("offerId") === "string" ? String(form.get("offerId")) : "";
  const file = form?.get("evidence");
  if (!offerId || !(file instanceof File)) return errorResponse("Choose an accepted offer and attach its CSV export.", 400);
  if (!file.name.toLowerCase().endsWith(".csv")) return errorResponse("Upload a CSV interval export. Photos and monthly bills cannot prove a time-window shift.", 400);
  if (file.size > 100_000) return errorResponse("Evidence file is too large (maximum 100 KB).", 413);
  const csv = await file.text();
  const demoSession = await readDemoSession();
  if (demoSession && (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true")) {
    try {
      const assessment = assessEvidenceWithoutMutation(getScenario(demoSession), offerId, csv, file.size);
      return NextResponse.json({ assessment, message: "Assessment complete. This user upload is untrusted evidence; no reward or schedule was changed." });
    } catch (error) {
      if (error instanceof EvidenceInputError) return errorResponse(error.message, 422);
      return errorResponse(error instanceof Error ? error.message : "Unable to assess this evidence.", 409);
    }
  }

  // Authenticated users must pass the verified Supabase session and authoritative RPC check.
  // The current account path has no approved meter adapter, so never pretend that a CSV is settled.
  let db;
  try { db = await createClient(); } catch { return errorResponse("Consumer storage is not configured for this environment.", 503); }
  const { data: { user } } = await db.auth.getUser();
  if (!user) return errorResponse("Sign in to upload evidence.", 401);
  const { data: snapshot, error } = await db.rpc("consumer_snapshot");
  if (error || !snapshot) return errorResponse("Consumer storage is unavailable. Please retry.", 503);
  const offers = Array.isArray(snapshot.offers) ? snapshot.offers : [];
  const offer = offers.find((item: { id?: string }) => item.id === offerId);
  if (!offer || offer.decision !== "accept") return errorResponse("Choose an accepted offer from your account.", 409);
  return errorResponse("This account has no approved meter or charger connection yet. Uploaded evidence is available for review; it cannot release a reward until its source is trusted.", 501);
}
