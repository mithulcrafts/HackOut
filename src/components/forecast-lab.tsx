"use client";

import Link from "next/link";
import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Scenario } from "@/domain/types";
import type { ForecastEvaluation } from "@/domain/forecast/evaluation";
import { OperatorNav } from "./operator-nav";

function metric(value: number | null, suffix = " kW") {
  return value === null ? "—" : `${value}${suffix}`;
}

export function ForecastLab({ scenario }: { scenario: Scenario }) {
  const [source, setSource] = useState<"public_observation" | "simulation">("public_observation");
  const [result, setResult] = useState<ForecastEvaluation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function evaluate() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/forecast/evaluation?source=${source}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Forecast evaluation failed.");
      setResult(data);
      setMessage(data.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load evaluation.");
    } finally {
      setBusy(false);
    }
  }

  const points = result?.points ?? [];
  const baselineImprovement = result && result.baseline.maeKW > 0
    ? Math.round((1 - result.model.maeKW / result.baseline.maeKW) * 100)
    : null;
  const chartPoints = points.map((point) => ({ ...point, observed: point.observedKW, prediction: point.predictedKW, baseline: point.baselineKW }));

  return <main className="shell"><header className="topbar"><div className="container topbar-inner"><Link href="/" className="brand"><span className="brand-mark">VS</span>VidyutSutra</Link><OperatorNav active="/operator/forecast-lab" /></div></header><div className="container" style={{ paddingTop: 40 }}>
    <div className="eyebrow">Forecast evaluation · {scenario.date}</div>
    <h1>Show the forecast. Then show the error.</h1>
    <p className="muted" style={{ maxWidth: 720 }}>This lab uses a time-ordered replay: the prediction is compared with an observation that was not available to the model. The baseline is shown beside it so accuracy is earned by evidence, not by a badge.</p>
    <section className="card" style={{ marginTop: 20 }}><div className="form-row"><label className="label" htmlFor="evaluation-source">Evaluation source</label><select id="evaluation-source" value={source} onChange={(event) => setSource(event.target.value as typeof source)} disabled={busy}><option value="public_observation">Elexon public observations (best effort)</option><option value="simulation">Causal deterministic replay (offline)</option></select></div><button className="primary-button" onClick={evaluate} disabled={busy} style={{ marginTop: 14 }}>{busy ? "Loading observations…" : "Run evaluation"}</button>{message && <p role="status" className="muted" style={{ marginBottom: 0 }}>{message}</p>}</section>
    {result && <><div className="grid metric-grid" style={{ marginTop: 16 }}><div className="card"><div className="label">Forecast MAE</div><div className="metric amber">{metric(result.model.maeKW)}</div><div className="muted">lower is better</div></div><div className="card"><div className="label">Persistence MAE</div><div className="metric blue">{metric(result.baseline.maeKW)}</div><div className="muted">same held-out window</div></div><div className="card"><div className="label">RMSE</div><div className="metric violet">{metric(result.model.rmseKW)}</div><div className="muted">penalises large misses</div></div><div className="card"><div className="label">Interval coverage</div><div className="metric green">{result.model.intervalCoveragePercent}%</div><div className="muted">observations inside band</div></div></div>
      {baselineImprovement !== null && <p className="forecast-evidence-note" role="status">The causal forecast is <strong>{baselineImprovement >= 0 ? `${baselineImprovement}% better` : `${Math.abs(baselineImprovement)}% worse`}</strong> than the persistence baseline on MAE for this replay. This is evidence for the method, not a Gujarat accuracy claim.</p>}
      <section className="card" style={{ marginTop: 16 }}><div className="section-heading"><div><h2>Observed versus predicted renewable output</h2><p className="muted" style={{ margin: 0, fontSize: ".84rem" }}>{result.sourceLabel} · {result.model.sampleCount} points</p></div><span className="source">{result.source === "public_observation" ? "PUBLIC" : "SIMULATED"}</span></div><div className="analytics-chart" style={{ minHeight: 280 }} aria-label="Observed, predicted and persistence baseline renewable output in kilowatts"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartPoints} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}><CartesianGrid stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="label" minTickGap={28} tick={{ fill: "var(--muted)", fontSize: 10 }} /><YAxis unit=" kW" tick={{ fill: "var(--muted)", fontSize: 10 }} /><Tooltip formatter={(value, name) => [`${Number(value).toFixed(2)} kW`, String(name)]} contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10 }} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line type="monotone" dataKey="observed" name="Observed" stroke="var(--green)" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} /><Line type="monotone" dataKey="prediction" name="Prediction" stroke="var(--amber)" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} /><Line type="monotone" dataKey="baseline" name="Persistence baseline" stroke="var(--blue)" strokeWidth={2} strokeDasharray="5 4" dot={false} /></LineChart></ResponsiveContainer></div><p className="chart-note">The curves show the trend; the table is the authoritative value-by-value record. The uncertainty interval is reported in the Band column.</p><div className="table-wrap" style={{ overflowX: "auto", marginTop: 16 }}><table className="table"><thead><tr><th>Time</th><th>Observed kW</th><th>Predicted kW</th><th>Baseline kW</th><th>Band</th></tr></thead><tbody>{points.map((point) => <tr key={`row-${point.slot}`}><td>{point.label}</td><td>{point.observedKW}</td><td>{point.predictedKW}</td><td>{point.baselineKW}</td><td>{point.lowerKW}–{point.upperKW}</td></tr>)}</tbody></table></div></section></>}
    {!result && <div className="notice" style={{ marginTop: 16 }}>Run the evaluation to reveal the error metrics and table. Public observations may fall back to the labelled offline replay when the network is unavailable.</div>}
    <p className="footer">Forecast is an estimate of renewable availability, not a guarantee of generation. The production path would train on site history and weather forecasts; this lab proves the measurement method.</p>
  </div></main>;
}
