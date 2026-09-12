"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function useResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setLoading(true); setError("");
    try {
      const response = await fetch(url, { signal: request.signal, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load data. Please retry.");
      if (!request.signal.aborted) setData(body);
    } catch (cause) {
      if (!request.signal.aborted) { setError(cause instanceof Error ? cause.message : "Connection failed."); setData(null); }
    } finally { if (!request.signal.aborted) setLoading(false); }
  }, [url]);
  useEffect(() => {
    // The request is deliberately started after the effect yields so the hook does not synchronously cascade renders.
    void Promise.resolve().then(refresh);
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => { controller.current?.abort(); window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus); };
  }, [refresh]);
  return { data, setData, error, loading, refresh };
}
