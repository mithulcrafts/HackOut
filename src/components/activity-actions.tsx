"use client";

import Link from "next/link";
import { useState } from "react";
import { runConsumerDemo } from "@/lib/run-consumer-demo";

export function ActivityActions() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setStatus("");
    try {
      const state = await runConsumerDemo(async (url, action) => {
        const response = await fetch(url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "The activity could not complete. Please retry.");
        return body;
      });
      const points = state.rewards.reduce((total, entry) => total + entry.points, 0);
      setStatus(`EV activity: ${state.verification?.status ?? "not verified"}. ${state.verification?.reason ?? ""} Wallet: ${points} points.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to verify this activity.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="schedule-card">
    <span className="section-label">ACTIVITY VERIFICATION</span>
    <h3>Try meter verification</h3>
    <p>This accepts the EV offer, records a simulated reading for the prototype and verifies the activity. Other saved activities are not changed.</p>
    <button type="button" className="secondary-button" disabled={busy} onClick={run}>
      {busy ? "Checking activity…" : "Accept, simulate + verify"}
    </button>
    {status && <p role="status">{status}</p>}
    <Link className="text-link" href="/consumer/rewards">View rewards →</Link>
  </section>;
}
