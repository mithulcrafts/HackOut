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
  // Build the synthetic observations first, then forecast each held-out point
  // only from observations which precede it. This keeps the offline fallback a
  // causal replay instead of letting the target slot leak into its prediction.
  const observed = forecast.map((slot, index) => Math.max(0, slot.renewableKW * (0.91 + 0.07 * Math.sin(index * 0.83))));
  const points = forecast.filter((slot) => slot.index >= 2 && slot.index % 2 === 0).map((slot) => {
    const previous = observed[slot.index - 1];
    const prior = observed[slot.index - 2];
    const recentChange = previous - prior;
    const predicted = Math.max(0, previous + recentChange * 0.5);
    const baseline = Math.max(0, previous);
    const intervalRadius = Math.max(0.5, predicted * 0.22, Math.abs(recentChange) * 1.5);
    return {
      slot: slot.index,
      label: slot.start,
      observedKW: round(observed[slot.index]),
      predictedKW: round(predicted),
      baselineKW: round(baseline),
      lowerKW: round(Math.max(0, predicted - intervalRadius)),
      upperKW: round(predicted + intervalRadius),
    };
  });
  return evaluateForecast(points, "simulation", "Causal deterministic replay (no public observation loaded)", "This offline replay predicts each target from earlier simulated observations only. Load the public observation source to report measured forecast error.");
}
