"use client";

import { useEffect, useState } from "react";

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

async function translate(text: string, language: string) {
  const key = `${language}:${text}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const running = pending.get(key);
  if (running) return running;
  const request = fetch("/api/sarvam/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, targetLanguageCode: language }),
  }).then(async response => {
    const body = await response.json();
    if (!response.ok || typeof body.text !== "string") throw new Error("Translation unavailable.");
    cache.set(key, body.text);
    return body.text;
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

function isReadableNative(text: string, language: string) {
  const nativeRanges: Record<string, RegExp> = {
    "gu-IN": /[\u0A80-\u0AFF]/g, "hi-IN": /[\u0900-\u097F]/g, "mr-IN": /[\u0900-\u097F]/g,
    "ta-IN": /[\u0B80-\u0BFF]/g, "te-IN": /[\u0C00-\u0C7F]/g, "bn-IN": /[\u0980-\u09FF]/g,
  };
  const nativeCount = (text.match(nativeRanges[language] ?? /$^/g) ?? []).length;
  const latinCount = (text.match(/[A-Za-z]/g) ?? []).length;
  return nativeCount >= 3 && latinCount <= nativeCount * 0.25;
}

/** Keeps the English meaning visible and adds the selected language when space allows. */
export function BilingualText({ text, className }: { text: string; className?: string }) {
  const [language, setLanguage] = useState("en-IN");
  const [nativeText, setNativeText] = useState("");
  useEffect(() => {
    const saved = window.localStorage.getItem("vidyut_language");
    if (saved) queueMicrotask(() => setLanguage(saved));
    fetch("/api/profile").then(async response => response.ok ? response.json() : null).then(body => {
      const selected = body?.profile?.preferred_language;
      if (selected) { setLanguage(selected); window.localStorage.setItem("vidyut_language", selected); }
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (language === "en-IN") { queueMicrotask(() => setNativeText("")); return; }
    let active = true;
    translate(text, language).then(value => { if (active) setNativeText(isReadableNative(value, language) ? value : ""); }).catch(() => { if (active) setNativeText(""); });
    return () => { active = false; };
  }, [language, text]);
  return <span className={className}>{text}{nativeText && <><br /><span className="bilingual-native">{nativeText}</span></>}</span>;
}
