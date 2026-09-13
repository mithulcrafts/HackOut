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
    // A midday cloud event is placed after the programme starts so the
    // renewable-rich offer window (13:00–15:00) is visibly aligned with the
    // strongest available combined output rather than a stale pre-noon peak.
    const cloudDip = slot.index >= 29 && slot.index <= 31 ? 0.62 : 1;
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

/** Rated electrical capacity already includes panel efficiency. Radiation is interval kWh/m², normalized by STC 1 kW/m². */
export function estimateSolarKWh(panelCapacityKW: number, radiationKWhPerM2: number, temperatureFactor: number, lossFactor: number): number {
  // Temperature correction is a non-negative multiplier and can be slightly
  // above one in cool conditions.
  if (![panelCapacityKW, radiationKWhPerM2, temperatureFactor, lossFactor].every(Number.isFinite) || panelCapacityKW < 0 || radiationKWhPerM2 < 0 || temperatureFactor < 0 || lossFactor < 0 || lossFactor > 1) return 0;
  return Number((panelCapacityKW * radiationKWhPerM2 * temperatureFactor * (1 - lossFactor)).toFixed(3));
}

/** Convert slot-average wind output in kW to half-hour energy in kWh. */
export function estimateWindKWh(powerCurveKW: number, slotHours = SLOT_HOURS): number {
  if (![powerCurveKW, slotHours].every(Number.isFinite) || powerCurveKW < 0 || slotHours < 0) return 0;
  return Number((powerCurveKW * slotHours).toFixed(3));
}
