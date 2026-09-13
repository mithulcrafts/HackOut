import { NextResponse } from "next/server";
import { z } from "zod";
import { getScenario, setScenario } from "@/lib/demo-store";
import { readDemoSession, setDemoCookie } from "@/lib/demo-cookie";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  offerId: z.string().trim().min(1).max(160),
  note: z.string().trim().max(500).optional(),
}).strict();

/**
 * Record a participant's request for operator assistance.  This is an audit
 * signal only: it never marks evidence verified and never releases a reward.
 */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose an accepted offer before requesting review." }, { status: 400 });

  const demoSession = await readDemoSession();
  if (demoSession && (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true")) {
    const scenario = getScenario(demoSession);
    const offer = scenario.offers.find((item) => item.id === parsed.data.offerId);
    if (!offer || offer.decision !== "accept") return NextResponse.json({ error: "Only an accepted offer can be sent for review." }, { status: 409 });
    const existing = (scenario.evidenceReviewRequests ?? []).find((item) => item.offerId === offer.id && item.status === "open");
    if (existing) {
      const response = NextResponse.json({ request: { id: existing.id, offer_id: existing.offerId, status: existing.status, created_at: existing.createdAt }, message: "Your review request is already in the operator queue." });
      setDemoCookie(response, demoSession);
      return response;
    }
    const requestRecord = {
      id: `evidence-review-${offer.id}-${crypto.randomUUID()}`,
      eventId: offer.eventId,
      offerId: offer.id,
      activityId: offer.activityId,
      note: parsed.data.note?.trim() || "Participant requested help with evidence or connection.",
      status: "open" as const,
      createdAt: new Date().toISOString(),
      data_source: "simulation" as const,
    };
    setScenario(demoSession, { ...scenario, evidenceReviewRequests: [...(scenario.evidenceReviewRequests ?? []), requestRecord] });
    const response = NextResponse.json({ request: { id: requestRecord.id, offer_id: requestRecord.offerId, status: requestRecord.status, created_at: requestRecord.createdAt }, message: "Request sent. An operator can review the evidence; no reward was released." }, { status: 201 });
    setDemoCookie(response, demoSession);
    return response;
  }

  // The authenticated path deliberately remains explicit until a durable
  // evidence-review table and operator workflow are connected. Never report a
  // successful persistence operation when that adapter is unavailable.
  let db;
  try { db = await createClient(); } catch { return NextResponse.json({ error: "Consumer storage is not configured for this environment." }, { status: 503 }); }
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to request an evidence review." }, { status: 401 });
  return NextResponse.json({ error: "Evidence review requests are available in the shared prototype session. An approved utility review queue is required for an authenticated production account." }, { status: 501 });
}
