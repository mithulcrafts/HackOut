"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

function DemoButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function start() {
    setLoading(true);
    await fetch("/api/scenarios/seed", { method: "POST" });
    router.push("/operator/overview");
  }
  return <button className="status" onClick={start} disabled={loading}>{loading ? "Preparing demo…" : "Try operator demo →"}</button>;
}

export default function Home() {
  return <main className="shell"><div className="container" style={{ paddingTop: "15vh" }}><div className="eyebrow">Smart Demand Response · Demo</div><h1>Use electricity at a better time.</h1><p className="muted" style={{ maxWidth: 560 }}>Grid Pulse finds a useful time for flexible activity, shows the expected benefit and keeps the decision with the user. This prototype uses labelled simulated readings and illustrative rewards.</p><div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}><DemoButton /><span className="source">Simulation · Asia/Kolkata · 48 half-hour slots</span></div></div></main>;
}
