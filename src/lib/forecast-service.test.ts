import { describe, expect, it } from "vitest";
import { createDemoScenario } from "@/domain/fixtures";
import { OpenMeteoForecastProvider } from "@/domain/forecast/open-meteo";
import { resolveForecast } from "./forecast-service";

function weatherPayload() {
  const times = Array.from({ length: 25 }, (_, hour) => hour === 24 ? "2026-09-14T00:00" : `2026-09-13T${String(hour).padStart(2, "0")}:00`);
  return {
    utc_offset_seconds: 19800,
    hourly_units: { wind_speed_80m: "m/s", shortwave_radiation: "W/m²", temperature_2m: "°C" },
    hourly: {
      time: times,
      shortwave_radiation: times.map((_, hour) => hour > 6 && hour < 19 ? 700 : 0),
      wind_speed_80m: times.map(() => 8),
      wind_direction_80m: times.map(() => 180),
      temperature_2m: times.map(() => 30),
      cloud_cover: times.map(() => 10),
    },
  };
}

describe("resolveForecast", () => {
  it("keeps simulation deterministic when weather location is unavailable", async () => {
    const scenario = createDemoScenario();
    const before = JSON.stringify(scenario.forecast);
    const result = await resolveForecast(scenario, { source: "weather", panelCapacityKW: 10, turbineCapacityKW: 3 });
    expect(result.data_source).toBe("simulation");
    expect(result.metadata.fallback).toBe(true);
    expect(result.metadata.weatherDate).toBeNull();
    expect(JSON.stringify(scenario.forecast)).toBe(before);
  });

  it("uses current-day weather metadata with an injected provider and does not mutate the scenario", async () => {
    const scenario = createDemoScenario();
    const before = JSON.stringify(scenario.forecast);
    const provider = new OpenMeteoForecastProvider(async (input) => ({
      ok: true,
      status: 200,
      json: async () => String(input).includes("geocoding") ? { results: [{ latitude: 23.21, longitude: 72.63 }] } : weatherPayload(),
    } as Response));
    const result = await resolveForecast(scenario, { source: "weather", locationName: "Gandhinagar, Gujarat", panelCapacityKW: 10, turbineCapacityKW: 3 }, provider, new Date("2026-09-13T03:00:00.000Z"));
    expect(result.data_source).toBe("weather_estimate");
    expect(result.metadata.fallback).toBe(false);
    expect(result.metadata.provider).toBe("Open-Meteo");
    expect(result.metadata.weatherDate).toBe("2026-09-13");
    expect(result.metadata.location).toBe("Gandhinagar, Gujarat");
    expect(result.forecast).toHaveLength(48);
    expect(result.forecast.every((slot) => slot.data_source === "weather_estimate")).toBe(true);
    expect(JSON.stringify(scenario.forecast)).toBe(before);
  });
});
