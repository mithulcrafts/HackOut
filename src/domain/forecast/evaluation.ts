import type { ForecastSlot } from "../types";

export interface ForecastEvaluationPoint {
  slot: number;
  label: string;
  observedKW: number;
  predictedKW: number;
  baselineKW: number;
  lowerKW: number;
  upperKW: number;
}

export interface ForecastMetrics {
  maeKW: number;
  rmseKW: number;
  mapePercent: number | null;
  intervalCoveragePercent: number;
  sampleCount: number;
}

export interface ForecastEvaluation {
  source: "public_observation" | "simulation";
  sourceLabel: string;
  points: ForecastEvaluationPoint[];
  model: ForecastMetrics;
  baseline: ForecastMetrics;
  message: string;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function metrics(points: Pick<ForecastEvaluationPoint, "observedKW" | "predictedKW" | "lowerKW" | "upperKW">[]): ForecastMetrics {
  if (!points.length) return { maeKW: 0, rmseKW: 0, mapePercent: null, intervalCoveragePercent: 0, sampleCount: 0 };
  const errors = points.map((point) => point.predictedKW - point.observedKW);
  const nonZero = points.filter((point) => point.observedKW > 0.1);
  return {
    maeKW: round(errors.reduce((sum, error) => sum + Math.abs(error), 0) / points.length),
    rmseKW: round(Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / points.length)),
    mapePercent: nonZero.length ? round(nonZero.reduce((sum, point) => sum + Math.abs(point.predictedKW - point.observedKW) / point.observedKW, 0) / nonZero.length * 100) : null,
    intervalCoveragePercent: round(points.filter((point) => point.observedKW >= point.lowerKW && point.observedKW <= point.upperKW).length / points.length * 100),
    sampleCount: points.length,
  };
}

export function evaluateForecast(points: ForecastEvaluationPoint[], source: ForecastEvaluation["source"], sourceLabel: string, message: string): ForecastEvaluation {
  return {
    source,
    sourceLabel,
    points,
    model: metrics(points),
    baseline: metrics(points.map((point) => ({ ...point, predictedKW: point.baselineKW }))),
    message,
  };
}

/** A deterministic replay used when the public endpoint is unavailable. It is labelled simulation, never presented as measured output. */
export function createReplayEvaluation(forecast: ForecastSlot[]): ForecastEvaluation {
  const points = forecast.filter((slot) => slot.index % 2 === 0).map((slot, index) => {
    const observed = Math.max(0, slot.renewableKW * (0.91 + 0.07 * Math.sin(index * 1.7)));
    const predicted = Math.max(0, slot.renewableKW * (0.88 + 0.04 * Math.cos(index * 0.8)));
    const baseline = Math.max(0, slot.renewableKW * 0.76);
    return { slot: slot.index, label: slot.start, observedKW: round(observed), predictedKW: round(predicted), baselineKW: round(baseline), lowerKW: round(predicted * 0.78), upperKW: round(predicted * 1.22) };
  });
  return evaluateForecast(points, "simulation", "Deterministic replay (no public observation loaded)", "This offline replay demonstrates the evaluation method. Load the public observation source to report measured forecast error.");
}
