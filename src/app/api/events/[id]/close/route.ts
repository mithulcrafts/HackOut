import { NextResponse } from "next/server";
import { closeEvent } from "@/domain/events";
import { getOrCreateDemoSession, setDemoCookie } from "@/lib/demo-cookie";
import { getScenario, setScenario } from "@/lib/demo-store";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOrCreateDemoSession();
  try {
    const scenario = getScenario(session);
    const closed = closeEvent(scenario, (await params).id);
    const response = NextResponse.json({ scenario: setScenario(session, closed), data_source: "simulation" });
    setDemoCookie(response, session);
    return response;
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to close event." }, { status: 404 }); }
}
