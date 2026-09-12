import type { Scenario, ForecastSlot } from "../types";
import { classifyBalance, createSchedule } from "../scheduling/engine";
import { effectiveSchedules } from "../summary";

/** Preview new proposals around committed schedules; never write to the live scenario. */
export function previewForecast(scenario: Scenario, forecast: ForecastSlot[], renewableMultiplier = 1, demandMultiplier = 1) {
  const adjusted = forecast.map(slot => ({ ...slot, solarKW: slot.solarKW * renewableMultiplier, windKW: slot.windKW * renewableMultiplier, renewableKW: slot.renewableKW * renewableMultiplier, fixedDemandKW: slot.fixedDemandKW * demandMultiplier }));
  const accepted = scenario.schedules.filter(schedule => schedule.accepted);
  const reserved = adjusted.map(slot => ({ ...slot, fixedDemandKW: slot.fixedDemandKW + accepted.filter(schedule => slot.index >= schedule.startSlot && slot.index < schedule.endSlot).reduce((sum, schedule) => sum + schedule.powerKW, 0) }));
  const candidates = scenario.activities.filter(activity => !accepted.some(schedule => schedule.activityId === activity.id) && activity.status === "recommended");
  const result = createSchedule(candidates, reserved, scenario.sitePowerLimitKW);
  const proposals = result.schedules.map(schedule => ({ ...schedule, data_source: forecast[0].data_source }));
  // The preview must account for every activity. Unaccepted work stays at its
  // frozen baseline, while an accepted schedule replaces that baseline once.
  const balances = classifyBalance(adjusted, effectiveSchedules(scenario), scenario.sitePowerLimitKW);
  return { forecast: adjusted, balances, proposals, unscheduled: result.unscheduled, commitmentRisks: balances.filter(slot => slot.exceedsSiteLimit).map(slot => slot.slot), mutatedAcceptedData: false as const };
}
