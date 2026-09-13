"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Activity, BalanceResult, ForecastSlot, VerificationResult } from "@/domain/types";
import { OperatorNav } from "./operator-nav";

type PlaybackOutcome = "success" | "partial" | "late" | "missing" | "rebound";
const outcomes: { value: PlaybackOutcome; label: string }[] = [
  { value: "success", label: "Successful completion" },
  { value: "partial", label: "Partial completion" },
  { value: "late", label: "After the deadline" },
  { value: "missing", label: "Missing readings" },
  { value: "rebound", label: "Added consumption / rebound" },
];

type Preview = { forecast: ForecastSlot[]; balances: BalanceResult[]; metadata?: { requestedSource: string; weatherDate: string | null; location: string | null; fallback: boolean; message: string }; data_source?: string };

export function SimulationConsole({ activities, forecast }: { activities: Activity[]; forecast: ForecastSlot[] }) {
  const router = useRouter();
  const [renewable, setRenewable] = useState(1);
  const [demand, setDemand] = useState(1);
  const [source, setSource] = useState<"simulation" | "weather">("simulation");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedOutcomes, setSelectedOutcomes] = useState<Record<string, PlaybackOutcome>>({});
  const [verification, setVerification] = useState<(VerificationResult & { eligibleShiftedKWh: number }) | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function runPreview() {
    setBusy(true); setMessage(""); setIsError(false);
    try {
      const response = await fetch("/api/scenarios/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source, renewableMultiplier: renewable, demandMultiplier: demand }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Preview failed.");
      setPreview(data); setMessage(data.metadata?.message ?? "Preview calculated. The accepted schedules and baseline were not changed.");
    } catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : "Connection failed. Try the preview again."); }
    finally { setBusy(false); }
  }

  async function reset() {
    setBusy(true); setMessage(""); setIsError(false);
    try {
      const response = await fetch("/api/scenarios/reset", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Reset failed.");
      setPreview(null); setVerification(null); setMessage("Scenario reset. Accept an offer again to try a new outcome."); router.refresh();
    } catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : "Connection failed. The scenario was not reset."); }
    finally { setBusy(false); }
  }

  async function playback(activityId: string) {
    setBusy(true); setMessage(""); setIsError(false); setVerification(null);
    try {
      const response = await fetch("/api/scenarios/playback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ activityId, outcome: selectedOutcomes[activityId] ?? "success" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Playback failed.");
      setVerification(data.verification); setMessage(data.message); router.refresh();
    } catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : "Connection failed. No result has been assumed."); }
    finally { setBusy(false); }
  }

  const visibleForecast = preview?.forecast ?? forecast;
  const visibleBalances = preview?.balances;
  return <main className="shell">
    <header className="topbar"><div className="container topbar-inner"><Link href="/" className="brand"><span className="brand-mark">VS</span>VidyutSutra</Link><OperatorNav active="/operator/simulation" /></div></header>
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="eyebrow">Simulation controls</div><h1>Replay the demand-response day.</h1>
      <p className="muted">Adjust supply or demand in an in-memory scenario, then test an accepted activity with simulated meter evidence. No device or grid command is sent.</p>
      {(busy || message) && <p role={isError ? "alert" : "status"} aria-live="polite" className="muted">{busy ? "Updating the simulated scenario…" : message}</p>}
      <div className="grid two-col">
        <section className="card"><h2>What-if preview</h2>
          <label className="label" htmlFor="source">Forecast source</label>
          <select id="source" value={source} onChange={event => setSource(event.target.value as "simulation" | "weather")} disabled={busy} style={{ width: "100%", margin: "8px 0 16px" }}><option value="simulation">Synthetic simulation</option><option value="weather">Open-Meteo weather estimate</option></select>
          <label className="label" htmlFor="renewable">Renewable multiplier · {renewable.toFixed(1)}×</label><input id="renewable" type="range" min="0" max="2" step="0.1" value={renewable} onChange={(event) => setRenewable(Number(event.target.value))} disabled={busy} style={{ width: "100%", accentColor: "var(--amber)", margin: "12px 0 20px" }} />
          <label className="label" htmlFor="demand">Demand multiplier · {demand.toFixed(1)}×</label><input id="demand" type="range" min="0.5" max="1.8" step="0.1" value={demand} onChange={(event) => setDemand(Number(event.target.value))} disabled={busy} style={{ width: "100%", accentColor: "var(--blue)", margin: "12px 0 20px" }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button className="status min-h-11" onClick={runPreview} disabled={busy}>Calculate preview</button><button className="source min-h-11" onClick={reset} disabled={busy}>Reset scenario</button></div>
          {preview?.metadata && <p className="muted" style={{ fontSize: ".8rem" }}>{preview.metadata.location ? `Weather estimate for ${preview.metadata.location} · ${preview.metadata.weatherDate}` : "Synthetic simulation"}{preview.metadata.fallback ? " · fallback to simulation" : ""}</p>}
          <div className="chart-wrap" style={{ marginTop: 16 }}><div className="chart" style={{ minWidth: 480, height: 170 }} aria-label="Simulated renewable and fixed demand by half-hour slot in kW">{visibleForecast.map((slot) => <div className="bar-group" key={slot.index}><div className="bar renewable" style={{ height: `${Math.min(100, slot.renewableKW * 7)}%` }} title={`${slot.start}: renewable ${slot.renewableKW.toFixed(2)} kW`} /><div className="bar demand" style={{ height: `${Math.min(100, slot.fixedDemandKW * 7)}%` }} title={`${slot.start}: fixed demand ${slot.fixedDemandKW.toFixed(2)} kW`} /></div>)}</div></div>
          <p className="muted" style={{ fontSize: ".8rem" }}>Renewable supply and fixed demand · slot-average kW · 00:00–24:00 IST · {preview?.data_source ?? "simulation"}</p>
          <p className="muted" style={{ fontSize: ".8rem" }}>{visibleBalances ? `${visibleBalances.filter((item) => item.mode === "absorb").length} Absorb slots · ${visibleBalances.filter((item) => item.mode === "protect").length} Protect slots` : "Seeded forecast · 48 half-hour slots"}</p>
        </section>
        <section className="card"><h2>Playback and verification</h2><p className="muted">Only an accepted activity can run. Playback generates simulated meter readings and checks the accepted window, original baseline, energy requirement and deadline.</p>
          {!activities.some((activity) => activity.status === "accepted") && <p className="muted">No accepted activity is ready. <Link href="/consumer/offers" className="text-link">Open consumer offers</Link> to accept one, or reset the scenario to try a different outcome.</p>}
          <div className="grid" style={{ gap: 10 }}>{activities.map((activity) => <div key={activity.id} style={{ background: "var(--surface-2)", borderRadius: 10, padding: 12 }}><strong>{activity.name}</strong><div className="muted" style={{ fontSize: ".8rem", margin: "4px 0 10px" }}>{activity.requiredEnergyKWh} kWh · {activity.durationSlots * 30} minutes · {activity.status}</div><label className="label" htmlFor={`outcome-${activity.id}`}>Outcome</label><select id={`outcome-${activity.id}`} value={selectedOutcomes[activity.id] ?? "success"} onChange={(event) => setSelectedOutcomes((current) => ({ ...current, [activity.id]: event.target.value as PlaybackOutcome }))} disabled={busy || activity.status !== "accepted"} style={{ width: "100%", minHeight: 44, margin: "8px 0", padding: 8, color: "var(--text)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }}>{outcomes.map((outcome) => <option key={outcome.value} value={outcome.value}>{outcome.label}</option>)}</select><button className="source min-h-11" onClick={() => playback(activity.id)} disabled={busy || activity.status !== "accepted"}>Replay and verify</button>{activity.status !== "accepted" && <p className="muted" style={{ fontSize: ".8rem", marginBottom: 0 }}>{activity.status === "verified" || activity.status === "failed" ? "This scenario is complete. Reset to test a different outcome." : "Waiting for the consumer to accept a schedule."}</p>}</div>)}</div>
          {verification && <div className="card" style={{ marginTop: 16 }}><div className="eyebrow">Simulated verification · {verification.outcome}</div><p>{verification.reason}</p><p className="muted">Required: {verification.requiredEnergyKWh} kWh · Recorded: {verification.recordedEnergyKWh} kWh · Eligible shift: {verification.eligibleShiftedKWh}</p><Link className="text-link" href="/operator/overview">View updated operator response →</Link></div>}
        </section>
      </div>
      <p className="footer">Missing readings remain pending. Incomplete, late or added consumption does not count as a verified response. Reset restores the demonstration; it does not operate real equipment or transfer money.</p>
    </div>
  </main>;
}
