import { createSyntheticForecast } from "./synthetic";
import type { DataSource } from "../types";

export interface WeatherSlot {
  start: string;
  end: string;
  solarRadiation: number;
  windSpeed: number;
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
      return { start: slot.start, end: slot.end, solarRadiation: slot.solarKW, windSpeed, data_source: "simulation" as const };
    });
  }
}
