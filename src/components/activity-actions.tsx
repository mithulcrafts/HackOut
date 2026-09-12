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
<<<<<<< HEAD
        if (!response.ok) throw new Error(body.error || "The activity check could not complete. Please retry.");
=======
        if (!response.ok) throw new Error(body.error || "The activity check could not complete. Please retry.");
>>>>>>> origin/main
        return body;
      });
      const points = state.rewards.reduce((total, entry) => total + entry.points, 0);
      setStatus(`EV activity: ${state.verification?.status ?? "not verified"}. ${state.verification?.reason ?? ""} Wallet: ${points} points.`);
    } catch (error) {
<<<<<<< HEAD
      setStatus(error instanceof Error ? error.message : "Unable to check the activity.");
=======
      setStatus(error instanceof Error ? error.message : "Unable to check the activity.");
>>>>>>> origin/main
    } finally {
      setBusy(false);
    }
  }

  return <section className="schedule-card">
<<<<<<< HEAD
    <span className="section-label">METER EVIDENCE CHECK</span>
    <h3>Try meter verification</h3>
    <p>This checks the dedicated EV offer with controlled meter readings. Your other saved activities are not marked complete.</p>
    <button type="button" className="secondary-button" disabled={busy} onClick={run}>
      {busy ? "Checking activity…" : "Check meter evidence"}
=======
    <span className="section-label">METER EVIDENCE CHECK</span>
    <h3>Try meter verification</h3>
    <p>This checks the dedicated EV offer with simulated meter readings. Your other saved activities are not marked complete.</p>
    <button type="button" className="secondary-button" disabled={busy} onClick={run}>
      {busy ? "Checking activity…" : "Check meter evidence"}
>>>>>>> origin/main
    </button>
    {status && <p role="status">{status}</p>}
    <Link className="text-link" href="/consumer/rewards">View rewards →</Link>
  </section>;
}
