import { ArrowRight, BatteryCharging, CircleGauge, Leaf, ShieldCheck, Sparkles, Zap } from "lucide-react";

const activities = [
  { label: "EV charging", detail: "Ready by 5:00 PM", icon: BatteryCharging, tone: "amber" },
  { label: "Water heating", detail: "Flexible until 7:00 PM", icon: Zap, tone: "blue" },
];

export default function Home() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="eyebrow"><Leaf size={15} /> VidyutSutra <span>• SIMULATED DEMO</span></div>
        <div className="hero-copy"><p className="kicker">Your energy, better timed.</p><h1>Use electricity when renewables are ready.</h1><p className="hero-description">Shift flexible activities into cleaner windows, keep your deadline and earn verified points.</p></div>
        <div className="pulse-card"><div className="pulse-ring"><CircleGauge size={30} /><strong>72%</strong><small>renewable</small></div><div><span className="status-pill absorb">ABSORB MODE</span><h2>Good time to use energy</h2><p>Solar availability is rising until 3:00 PM.</p></div></div>
      </section>
      <section className="content-section">
        <div className="section-heading"><div><span className="section-label">TODAY</span><h2>Your flexible activities</h2></div><button className="icon-button" aria-label="Add activity"><Sparkles size={18} /></button></div>
        <div className="activity-list">{activities.map(({ label, detail, icon: Icon, tone }) => <article className="activity-card" key={label}><div className={`activity-icon ${tone}`}><Icon size={20} /></div><div className="activity-copy"><strong>{label}</strong><span>{detail}</span></div><ArrowRight className="muted-icon" size={18} /></article>)}</div>
        <article className="offer-card"><div className="offer-mark"><Zap size={20} /></div><div className="offer-copy"><span className="section-label">RECOMMENDED WINDOW</span><h3>Move EV charging to 1:00–3:00 PM</h3><p>Finish before your deadline and earn <strong>+120 points</strong>.</p></div><a className="primary-button" href="/login">Review offer <ArrowRight size={16} /></a></article>
      </section>
      <section className="trust-strip"><ShieldCheck size={18} /><span>Rewards unlock after a simulated meter reading verifies your activity.</span></section>
      <nav className="bottom-nav" aria-label="Primary navigation"><a className="active" href="#today"><CircleGauge size={19} /><span>Today</span></a><a href="/consumer/activities"><Zap size={19} /><span>Activities</span></a><a href="/login"><Sparkles size={19} /><span>Rewards</span></a></nav>
    </main>
  );
}
