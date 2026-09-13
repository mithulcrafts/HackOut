"use client";

import { FileCheck2, ShieldAlert, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useResource } from "@/hooks/use-resource";
import { ConsumerFeedback } from "./consumer-feedback";
import { EvidenceTrace, type EvidenceTraceRow } from "./evidence-trace";
import type { ConsumerState } from "@/lib/consumer";
import { slotTime } from "@/lib/consumer";

type Assessment = {
  offerId: string; activityName: string; evidenceTier: string; dataSource: string; status: string; reason: string; readingCount: number;
  originalWindow: { startSlot: number; endSlot: number }; acceptedWindow: { startSlot: number; endSlot: number };
  recordedEnergyKWh: number; eligibleShiftedKWh: number; rewardEligible: false; issues: string[]; trustGaps: string[];
};

/**
 * The demo/API boundary can expose either the domain decision (`accept`) or
 * the presentation decision (`accepted`). Keep the evidence screen tolerant
 * of both representations so an accepted offer is always selectable.
 */
export function isAcceptedOfferDecision(decision: string) {
  return decision === "accept" || decision === "accepted";
}

export function EvidenceUpload() {
  const consumer = useResource<ConsumerState>("/api/consumer");
  const [offerId, setOfferId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [trace, setTrace] = useState<EvidenceTraceRow[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const acceptedOffers = useMemo(() => (consumer.data?.availableOffers ?? []).filter((offer) => isAcceptedOfferDecision(offer.decision)), [consumer.data]);
  const reviewAlreadyRequested = Boolean(consumer.data?.reviewRequest && consumer.data.reviewRequest.offer_id === offerId);
  useEffect(() => {
    const queryOfferId = new URLSearchParams(window.location.search).get("offerId");
    if (queryOfferId) queueMicrotask(() => setOfferId(queryOfferId));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!offerId || !file) { setMessage("Choose an accepted offer and attach its CSV export."); return; }
    setBusy(true); setMessage(""); setAssessment(null);
    const form = new FormData(); form.set("offerId", offerId); form.set("evidence", file);
    try {
      const response = await fetch("/api/evidence/assess", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to assess this evidence.");
      setAssessment(body.assessment);
      const lines = (await file.text()).replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
      setTrace(lines.slice(1).map((line) => { const [timestamp, cumulative] = line.split(","); return { time: timestamp?.replace("T", " ").replace("+05:30", " IST") ?? "", cumulative: Number(cumulative) }; }).filter((row) => Number.isFinite(row.cumulative)));
      setMessage(body.message || "Assessment complete.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to assess this evidence."); }
    finally { setBusy(false); }
  }

  async function checkConnection() {
    if (!offerId) { setConnectionMessage("Choose an accepted offer first."); return; }
    setConnectionMessage("Checking available evidence sources…");
    try {
      const response = await fetch(`/api/consumer?offerId=${encodeURIComponent(offerId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("The participant session could not be reached.");
      setConnectionMessage("No approved meter or charger is attached in this prototype. You can upload an interval export or request operator review.");
    } catch (error) { setConnectionMessage(error instanceof Error ? error.message : "Unable to check the connection."); }
  }

  async function requestReview() {
    if (!offerId) { setReviewMessage("Choose an accepted offer first."); return; }
    setReviewBusy(true); setReviewMessage("");
    try {
      const response = await fetch("/api/evidence/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ offerId, note: assessment?.reason ?? "Participant requested evidence review." }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to send the review request.");
      setReviewMessage(body.message || "Request sent to the operator queue.");
    } catch (error) { setReviewMessage(error instanceof Error ? error.message : "Unable to send the review request."); }
    finally { setReviewBusy(false); }
  }

  return <>
    <ConsumerFeedback loading={consumer.loading} error={consumer.error} retry={consumer.refresh} />
    <article className="schedule-card evidence-upload-card">
      <div className="section-heading"><div><span className="section-label">OPTIONAL REVIEW</span><h2>Upload a meter or charger export</h2></div><UploadCloud size={22} color="var(--amber)" /></div>
      <p>Have no hardware connected? Upload a daily interval CSV from a smart meter or charger to see whether it proves the accepted shift. The upload is treated as untrusted evidence and cannot issue a reward.</p>
      {!acceptedOffers.length ? <div className="notice"><p>Accept an offer first. Evidence is only meaningful against a frozen, accepted window.</p></div> : <form className="activity-form" onSubmit={submit}>
        <label>Accepted activity<select required value={offerId} onChange={(event) => setOfferId(event.target.value)}><option value="">Choose an activity</option>{acceptedOffers.map((offer) => <option key={offer.id} value={offer.id}>{offer.name}</option>)}</select></label>
        <label>CSV interval export<input required type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        <small className="muted">Required columns: <code>timestamp,cumulative_kwh,device_id,service_complete</code>. Use one daily Asia/Kolkata trace with +05:30 timestamps. Maximum 100 KB / 200 rows.</small>
        <button className="primary-button" disabled={busy}>{busy ? "Assessing…" : "Assess evidence"} <FileCheck2 size={16} /></button>
      </form>}
      {acceptedOffers.length > 0 && <div className="offer-actions" style={{ marginTop: 12 }}><button type="button" className="secondary-button" disabled={busy || reviewBusy} onClick={checkConnection}>Check connection</button><button type="button" className="secondary-button" disabled={busy || reviewBusy || reviewAlreadyRequested} onClick={requestReview}>{reviewAlreadyRequested ? "Review requested" : "Request review"}</button></div>}
      {connectionMessage && <p className="muted" role="status">{connectionMessage}</p>}
      {reviewMessage && <p className="form-message" role="status">{reviewMessage}</p>}
      {reviewAlreadyRequested && <p className="muted" role="status">An operator review request is already open for this offer. It does not release a reward by itself.</p>}
      {message && <p className="form-message" role="status">{message}</p>}
    </article>
    {assessment && <article className="schedule-card evidence-report" aria-live="polite">
      <div className="section-heading"><div><span className="section-label">REVIEW RESULT · {assessment.dataSource}</span><h2>{assessment.activityName}</h2></div><ShieldAlert size={21} color="var(--amber)" /></div>
      <div className="status-pill absorb">{assessment.status.replaceAll("_", " ")}</div>
      <p className="notice">{assessment.reason}</p>
      <dl className="detail-grid"><div><dt>Original routine</dt><dd>{slotTime(assessment.originalWindow.startSlot)}–{slotTime(assessment.originalWindow.endSlot)} IST</dd></div><div><dt>Accepted window</dt><dd>{slotTime(assessment.acceptedWindow.startSlot)}–{slotTime(assessment.acceptedWindow.endSlot)} IST</dd></div><div><dt>Readings reviewed</dt><dd>{assessment.readingCount}</dd></div><div><dt>Recorded energy</dt><dd>{assessment.recordedEnergyKWh.toFixed(2)} kWh</dd></div><div><dt>Eligible shift found</dt><dd>{assessment.eligibleShiftedKWh.toFixed(2)} kWh</dd></div><div><dt>Reward settlement</dt><dd>Blocked pending trusted source</dd></div></dl>
      {assessment.issues.length > 0 && <div className="notice error-notice"><strong>Why it needs attention</strong>{assessment.issues.map((issue) => <p key={issue}>{issue}</p>)}</div>}
      {assessment.status !== "verified" && <p className="muted">To retry, choose a corrected interval export above and assess it again. Uploads remain untrusted review evidence and cannot release a reward. Use Request review if the readings are missing or disputed.</p>}
      <details className="evidence-readings"><summary>Evidence limits and next step</summary><ul>{assessment.trustGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></details>
      <EvidenceTrace rows={trace} />
    </article>}
  </>;
}
