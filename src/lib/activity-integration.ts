import type { Activity as DomainActivity, Scenario } from "@/domain/types";
import { createSchedule } from "@/domain/scheduling/engine";
import { effectiveSchedules } from "@/domain/summary";
import { scheduleDemoActivity } from "./demo-activities";
import { activityDefaults, activityTypeMap } from "./activities";

type SavedActivity = { id: string; name: string; type: string; earliest_start?: string; latest_finish?: string; baseline_start?: string; duration_minutes?: number; durationHours?: number; interruptible: boolean; status: string; power_kw?: number; required_kwh?: number };
const toSlot = (time?: string) => time && /^([01]\d|2[0-3]):(00|30)(:00)?$/.test(time) ? Number(time.slice(0, 2)) * 2 + Number(time.slice(3, 5)) / 30 : NaN;

/** Converts owner-scoped requirements; never assumes an arbitrary load is industrial. */
export function activityToDomain(activity: SavedActivity): DomainActivity | null {
  const start = toSlot(activity.earliest_start);
  const finish = toSlot(activity.latest_finish);
  const baseline = toSlot(activity.baseline_start ?? activity.earliest_start);
  const durationSlots = Number(activity.duration_minutes ?? (activity.durationHours ?? NaN) * 60) / 30;
  const preset = activityDefaults[activity.type as keyof typeof activityDefaults];
  const power = Number(activity.power_kw ?? preset?.power ?? NaN);
  const energy = Number(activity.required_kwh ?? power * durationSlots * 0.5);
  if (![start, finish, baseline, durationSlots].every(Number.isInteger) || start < 0 || finish > 48 || durationSlots <= 0 || start + durationSlots > finish || baseline < start || baseline + durationSlots > finish || !Number.isFinite(power) || power <= 0 || power > 500 || !Number.isFinite(energy) || energy <= 0 || energy > power * durationSlots * 0.5) return null;
  const statuses: DomainActivity["status"][] = ["recommended", "accepted", "skipped", "completed", "verified", "failed", "paused"];
  return { id: activity.id, name: activity.name, type: activityTypeMap[activity.type as keyof typeof activityTypeMap] ?? "custom", requiredEnergyKWh: energy, earliestStart: start, latestFinish: finish, powerLimitKW: power, durationSlots, interruptible: activity.interruptible, baselineStart: baseline, status: statuses.includes(activity.status as DomainActivity["status"]) ? activity.status as DomainActivity["status"] : "recommended" };
}

export function scheduleSavedActivities(activities: SavedActivity[], scenario: Scenario) {
  return activities.map((activity) => {
    if (activity.status === "paused") return { activityId: activity.id, startSlot: null, endSlot: null, powerKW: 0, source: "simulation", reason: "Participation is paused. Resume this activity when you want a new recommendation." };
    const domain = activityToDomain(activity);
    const unavailable = (reason: string) => ({ activityId: activity.id, startSlot: null, endSlot: null, powerKW: 0, source: "simulation", reason });
    if (!domain) return unavailable("Complete valid half-hour timing and equipment power before scheduling.");
    const other = effectiveSchedules(scenario).filter((entry) => entry.activityId !== activity.id);
    const forecast = scenario.forecast.map((slot) => ({ ...slot, fixedDemandKW: slot.fixedDemandKW + other.filter((entry) => slot.index >= entry.startSlot && slot.index < entry.endSlot).reduce((sum, entry) => sum + entry.powerKW, 0) }));
    const result = createSchedule([domain], forecast, scenario.sitePowerLimitKW);
    const schedule = result.schedules[0];
    return schedule ? { activityId: activity.id, startSlot: schedule.startSlot, endSlot: schedule.endSlot, powerKW: schedule.powerKW, source: "simulation", reason: "Independent preview only; acceptance must recheck shared capacity." } : unavailable(result.unscheduled[0]?.reason ?? "No safe window is available.");
  });
}

/** A saved row is not an accepted grid commitment. */
export function addActivityToScenario(activity: SavedActivity, scenario: Scenario): Scenario {
  const domain = activityToDomain(activity);
  if (!domain || scenario.schedules.some((entry) => entry.activityId === activity.id && entry.accepted) || scenario.readings.some((entry) => entry.activityId === activity.id)) return scenario;
  const base = { ...scenario, activities: scenario.activities.filter((entry) => entry.id !== activity.id), schedules: scenario.schedules.filter((entry) => entry.activityId !== activity.id), offers: scenario.offers.filter((entry) => entry.activityId !== activity.id) };
  return scheduleDemoActivity(base, domain).scenario;
}
