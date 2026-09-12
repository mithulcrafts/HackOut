import type { GridRecommendation, GridRecommendationAction, Scenario, ScheduleEntry } from "./types";
import { classifyBalance, dispatchBattery, activityPowerKW } from "./scheduling/engine";
import { effectiveSchedules } from "./summary";

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function acceptedIds(scenario: Scenario) {
  return new Set(scenario.schedules.filter((entry) => entry.accepted).map((entry) => entry.activityId));
}

/** Flexibility which can actually be moved into this slot without counting an activity twice. */
function movableCapacity(scenario: Scenario, slot: number, effective: ScheduleEntry[]): { powerKW: number; activityCount: number } {
  const accepted = acceptedIds(scenario);
  const candidates = scenario.activities.filter((activity) => {
    if (accepted.has(activity.id)) return false;
    const power = activityPowerKW(activity);
    if (power <= 0 || slot < activity.earliestStart || slot + activity.durationSlots > activity.latestFinish) return false;
    return Array.from({ length: activity.durationSlots }, (_, offset) => scenario.forecast[slot + offset]).every((forecastSlot) =>
      forecastSlot && forecastSlot.fixedDemandKW + effective.filter((entry) => entry.activityId !== activity.id && entry.accepted && forecastSlot.index >= entry.startSlot && forecastSlot.index < entry.endSlot).reduce((sum, entry) => sum + entry.powerKW, 0) + power <= scenario.sitePowerLimitKW,
    );
  });
  // Reserve candidate windows greedily so overlapping activities cannot be counted twice.
  const used = new Map<number, number>();
  const selected = candidates.filter((activity) => {
    const power = activityPowerKW(activity);
    const legal = Array.from({ length: activity.durationSlots }, (_, offset) => {
      const index = slot + offset;
      const existing = effective.filter((entry) => entry.activityId !== activity.id && entry.accepted && index >= entry.startSlot && index < entry.endSlot).reduce((sum, entry) => sum + entry.powerKW, 0);
      return scenario.forecast[index] && scenario.forecast[index].fixedDemandKW + existing + (used.get(index) ?? 0) + power <= scenario.sitePowerLimitKW;
    }).every(Boolean);
    if (legal) for (let index = slot; index < slot + activity.durationSlots; index++) used.set(index, (used.get(index) ?? 0) + power);
    return legal;
  });
  return { powerKW: round(selected.reduce((sum, activity) => sum + activityPowerKW(activity), 0)), activityCount: selected.length };
}

function interruptibleCapacity(scenario: Scenario, slot: number, effective: ScheduleEntry[]) {
  return round(effective.filter((entry) => {
    const activity = scenario.activities.find((item) => item.id === entry.activityId);
    return activity?.interruptible && slot >= entry.startSlot && slot < entry.endSlot;
  }).reduce((sum, entry) => sum + entry.powerKW, 0));
}

function score(balance: number, siteLimit: number, impact: number, feasibility: number, urgency: number) {
  const magnitude = Math.min(100, Math.round(Math.abs(balance) / Math.max(1, siteLimit) * 100));
  const benefit = impact > 0 ? Math.min(100, Math.round(impact / Math.max(1, Math.abs(balance)) * 100)) : 0;
  return Math.max(0, Math.min(100, Math.round(0.35 * urgency + 0.3 * feasibility + 0.25 * benefit + 0.1 * magnitude)));
}

function recommendation(args: {
  slot: number;
  mode: "absorb" | "protect";
  action: GridRecommendationAction;
  title: string;
  impactKW: number;
  balance: number;
  siteLimit: number;
  feasibility: GridRecommendation["feasibility"];
  rationale: string;
  detail: string;
  urgency?: number;
  caveats?: string[];
  source: GridRecommendation["data_source"];
}): GridRecommendation {
  const feasibilityScore = args.feasibility === "ready" ? 95 : args.feasibility === "consent_required" ? 78 : args.feasibility === "review_required" ? 48 : 5;
  const urgency = args.urgency ?? Math.min(100, Math.round(Math.abs(args.balance) / Math.max(1, args.siteLimit) * 100));
  const impactKW = round(Math.max(0, args.impactKW));
  return {
    slot: args.slot,
    mode: args.mode,
    action: args.action,
    title: args.title,
    score: score(args.balance, args.siteLimit, impactKW, feasibilityScore, urgency),
    rationale: args.rationale,
    impact: { powerKW: impactKW, energyKWh: round(impactKW * 0.5) },
    factors: [
      { label: "Grid urgency", score: urgency, detail: "Size of the slot imbalance and any site limit breach." },
      { label: "Feasibility", score: feasibilityScore, detail: args.detail },
      { label: "Expected relief", score: impactKW > 0 ? Math.min(100, Math.round(impactKW / Math.max(1, Math.abs(args.balance)) * 100)) : 0, detail: "Usable power in this half-hour slot." },
    ],
    feasibility: args.feasibility,
    caveats: [...(args.caveats ?? []), "Cost impact is not priced in the prototype; tariff and market data are required."],
    data_source: args.source,
  };
}

