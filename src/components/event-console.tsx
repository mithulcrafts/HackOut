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

export function EventConsole({ initialEvents }: { initialEvents: DemandResponseEvent[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Afternoon renewable absorption", objective: "absorb", windowStart: 26, windowEnd: 30, requestedFlexibilityKW: 10, eligibleActivityTypes: ["ev", "water_heater", "industrial_process"], rewardRatePerKWh: 1.5, budget: 250, offerExpiresAt: "2026-09-12T16:00:00+05:30" }) });
    const json = await response.json();
    if (!response.ok) setMessage(json.error ?? "Could not create event.");
    else { setEvents((current) => [...current, json.event]); setMessage("Draft event created. Publish it to generate offers."); }
    setBusy(false);
  }

  async function publish(id: string) {
    setBusy(true);
    const response = await fetch(`/api/events/${id}/publish`, { method: "POST" });
    if (response.ok) setEvents((current) => current.map((event) => event.id === id ? { ...event, status: "active" } : event));
    setMessage(response.ok ? "Event published. Offers are now available for the consumer track." : "Unable to publish this event.");
    setBusy(false);
  }

  async function close(id: string) {
    setBusy(true);
    const response = await fetch(`/api/events/${id}/close`, { method: "POST" });
    if (response.ok) setEvents((current) => current.map((event) => event.id === id ? { ...event, status: "closed" } : event));
    setMessage(response.ok ? "Event closed. Its report remains available for review." : "Unable to close this event.");
    setBusy(false);
  }

  return <main className="shell"><header className="topbar"><div className="container topbar-inner"><Link href="/" className="brand"><span className="brand-mark">GP</span>Grid Pulse</Link><Link className="muted" href="/operator/overview">← Overview</Link></div></header><div className="container" style={{ paddingTop: 40 }}><div className="eyebrow">Operator events</div><h1>Create and monitor events.</h1><p className="muted">An event gives every offer a window, eligible activity types, reward terms and an expiry. The baseline is frozen when it is published.</p><Button className="status min-h-11" onClick={create} disabled={busy}>+ Create demo event</Button>{message && <p role="status" className="muted">{message}</p>}<div className="grid" style={{ marginTop: 20 }}>{events.map((event) => <div className="card" key={event.id}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><div><h2>{event.name}</h2><p className="muted">{event.objective === "absorb" ? "Renewable surplus absorption" : "Peak support"} · {formatSlot(event.windowStart)}–{formatSlot(event.windowEnd)} · {event.requestedFlexibilityKW} kW requested</p></div><span className={`status ${event.objective === "protect" ? "protect" : ""}`}>{event.status}</span></div><p className="muted" style={{ fontSize: ".84rem" }}>Reward: ₹{event.rewardRatePerKWh}/kWh · Budget: ₹{event.budget} · Eligible: {event.eligibleActivityTypes.join(", ")}</p>{event.status === "draft" && <Button className="status min-h-11" onClick={() => publish(event.id)} disabled={busy}>Publish and generate offers</Button>}{event.status === "active" && <Button className="source min-h-11" variant="outline" onClick={() => close(event.id)} disabled={busy}>Close event</Button>}</div>)}</div></div></main>;
}
