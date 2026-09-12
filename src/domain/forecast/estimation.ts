import type { ForecastSlot } from "../types";
import type { WeatherSlot } from "./provider";
import { estimateSolarKWh, estimateWindKWh, SLOT_HOURS } from "./synthetic";

export interface Installation { panelCapacityKW: number; turbineCapacityKW: number; }
export const DEFAULT_INSTALLATION: Installation = { panelCapacityKW: 10, turbineCapacityKW: 3 };

// Illustrative normalized turbine curve, not a manufacturer's specification. Cut-in 3 m/s, cut-out 25 m/s.
const windCurve = [[3, 0], [5, 0.1], [8, 0.4], [10, 0.7], [12, 1], [25, 1]];
export function turbinePowerKW(speedMps: number, ratedKW: number): number {
  if (!Number.isFinite(speedMps) || !Number.isFinite(ratedKW) || ratedKW < 0 || speedMps < 3 || speedMps >= 25) return 0;
  for (let index = 1; index < windCurve.length; index++) {
    const [leftSpeed, leftPower] = windCurve[index - 1], [rightSpeed, rightPower] = windCurve[index];
    if (speedMps <= rightSpeed) return ratedKW * (leftPower + (rightPower - leftPower) * (speedMps - leftSpeed) / (rightSpeed - leftSpeed));
  }
  return 0;
}

export function estimateRenewables(weather: WeatherSlot[], demand: ForecastSlot[], installation: Installation): ForecastSlot[] {
  if (weather.length !== 48 || demand.length !== 48) throw new Error("Forecast requires 48 half-hour slots.");
  return weather.map((slot, index) => {
    // Simple NOCT-style cell-temperature proxy; GHI is a horizontal-plane approximation.
    const cellC = slot.temperatureC + slot.solarRadiation * 0.03125;
    const temperatureFactor = Math.max(0, 1 - 0.004 * (cellC - 25));
    const solarKW = Math.min(installation.panelCapacityKW, estimateSolarKWh(installation.panelCapacityKW, slot.solarRadiation / 1000 * SLOT_HOURS, temperatureFactor, 0.14) / SLOT_HOURS);
    const windKW = estimateWindKWh(turbinePowerKW(slot.windSpeed, installation.turbineCapacityKW)) / SLOT_HOURS;
    return { ...demand[index], solarKW, windKW, renewableKW: Number((solarKW + windKW).toFixed(3)), data_source: "weather_estimate" };
  });
}
