"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Scenario } from "@/domain/types";
import { OperatorNav } from "./operator-nav";

export function OperatorSettings({ scenario }: { scenario: Scenario }) {
  const router = useRouter();
  const draft = scenario.events.find((event) => event.status === "draft");
  const [sitePowerLimitKW, setSitePowerLimitKW] = useState(scenario.sitePowerLimitKW);
  const [batteryCapacityKWh, setBatteryCapacityKWh] = useState(scenario.battery.capacityKWh);
  const [batteryCurrentKWh, setBatteryCurrentKWh] = useState(scenario.battery.currentKWh);
  const [maxChargeKW, setMaxChargeKW] = useState(scenario.battery.maxChargeKW);
  const [maxDischargeKW, setMaxDischargeKW] = useState(scenario.battery.maxDischargeKW);
  const [roundTripEfficiency, setRoundTripEfficiency] = useState(scenario.battery.roundTripEfficiency);
  const [rewardRatePerKWh, setRewardRatePerKWh] = useState(scenario.rewardRatePerKWh);
  const [draftEventBudget, setDraftEventBudget] = useState(draft?.budget ?? 250);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setIsError(false);
    try {
      const response = await fetch("/api/scenarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sitePowerLimitKW, batteryCapacityKWh, batteryCurrentKWh, maxChargeKW, maxDischargeKW, roundTripEfficiency, rewardRatePerKWh, draftEventBudget }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to save settings.");
      setMessage(body.message); router.refresh();
    } catch (error) {
      setIsError(true); setMessage(error instanceof Error ? error.message : "Unable to save settings.");
    } finally { setBusy(false); }
  }

  return <main className="shell"><header className="topbar"><div className="container topbar-inner"><Link href="/" className="brand"><span className="brand-mark">VS</span>VidyutSutra</Link><OperatorNav active="/operator/settings" /></div></header><div className="container" style={{ paddingTop: 40 }}>
    <div className="eyebrow">Operator settings · scenario configuration</div><h1>Set limits before asking people to shift.</h1><p className="muted">These controls change the shared operating scenario. Existing published offer terms remain frozen; reward changes apply only to draft events.</p>
    <form className="card" onSubmit={save}>
      <div className="grid two-col">
        <label className="filter-control">Site power limit (kW)<input type="number" min="1" step="0.1" value={sitePowerLimitKW} onChange={(event) => setSitePowerLimitKW(Number(event.target.value))} /></label>
        <label className="filter-control">Battery capacity (kWh)<input type="number" min="0.1" step="0.1" value={batteryCapacityKWh} onChange={(event) => setBatteryCapacityKWh(Number(event.target.value))} /></label>
        <label className="filter-control">Current battery energy (kWh)<input type="number" min="0" max={batteryCapacityKWh} step="0.1" value={batteryCurrentKWh} onChange={(event) => setBatteryCurrentKWh(Number(event.target.value))} /></label>
        <label className="filter-control">Round-trip efficiency (%)<input type="number" min="50" max="100" step="1" value={Math.round(roundTripEfficiency * 100)} onChange={(event) => setRoundTripEfficiency(Number(event.target.value) / 100)} /></label>
        <label className="filter-control">Maximum charge power (kW)<input type="number" min="0" step="0.1" value={maxChargeKW} onChange={(event) => setMaxChargeKW(Number(event.target.value))} /></label>
        <label className="filter-control">Maximum discharge power (kW)<input type="number" min="0" step="0.1" value={maxDischargeKW} onChange={(event) => setMaxDischargeKW(Number(event.target.value))} /></label>
        <label className="filter-control">Default illustrative reward (₹/kWh)<input type="number" min="0" max="100" step="0.1" value={rewardRatePerKWh} onChange={(event) => setRewardRatePerKWh(Number(event.target.value))} /></label>
        <label className="filter-control">Draft event budget (₹)<input type="number" min="0" max="1000000" step="1" value={draftEventBudget} onChange={(event) => setDraftEventBudget(Number(event.target.value))} /></label>
      </div>
      <div className="notice"><strong>Forecast configuration</strong><p>Choose Open-Meteo and enter solar/wind installation capacities in Simulation. Weather becomes a labelled installation estimate; it is never presented as measured grid generation.</p></div>
      <div className="event-actions"><button className="status min-h-11" disabled={busy}>{busy ? "Saving settings…" : "Save operating settings"}</button><Link className="source min-h-11" href="/operator/simulation">Configure weather estimate</Link></div>
      {message && <p className={isError ? "notice error-notice" : "muted"} role={isError ? "alert" : "status"}>{message}</p>}
    </form>
    <p className="footer">Scenario configuration only. No protection device, battery, utility meter or payment rail is controlled.</p>
  </div></main>;
}
