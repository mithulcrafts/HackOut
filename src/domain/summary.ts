import type { Scenario, ScenarioSummary } from "./types";
import { classifyBalance } from "./scheduling/engine";

export function summarizeScenario(scenario: Scenario): ScenarioSummary {
  const baselinePeakKW = Math.max(...scenario.forecast.map((slot) => slot.fixedDemandKW));
  const balances = classifyBalance(scenario.forecast, scenario.schedules, scenario.sitePowerLimitKW);
  const scheduledPeakKW = Math.max(...scenario.forecast.map((slot, index) => {
    const flexible = scenario.schedules.filter((schedule) => schedule.accepted && index >= schedule.startSlot && index < schedule.endSlot).reduce((sum, schedule) => sum + schedule.powerKW, 0);
    return slot.fixedDemandKW + flexible;
  }));
  const acceptedKW = scenario.schedules.filter((schedule) => schedule.accepted).reduce((sum, schedule) => sum + schedule.powerKW, 0);
  const verifiedKW = scenario.schedules.filter((schedule) => schedule.accepted && scenario.activities.some((activity) => activity.id === schedule.activityId && activity.status === "verified")).reduce((sum, schedule) => sum + schedule.powerKW, 0);
  return { absorbSlots: balances.filter((item) => item.mode === "absorb").length, protectSlots: balances.filter((item) => item.mode === "protect").length, baselinePeakKW: Number(baselinePeakKW.toFixed(1)), scheduledPeakKW: Number(scheduledPeakKW.toFixed(1)), acceptedKW, verifiedKW: Number(verifiedKW.toFixed(2)), unresolvedGapKW: 0, data_source: "simulation" };
}
