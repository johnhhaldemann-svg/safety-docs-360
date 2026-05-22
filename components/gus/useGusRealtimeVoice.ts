"use client";

import { useCallback, useMemo, useState } from "react";
import { gusFeatureFlags } from "@/components/gus/gusConfig";

export type GusRealtimeVoiceStatus =
  | "disabled"
  | "idle"
  | "requesting_microphone"
  | "listening"
  | "speaking"
  | "error";

export function useGusRealtimeVoice() {
  const enabled = gusFeatureFlags.gusRealtimeVoiceEnabled;
  const [status, setStatus] = useState<GusRealtimeVoiceStatus>(enabled ? "idle" : "disabled");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startTalkSession = useCallback(async () => {
    if (!enabled) {
      setStatus("disabled");
      setErrorMessage("Talk to Gus is not enabled yet.");
      return;
    }

    setStatus("requesting_microphone");
    setErrorMessage("Talk to Gus is prepared for a future release but is not implemented yet.");
    setStatus("disabled");
  }, [enabled]);

  const stopTalkSession = useCallback(() => {
    setStatus(enabled ? "idle" : "disabled");
  }, [enabled]);

  return useMemo(
    () => ({
      enabled,
      status,
      errorMessage,
      startTalkSession,
      stopTalkSession,
    }),
    [enabled, errorMessage, startTalkSession, status, stopTalkSession],
  );
}
