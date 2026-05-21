"use client";

import { useEffect } from "react";

/**
 * Registers `/sw.js` once per tab for offline toolbox pilot (no update prompts).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const isLocal =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (isLocal && process.env.NODE_ENV === "development") {
      return;
    }
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* non-fatal */
    });
  }, []);
  return null;
}
