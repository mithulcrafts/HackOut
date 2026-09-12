import { NextResponse } from "next/server";
import { getOrCreateDemoSession } from "@/lib/demo-cookie";
import { getScenario } from "@/lib/demo-store";
import { classifyBalance } from "@/domain/scheduling/engine";

export async function GET() {
  const scenario = getScenario(await getOrCreateDemoSession());
  return NextResponse.json({ forecast: scenario.forecast, balances: classifyBalance(scenario.forecast, scenario.schedules, scenario.sitePowerLimitKW), timezone: scenario.timezone, data_source: "simulation" });
}
