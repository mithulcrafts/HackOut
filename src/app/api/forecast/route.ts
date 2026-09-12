import { NextResponse } from "next/server";
import { getScenario } from "@/lib/demo-store";
import { classifyBalance } from "@/domain/scheduling/engine";
import { requireOperatorAccess } from "@/lib/operator-access";
import { effectiveSchedules } from "@/domain/summary";

export async function GET(request: Request) {
  const access = await requireOperatorAccess(request);
  if (access.mode === "error") return access.response;
  const scenario = getScenario(access.session);
  return NextResponse.json({ forecast: scenario.forecast, balances: classifyBalance(scenario.forecast, effectiveSchedules(scenario), scenario.sitePowerLimitKW), timezone: scenario.timezone, data_source: "simulation" });
}
