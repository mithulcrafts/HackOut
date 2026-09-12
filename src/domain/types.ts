export type DataSource = "simulation" | "weather_estimate" | "device_reading";
export type ActivityType = "ev" | "water_heater" | "industrial_process";
export type ActivityStatus = "recommended" | "accepted" | "skipped" | "completed" | "verified" | "failed";
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
  decision: OfferDecision;
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
  rewardRatePerKWh: number;
  budget: number;
  offerExpiresAt: string;
  frozenBaselineVersion?: number;
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
