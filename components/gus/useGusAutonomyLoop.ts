"use client";

import { useEffect, useRef, useState } from "react";
import {
  gusAutonomyTiming,
  gusFeatureFlags,
  gusStorageKeys,
} from "@/components/gus/gusConfig";
import { evaluateGusAutonomyLoop } from "@/lib/gus/gusAutonomyLoop";
import type { GusContext } from "@/lib/gus/gusContext";
import type {
  GusAutonomyStatus,
  GusCoachDirective,
  GusCoachLoopState,
  GusDecision,
} from "@/lib/gus/gusTypes";

function readStorageValue(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Autonomy memory is a local convenience only.
  }
}

function isTextEntryElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

function hasOpenModal() {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.querySelector(
      [
        '[aria-modal="true"]',
        '[role="dialog"]',
        '[data-modal-open="true"]',
        '[data-state="open"][role="dialog"]',
        ".modal",
      ].join(","),
    ),
  );
}

function micAvailable() {
  if (typeof window === "undefined") return false;
  const candidate = window as Window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(candidate.SpeechRecognition || candidate.webkitSpeechRecognition);
}

function defaultStatus(): GusAutonomyStatus {
  return {
    statusId: "gus-autonomy-status-initial",
    state: "monitoring",
    label: "Monitoring active work",
    detail: "Gus is checking context and waiting for the next coaching cue.",
    voiceAvailable: false,
    micAvailable: false,
    contextAvailable: false,
    memoryAvailable: true,
    conversationAvailable: true,
    aiEngineAvailable: false,
    lastCheckedAt: new Date(0).toISOString(),
  };
}

type UseGusAutonomyLoopOptions = {
  context: GusContext;
  decision: GusDecision;
  coachDirective: GusCoachDirective;
  coachLoopState: GusCoachLoopState;
  isVisible: boolean;
  open: boolean;
  voiceEnabled: boolean;
  onOpen: () => void;
};

export function useGusAutonomyLoop({
  context,
  decision,
  coachDirective,
  coachLoopState,
  isVisible,
  open,
  voiceEnabled,
  onOpen,
}: UseGusAutonomyLoopOptions) {
  const typingUntilRef = useRef(0);
  const latestOptionsRef = useRef<UseGusAutonomyLoopOptions>({
    context,
    decision,
    coachDirective,
    coachLoopState,
    isVisible,
    open,
    voiceEnabled,
    onOpen,
  });
  const [status, setStatus] = useState<GusAutonomyStatus>(defaultStatus);

  useEffect(() => {
    latestOptionsRef.current = {
      context,
      decision,
      coachDirective,
      coachLoopState,
      isVisible,
      open,
      voiceEnabled,
      onOpen,
    };
  });

  useEffect(() => {
    function noteTyping(event: Event) {
      if (!isTextEntryElement(event.target)) return;
      typingUntilRef.current = Date.now() + 2_500;
    }

    document.addEventListener("focusin", noteTyping);
    document.addEventListener("keydown", noteTyping);
    document.addEventListener("input", noteTyping);

    return () => {
      document.removeEventListener("focusin", noteTyping);
      document.removeEventListener("keydown", noteTyping);
      document.removeEventListener("input", noteTyping);
    };
  }, []);

  useEffect(() => {
    if (!gusFeatureFlags.gusAutonomyLoopEnabled) return undefined;

    function runCheck() {
      const latest = latestOptionsRef.current;
      const lastUnresolvedPriority = readStorageValue(gusStorageKeys.lastUnresolvedPriority);
      const result = evaluateGusAutonomyLoop({
        context: latest.context,
        decision: latest.decision,
        coachDirective: latest.coachDirective,
        coachLoopState: latest.coachLoopState,
        isVisible: latest.isVisible,
        isOpen: latest.open,
        isUserTyping: Date.now() < typingUntilRef.current,
        hasOpenModal: hasOpenModal(),
        voiceAvailable: latest.voiceEnabled,
        micAvailable: micAvailable(),
        memoryAvailable: true,
        conversationAvailable: true,
        lastUnresolvedPriority,
      });

      setStatus(result.status);
      writeStorageValue(gusStorageKeys.autonomyState, JSON.stringify(result));
      writeStorageValue(gusStorageKeys.lastAutonomyCheckAt, result.status.lastCheckedAt);
      if (latest.coachDirective.priority === "critical" || latest.coachDirective.priority === "high") {
        writeStorageValue(gusStorageKeys.lastUnresolvedPriority, latest.coachDirective.priority);
      }

      if (result.shouldOpen) {
        latest.onOpen();
      }
    }

    runCheck();
    const interval = window.setInterval(runCheck, gusAutonomyTiming.checkIntervalMs);
    return () => window.clearInterval(interval);
  }, []);

  return {
    enabled: gusFeatureFlags.gusAutonomyLoopEnabled,
    status,
  };
}
