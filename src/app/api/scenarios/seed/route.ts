import { NextResponse } from "next/server";
import { createDemoScenario } from "@/domain/fixtures";
import { setDemoCookie } from "@/lib/demo-cookie";
import { setScenario } from "@/lib/demo-store";
import { requireOperatorAccess } from "@/lib/operator-access";

export async function POST(request: Request) {
  const access = await requireOperatorAccess(request);
  if (access.mode === "error") return access.response;
  const session = access.session;
  const response = NextResponse.json({ scenario: setScenario(session, createDemoScenario()), message: "Deterministic scenario generated.", data_source: "simulation" });
  if (access.mode === "demo") setDemoCookie(response, session);
  return response;
}
