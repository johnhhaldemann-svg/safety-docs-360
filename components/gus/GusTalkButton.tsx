"use client";

import { Mic } from "lucide-react";
import { useGusRealtimeVoice } from "@/components/gus/useGusRealtimeVoice";

export function GusTalkButton() {
  const realtime = useGusRealtimeVoice();

  if (!realtime.enabled) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={realtime.startTalkSession}
      disabled={realtime.status !== "idle"}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)] disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Talk to Gus"
      title="Talk to Gus"
    >
      <Mic className="h-4 w-4" aria-hidden="true" />
      Talk to Gus
    </button>
  );
}
