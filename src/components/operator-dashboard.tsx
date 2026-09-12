"use client";

import Link from "next/link";
import type { Scenario, ScenarioSummary } from "@/domain/types";
import { classifyBalance, dispatchBattery } from "@/domain/scheduling/engine";
import { effectiveSchedules } from "@/domain/summary";
import { OperatorAnalytics } from "./operator-analytics";

export function OperatorDashboard({ scenario, summary }: { scenario: Scenario; summary: ScenarioSummary; balances?: unknown; battery?: unknown }) {
  const effective = effectiveSchedules(scenario);
  const balances = classifyBalance(scenario.forecast, effective, scenario.sitePowerLimitKW);
  const battery = dispatchBattery(scenario.forecast, effective, scenario.battery);
  const current = balances[26] ?? balances[0];
  const currentDemand = current ? scenario.forecast[current.slot].fixedDemandKW + effective.filter((entry) => entry.accepted && current.slot >= entry.startSlot && current.slot < entry.endSlot).reduce((sum, entry) => sum + entry.powerKW, 0) : 0;
  const capacityBreach = currentDemand > scenario.sitePowerLimitKW;
  const peakChange = summary.baselinePeakKW > 0 ? Math.round((1 - summary.scheduledPeakKW / summary.baselinePeakKW) * 100) : 0;
  const navigation = [["Overview", "/operator/overview"], ["Events", "/operator/events"], ["Flexibility", "/operator/flexibility"], ["Verification", "/operator/verification"], ["Rewards", "/operator/rewards"], ["Reports", "/operator/reports"], ["Forecast lab", "/operator/forecast-lab"], ["Settings", "/operator/settings"]];
  return <main className="shell"><header className="topbar"><div className="container topbar-inner"><Link href="/" className="brand"><span className="brand-mark">VS</span>VidyutSutra</Link><nav className="nav" aria-label="Operator navigation">{navigation.map(([label, href]) => <Link key={href} href={href} aria-current={href === "/operator/overview" ? "page" : undefined}>{label}</Link>)}</nav></div></header><div className="container"><section className="hero"><div><div className="eyebrow">Operator overview · {scenario.date}</div><h1>Coordinate the next useful kWh.</h1><p className="muted">A decision view for renewable-aligned flexibility. Forecasts and demand are simulated for this repeatable scenario.</p></div><span className={"status " + ((capacityBreach || current?.mode === "protect") ? "protect" : "")}>{capacityBreach ? "Site capacity breach" : current?.mode === "absorb" ? "Absorb opportunity" : "Protect condition"}</span></section><section className="grid metric-grid" aria-label="Scenario metrics"><div className="card"><div className="label">Renewable-rich slots</div><div className="metric amber">{summary.absorbSlots}</div><div className="muted">of 48 half-hour slots</div></div><div className="card"><div className="label">Accepted capacity</div><div className="metric blue">{summary.acceptedKW.toFixed(1)} kW</div><div className="muted">accepted commitments</div></div><div className="card"><div className="label">Peak change</div><div className={"metric " + (peakChange >= 0 ? "green" : "protect")}>{peakChange}%</div><div className="muted">baseline vs effective schedule</div></div><div className="card"><div className="label">Verified response</div><div className="metric violet">{summary.verifiedKW.toFixed(1)} kW</div><div className="muted">{summary.verifiedKW > 0 ? "verified from evidence" : "awaiting device evidence"}</div></div></section><OperatorAnalytics scenario={scenario} schedules={effective} battery={battery} /><p className="footer">Data source: <strong>Simulation</strong>. Verified response remains {summary.verifiedKW.toFixed(1)} kW after authorised evidence is checked.</p></div></main>;
}
