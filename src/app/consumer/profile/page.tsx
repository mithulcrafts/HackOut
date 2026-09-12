"use client";
import { ChevronLeft, LogOut, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConsumerNav } from "@/components/consumer-nav";
import { createClient } from "@/lib/supabase/client";
export default function ProfilePage(){const router=useRouter();async function signOut(){await createClient().auth.signOut();router.push("/login");}return <main className="app-shell"><section className="hero-panel"><Link className="back-link" href="/consumer/today"><ChevronLeft size={17}/> Today</Link><div className="hero-copy"><p className="kicker">PROFILE</p><h1>Your participation settings.</h1><p className="hero-description">Choose what you are comfortable shifting. You can skip any offer without penalty.</p></div></section><section className="content-section"><article className="schedule-card"><div className="profile-row"><MapPin size={18}/><div><strong>Gandhinagar, Gujarat</strong><small>Used for simulated renewable outlook</small></div></div><div className="profile-row"><ShieldCheck size={18}/><div><strong>Evidence-based rewards</strong><small>Points unlock only after a simulated reading is checked.</small></div></div><button className="secondary-button" onClick={signOut}><LogOut size={15}/> Sign out</button></article></section><ConsumerNav active="profile" /></main>}
