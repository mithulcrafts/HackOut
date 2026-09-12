"use client";

import Link from "next/link";
import { useState } from "react";
import type { Activity, BalanceResult, ForecastSlot } from "@/domain/types";

export function SimulationConsole({ activities, forecast }: { activities: Activity[]; forecast: ForecastSlot[] }) {
  const [renewable, setRenewable] = useState(1);
  const [demand, setDemand] = useState(1);
  const [preview, setPreview] = useState<{ forecast: ForecastSlot[]; balances: BalanceResult[] } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function runPreview() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/scenarios/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ renewableMultiplier: renewable, demandMultiplier: demand }) });
    const data = await response.json();
    if (response.ok) { setPreview(data); setMessage("Preview calculated in memory. Accepted schedules and the baseline were not changed."); } else setMessage(data.error ?? "Preview failed.");
    setBusy(false);
  }
  async function reset() {
    setBusy(true); const response = await fetch("/api/scenarios/reset", { method: "POST" }); setMessage(response.ok ? "Scenario reset to the deterministic seed." : "Reset failed."); setBusy(false); setPreview(null);
  }
  async function playback(activityId: string, outcome: "success" | "partial" | "late" | "missing") {
    setBusy(true); const response = await fetch("/api/scenarios/playback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ activityId, outcome }) }); const data = await response.json(); setMessage(data.message ?? data.error ?? "Playback complete."); setBusy(false);
  }
  const visibleForecast = preview?.forecast ?? forecast;
  const visibleBalances = preview?.balances;
  return <main className="shell"><header className="topbar"><div className="container topbar-inner"><Link href="/" className="brand"><span className="brand-mark">VS</span>VidyutSutra</Link><Link className="muted" href="/operator/overview">← Overview</Link></div></header><div className="container" style={{ paddingTop: 40 }}><div className="eyebrow">Simulation controls</div><h1>Replay the demand-response day.</h1><p className="muted">Adjust the forecast in an in-memory copy, then replay simulated readings. Every value is labelled as simulation; no device or grid command is sent.</p><div className="grid two-col"><section className="card"><h2>What-if preview</h2><label className="label" htmlFor="renewable">Renewable multiplier · {renewable.toFixed(1)}×</label><input id="renewable" type="range" min="0" max="2" step="0.1" value={renewable} onChange={(event) => setRenewable(Number(event.target.value))} style={{ width: "100%", accentColor: "var(--amber)", margin: "12px 0 20px" }} /><label className="label" htmlFor="demand">Demand multiplier · {demand.toFixed(1)}×</label><input id="demand" type="range" min="0.5" max="1.8" step="0.1" value={demand} onChange={(event) => setDemand(Number(event.target.value))} style={{ width: "100%", accentColor: "var(--blue)", margin: "12px 0 20px" }} /><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button className="status" onClick={runPreview} disabled={busy}>Calculate preview</button><button className="source" onClick={reset} disabled={busy}>Reset seed</button></div>{message && <p role="status" className="muted">{message}</p>}<div className="chart-wrap" style={{ marginTop: 16 }}><div className="chart" style={{ minWidth: 480, height: 170 }} aria-label="Preview renewable and demand bars">{visibleForecast.map((slot) => <div className="bar-group" key={slot.index}><div className="bar renewable" style={{ height: `${Math.min(100, slot.renewableKW * 7)}%` }} /><div className="bar demand" style={{ height: `${Math.min(100, slot.fixedDemandKW * 7)}%` }} /></div>)}</div></div><div className="muted" style={{ fontSize: ".8rem" }}>{visibleBalances ? `${visibleBalances.filter((item) => item.mode === "absorb").length} Absorb slots · ${visibleBalances.filter((item) => item.mode === "protect").length} Protect slots` : "Seeded forecast · 48 half-hour slots"}</div></section><section className="card"><h2>Playback demonstration</h2><p className="muted">Select an accepted activity after the consumer track agrees to its offer. A missing reading remains pending; partial and late cases require verification review.</p><div className="grid" style={{ gap: 10 }}>{activities.map((activity) => <div key={activity.id} style={{ background: "var(--surface-2)", borderRadius: 10, padding: 12 }}><strong>{activity.name}</strong><div className="muted" style={{ fontSize: ".8rem", margin: "4px 0 10px" }}>{activity.requiredEnergyKWh} kWh · {activity.durationSlots * 30} minutes · {activity.status}</div><div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}><button className="source" onClick={() => playback(activity.id, "success")} disabled={busy}>Successful reading</button><button className="source" onClick={() => playback(activity.id, "partial")} disabled={busy}>Partial</button><button className="source" onClick={() => playback(activity.id, "late")} disabled={busy}>Late</button><button className="source" onClick={() => playback(activity.id, "missing")} disabled={busy}>Missing</button></div></div>)}</div></section></div><p className="footer">The playback endpoint only receives a simulated reading. Verification, reward eligibility and ledger writes remain server-side trust-track operations.</p></div></main>;
}
