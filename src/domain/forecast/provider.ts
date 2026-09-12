import { createSyntheticForecast } from "./synthetic";
import type { DataSource } from "../types";

export interface WeatherSlot {
  start: string;
  end: string;
  /** Global horizontal irradiance in W/m² (not kW or kWh). */
  solarRadiation: number;
  /** Wind speed in metres per second. */
  windSpeed: number;
  data_source: DataSource;
}

export interface ForecastLocation { latitude: number; longitude: number; }

export interface ForecastProvider {
  getForecast(location: ForecastLocation, start: string, end: string): Promise<WeatherSlot[]>;
}

export interface SolarEstimateInput {
  ratedCapacityKW: number;
  irradianceWm2: number;
  referenceIrradianceWm2?: number;
  temperatureC?: number;
  temperatureCoefficientPerC?: number;
  lossFraction?: number;
}

/** Estimate slot-average solar output in kW from irradiance in W/m². */
export function estimateSolarPowerKW(input: SolarEstimateInput): number {
  const reference = input.referenceIrradianceWm2 ?? 1000;
  const coefficient = input.temperatureCoefficientPerC ?? -0.004;
  const loss = input.lossFraction ?? 0.15;
  if (![input.ratedCapacityKW, input.irradianceWm2, reference, coefficient, loss].every(Number.isFinite) || input.ratedCapacityKW < 0 || input.irradianceWm2 < 0 || reference <= 0 || loss < 0 || loss >= 1) return 0;
  const irradianceFactor = Math.min(1, input.irradianceWm2 / reference);
  const temperatureFactor = input.temperatureC === undefined ? 1 : Math.max(0, 1 + coefficient * (input.temperatureC - 25));
  return Number((input.ratedCapacityKW * irradianceFactor * temperatureFactor * (1 - loss)).toFixed(3));
}

export interface WindEstimateInput {
  ratedPowerKW: number;
  windSpeedMps: number;
  cutInMps?: number;
  ratedSpeedMps?: number;
  cutOutMps?: number;
}

/** Estimate wind turbine output in kW using a simple cubic power curve. */
export function estimateWindPowerKW(input: WindEstimateInput): number {
  const cutIn = input.cutInMps ?? 3;
  const rated = input.ratedSpeedMps ?? 12;
  const cutOut = input.cutOutMps ?? 25;
  if (![input.ratedPowerKW, input.windSpeedMps, cutIn, rated, cutOut].every(Number.isFinite) || input.ratedPowerKW < 0 || input.windSpeedMps < 0 || !(cutIn < rated && rated < cutOut)) return 0;
  if (input.windSpeedMps <= cutIn || input.windSpeedMps >= cutOut) return 0;
  if (input.windSpeedMps >= rated) return Number(input.ratedPowerKW.toFixed(3));
  const fraction = (input.windSpeedMps - cutIn) / (rated - cutIn);
  return Number((input.ratedPowerKW * fraction ** 3).toFixed(3));
}

export class SyntheticForecastProvider implements ForecastProvider {
  async getForecast(location: ForecastLocation, start: string, end: string): Promise<WeatherSlot[]> {
    void location;
    void start;
    void end;
    return createSyntheticForecast().map((slot) => {
      const windSpeed = Number((6 + 1.8 * Math.sin(slot.index * 0.55) + 0.7 * Math.cos(slot.index * 0.21)).toFixed(2));
      const hour = slot.index / 2;
      const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
      const cloudDip = slot.index >= 25 && slot.index <= 27 ? 0.62 : 1;
      return { start: slot.start, end: slot.end, solarRadiation: Number((900 * daylight * cloudDip).toFixed(1)), windSpeed, data_source: "simulation" as const };
    });
  }
}
