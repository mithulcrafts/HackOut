"use client";
import { useEffect, useState } from "react";

export function ConsumerFeedback({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  return <>{loading && <p role="status" className="notice">Loading your saved data…</p>}
    {error && <div className="notice error-notice" role="alert"><p>{error}</p><button className="secondary-button" onClick={retry}>Retry</button></div>}</>;
}
export function ConnectionBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine); update();
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return offline ? <div className="notice error-notice" role="status">You’re offline. Saved screens may be out of date. Reconnect before making changes; actions are not queued.</div> : null;
}
