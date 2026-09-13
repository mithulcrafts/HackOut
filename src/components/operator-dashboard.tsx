"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Scenario, ScenarioSummary } from "@/domain/types";
import { classifyBalance, dispatchBattery } from "@/domain/scheduling/engine";
import { effectiveSchedules, summarizeScenario } from "@/domain/summary";
import { OperatorAnalytics } from "./operator-analytics";
import { OperatorNav } from "./operator-nav";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

const FOCUS_SLOT = 26;

export function OperatorDashboard({ scenario, summary }: { scenario: Scenario; summary: ScenarioSummary; balances?: unknown; battery?: unknown }) {
  const [liveScenario, setLiveScenario] = useState<Scenario>(scenario);
  const [sourceStatus, setSourceStatus] = useState("Loading live forecast…");
  useEffect(() => {
    let active = true;
    fetch("/api/forecast?source=models", { cache: "no-store" })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Forecast unavailable"); return body; })
      .then((body) => { if (!active) return; setLiveScenario((current) => ({ ...current, forecast: body.forecast, data_source: body.data_source })); setSourceStatus(`${body.metadata?.provider ?? "Forecast provider"}${body.metadata?.fallback ? " · fallback" : ""}`); })
      .catch(() => { if (active) setSourceStatus("Configured scenario · live provider unavailable"); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return;
    let client: ReturnType<typeof createSupabaseClient>;
    try { client = createSupabaseClient(); } catch { return; }
    const channel = client.channel("operator-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "operator_events" }, () => window.location.reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "operator_scenarios" }, () => window.location.reload())
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, []);
  const effective = effectiveSchedules(liveScenario);
  const balances = classifyBalance(liveScenario.forecast, effective, liveScenario.sitePowerLimitKW);
  const battery = dispatchBattery(liveScenario.forecast, effective, liveScenario.battery);
  const liveSummary = useMemo(() => summarizeScenario(liveScenario), [liveScenario]);
  const activeSummary = liveScenario.data_source === scenario.data_source ? summary : liveSummary;
  const current = balances[FOCUS_SLOT] ?? balances[0];
  const currentForecast = current ? liveScenario.forecast[current.slot] : undefined;
  const currentDemand = currentForecast ? currentForecast.fixedDemandKW + effective.filter((entry) => entry.accepted && current.slot >= entry.startSlot && current.slot < entry.endSlot).reduce((sum, entry) => sum + entry.powerKW, 0) : 0;
  const capacityBreach = currentDemand > liveScenario.sitePowerLimitKW;
  const peakChange = activeSummary.baselinePeakKW > 0 ? Math.round((1 - activeSummary.scheduledPeakKW / activeSummary.baselinePeakKW) * 100) : 0;

  const flexibleAvailable = liveScenario.activities.filter((activity) => !["accepted", "completed", "verified", "failed", "paused"].includes(activity.status)).length;
  const budgetTotal = liveScenario.events.reduce((sum, event) => sum + event.budget, 0);
  const budgetSpent = (liveScenario.rewardLedger ?? []).reduce((sum, entry) => sum + entry.illustrativeRupees, 0);
  const budgetRemaining = Math.max(0, budgetTotal - budgetSpent);
  const storagePoint = battery[FOCUS_SLOT] ?? battery[0];
  return (
    <main className="shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand"><span className="brand-mark">VS</span>VidyutSutra</Link>
          <OperatorNav active="/operator/overview" />
        </div>
      </header>
      <div className="container">
        <section className="hero">
          <div><div className="eyebrow">Operator overview · {liveScenario.date}</div><h1>Coordinate the next useful kWh.</h1><p className="muted">A decision view for renewable-aligned flexibility. {sourceStatus}</p></div>
          <span className={`status ${(capacityBreach || current?.mode === "protect") ? "protect" : ""}`}>{capacityBreach ? "Site capacity breach" : current?.mode === "absorb" ? "Absorb opportunity" : "Protect condition"}</span>
        </section>
        <section className="grid metric-grid" aria-label="Current operator metrics">
          <div className="card"><div className="label">Renewable at focus</div><div className="metric amber">{currentForecast?.renewableKW.toFixed(1) ?? "–"} kW</div><div className="muted">estimated at 1:00 PM IST</div></div>
          <div className="card"><div className="label">Demand at focus</div><div className="metric blue">{currentDemand.toFixed(1)} kW</div><div className="muted">fixed plus accepted load</div></div>
          <div className="card"><div className="label">Balance at focus</div><div className={`metric ${current?.mode === "protect" ? "protect" : "green"}`}>{current ? `${current.balanceKW > 0 ? "+" : ""}${current.balanceKW.toFixed(1)} kW` : "–"}</div><div className="muted">positive means room to absorb</div></div>
          <div className="card"><div className="label">Flexible activities</div><div className="metric violet">{flexibleAvailable}</div><div className="muted">available for a consented offer</div></div>
          <div className="card"><div className="label">Peak accepted capacity</div><div className="metric blue">{activeSummary.acceptedKW.toFixed(1)} kW</div><div className="muted">maximum concurrent committed load</div></div>
          <div className="card"><div className="label">Peak verified response</div><div className="metric violet">{activeSummary.verifiedKW.toFixed(1)} kW</div><div className="muted">maximum concurrent evidence-backed response</div></div>
          <div className="card"><div className="label">Reward budget remaining</div><div className="metric amber">₹{budgetRemaining.toFixed(2)}</div><div className="muted">illustrative programme budget</div></div>
          <div className="card"><div className="label">Storage posture</div><div className="metric green" style={{ fontSize: "1.25rem" }}>{storagePoint?.action === "charge" ? "Charge" : storagePoint?.action === "discharge" ? "Discharge" : "Ready"}</div><div className="muted">{liveScenario.battery.currentKWh.toFixed(1)} / {liveScenario.battery.capacityKWh} kWh</div></div>
        </section>
        <OperatorAnalytics scenario={liveScenario} schedules={effective} battery={battery} />
        <p className="footer">Peak change: <strong>{peakChange}%</strong> against the frozen baseline. Data source: <strong>estimated programme records</strong>. Operator recommendations are read-only until approved utility integrations exist.</p>
      </div>
    </main>
  );

}

