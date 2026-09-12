"use client";
import { Volume2 } from "lucide-react";
import { useState } from "react";
export function ListenButton({ text, language = "en-IN" }: { text: string; language?: string }) {
  const [busy, setBusy] = useState(false);
  async function listen() {
    if (busy || !text.trim()) return; setBusy(true);
    try { const response = await fetch("/api/sarvam/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, targetLanguageCode: language }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); const audio = new Audio(`data:${body.mimeType};base64,${body.audio}`); await audio.play(); }
    catch { if (typeof window !== "undefined" && "speechSynthesis" in window) { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = language; window.speechSynthesis.speak(utterance); } }
    finally { setBusy(false); }
  }
  return <button type="button" className="icon-button" aria-label="Listen to this information" title="Listen" onClick={listen} disabled={busy}><Volume2 size={16} /></button>;
}
