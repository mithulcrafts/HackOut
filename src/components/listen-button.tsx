"use client";
import { Volume2 } from "lucide-react";
import { useState } from "react";
export function ListenButton({ text, language = "en-IN" }: { text: string; language?: string }) {
  const [busy, setBusy] = useState(false);
  async function listen() {
    const selectedLanguage = typeof window !== "undefined" ? window.localStorage.getItem("vidyut_language") || language : language;
    if (busy || !text.trim()) return; setBusy(true);
    try {
      const response = await fetch("/api/sarvam/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, targetLanguageCode: selectedLanguage }) });
      const body = await response.json();
      if (!response.ok) throw Object.assign(new Error(body.error), { translatedText: body.text, speechLanguage: body.languageCode });
      const audio = new Audio(`data:${body.mimeType};base64,${body.audio}`);
      await audio.play();
    } catch (error) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        let spokenText = text;
        const translated = error instanceof Error && "translatedText" in error ? (error as Error & { translatedText?: string }).translatedText : undefined;
        const speechLanguage = error instanceof Error && "speechLanguage" in error ? (error as Error & { speechLanguage?: string }).speechLanguage : selectedLanguage;
        if (translated) spokenText = translated;
        else if (selectedLanguage !== "en-IN") {
          try {
            const response = await fetch("/api/sarvam/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, targetLanguageCode: selectedLanguage }) });
            const body = await response.json();
            if (response.ok && body.text) spokenText = body.text;
          } catch { /* Browser speech remains the final graceful fallback. */ }
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(spokenText);
        utterance.lang = speechLanguage || selectedLanguage;
        window.speechSynthesis.speak(utterance);
      }
    }
    finally { setBusy(false); }
  }
  return <button type="button" className="icon-button" aria-label="Listen to this information" title="Listen" onClick={listen} disabled={busy}><Volume2 size={16} /></button>;
}
