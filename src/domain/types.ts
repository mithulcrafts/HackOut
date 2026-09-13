export type DataSource = "simulation" | "weather_estimate" | "model_forecast" | "device_reading";
export type ActivityType = "ev" | "water_heater" | "industrial_process" | "washing_machine" | "dishwasher" | "irrigation_pump" | "pool_pump" | "cold_storage" | "e_bike" | "custom";
export type ActivityStatus = "recommended" | "accepted" | "skipped" | "completed" | "verified" | "failed" | "paused";
export type OfferDecision = "pending" | "accept" | "modify" | "skip" | "override";
export type Mode = "absorb" | "protect";
export type EventObjective = "absorb" | "protect";
export type EventStatus = "draft" | "active" | "verifying" | "closed";
export type VerificationOutcome = "pending" | "verified" | "partial" | "failed" | "needs_review";

export interface TimeSlot {
  index: number;
  start: string;
  end: string;
  durationHours: 0.5;
}

export interface ForecastSlot extends TimeSlot {
  solarKW: number;
  windKW: number;
  renewableKW: number;
  fixedDemandKW: number;
  data_source: DataSource;
}

export interface Activity {
  id: string;
  name: string;
  type: ActivityType;
  requiredEnergyKWh: number;
  earliestStart: number;
  latestFinish: number;
  powerLimitKW: number;
  durationSlots: number;
  interruptible: boolean;
  baselineStart: number;
  status: ActivityStatus;
}

export interface ScheduleEntry {
  activityId: string;
  startSlot: number;
  endSlot: number;
  powerKW: number;
  accepted: boolean;
  version: number;
  data_source: DataSource;
}

export interface MeterReading {
  id: string;
  eventId: string;
  activityId: string;
  deviceId: string;
  timestamp: string;
  cumulativeKWh: number;
  serviceComplete: boolean;
  readingKey: string;
  data_source: "device_reading" | "simulation";
}

export interface VerificationResult {
  activityId: string;
  outcome: VerificationOutcome;
  requiredEnergyKWh: number;
  recordedEnergyKWh: number;
  acceptedWindow: { startSlot: number; endSlot: number };
  reason: string;
  data_source: "device_reading" | "simulation";
}

export interface Offer {
  id: string;
  eventId: string;
  activityId: string;
  originalStart: number;
  proposedStart: number;
  proposedEnd: number;
  deadline: number;
  renewableAlignment: number;
  rewardEstimate: number;
  /**
   * Eligibility is frozen when a participant accepts an offer.  It allows a
   * user to remain in the scheduling programme after opting out of rewards
   * without creating a ledger entry during verification.
   */
  rewardEligible?: boolean;
  decision: OfferDecision;
  version: number;
  status: ActivityStatus;
  expiresAt: string;
  data_source: DataSource;
}

export interface DemandResponseEvent {
  id: string;
  name: string;
  objective: EventObjective;
  status: EventStatus;
  windowStart: number;
  windowEnd: number;
  requestedFlexibilityKW: number;
  eligibleActivityTypes: ActivityType[];
  participantGroup?: string;
  minParticipants?: number;
  maxParticipants?: number;
  rewardRatePerKWh: number;
  budget: number;
  offerExpiresAt: string;
  frozenBaselineVersion?: number;
}

/** A release record keeps an operator-visible gap after a participant changes
 * an accepted plan. It is an audit signal, not proof that a replacement was
 * delivered. */
export interface RecoveryRecord {
  id: string;
  eventId: string;
  lostActivityId: string;
  lostPowerKW: number;
  lostStartSlot: number;
  lostEndSlot: number;
  replacementOfferIds: string[];
  batterySupportKW: number;
  unresolvedGapKW: number;
  createdAt: string;
  data_source: DataSource;
}

/**
 * A participant's request for an operator to inspect missing or disputed
 * evidence.  It is deliberately separate from VerificationResult: asking for
 * help must never turn an untrusted upload into a settled reward.
 */
export interface EvidenceReviewRequest {
  id: string;
  eventId: string;
  offerId: string;
  activityId: string;
  note: string;
  status: "open" | "acknowledged";
  createdAt: string;
  data_source: DataSource;
}

export interface BatteryState {
  capacityKWh: number;
  currentKWh: number;
  maxChargeKW: number;
  maxDischargeKW: number;
  roundTripEfficiency: number;
}

export interface BatteryDispatch {
  slot: number;
  mode: Mode;
  powerKW: number;
  stateOfChargeKWh: number;
  action: "charge" | "discharge" | "idle";
}

export interface Scenario {
  id: string;
  date: string;
  timezone: "Asia/Kolkata";
  sitePowerLimitKW: number;
  rewardRatePerKWh: number;
  forecast: ForecastSlot[];
  activities: Activity[];
  schedules: ScheduleEntry[];
  offers: Offer[];
  events: DemandResponseEvent[];
  readings: MeterReading[];
  simulatedOfferIds?: string[];
  /** Outcome selected for an incremental simulator trace, kept stable so
   * changing the UI selector mid-trace cannot produce contradictory counters. */
  playbackOutcomes?: Record<string, "success" | "partial" | "late" | "missing" | "rebound">;
  results?: Record<string, VerificationResult & { eligibleShiftedKWh: number; baselineRecordedKWh?: number; createdAt: string }>;
  rewardLedger?: { id: string; offerId: string; points: number; illustrativeRupees: number; state: "verified" | "redeemable"; createdAt: string }[];
  recovery?: RecoveryRecord[];
  evidenceReviewRequests?: EvidenceReviewRequest[];
  battery: BatteryState;
  mode: Mode;
  data_source: DataSource;
}

export interface BalanceResult {
  slot: number;
  balanceKW: number;
  mode: Mode;
  exceedsSiteLimit: boolean;
  gridActions: string[];
}

export type GridRecommendationAction =
  | "shift_demand"
  | "reduce_demand"
  | "charge_battery"
  | "discharge_battery"
  | "export_surplus"
  | "import_backup_review"
  | "site_capacity_review"
  | "curtailment_review";

export interface RecommendationFactor {
  label: string;
  score: number;
  detail: string;
}

export interface GridRecommendation {
  slot: number;
  mode: Mode;
  action: GridRecommendationAction;
  title: string;
  score: number;
  rationale: string;
  impact: { powerKW: number; energyKWh: number };
  factors: RecommendationFactor[];
  feasibility: "ready" | "consent_required" | "review_required" | "unavailable";
  caveats: string[];
  data_source: DataSource;
}

export interface ScenarioSummary {
  absorbSlots: number;
  protectSlots: number;
  baselinePeakKW: number;
  scheduledPeakKW: number;
  acceptedKW: number;
  verifiedKW: number;
  unresolvedGapKW: number;
  data_source: DataSource;
}
