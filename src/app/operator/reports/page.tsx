import Link from "next/link";
import { OperatorInsights } from "@/components/operator-insights";
export default function ReportsPage() { return <main className="shell"><div className="container" style={{ paddingTop: 48 }}><Link className="muted" href="/operator/overview">← Overview</Link><div className="eyebrow" style={{ marginTop: 32 }}>Event report</div><h1>Recommended → accepted → verified.</h1><OperatorInsights kind="reports"/></div></main>; }
