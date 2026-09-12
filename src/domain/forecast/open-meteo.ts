import { z } from "zod";
import type { ForecastLocation, ForecastProvider, WeatherSlot } from "./provider";

const payloadSchema = z.object({
  utc_offset_seconds: z.literal(19800),
  hourly_units: z.object({ wind_speed_80m: z.literal("m/s"), shortwave_radiation: z.literal("W/m²"), temperature_2m: z.literal("°C") }),
  hourly: z.object({
    time: z.array(z.string()),
    shortwave_radiation: z.array(z.number().finite().nonnegative().nullable()),
    wind_speed_80m: z.array(z.number().finite().nonnegative().nullable()),
    wind_direction_80m: z.array(z.number().min(0).max(360).nullable()),
    temperature_2m: z.array(z.number().finite().nullable()),
    cloud_cover: z.array(z.number().min(0).max(100).nullable()),
  }),
});

export function indiaDate(now = new Date()): string {
  return new Date(now.getTime() + 19800 * 1000).toISOString().slice(0, 10);
}

/** Weather is hourly; radiation is the preceding-hour mean. Never treat it as measured half-hour output. */
export function mapOpenMeteoDay(payload: unknown, start: string, end: string): WeatherSlot[] {
  const { hourly } = payloadSchema.parse(payload);
  const from = Date.parse(start), to = Date.parse(end);
  if (!Number.isFinite(from) || to - from !== 86400000) throw new Error("A complete 24-hour IST day is required.");
  const epochs = hourly.time.map(time => Date.parse(`${time}+05:30`));
  if (new Set(epochs).size !== epochs.length || epochs.some((epoch, i) => !Number.isFinite(epoch) || (i > 0 && epoch - epochs[i - 1] !== 3600000))) throw new Error("Invalid hourly timeline.");
  const value = (values: (number | null)[], index: number) => {
    const result = values[index];
    if (result === null || result === undefined || !Number.isFinite(result)) throw new Error("Weather data is incomplete for the selected day.");
    return result;
  };
  return Array.from({ length: 48 }, (_, index) => {
    const instant = from + index * 1800000;
    const hour = epochs.indexOf(from + Math.floor(index / 2) * 3600000);
    if (hour < 0 || epochs[hour + 1] === undefined) throw new Error("Weather data does not cover the whole day.");
    const fraction = index % 2 === 0 ? 0.25 : 0.75;
    const interpolate = (values: (number | null)[]) => value(values, hour) * (1 - fraction) + value(values, hour + 1) * fraction;
    return {
      start: new Date(instant + 19800000).toISOString().slice(0, 16) + "+05:30",
      end: new Date(instant + 1800000 + 19800000).toISOString().slice(0, 16) + "+05:30",
      solarRadiation: value(hourly.shortwave_radiation, hour + 1),
      windSpeed: interpolate(hourly.wind_speed_80m),
      temperatureC: interpolate(hourly.temperature_2m),
      cloudCoverPercent: interpolate(hourly.cloud_cover),
      windDirectionDegrees: value(hourly.wind_direction_80m, hour),
      data_source: "weather_estimate",
    };
  });
}

export class OpenMeteoForecastProvider implements ForecastProvider {
  constructor(private readonly request: typeof fetch = fetch) {}
  async getForecast(location: ForecastLocation, start: string, end: string): Promise<WeatherSlot[]> {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(location.latitude), longitude: String(location.longitude),
      hourly: "shortwave_radiation,wind_speed_80m,wind_direction_80m,temperature_2m,cloud_cover",
      wind_speed_unit: "ms", timezone: "Asia/Kolkata", start_date: start.slice(0, 10), end_date: end.slice(0, 10),
    }).toString();
    const response = await this.request(url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Weather provider returned ${response.status}.`);
    return mapOpenMeteoDay(await response.json(), start, end);
  }

  async geocode(locationName: string): Promise<ForecastLocation> {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.search = new URLSearchParams({ name: locationName, count: "1", language: "en", format: "json" }).toString();
    const response = await this.request(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Location lookup returned ${response.status}.`);
    const body = z.object({ results: z.array(z.object({ latitude: z.number(), longitude: z.number() })).min(1) }).parse(await response.json());
    return body.results[0];
  }
}
