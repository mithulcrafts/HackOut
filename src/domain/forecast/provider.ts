import { createSyntheticForecast } from "./synthetic";
import type { DataSource } from "../types";

export interface WeatherSlot {
  start: string;
  end: string;
  /** Global horizontal irradiance in W/m² (not kW or kWh). */
  solarRadiation: number;
  /** Wind speed in metres per second. */
  windSpeed: number;
  temperatureC: number;
  cloudCoverPercent: number;
  windDirectionDegrees: number;
  data_source: DataSource;
}

export interface ForecastLocation { latitude: number; longitude: number; }

export interface ForecastProvider {
  getForecast(location: ForecastLocation, start: string, end: string): Promise<WeatherSlot[]>;
}

export class SyntheticForecastProvider implements ForecastProvider {
  async getForecast(location: ForecastLocation, start: string, end: string): Promise<WeatherSlot[]> {
    void location;
    void start;
    void end;
    return createSyntheticForecast().map((slot) => {
      const windSpeed = Number((6 + 1.8 * Math.sin(slot.index * 0.55) + 0.7 * Math.cos(slot.index * 0.21)).toFixed(2));
      // The synthetic forecast has a 10 kW reference solar installation;
      // converting its simulated output to GHI keeps the weather contract in W/m².
      const solarRadiation = Number(Math.max(0, Math.min(1000, slot.solarKW * 100)).toFixed(1));
      const cloudCoverPercent = solarRadiation > 0 && slot.index >= 25 && slot.index <= 27 ? 38 : solarRadiation > 0 ? 5 : 100;
      const temperatureC = Number((24 + 5 * Math.sin((slot.index - 12) * Math.PI / 48)).toFixed(1));
      return { start: slot.start, end: slot.end, solarRadiation, windSpeed, temperatureC, cloudCoverPercent, windDirectionDegrees: 180, data_source: "simulation" as const };
    });
  }
}
