import type { Scenario, ForecastSlot } from "@/domain/types";
import type { ForecastProvider } from "@/domain/forecast/provider";
import { OpenMeteoForecastProvider, indiaDate } from "@/domain/forecast/open-meteo";
import { DEFAULT_INSTALLATION, estimateRenewables } from "@/domain/forecast/estimation";
import { z } from "zod";

export const forecastOptionsSchema = z.object({
  source: z.enum(["simulation", "weather"]).default("simulation"),
  panelCapacityKW: z.number().min(0).max(1000).default(DEFAULT_INSTALLATION.panelCapacityKW),
  turbineCapacityKW: z.number().min(0).max(1000).default(DEFAULT_INSTALLATION.turbineCapacityKW),
  locationName: z.string().trim().min(2).max(120).optional(),
});
export type ForecastOptions = z.infer<typeof forecastOptionsSchema>;
export async function resolveForecast(scenario: Scenario, options: ForecastOptions, provider: ForecastProvider = new OpenMeteoForecastProvider(), now = new Date()) {
  const date = indiaDate(now);
  const metadata = { requestedSource: options.source, provider: "Synthetic", weatherDate: null as string | null, scenarioDate: scenario.date, location: null as string | null, timezone: "Asia/Kolkata", fallback: false, message: "Deterministic simulation.", installation: { panelCapacityKW: options.panelCapacityKW, turbineCapacityKW: options.turbineCapacityKW } };
  let forecast: ForecastSlot[] = scenario.forecast;
  if (options.source === "weather") {
    try {
      const start = `${date}T00:00:00+05:30`;
      const end = `${indiaDate(new Date(Date.parse(start) + 86400000))}T00:00:00+05:30`;
      const locationName = options.locationName?.trim();
      if (!locationName) throw new Error("Save a location in Profile before using weather estimates.");
      const geocode = provider instanceof OpenMeteoForecastProvider ? await provider.geocode(locationName) : null;
      if (!geocode) throw new Error("This forecast provider does not support location lookup.");
      const weather = await provider.getForecast(geocode, start, end);
      forecast = estimateRenewables(weather, scenario.forecast, metadata.installation);
      metadata.provider = "Open-Meteo";
      metadata.location = locationName;
      metadata.weatherDate = date;
      metadata.message = "Weather-based installation estimate. Hourly radiation repeated across half-hours; wind and temperature interpolated. Demand and activities remain simulated. Current-day weather is a what-if input for the demo day.";
    } catch {
      metadata.fallback = true;
      metadata.message = "Weather unavailable or incomplete. Showing the unchanged synthetic forecast; retry when the connection is available.";
    }
  }
  return { forecast, metadata, data_source: metadata.weatherDate ? "weather_estimate" as const : "simulation" as const };
}
