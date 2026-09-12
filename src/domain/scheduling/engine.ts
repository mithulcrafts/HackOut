import type { Activity, BalanceResult, BatteryDispatch, BatteryState, ForecastSlot, Mode, ScheduleEntry } from "../types";

export function classifyBalance(forecast: ForecastSlot[], schedules: ScheduleEntry[], sitePowerLimitKW: number): BalanceResult[] {
  return forecast.map((slot) => {
    const flexibleKW = schedules.filter((s) => s.accepted && slot.index >= s.startSlot && slot.index < s.endSlot).reduce((sum, s) => sum + s.powerKW, 0);
    const totalDemandKW = slot.fixedDemandKW + flexibleKW;
    const balanceKW = Number((slot.renewableKW - totalDemandKW).toFixed(2));
    const mode: Mode = balanceKW >= 0 ? "absorb" : "protect";
    const gridActions = mode === "absorb"
      ? ["shift flexible demand", "charge storage", "export where possible", "review curtailment if needed"]
      : ["delay flexible demand", "reduce non-essential loads", "discharge storage", "review backup and escalate"];
    return { slot: slot.index, balanceKW, mode, exceedsSiteLimit: totalDemandKW > sitePowerLimitKW, gridActions };
  });
}

function candidateScore(activity: Activity, start: number, forecast: ForecastSlot[]): number {
  const renewable = forecast.slice(start, start + activity.durationSlots).reduce((sum, slot) => sum + slot.renewableKW, 0);
  const peakImpact = forecast.slice(start, start + activity.durationSlots).reduce((sum, slot) => sum + slot.fixedDemandKW, 0);
  const inconvenience = Math.abs(start - activity.baselineStart) * 0.12;
  return renewable - peakImpact * 0.25 - inconvenience;
}

export function activityPowerKW(activity: Activity): number {
  return Number((activity.requiredEnergyKWh / (activity.durationSlots * 0.5)).toFixed(2));
}

export function createSchedule(activities: Activity[], forecast: ForecastSlot[], sitePowerLimitKW: number, version = 1): { schedules: ScheduleEntry[]; unscheduled: { activityId: string; reason: string }[] } {
  const occupied = new Map<number, number>();
  const schedules: ScheduleEntry[] = [];
  const unscheduled: { activityId: string; reason: string }[] = [];
  const ordered = [...activities].sort((a, b) => (a.latestFinish - a.earliestStart) - (b.latestFinish - b.earliestStart));
  for (const activity of ordered) {
    const powerKW = activityPowerKW(activity);
    if (powerKW > activity.powerLimitKW) {
      unscheduled.push({ activityId: activity.id, reason: "Required energy exceeds the equipment power limit." });
      continue;
    }
    let best: { start: number; score: number } | undefined;
    for (let start = activity.earliestStart; start + activity.durationSlots <= activity.latestFinish; start++) {
    const legal = Array.from({ length: activity.durationSlots }, (_, offset) => start + offset).every((slot) => {
      const fixedDemandKW = forecast[slot]?.fixedDemandKW ?? Number.POSITIVE_INFINITY;
      return fixedDemandKW + (occupied.get(slot) ?? 0) + powerKW <= sitePowerLimitKW;
    });
      if (!legal) continue;
      const score = candidateScore(activity, start, forecast);
      if (!best || score > best.score) best = { start, score };
    }
    if (!best) {
      unscheduled.push({ activityId: activity.id, reason: "No safe window meets the deadline and site power limit." });
      continue;
    }
    for (let slot = best.start; slot < best.start + activity.durationSlots; slot++) occupied.set(slot, (occupied.get(slot) ?? 0) + powerKW);
    schedules.push({ activityId: activity.id, startSlot: best.start, endSlot: best.start + activity.durationSlots, powerKW, accepted: false, version, data_source: "simulation" });
  }
  return { schedules, unscheduled };
}

export function dispatchBattery(forecast: ForecastSlot[], schedules: ScheduleEntry[], initial: BatteryState): BatteryDispatch[] {
  let state = Math.min(initial.capacityKWh, Math.max(0, initial.currentKWh));
  const efficiency = Math.min(1, Math.max(0.01, initial.roundTripEfficiency));
  return forecast.map((slot) => {
    const flexible = schedules.filter((s) => s.accepted && slot.index >= s.startSlot && slot.index < s.endSlot).reduce((sum, s) => sum + s.powerKW, 0);
    const balance = slot.renewableKW - slot.fixedDemandKW - flexible;
    if (balance > 0 && state < initial.capacityKWh) {
      const power = Math.min(initial.maxChargeKW, balance, (initial.capacityKWh - state) / 0.5);
      state = Math.min(initial.capacityKWh, state + power * 0.5 * Math.sqrt(efficiency));
      return { slot: slot.index, mode: "absorb", powerKW: Number(power.toFixed(2)), stateOfChargeKWh: Number(state.toFixed(2)), action: "charge" as const };
    }
    if (balance < 0 && state > 0) {
      const power = Math.min(initial.maxDischargeKW, -balance, state / 0.5);
      state = Math.max(0, state - power * 0.5 / Math.sqrt(efficiency));
      return { slot: slot.index, mode: "protect", powerKW: Number(power.toFixed(2)), stateOfChargeKWh: Number(state.toFixed(2)), action: "discharge" as const };
    }
    return { slot: slot.index, mode: balance >= 0 ? "absorb" : "protect", powerKW: 0, stateOfChargeKWh: Number(state.toFixed(2)), action: "idle" as const };
  });
}
