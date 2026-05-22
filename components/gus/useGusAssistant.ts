"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  gusPopupTiming,
  gusRouteMatches,
  gusStorageKeys,
  isGusAllowedRoute,
  isGusDisabledRoute,
} from "@/components/gus/gusConfig";
import { gusFallbackMessage, gusRouteMessages } from "@/components/gus/gusMessages";
import { decideGusBehavior } from "@/lib/gus/gusBrain";
import type { GusContext } from "@/lib/gus/gusContext";
import type { GusMessage, GusMessageCategory } from "@/lib/gus/gusTypes";

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
    // Storage can be blocked in private modes; Gus should fail quietly.
  }
}

function readStorageTimeMs(key: string) {
  const value = readStorageValue(key);
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDisabledUntilMs() {
  return readStorageTimeMs(gusStorageKeys.disabledUntil);
}

function endOfTodayIso() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

function randomDelayMs() {
  const range = gusPopupTiming.maxDelayMs - gusPopupTiming.minDelayMs;
  return gusPopupTiming.minDelayMs + Math.round(Math.random() * range);
}

function findRouteMessage(pathname: string, lastMessageId: string | null) {
  const routeMessages = gusRouteMessages
    .filter((entry) => gusRouteMatches(pathname, entry.route))
    .map((entry) => entry.message);
  const candidates = [...routeMessages, gusFallbackMessage];

  return candidates.find((candidate) => candidate.messageId !== lastMessageId) ?? candidates[0];
}

function isTextEntryElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
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

function isHighPriorityWarning(message: GusMessage) {
  return (
    message.priority <= 1 ||
    message.category === "warning" ||
    message.category === "permit_alert" ||
    message.category === "risk_alert" ||
    message.category === "training_alert"
  );
}

function isRandomTimedCategory(category: GusMessageCategory) {
  return (
    category === "compliment" ||
    category === "safety_tip" ||
    category === "document_tip" ||
    category === "reminder" ||
    category === "greeting" ||
    category === "learning" ||
    category === "planning" ||
    category === "voice"
  );
}

function initialSuppressed() {
  return Date.now() < getDisabledUntilMs();
}

function initialQuietMode() {
  return readStorageValue(gusStorageKeys.quietMode) === "true";
}

function initialVoiceEnabled() {
  return readStorageValue(gusStorageKeys.voiceEnabled) === "true";
}

type UseGusAssistantOptions = {
  currentPage?: string;
  route?: string;
  companyId?: string | null;
  jobsiteId?: string | null;
  userId?: string | null;
  liveContext?: Partial<GusContext>;
};

export function useGusAssistant(options: UseGusAssistantOptions = {}) {
  const appPathname = usePathname();
  const {
    companyId,
    currentPage: optionCurrentPage,
    jobsiteId,
    liveContext,
    route,
    userId,
  } = options;
  const pathname = route ?? appPathname;
  const currentPage = optionCurrentPage?.trim() || "Current page";
  const typingUntilRef = useRef(0);
  const popupsThisSessionRef = useRef(0);
  const popupTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [disabledToday, setDisabledToday] = useState(initialSuppressed);
  const [quietMode] = useState(initialQuietMode);
  const [voiceEnabled] = useState(initialVoiceEnabled);
  const [feedback, setFeedback] = useState<"helpful" | "not_helpful" | null>(null);
  const [activeMessage, setActiveMessage] = useState<GusMessage | null>(null);
  const isAllowed = isGusAllowedRoute(pathname) && !isGusDisabledRoute(pathname);
  const isVisible = isAllowed && !disabledToday && !dismissed && !quietMode;
  const candidateMessage = findRouteMessage(pathname, readStorageValue(gusStorageKeys.lastMessageId));
  const context: GusContext = {
    companyId: companyId ?? undefined,
    jobsiteId: jobsiteId ?? undefined,
    userId: userId ?? undefined,
    ...liveContext,
    currentPage,
    route: pathname,
  };
  const smartDecision = decideGusBehavior({
    context,
    routeMessage: candidateMessage,
    feedback,
    quietMode,
  });
  const message = activeMessage ?? smartDecision.message;
  const decision = activeMessage
    ? {
        ...smartDecision,
        message,
      }
    : smartDecision;
  const warningShouldOpenImmediately = isHighPriorityWarning(message);

  const rememberShownMessage = useCallback((shownMessage: GusMessage) => {
    const now = new Date().toISOString();
    writeStorageValue(gusStorageKeys.lastShownAt, now);
    writeStorageValue(gusStorageKeys.lastMessageId, shownMessage.messageId);
  }, []);

  const canAutoOpen = useCallback(
    (candidate: GusMessage, allowTypingOverride: boolean) => {
      const now = Date.now();
      const lastShownAt = readStorageTimeMs(gusStorageKeys.lastShownAt);
      const lastDismissedAt = readStorageTimeMs(gusStorageKeys.lastDismissedAt);
      const lastShownMessageId = readStorageValue(gusStorageKeys.lastMessageId);

      if (!isVisible || open) return false;
      if (popupsThisSessionRef.current >= gusPopupTiming.maxPopupsPerSession) return false;
      if (lastShownMessageId === candidate.messageId) return false;
      if (lastShownAt && now - lastShownAt < gusPopupTiming.globalCooldownMs) return false;
      if (lastDismissedAt && now - lastDismissedAt < gusPopupTiming.dismissedCooldownMs) return false;
      if (!allowTypingOverride && now < typingUntilRef.current) return false;
      if (hasOpenModal()) return false;

      return true;
    },
    [isVisible, open],
  );

  useEffect(() => {
    function noteTyping(event: Event) {
      if (!isTextEntryElement(event.target)) return;
      typingUntilRef.current = Date.now() + gusPopupTiming.activeTypingWindowMs;
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
    if (popupTimerRef.current) {
      window.clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }

    if (!isVisible || open) return undefined;

    const shouldUseRandomTiming = isRandomTimedCategory(message.category);
    if (!warningShouldOpenImmediately && !shouldUseRandomTiming) return undefined;

    const delay = warningShouldOpenImmediately ? gusPopupTiming.warningDelayMs : randomDelayMs();
    popupTimerRef.current = window.setTimeout(() => {
      const nextRouteMessage = findRouteMessage(pathname, readStorageValue(gusStorageKeys.lastMessageId));
      const nextContext: GusContext = {
        companyId: companyId ?? undefined,
        jobsiteId: jobsiteId ?? undefined,
        userId: userId ?? undefined,
        ...liveContext,
        currentPage,
        route: pathname,
      };
      const nextDecision = decideGusBehavior({
        context: nextContext,
        routeMessage: nextRouteMessage,
        feedback,
        quietMode,
      });
      const nextMessage = nextDecision.message;
      if (!canAutoOpen(nextMessage, warningShouldOpenImmediately)) return;
      setActiveMessage(nextMessage);
      rememberShownMessage(nextMessage);
      popupsThisSessionRef.current += 1;
      setOpen(true);
    }, delay);

    return () => {
      if (popupTimerRef.current) {
        window.clearTimeout(popupTimerRef.current);
        popupTimerRef.current = null;
      }
    };
  }, [
    canAutoOpen,
    companyId,
    currentPage,
    feedback,
    isVisible,
    jobsiteId,
    liveContext,
    message.category,
    open,
    pathname,
    quietMode,
    rememberShownMessage,
    userId,
    warningShouldOpenImmediately,
  ]);

  function openAssistant() {
    const nextRouteMessage = findRouteMessage(pathname, readStorageValue(gusStorageKeys.lastMessageId));
    const nextMessage = decideGusBehavior({
      context,
      routeMessage: nextRouteMessage,
      feedback,
      quietMode,
    }).message;
    setActiveMessage(nextMessage);
    rememberShownMessage(nextMessage);
    setDismissed(false);
    setOpen(true);
  }

  function minimizeAssistant() {
    setActiveMessage(null);
    setOpen(false);
  }

  function dismissAssistant() {
    writeStorageValue(gusStorageKeys.lastDismissedAt, new Date().toISOString());
    setActiveMessage(null);
    setDismissed(true);
    setOpen(false);
  }

  function disableForToday() {
    writeStorageValue(gusStorageKeys.disabledUntil, endOfTodayIso());
    setActiveMessage(null);
    setDisabledToday(true);
    setOpen(false);
  }

  function recordFeedback(value: "helpful" | "not_helpful") {
    setFeedback(value);
  }

  return {
    open,
    pathname,
    currentPage,
    companyId: companyId ?? null,
    jobsiteId: jobsiteId ?? null,
    context,
    message,
    decision,
    isVisible,
    voiceEnabled,
    feedback,
    openAssistant,
    minimizeAssistant,
    dismissAssistant,
    disableForToday,
    recordFeedback,
  };
}
