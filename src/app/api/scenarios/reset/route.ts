import { NextResponse } from "next/server";
import { getOrCreateDemoSession, setDemoCookie } from "@/lib/demo-cookie";
import { resetScenario } from "@/lib/demo-store";
export async function POST() { const session = await getOrCreateDemoSession(); const response = NextResponse.json({ scenario: resetScenario(session), message: "Demo scenario reset.", data_source: "simulation" }); setDemoCookie(response, session); return response; }
