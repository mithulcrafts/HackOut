import { NextResponse } from "next/server";
import { eventReport } from "@/domain/events";
import { getScenario } from "@/lib/demo-store";
import { requireOperatorAccess } from "@/lib/operator-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOperatorAccess(_request);
  if (access.mode === "error") return access.response;
  try {
    const id = (await params).id;
    const report = eventReport(getScenario(access.session), id);
    if (new URL(_request.url).searchParams.get("format") === "csv") {
      const rows = [
        ["metric", "value"],
        ...Object.entries(report.funnel),
        ["requested_kw", report.requestedKW],
        ["accepted_kw", report.acceptedKW],
        ["verified_kw", report.verifiedKW],
        ["shifted_kwh", report.shiftedKWh],
        ["renewable_aligned_consumption_kwh", report.renewableAlignedConsumptionKWh],
        ["peak_reduction_kw", report.peakReductionKW],
        ["peak_reduction_percent", report.peakReductionPercent],
        ["participant_count", report.participantCount],
        ["reward_cost_inr", report.rewardCost],
        ["pending_reward_cost_inr", report.pendingRewardCost],
        ["failed_or_partial", report.failed],
        ["disputed_activities", report.disputedActivities],
        ["acceptance_rate_percent", report.acceptanceRate],
        ["pending_readings", report.pendingReadings],
        ["unresolved_gap_kw", report.unresolvedGapKW],
      ];
      return new Response(rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n") + "\n", { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="event-${id}-report.csv"` } });
    }
    return NextResponse.json(report);
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Event not found." }, { status: 404 }); }
}
