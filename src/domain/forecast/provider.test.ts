import { describe, expect, it } from "vitest";
import { SyntheticForecastProvider } from "./provider";
import { estimateSolarKWh } from "./synthetic";
import { turbinePowerKW } from "./estimation";

describe("forecast input estimators", () => {
  it("converts normalized slot irradiation to solar kWh", () => {
    expect(estimateSolarKWh(10, 0, 1, 0)).toBe(0);
    expect(estimateSolarKWh(10, 0.5, 1, 0)).toBe(5);
    expect(estimateSolarKWh(10, 0.5, 0.96, 0)).toBe(4.8);
    expect(estimateSolarKWh(10, -1, 1, 0)).toBe(0);
  });

  it("uses cut-in, piecewise linear ramp, rated and cut-out wind boundaries", () => {
    expect(turbinePowerKW(3, 10)).toBe(0);
    expect(turbinePowerKW(7.5, 10)).toBeCloseTo(3.5);
    expect(turbinePowerKW(12, 10)).toBe(10);
    expect(turbinePowerKW(20, 10)).toBe(10);
    expect(turbinePowerKW(25, 10)).toBe(0);
    expect(turbinePowerKW(8, 10)).toBe(4);
  });

  it("emits plausible simulated weather units and labels", async () => {
    const slots = await new SyntheticForecastProvider().getForecast({ latitude: 23, longitude: 72 }, "2026-09-12", "2026-09-13");
    expect(slots).toHaveLength(48);
    expect(Math.max(...slots.map((slot) => slot.solarRadiation))).toBeGreaterThan(500);
    expect(Math.max(...slots.map((slot) => slot.solarRadiation))).toBeLessThanOrEqual(1000);
    expect(slots.every((slot) => slot.windSpeed >= 0 && slot.windSpeed < 10)).toBe(true);
    expect(slots.every((slot) => slot.data_source === "simulation")).toBe(true);
  });
});
