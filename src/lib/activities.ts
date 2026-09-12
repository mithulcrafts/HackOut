import { z } from "zod";

export const activityTypes = ["EV charging", "Water heating", "Industrial process"] as const;
export type ActivityType = string;

export const activityInputSchema = z.object({
  type: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(80),
  earliestStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  latestFinish: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationHours: z.coerce.number().min(0.5).max(12).refine((value) => Number.isInteger(value * 2), "Duration must use 30-minute increments."), interruptible: z.boolean(),
}).superRefine((value, ctx) => {
  const start = toMinutes(value.earliestStart); const finish = toMinutes(value.latestFinish);
  if (finish <= start) ctx.addIssue({ code: "custom", path: ["latestFinish"], message: "Choose a same-day deadline after the start time." });
  if (finish - start < value.durationHours * 60) ctx.addIssue({ code: "custom", path: ["durationHours"], message: "The activity must fit inside its time window." });
});
export type ActivityInput = z.infer<typeof activityInputSchema>;
export type Activity = ActivityInput & { id: string; createdAt?: string; status: string; earliest_start?: string; latest_finish?: string; duration_minutes?: number };
export const toMinutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
