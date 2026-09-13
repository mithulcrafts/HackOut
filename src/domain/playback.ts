import type { Activity, MeterReading, ScheduleEntry, VerificationResult, Scenario } from "./types";
export type PlaybackOutcome = "success" | "partial" | "late" | "missing" | "rebound";
const SLOT_MS = 30 * 60 * 1000;

function timestampForSlot(date: string, slot: number) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + Math.floor(slot / 48));
  const withinDay = slot % 48;
  return `${day.toISOString().slice(0, 10)}T${String(Math.floor(withinDay / 2)).padStart(2, "0")}:${withinDay % 2 ? "30" : "00"}:00+05:30`;
}

/** One counter reading at every boundary; all energy is simulated, never measured. */
export function simulateReadings(date: string, eventId: string, activity: Activity, schedule: ScheduleEntry, outcome: PlaybackOutcome): MeterReading[] {
  if (outcome === "missing") return [];
  const delay = outcome === "late" ? Math.max(1, activity.latestFinish - schedule.endSlot + 1) : 0;
  const actualStart = schedule.startSlot + delay;
  const actualEnd = schedule.endSlot + delay;
  const energy = activity.requiredEnergyKWh * (outcome === "partial" ? 0.55 : 1);
  const reboundSlot = schedule.endSlot;
  const finalSlot = Math.max(48, actualEnd, outcome === "rebound" ? reboundSlot + 1 : 0);
  let cumulativeKWh = 0;
  return Array.from({ length: finalSlot + 1 }, (_, slot) => {
    if (slot > actualStart && slot <= actualEnd) cumulativeKWh += energy / activity.durationSlots;
    if (outcome === "rebound" && slot === reboundSlot + 1) cumulativeKWh += activity.requiredEnergyKWh * 0.25;
    const readingKey = `operator-playback:${eventId}:${activity.id}:v${schedule.version}:${slot}`;
    return {
      id: readingKey,
      eventId,
      activityId: activity.id,
      deviceId: `simulator-${activity.id}`,
      timestamp: timestampForSlot(date, slot),
      cumulativeKWh: Number(cumulativeKWh.toFixed(3)),
      serviceComplete: outcome !== "partial" && slot === actualEnd,
      readingKey,
      data_source: "simulation" as const,
    };
  });
}

export function verifyReadings(date: string, activity: Activity, schedule: ScheduleEntry, readings: MeterReading[]): VerificationResult & { eligibleShiftedKWh: number } {
  const base = { activityId: activity.id, requiredEnergyKWh: activity.requiredEnergyKWh, acceptedWindow: { startSlot: schedule.startSlot, endSlot: schedule.endSlot }, data_source: "simulation" as const };
  if (readings.length < 2) return { ...base, outcome: "pending", recordedEnergyKWh: 0, eligibleShiftedKWh: 0, reason: "Verification is pending because no complete meter trace was received. Missing evidence is not a penalty." };
  const midnight = Date.parse(`${date}T00:00:00+05:30`);
  if (new Set(readings.map((reading) => reading.readingKey)).size !== readings.length || readings.some((reading) => reading.activityId !== activity.id || reading.deviceId !== readings[0].deviceId)) return { ...base, outcome: "needs_review", recordedEnergyKWh: 0, eligibleShiftedKWh: 0, reason: "Duplicate or mismatched device evidence needs review before a reward can be released." };
  let total = 0;
  let inWindow = 0;
  let baselineRemaining = 0;
  for (let index = 1; index < readings.length; index++) {
    const previous = readings[index - 1];
    const current = readings[index];
    const start = (Date.parse(previous.timestamp) - midnight) / SLOT_MS;
    const end = (Date.parse(current.timestamp) - midnight) / SLOT_MS;
    const delta = current.cumulativeKWh - previous.cumulativeKWh;
    if (![start, end, delta].every(Number.isFinite) || end <= start || delta < -0.001) return { ...base, outcome: "needs_review", recordedEnergyKWh: Number(total.toFixed(3)), eligibleShiftedKWh: 0, reason: "The meter trace has an out-of-order reading or counter reset. Review the evidence before issuing a reward." };
    if (end - start > 1) return { ...base, outcome: "pending", recordedEnergyKWh: Number(total.toFixed(3)), eligibleShiftedKWh: 0, reason: "An interval reading is missing. Verification remains pending until the complete trace arrives." };
    if (delta / ((end - start) * 0.5) > activity.powerLimitKW * 1.05) return { ...base, outcome: "needs_review", recordedEnergyKWh: Number(total.toFixed(3)), eligibleShiftedKWh: 0, reason: "Recorded power exceeds the equipment limit. Review the device association and readings." };
    total += Math.max(0, delta);
    if (start >= schedule.startSlot && end <= schedule.endSlot) inWindow += Math.max(0, delta);
    if (start >= activity.baselineStart && end <= activity.baselineStart + activity.durationSlots) baselineRemaining += Math.max(0, delta);
  }
  const recordedEnergyKWh = Number(total.toFixed(3));
  const traceStart = (Date.parse(readings[0].timestamp) - midnight) / SLOT_MS;
  const traceEnd = (Date.parse(readings[readings.length - 1].timestamp) - midnight) / SLOT_MS;
  if (traceStart > 0 || traceEnd < 48) return { ...base, outcome: "pending", recordedEnergyKWh, eligibleShiftedKWh: 0, reason: "The daily trace is incomplete. Baseline and rebound periods must be present before settlement." };
  const completion = readings.find((reading) => reading.serviceComplete);
  const completionSlot = completion ? (Date.parse(completion.timestamp) - midnight) / SLOT_MS : undefined;
  const eligibleShiftedKWh = Number(Math.max(0, Math.min(inWindow, activity.requiredEnergyKWh - baselineRemaining, activity.requiredEnergyKWh)).toFixed(3));
  if (total > activity.requiredEnergyKWh * 1.05) return { ...base, outcome: "failed", recordedEnergyKWh, eligibleShiftedKWh: 0, reason: "The trace contains added consumption beyond the agreed requirement. Rebound energy is not an eligible shift." };
  if (completionSlot !== undefined && completionSlot > activity.latestFinish) return { ...base, outcome: "failed", recordedEnergyKWh, eligibleShiftedKWh: 0, reason: "The activity completed after its deadline. The record is retained, but no verified response is counted." };
  if (total < activity.requiredEnergyKWh * 0.95 || !completion) return { ...base, outcome: "partial", recordedEnergyKWh, eligibleShiftedKWh: 0, reason: "Only part of the required service was delivered. The activity remains unverified and no full-capacity response is counted." };
  if (inWindow < activity.requiredEnergyKWh * 0.95 || eligibleShiftedKWh <= 0) return { ...base, outcome: "failed", recordedEnergyKWh, eligibleShiftedKWh: 0, reason: "The trace does not prove an eligible change from the frozen baseline into the accepted window." };
  return { ...base, outcome: "verified", recordedEnergyKWh, eligibleShiftedKWh, reason: "Scenario interval readings confirm the agreed energy in the accepted window, completion before the deadline and an eligible change from the baseline." };
}

