import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ConsumerEvent } from "@/components/consumer-event";
import { ConsumerNav } from "@/components/consumer-nav";
export default function OffersPage(){return <main className="app-shell"><section className="hero-panel"><Link className="back-link" href="/consumer/today"><ChevronLeft size={17}/> Today</Link><div className="hero-copy"><p className="kicker">OFFERS INBOX</p><h1>Choose what fits your day.</h1><p className="hero-description">Every recommendation is optional. Skipping never reduces your points.</p></div></section><section className="content-section"><ConsumerEvent inbox/></section><ConsumerNav active="offers"/></main>}
