import { describe, expect, it } from "vitest";
import { mapOpenMeteoDay, OpenMeteoForecastProvider } from "./open-meteo";

function hourlyPayload(count: number) {
  const times = Array.from({ length: count }, (_, hour) => {
    const instant = new Date(Date.parse("2026-09-13T00:00:00+05:30") + hour * 3600000);
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }).format(instant).replace(" ", "T") + ":00";
  });
  return {
    utc_offset_seconds: 19800,
    hourly_units: { wind_speed_80m: "m/s", shortwave_radiation: "W/m²", temperature_2m: "°C" },
    hourly: {
      time: times,
      shortwave_radiation: times.map(() => 0),
      wind_speed_80m: times.map(() => 6),
      wind_direction_80m: times.map(() => 180),
      temperature_2m: times.map(() => 30),
      cloud_cover: times.map(() => 10),
    },
  };
}

describe("Open-Meteo day boundary", () => {
  it("requests the following IST date so the 23:30 slot has a boundary sample", async () => {
    let requested: URL | undefined;
    const provider = new OpenMeteoForecastProvider(async (input) => {
      requested = new URL(String(input));
      return { ok: false, status: 503 } as Response;
    });

    await expect(provider.getForecast(
      { latitude: 23.21, longitude: 72.63 },
      "2026-09-13T00:00:00+05:30",
      "2026-09-13T23:59:00+05:30",
    )).rejects.toThrow("503");

    expect(requested?.searchParams.get("start_date")).toBe("2026-09-13");
    expect(requested?.searchParams.get("end_date")).toBe("2026-09-14");
  });

  it("rejects a weather response that lacks the following-midnight sample", () => {
    expect(() => mapOpenMeteoDay(
      hourlyPayload(24),
      "2026-09-13T00:00:00+05:30",
      "2026-09-14T00:00:00+05:30",
    )).toThrow("Weather data does not cover the whole day.");
  });

  it("maps all 48 half-hour slots when the boundary sample is present", () => {
    const slots = mapOpenMeteoDay(
      hourlyPayload(25),
      "2026-09-13T00:00:00+05:30",
      "2026-09-14T00:00:00+05:30",
    );
    expect(slots).toHaveLength(48);
    expect(slots[47].start).toBe("2026-09-13T23:30+05:30");
    expect(slots[47].end).toBe("2026-09-14T00:00+05:30");
  });
});
