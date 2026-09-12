import { describe, expect, it } from "vitest";
import { evaluateForecast, metrics } from "./evaluation";

describe("forecast evaluation", () => {
  it("reports error, baseline and uncertainty coverage", () => {
    const result = evaluateForecast([
      { slot: 0, label: "00:00", observedKW: 10, predictedKW: 12, baselineKW: 15, lowerKW: 8, upperKW: 14 },
      { slot: 1, label: "00:30", observedKW: 0, predictedKW: 2, baselineKW: 1, lowerKW: 0, upperKW: 3 },
    ], "public_observation", "Test observation", "ok");
    expect(result.model.maeKW).toBe(2);
    expect(result.model.mapePercent).toBe(20);
    expect(result.model.intervalCoveragePercent).toBe(100);
    expect(result.baseline.maeKW).toBe(3);
    expect(result.source).toBe("public_observation");
  });

  it("does not divide MAPE by zero", () => {
    expect(metrics([{ observedKW: 0, predictedKW: 1, lowerKW: 0, upperKW: 2 }]).mapePercent).toBeNull();
  });
});
