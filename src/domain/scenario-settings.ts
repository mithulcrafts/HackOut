import type { Scenario } from "./types";

export type ScenarioSettings = {
  sitePowerLimitKW: number;
  batteryCapacityKWh: number;
  batteryCurrentKWh: number;
  maxChargeKW: number;
  maxDischargeKW: number;
  roundTripEfficiency: number;
  rewardRatePerKWh: number;
  draftEventBudget: number;
};

/**
 * Apply operator-owned scenario limits without rewriting accepted commitments.
 * Reward terms are changed only on draft events; published offers keep the terms
 * that participants already saw.
 */
export function applyScenarioSettings(scenario: Scenario, settings: ScenarioSettings): Scenario {
  if (settings.batteryCurrentKWh > settings.batteryCapacityKWh) {
    throw new Error("Battery state of charge cannot exceed its capacity.");
  }
  const minimumSafeLimit = Math.max(...scenario.forecast.map((slot) => slot.fixedDemandKW), 0);
  if (settings.sitePowerLimitKW < minimumSafeLimit) {
    throw new Error(`Site power limit must be at least ${minimumSafeLimit.toFixed(1)} kW for the fixed demand in this scenario.`);
  }

  return {
    ...scenario,
    sitePowerLimitKW: settings.sitePowerLimitKW,
    rewardRatePerKWh: settings.rewardRatePerKWh,
    battery: {
      ...scenario.battery,
      capacityKWh: settings.batteryCapacityKWh,
      currentKWh: settings.batteryCurrentKWh,
      maxChargeKW: settings.maxChargeKW,
      maxDischargeKW: settings.maxDischargeKW,
      roundTripEfficiency: settings.roundTripEfficiency,
    },
    events: scenario.events.map((event) => event.status === "draft"
      ? { ...event, rewardRatePerKWh: settings.rewardRatePerKWh, budget: settings.draftEventBudget }
      : event),
  };
}
