import type { ForecastSlot } from "../types";

export type ModelGatewayOptions = { request?: typeof fetch; solarUrl?: string; windUrl?: string; timeoutMs?: number };
type Point = { timestamp: string; powerKW: number };

function points(payload: unknown): Point[] {
  const raw = Array.isArray(payload) ? payload : (payload as Record<string, unknown>)?.forecast ?? (payload as Record<string, unknown>)?.predictions ?? (payload as Record<string, unknown>)?.data;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const timestamp = String(row.timestamp ?? row.time ?? row.start ?? "");
    const value = Number(row.power_kw ?? row.powerKW ?? row.power ?? row.value);
    return timestamp && Number.isFinite(value) ? [{ timestamp, powerKW: Math.max(0, value) }] : [];
  });
}

async function call(url: string, body: object, request: typeof fetch, timeoutMs: number): Promise<Point[]> {
  const response = await request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Forecast model returned ${response.status}.`);
  const result = points(await response.json());
  if (result.length < 2) throw new Error("Forecast model returned no usable power timeline.");
  return result;
}

export async function fetchModelForecast(scenario: ForecastSlot[], location: { latitude: number; longitude: number }, installation: { panelCapacityKW: number; turbineCapacityKW: number }, options: ModelGatewayOptions = {}) {
  const request = options.request ?? fetch;
  const timeoutMs = options.timeoutMs ?? Number(process.env.FORECAST_MODEL_TIMEOUT_MS ?? 8000);
  const start = scenario[0]?.start ?? new Date().toISOString();
  const end = scenario.at(-1)?.end ?? start;
  const body = { latitude: location.latitude, longitude: location.longitude, start, end, interval_minutes: 30, timezone: "Asia/Kolkata" };
  const solarUrl = options.solarUrl ?? process.env.QUARTZ_SOLAR_FORECAST_URL;
  const windUrl = options.windUrl ?? process.env.WINDFM_WIND_FORECAST_URL;
  const [solar, wind] = await Promise.all([solarUrl ? call(solarUrl, { ...body, capacity_kw: installation.panelCapacityKW }, request, timeoutMs) : Promise.reject(new Error("Quartz endpoint is not configured.")), windUrl ? call(windUrl, { ...body, capacity_kw: installation.turbineCapacityKW, timezone: "UTC" }, request, timeoutMs) : Promise.reject(new Error("WindFM bridge is not configured."))]);
  const nearest = (series: Point[], timestamp: string) => series.reduce((best, point) => Math.abs(Date.parse(point.timestamp) - Date.parse(timestamp)) < Math.abs(Date.parse(best.timestamp) - Date.parse(timestamp)) ? point : best);
  return scenario.map((slot) => ({ ...slot, solarKW: nearest(solar, slot.start).powerKW, windKW: nearest(wind, slot.start).powerKW, renewableKW: nearest(solar, slot.start).powerKW + nearest(wind, slot.start).powerKW, data_source: "model_forecast" as const }));
}
