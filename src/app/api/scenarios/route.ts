import { NextResponse } from "next/server";
import { getOrCreateDemoSession } from "@/lib/demo-cookie";
import { getScenario } from "@/lib/demo-store";
import { classifyBalance, dispatchBattery } from "@/domain/scheduling/engine";
import { summarizeScenario } from "@/domain/summary";

export async function GET() {
  const scenario = getScenario(await getOrCreateDemoSession());
  return NextResponse.json({ scenario, balances: classifyBalance(scenario.forecast, scenario.schedules, scenario.sitePowerLimitKW), battery: dispatchBattery(scenario.forecast, scenario.schedules, scenario.battery), summary: summarizeScenario(scenario), data_source: "simulation" });
}
