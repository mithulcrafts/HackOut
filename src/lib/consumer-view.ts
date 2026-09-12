import type { ConsumerState } from "./consumer";
import { scheduleSeries } from "./consumer-metrics";
import { outlookFixture } from "./consumer-fixture";
export function consumerView(state:ConsumerState){
 return {
  ...state,
  presentation:{
   outlook:outlookFixture,
   outlookSource:"Standalone simulation fixture",
   schedule:scheduleSeries(state.offer),
   rewardRate:1.5,pointsPerKWh:15,
   estimatedPoints:state.offer?Math.min(120,Math.floor(state.offer.required_kwh*15)):0,
   estimatedRupees:state.offer?Math.min(12,state.offer.required_kwh*1.5):0,
   allowedStarts:[26,27,28],
  }
 };
}
export type ConsumerView=ReturnType<typeof consumerView>;
