"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleGauge } from "lucide-react";
import { useResource } from "@/hooks/use-resource";
import type { ConsumerView } from "@/lib/consumer-view";
import { slotTime, type ConsumerAction } from "@/lib/consumer";
import { ConsumerFeedback } from "./consumer-feedback";
import { ListenButton } from "./listen-button";
import { actionLabel, bilingual, getConsumerCopy } from "@/lib/language";
import { RenewableOutlook, ScheduleChart } from "./charts/consumer-charts";

type OfferChoice = { id: string; name: string; decision: string };
type Presentation = ConsumerView["presentation"] & { availableOffers?: OfferChoice[]; objective?: string; rewardCap?: number; outlookSource?: string };
function decisionLabel(decision: string) { return decision === "pending" ? "Offer" : decision === "accept" ? "Accepted" : decision === "skip" ? "Skipped" : decision === "override" ? "Changed plan" : decision === "modify" ? "Updated offer" : decision; }

export function ConsumerEvent({ inbox = false }: { inbox?: boolean }) {
  const [selectedOfferId, setSelectedOfferId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("offerId") ?? "");
  const resourceUrl = useMemo(() => selectedOfferId ? `/api/consumer?offerId=${encodeURIComponent(selectedOfferId)}` : "/api/consumer", [selectedOfferId]);
  const resource = useResource<ConsumerView>(resourceUrl);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [start, setStart] = useState("");
  const [filter, setFilter] = useState("all");
  const [language, setLanguage] = useState("en-IN");
  const [executionStatus, setExecutionStatus] = useState<"scheduled" | "started" | "delayed">("scheduled");
  useEffect(() => {
    const local = window.localStorage.getItem("vidyut_language");
    if (local) queueMicrotask(() => setLanguage(local));
    fetch("/api/profile").then(async response => response.ok ? response.json() : null).then(body => {
      const selected = body?.profile?.preferred_language;
      if (selected) { setLanguage(selected); window.localStorage.setItem("vidyut_language", selected); }
    }).catch(() => undefined);
  }, []);
  const labels = getConsumerCopy(language);
  const state = resource.data, o = state?.offer, presentation = state?.presentation as Presentation | undefined;
  const choices = state?.availableOffers ?? [];
  const allowedStarts = presentation?.allowedStarts ?? [];
  const focusSlot = o?.proposed_start ?? 26;
  const focusOutlook = presentation?.outlook?.find((slot) => slot.slot === focusSlot) ?? presentation?.outlook?.[0];
  const focusBalance = presentation?.operatorIntegration?.balances?.find((balance) => balance.slot === focusSlot);
  const highlightWindow = o ? { start: o.proposed_start, end: Math.min(48, o.proposed_start + o.duration_slots) } : null;
  const protectMode = focusBalance?.mode === "protect" || presentation?.objective === "protect";
  function selectOffer(id: string) {
    setSelectedOfferId(id);
    window.history.replaceState(null, "", id ? `/consumer/offers?offerId=${encodeURIComponent(id)}` : "/consumer/offers");
  }
  async function action(command: ConsumerAction["command"]) {
    if (busy) return; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/consumer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command, ...(command !== "seed" && o ? { offerId: o.id, version: o.version } : {}), ...(command === "modify" ? { startSlot: Number(start || allowedStarts[0]) } : {}), ...(command === "simulate" ? { outcome: "success" } : {}) }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to update offer.");
      resource.setData(body);
      setMessage(command === "modify" ? "Window updated. Review it and accept when ready." : command === "skip" || command === "override" ? "Your choice is saved. No penalty or points deducted." : "Saved. Your latest result is shown below.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Connection failed."); await resource.refresh(); }
    finally { setBusy(false); }
  }
  async function markRead() { setBusy(true); try { const r = await fetch("/api/notifications", { method: "POST" }); if (!r.ok) throw new Error("Unable to mark notifications read."); await resource.refresh(); } catch (e) { setMessage(e instanceof Error ? e.message : "Please retry."); } finally { setBusy(false); } }
  return <>
    <ConsumerFeedback loading={resource.loading} error={resource.error} retry={resource.refresh} />
    <p className="form-message" role="status" aria-live="polite">{busy ? labels.saving : message}</p>
    {inbox && choices.length > 0 && <label className="filter-control">Choose an offer<select value={o?.id ?? selectedOfferId} onChange={e => selectOffer(e.target.value)}><option value="">All offers</option>{choices.map(choice => <option key={choice.id} value={choice.id}>{choice.name} · {choice.decision}</option>)}</select></label>}
    {state && !o && <article className="schedule-card"><h2>Your programme is ready</h2><p>We will match your flexible activity to a renewable-aligned window while protecting your deadline.</p><button className="primary-button" disabled={busy} onClick={() => action("seed")}>{actionLabel(language, "Load recommendation")}</button></article>}
    {!inbox && state && <article className="pulse-card app-day-pulse" aria-label="Current renewable timing"><div className={`pulse-ring ${protectMode ? "protect" : ""}`}><CircleGauge size={25} /><strong>{focusOutlook ? slotTime(focusSlot) : "—"}</strong><small>{focusOutlook ? `${focusOutlook.renewableKW.toFixed(1)} kW est.` : "No estimate"}</small></div><div><span className={`status-pill ${protectMode ? "protect" : "absorb"}`}>{protectMode ? "PROTECT PEAK" : "ABSORB RENEWABLE"}</span><h2>{protectMode ? "Keep the peak comfortable" : "A renewable-rich window is ahead"}</h2><p>{protectMode ? "Flexible activities can move away from this period. You remain in control." : "We will show a safe activity window and explain the reward before you decide."}</p></div></article>}
    {!inbox && state && <article className="schedule-card timing-explainer"><div className="section-heading"><div><span className="section-label">TIMING EXPLAINED</span><h2>Why this time?</h2></div><span className="source">{presentation?.outlookSource ?? "Estimated"}</span></div><p>{protectMode ? "The forecast shows less renewable supply or a higher demand risk around this period. Moving a flexible activity earlier protects the evening peak while keeping your deadline." : "This window has the strongest estimated renewable availability inside your activity's safe operating window. Moving existing demand here helps absorb that energy without asking you to consume more."}</p>{focusOutlook && <div className="detail-grid"><div><dt>Estimated renewable</dt><dd>{focusOutlook.renewableKW.toFixed(1)} kW</dd></div><div><dt>Solar estimate</dt><dd>{focusOutlook.solarKW.toFixed(1)} kW</dd></div><div><dt>Wind estimate</dt><dd>{focusOutlook.windKW.toFixed(1)} kW</dd></div><div><dt>Decision</dt><dd>{protectMode ? "Protect peak" : "Absorb renewable"}</dd></div></div>}<details className="evidence-readings"><summary>What the estimate means</summary><p>These are estimated renewable values for the programme area. They describe a better timing condition; they do not mean your appliance receives electricity exclusively from renewable sources.</p></details></article>}
    {!inbox && state && <article className="schedule-card daily-plan"><div className="section-heading"><div><span className="section-label">TODAY AT A GLANCE</span><h2>Your flexible plan</h2></div><span className="source">IST</span></div><div className="daily-summary-grid"><div><strong>₹{state.rewardSummary?.verifiedRupees.toFixed(2) ?? "0.00"}</strong><small>Verified cashback</small></div><div><strong>₹{state.rewardSummary?.pendingRupees.toFixed(2) ?? "0.00"}</strong><small>Pending reward</small></div><div><strong>{state.rewardSummary?.points ?? 0}</strong><small>Reward points</small></div></div>{state.upcoming?.length ? <div className="upcoming-list">{state.upcoming.slice(0, 4).map(item => <div className="upcoming-item" key={item.id}><div><strong>{item.name}</strong><small>{slotTime(item.proposed_start)}–{slotTime(item.proposed_start + item.duration_slots)} · ready by {slotTime(item.deadline_slot)}</small></div><span className={`status-pill ${item.decision === "accept" ? "accepted" : item.decision === "skip" ? "muted-status" : "absorb"}`}>{decisionLabel(item.decision)}</span></div>)}</div> : <p className="muted">No active activity offer today. Your normal schedule remains unchanged.</p>}</article>}
    {inbox && o && <label className="filter-control">Filter offers<select value={filter} onChange={e => setFilter(e.target.value)}>{["all", "pending", "accepted", "skipped", "overridden"].map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
    {o && state && (filter === "all" || filter === o.decision) && <article className="schedule-card event-card">
      <span className={`status-pill ${presentation?.objective === "protect" ? "protect" : "absorb"}`}>{o.decision} · {presentation?.objective === "protect" ? "Protect peak" : "Absorb renewable event"}</span><div className="section-heading"><h2>{o.name}</h2><ListenButton text={`${o.name}. Move an existing task into a renewable-aligned window. Ready by ${slotTime(o.deadline_slot)}.`} /></div>
      <p>Move an existing task into a renewable-aligned window. You decide whether the time works.</p>
      <dl className="detail-grid"><div><dt>Usual time</dt><dd>{slotTime(o.baseline_start)}–{slotTime(o.baseline_start + o.duration_slots)}</dd></div><div><dt>{o.decision === "accepted" ? "Accepted" : "Proposed"} time</dt><dd>{slotTime(o.proposed_start)}–{slotTime(o.proposed_start + o.duration_slots)}</dd></div><div><dt>Ready by</dt><dd>{slotTime(o.deadline_slot)} IST</dd></div><div><dt>Task requirement</dt><dd>{o.required_kwh} kWh · {o.power_kw} kW limit</dd></div></dl>

      <p className="notice"><strong>Why this window?</strong> {presentation?.objective === "protect" ? "It moves an existing peak load away from the protected period while keeping your deadline." : "It has the strongest estimated renewable availability that fits your deadline and site limits."} Delivery mode: in-app reminder. No device starts automatically.</p>
      <div className="reward-preview"><strong>Up to {presentation?.estimatedPoints ?? 0} points</strong><span>₹{(presentation?.estimatedRupees ?? 0).toFixed(2)} reward estimate · only for verified eligible energy</span></div>
      <p>Rate: ₹{presentation?.rewardRate ?? 1.5}/kWh, capped at ₹{presentation?.rewardCap ?? 12} per event. Offer expires at {o.expires_at ? new Date(o.expires_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "the programme cutoff"} IST. No live funding or payment.</p>
      {o.decision === "pending" && <><div className="offer-actions"><button className="primary-button" disabled={busy} onClick={() => action("accept")}>{bilingual(language, "accept", "Accept offer")}</button><button className="secondary-button" disabled={busy} onClick={() => action("skip")}>{bilingual(language, "skip", "Skip without penalty")}</button></div><details className="evidence-readings"><summary>{actionLabel(language, "Modify the time")}</summary>{allowedStarts.length ? <><label className="filter-control">New start time<select value={start || String(allowedStarts[0])} onChange={e => setStart(e.target.value)}>{allowedStarts.map(s => <option key={s} value={s}>{slotTime(s)} IST</option>)}</select></label><button className="secondary-button" disabled={busy} onClick={() => action("modify")}>{actionLabel(language, "Save proposed time")}</button></> : <p>No safe alternative window is available for this activity.</p>}<p>Changing the proposal does not accept it. Only feasible programme windows are shown.</p></details></>}
      {o.decision === "accepted" && (!o.simulation_run || (state.verification?.status === "pending" && state.readings.length === 0)) && <><p className="notice">Your window starts at {slotTime(o.proposed_start)}. Complete by {slotTime(o.deadline_slot)}. This is an in-app reminder; no device will start automatically.</p><div className="offer-actions"><button className="secondary-button" disabled={busy} onClick={() => { setExecutionStatus("started"); setMessage("Marked as started for your own tracking. A meter or device reading is still required for verification."); }}>{executionStatus === "started" ? "In progress" : "Started"}</button><button className="secondary-button" disabled={busy} onClick={() => { setExecutionStatus("delayed"); setMessage("Delay noted. Your accepted window is unchanged; complete it before the deadline or change the plan."); }}>Delay</button><button className="text-button danger-action" disabled={busy} onClick={() => action("override")}>{actionLabel(language, "Change plan")}</button><button className="text-button" disabled={busy} onClick={() => action("override")}>Skip activity</button></div><p className="muted">{executionStatus === "started" ? "Started status is a personal reminder only; it does not prove electricity was consumed." : executionStatus === "delayed" ? "Delay noted. Choose Change plan if the accepted window no longer works." : "Choose Started, Delay, Change plan or Skip. There is no penalty for changing your mind."}</p><div className="evidence-readings"><p>When you finish the activity, submit its meter reading for verification.</p><button className="primary-button" disabled={busy} onClick={() => action("simulate")}>{actionLabel(language, state.verification?.status === "pending" ? "Retry verification" : "Submit completion")}</button></div></>}

      {o.simulation_run && (!state.verification || state.verification.status === "pending") && <div className="notice"><p>{state.verification?.status === "pending" ? "Verification is waiting for meter or device readings." : `${state.readings.length} meter reading(s) are ready.`}</p><button className="primary-button" disabled={busy} onClick={() => action("verify")}>{bilingual(language, "verify", "Verify readings")}</button></div>}
      {state.verification && <div className="notice"><h3>{state.verification.status.toUpperCase()}</h3><p>{state.verification.reason}</p><p>{state.verification.recorded_kwh} kWh recorded · {state.verification.eligible_kwh} kWh eligible shift</p><Link className="text-link" href="/consumer/rewards">View reward and history →</Link></div>}
      {["skipped", "overridden"].includes(o.decision) && <p className="notice">No penalty. Your original plan remains unchanged.</p>}

    </article>}
    {o && filter !== "all" && filter !== o.decision && <p className="notice">No {filter} offers.</p>}
    {!inbox && state && <><RenewableOutlook slots={presentation?.outlook ?? []} source={presentation?.outlookSource} highlightWindow={highlightWindow} /><ScheduleChart rows={presentation?.schedule ?? []} /></>}
    {state && <article className="schedule-card"><div className="section-heading"><h2>{bilingual(language, "notifications", "Notifications")}</h2><ListenButton text={state.notifications.map(n=>n.message).join(". ")} /><button className="secondary-button" disabled={busy || !state.notifications.some(n => !n.read_at)} onClick={markRead}>{bilingual(language, "markRead", "Mark all read")}</button></div>{state.notifications.length ? state.notifications.map(n => <div className="notification-item" key={n.id}><p>{!n.read_at && <strong>New · </strong>}{n.message}</p><small>{new Date(n.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</small></div>) : <p>No notifications yet.</p>}</article>}
  </>;
}
