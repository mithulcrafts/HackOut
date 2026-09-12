"use client";
import { Mic } from "lucide-react";
export function VoiceInput({ onText }: { onText: (text: string) => void }) {
  function start() {
    const Speech = (window as Window & { webkitSpeechRecognition?: new () => { lang: string; onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; start: () => void } }).webkitSpeechRecognition;
    if (!Speech) return;
    const recognition = new Speech(); recognition.lang = "hi-IN"; recognition.onresult = event => onText(event.results[0][0].transcript); recognition.start();
  }
  return <button type="button" className="icon-button" onClick={start} aria-label="Speak activity name" title="Speak activity name"><Mic size={16} /></button>;
}
