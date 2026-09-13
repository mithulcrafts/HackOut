import Link from "next/link";
import type { Offer, Scenario } from "@/domain/types";
import { eventReport } from "@/domain/events";
import { summarizeScenario } from "@/domain/summary";
import { OperatorNav } from "./operator-nav";

function slotTime(slot: number) {
  const hour = Math.floor(slot / 2);
  return `${String(hour).padStart(2, "0")}:${slot % 2 ? "30" : "00"}`;
}

function activityName(scenario: Scenario, offer: Pick<Offer, "activityId">) {
  return scenario.activities.find((activity) => activity.id === offer.activityId)?.name ?? "Flexible activity";
}

function resultFor(scenario: Scenario, offer: Offer) {
  return scenario.results?.[offer.id] ?? scenario.results?.[offer.activityId];
}

function outcomeLabel(outcome: string | null | undefined) {
  if (!outcome) return "Awaiting evidence";
  return outcome.replaceAll("_", " ");
}

function statusClass(value: string | null | undefined) {
  return value === "verified" ? "status verified" : value === "failed" || value === "partial" || value === "needs_review" ? "status protect" : "status";
}

function PageFrame({ active, eyebrow, title, children }: { active: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return <main className="shell"><div className="container" style={{ paddingTop: 40 }}><OperatorNav active={active} /><div className="eyebrow" style={{ marginTop: 30 }}>{eyebrow}</div><h1>{title}</h1>{children}</div></main>;
}

export function OperatorSection({ scenario, section }: { scenario: Scenario; section: "flexibility" | "verification" | "rewards" | "reports" | "settings" }) {
  const summary = summarizeScenario(scenario);
  const offers = scenario.offers;
  const acceptedOffers = offers.filter((offer) => offer.decision === "accept");
  const results = Object.values(scenario.results ?? {});
  const verified = results.filter((result) => result.outcome === "verified");
  const pendingEvidence = acceptedOffers.filter((offer) => {
    const outcome = resultFor(scenario, offer)?.outcome;
    return !outcome || outcome === "pending" || outcome === "needs_review";
  }).length;
  const openReviewRequests = (scenario.evidenceReviewRequests ?? []).filter((request) => request.status === "open");
  const activeEvents = scenario.events.filter((event) => event.status === "active" || event.status === "verifying");
  const totalTargetKW = activeEvents.reduce((sum, event) => sum + event.requestedFlexibilityKW, 0);
  const unresolvedTargetKW = activeEvents.reduce((sum, event) => sum + eventReport(scenario, event.id).unresolvedGapKW, 0);
  const ledger = scenario.rewardLedger ?? [];
  const settledValue = ledger.reduce((sum, entry) => sum + entry.illustrativeRupees, 0);
  const pendingValue = acceptedOffers.filter((offer) => {
    const outcome = resultFor(scenario, offer)?.outcome;
    return !outcome || outcome === "pending" || outcome === "needs_review";
  }).reduce((sum, offer) => sum + offer.rewardEstimate, 0);
  const budgetTotal = scenario.events.reduce((sum, event) => sum + event.budget, 0);
  const budgetRemaining = Math.max(0, budgetTotal - settledValue);

  if (section === "settings") {
    return <PageFrame active="/operator/settings" eyebrow="Site settings · scenario configuration" title="Operating limits that stay visible."><div className="grid metric-grid"><div className="card"><div className="label">Site power limit</div><div className="metric">{scenario.sitePowerLimitKW} kW</div></div><div className="card"><div className="label">Battery capacity</div><div className="metric">{scenario.battery.capacityKWh} kWh</div></div><div className="card"><div className="label">Charge / discharge</div><div className="metric">{scenario.battery.maxChargeKW} / {scenario.battery.maxDischargeKW} kW</div></div><div className="card"><div className="label">Timezone</div><div className="metric" style={{ fontSize: "1.1rem" }}>{scenario.timezone}</div></div></div><p className="footer">Use the editable settings panel to change these scenario limits. Production changes require authorised operator settings.</p></PageFrame>;
  }

  if (section === "flexibility") {
    return <PageFrame active="/operator/flexibility" eyebrow="Flexibility · scheduled programme" title="Accepted capacity you can defend."><div className="grid metric-grid"><div className="card"><div className="label">Requested peak target</div><div className="metric amber">{totalTargetKW.toFixed(1)} kW</div><div className="muted">sum of active event caps</div></div><div className="card"><div className="label">Peak accepted capacity</div><div className="metric blue">{summary.acceptedKW.toFixed(1)} kW</div><div className="muted">maximum concurrent consented load</div></div><div className="card"><div className="label">Peak verified response</div><div className="metric violet">{summary.verifiedKW.toFixed(1)} kW</div><div className="muted">maximum concurrent evidence-backed response</div></div><div className="card"><div className="label">Unresolved target</div><div className="metric protect">{unresolvedTargetKW.toFixed(1)} kW</div><div className="muted">requires another safe action</div></div></div><section className="card" style={{ marginTop: 16 }}><div className="section-heading"><div><div className="label">Participant commitments</div><h2>Who can deliver, and what is still open?</h2></div><Link className="text-link" href="/operator/events">Manage events →</Link></div>{offers.length === 0 ? <p className="notice">No offers have been generated. Publish an event to find eligible flexible activities.</p> : <div style={{ overflowX: "auto" }}><table className="table"><thead><tr><th>Activity</th><th>Decision</th><th>Window</th><th>Power</th><th>Evidence</th></tr></thead><tbody>{offers.map((offer) => { const activity = scenario.activities.find((item) => item.id === offer.activityId); const result = resultFor(scenario, offer); return <tr key={offer.id}><td><strong>{activityName(scenario, offer)}</strong><br /><span className="muted">{activity?.type ?? "custom"}</span></td><td><span className={statusClass(offer.decision === "accept" ? "accepted" : offer.decision)}>{offer.decision}</span></td><td>{slotTime(offer.proposedStart)}–{slotTime(offer.proposedEnd)} IST</td><td>{activity ? (activity.requiredEnergyKWh / (activity.durationSlots * 0.5)).toFixed(1) : "0.0"} kW</td><td>{outcomeLabel(result?.outcome)}</td></tr>; })}</tbody></table></div>}</section>{scenario.recovery?.length ? <section className="card" style={{ marginTop: 16 }}><div className="label">Recovery queue</div><h2>Released commitments need a safe replacement.</h2>{scenario.recovery.slice(-3).reverse().map((item) => <p key={item.id}><strong>{item.lostPowerKW.toFixed(1)} kW released</strong> from {activityName(scenario, { activityId: item.lostActivityId })} · {item.unresolvedGapKW.toFixed(1)} kW remains open · {item.replacementOfferIds.length} voluntary replacement option{item.replacementOfferIds.length === 1 ? "" : "s"} · battery support {item.batterySupportKW.toFixed(1)} kW.</p>)}</section> : null}<p className="footer">Peak accepted capacity is the maximum concurrent commitment; peak verified response is calculated only from evidence. Values are labelled scenario records.</p></PageFrame>;
  }

  if (section === "verification") {
    return <PageFrame active="/operator/verification" eyebrow="Verification · evidence queue" title="Evidence before reward."><div className="grid metric-grid"><div className="card"><div className="label">Accepted activities</div><div className="metric blue">{acceptedOffers.length}</div></div><div className="card"><div className="label">Readings received</div><div className="metric amber">{scenario.readings.length}</div></div><div className="card"><div className="label">Verified</div><div className="metric violet">{verified.length}</div></div><div className="card"><div className="label">Needs evidence</div><div className="metric protect">{pendingEvidence}</div></div><div className="card"><div className="label">Participant requests</div><div className="metric protect">{openReviewRequests.length}</div></div></div><section className="card" style={{ marginTop: 16 }}><div className="section-heading"><div><div className="label">Review queue</div><h2>Every accepted activity has a trace</h2></div><Link className="text-link" href="/operator/simulation">Open playback →</Link></div>{acceptedOffers.length === 0 ? <p className="notice">No accepted activities are waiting for verification. A consumer must accept an offer first.</p> : <div style={{ overflowX: "auto" }}><table className="table"><thead><tr><th>Activity</th><th>Accepted window</th><th>Readings</th><th>Result</th><th>Energy / reason</th></tr></thead><tbody>{acceptedOffers.map((offer) => { const result = resultFor(scenario, offer); const readings = scenario.readings.filter((reading) => reading.activityId === offer.activityId && reading.eventId === offer.eventId); return <tr key={offer.id}><td><strong>{activityName(scenario, offer)}</strong><br /><span className="muted">{offer.data_source}</span></td><td>{slotTime(offer.proposedStart)}–{slotTime(offer.proposedEnd)} IST<br /><span className="muted">deadline {slotTime(offer.deadline)}</span></td><td>{readings.length}</td><td><span className={statusClass(result?.outcome)}>{outcomeLabel(result?.outcome)}</span></td><td>{result ? `${result.recordedEnergyKWh.toFixed(2)} kWh recorded · ${result.eligibleShiftedKWh.toFixed(2)} kWh eligible` : "No trusted result yet"}<br /><span className="muted">{result?.reason ?? "Use playback or wait for an approved reading."}</span></td></tr>; })}</tbody></table></div>}</section>{openReviewRequests.length > 0 && <section className="card" style={{ marginTop: 16 }}><div className="label">Participant support</div><h2>Requests waiting for an operator</h2><ul>{openReviewRequests.slice(-10).reverse().map((request) => <li key={request.id}><strong>{activityName(scenario, { activityId: request.activityId })}</strong> · {request.note} <span className="muted">({request.data_source})</span></li>)}</ul><p className="muted">Acknowledging a request still requires an approved evidence source before settlement.</p></section>}<p className="footer">A button click is not evidence. Simulation readings are clearly labelled and cannot be treated as a real meter settlement.</p></PageFrame>;
  }

  if (section === "rewards") {
    return <PageFrame active="/operator/rewards" eyebrow="Rewards · programme ledger" title="Release value only after evidence."><div className="grid metric-grid"><div className="card"><div className="label">Programme budget</div><div className="metric">₹{budgetTotal.toFixed(2)}</div></div><div className="card"><div className="label">Pending commitments</div><div className="metric amber">₹{pendingValue.toFixed(2)}</div></div><div className="card"><div className="label">Verified ledger</div><div className="metric violet">₹{settledValue.toFixed(2)}</div></div><div className="card"><div className="label">Remaining</div><div className="metric green">₹{budgetRemaining.toFixed(2)}</div></div></div><section className="card" style={{ marginTop: 16 }}><div className="section-heading"><div><div className="label">Settlement preview</div><h2>Transparent reward ledger</h2></div><span className="source">Illustrative · no payment rail</span></div>{ledger.length === 0 && pendingValue === 0 ? <p className="notice">No accepted or verified rewards yet. Values will appear after a participant accepts an offer.</p> : <div style={{ overflowX: "auto" }}><table className="table"><thead><tr><th>Activity</th><th>Status</th><th>Amount</th><th>Points</th><th>Next step</th></tr></thead><tbody>{acceptedOffers.map((offer) => { const entry = ledger.find((item) => item.offerId === offer.id); const result = resultFor(scenario, offer); return <tr key={offer.id}><td>{activityName(scenario, offer)}</td><td>{entry?.state ?? (result?.outcome === "pending" || !result ? "pending verification" : outcomeLabel(result.outcome))}</td><td>₹{(entry?.illustrativeRupees ?? offer.rewardEstimate).toFixed(2)}</td><td>{entry?.points ?? Math.floor(offer.rewardEstimate * 15)}</td><td>{entry ? "Recorded in ledger" : "Verify before release"}</td></tr>; })}</tbody></table></div>}<p className="muted" style={{ marginTop: 12 }}>Rewards are capped by event budget and eligible shifted energy. A real programme would add tariff approval, settlement and payment controls.</p></section></PageFrame>;
  }

  return <PageFrame active="/operator/reports" eyebrow="Reports · event funnel" title="From recommendation to verified response.">{scenario.events.length === 0 ? <p className="notice">No events are available for reporting.</p> : scenario.events.map((event) => {
    const report = eventReport(scenario, event.id);
    return <section className="card" key={event.id} style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div><h2>{event.name}</h2><p className="muted">{event.objective === "absorb" ? "Renewable surplus absorption" : "Peak support"} · {event.status} · {slotTime(event.windowStart)}–{slotTime(event.windowEnd)} IST</p></div>
        <span className="source">Scenario records</span>
      </div>
      <div className="grid metric-grid" style={{ marginTop: 16 }}>
        <div><div className="label">Recommended</div><div className="metric amber">{report.funnel.recommended}</div></div>
        <div><div className="label">Accepted</div><div className="metric blue">{report.funnel.accepted}</div></div>
        <div><div className="label">Completed</div><div className="metric">{report.funnel.completed}</div></div>
        <div><div className="label">Verified</div><div className="metric violet">{report.funnel.verified}</div></div>
        <div><div className="label">Requested</div><div className="metric amber">{report.requestedKW.toFixed(1)} kW</div></div>
        <div><div className="label">Peak accepted capacity</div><div className="metric blue">{report.acceptedKW.toFixed(1)} kW</div></div>
        <div><div className="label">Peak verified response</div><div className="metric violet">{report.verifiedKW.toFixed(1)} kW</div></div>
        <div><div className="label">Energy shifted</div><div className="metric violet">{report.shiftedKWh.toFixed(1)} kWh</div></div>
        <div><div className="label">Renewable-aligned</div><div className="metric green">{report.renewableAlignedConsumptionKWh.toFixed(1)} kWh</div></div>
        <div><div className="label">Peak reduction</div><div className="metric green">{report.peakReductionKW.toFixed(1)} kW · {report.peakReductionPercent.toFixed(1)}%</div></div>
        <div><div className="label">Participants</div><div className="metric">{report.participantCount}</div></div>
        <div><div className="label">Acceptance rate</div><div className="metric">{report.acceptanceRate.toFixed(1)}%</div></div>
        <div><div className="label">Settled reward</div><div className="metric violet">₹{report.rewardCost.toFixed(2)}</div></div>
        <div><div className="label">Pending reward</div><div className="metric amber">₹{report.pendingRewardCost.toFixed(2)}</div></div>
        <div><div className="label">Pending readings</div><div className="metric protect">{report.pendingReadings}</div></div>
        <div><div className="label">Unresolved target</div><div className="metric protect">{report.unresolvedGapKW.toFixed(1)} kW</div></div>
      </div>
      <p className="muted" style={{ fontSize: ".78rem" }}>{report.failed} failed or partial · {report.disputedActivities} disputed/needs review. Renewable-aligned consumption means verified eligible shift; it does not claim exclusive renewable electrons.</p>
      <a className="text-link" href={`/api/events/${event.id}/report?format=csv`}>Download CSV report →</a>
    </section>;
  })}<p className="footer">Reports use the same event records as the operator overview. Values remain labelled until approved utility data is connected.</p></PageFrame>;
}