/**
 * Rank read-only operator guidance for every forecast slot. Scores are transparent
 * heuristics, not probabilities or claims of forecast accuracy.
 */
export function rankGridRecommendations(scenario: Scenario, selectedSlot?: number): GridRecommendation[] {
  const effective = effectiveSchedules(scenario);
  const balances = classifyBalance(scenario.forecast, effective, scenario.sitePowerLimitKW);
  const battery = dispatchBattery(scenario.forecast, effective, scenario.battery);
  const slots = selectedSlot === undefined ? scenario.forecast.map((slot) => slot.index) : [selectedSlot];
  const output: GridRecommendation[] = [];
  for (const slot of slots) {
    const forecast = scenario.forecast[slot];
    const balance = balances.find((item) => item.slot === slot);
    const priorBatteryKWh = slot === 0 ? scenario.battery.currentKWh : (battery[slot - 1]?.stateOfChargeKWh ?? scenario.battery.currentKWh);
    if (!forecast || !balance) continue;
    const overload = forecast.fixedDemandKW + effective.filter((entry) => entry.accepted && slot >= entry.startSlot && slot < entry.endSlot).reduce((sum, entry) => sum + entry.powerKW, 0) - scenario.sitePowerLimitKW;
    const movable = movableCapacity(scenario, slot, effective);
    const interruptible = interruptibleCapacity(scenario, slot, effective);
    if (overload > 0) {
      const reductionKW = Math.min(overload, interruptible);
      output.push(recommendation({ slot, mode: "protect", action: "reduce_demand", title: "Request consent to clear the site capacity breach", impactKW: reductionKW, balance: balance.balanceKW, siteLimit: scenario.sitePowerLimitKW, feasibility: reductionKW > 0 ? "consent_required" : "review_required", rationale: reductionKW > 0 ? `Interruptible demand can reduce the ${round(overload)} kW site overload.` : `Site demand is ${round(overload)} kW above the configured limit; no interruptible load is available.`, detail: "Capacity is checked against fixed and scheduled load for this slot.", caveats: ["This is a site overload constraint, not only a renewable deficit. Escalate to the site operator if the limit cannot be cleared."], source: forecast.data_source }));
      output.push(recommendation({ slot, mode: "protect", action: "site_capacity_review", title: "Escalate site capacity constraint", impactKW: Math.max(0, overload - reductionKW), balance: balance.balanceKW, siteLimit: scenario.sitePowerLimitKW, feasibility: "review_required", rationale: "Review feeder limit, non-flexible equipment and safe operating procedures before accepting another load.", detail: "Operator review only; no load or protection device is controlled by the prototype.", caveats: ["Battery dispatch cannot make equipment-level overload safe unless the site integration explicitly supports it."], source: forecast.data_source }));
      continue;
    }
    if (balance.mode === "absorb") {
      const shiftKW = Math.min(Math.max(0, balance.balanceKW), movable.powerKW);
      const roomKW = Math.max(0, scenario.battery.capacityKWh - priorBatteryKWh) / (0.5 * Math.sqrt(Math.min(1, Math.max(0.01, scenario.battery.roundTripEfficiency))));
      const chargeKW = Math.min(Math.max(0, balance.balanceKW - shiftKW), scenario.battery.maxChargeKW, roomKW);
      const residualKW = Math.max(0, balance.balanceKW - shiftKW - chargeKW);
      output.push(recommendation({ slot, mode: "absorb", action: "shift_demand", title: "Shift eligible demand into this renewable-rich window", impactKW: shiftKW, balance: balance.balanceKW, siteLimit: scenario.sitePowerLimitKW, feasibility: shiftKW > 0 ? "consent_required" : "unavailable", rationale: shiftKW > 0 ? `${movable.activityCount} activity${movable.activityCount === 1 ? " is" : "ies are"} feasible here without exceeding the site limit.` : "No unaccepted activity currently fits this slot.", detail: "Activity deadlines, power and accepted reservations are checked.", caveats: ["A consumer or site manager must consent before an offer is activated."], source: forecast.data_source }));
      output.push(recommendation({ slot, mode: "absorb", action: "charge_battery", title: "Charge available storage", impactKW: chargeKW, balance: balance.balanceKW, siteLimit: scenario.sitePowerLimitKW, feasibility: chargeKW > 0 ? "ready" : "unavailable", rationale: chargeKW > 0 ? "Remaining surplus fits the battery charge limit and available state-of-charge room." : "Battery is full, unavailable or surplus is already allocated.", detail: "Battery power, capacity and efficiency limits are applied.", source: forecast.data_source }));
      output.push(recommendation({ slot, mode: "absorb", action: "export_surplus", title: "Offer remaining surplus for export", impactKW: residualKW, balance: balance.balanceKW, siteLimit: scenario.sitePowerLimitKW, feasibility: residualKW > 0 ? "review_required" : "unavailable", rationale: residualKW > 0 ? "Surplus remains after feasible demand and storage actions." : "No residual surplus remains.", detail: "Requires an authorised market or interconnection decision.", source: forecast.data_source }));
      output.push(recommendation({ slot, mode: "absorb", action: "curtailment_review", title: "Review curtailment as a last resort", impactKW: residualKW, balance: balance.balanceKW, siteLimit: scenario.sitePowerLimitKW, feasibility: residualKW > 0 ? "review_required" : "unavailable", rationale: residualKW > 0 ? "Only consider after demand, storage and export options are exhausted." : "Curtailment is not indicated for this slot.", detail: "Operator review only; the prototype never issues a curtailment command.", caveats: ["Curtailment is a last-resort review and is not automatically scheduled."], source: forecast.data_source }));
    } else {
      const reductionKW = Math.min(Math.max(0, -balance.balanceKW), interruptible);
      const dischargeKW = Math.min(Math.max(0, -balance.balanceKW - reductionKW), scenario.battery.maxDischargeKW, priorBatteryKWh * Math.sqrt(Math.min(1, Math.max(0.01, scenario.battery.roundTripEfficiency))) / 0.5);
      const residualKW = Math.max(0, -balance.balanceKW - reductionKW - dischargeKW);
      output.push(recommendation({ slot, mode: "protect", action: "reduce_demand", title: "Request consent to reduce or delay flexible demand", impactKW: reductionKW, balance: balance.balanceKW, siteLimit: scenario.sitePowerLimitKW, feasibility: reductionKW > 0 ? "consent_required" : "unavailable", rationale: reductionKW > 0 ? "Interruptible activity is running in this stressed slot." : "No interruptible accepted activity is available for reduction.", detail: "Only active interruptible schedules are counted; accepted users are never moved silently.", caveats: ["User or site consent is required; no penalty is applied when a request is declined."], source: forecast.data_source }));
      output.push(recommendation({ slot, mode: "protect", action: "discharge_battery", title: "Dispatch available battery energy", impactKW: dischargeKW, balance: balance.balanceKW, siteLimit: scenario.sitePowerLimitKW, feasibility: dischargeKW > 0 ? "ready" : "unavailable", rationale: dischargeKW > 0 ? "Stored energy can cover part of the deficit within discharge limits." : "Battery has no usable energy or is unavailable.", detail: "Battery state-of-charge, efficiency and discharge limits are applied.", source: forecast.data_source }));
      output.push(recommendation({ slot, mode: "protect", action: "import_backup_review", title: "Review import or backup activation", impactKW: residualKW, balance: balance.balanceKW, siteLimit: scenario.sitePowerLimitKW, feasibility: residualKW > 0 ? "review_required" : "unavailable", rationale: residualKW > 0 ? "A residual deficit remains after demand response and storage." : "No residual deficit remains.", detail: overload > 0 ? "The deficit and site power limit breach require operator escalation." : "Requires authorised procurement or backup review.", caveats: overload > 0 ? [`Site limit is exceeded by ${round(overload)} kW; this is a site overload, not only a renewable shortfall.`] : [], source: forecast.data_source }));
    }
  }
  return output.filter((item) => item.feasibility !== "unavailable").sort((a, b) => b.score - a.score || a.slot - b.slot);
}
