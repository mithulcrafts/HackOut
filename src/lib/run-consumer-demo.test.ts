import { describe, expect, it, vi } from "vitest";
import { consumerActionSchema, emptyConsumerState, type ConsumerState } from "./consumer";
import { runConsumerDemo } from "./run-consumer-demo";

function state(version=1):ConsumerState {
  return {...emptyConsumerState,offer:{id:"00000000-0000-4000-8000-000000000001",name:"Demo EV",version,decision:"pending",baseline_start:30,proposed_start:26,duration_slots:4,deadline_slot:34,required_kwh:8,power_kw:4,simulation_run:false,completion_slot:null}};
}
describe("consumer demo orchestration",()=>{
  it("sends only valid commands and carries each returned version forward",async()=>{
    const initial=state(); const accepted=state(2); accepted.offer!.decision="accepted";
    const simulated=state(3); simulated.offer!.decision="accepted"; simulated.offer!.simulation_run=true;
    const send=vi.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(accepted).mockResolvedValueOnce(simulated).mockResolvedValueOnce(simulated);
    await runConsumerDemo(send);
    expect(send.mock.calls.map(([url])=>url)).toEqual(["/api/consumer","/api/offers/decision","/api/meter-readings","/api/verification"]);
    for(const [,body] of send.mock.calls) expect(consumerActionSchema.safeParse(body).success).toBe(true);
    expect(send.mock.calls[3][1]).toMatchObject({command:"verify",version:3});
  });
  it("preserves skipped and overridden decisions",async()=>{
    for(const decision of ["skipped","overridden"] as const){const current=state();current.offer!.decision=decision;const send=vi.fn().mockResolvedValue(current);await expect(runConsumerDemo(send)).rejects.toThrow("no decision has been changed");expect(send).toHaveBeenCalledTimes(1);}
  });
  it("returns an existing verification without rerunning or awarding again",async()=>{
    const current=state();current.offer!.decision="accepted";current.verification={status:"verified",reason:"Passed",recorded_kwh:8,eligible_kwh:8,baseline_kwh:0,created_at:"2026-09-12"};const send=vi.fn().mockResolvedValue(current);
    expect(await runConsumerDemo(send)).toBe(current);expect(send).toHaveBeenCalledTimes(1);
  });
  it("resumes verification after readings were already generated",async()=>{
    const current=state(3);current.offer!.decision="accepted";current.offer!.simulation_run=true;const send=vi.fn().mockResolvedValue(current);
    await runConsumerDemo(send);expect(send.mock.calls.map(([url])=>url)).toEqual(["/api/consumer","/api/verification"]);
  });
});
