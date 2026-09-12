import Link from "next/link";
import { OperatorInsights } from "@/components/operator-insights";
export default function RewardsPage() { return <main className="shell"><div className="container" style={{ paddingTop: 48 }}><Link className="muted" href="/operator/overview">← Overview</Link><div className="eyebrow" style={{ marginTop: 32 }}>Rewards / reports</div><h1>Illustrative programme budget.</h1><OperatorInsights kind="rewards"/></div></main>; }
