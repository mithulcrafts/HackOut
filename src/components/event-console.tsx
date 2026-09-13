"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DemandResponseEvent } from "@/domain/types";
import { OperatorNav } from "./operator-nav";

function formatSlot(index: number) {
  if (index === 48) return "24:00";
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

const SIMULATION_DATE = "2026-09-12";
const slotOptions = Array.from({ length: 49 }, (_, index) => index);
const eligibleActivityTypes = ["ev", "water_heater", "industrial_process", "washing_machine", "dishwasher", "irrigation_pump", "pool_pump", "cold_storage", "e_bike", "custom"] as const;

type EventPreview = {
  eligibleParticipants: number;
  offerCount: number;
  participantGroup: string;
  minParticipants: number;
  maxParticipants: number | null;
  minParticipationMet: boolean;
  participationGap: number;
  projectedShiftedEnergyKWh: number;
  estimatedRewardCost: number;
  uncoveredEligibleActivities: { id: string; name: string; reason: string }[];
};

type ParticipantSummary = {
  offersSent: number;
  accepted: number;
  completed: number;
  verified: number;
  pendingReadings: number;
  failedOrPartial: number;
  acceptedKW: number;
  verifiedKW: number;
  shiftedKWh: number;
  rewardCost: number;
};

type ParticipantSnapshot = {
  activityId: string;
  name: string;
  status: string;
  decision: string;
  verification: string | null;
};

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
  const [participantGroup, setParticipantGroup] = useState("All enrolled participants");
  const [minParticipants, setMinParticipants] = useState(0);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [preview, setPreview] = useState<EventPreview | null>(null);
  const [participantSummaries, setParticipantSummaries] = useState<Record<string, { summary: ParticipantSummary; participants: ParticipantSnapshot[] }>>({});

  useEffect(() => {
    let cancelled = false;
    const monitorable = events.filter((event) => event.status !== "draft");
    if (!monitorable.length) {
      return () => { cancelled = true; };
    }
    Promise.all(monitorable.map(async (event) => {
      const response = await fetch(`/api/events/${encodeURIComponent(event.id)}/participants`, { cache: "no-store" });
      if (!response.ok) return null;
      const json = await response.json() as { summary?: ParticipantSummary; participants?: ParticipantSnapshot[] };
      return json.summary ? [event.id, { summary: json.summary, participants: json.participants ?? [] }] as const : null;
    })).then((items) => {
      if (cancelled) return;
      setParticipantSummaries(Object.fromEntries(items.filter((item): item is readonly [string, { summary: ParticipantSummary; participants: ParticipantSnapshot[] }] => Boolean(item))));
    }).catch(() => {
      if (!cancelled) setParticipantSummaries({});
    });
    return () => { cancelled = true; };
  }, [events]);

  const eventPayload = () => ({
    name,
    objective,
    windowStart,
    windowEnd,
    requestedFlexibilityKW: requested,
    eligibleActivityTypes,
    participantGroup,
    minParticipants,
    maxParticipants,
    rewardRatePerKWh: rate,
    budget,
    offerExpiresAt: `${SIMULATION_DATE}T23:59:00+05:30`,
  });

  async function calculatePreview() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/events/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(eventPayload()),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) setMessage(json.error ?? "Could not calculate event preview.");
      else {
        setPreview(json.preview);
        setMessage("Preview calculated from the current scenario records.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect to the event service.");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(eventPayload()),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) setMessage(json.error ?? "Could not create event.");
      else {
        setEvents((current) => [...current, json.event]);
        setPreview(null);
        setMessage("Draft event created. Publish it to generate offers.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect to the event service.");
    } finally {
      setBusy(false);
    }
  }

  async function publish(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/events/${id}/publish`, { method: "POST" });
      const json = await response.json().catch(() => ({}));
      if (response.ok) {
        setEvents((current) => current.map((event) => event.id === id ? { ...event, status: "active" } : event));
        setMessage("Event published. Offers are now available to participants.");
      } else setMessage(json.error ?? "Unable to publish this event.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect to the event service.");
    } finally {
      setBusy(false);
    }
  }

  async function close(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/events/${id}/close`, { method: "POST" });
      const json = await response.json().catch(() => ({}));
      if (response.ok) {
        setEvents((current) => current.map((event) => event.id === id ? { ...event, status: "closed" } : event));
        setMessage("Event closed. Its report remains available for review.");
      } else setMessage(json.error ?? "Unable to close this event.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect to the event service.");
    } finally {
      setBusy(false);
    }
  }


  const invalidWindow = windowEnd <= windowStart;
  const invalidParticipation = minParticipants < 0 || maxParticipants < 1 || maxParticipants < minParticipants;
  const invalidForm = busy || invalidWindow || invalidParticipation || name.trim().length < 3 || participantGroup.trim().length < 2 || requested <= 0 || rate < 0 || budget < 0;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand"><span className="brand-mark">VS</span>VidyutSutra</Link>
          <OperatorNav active="/operator/events" />
        </div>
      </header>
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="eyebrow">Operator events</div>
        <h1>Create and monitor events.</h1>
        <p className="muted">An event gives every offer a window, eligible activity types, reward terms and an expiry. The baseline is frozen when it is published.</p>
        <div className="card">
          <h2>Create a programme event</h2>
          <div className="grid two-col">
            <label className="filter-control">Event name<input value={name} onChange={(e) => { setName(e.target.value); setPreview(null); }} /></label>
            <label className="filter-control">Objective<select value={objective} onChange={(e) => { setObjective(e.target.value as "absorb" | "protect"); setPreview(null); }}><option value="absorb">Absorb renewable surplus</option><option value="protect">Protect the peak</option></select></label>
            <label className="filter-control">Start time<select value={windowStart} onChange={(e) => { setWindowStart(Number(e.target.value)); setPreview(null); }}>{slotOptions.slice(0, 48).map((slot) => <option key={slot} value={slot}>{formatSlot(slot)}</option>)}</select></label>
            <label className="filter-control">End time<select value={windowEnd} onChange={(e) => { setWindowEnd(Number(e.target.value)); setPreview(null); }}>{slotOptions.slice(1).map((slot) => <option key={slot} value={slot}>{formatSlot(slot)}</option>)}</select></label>
            <label className="filter-control">Requested flexibility (kW)<input type="number" min={1} value={requested} onChange={(e) => { setRequested(Number(e.target.value)); setPreview(null); }} /></label>
            <label className="filter-control">Reward rate estimate (₹/kWh)<input type="number" min={0} step={0.1} value={rate} onChange={(e) => { setRate(Number(e.target.value)); setPreview(null); }} /></label>
            <label className="filter-control">Event budget (₹)<input type="number" min={0} value={budget} onChange={(e) => { setBudget(Number(e.target.value)); setPreview(null); }} /></label>
            <label className="filter-control">Participant group<input value={participantGroup} onChange={(e) => { setParticipantGroup(e.target.value); setPreview(null); }} /></label>
            <label className="filter-control">Minimum participants<input type="number" min={0} value={minParticipants} onChange={(e) => { setMinParticipants(Number(e.target.value)); setPreview(null); }} /></label>
            <label className="filter-control">Maximum participants<input type="number" min={1} value={maxParticipants} onChange={(e) => { setMaxParticipants(Number(e.target.value)); setPreview(null); }} /></label>
          </div>
          <p className="muted">Operating date: 12 September 2026 · {formatSlot(windowStart)}–{formatSlot(windowEnd)} IST · {participantGroup || "Participant group"} · ₹{budget} cap.</p>
          {invalidWindow && <p className="notice error-notice" role="alert">Choose an end time after the start time.</p>}
          {invalidParticipation && <p className="notice error-notice" role="alert">Maximum participation must be at least the minimum.</p>}
          {preview && (
            <div className="event-preview" aria-live="polite">
              <div><strong>{preview.eligibleParticipants}</strong><span>eligible activities</span></div>
              <div><strong>{preview.offerCount}</strong><span>offers projected</span></div>
              <div><strong>{preview.projectedShiftedEnergyKWh.toFixed(1)} kWh</strong><span>potential shifted energy</span></div>
              <div><strong>₹{preview.estimatedRewardCost.toFixed(2)}</strong><span>estimated reward cost</span></div>
              <p>{preview.participantGroup}: {preview.minParticipationMet ? `minimum of ${preview.minParticipants} participants is covered` : `${preview.participationGap} more participant${preview.participationGap === 1 ? "" : "s"} needed to meet the minimum`} · maximum {preview.maxParticipants ?? "unlimited"}.</p>
              {preview.uncoveredEligibleActivities.length > 0 && <p>{preview.uncoveredEligibleActivities.length} eligible activities could not be offered safely in this window: {preview.uncoveredEligibleActivities.map((activity) => activity.name).join(", ")}.</p>}
              {preview.uncoveredEligibleActivities.length === 0 && <p>All eligible activities have a safe offer in this scenario.</p>}
            </div>
          )}
          <div className="event-actions">
            <button className="source min-h-11" onClick={calculatePreview} disabled={invalidForm}>Preview eligible impact</button>
            <Button className="status min-h-11" onClick={create} disabled={invalidForm}>Create draft event</Button>
          </div>
        </div>
        {message && <p role="status" className="muted">{message}</p>}
        <div className="grid" style={{ marginTop: 20 }}>
          {events.map((event) => (
            <div className="card" key={event.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div><h2>{event.name}</h2><p className="muted">{event.objective === "absorb" ? "Renewable surplus absorption" : "Peak support"} · {formatSlot(event.windowStart)}–{formatSlot(event.windowEnd)} · {event.requestedFlexibilityKW} kW requested</p></div>
                <span className={`status ${event.objective === "protect" ? "protect" : ""}`}>{event.status}</span>
              </div>
              <p className="muted" style={{ fontSize: ".84rem" }}>Group: {event.participantGroup ?? "All enrolled participants"} · Participation: {event.minParticipants ?? 0}–{event.maxParticipants ?? "unlimited"} · Reward: ₹{event.rewardRatePerKWh}/kWh · Budget: ₹{event.budget}</p>
              <p className="muted" style={{ fontSize: ".78rem" }}>Eligible activities: {event.eligibleActivityTypes.join(", ")}</p>
              {participantSummaries[event.id] && <div className="participant-summary" aria-label={`${event.name} participant status`}>
                {[
                  [participantSummaries[event.id].summary.offersSent, "offers sent"],
                  [participantSummaries[event.id].summary.accepted, "accepted"],
                  [participantSummaries[event.id].summary.verified, "verified"],
                  [participantSummaries[event.id].summary.pendingReadings, "pending readings"],
                ].map(([value, label]) => <div key={label as string}><strong>{value as number}</strong><span>{label as string}</span></div>)}
                <p>{participantSummaries[event.id].summary.acceptedKW.toFixed(1)} kW accepted · {participantSummaries[event.id].summary.verifiedKW.toFixed(1)} kW verified · {participantSummaries[event.id].summary.shiftedKWh.toFixed(1)} kWh shifted · ₹{participantSummaries[event.id].summary.rewardCost.toFixed(2)} ledger value</p>
                {participantSummaries[event.id].participants.length > 0 && <details><summary>View participant activity status</summary><ul>{participantSummaries[event.id].participants.map((participant) => <li key={participant.activityId}><strong>{participant.name}</strong> · {participant.decision}{participant.verification ? ` · ${participant.verification}` : " · awaiting verification"}</li>)}</ul></details>}
              </div>}
              {event.status === "draft" && <Button className="status min-h-11" onClick={() => publish(event.id)} disabled={busy}>Publish and generate offers</Button>}
              {(event.status === "active" || event.status === "verifying") && <Button className="source min-h-11" variant="outline" onClick={() => close(event.id)} disabled={busy}>Close event</Button>}
              <Link className="text-link" href="/operator/reports">View event report →</Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );

}
