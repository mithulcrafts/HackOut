import { describe, expect, it } from "vitest";
import { activityDatabaseError } from "./activity-errors";

describe("activity database errors", () => {
  it("identifies missing schema as a setup issue", () => {
    expect(activityDatabaseError("PGRST205")).toEqual({ status: 503, error: expect.stringContaining("database update") });
  });
  it("does not mislabel access or network failures as missing migrations", () => {
    expect(activityDatabaseError("42501").status).toBe(403);
    expect(activityDatabaseError("").error).toContain("temporarily unavailable");
  });
});
