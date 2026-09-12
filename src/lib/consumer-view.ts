import type { ConsumerState } from "./consumer";
import { scheduleSeries } from "./consumer-metrics";
import { outlookFixture } from "./consumer-fixture";
import type { Scenario } from "@/domain/types";
import { classifyBalance } from "@/domain/scheduling/engine";
export function consumerView(state:ConsumerState, scenario?:Scenario){
 return {
  ...state,
  presentation:{
   outlook:scenario ? scenario.forecast.map(slot => ({slot:slot.index,solarKW:slot.solarKW,windKW:slot.windKW,renewableKW:slot.renewableKW})) : outlookFixture,
   outlookSource:scenario ? "Teammate A synthetic forecast" : "Standalone simulation fixture",
   schedule:scheduleSeries(state.offer),
   rewardRate:1.5,pointsPerKWh:15,
   estimatedPoints:state.offer?Math.min(120,Math.floor(state.offer.required_kwh*15)):0,
   estimatedRupees:state.offer?Math.min(12,state.offer.required_kwh*1.5):0,
   allowedStarts:[26,27,28],
   operatorIntegration: scenario ? { forecast: scenario.forecast, balances: classifyBalance(scenario.forecast, scenario.schedules, scenario.sitePowerLimitKW), scenarioId: scenario.id, source: "Teammate A deterministic scheduler" } : null,
  }
 };
}
export type ConsumerView=ReturnType<typeof consumerView>;
