import type { Activity, ActivityType, Scenario } from "@/domain/types";
import { publishEvent } from "@/domain/events";
import { createSchedule } from "@/domain/scheduling/engine";
import { effectiveSchedules } from "@/domain/summary";

export const demoActivityNames: Record<ActivityType, string> = { ev: "EV charging", water_heater: "Water heating", industrial_process: "Industrial process" };
export function demoActivityRecord(activity: Activity, date: string) {
  const time = (slot: number) => `${String(Math.floor(slot / 2)).padStart(2, "0")}:${slot % 2 ? "30" : "00"}`;
  return { id: activity.id, type: demoActivityNames[activity.type], name: activity.name, earliest_start: time(activity.earliestStart), latest_finish: time(activity.latestFinish), duration_minutes: activity.durationSlots * 30, interruptible: activity.interruptible, status: activity.status, created_at: date, power_kw: activity.powerLimitKW, required_kwh: activity.requiredEnergyKWh };
}

/** One create/edit scheduling boundary; existing commitments stay reserved. */
export function scheduleDemoActivity(scenario: Scenario, activity: Activity) {
  // Reserve every existing activity at its physical window. A pending offer
  // does not remove the load from its original time.
  const committed = effectiveSchedules(scenario);
  const event = scenario.events.find((item) => item.status === "active" && item.eligibleActivityTypes.includes(activity.type));
  let schedule;
  let offer = null;
  if (event) {
    const reserved = scenario.offers.filter((item) => item.eventId === event.id && item.decision === "accept").reduce((sum, item) => sum + item.rewardEstimate, 0);
    const publication = publishEvent({ ...scenario, activities: [activity], schedules: committed, offers: [], events: [{ ...event, status: "draft", budget: Math.max(0, event.budget - reserved) }] }, event.id);
    offer = publication.offers.find((item) => item.activityId === activity.id) ?? null;
    schedule = publication.schedules.find((item) => item.activityId === activity.id);
  } else {
    const forecast = scenario.forecast.map((slot) => ({ ...slot, fixedDemandKW: slot.fixedDemandKW + committed.filter((item) => slot.index >= item.startSlot && slot.index < item.endSlot).reduce((sum, item) => sum + item.powerKW, 0) }));
    schedule = createSchedule([activity], forecast, scenario.sitePowerLimitKW).schedules[0];
  }
  return {
    scenario: { ...scenario, activities: [...scenario.activities, activity], schedules: schedule ? [...scenario.schedules, schedule] : scenario.schedules, offers: offer ? [...scenario.offers, offer] : scenario.offers },
    offer,
    message: offer ? "Activity saved and a programme offer is ready." : "Activity saved. No safe reward window is available; continue with your normal schedule without penalty.",
  };
}
