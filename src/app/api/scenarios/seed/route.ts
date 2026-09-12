import { NextResponse } from "next/server";
import { createDemoScenario } from "@/domain/fixtures";
import { getOrCreateDemoSession, setDemoCookie } from "@/lib/demo-cookie";
import { setScenario } from "@/lib/demo-store";

export async function POST() {
  const session = await getOrCreateDemoSession();
  const response = NextResponse.json({ scenario: setScenario(session, createDemoScenario()), message: "Deterministic demo scenario generated.", data_source: "simulation" });
  setDemoCookie(response, session);
  return response;
}
