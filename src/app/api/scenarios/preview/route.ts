import { NextResponse } from "next/server";
import { getOrCreateDemoSession, setDemoCookie } from "@/lib/demo-cookie";
import { getScenario } from "@/lib/demo-store";
import { forecastOptionsSchema, resolveForecast } from "@/lib/forecast-service";
import { previewForecast } from "@/domain/forecast/preview";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const previewSchema = forecastOptionsSchema.extend({ renewableMultiplier: z.number().min(0).max(3).default(1), demandMultiplier: z.number().min(0).max(3).default(1) });
export async function POST(request: Request) {
  const parsed = previewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid source, capacities (0–1000 kW) and multipliers (0–3)." }, { status: 400 });
  const session = await getOrCreateDemoSession(); const scenario = getScenario(session);
  let locationName: string | undefined; try { const db = await createClient(); const { data: { user } } = await db.auth.getUser(); if (user) { const { data } = await db.from("profiles").select("location").eq("id", user.id).maybeSingle(); locationName = data?.location ?? undefined; } } catch { /* weather falls back to simulation */ }
  const result = await resolveForecast(scenario, { ...parsed.data, locationName });
  const response = NextResponse.json({ ...result, ...previewForecast(scenario, result.forecast, parsed.data.renewableMultiplier, parsed.data.demandMultiplier) }, { headers: { "Cache-Control": "private, no-store" } }); setDemoCookie(response, session); return response;
}
