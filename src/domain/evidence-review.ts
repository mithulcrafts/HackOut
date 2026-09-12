import type { MeterReading, Scenario, VerificationOutcome } from "./types";
import { verifyReadings } from "./playback";

const MAX_BYTES = 100_000;
const MAX_ROWS = 200;
const HEADER = ["timestamp", "cumulative_kwh", "device_id", "service_complete"] as const;

export type EvidenceRow = {
  timestamp: string;
  cumulativeKWh: number;
  deviceId: string;
  serviceComplete: boolean;
};

export type EvidenceAssessment = {
  offerId: string;
  activityName: string;
  evidenceTier: "user_submitted_untrusted";
  dataSource: "user_submitted_csv";
  status: VerificationOutcome;
  reason: string;
  readingCount: number;
  originalWindow: { startSlot: number; endSlot: number };
  acceptedWindow: { startSlot: number; endSlot: number };
  recordedEnergyKWh: number;
  eligibleShiftedKWh: number;
  rewardEligible: false;
  issues: string[];
  trustGaps: string[];
};

export class EvidenceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceInputError";
  }
}

function parseBoolean(value: string | undefined, line: number) {
  if (value === undefined || value.trim() === "") return false;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  throw new EvidenceInputError(`Line ${line}: service_complete must be true or false.`);
}

/** Small, deliberately strict CSV parser. It accepts a meter export, not a free-form claim. */
export function parseEvidenceCsv(csv: string, byteLength = new TextEncoder().encode(csv).byteLength): EvidenceRow[] {
  if (byteLength > MAX_BYTES) throw new EvidenceInputError("Evidence file is too large (maximum 100 KB). Upload only the interval export needed for this event.");
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) throw new EvidenceInputError("CSV must include a header and at least one meter reading.");
  if (lines.length - 1 > MAX_ROWS) throw new EvidenceInputError("Evidence file contains too many rows (maximum 200). Upload one daily trace.");
  const header = lines[0].split(",").map((value) => value.trim().toLowerCase());
  if (header.length < 3 || header.length > 4 || header.some((value, index) => value !== HEADER[index])) {
    throw new EvidenceInputError("CSV columns must be: timestamp,cumulative_kwh,device_id,service_complete (the last column is optional).");
  }
  const readings: EvidenceRow[] = [];
  let previousTime = Number.NEGATIVE_INFINITY;
  let previousCumulative = Number.NEGATIVE_INFINITY;
  let device = "";
  for (let index = 1; index < lines.length; index += 1) {
    const line = index + 1;
    const cells = lines[index].split(",").map((value) => value.trim());
    if (cells.length !== header.length || cells.some((value) => value === "")) throw new EvidenceInputError(`Line ${line}: every required field must be present.`);
    const timestamp = cells[0];
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+05:30$/.test(timestamp)) throw new EvidenceInputError(`Line ${line}: timestamp must be ISO time with the Asia/Kolkata +05:30 offset.`);
    const time = Date.parse(timestamp);
    const cumulativeKWh = Number(cells[1]);
    if (!Number.isFinite(time) || !Number.isFinite(cumulativeKWh) || cumulativeKWh < 0) throw new EvidenceInputError(`Line ${line}: timestamp or cumulative_kwh is invalid.`);
    const deviceId = cells[2];
    if (device && device !== deviceId) throw new EvidenceInputError(`Line ${line}: all readings must belong to one device_id.`);
    device ||= deviceId;
    if (time <= previousTime) throw new EvidenceInputError(`Line ${line}: timestamps must be strictly increasing with no duplicates.`);
    if (cumulativeKWh < previousCumulative) throw new EvidenceInputError(`Line ${line}: cumulative_kwh decreased; a counter reset needs manual review.`);
    readings.push({ timestamp, cumulativeKWh, deviceId, serviceComplete: parseBoolean(cells[3], line) });
    previousTime = time;
    previousCumulative = cumulativeKWh;
  }
  return readings;
}

function copyScenario(scenario: Scenario): Scenario {
  return structuredClone(scenario);
}

/**
 * Assess user-supplied evidence against a copy of the frozen demo scenario.
 * This function never mutates the scenario and never creates a reward ledger row.
 */
export function assessEvidence(scenario: Scenario, offerId: string, rows: EvidenceRow[]): EvidenceAssessment {
  const offer = scenario.offers.find((item) => item.id === offerId);
  if (!offer || offer.decision !== "accept") throw new EvidenceInputError("Choose an accepted offer before uploading evidence.");
  const activity = scenario.activities.find((item) => item.id === offer.activityId);
  const schedule = scenario.schedules.find((item) => item.activityId === offer.activityId && item.accepted);
  if (!activity || !schedule) throw new EvidenceInputError("The accepted schedule could not be found. Refresh the offer and try again.");
  const readings: MeterReading[] = rows.map((row, index) => ({
    id: `uploaded:${offerId}:${index}`,
    eventId: offer.eventId,
    activityId: activity.id,
    deviceId: row.deviceId,
    timestamp: row.timestamp,
    cumulativeKWh: row.cumulativeKWh,
    serviceComplete: row.serviceComplete,
    readingKey: `uploaded:${offerId}:${row.timestamp}:${row.deviceId}`,
    data_source: "device_reading",
  }));
  const checked = verifyReadings(scenario.date, activity, schedule, readings);
  const status = checked.outcome;
  const checkedReason = status === "verified"
    ? "Submitted interval readings match the accepted window, deadline and baseline-change rules, but the file is still untrusted until a utility or approved device adapter attests to it."
    : checked.reason;
  const issues = status === "verified" ? [] : [checkedReason];
  return {
    offerId,
    activityName: activity.name,
    evidenceTier: "user_submitted_untrusted",
    dataSource: "user_submitted_csv",
    status,
    reason: checkedReason,
    readingCount: rows.length,
    originalWindow: { startSlot: activity.baselineStart, endSlot: activity.baselineStart + activity.durationSlots },
    acceptedWindow: { startSlot: schedule.startSlot, endSlot: schedule.endSlot },
    recordedEnergyKWh: checked.recordedEnergyKWh,
    eligibleShiftedKWh: checked.eligibleShiftedKWh,
    rewardEligible: false,
    issues,
    trustGaps: ["The upload is not cryptographically signed by a utility, meter or charger.", "No wallet, reward ledger or accepted schedule was changed.", "A utility or approved device adapter must review this evidence before any real settlement."],
  };
}

export function assessEvidenceWithoutMutation(scenario: Scenario, offerId: string, csv: string, byteLength?: number) {
  const rows = parseEvidenceCsv(csv, byteLength);
  const before = JSON.stringify(scenario);
  const assessment = assessEvidence(copyScenario(scenario), offerId, rows);
  if (JSON.stringify(scenario) !== before) throw new Error("Evidence assessment unexpectedly mutated the scenario.");
  return assessment;
}
