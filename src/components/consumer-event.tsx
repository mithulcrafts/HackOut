"use client";
import { useState } from "react";
import Link from "next/link";
import { useResource } from "@/hooks/use-resource";
import type { ConsumerView } from "@/lib/consumer-view";
import { slotTime, type ConsumerAction } from "@/lib/consumer";
import { ConsumerFeedback } from "./consumer-feedback";
import { RenewableOutlook, ScheduleChart } from "./charts/consumer-charts";

export function ConsumerEvent({ inbox=false }: { inbox?: boolean }) {
  const resource=useResource<ConsumerView>("/api/consumer");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [start,setStart]=useState("26"),[outcome,setOutcome]=useState<NonNullable<ConsumerAction["outcome"]>>("success");
  const [filter,setFilter]=useState("all"),[resetOpen,setResetOpen]=useState(false);
  const state=resource.data,o=state?.offer;
  async function action(command:ConsumerAction["command"]) {
    if(busy)return;setBusy(true);setMessage("");
    const url=["seed","reset"].includes(command)?"/api/consumer":command==="simulate"?"/api/meter-readings":command==="verify"?"/api/verification":"/api/offers/decision";
    try {
      const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({command,...(command!=="seed"&&o?{offerId:o.id,version:o.version}:{}),...(command==="modify"?{startSlot:Number(start)}:{}),...(command==="simulate"?{outcome}:{})})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||"Unable to update offer.");
      resource.setData(body);setResetOpen(false);setMessage(command==="modify"?"Window updated. Review it and accept when ready.":command==="skip"||command==="override"?"Your choice is saved. No penalty or points deducted.":"Saved. Your latest result is shown below.");
    }catch(error){setMessage(error instanceof Error?error.message:"Connection failed.");await resource.refresh();}
    finally{setBusy(false);}
  }
  async function markRead(){setBusy(true);try{const r=await fetch("/api/notifications",{method:"POST"});if(!r.ok)throw new Error("Unable to mark notifications read.");await resource.refresh();}catch(e){setMessage(e instanceof Error?e.message:"Please retry.");}finally{setBusy(false);}}
  return <>
    <ConsumerFeedback loading={resource.loading} error={resource.error} retry={resource.refresh}/>
    <p className="form-message" role="status" aria-live="polite">{busy?"Saving…":message}</p>
    {state&&!o&&<article className="schedule-card"><h2>Your demo is ready to start</h2><p>Create a dedicated EV offer with a 5 PM deadline. Your other activities remain separate.</p><button className="primary-button" disabled={busy} onClick={()=>action("seed")}>Start simulated EV event</button></article>}
    {inbox&&o&&<label className="filter-control">Show offers<select value={filter} onChange={e=>setFilter(e.target.value)}>{["all","pending","accepted","skipped","overridden"].map(value=><option key={value} value={value}>{value}</option>)}</select></label>}
    {o&&state&&(filter==="all"||filter===o.decision)&&<article className="schedule-card event-card">
      <span className="status-pill absorb">{o.decision} · simulated Absorb event</span><h2>{o.name}</h2>
      <p>Move an existing task into a renewable-aligned window. You decide whether the time works.</p>
      <dl className="detail-grid"><div><dt>Usual time</dt><dd>{slotTime(o.baseline_start)}–{slotTime(o.baseline_start+o.duration_slots)}</dd></div><div><dt>{o.decision==="accepted"?"Accepted":"Proposed"} time</dt><dd>{slotTime(o.proposed_start)}–{slotTime(o.proposed_start+o.duration_slots)}</dd></div><div><dt>Ready by</dt><dd>{slotTime(o.deadline_slot)} IST</dd></div><div><dt>Task requirement</dt><dd>{o.required_kwh} kWh · {o.power_kw} kW limit</dd></div></dl>
      <div className="reward-preview"><strong>Up to {state.presentation.estimatedPoints} points</strong><span>₹{state.presentation.estimatedRupees.toFixed(2)} illustrative reward · only for verified eligible energy</span></div>
      <p>Demo rate: ₹{state.presentation.rewardRate}/kWh, capped at ₹12 per event. No live funding or payment.</p>
      {o.decision==="pending"&&<><div className="offer-actions"><button className="primary-button" disabled={busy} onClick={()=>action("accept")}>Accept offer</button><button className="secondary-button" disabled={busy} onClick={()=>action("skip")}>Skip without penalty</button></div><details className="evidence-readings"><summary>Modify the time</summary><label className="filter-control">New start time<select value={start} onChange={e=>setStart(e.target.value)}>{state.presentation.allowedStarts.map(s=><option key={s} value={s}>{slotTime(s)} IST</option>)}</select></label><button className="secondary-button" disabled={busy} onClick={()=>action("modify")}>Save proposed time</button><p>Changing the proposal does not accept it. Only these three fixture windows are available.</p></details></>}
      {o.decision==="accepted"&&!o.simulation_run&&<><p className="notice">Your window starts at {slotTime(o.proposed_start)}. Complete by {slotTime(o.deadline_slot)}. This is an in-app reminder; no device will start automatically.</p><button className="secondary-button" disabled={busy} onClick={()=>action("override")}>Override schedule</button><details className="evidence-readings" open><summary>Meter simulator</summary><label className="filter-control">Simulated outcome<select value={outcome} onChange={e=>setOutcome(e.target.value as NonNullable<ConsumerAction["outcome"]>)}><option value="success">Task completed on time</option><option value="partial">Partial completion</option><option value="missing">Device offline / missing readings</option><option value="late">Completed after deadline</option><option value="rebound">Extra consumption / rebound</option></select></label><button className="primary-button" disabled={busy} onClick={()=>action("simulate")}>Generate simulated readings</button><p>Generates the full day of readings once. Reset this demo to try another outcome.</p></details></>}
      {o.simulation_run&&!state.verification&&<div className="notice"><p>{state.readings.length} simulated meter readings are ready. Missing readings will fail verification.</p><button className="primary-button" disabled={busy} onClick={()=>action("verify")}>Verify readings</button></div>}
      {state.verification&&<div className="notice"><h3>{state.verification.status.toUpperCase()}</h3><p>{state.verification.reason}</p><p>{state.verification.recorded_kwh} kWh recorded · {state.verification.eligible_kwh} kWh eligible shift</p><Link className="text-link" href="/consumer/rewards">View reward and history →</Link></div>}
      {["skipped","overridden"].includes(o.decision)&&<p className="notice">No penalty. Your original plan is your choice. Operator recovery will connect through your teammate’s scheduler.</p>}
      <details className="evidence-readings"><summary>Restart this demo</summary><p>Deletes this demo’s readings, verification and reward. Other saved activities remain. Use this to test a different outcome.</p>{resetOpen?<div className="offer-actions"><button className="secondary-button" disabled={busy} onClick={()=>action("reset")}>Confirm demo reset</button><button className="secondary-button" onClick={()=>setResetOpen(false)}>Cancel</button></div>:<button className="secondary-button" onClick={()=>setResetOpen(true)}>Reset demo…</button>}</details>
    </article>}
    {o&&filter!=="all"&&filter!==o.decision&&<p className="notice">No {filter} offers.</p>}
    {!inbox&&state&&<><RenewableOutlook slots={state.presentation.outlook}/><ScheduleChart rows={state.presentation.schedule}/></>}
    {state&&<article className="schedule-card"><div className="section-heading"><h2>Notifications</h2><button className="secondary-button" disabled={busy||!state.notifications.some(n=>!n.read_at)} onClick={markRead}>Mark all read</button></div>{state.notifications.length?state.notifications.map(n=><div className="notification-item" key={n.id}><p>{!n.read_at&&<strong>New · </strong>}{n.message}</p><small>{new Date(n.created_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})} IST</small></div>):<p>No notifications yet.</p>}</article>}
  </>;
}
