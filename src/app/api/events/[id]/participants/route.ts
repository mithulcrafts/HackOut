import { NextResponse } from "next/server";
import { eventReport } from "@/domain/events";
import { getScenario } from "@/lib/demo-store";
import { requireOperatorAccess } from "@/lib/operator-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOperatorAccess(_request);
  if (access.mode === "error") return access.response;
  try {
    const scenario = getScenario(access.session);
    const id = (await params).id;
    const offers = scenario.offers.filter((offer) => offer.eventId === id);
    const report = eventReport(scenario, id);
    return NextResponse.json({
    participants: offers.map((offer) => {
      const result = scenario.results?.[offer.id] ?? scenario.results?.[offer.activityId];
      const reward = scenario.rewardLedger?.find((entry) => entry.offerId === offer.id);
      const activity = scenario.activities.find((item) => item.id === offer.activityId);
      return {
        activityId: offer.activityId,
        name: activity?.name ?? "Flexible activity",
        status: offer.status,
        decision: offer.decision,
        proposedStart: offer.proposedStart,
        proposedEnd: offer.proposedEnd,
        verification: result?.outcome ?? null,
        rewardRupees: reward?.illustrativeRupees ?? 0,
      };
    }),
    summary: {
      offersSent: report.funnel.recommended,
      accepted: report.funnel.accepted,
      completed: report.funnel.completed,
      verified: report.funnel.verified,
      pendingReadings: report.pendingReadings,
      failedOrPartial: report.failed,
      acceptedKW: report.acceptedKW,
      verifiedKW: report.verifiedKW,
      shiftedKWh: report.shiftedKWh,
      rewardCost: report.rewardCost,
    },
      data_source: "simulation",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Event not found." }, { status: 404 });
  }
}
