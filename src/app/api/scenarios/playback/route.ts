import { NextResponse } from "next/server";
import { z } from "zod";
import { setDemoCookie } from "@/lib/demo-cookie";
import { getScenario, setScenario } from "@/lib/demo-store";
import { recordSimulatedOffer, verifyScenarioOffer } from "@/domain/playback";
import { requireOperatorAccess } from "@/lib/operator-access";

// The UI calls this endpoint when an operator reviews an accepted activity.
// Keep the outcome field optional for backwards-compatible internal fixtures,
// but prefer existing provider evidence whenever it is already available.
const playbackSchema = z.object({ activityId: z.string().min(1).max(120), outcome: z.enum(["success", "partial", "late", "missing", "rebound"]).default("success") }).strict();

export async function POST(request: Request) {
  const access = await requireOperatorAccess(request);
  if (access.mode === "error") return access.response;
  const parsed = playbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid accepted activity to review." }, { status: 400 });
  const scenario = getScenario(access.session);
  const offer = scenario.offers.find((item) => item.activityId === parsed.data.activityId && item.decision === "accept");
  if (!offer) return NextResponse.json({ error: "Accept this activity before reviewing its reading." }, { status: 409 });
  try {
    const hasEvidence = scenario.readings.some((reading) => reading.activityId === offer.activityId && reading.eventId === offer.eventId);
    // A real meter/charger adapter will populate readings before this review.
    // Until one is connected, the scenario provider supplies the labelled
    // planning trace so the complete product loop remains usable offline.
    const withEvidence = hasEvidence ? scenario : recordSimulatedOffer(scenario, offer.id, parsed.data.outcome);
    const updated = setScenario(access.session, verifyScenarioOffer(withEvidence, offer.id));
    const verification = updated.results![offer.id];
    const readings = updated.readings.filter((item) => item.activityId === offer.activityId && item.eventId === offer.eventId);
    const response = NextResponse.json({ scenario: updated, reading: readings.at(-1) ?? null, readingCount: readings.length, verification, verificationStatus: verification.outcome, message: verification.reason, data_source: "simulation" });
    if (access.mode === "demo") setDemoCookie(response, access.session);
    return response;
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "The evidence review could not be completed." }, { status: 409 }); }
}
