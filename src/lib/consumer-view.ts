import type { ConsumerState } from "./consumer";
import { scheduleSeries } from "./consumer-metrics";
import { outlookFixture } from "./consumer-fixture";
export function consumerView(state:ConsumerState, outlook = outlookFixture, outlookSource = "Simulation fixture", terms?: {allowedStarts: number[]; rewardRate: number; rewardCap: number; objective: "absorb" | "protect"}){
 return {
  ...state,
  presentation:{
   outlook,
   outlookSource,
   schedule:scheduleSeries(state.offer),
   rewardRate:terms?.rewardRate ?? 1.5,pointsPerKWh:15,
   rewardCap:terms?.rewardCap ?? 12,objective:terms?.objective ?? "absorb",
   estimatedPoints:state.offer?Math.floor(Math.min(state.offer.required_kwh,(terms?.rewardCap ?? 12)/(terms?.rewardRate || 1.5))*15):0,
   estimatedRupees:state.offer?Math.min(terms?.rewardCap ?? 12,state.offer.required_kwh*(terms?.rewardRate ?? 1.5)):0,
   allowedStarts:terms?.allowedStarts ?? [26,27,28],
  }
 };
}
export type ConsumerView=ReturnType<typeof consumerView>;
