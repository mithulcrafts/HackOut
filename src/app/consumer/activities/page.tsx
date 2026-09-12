"use client";

import { BatteryCharging, ChevronLeft, Clock3, Droplets, Factory, Plus, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

type ActivityType = "EV charging" | "Water heating" | "Industrial process";
type Activity = { id: number; type: ActivityType; name: string; window: string; duration: string; interruptible: boolean };

const presets: { type: ActivityType; description: string; icon: typeof Zap; tone: string }[] = [
  { type: "EV charging", description: "Charge before you leave", icon: BatteryCharging, tone: "amber" },
  { type: "Water heating", description: "Heat before you need it", icon: Droplets, tone: "blue" },
  { type: "Industrial process", description: "Move an approved process", icon: Factory, tone: "violet" },
];

export default function ActivitiesPage() {
  const [selected, setSelected] = useState<ActivityType>("EV charging");
  const [name, setName] = useState("My EV");
  const [earliest, setEarliest] = useState("13:00");
  const [deadline, setDeadline] = useState("17:00");
  const [duration, setDuration] = useState("2");
  const [interruptible, setInterruptible] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [message, setMessage] = useState("");

  function choose(type: ActivityType) {
    setSelected(type); setName(type === "EV charging" ? "My EV" : type === "Water heating" ? "Evening hot water" : "Production process");
    setMessage("");
  }

  function addActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (earliest >= deadline || Number(duration) <= 0) { setMessage("Choose a valid window and duration before adding this activity."); return; }
    setActivities((items) => [...items, { id: Date.now(), type: selected, name: name.trim() || selected, window: `${earliest}–${deadline}`, duration, interruptible }]);
    setMessage("Activity saved for this simulated demo. You can schedule it after the renewable outlook is loaded.");
  }

  return <main className="app-shell"><section className="hero-panel activity-hero"><Link className="back-link" href="/consumer/today"><ChevronLeft size={17} /> Today</Link><div className="hero-copy"><p className="kicker">YOUR FLEXIBLE LOADS</p><h1>What needs to get done?</h1><p className="hero-description">Tell us the deadline. We’ll find a renewable-aligned time that fits your routine.</p></div></section><section className="content-section"><div className="section-heading"><div><span className="section-label">QUICK SETUP</span><h2>Choose an activity</h2></div><Plus size={22} color="var(--amber)" /></div><div className="preset-grid">{presets.map(({ type, description, icon: Icon, tone }) => <button key={type} className={`preset-card ${selected === type ? "selected" : ""}`} onClick={() => choose(type)}><span className={`activity-icon ${tone}`}><Icon size={20} /></span><strong>{type}</strong><small>{description}</small></button>)}</div><form className="activity-form" onSubmit={addActivity}><label>Activity name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My scooter" /></label><div className="form-row"><label>Can start at<input type="time" value={earliest} onChange={(e) => setEarliest(e.target.value)} /></label><label>Need it by<input type="time" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label></div><label>Usually takes (hours)<input type="number" min="0.5" max="12" step="0.5" value={duration} onChange={(e) => setDuration(e.target.value)} /></label><label className="toggle-row"><span><strong>Can pause if needed?</strong><small>Useful for scheduling around changing renewable availability.</small></span><input type="checkbox" checked={interruptible} onChange={(e) => setInterruptible(e.target.checked)} /></label><button className="primary-button form-submit" type="submit">Save activity <Plus size={16} /></button></form>{message && <p className="form-message" role="status">{message}</p>}<div className="activity-safety"><ShieldCheck size={17} /><span>Only flexible activities are included. Essential loads stay under your control.</span></div>{activities.length > 0 && <div className="saved-activities"><span className="section-label">SAVED IN THIS DEMO</span>{activities.map((activity) => <article className="saved-activity" key={activity.id}><div className="activity-icon amber"><Clock3 size={18} /></div><div><strong>{activity.name}</strong><small>{activity.type} · {activity.window} · {activity.duration}h{activity.interruptible ? " · pauseable" : " · continuous"}</small></div></article>)}</div>}</section></main>;
}
