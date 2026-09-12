import type { Activity as DomainActivity, Scenario } from "@/domain/types";
import { createSchedule } from "@/domain/scheduling/engine";
type SavedActivity = { id:string; name:string; type:string; earliest_start?:string; latest_finish?:string; duration_minutes?:number; durationHours?:number; interruptible:boolean; status:string; power_kw?:number; required_kwh?:number };

const typeMap: Record<string, DomainActivity["type"]> = { "EV charging":"ev", "Water heating":"water_heater", "Industrial process":"industrial_process" };
export function activityToDomain(activity: SavedActivity): DomainActivity {
  const start = Number(activity.earliest_start?.slice(0,2) ?? 13) * 2 + Number(activity.earliest_start?.slice(3,5) ?? 0) / 30;
  const finish = Number(activity.latest_finish?.slice(0,2) ?? 17) * 2 + Number(activity.latest_finish?.slice(3,5) ?? 0) / 30;
  const durationSlots = Math.max(1, Math.round((activity.duration_minutes ?? (activity.durationHours ?? 1) * 60) / 30));
  const power = Number(activity.power_kw ?? (activity.type === "EV charging" ? 4 : activity.type === "Water heating" ? 2 : 10));
  return { id:activity.id,name:activity.name,type:typeMap[activity.type] ?? "industrial_process",requiredEnergyKWh:Number(activity.required_kwh ?? power*durationSlots*.5),earliestStart:start,latestFinish:finish,powerLimitKW:power,durationSlots,interruptible:activity.interruptible,baselineStart:start,status:(activity.status as DomainActivity["status"]) ?? "recommended" };
}
export function scheduleSavedActivities(activities: SavedActivity[], scenario: Scenario) {
  const domain = activities.map(activityToDomain);
  const result = createSchedule(domain, scenario.forecast, scenario.sitePowerLimitKW, 1);
  const scheduled = result.schedules.map(schedule => ({ activityId:schedule.activityId, startSlot:schedule.startSlot as number|null, endSlot:schedule.endSlot as number|null, powerKW:schedule.powerKW, source:schedule.data_source }));
  const unscheduled = result.unscheduled.map(item => ({activityId:item.activityId,startSlot:null as number|null,endSlot:null as number|null,powerKW:0,source:item.reason}));
  return [...scheduled, ...unscheduled];
}
