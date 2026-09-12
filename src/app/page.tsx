import Link from "next/link";
import { ArrowRight, BatteryCharging, CircleGauge, Leaf, ShieldCheck, Sparkles, Zap } from "lucide-react";

const activities = [
  { label: "EV charging", detail: "Ready by 5:00 PM", icon: BatteryCharging, tone: "amber" },
  { label: "Water heating", detail: "Flexible until 7:00 PM", icon: Zap, tone: "blue" },
];

export default function Home() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="eyebrow"><Leaf size={15} /> VidyutSutra <span>• RENEWABLE FLEXIBILITY</span></div>
        <div className="hero-copy"><p className="kicker">Your energy, better timed.</p><h1>Use electricity at a better time.</h1><p className="hero-description">Tell us what must be ready and by when. We find a renewable-aligned window, protect your deadline and reward verified participation.</p></div>
        <div className="offer-actions"><Link className="primary-button" href="/login">Get started <ArrowRight size={16} /></Link><Link className="text-link" href="#how-it-works">Learn how it works</Link></div>
        <div className="pulse-card"><div className="pulse-ring"><CircleGauge size={30} /><strong>48</strong><small>half-hour slots</small></div><div><span className="status-pill absorb">RENEWABLE FLEXIBILITY</span><h2>Your deadline stays in control</h2><p>Solar and wind estimates help us find a useful window. You can accept, change, skip or override.</p></div></div>
      </section>
      <section className="content-section">
        <div className="section-heading"><div><span className="section-label">TODAY</span><h2>Your flexible activities</h2></div><Link className="icon-button" aria-label="Add activity" href="/consumer/activities"><Sparkles size={18} /></Link></div>
        <div className="activity-list">{activities.map(({ label, detail, icon: Icon, tone }) => <article className="activity-card" key={label}><div className={`activity-icon ${tone}`}><Icon size={20} /></div><div className="activity-copy"><strong>{label}</strong><span>{detail}</span></div><ArrowRight className="muted-icon" size={18} /></article>)}</div>
        <article className="offer-card" id="how-it-works"><div className="offer-mark"><Zap size={20} /></div><div className="offer-copy"><span className="section-label">HOW IT WORKS</span><h3>Plan → accept → verify → reward</h3><p>Move an existing flexible task into a useful window. Points and illustrative rewards unlock after the meter evidence passes verification.</p></div><Link className="primary-button" href="/login">Review an offer <ArrowRight size={16} /></Link></article>
      </section>
      <section className="trust-strip"><ShieldCheck size={18} /><span>Rewards unlock after a meter reading verifies your activity.</span></section>
      <nav className="bottom-nav" aria-label="Primary navigation"><a className="active" href="#today"><CircleGauge size={19} /><span>Today</span></a><Link href="/consumer/activities"><Zap size={19} /><span>Activities</span></Link><Link href="/consumer/rewards"><Sparkles size={19} /><span>Rewards</span></Link></nav>
    </main>
  );
}
