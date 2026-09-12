import { NextResponse } from "next/server";
import { eventReport } from "@/domain/events";
import { getScenario } from "@/lib/demo-store";
import { requireOperatorAccess } from "@/lib/operator-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOperatorAccess(_request);
  if (access.mode === "error") return access.response;
  try { return NextResponse.json(eventReport(getScenario(access.session), (await params).id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Event not found." }, { status: 404 }); }
}
