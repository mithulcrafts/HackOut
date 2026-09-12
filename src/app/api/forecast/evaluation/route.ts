import { NextResponse } from "next/server";
import { getScenario } from "@/lib/demo-store";
import { requireOperatorAccess } from "@/lib/operator-access";
import { createReplayEvaluation, evaluateForecast, type ForecastEvaluationPoint } from "@/domain/forecast/evaluation";

export const dynamic = "force-dynamic";

function numeric(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }

async function publicObservationEvaluation() {
  // Elexon publishes open half-hourly actual wind/solar observations and WINDFOR
  // forecasts. The endpoint is best-effort: a demo must remain usable offline.
  const end = new Date();
  // Two days are required: the first day is the information available to the
  // replay and the second day is held out for evaluation.
  const start = new Date(end.getTime() - 48 * 60 * 60 * 1000);
  const url = `https://data.elexon.co.uk/bmrs/api/v1/datasets/AGWS?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}&format=json`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" }, cache: "no-store" });
    if (!response.ok) return null;
    const body = await response.json() as { data?: Array<Record<string, unknown>> };
    const rows = (body.data ?? []).map((row) => ({
      observed: numeric(row.generation) ?? numeric(row.generationMW) ?? numeric(row.quantity),
      timestamp: String(row.startTime ?? row.start_time ?? ""),
    })).filter((row): row is { observed: number; timestamp: string } => row.observed !== null && row.timestamp.length > 0).slice(-96);
    if (rows.length < 32) return null;
    const target = rows.slice(Math.floor(rows.length / 2));
    const history = rows.slice(0, Math.floor(rows.length / 2));
    const points: ForecastEvaluationPoint[] = target.map((row, index) => {
      // A causal persistence forecast: only the prior-day public observation
      // is used for the held-out target. Values from BMRS are in MW, so the
      // report converts them to kW consistently with the app contract.
      const observedKW = Math.max(0, row.observed * 1000);
      const priorDay = history[index] ?? history.at(-1)!;
      const previous = history[Math.max(0, index - 1)] ?? priorDay;
      const predictedKW = Math.max(0, priorDay.observed * 1000);
      const baselineKW = Math.max(0, previous.observed * 1000);
      return { slot: index, label: row.timestamp.slice(11, 16), observedKW: Number(observedKW.toFixed(2)), predictedKW: Number(predictedKW.toFixed(2)), baselineKW: Number(baselineKW.toFixed(2)), lowerKW: Number((predictedKW * 0.7).toFixed(2)), upperKW: Number((predictedKW * 1.3).toFixed(2)) };
    });
    return evaluateForecast(points, "public_observation", "Elexon BMRS AGWS · public UK wind/solar observation replay", "The held-out second day is compared with a causal prior-day forecast. This is a public-data method demonstration; it is not a Gujarat plant accuracy claim.");
  } catch { return null; }
  finally { clearTimeout(timeout); }
}

export async function GET(request: Request) {
  const access = await requireOperatorAccess(request);
  if (access.mode === "error") return access.response;
  const scenario = getScenario(access.session);
  const usePublic = new URL(request.url).searchParams.get("source") !== "simulation";
  const evaluation = usePublic ? await publicObservationEvaluation() : null;
  const result = evaluation ?? createReplayEvaluation(scenario.forecast);
  const response = NextResponse.json({ ...result, requestedSource: usePublic ? "public_observation" : "simulation", fallback: usePublic && !evaluation });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
