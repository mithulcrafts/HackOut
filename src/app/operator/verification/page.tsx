import Link from "next/link";
import { OperatorInsights } from "@/components/operator-insights";
export default function VerificationPage() { return <main className="shell"><div className="container" style={{ paddingTop: 48 }}><Link className="muted" href="/operator/overview">← Overview</Link><div className="eyebrow" style={{ marginTop: 32 }}>Verification queue</div><h1>Evidence before reward.</h1><OperatorInsights kind="verification"/></div></main>; }
