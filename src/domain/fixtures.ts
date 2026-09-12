import { createSyntheticForecast } from "./forecast/synthetic";
import type { Activity, Scenario } from "./types";
import { createSchedule } from "./scheduling/engine";
import { publishEvent } from "./events";

const activities: Activity[] = [
  { id: "activity-ev", name: "My scooter", type: "ev", requiredEnergyKWh: 8, earliestStart: 18, latestFinish: 34, powerLimitKW: 4, durationSlots: 4, interruptible: true, baselineStart: 20, status: "recommended" },
  { id: "activity-water", name: "Water heater", type: "water_heater", requiredEnergyKWh: 3, earliestStart: 28, latestFinish: 38, powerLimitKW: 4, durationSlots: 2, interruptible: true, baselineStart: 34, status: "recommended" },
  { id: "activity-packaging", name: "Afternoon packaging batch", type: "industrial_process", requiredEnergyKWh: 12, earliestStart: 24, latestFinish: 36, powerLimitKW: 6, durationSlots: 4, interruptible: false, baselineStart: 24, status: "recommended" },
];

export function createDemoScenario(): Scenario {
  const forecast = createSyntheticForecast();
  const { schedules } = createSchedule(activities, forecast, 18, 1);
  const scenario: Scenario = { id: "scenario-demo-2026-09-12", date: "2026-09-12", timezone: "Asia/Kolkata", sitePowerLimitKW: 18, rewardRatePerKWh: 1.5, forecast, activities, schedules, offers: [], events: [{ id: "event-absorb-demo", name: "Midday renewable absorption", objective: "absorb", status: "draft", windowStart: 26, windowEnd: 34, requestedFlexibilityKW: 10, eligibleActivityTypes: ["ev", "water_heater", "industrial_process", "washing_machine", "dishwasher", "irrigation_pump", "pool_pump", "cold_storage", "e_bike", "custom"], rewardRatePerKWh: 1.5, budget: 250, offerExpiresAt: "2026-09-12T16:00:00+05:30", frozenBaselineVersion: 1 }], readings: [], battery: { capacityKWh: 40, currentKWh: 22, maxChargeKW: 8, maxDischargeKW: 8, roundTripEfficiency: 0.9 }, mode: "absorb", data_source: "simulation" };
  return publishEvent(scenario, "event-absorb-demo");
}

