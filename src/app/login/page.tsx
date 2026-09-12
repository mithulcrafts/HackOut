"use client";

import { FormEvent, useState } from "react";
import { ArrowLeft, Leaf, LoaderCircle, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase = createClient();
      const result = mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (result.error) throw result.error;
      setMessage(mode === "sign-in" ? "Signed in. Your consumer dashboard is ready." : "Account created.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to complete authentication."); }
    finally { setBusy(false); }
  }

  return <main className="auth-shell"><Link className="back-link" href="/"><ArrowLeft size={17} /> Back to home</Link><section className="auth-card"><div className="auth-brand"><Leaf size={19} /> VidyutSutra</div><span className="section-label">CONSUMER ACCESS</span><h1>{mode === "sign-in" ? "Welcome back." : "Join the energy shift."}</h1><p>Save your flexible activities and receive renewable-aligned offers.</p><form onSubmit={submit}><label>Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label><label>Password<input required minLength={6} type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" /></label><button className="primary-button auth-submit" disabled={busy}>{busy && <LoaderCircle size={16} className="spin" />}{mode === "sign-in" ? "Sign in" : "Create account"}</button></form>{message && <p className="auth-message" role="status">{message}</p>}<button className="switch-button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setMessage(""); }}>{mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}</button><Link className="demo-link" href="/consumer/today"><LockKeyhole size={15} /> Try the simulated demo</Link></section></main>;
}
