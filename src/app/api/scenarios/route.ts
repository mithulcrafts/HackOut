import { NextResponse } from "next/server";
import { getScenario } from "@/lib/demo-store";
import { classifyBalance, dispatchBattery } from "@/domain/scheduling/engine";
import { effectiveSchedules, summarizeScenario } from "@/domain/summary";
import { requireOperatorAccess } from "@/lib/operator-access";
import { rankGridRecommendations } from "@/domain/grid-recommendations";

export async function GET(request: Request) {
  const access = await requireOperatorAccess(request);
  if (access.mode === "error") return access.response;
  const scenario = getScenario(access.session);
  const schedules = effectiveSchedules(scenario);
  return NextResponse.json({ scenario, balances: classifyBalance(scenario.forecast, schedules, scenario.sitePowerLimitKW), battery: dispatchBattery(scenario.forecast, schedules, scenario.battery), recommendations: rankGridRecommendations(scenario), summary: summarizeScenario(scenario), data_source: "simulation" });
}
