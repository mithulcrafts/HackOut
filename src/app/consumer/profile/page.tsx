"use client";

import { FormEvent, useEffect, useState } from "react";
import { ChevronLeft, LoaderCircle, LogOut, MapPin, Save, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConsumerNav } from "@/components/consumer-nav";
import { createClient } from "@/lib/supabase/client";
import { actionLabel, bilingual, getConsumerCopy } from "@/lib/language";
import { BilingualText } from "@/components/bilingual-text";

type ReminderChannel = "in_app" | "email_sms" | "important_only" | "none";
type ReminderFrequency = "all" | "important" | "quiet_hours";

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [userType, setUserType] = useState("household");
  const [preferredLanguage, setPreferredLanguage] = useState("en-IN");
  const [reminderChannel, setReminderChannel] = useState<ReminderChannel>("in_app");
  const [reminderFrequency, setReminderFrequency] = useState<ReminderFrequency>("all");
  const [rewardProgramOptIn, setRewardProgramOptIn] = useState(true);
  const [programmeName, setProgrammeName] = useState("Demo renewable flexibility programme");
  const [siteName, setSiteName] = useState("Gandhinagar participant site");
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(false);
  const [leaderboardAlias, setLeaderboardAlias] = useState("Participant");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const labels = getConsumerCopy(preferredLanguage);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const profile = body.profile;
      setEmail(body.email ?? ""); setName(profile.display_name ?? ""); setLocation(profile.location ?? "");
      setUserType(profile.user_type ?? "household"); setPreferredLanguage(profile.preferred_language ?? "en-IN");
      setReminderChannel(profile.reminder_channel ?? "in_app"); setReminderFrequency(profile.reminder_frequency ?? "all");
      setRewardProgramOptIn(profile.reward_program_opt_in ?? true); setProgrammeName(profile.programme_name ?? "Demo renewable flexibility programme");
      setSiteName(profile.site_name ?? "Gandhinagar participant site"); setLeaderboardOptIn(Boolean(profile.leaderboard_opt_in)); setLeaderboardAlias(profile.leaderboard_alias ?? "Participant");
      localStorage.setItem("vidyut_language", profile.preferred_language ?? "en-IN");
    }).catch(error => setStatus(error instanceof Error ? error.message : "Unable to load profile."));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name, location, userType, preferredLanguage, deviceStatus: "simulation", reminderChannel, reminderFrequency, rewardProgramOptIn, programmeName, siteName, leaderboardOptIn, leaderboardAlias }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      localStorage.setItem("vidyut_language", preferredLanguage); setStatus(labels.languageSaved);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to save profile."); }
    finally { setBusy(false); }
  }

  async function signOut() { await createClient().auth.signOut(); router.push("/login"); }

  return <main className="app-shell">
    <section className="hero-panel"><Link className="back-link" href="/consumer/today"><ChevronLeft size={17} /> Today</Link><div className="hero-copy"><p className="kicker">PROFILE &amp; ONBOARDING</p><h1><BilingualText text="Your participation settings." /></h1><p className="hero-description"><BilingualText text="Tell us what you are comfortable shifting. You can change these choices any time." /></p></div></section>
    <section className="content-section"><form className="schedule-card profile-form" onSubmit={save}>
      <div className="profile-row"><MapPin size={18} /><div><strong>Account</strong><small>{email || "Loading email..."}</small></div></div>
      <h2>About you</h2>
      <label>What should we call you?<input value={name} onChange={event => setName(event.target.value)} placeholder="Your name" maxLength={80} /></label>
      <label>City or programme area<input value={location} onChange={event => setLocation(event.target.value)} placeholder="Gandhinagar, Gujarat" maxLength={80} /><small>Approximate area is enough; precise location is never required.</small></label>
      <label>How will you use VidyutSutra?<select value={userType} onChange={event => setUserType(event.target.value)}><option value="household">Household or individual</option><option value="EV owner">EV owner</option><option value="business">Business or industry</option><option value="campus">Campus or building</option></select></label>
      <h2>Programme connection</h2>
      <label>Programme name<input value={programmeName} onChange={event => setProgrammeName(event.target.value)} maxLength={100} /></label>
      <label>Site or building<input value={siteName} onChange={event => setSiteName(event.target.value)} maxLength={100} /></label>
      <p className="muted">This browser uses a repeatable scenario with simulated readings and illustrative rewards. A utility connection can replace these values later.</p>
      <h2>Reminders and rewards</h2>
      <label>How should we remind you?<select value={reminderChannel} onChange={event => setReminderChannel(event.target.value as ReminderChannel)}><option value="in_app">In-app notifications</option><option value="email_sms">Email or SMS (when connected)</option><option value="important_only">Important reminders only</option><option value="none">No non-essential notifications</option></select></label>
      <label>Reminder frequency<select value={reminderFrequency} onChange={event => setReminderFrequency(event.target.value as ReminderFrequency)}><option value="all">Offers and activity updates</option><option value="important">Only starting windows and deadlines</option><option value="quiet_hours">Quiet hours outside 08:00–20:00 IST</option></select></label>
      <label className="toggle-row"><span><strong>Join reward-based events</strong><small>Participation is always voluntary. Skipping an offer never reduces points.</small></span><input type="checkbox" checked={rewardProgramOptIn} onChange={event => setRewardProgramOptIn(event.target.checked)} /></label>
      <label className="toggle-row"><span><strong>Join the optional participation board</strong><small>Only your alias and verified reliability are shown.</small></span><input type="checkbox" checked={leaderboardOptIn} onChange={event => setLeaderboardOptIn(event.target.checked)} /></label>
      <label>Leaderboard alias<input maxLength={30} value={leaderboardAlias} onChange={event => setLeaderboardAlias(event.target.value)} /></label>
      <div className="profile-row"><ShieldCheck size={18} /><div><strong>Device status: Simulated</strong><small>Manual reminders and playback are active; no equipment is controlled.</small></div></div>
      <button className="primary-button" disabled={busy}>{busy && <LoaderCircle size={15} className="spin" />}<Save size={15} /> {busy ? bilingual(preferredLanguage, "saving", "Saving...") : bilingual(preferredLanguage, "save", "Save settings")}</button>
      {status && <p className="form-message" role="status">{status}</p>}
      <Link className="secondary-button" href="/consumer/onboarding">Review onboarding choices</Link>
      <button type="button" className="secondary-button" onClick={signOut}><LogOut size={15} />{actionLabel(preferredLanguage, "Sign out")}</button>
    </form></section><ConsumerNav active="profile" />
  </main>;
}
