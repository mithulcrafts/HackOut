"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Activity, BalanceResult, BatteryDispatch, ForecastSlot, VerificationResult } from "@/domain/types";
import { OperatorNav } from "./operator-nav";

type PlaybackOutcome = "success" | "partial" | "late" | "missing" | "rebound";
const outcomes: { value: PlaybackOutcome; label: string }[] = [
  { value: "success", label: "Successful completion" },
  { value: "partial", label: "Partial completion" },
  { value: "late", label: "After the deadline" },
  { value: "missing", label: "Missing readings" },
  { value: "rebound", label: "Added consumption / rebound" },
];

type PreviewRecommendation = { title: string; score: number; rationale: string; feasibility: string; impact: { powerKW: number; energyKWh: number }; mode: string };
type Preview = {
  forecast: ForecastSlot[];
  balances: BalanceResult[];
  battery?: BatteryDispatch[];
  recommendations?: PreviewRecommendation[];
  metadata?: { requestedSource: string; weatherDate: string | null; location: string | null; fallback: boolean; message: string };
  data_source?: string;
};

const slotLabel = (index: number) => `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`;

export function SimulationConsole({ activities, forecast, initialReadingCounts = {} }: { activities: Activity[]; forecast: ForecastSlot[]; initialReadingCounts?: Record<string, number> }) {
  const router = useRouter();
  const [renewable, setRenewable] = useState(1);
  const [demand, setDemand] = useState(1);
  const [source, setSource] = useState<"simulation" | "weather" | "models">("simulation");
  const [panelCapacityKW, setPanelCapacityKW] = useState(10);
  const [turbineCapacityKW, setTurbineCapacityKW] = useState(3);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedOutcomes, setSelectedOutcomes] = useState<Record<string, PlaybackOutcome>>({});
  const [readingCounts, setReadingCounts] = useState<Record<string, number>>(initialReadingCounts);
  const [verification, setVerification] = useState<(VerificationResult & { eligibleShiftedKWh: number }) | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function runPreview() {
    setBusy(true); setMessage(""); setIsError(false);
    try {
      const response = await fetch("/api/scenarios/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source, renewableMultiplier: renewable, demandMultiplier: demand, panelCapacityKW, turbineCapacityKW }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Preview failed.");
      setPreview(data); setMessage(data.metadata?.message ?? "Preview calculated. Accepted schedules and baseline were not changed.");
    } catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : "Connection failed. Try the preview again."); }
    finally { setBusy(false); }
  }

  async function reset() {
    setBusy(true); setMessage(""); setIsError(false);
    try {
      const response = await fetch("/api/scenarios/reset", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Reset failed.");
      setPreview(null); setVerification(null); setReadingCounts({}); setMessage("Scenario reset. Accept an offer again to try a new outcome."); router.refresh();
    } catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : "Connection failed. The scenario was not reset."); }
    finally { setBusy(false); }
  }

  async function playback(activityId: string, action: "full" | "advance" = "full") {
    setBusy(true); setMessage(""); setIsError(false); setVerification(null);
    try {
      const response = await fetch("/api/scenarios/playback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ activityId, outcome: selectedOutcomes[activityId] ?? "success", action }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Playback failed.");
      setReadingCounts((current) => ({ ...current, [activityId]: Number(data.readingCount ?? current[activityId] ?? 0) }));
      setVerification(data.verification); setMessage(action === "advance" && data.verification?.outcome === "pending" ? `${data.message} ${data.readingCount ?? 0} interval${data.readingCount === 1 ? "" : "s"} recorded; advance again to continue.` : data.message); router.refresh();
    } catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : "Connection failed. No result has been assumed."); }
    finally { setBusy(false); }
  }

  const visibleForecast = preview?.forecast ?? forecast;
  const visibleBalances = preview?.balances;
  const chartData = visibleForecast.map((slot) => ({ time: slotLabel(slot.index), renewable: Number(slot.renewableKW.toFixed(2)), demand: Number(slot.fixedDemandKW.toFixed(2)) }));

  return <main className="shell"><header className="topbar"><div className="container topbar-inner"><Link href="/" className="brand"><span className="brand-mark">VS</span>VidyutSutra</Link><OperatorNav active="/operator/simulation" /></div></header><div className="container" style={{ paddingTop: 40 }}>
    <div className="eyebrow">Scenario controls · labelled estimates</div><h1>Replay the demand-response day.</h1><p className="muted">Explore a weather-aware operating view, then test an accepted activity with clearly labelled simulated readings. No device, protection system or grid command is sent.</p>
    {(busy || message) && <p role={isError ? "alert" : "status"} aria-live="polite" className={isError ? "notice error-notice" : "muted"}>{busy ? "Updating the scenario…" : message}</p>}
    <div className="grid two-col">
      <section className="card"><h2>What-if operating view</h2><label className="label" htmlFor="source">Renewable estimate source</label><select id="source" value={source} onChange={(event) => setSource(event.target.value as "simulation" | "weather" | "models")} disabled={busy} style={{ width: "100%", minHeight: 44, margin: "8px 0 16px" }}><option value="simulation">Synthetic scenario</option><option value="weather">Open-Meteo weather estimate</option><option value="models">Quartz + WindFM model services</option></select><div className="grid two-col" style={{ gap: 10 }}><label className="filter-control">Solar installation (kW)<input type="number" min="0" max="1000" step="0.1" value={panelCapacityKW} onChange={(event) => setPanelCapacityKW(Number(event.target.value))} disabled={busy} /></label><label className="filter-control">Wind installation (kW)<input type="number" min="0" max="1000" step="0.1" value={turbineCapacityKW} onChange={(event) => setTurbineCapacityKW(Number(event.target.value))} disabled={busy} /></label></div><label className="label" htmlFor="renewable">Renewable multiplier · {renewable.toFixed(1)}×</label><input id="renewable" type="range" min="0" max="2" step="0.1" value={renewable} onChange={(event) => setRenewable(Number(event.target.value))} disabled={busy} style={{ width: "100%", accentColor: "var(--amber)", margin: "12px 0 20px" }} /><label className="label" htmlFor="demand">Demand multiplier · {demand.toFixed(1)}×</label><input id="demand" type="range" min="0.5" max="1.8" step="0.1" value={demand} onChange={(event) => setDemand(Number(event.target.value))} disabled={busy} style={{ width: "100%", accentColor: "var(--blue)", margin: "12px 0 20px" }} /><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button className="status min-h-11" onClick={runPreview} disabled={busy}>Calculate operating view</button><button className="source min-h-11" onClick={reset} disabled={busy}>Reset scenario</button></div>{preview?.metadata && <p className="muted" style={{ fontSize: ".8rem" }}>{preview.metadata.location ? `Weather estimate for ${preview.metadata.location} · ${preview.metadata.weatherDate}` : "Synthetic scenario"}{preview.metadata.fallback ? " · fallback to simulation" : ""}</p>}<div className="analytics-chart" style={{ minHeight: 245, marginTop: 16 }} aria-label="Renewable estimate and fixed demand by half-hour slot in kilowatts"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 8 }}><CartesianGrid stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="time" minTickGap={30} tick={{ fill: "var(--muted)", fontSize: 10 }} /><YAxis unit=" kW" tick={{ fill: "var(--muted)", fontSize: 10 }} /><Tooltip formatter={(value, name) => [`${Number(value).toFixed(2)} kW`, String(name)]} contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10 }} /><Legend wrapperStyle={{ fontSize: 10 }} /><Area type="monotone" dataKey="renewable" name="Renewable estimate" stroke="var(--amber)" fill="var(--amber)" fillOpacity={0.15} strokeWidth={2.5} /><Line type="monotone" dataKey="demand" name="Fixed demand" stroke="var(--blue)" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></div><p className="muted" style={{ fontSize: ".8rem" }}>Slot-average kW · 00:00–24:00 IST · {preview?.data_source ?? "simulation"}. Weather output is an installation estimate, not measured plant generation.</p>{visibleBalances && <p className="muted" style={{ fontSize: ".8rem" }}>{visibleBalances.filter((item) => item.mode === "absorb").length} Absorb slots · {visibleBalances.filter((item) => item.mode === "protect").length} Protect slots</p>}
        {preview?.recommendations?.length ? <div className="notice" style={{ marginTop: 12 }}><strong>Highest-priority operator action</strong><p style={{ margin: "6px 0" }}>{preview.recommendations[0].title} · <b>{preview.recommendations[0].score}/100</b></p><span>{preview.recommendations[0].rationale}</span><small style={{ display: "block", marginTop: 6 }}>Expected effect: {preview.recommendations[0].impact.powerKW.toFixed(2)} kW · {preview.recommendations[0].feasibility.replace("_", " ")}</small></div> : null}
      </section>
      <section className="card"><h2>Playback and verification</h2><p className="muted">Only an accepted activity can run. Playback creates labelled scenario readings and checks the accepted window, original baseline, energy requirement and deadline.</p><p className="muted" style={{ fontSize: ".8rem" }}>Use <strong>Advance 30 minutes</strong> to append one interval at a time and watch the trace become complete. Full replay remains available when you need a single-step result.</p>{!activities.some((activity) => activity.status === "accepted") && <p className="notice">No accepted activity is ready. <Link href="/consumer/offers" className="text-link">Open consumer offers</Link> to accept one, or reset the scenario to start again.</p>}<div className="grid" style={{ gap: 10 }}>{activities.map((activity) => <div key={activity.id} style={{ background: "var(--surface-2)", borderRadius: 10, padding: 12 }}><strong>{activity.name}</strong><div className="muted" style={{ fontSize: ".8rem", margin: "4px 0 10px" }}>{activity.requiredEnergyKWh} kWh · {activity.durationSlots * 30} minutes · {activity.status}</div><label className="label" htmlFor={`outcome-${activity.id}`}>Reading outcome</label><select id={`outcome-${activity.id}`} value={selectedOutcomes[activity.id] ?? "success"} onChange={(event) => setSelectedOutcomes((current) => ({ ...current, [activity.id]: event.target.value as PlaybackOutcome }))} disabled={busy || activity.status !== "accepted"} style={{ width: "100%", minHeight: 44, margin: "8px 0", padding: 8, color: "var(--text)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }}>{outcomes.map((outcome) => <option key={outcome.value} value={outcome.value}>{outcome.label}</option>)}</select><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="source min-h-11" onClick={() => playback(activity.id)} disabled={busy || activity.status !== "accepted"}>Generate and verify reading</button><button className="status min-h-11" onClick={() => playback(activity.id, "advance")} disabled={busy || activity.status !== "accepted"}>Advance 30 minutes</button></div>{readingCounts[activity.id] ? <p className="muted" style={{ fontSize: ".8rem", margin: "8px 0 0" }}>{readingCounts[activity.id]} interval{readingCounts[activity.id] === 1 ? "" : "s"} recorded for this activity.</p> : null}{activity.status !== "accepted" && <p className="muted" style={{ fontSize: ".8rem", marginBottom: 0 }}>{activity.status === "verified" || activity.status === "failed" ? "This activity has a result. Reset to test another outcome." : "Waiting for the consumer to accept a schedule."}</p>}</div>)}</div>{verification && <div className="card" style={{ marginTop: 16 }}><div className="eyebrow">Simulated verification · {verification.outcome}</div><p>{verification.reason}</p><p className="muted">Required: {verification.requiredEnergyKWh} kWh · Recorded: {verification.recordedEnergyKWh} kWh · Eligible shift: {verification.eligibleShiftedKWh}</p><Link className="text-link" href="/operator/overview">View updated operator response →</Link></div>}</section>
    </div><p className="footer">Missing readings remain pending. Incomplete, late or added consumption does not count as a verified response. Scenario playback does not operate real equipment or transfer money.</p>
  </div></main>;
}

