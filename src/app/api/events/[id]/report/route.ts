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
      const rows = [["metric", "value"], ...Object.entries(report.funnel)];
      return new Response(rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n") + "\n", { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="event-${id}-report.csv"` } });
    }
    return NextResponse.json(report);
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Event not found." }, { status: 404 }); }
}
