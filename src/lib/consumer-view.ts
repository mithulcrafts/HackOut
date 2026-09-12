import type { ConsumerState } from "./consumer";
import { scheduleSeries } from "./consumer-metrics";
import { outlookFixture } from "./consumer-fixture";
import type { Scenario } from "@/domain/types";
import { classifyBalance } from "@/domain/scheduling/engine";
import { effectiveSchedules } from "@/domain/summary";
type Terms = { allowedStarts: number[]; rewardRate: number; rewardCap: number; objective: "absorb" | "protect" };
export function consumerView(state: ConsumerState, outlook: typeof outlookFixture | Scenario = outlookFixture, outlookSource = "Simulation fixture", terms?: Terms) {
  const scenario = Array.isArray(outlook) ? undefined : outlook;
  const resolvedOutlook = Array.isArray(outlook) ? outlook : outlook.forecast.map(slot => ({ slot: slot.index, solarKW: slot.solarKW, windKW: slot.windKW, renewableKW: slot.renewableKW }));
  const rewardRate = terms?.rewardRate ?? 1.5;
  const rewardCap = terms?.rewardCap ?? 12;
  return {
    ...state,
    presentation: {
      outlook: resolvedOutlook,
      outlookSource: scenario ? "Scenario renewable estimate" : outlookSource,
      schedule: scheduleSeries(state.offer), rewardRate, pointsPerKWh: 15, rewardCap,
      objective: terms?.objective ?? "absorb",
      estimatedPoints: state.offer ? Math.floor(Math.min(state.offer.required_kwh, rewardCap / (rewardRate || 1.5)) * 15) : 0,
      estimatedRupees: state.offer ? Math.min(rewardCap, state.offer.required_kwh * rewardRate) : 0,
      allowedStarts: terms?.allowedStarts ?? [26, 27, 28],
      operatorIntegration: scenario ? { forecast: scenario.forecast, balances: classifyBalance(scenario.forecast, effectiveSchedules(scenario), scenario.sitePowerLimitKW), scenarioId: scenario.id, source: "Deterministic scheduler" } : null,
    },
  };
}
export type ConsumerView = ReturnType<typeof consumerView>;
