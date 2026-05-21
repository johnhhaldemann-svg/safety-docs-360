"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OfflineBrowserSessionPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Ready to start demo session.");

  async function startSession() {
    setStatus("Starting demo session...");
    const response = await fetch("/api/offline/session", { method: "POST" });
    if (!response.ok) {
      setStatus("Demo session failed.");
      return;
    }
    setStatus("Demo session ready.");
    router.push("/dashboard");
  }

  return (
    <main style={{ display: "grid", minHeight: "100vh", placeItems: "center", fontFamily: "Arial, sans-serif" }}>
      <section style={{ width: 420, border: "1px solid #d8e1ec", borderRadius: 16, padding: 28, background: "white" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>SafetyDocs360 Demo</h1>
        <p style={{ margin: "0 0 20px", color: "#475569" }}>{status}</p>
        <button
          type="button"
          onClick={startSession}
          style={{
            border: 0,
            borderRadius: 10,
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
            fontWeight: 700,
            padding: "12px 16px",
            width: "100%",
          }}
        >
          Start Demo Session
        </button>
      </section>
    </main>
  );
}
