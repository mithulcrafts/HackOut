"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConsumerNav } from "./consumer-nav";
import type { ActivityDetail } from "@/lib/activity-detail";
import { slotTime } from "@/lib/consumer";
import { activityTypes } from "@/lib/activities";

type EditForm = { type: string; name: string; earliestStart: string; latestFinish: string; durationHours: string; interruptible: boolean; powerKW: string };
const initialForm: EditForm = { type: "EV charging", name: "", earliestStart: "13:00", latestFinish: "17:00", durationHours: "2", interruptible: true, powerKW: "2.3" };

export function ActivityDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [result, setResult] = useState<{ detail?: ActivityDetail; error?: string; status?: number }>({});
  const [attempt, setAttempt] = useState(0), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [form, setForm] = useState<EditForm>(initialForm);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/activities/${encodeURIComponent(id)}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      const body = await response.json();
      if (!controller.signal.aborted) setResult(response.ok ? { detail: body } : { error: body.error || "Unable to load this activity.", status: response.status });
    }).catch(() => { if (!controller.signal.aborted) setResult({ error: "Unable to connect. Please try again." }); });
    return () => controller.abort();
  }, [id, attempt]);
  const { detail, error, status } = result;
  function beginEdit() {
    if (!detail) return;
    const a = detail.activity;
    setForm({ type: a.type, name: a.name, earliestStart: a.earliest_start.slice(0, 5), latestFinish: a.latest_finish.slice(0, 5), durationHours: String(a.duration_minutes / 60), interruptible: a.interruptible, powerKW: String(a.power_kw ?? 2.3) });
    setEditing(true);
  }
  function update<K extends keyof EditForm>(key: K, value: EditForm[K]) { setForm(current => ({ ...current, [key]: value })); }
  async function saveEdit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/activities/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, durationHours: Number(form.durationHours), powerKW: Number(form.powerKW) }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to update this activity.");
      setAttempt(value => value + 1); setEditing(false); setMessage(body.message ?? "Activity updated. The latest requirements and offer are shown below.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to update this activity."); }
    finally { setBusy(false); }
  }
  async function lifecycle(action: "pause" | "resume" | "remove") {
    if (action === "remove" && !window.confirm("Remove this activity? Its saved history will be removed only when it has no accepted commitment or evidence.")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/activities/${encodeURIComponent(id)}/lifecycle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to update participation.");
      if (action === "remove") { router.push("/consumer/activities"); return; }
      setAttempt(value => value + 1); setMessage(body.message ?? (action === "pause" ? "Participation paused." : "Participation resumed."));
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to update participation."); }
    finally { setBusy(false); }
  }
  return <main className="app-shell">
    <section className="hero-panel activity-hero"><Link className="back-link detail-back" href="/consumer/activities"><ChevronLeft size={17} /> Activities</Link><div className="hero-copy"><p className="kicker">ACTIVITY DETAILS</p><h1 className="detail-title">{detail?.activity.name ?? "Your activity"}</h1><p className="hero-description">Your saved requirements, schedule and verification evidence.</p></div></section>
    <section className="content-section">
      {!detail && !error && <p role="status">Loading activity…</p>}
      {error && <div className="schedule-card"><p role="alert">{error}</p>{status === 401 ? <Link className="secondary-button" href="/login">Sign in</Link> : status !== 404 && <button className="secondary-button" onClick={() => { setResult({}); setAttempt(value => value + 1); }}>Try again</button>}</div>}
      {detail && <>
        <article className="schedule-card"><div className="section-heading"><div><span className="section-label">SAVED REQUIREMENTS</span><h2>What should we plan?</h2></div>{!editing && <div className="offer-actions"><button className="secondary-button" disabled={busy || ["accepted", "completed", "verified"].includes(detail.activity.status)} onClick={beginEdit}>Edit activity</button>{detail.activity.status === "paused" ? <button className="secondary-button" disabled={busy} onClick={() => lifecycle("resume")}>Resume participation</button> : <button className="secondary-button" disabled={busy || ["accepted", "completed", "verified"].includes(detail.activity.status)} onClick={() => lifecycle("pause")}>Pause participation</button>}<button className="text-button danger-action" disabled={busy || ["accepted", "completed", "verified"].includes(detail.activity.status)} onClick={() => lifecycle("remove")}>Remove</button></div>}</div>
          {!editing ? <><dl className="detail-grid"><div><dt>Activity type</dt><dd>{detail.activity.type}</dd></div><div><dt>Activity status</dt><dd>{detail.activity.status}</dd></div><div><dt>Earliest start</dt><dd>{detail.activity.earliest_start.slice(0, 5)}</dd></div><div><dt>Completion deadline</dt><dd>{detail.activity.latest_finish.slice(0, 5)}</dd></div><div><dt>Duration</dt><dd>{detail.activity.duration_minutes / 60} hours</dd></div><div><dt>Power limit</dt><dd>{detail.activity.power_kw ?? "Not set"}{detail.activity.power_kw ? " kW" : ""}</dd></div><div><dt>Required energy</dt><dd>{detail.activity.required_kwh ?? "Not set"}{detail.activity.required_kwh ? " kWh" : ""}</dd></div><div><dt>Can be interrupted</dt><dd>{detail.activity.interruptible ? "Yes" : "No — continuous operation"}</dd></div></dl><p>Times are shown in IST for the selected day.</p></> : <form className="activity-form" onSubmit={saveEdit}><label>Activity type<select value={form.type} onChange={e => update("type", e.target.value)}>{activityTypes.map(type => <option key={type}>{type}</option>)}<option>Custom</option></select></label><label>Activity name<input required maxLength={80} value={form.name} onChange={e => update("name", e.target.value)} /></label><div className="form-row"><label>Can start at<input required type="time" step="1800" value={form.earliestStart} onChange={e => update("earliestStart", e.target.value)} /></label><label>Need it by<input required type="time" step="1800" value={form.latestFinish} onChange={e => update("latestFinish", e.target.value)} /></label></div><div className="form-row"><label>Duration (hours)<input required type="number" min="0.5" max="12" step="0.5" value={form.durationHours} onChange={e => update("durationHours", e.target.value)} /></label><label>Power limit (kW)<input required type="number" min="0.1" max="500" step="0.1" value={form.powerKW} onChange={e => update("powerKW", e.target.value)} /></label></div><label className="toggle-row"><span><strong>Can pause if needed?</strong><small>Allows the scheduler to use more renewable-rich windows.</small></span><input type="checkbox" checked={form.interruptible} onChange={e => update("interruptible", e.target.checked)} /></label><div className="offer-actions"><button className="primary-button" disabled={busy}>{busy && <LoaderCircle size={16} className="spin" />}{busy ? "Saving…" : "Save changes"}</button><button type="button" className="secondary-button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button></div></form>}
          {detail.activity.status === "paused" && <p className="notice">Participation is paused. This activity will not receive new offers until you resume it.</p>}
          {message && <p className="form-message" role="status">{message}</p>}
        </article>
        {detail.offers.length === 0 && <article className="schedule-card"><h2>No linked offer yet</h2><p>Your activity is saved and ready for scheduling. No meter evidence, verification or rewards have been recorded for it.</p><p>This activity is ready for the next eligible programme event.</p></article>}
        {detail.offers.map(({ offer, readings, verification, rewards }) => <article className="schedule-card" key={offer.id}><span className="section-label">{offer.source === "simulation" ? "FLEXIBILITY EVENT" : "LINKED EVENT"}</span><h2>{offer.name}</h2><dl className="detail-grid"><div><dt>Offer decision</dt><dd>{offer.decision}</dd></div><div><dt>Schedule version</dt><dd>{offer.version}</dd></div><div><dt>Usual window</dt><dd>{slotTime(offer.baseline_start)}–{slotTime(offer.baseline_start + offer.duration_slots)}</dd></div><div><dt>{offer.decision === "accepted" ? "Accepted window" : "Proposed window"}</dt><dd>{slotTime(offer.proposed_start)}–{slotTime(offer.proposed_start + offer.duration_slots)}</dd></div><div><dt>Required energy</dt><dd>{offer.required_kwh} kWh</dd></div><div><dt>Power limit</dt><dd>{offer.power_kw} kW</dd></div><div><dt>Completion deadline</dt><dd>{slotTime(offer.deadline_slot)}</dd></div><div><dt>Recorded completion</dt><dd>{offer.completion_slot == null ? "Not recorded" : slotTime(offer.completion_slot)}</dd></div></dl><Link className="text-link" href={`/consumer/offers?offerId=${encodeURIComponent(offer.id)}`}>View this offer →</Link><h3>Verification</h3>{verification ? <><p><strong>{verification.status}</strong> · {verification.reason}</p><dl className="detail-grid"><div><dt>Recorded energy</dt><dd>{verification.recorded_kwh} kWh</dd></div><div><dt>Baseline energy estimate</dt><dd>{verification.baseline_kwh} kWh</dd></div><div><dt>Eligible shifted energy</dt><dd>{verification.eligible_kwh} kWh</dd></div></dl></> : <p>Not verified yet. Accepting an offer alone does not earn a reward.</p>}<h3>Reward record</h3>{rewards.length ? rewards.map(reward => <p key={reward.id}>{reward.points} points · ₹{Number(reward.illustrative_rupees).toFixed(2)} illustrative reward · {reward.state}</p>) : <p>No reward recorded for this activity.</p>}<p>Prototype rewards are illustrative; no real payment is made.</p><details className="evidence-readings"><summary>Meter readings ({readings.length}) · {offer.source === "simulation" ? "simulated" : offer.source}</summary>{readings.length ? <div className="evidence-scroll" tabIndex={0} role="region" aria-label="Meter readings"><table><caption>Cumulative energy readings for this offer</caption><thead><tr><th scope="col">Time (IST)</th><th scope="col">Energy (kWh)</th></tr></thead><tbody>{readings.map(reading => <tr key={reading.slot}><td>{slotTime(reading.slot)}</td><td>{Number(reading.cumulative_kwh).toFixed(2)}</td></tr>)}</tbody></table></div> : <p>No readings available.</p>}</details></article>)}
      </>}
    </section><ConsumerNav active="activities" />
  </main>;
}
