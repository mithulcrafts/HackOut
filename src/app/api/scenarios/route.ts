import { NextResponse } from "next/server";
import { getScenario, setScenario } from "@/lib/demo-store";
import { classifyBalance, dispatchBattery } from "@/domain/scheduling/engine";
import { effectiveSchedules, summarizeScenario } from "@/domain/summary";
import { requireOperatorAccess } from "@/lib/operator-access";
import { rankGridRecommendations } from "@/domain/grid-recommendations";
import { applyScenarioSettings } from "@/domain/scenario-settings";
import { setDemoCookie } from "@/lib/demo-cookie";
import { z } from "zod";

const settingsSchema = z.object({
  sitePowerLimitKW: z.number().positive().max(100_000),
  batteryCapacityKWh: z.number().positive().max(100_000),
  batteryCurrentKWh: z.number().nonnegative().max(100_000),
  maxChargeKW: z.number().nonnegative().max(100_000),
  maxDischargeKW: z.number().nonnegative().max(100_000),
  roundTripEfficiency: z.number().min(0.5).max(1),
  rewardRatePerKWh: z.number().nonnegative().max(100),
  draftEventBudget: z.number().nonnegative().max(1_000_000),
}).strict();

export async function GET(request: Request) {
  const access = await requireOperatorAccess(request);
  if (access.mode === "error") return access.response;
  const scenario = getScenario(access.session);
  const schedules = effectiveSchedules(scenario);
  return NextResponse.json({ scenario, balances: classifyBalance(scenario.forecast, schedules, scenario.sitePowerLimitKW), battery: dispatchBattery(scenario.forecast, schedules, scenario.battery), recommendations: rankGridRecommendations(scenario), summary: summarizeScenario(scenario), data_source: scenario.data_source });
}

export async function PATCH(request: Request) {
  const access = await requireOperatorAccess(request);
  if (access.mode === "error") return access.response;
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid positive operating limits, a 50–100% battery efficiency and a non-negative reward budget." }, { status: 400 });
  try {
    const updated = setScenario(access.session, applyScenarioSettings(getScenario(access.session), parsed.data));
    const response = NextResponse.json({ scenario: updated, message: "Operating settings saved. Existing published offer terms were preserved.", data_source: updated.data_source });
    if (access.mode === "demo") setDemoCookie(response, access.session);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save operating settings." }, { status: 409 });
  }
}
