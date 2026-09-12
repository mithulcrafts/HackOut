import { describe, expect, it } from "vitest";
import { activityInputSchema } from "./activities";

const valid = { type: "EV charging" as const, name: "My EV", earliestStart: "13:00", latestFinish: "17:00", durationHours: 2, interruptible: true };
describe("activity input", () => {
  it("accepts a fitting same-day window", () => expect(activityInputSchema.safeParse(valid).success).toBe(true));
  it("rejects a deadline before the start", () => expect(activityInputSchema.safeParse({ ...valid, latestFinish: "12:00" }).success).toBe(false));
  it("rejects a duration that cannot fit", () => expect(activityInputSchema.safeParse({ ...valid, durationHours: 5 }).success).toBe(false));
  it("accepts a custom activity type with explicit equipment power", () => expect(activityInputSchema.safeParse({ ...valid, type: "Pool pump", powerKW: 1.5 }).success).toBe(true));
  it("requires custom power and aligned half-hour times", () => {
    expect(activityInputSchema.safeParse({ ...valid, type: "Pool pump" }).success).toBe(false);
    expect(activityInputSchema.safeParse({ ...valid, earliestStart: "13:15" }).success).toBe(false);
  });
});
