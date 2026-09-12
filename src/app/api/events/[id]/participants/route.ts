import { NextResponse } from "next/server";
import { getOrCreateDemoSession } from "@/lib/demo-cookie";
import { getScenario } from "@/lib/demo-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const scenario = getScenario(await getOrCreateDemoSession());
  const id = (await params).id;
  const offers = scenario.offers.filter((offer) => offer.eventId === id);
  return NextResponse.json({ participants: offers.map((offer) => ({ activityId: offer.activityId, status: offer.status, decision: offer.decision, proposedStart: offer.proposedStart, proposedEnd: offer.proposedEnd })), data_source: "simulation" });
}
