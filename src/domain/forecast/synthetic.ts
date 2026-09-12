import type { ForecastSlot, TimeSlot } from "../types";

export const SLOT_COUNT = 48;
export const SLOT_HOURS = 0.5;

export function timeForSlot(index: number): string {
  const hour = Math.floor(index / 2).toString().padStart(2, "0");
  const minute = index % 2 === 0 ? "00" : "30";
  return `${hour}:${minute}`;
}

export function createSlots(): TimeSlot[] {
  return Array.from({ length: SLOT_COUNT }, (_, index) => ({
    index,
    start: timeForSlot(index),
    end: timeForSlot((index + 1) % SLOT_COUNT),
    durationHours: SLOT_HOURS,
  }));
}

/** Deterministic, labelled simulation; values are slot-average kW. */
export function createSyntheticForecast(): ForecastSlot[] {
  return createSlots().map((slot) => {
    const hour = slot.index / 2;
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const cloudDip = slot.index >= 25 && slot.index <= 27 ? 0.62 : 1;
    const solarKW = Number((10 * daylight * cloudDip).toFixed(2));
    const windKW = Number((2.8 + 0.8 * Math.sin(slot.index * 0.55) + 0.35 * Math.cos(slot.index * 0.21)).toFixed(2));
    const eveningPeak = Math.max(0, 3.2 * Math.sin(((hour - 16) / 7) * Math.PI));
    const fixedDemandKW = Number((5.2 + eveningPeak + 0.5 * Math.sin(slot.index * 0.31)).toFixed(2));
    return {
      ...slot,
      solarKW,
      windKW,
      renewableKW: Number((solarKW + windKW).toFixed(2)),
      fixedDemandKW,
      data_source: "simulation" as const,
    };
  });
}

/** Estimate energy in kWh from rated kW, irradiation in kWh/m², efficiency and loss fraction. */
export function estimateSolarKWh(panelCapacityKW: number, radiationKWhPerM2: number, efficiency: number, lossFactor: number): number {
  if (![panelCapacityKW, radiationKWhPerM2, efficiency, lossFactor].every(Number.isFinite) || panelCapacityKW < 0 || radiationKWhPerM2 < 0 || efficiency < 0 || efficiency > 1 || lossFactor < 0 || lossFactor > 1) return 0;
  return Number((panelCapacityKW * radiationKWhPerM2 * efficiency * (1 - lossFactor)).toFixed(3));
}

/** Convert slot-average wind output in kW to half-hour energy in kWh. */
export function estimateWindKWh(powerCurveKW: number, slotHours = SLOT_HOURS): number {
  if (![powerCurveKW, slotHours].every(Number.isFinite) || powerCurveKW < 0 || slotHours < 0) return 0;
  return Number((powerCurveKW * slotHours).toFixed(3));
}