export function recordSimulatedOffer(scenario: Scenario, offerId: string, outcome: PlaybackOutcome): Scenario {
  const offer = scenario.offers.find((item) => item.id === offerId && item.decision === "accept");
  const activity = scenario.activities.find((item) => item.id === offer?.activityId);
  const schedule = scenario.schedules.find((item) => item.activityId === activity?.id && item.accepted);
  if (!offer || !activity || !schedule) throw new Error("Accept this activity before recording evidence.");
  if (scenario.readings.some((item) => item.eventId === offer.eventId && item.activityId === activity.id)) throw new Error("Readings already exist. Verify them or start a new event to review another outcome.");
  const readings = simulateReadings(scenario.date, offer.eventId, activity, schedule, outcome);
  return { ...scenario, readings: [...scenario.readings, ...readings], simulatedOfferIds: [...new Set([...(scenario.simulatedOfferIds ?? []), offerId])] };
}

/** Idempotent evidence-based settlement shared by consumer and operator routes. */
export function verifyScenarioOffer(scenario: Scenario, offerId: string): Scenario {
  const offer = scenario.offers.find((item) => item.id === offerId && item.decision === "accept");
  const activity = scenario.activities.find((item) => item.id === offer?.activityId);
  const schedule = scenario.schedules.find((item) => item.activityId === activity?.id && item.accepted);
  if (!offer || !activity || !schedule) throw new Error("Only an accepted schedule can be verified.");
  if (scenario.results?.[offerId] && scenario.results[offerId].outcome !== "pending") return scenario;
  const readings = scenario.readings.filter((item) => item.activityId === activity.id && item.eventId === offer.eventId);
  const verification = verifyReadings(scenario.date, activity, schedule, readings);
  const createdAt = new Date().toISOString();
  const event = scenario.events.find((item) => item.id === offer.eventId);
  const rewardEligibleKWh = Math.min(verification.eligibleShiftedKWh, event?.rewardRatePerKWh ? offer.rewardEstimate / event.rewardRatePerKWh : 0);
  const ledger = scenario.rewardLedger ?? [];
  const spent = ledger.filter((entry) => scenario.offers.find((item) => item.id === entry.offerId)?.eventId === event?.id).reduce((sum, entry) => sum + entry.illustrativeRupees, 0);
  const rupees = verification.outcome === "verified" ? Number(Math.max(0, Math.min(offer.rewardEstimate, verification.eligibleShiftedKWh * (event?.rewardRatePerKWh ?? 0), (event?.budget ?? 0) - spent)).toFixed(2)) : 0;
  const status = verification.outcome === "verified" ? "verified" : verification.outcome === "pending" ? "accepted" : "failed";
  return {
    ...scenario,
    results: { ...scenario.results, [offerId]: { ...verification, createdAt } },
    activities: scenario.activities.map((item) => item.id === activity.id ? { ...item, status } : item),
    rewardLedger: rupees > 0 && !ledger.some((entry) => entry.offerId === offerId) ? [...ledger, { id: `demo-reward-${offerId}`, offerId, points: Math.floor(rewardEligibleKWh * 15), illustrativeRupees: rupees, state: "verified", createdAt }] : ledger,
  };
}


