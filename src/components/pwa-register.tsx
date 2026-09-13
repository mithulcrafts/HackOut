"use client";

import { useEffect } from "react";

/** Registers the lightweight offline shell for browsers that support PWA APIs. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installation is an enhancement; the online application remains usable.
    });
  }, []);
  return null;
}
