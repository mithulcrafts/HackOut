import { describe, expect, it } from "vitest";
import { createDemoScenario } from "./fixtures";
import { decideOffer } from "./events";
import { recordSimulatedOffer } from "./playback";
import { assessEvidenceWithoutMutation, parseEvidenceCsv } from "./evidence-review";

function acceptedScenario() {
  const base = createDemoScenario();
  const offer = base.offers[0];
  return { scenario: decideOffer(base, offer.id, "accept", undefined, offer.version), offer };
}

describe("evidence review", () => {
  it("accepts a complete user export but never makes it reward eligible", () => {
    const { scenario, offer } = acceptedScenario();
    const played = recordSimulatedOffer(scenario, offer.id, "success");
    const csv = ["timestamp,cumulative_kwh,device_id,service_complete", ...played.readings.filter((row) => row.activityId === offer.activityId).map((row) => `${row.timestamp},${row.cumulativeKWh},charger-1,${row.serviceComplete}`)].join("\n");
    const assessment = assessEvidenceWithoutMutation(scenario, offer.id, csv);
    expect(assessment.readingCount).toBe(played.readings.length);
    expect(assessment.status).toBe("verified");
    expect(assessment.evidenceTier).toBe("user_submitted_untrusted");
    expect(assessment.rewardEligible).toBe(false);
  });

  it("rejects unsafe CSV shape before domain review", () => {
    expect(() => parseEvidenceCsv("timestamp,cumulative_kwh,device_id\n2026-09-12T00:00:00Z,0,d1")).toThrow("+05:30");
    expect(() => parseEvidenceCsv("timestamp,cumulative_kwh,device_id\n2026-09-12T00:00:00+05:30,0,d1\n2026-09-12T00:00:00+05:30,1,d1")).toThrow("increasing");
    expect(() => parseEvidenceCsv("timestamp,cumulative_kwh,device_id\n2026-09-12T00:00:00+05:30,-1,d1")).toThrow("invalid");
  });

  it("reports incomplete evidence as pending and leaves the scenario unchanged", () => {
    const { scenario, offer } = acceptedScenario();
    const csv = "timestamp,cumulative_kwh,device_id,service_complete\n2026-09-12T00:00:00+05:30,0,charger-1,false\n2026-09-12T01:00:00+05:30,0,charger-1,false";
    const assessment = assessEvidenceWithoutMutation(scenario, offer.id, csv);
    expect(assessment.status).toBe("pending");
    expect(assessment.rewardEligible).toBe(false);
    expect(scenario.readings).toHaveLength(0);
    expect(scenario.rewardLedger).toBeUndefined();
  });
});
