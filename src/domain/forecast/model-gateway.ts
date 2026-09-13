import type { ForecastSlot } from "../types";

export const QUARTZ_PUBLIC_URL = "https://open.quartz.solar/forecast/";
export type ModelGatewayOptions = {
  request?: typeof fetch;
  solarUrl?: string;
  windUrl?: string;
  timeoutMs?: number;
  forecastStart?: string;
};
export type ModelPoint = { epoch: number; powerKW: number };
export type ModelComponent = { powerKW: number[] | null; provider: string; error: string | null };

function epoch(value: string, assumeUTC: boolean): number {
  const normalized = value.replace(" ", "T");
  return Date.parse(assumeUTC && !/(Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? `${normalized}Z` : normalized);
}

export function parseModelPoints(payload: unknown, quartz = false): ModelPoint[] {
  if (!payload || typeof payload !== "object") throw new Error("Model response is not an object.");
  const body = payload as Record<string, unknown>;
  const prediction = body.predictions as { power_kw?: unknown } | undefined;
  const raw = quartz && prediction?.power_kw && typeof prediction.power_kw === "object"
    ? Object.entries(prediction.power_kw).map(([timestamp, power_kw]) => ({ timestamp, power_kw }))
    : Array.isArray(payload) ? payload : body.forecast ?? body.predictions ?? body.data;
  if (!Array.isArray(raw) || raw.length < 2) throw new Error("Model returned no usable power timeline.");
  const result = raw.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Invalid model point.");
    const row = item as Record<string, unknown>;
    const timestamp = row.timestamp ?? row.time ?? row.start;
    const power = row.power_kw ?? row.powerKW ?? row.power ?? row.value;
    const time = typeof timestamp === "string" ? epoch(timestamp, quartz) : NaN;
    if (!Number.isFinite(time) || typeof power !== "number" || !Number.isFinite(power) || power < 0) throw new Error("Model returned an invalid timestamp or power value.");
    return { epoch: time, powerKW: power };
  }).sort((a, b) => a.epoch - b.epoch);
  if (result.some((point, index) => index > 0 && point.epoch <= result[index - 1].epoch)) throw new Error("Model timeline contains duplicate timestamps.");
  return result;
}

/** Integrate linearly between model points, with no extrapolation or gaps over one hour. */
export function resampleModelPower(points: ModelPoint[], start: string, count: number, capacityKW: number): number[] {
  const from = Date.parse(start), interval = 1800000;
  if (!Number.isFinite(from) || points[0].epoch > from || points.at(-1)!.epoch < from + count * interval) throw new Error("Model timeline does not cover the requested operating day.");
  return Array.from({ length: count }, (_, index) => {
    const left = from + index * interval, right = left + interval;
    let area = 0, covered = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const lo = Math.max(left, a.epoch), hi = Math.min(right, b.epoch);
      if (hi <= lo) continue;
      if (b.epoch - a.epoch > 3600000) throw new Error("Model timeline contains a gap over one hour.");
      const valueAt = (time: number) => a.powerKW + (b.powerKW - a.powerKW) * (time - a.epoch) / (b.epoch - a.epoch);
      area += (valueAt(lo) + valueAt(hi)) / 2 * (hi - lo);
      covered += hi - lo;
    }
    if (covered !== interval) throw new Error("Model timeline contains an uncovered interval.");
    return Number(Math.min(capacityKW, area / interval).toFixed(3));
  });
}

async function component(url: string | undefined, body: object, name: string, start: string, count: number, capacity: number, request: typeof fetch, timeoutMs: number, quartz = false): Promise<ModelComponent> {
  if (capacity === 0) return { powerKW: Array(count).fill(0), provider: "Not installed", error: null };
  if (!url) return { powerKW: null, provider: name, error: `${name} endpoint is not configured.` };
  try {
    const response = await request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}.`);
    const values = resampleModelPower(parseModelPoints(await response.json(), quartz), start, count, capacity);
    return { powerKW: values, provider: name, error: null };
  } catch (error) {
    return { powerKW: null, provider: name, error: error instanceof Error ? error.message : `${name} is unavailable.` };
  }
}

export async function fetchModelForecast(scenario: ForecastSlot[], location: { latitude: number; longitude: number }, installation: { panelCapacityKW: number; turbineCapacityKW: number }, options: ModelGatewayOptions = {}) {
  const request = options.request ?? fetch;
  const configuredTimeout = Number(process.env.FORECAST_MODEL_TIMEOUT_MS ?? 15000);
  const timeoutMs = options.timeoutMs ?? (Number.isFinite(configuredTimeout) ? Math.max(1000, Math.min(60000, configuredTimeout)) : 15000);
  const start = options.forecastStart ?? scenario[0]?.start;
  if (!start || !Number.isFinite(Date.parse(start))) throw new Error("A valid forecast start is required.");
  const utcStart = new Date(start).toISOString();
  const end = new Date(Date.parse(start) + scenario.length * 1800000).toISOString();
  const solarUrl = options.solarUrl ?? process.env.QUARTZ_SOLAR_FORECAST_URL ?? QUARTZ_PUBLIC_URL;
  const windUrl = options.windUrl ?? process.env.WINDFM_WIND_FORECAST_URL;
  const [solar, wind] = await Promise.all([
    component(solarUrl, { site: { ...location, capacity_kwp: installation.panelCapacityKW }, timestamp: utcStart }, "Quartz Solar", utcStart, scenario.length, installation.panelCapacityKW, request, timeoutMs, true),
    component(windUrl, { ...location, capacity_kw: installation.turbineCapacityKW, start: utcStart, end, interval_minutes: 30, timezone: "UTC" }, "WindFM", utcStart, scenario.length, installation.turbineCapacityKW, request, timeoutMs),
  ]);
  return { solar, wind };
}
