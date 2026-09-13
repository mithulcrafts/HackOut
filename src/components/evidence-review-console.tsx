"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Activity, VerificationResult } from "@/domain/types";

export function EvidenceReviewConsole({ activities }: { activities: Activity[] }) {
  const router = useRouter();
  const [verification, setVerification] = useState<(VerificationResult & { eligibleShiftedKWh: number }) | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function verify(activityId: string) {
    setBusy(true); setMessage(""); setIsError(false); setVerification(null);
    try {
      const response = await fetch("/api/scenarios/playback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activityId, outcome: "success" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The reading could not be verified.");
      setVerification(data.verification);
      setMessage("Reading reviewed. The operator view has been updated.");
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "The reading could not be verified.");
    } finally { setBusy(false); }
  }

  const accepted = activities.filter((activity) => activity.status === "accepted");
  return <main className="shell">
    <header className="topbar"><div className="container topbar-inner"><Link href="/" className="brand"><span className="brand-mark">VS</span>VidyutSutra</Link><Link className="muted" href="/operator/overview">← Overview</Link></div></header>
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="eyebrow">Evidence review</div><h1>Verify delivered flexibility.</h1>
      <p className="muted">Review the recorded reading for each accepted activity before its reward is released. No charger, meter or grid equipment is controlled from this screen.</p>
      {(busy || message) && <p role={isError ? "alert" : "status"} aria-live="polite" className="muted">{busy ? "Reviewing the reading…" : message}</p>}
      <section className="card"><h2>Accepted activities</h2>
        {accepted.length === 0 && <p className="muted">No accepted activity is waiting for evidence. <Link href="/consumer/offers" className="text-link">Open consumer offers</Link> to review a schedule.</p>}
        <div className="grid" style={{ gap: 10 }}>{activities.map((activity) => <article key={activity.id} style={{ background: "var(--surface-2)", borderRadius: 10, padding: 12 }}><strong>{activity.name}</strong><div className="muted" style={{ fontSize: ".8rem", margin: "4px 0 10px" }}>{activity.requiredEnergyKWh} kWh · {activity.durationSlots * 30} minutes · {activity.status}</div>{activity.status === "accepted" ? <button className="source min-h-11" onClick={() => verify(activity.id)} disabled={busy}>Review and verify reading</button> : <p className="muted" style={{ fontSize: ".8rem", marginBottom: 0 }}>{activity.status === "verified" ? "Evidence already verified." : "Waiting for the consumer to accept a schedule."}</p>}</article>)}</div>
      </section>
      {verification && <section className="card" style={{ marginTop: 16 }}><div className="eyebrow">Verification result</div><h2>{verification.outcome.toUpperCase()}</h2><p>{verification.reason}</p><p className="muted">Required: {verification.requiredEnergyKWh} kWh · Recorded: {verification.recordedEnergyKWh} kWh · Eligible shift: {verification.eligibleShiftedKWh} kWh</p><Link className="text-link" href="/operator/overview">View updated operator response →</Link></section>}
      <p className="footer">Renewable availability and readings are labelled estimates until an approved weather, charger or meter provider is connected. Rewards remain subject to the programme terms.</p>
    </div>
  </main>;
}

