import type { Activity, Scenario, ScenarioSummary, ScheduleEntry } from "./types";
import { activityPowerKW, classifyBalance } from "./scheduling/engine";

function baselineSchedule(activity: Activity): ScheduleEntry {
  return { activityId: activity.id, startSlot: activity.baselineStart, endSlot: activity.baselineStart + activity.durationSlots, powerKW: activityPowerKW(activity), accepted: true, version: 0, data_source: "simulation" };
}

/** Physical schedule, exactly once per activity. Unaccepted work remains at baseline. */
export function effectiveSchedules(scenario: Scenario): ScheduleEntry[] {
  return scenario.activities.map((activity) => {
    const accepted = scenario.schedules.filter((schedule) => schedule.activityId === activity.id && schedule.accepted).sort((a, b) => b.version - a.version)[0];
    return accepted ? { ...accepted, accepted: true } : baselineSchedule(activity);
  });
}

function round(value: number, digits = 1) { const factor = 10 ** digits; return Math.round(value * factor) / factor; }

function peak(scenario: Scenario, schedules: ScheduleEntry[]) {
  return Math.max(...scenario.forecast.map((slot, index) => slot.fixedDemandKW + schedules.filter((schedule) => index >= schedule.startSlot && index < schedule.endSlot).reduce((sum, schedule) => sum + schedule.powerKW, 0)), 0);
}

function baselinePeak(scenario: Scenario) {
  return peak(scenario, scenario.activities.map(baselineSchedule));
}

function verifiedResponseKW(scenario: Scenario) {
  const results = Object.values(scenario.results ?? {}).filter((result) => result.outcome === "verified");
  if (results.length) return results.reduce((sum, result) => {
    const activity = scenario.activities.find((item) => item.id === result.activityId);
    const hours = activity ? activity.durationSlots * 0.5 : 0;
    return sum + (hours > 0 ? result.eligibleShiftedKWh / hours : 0);
  }, 0);
  return scenario.activities.filter((activity) => activity.status === "verified").reduce((sum, activity) => sum + activityPowerKW(activity), 0);
}

export function summarizeScenario(scenario: Scenario): ScenarioSummary {
  const effective = effectiveSchedules(scenario);
  const balances = classifyBalance(scenario.forecast, effective, scenario.sitePowerLimitKW);
  const acceptedKW = scenario.schedules.filter((schedule) => schedule.accepted).reduce((sum, schedule) => sum + schedule.powerKW, 0);
  const verifiedKW = verifiedResponseKW(scenario);
  return { absorbSlots: balances.filter((item) => item.mode === "absorb").length, protectSlots: balances.filter((item) => item.mode === "protect").length, baselinePeakKW: round(baselinePeak(scenario)), scheduledPeakKW: round(peak(scenario, effective)), acceptedKW: round(acceptedKW), verifiedKW: round(verifiedKW), unresolvedGapKW: round(Math.max(0, acceptedKW - verifiedKW)), data_source: "simulation" };
}
