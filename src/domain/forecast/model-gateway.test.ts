import { describe, expect, it } from "vitest";
import { parseModelPoints, resampleModelPower } from "./model-gateway";

describe("model gateway", () => {
  it("parses Quartz's documented timestamp-keyed response", () => {
    const points = parseModelPoints({ predictions: { power_kw: { "2026-09-13T00:00:00": 2, "2026-09-13T00:15:00": 4, "2026-09-13T00:30:00": 2 } } }, true);
    expect(points).toHaveLength(3);
    expect(points[0].powerKW).toBe(2);
    expect(points[1].epoch - points[0].epoch).toBe(15 * 60 * 1000);
  });

  it("resamples a 15-minute model timeline to half-hour slot averages", () => {
    const start = "2026-09-13T00:00:00.000Z";
    const startEpoch = Date.parse(start);
    const points = [0, 15, 30, 45, 60].map((minutes) => ({ epoch: startEpoch + minutes * 60 * 1000, powerKW: minutes / 15 }));
    expect(resampleModelPower(points, start, 2, 10)).toEqual([1, 3]);
  });

  it("rejects an uncovered operating interval instead of extrapolating", () => {
    const start = "2026-09-13T00:00:00.000Z";
    const startEpoch = Date.parse(start);
    expect(() => resampleModelPower([{ epoch: startEpoch, powerKW: 1 }, { epoch: startEpoch + 30 * 60 * 1000, powerKW: 1 }], start, 2, 10)).toThrow("does not cover");
  });
});
