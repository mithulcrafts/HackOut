import { NextResponse } from "next/server";
import { setDemoCookie } from "@/lib/demo-cookie";
import { getScenario } from "@/lib/demo-store";
import { forecastOptionsSchema, resolveForecast } from "@/lib/forecast-service";
import { previewForecast } from "@/domain/forecast/preview";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOperatorAccess } from "@/lib/operator-access";
import { getDemoProfile } from "@/lib/demo-preferences";
import { dispatchBattery } from "@/domain/scheduling/engine";
import { effectiveSchedules } from "@/domain/summary";
import { rankGridRecommendations } from "@/domain/grid-recommendations";

const previewSchema = forecastOptionsSchema.extend({
  renewableMultiplier: z.number().min(0).max(3).default(1),
  demandMultiplier: z.number().min(0).max(3).default(1),
});

async function profileLocation(access: { mode: "demo" | "operator"; session: string; userId?: string }) {
  if (access.mode === "demo") return getDemoProfile(access.session).location || "Gandhinagar, Gujarat";
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

export async function POST(request: Request) {
  const access = await requireOperatorAccess(request);
  if (access.mode === "error") return access.response;
  const parsed = previewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid source, capacities (0–1000 kW) and multipliers (0–3)." }, { status: 400 });
  const scenario = getScenario(access.session);
  const result = await resolveForecast(scenario, { ...parsed.data, locationName: await profileLocation(access) });
  const preview = previewForecast(scenario, result.forecast, parsed.data.renewableMultiplier, parsed.data.demandMultiplier);
  const previewScenario = { ...scenario, forecast: preview.forecast, data_source: result.data_source };
  const previewSchedules = effectiveSchedules(previewScenario);
  const response = NextResponse.json({
    ...result,
    ...preview,
    battery: dispatchBattery(previewScenario.forecast, previewSchedules, previewScenario.battery),
    recommendations: rankGridRecommendations(previewScenario),
  }, { headers: { "Cache-Control": "private, no-store" } });
  if (access.mode === "demo") setDemoCookie(response, access.session);
  return response;
}

