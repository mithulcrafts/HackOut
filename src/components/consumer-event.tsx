"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useResource } from "@/hooks/use-resource";
import type { ConsumerView } from "@/lib/consumer-view";
import { slotTime, type ConsumerAction } from "@/lib/consumer";
import { ConsumerFeedback } from "./consumer-feedback";
import { RenewableOutlook, ScheduleChart } from "./charts/consumer-charts";

type OfferChoice = { id: string; name: string; decision: string };
type Presentation = ConsumerView["presentation"] & { availableOffers?: OfferChoice[]; objective?: string; rewardCap?: number; outlookSource?: string };

export function ConsumerEvent({ inbox = false }: { inbox?: boolean }) {
  const [selectedOfferId, setSelectedOfferId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("offerId") ?? "");
  const resourceUrl = useMemo(() => selectedOfferId ? `/api/consumer?offerId=${encodeURIComponent(selectedOfferId)}` : "/api/consumer", [selectedOfferId]);
  const resource = useResource<ConsumerView>(resourceUrl);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [start, setStart] = useState(""), [outcome, setOutcome] = useState<NonNullable<ConsumerAction["outcome"]>>("success");
  const [filter, setFilter] = useState("all"), [resetOpen, setResetOpen] = useState(false);
  const state = resource.data, o = state?.offer, presentation = state?.presentation as Presentation | undefined;
  const choices = state?.availableOffers ?? [];
  const allowedStarts = presentation?.allowedStarts ?? [];
  function selectOffer(id: string) {
    setSelectedOfferId(id);
    window.history.replaceState(null, "", id ? `/consumer/offers?offerId=${encodeURIComponent(id)}` : "/consumer/offers");
  }
  async function action(command: ConsumerAction["command"]) {
    if (busy) return; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/consumer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command, ...(command !== "seed" && o ? { offerId: o.id, version: o.version } : {}), ...(command === "modify" ? { startSlot: Number(start || allowedStarts[0]) } : {}), ...(command === "simulate" ? { outcome } : {}) }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to update offer.");
      resource.setData(body); setResetOpen(false); if (command === "reset") setSelectedOfferId("");
      setMessage(command === "modify" ? "Window updated. Review it and accept when ready." : command === "skip" || command === "override" ? "Your choice is saved. No penalty or points deducted." : command === "reset" ? "The shared demo scenario was reset." : "Saved. Your latest result is shown below.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Connection failed."); await resource.refresh(); }
    finally { setBusy(false); }
  }
  async function markRead() { setBusy(true); try { const r = await fetch("/api/notifications", { method: "POST" }); if (!r.ok) throw new Error("Unable to mark notifications read."); await resource.refresh(); } catch (e) { setMessage(e instanceof Error ? e.message : "Please retry."); } finally { setBusy(false); } }
  return <>
    <ConsumerFeedback loading={resource.loading} error={resource.error} retry={resource.refresh} />
    <p className="form-message" role="status" aria-live="polite">{busy ? "Saving…" : message}</p>
    {inbox && choices.length > 0 && <label className="filter-control">Choose an offer<select value={o?.id ?? selectedOfferId} onChange={e => selectOffer(e.target.value)}><option value="">All offers</option>{choices.map(choice => <option key={choice.id} value={choice.id}>{choice.name} · {choice.decision}</option>)}</select></label>}
    {state && !o && <article className="schedule-card"><h2>Your programme is ready</h2><p>The simulated programme will match your flexible activity to a renewable-aligned window with a protected deadline.</p><button className="primary-button" disabled={busy} onClick={() => action("seed")}>Start simulated event</button></article>}
    {inbox && o && <label className="filter-control">Filter offers<select value={filter} onChange={e => setFilter(e.target.value)}>{["all", "pending", "accepted", "skipped", "overridden"].map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
    {o && state && (filter === "all" || filter === o.decision) && <article className="schedule-card event-card">
      <span className="status-pill absorb">{o.decision} · {presentation?.objective === "protect" ? "Protect peak" : "Absorb renewable event"}</span><h2>{o.name}</h2>
      <p>Move an existing task into a renewable-aligned window. You decide whether the time works.</p>
      <dl className="detail-grid"><div><dt>Usual time</dt><dd>{slotTime(o.baseline_start)}–{slotTime(o.baseline_start + o.duration_slots)}</dd></div><div><dt>{o.decision === "accepted" ? "Accepted" : "Proposed"} time</dt><dd>{slotTime(o.proposed_start)}–{slotTime(o.proposed_start + o.duration_slots)}</dd></div><div><dt>Ready by</dt><dd>{slotTime(o.deadline_slot)} IST</dd></div><div><dt>Task requirement</dt><dd>{o.required_kwh} kWh · {o.power_kw} kW limit</dd></div></dl>
      <div className="reward-preview"><strong>Up to {presentation?.estimatedPoints ?? 0} points</strong><span>₹{(presentation?.estimatedRupees ?? 0).toFixed(2)} illustrative reward · only for verified eligible energy</span></div>
      <p>Rate: ₹{presentation?.rewardRate ?? 1.5}/kWh, capped at ₹{presentation?.rewardCap ?? 12} per event. No live funding or payment.</p>
      {o.decision === "pending" && <><div className="offer-actions"><button className="primary-button" disabled={busy} onClick={() => action("accept")}>Accept offer</button><button className="secondary-button" disabled={busy} onClick={() => action("skip")}>Skip without penalty</button></div><details className="evidence-readings"><summary>Modify the time</summary>{allowedStarts.length ? <><label className="filter-control">New start time<select value={start || String(allowedStarts[0])} onChange={e => setStart(e.target.value)}>{allowedStarts.map(s => <option key={s} value={s}>{slotTime(s)} IST</option>)}</select></label><button className="secondary-button" disabled={busy} onClick={() => action("modify")}>Save proposed time</button></> : <p>No safe alternative window is available for this activity.</p>}<p>Changing the proposal does not accept it. Only feasible programme windows are shown.</p></details></>}
      {o.decision === "accepted" && (!o.simulation_run || (state.verification?.status === "pending" && state.readings.length === 0)) && <><p className="notice">Your window starts at {slotTime(o.proposed_start)}. Complete by {slotTime(o.deadline_slot)}. This is an in-app reminder; no device will start automatically.</p><button className="secondary-button" disabled={busy} onClick={() => action("override")}>Override schedule</button><details className="evidence-readings" open><summary>Activity completion</summary><label className="filter-control">Simulated outcome<select value={outcome} onChange={e => setOutcome(e.target.value as NonNullable<ConsumerAction["outcome"]>)}><option value="success">Task completed on time</option><option value="partial">Partial completion</option><option value="missing">Device offline / missing readings</option><option value="late">Completed after deadline</option><option value="rebound">Extra consumption / rebound</option></select></label><button className="primary-button" disabled={busy} onClick={() => action("simulate")}>{state.verification?.status === "pending" ? "Retry with readings" : "Mark activity complete"}</button><p>Generates labelled demonstration readings. Reset the shared scenario to try another outcome.</p></details></>}
      {o.simulation_run && (!state.verification || state.verification.status === "pending") && <div className="notice"><p>{state.verification?.status === "pending" ? "Verification is waiting for meter or device readings." : `${state.readings.length} activity record is ready.`}</p><button className="primary-button" disabled={busy} onClick={() => action("verify")}>Verify readings</button></div>}
      {state.verification && <div className="notice"><h3>{state.verification.status.toUpperCase()}</h3><p>{state.verification.reason}</p><p>{state.verification.recorded_kwh} kWh recorded · {state.verification.eligible_kwh} kWh eligible shift</p><Link className="text-link" href="/consumer/rewards">View reward and history →</Link></div>}
      {["skipped", "overridden"].includes(o.decision) && <p className="notice">No penalty. Your original plan remains unchanged.</p>}
      <details className="evidence-readings"><summary>Restart this demo</summary><p>Resets this shared scenario, including offers, readings, verification and illustrative rewards. Use it to try another outcome.</p>{resetOpen ? <div className="offer-actions"><button className="secondary-button" disabled={busy} onClick={() => action("reset")}>Confirm demo reset</button><button className="secondary-button" onClick={() => setResetOpen(false)}>Cancel</button></div> : <button className="secondary-button" onClick={() => setResetOpen(true)}>Reset demo…</button>}</details>
    </article>}
    {o && filter !== "all" && filter !== o.decision && <p className="notice">No {filter} offers.</p>}
    {!inbox && state && <><RenewableOutlook slots={presentation?.outlook ?? []} source={presentation?.outlookSource} /><ScheduleChart rows={presentation?.schedule ?? []} /></>}
    {state && <article className="schedule-card"><div className="section-heading"><h2>Notifications</h2><button className="secondary-button" disabled={busy || !state.notifications.some(n => !n.read_at)} onClick={markRead}>Mark all read</button></div>{state.notifications.length ? state.notifications.map(n => <div className="notification-item" key={n.id}><p>{!n.read_at && <strong>New · </strong>}{n.message}</p><small>{new Date(n.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</small></div>) : <p>No notifications yet.</p>}</article>}
  </>;
}
