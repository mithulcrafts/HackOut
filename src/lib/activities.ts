import { z } from "zod";

/** Flexible activities exposed in the consumer picker. Each is deferrable or
 * interruptible when the user says it is safe to move. */
export const activityTypes = [
  "EV charging",
  "Water heating",
  "Industrial process",
  "Washing machine",
  "Dishwasher",
  "Irrigation pump",
  "Pool pump",
  "Cold storage pre-cooling",
  "E-bike charging",
] as const;
export type ActivityType = (typeof activityTypes)[number] | "Custom";

export const activityTypeMap: Record<ActivityType, import("@/domain/types").ActivityType> = {
  "EV charging": "ev",
  "Water heating": "water_heater",
  "Industrial process": "industrial_process",
  "Washing machine": "washing_machine",
  "Dishwasher": "dishwasher",
  "Irrigation pump": "irrigation_pump",
  "Pool pump": "pool_pump",
  "Cold storage pre-cooling": "cold_storage",
  "E-bike charging": "e_bike",
  Custom: "custom",
};

export const activityDefaults: Record<ActivityType, { power: number; duration: number; description: string }> = {
  "EV charging": { power: 4, duration: 2, description: "Charge before you leave" },
  "Water heating": { power: 2, duration: 1, description: "Heat before you need it" },
  "Industrial process": { power: 10, duration: 2, description: "Move an approved process" },
  "Washing machine": { power: 0.7, duration: 1, description: "Run a laundry cycle" },
  "Dishwasher": { power: 1.2, duration: 1.5, description: "Run after the last meal" },
  "Irrigation pump": { power: 3, duration: 1, description: "Water crops or gardens" },
  "Pool pump": { power: 1.5, duration: 2, description: "Maintain pool circulation" },
  "Cold storage pre-cooling": { power: 6, duration: 1, description: "Pre-cool before the peak" },
  "E-bike charging": { power: 0.5, duration: 2, description: "Charge for your next trip" },
  Custom: { power: 0, duration: 1, description: "Add any flexible task" },
};

export const activityInputSchema = z.object({
  type: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(80),
  earliestStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  latestFinish: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationHours: z.coerce.number().min(0.5).max(12).refine((value) => Number.isInteger(value * 2), "Duration must use 30-minute increments."), interruptible: z.boolean(),
  powerKW: z.coerce.number().positive().max(500).optional(),
}).superRefine((value, ctx) => {
  const start = toMinutes(value.earliestStart); const finish = toMinutes(value.latestFinish);
  if (start % 30 !== 0) ctx.addIssue({ code: "custom", path: ["earliestStart"], message: "Start time must use a 30-minute interval." });
  if (finish % 30 !== 0) ctx.addIssue({ code: "custom", path: ["latestFinish"], message: "Deadline must use a 30-minute interval." });
  if (finish <= start) ctx.addIssue({ code: "custom", path: ["latestFinish"], message: "Choose a same-day deadline after the start time." });
  if (finish - start < value.durationHours * 60) ctx.addIssue({ code: "custom", path: ["durationHours"], message: "The activity must fit inside its time window." });
  if (!activityTypes.includes(value.type as (typeof activityTypes)[number]) && value.powerKW === undefined) ctx.addIssue({ code: "custom", path: ["powerKW"], message: "Enter the expected power for a custom load." });
});
export type ActivityInput = z.infer<typeof activityInputSchema>;
export type Activity = ActivityInput & { id: string; createdAt?: string; status: string; earliest_start?: string; latest_finish?: string; duration_minutes?: number };
export const toMinutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
