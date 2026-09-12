import { NextResponse } from "next/server";
import { getScenario } from "@/lib/demo-store";
import { requireOperatorAccess } from "@/lib/operator-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOperatorAccess(_request);
  if (access.mode === "error") return access.response;
  const scenario = getScenario(access.session);
  const id = (await params).id;
  const offers = scenario.offers.filter((offer) => offer.eventId === id);
  return NextResponse.json({ participants: offers.map((offer) => ({ activityId: offer.activityId, status: offer.status, decision: offer.decision, proposedStart: offer.proposedStart, proposedEnd: offer.proposedEnd })), data_source: "simulation" });
}
