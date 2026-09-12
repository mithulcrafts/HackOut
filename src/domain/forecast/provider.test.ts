import { describe, expect, it } from "vitest";
import { estimateSolarPowerKW, estimateWindPowerKW, SyntheticForecastProvider } from "./provider";

describe("forecast input estimators", () => {
  it("converts irradiance in W/m² to bounded solar kW", () => {
    expect(estimateSolarPowerKW({ ratedCapacityKW: 10, irradianceWm2: 0 })).toBe(0);
    expect(estimateSolarPowerKW({ ratedCapacityKW: 10, irradianceWm2: 1000, lossFraction: 0 })).toBe(10);
    expect(estimateSolarPowerKW({ ratedCapacityKW: 10, irradianceWm2: 1400, lossFraction: 0 })).toBe(10);
    expect(estimateSolarPowerKW({ ratedCapacityKW: 10, irradianceWm2: 1000, temperatureC: 35, lossFraction: 0 })).toBe(9.6);
    expect(estimateSolarPowerKW({ ratedCapacityKW: 10, irradianceWm2: -1 })).toBe(0);
  });

  it("uses cut-in, cubic ramp, rated and cut-out wind boundaries", () => {
    expect(estimateWindPowerKW({ ratedPowerKW: 10, windSpeedMps: 3 })).toBe(0);
    expect(estimateWindPowerKW({ ratedPowerKW: 10, windSpeedMps: 7.5 })).toBe(1.25);
    expect(estimateWindPowerKW({ ratedPowerKW: 10, windSpeedMps: 12 })).toBe(10);
    expect(estimateWindPowerKW({ ratedPowerKW: 10, windSpeedMps: 20 })).toBe(10);
    expect(estimateWindPowerKW({ ratedPowerKW: 10, windSpeedMps: 25 })).toBe(0);
    expect(estimateWindPowerKW({ ratedPowerKW: 10, windSpeedMps: 8, cutInMps: 12, ratedSpeedMps: 8, cutOutMps: 25 })).toBe(0);
  });

  it("emits plausible simulated weather units and labels", async () => {
    const slots = await new SyntheticForecastProvider().getForecast({ latitude: 23, longitude: 72 }, "2026-09-12", "2026-09-13");
    expect(slots).toHaveLength(48);
    expect(Math.max(...slots.map((slot) => slot.solarRadiation))).toBeGreaterThan(500);
    expect(Math.max(...slots.map((slot) => slot.solarRadiation))).toBeLessThanOrEqual(900);
    expect(slots.every((slot) => slot.windSpeed >= 0 && slot.windSpeed < 10)).toBe(true);
    expect(slots.every((slot) => slot.data_source === "simulation")).toBe(true);
  });
});
