import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ConsumerNav } from "@/components/consumer-nav";
import { EvidenceUpload } from "@/components/evidence-upload";

export default function EvidencePage() {
  return <main className="app-shell"><section className="hero-panel"><Link className="back-link" href="/consumer/today"><ChevronLeft size={17} /> Today</Link><div className="hero-copy"><p className="kicker">EVIDENCE REVIEW</p><h1>Show what happened.</h1><p className="hero-description">Review a meter or charger export against your accepted renewable-aligned window.</p></div></section><section className="content-section"><EvidenceUpload /></section><ConsumerNav active="today" /></main>;
}
