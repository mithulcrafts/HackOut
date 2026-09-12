import { NextResponse } from "next/server";
import { getOrCreateDemoSession, setDemoCookie } from "@/lib/demo-cookie";
import { getScenario } from "@/lib/demo-store";
import { classifyBalance } from "@/domain/scheduling/engine";
import { forecastOptionsSchema, resolveForecast } from "@/lib/forecast-service";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const parsed = forecastOptionsSchema.safeParse({ source: query.get("source") ?? "simulation", panelCapacityKW: query.has("panelCapacityKW") ? Number(query.get("panelCapacityKW")) : undefined, turbineCapacityKW: query.has("turbineCapacityKW") ? Number(query.get("turbineCapacityKW")) : undefined });
  if (!parsed.success) return NextResponse.json({ error: "Choose simulation or weather and capacities between 0 and 1000 kW." }, { status: 400 });
  const session = await getOrCreateDemoSession();
  const scenario = getScenario(session);
  const result = await resolveForecast(scenario, parsed.data);
  const response = NextResponse.json({ ...result, balances: classifyBalance(result.forecast, scenario.schedules, scenario.sitePowerLimitKW), timezone: scenario.timezone }, { headers: { "Cache-Control": "private, no-store" } });
  setDemoCookie(response, session);
  return response;
}
