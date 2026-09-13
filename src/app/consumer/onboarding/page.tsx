"use client";

import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, BatteryCharging, Building2, Check, Home, LoaderCircle, UsersRound, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const accountTypes = [
  { value: "household", title: "Household or individual", detail: "Manage appliances and everyday flexible tasks.", icon: Home },
  { value: "EV owner", title: "EV owner", detail: "Plan charging around your next departure.", icon: BatteryCharging },
  { value: "business", title: "Business or industry", detail: "Coordinate approved processes and equipment.", icon: Building2 },
  { value: "campus", title: "Campus or building", detail: "Coordinate flexible loads across a shared site.", icon: UsersRound },
  { value: "programme operator", title: "Programme operator", detail: "Monitor events, flexibility and verified response.", icon: Zap },
  { value: "grid operator", title: "Grid operator", detail: "Review supply conditions and grid actions.", icon: Zap },
  { value: "utility company", title: "Utility company", detail: "Coordinate demand-response programmes.", icon: Building2 },
  { value: "renewable plant owner", title: "Renewable plant owner", detail: "Plan renewable output and flexibility.", icon: Zap },
  { value: "energy trader", title: "Energy trader", detail: "Monitor forecast risk and market exposure.", icon: Zap },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState<string>("EV owner");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("Gandhinagar, Gujarat");
  const [programmeName, setProgrammeName] = useState("Demo renewable flexibility programme");
  const [siteName, setSiteName] = useState("Gandhinagar participant site");
  const [reminderChannel, setReminderChannel] = useState("in_app");
  const [reminderFrequency, setReminderFrequency] = useState("all");
  const [rewardProgramOptIn, setRewardProgramOptIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function next(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (["programme operator", "grid operator", "utility company", "renewable plant owner", "energy trader"].includes(userType)) {
      router.push("/operator/overview?demo=1");
      return;
    }
    setStep(value => Math.min(3, value + 1));
  }
  async function finish(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name || "Energy Participant", location, userType, preferredLanguage: "en-IN", deviceStatus: "simulation", reminderChannel, reminderFrequency, rewardProgramOptIn, programmeName, siteName, leaderboardOptIn: false, leaderboardAlias: "Participant" }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to save setup.");
      router.push("/consumer/today");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save setup."); }
    finally { setBusy(false); }
  }

  return <main className="auth-shell onboarding-shell">
    <Link className="back-link" href="/consumer/today"><ArrowLeft size={17} /> Back</Link>
    <section className="auth-card onboarding-card">
      <div className="auth-brand"><Zap size={19} /> VidyutSutra</div>
      <div className="step-indicator" aria-label={`Setup step ${step} of 3`}>{[1, 2, 3].map(value => <span className={value <= step ? "active" : ""} key={value}>{value < step ? <Check size={13} /> : value}</span>)}</div>
      {step === 1 && <form onSubmit={next} className="onboarding-step"><span className="section-label">STEP 1 OF 3</span><h1>How will you use the app?</h1><p>We use this to show the right activity questions. You can change it later.</p><div className="choice-grid">{accountTypes.map(({ value, title, detail, icon: Icon }) => <button type="button" key={value} className={`choice-card ${userType === value ? "selected" : ""}`} onClick={() => setUserType(value)}><Icon size={21} /><strong>{title}</strong><small>{detail}</small></button>)}</div><button className="primary-button" type="submit">Continue <ArrowRight size={16} /></button></form>}
      {step === 2 && <form onSubmit={next} className="onboarding-step"><span className="section-label">STEP 2 OF 3</span><h1>Make it personal.</h1><p>Only an approximate area is needed to match renewable timing.</p><label>What should we call you?<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Your name" maxLength={80} /></label><label>City or programme area<input required value={location} onChange={event => setLocation(event.target.value)} maxLength={80} /></label><div className="offer-actions"><button className="secondary-button" type="button" onClick={() => setStep(1)}>Back</button><button className="primary-button" type="submit">Continue <ArrowRight size={16} /></button></div></form>}
      {step === 3 && <form onSubmit={finish} className="onboarding-step"><span className="section-label">STEP 3 OF 3</span><h1>Choose your participation.</h1><p>Offers are voluntary. We reward verified flexibility and never punish a skipped offer.</p><label>Programme name<input value={programmeName} onChange={event => setProgrammeName(event.target.value)} maxLength={100} /></label><label>Site or building<input value={siteName} onChange={event => setSiteName(event.target.value)} maxLength={100} /></label><label>Reminder preference<select value={reminderChannel} onChange={event => setReminderChannel(event.target.value)}><option value="in_app">In-app notifications</option><option value="email_sms">Email or SMS (when connected)</option><option value="important_only">Important reminders only</option><option value="none">No non-essential notifications</option></select></label><label>How often?<select value={reminderFrequency} onChange={event => setReminderFrequency(event.target.value)}><option value="all">Offers and activity updates</option><option value="important">Starting windows and deadlines</option><option value="quiet_hours">Quiet hours outside 08:00–20:00 IST</option></select></label><label className="toggle-row"><span><strong>Join reward-based events</strong><small>You can change this at any time.</small></span><input type="checkbox" checked={rewardProgramOptIn} onChange={event => setRewardProgramOptIn(event.target.checked)} /></label><div className="offer-actions"><button className="secondary-button" type="button" onClick={() => setStep(2)}>Back</button><button className="primary-button" type="submit" disabled={busy}>{busy && <LoaderCircle size={16} className="spin" />} {busy ? "Saving…" : "Open my energy plan"}</button></div>{message && <p className="form-message" role="alert">{message}</p>}</form>}
      <p className="onboarding-footnote">You can add activities such as EV charging, water heating, appliances, pumps, cooling and approved industrial processes after setup.</p>
      {step === 1 && <p className="onboarding-footnote"><Link className="text-link" href="/operator/overview?demo=1">Already manage a programme? Open the operator workspace.</Link></p>}
    </section>
  </main>;
}



