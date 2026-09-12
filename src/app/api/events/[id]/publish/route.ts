import { NextResponse } from "next/server";
import { publishEvent } from "@/domain/events";
import { setDemoCookie } from "@/lib/demo-cookie";
import { getScenario, setScenario } from "@/lib/demo-store";
import { requireOperatorAccess } from "@/lib/operator-access";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOperatorAccess(_request);
  if (access.mode === "error") return access.response;
  const session = access.session;
  try {
    const scenario = getScenario(session);
    const published = publishEvent(scenario, (await params).id);
    const response = NextResponse.json({ scenario: setScenario(session, published), data_source: "simulation" });
    if (access.mode === "demo") setDemoCookie(response, session);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to publish event." }, { status: 404 });
  }
}
