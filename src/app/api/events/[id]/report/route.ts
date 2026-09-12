import { NextResponse } from "next/server";
import { eventReport } from "@/domain/events";
import { getOrCreateDemoSession } from "@/lib/demo-cookie";
import { getScenario } from "@/lib/demo-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(eventReport(getScenario(await getOrCreateDemoSession()), (await params).id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Event not found." }, { status: 404 }); }
}
