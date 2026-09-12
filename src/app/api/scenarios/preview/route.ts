import { NextResponse } from "next/server";
import { getOrCreateDemoSession, setDemoCookie } from "@/lib/demo-cookie";
import { getScenario } from "@/lib/demo-store";
import { forecastOptionsSchema, resolveForecast } from "@/lib/forecast-service";
import { previewForecast } from "@/domain/forecast/preview";
import { z } from "zod";
const previewSchema = forecastOptionsSchema.extend({ renewableMultiplier: z.number().min(0).max(3).default(1), demandMultiplier: z.number().min(0).max(3).default(1) });
export async function POST(request: Request) {
  const parsed = previewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid source, capacities (0–1000 kW) and multipliers (0–3)." }, { status: 400 });
  const session = await getOrCreateDemoSession(); const scenario = getScenario(session); const result = await resolveForecast(scenario, parsed.data);
  const response = NextResponse.json({ ...result, ...previewForecast(scenario, result.forecast, parsed.data.renewableMultiplier, parsed.data.demandMultiplier) }, { headers: { "Cache-Control": "private, no-store" } }); setDemoCookie(response, session); return response;
}
