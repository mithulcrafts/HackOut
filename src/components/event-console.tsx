"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { DemandResponseEvent } from "@/domain/types";

function formatSlot(index: number) {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}
const SIMULATION_DATE = "2026-09-12";
const slotOptions = Array.from({ length: 49 }, (_, index) => index);

export function EventConsole({ initialEvents }: { initialEvents: DemandResponseEvent[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("Afternoon renewable absorption");
  const [objective, setObjective] = useState<"absorb" | "protect">("absorb");
  const [windowStart, setWindowStart] = useState(26);
  const [windowEnd, setWindowEnd] = useState(30);
  const [requested, setRequested] = useState(10);
  const [rate, setRate] = useState(1.5);
  const [budget, setBudget] = useState(250);

  async function create() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, objective, windowStart, windowEnd, requestedFlexibilityKW: requested, eligibleActivityTypes: ["ev", "water_heater", "industrial_process"], rewardRatePerKWh: rate, budget, offerExpiresAt: `${SIMULATION_DATE}T23:59:00+05:30` }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) setMessage(json.error ?? "Could not create event.");
      else { setEvents((current) => [...current, json.event]); setMessage("Draft event created. Publish it to generate offers."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not connect to the event service."); }
    finally { setBusy(false); }
  }

  async function publish(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/events/${id}/publish`, { method: "POST" });
      const json = await response.json().catch(() => ({}));
      if (response.ok) { setEvents((current) => current.map((event) => event.id === id ? { ...event, status: "active" } : event)); setMessage("Event published. Offers are now available to participants."); }
      else setMessage(json.error ?? "Unable to publish this event.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not connect to the event service."); }
    finally { setBusy(false); }
  }

  async function close(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/events/${id}/close`, { method: "POST" });
      const json = await response.json().catch(() => ({}));
      if (response.ok) { setEvents((current) => current.map((event) => event.id === id ? { ...event, status: "closed" } : event)); setMessage("Event closed. Its report remains available for review."); }
      else setMessage(json.error ?? "Unable to close this event.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not connect to the event service."); }
    finally { setBusy(false); }
  }

 return <main className="shell"><header className="topbar"><div className="container topbar-inner"><Link href="/" className="brand"><span className="brand-mark">VS</span>VidyutSutra</Link><Link className="muted" href="/operator/overview">← Overview</Link></div></header><div className="container" style={{ paddingTop: 40 }}><div className="eyebrow">Operator events</div><h1>Create and monitor events.</h1><p className="muted">An event gives every offer a window, eligible activity types, reward terms and an expiry. The baseline is frozen when it is published.</p><div className="card"><h2>Create a programme event</h2><div className="grid two-col"><label className="filter-control">Event name<input value={name} onChange={(e) => setName(e.target.value)} /></label><label className="filter-control">Objective<select value={objective} onChange={(e) => setObjective(e.target.value as "absorb" | "protect")}><option value="absorb">Absorb renewable surplus</option><option value="protect">Protect the peak</option></select></label><label className="filter-control">Start time<select value={windowStart} onChange={(e) => setWindowStart(Number(e.target.value))}>{slotOptions.slice(0, 48).map(slot => <option key={slot} value={slot}>{formatSlot(slot)}</option>)}</select></label><label className="filter-control">End time<select value={windowEnd} onChange={(e) => setWindowEnd(Number(e.target.value))}>{slotOptions.slice(1).map(slot => <option key={slot} value={slot}>{formatSlot(slot)}</option>)}</select></label><label className="filter-control">Requested flexibility (kW)<input type="number" min={1} value={requested} onChange={(e) => setRequested(Number(e.target.value))} /></label><label className="filter-control">Illustrative reward rate (₹/kWh)<input type="number" min={0} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} /></label><label className="filter-control">Event budget (₹)<input type="number" min={0} value={budget} onChange={(e) => setBudget(Number(e.target.value))} /></label></div><p className="muted">Simulation date: 12 September 2026 · {formatSlot(windowStart)}–{formatSlot(windowEnd)} IST · EV, water heating and industrial activities · ₹{budget} cap.</p><Button className="status min-h-11" onClick={create} disabled={busy || windowEnd <= windowStart || name.trim().length < 3}>Create draft event</Button></div>{message && <p role="status" className="muted">{message}</p>}<div className="grid" style={{ marginTop: 20 }}>{events.map((event) => <div className="card" key={event.id}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><div><h2>{event.name}</h2><p className="muted">{event.objective === "absorb" ? "Renewable surplus absorption" : "Peak support"} · {formatSlot(event.windowStart)}–{formatSlot(event.windowEnd)} · {event.requestedFlexibilityKW} kW requested</p></div><span className={`status ${event.objective === "protect" ? "protect" : ""}`}>{event.status}</span></div><p className="muted" style={{ fontSize: ".84rem" }}>Reward: ₹{event.rewardRatePerKWh}/kWh · Budget: ₹{event.budget} · Eligible: {event.eligibleActivityTypes.join(", ")}</p>{event.status === "draft" && <Button className="status min-h-11" onClick={() => publish(event.id)} disabled={busy}>Publish and generate offers</Button>}{(event.status === "active" || event.status === "verifying") && <Button className="source min-h-11" variant="outline" onClick={() => close(event.id)} disabled={busy}>Close event</Button>}<Link className="text-link" href="/operator/reports">View event report →</Link></div>)}</div></div></main>;
}
