import type { Activity, Scenario, ScenarioSummary, ScheduleEntry } from "./types";
import { activityPowerKW, classifyBalance } from "./scheduling/engine";

function baselineSchedule(activity: Activity): ScheduleEntry {
  return { activityId: activity.id, startSlot: activity.baselineStart, endSlot: activity.baselineStart + activity.durationSlots, powerKW: activityPowerKW(activity), accepted: true, version: 0, data_source: "simulation" };
}

/** Physical schedule, exactly once per activity. Unaccepted work remains at baseline. */
export function effectiveSchedules(scenario: Scenario): ScheduleEntry[] {
  return scenario.activities.filter((activity) => activity.status !== "paused").map((activity) => {
    const accepted = scenario.schedules.filter((schedule) => schedule.activityId === activity.id && schedule.accepted).sort((a, b) => b.version - a.version)[0];
    return accepted ? { ...accepted, accepted: true } : baselineSchedule(activity);
  });
}

function round(value: number, digits = 1) { const factor = 10 ** digits; return Math.round(value * factor) / factor; }

function peak(scenario: Scenario, schedules: ScheduleEntry[]) {
  return Math.max(...scenario.forecast.map((slot, index) => slot.fixedDemandKW + schedules.filter((schedule) => index >= schedule.startSlot && index < schedule.endSlot).reduce((sum, schedule) => sum + schedule.powerKW, 0)), 0);
}

/**
 * Capacity is an instantaneous quantity.  Summing every accepted schedule
 * would overstate the response when two activities are committed in
 * different half-hour windows, so operator summaries use the maximum
 * concurrent kW across the scenario day.
 */
function peakConcurrentPower(scenario: Scenario, schedules: ScheduleEntry[]) {
  return Math.max(...scenario.forecast.map((slot) => schedules
    .filter((schedule) => slot.index >= schedule.startSlot && slot.index < schedule.endSlot)
    .reduce((sum, schedule) => sum + schedule.powerKW, 0)), 0);
}

function latestAcceptedSchedules(scenario: Scenario) {
  const latest = new Map<string, ScheduleEntry>();
  for (const schedule of scenario.schedules) {
    if (!schedule.accepted) continue;
    const previous = latest.get(schedule.activityId);
    if (!previous || schedule.version >= previous.version) latest.set(schedule.activityId, schedule);
  }
  return [...latest.values()];
}

function baselinePeak(scenario: Scenario) {
  return peak(scenario, scenario.activities.map(baselineSchedule));
}

type ScenarioResult = NonNullable<Scenario["results"]>[keyof NonNullable<Scenario["results"]>];

function verifiedResponseKW(scenario: Scenario) {
  const accepted = latestAcceptedSchedules(scenario);
  const verifiedByActivity = new Map<string, ScenarioResult>();
  for (const result of Object.values(scenario.results ?? {})) {
    if (result.outcome !== "verified" || !accepted.some((schedule) => schedule.activityId === result.activityId)) continue;
    const previous = verifiedByActivity.get(result.activityId);
    if (!previous || result.createdAt >= previous.createdAt) verifiedByActivity.set(result.activityId, result);
  }
  const responseSchedules = [...verifiedByActivity.values()].map((result) => {
    const schedule = accepted.find((entry) => entry.activityId === result.activityId);
    const hours = schedule ? (schedule.endSlot - schedule.startSlot) * 0.5 : 0;
    return schedule && hours > 0
      ? { ...schedule, powerKW: result.eligibleShiftedKWh / hours }
      : undefined;
  }).filter((schedule): schedule is ScheduleEntry => Boolean(schedule));
  return peakConcurrentPower(scenario, responseSchedules);
}

export function summarizeScenario(scenario: Scenario): ScenarioSummary {
  const effective = effectiveSchedules(scenario);
  const balances = classifyBalance(scenario.forecast, effective, scenario.sitePowerLimitKW);
  const acceptedKW = peakConcurrentPower(scenario, latestAcceptedSchedules(scenario));
  const verifiedKW = verifiedResponseKW(scenario);
  return { absorbSlots: balances.filter((item) => item.mode === "absorb").length, protectSlots: balances.filter((item) => item.mode === "protect").length, baselinePeakKW: round(baselinePeak(scenario)), scheduledPeakKW: round(peak(scenario, effective)), acceptedKW: round(acceptedKW), verifiedKW: round(verifiedKW), unresolvedGapKW: round(Math.max(0, acceptedKW - verifiedKW)), data_source: "simulation" };
}
