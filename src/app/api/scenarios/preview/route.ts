import { NextResponse } from "next/server";
import { createDemoScenario } from "@/domain/fixtures";
import { getScenario } from "@/lib/demo-store";
import { classifyBalance } from "@/domain/scheduling/engine";
import { z } from "zod";
import { requireOperatorAccess } from "@/lib/operator-access";
import { effectiveSchedules } from "@/domain/summary";

const previewSchema = z.object({ renewableMultiplier: z.number().min(0).max(3).default(1), demandMultiplier: z.number().min(0).max(3).default(1) });

export async function POST(request: Request) {
  const access = await requireOperatorAccess(request);
  if (access.mode === "error") return access.response;
  const parsed = previewSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Multipliers must be numbers between 0 and 3." }, { status: 400 });
  const { renewableMultiplier, demandMultiplier } = parsed.data;
  const base = getScenario(access.session) ?? createDemoScenario();
  const forecast = base.forecast.map((slot) => ({ ...slot, solarKW: slot.solarKW * renewableMultiplier, windKW: slot.windKW * renewableMultiplier, renewableKW: slot.renewableKW * renewableMultiplier, fixedDemandKW: slot.fixedDemandKW * demandMultiplier }));
  return NextResponse.json({ forecast, balances: classifyBalance(forecast, effectiveSchedules(base), base.sitePowerLimitKW), data_source: "simulation", mutatedAcceptedData: false });
}
