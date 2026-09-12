import { NextResponse } from "next/server";
import { setDemoCookie } from "@/lib/demo-cookie";
import { getScenario } from "@/lib/demo-store";
import { classifyBalance } from "@/domain/scheduling/engine";
import { forecastOptionsSchema, resolveForecast } from "@/lib/forecast-service";
import { effectiveSchedules } from "@/domain/summary";
import { createClient } from "@/lib/supabase/server";
import { requireOperatorAccess } from "@/lib/operator-access";
import { getDemoProfile } from "@/lib/demo-preferences";

async function profileLocation(access: { mode: "demo" | "operator"; session: string; userId?: string }) {
  if (access.mode === "demo") return getDemoProfile(access.session).location;
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user || (access.userId && user.id !== access.userId)) return undefined;
    const { data } = await db.from("profiles").select("location").eq("id", user.id).maybeSingle();
    return data?.location ?? undefined;
  } catch {
    return undefined;
  }
}

export async function GET(request: Request) {
  const access = await requireOperatorAccess(request);
  if (access.mode === "error") return access.response;
  const query = new URL(request.url).searchParams;
  const parsed = forecastOptionsSchema.safeParse({
    source: query.get("source") ?? "simulation",
    panelCapacityKW: query.has("panelCapacityKW") ? Number(query.get("panelCapacityKW")) : undefined,
    turbineCapacityKW: query.has("turbineCapacityKW") ? Number(query.get("turbineCapacityKW")) : undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Choose simulation or weather and capacities between 0 and 1000 kW." }, { status: 400 });
  const scenario = getScenario(access.session);
  const result = await resolveForecast(scenario, { ...parsed.data, locationName: await profileLocation(access) });
  const response = NextResponse.json({
    ...result,
    balances: classifyBalance(result.forecast, effectiveSchedules(scenario), scenario.sitePowerLimitKW),
    timezone: scenario.timezone,
  }, { headers: { "Cache-Control": "private, no-store" } });
  if (access.mode === "demo") setDemoCookie(response, access.session);
  return response;
}
