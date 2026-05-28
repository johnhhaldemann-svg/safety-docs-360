"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  gusPopupTiming,
  gusRouteMatches,
  gusSitrepTiming,
  gusStorageKeys,
  gusFeatureFlags,
  isGusAllowedRoute,
  isGusDisabledRoute,
} from "@/components/gus/gusConfig";
import { gusFallbackMessage, gusRouteMessages } from "@/components/gus/gusMessages";
import { useGusNotificationSettings } from "@/components/gus/useGusNotificationSettings";
import { shouldAutoOpenGusNotification } from "@/lib/gus/gusNotificationSettings";
import { decideGusBehavior } from "@/lib/gus/gusBrain";
import { createGusAutonomousMessage, getGusSocialLineId } from "@/lib/gus/gusSocialCoach";
import { buildGusSitrepMessage, buildGusSteadySitrepMessage } from "@/lib/gus/gusSitrep";
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

function readRecentSocialLineIds() {
  const raw = readStorageValue(gusStorageKeys.recentSocialLineIds);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

function rememberSocialLineId(message: GusMessage) {
  const lineId = getGusSocialLineId(message);
  const recent = readRecentSocialLineIds().filter((item) => item !== lineId);
  writeStorageValue(gusStorageKeys.recentSocialLineIds, JSON.stringify([lineId, ...recent].slice(0, 8)));
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
  const sitrepTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [disabledToday, setDisabledToday] = useState(initialSuppressed);
  const [quietMode] = useState(initialQuietMode);
  const [voiceEnabled] = useState(initialVoiceEnabled);
  const [feedback, setFeedback] = useState<"helpful" | "not_helpful" | null>(null);
  const [activeMessage, setActiveMessage] = useState<GusMessage | null>(null);
  const { settings: notificationSettings } = useGusNotificationSettings();
  const isAllowed = isGusAllowedRoute(pathname) && !isGusDisabledRoute(pathname);
  const isVisible = isAllowed && !disabledToday && !dismissed;
  const canAutoShow = isAllowed && !disabledToday && !dismissed && !quietMode;
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
    rememberSocialLineId(shownMessage);
  }, []);

  const rememberSitrepMessage = useCallback((shownMessage: GusMessage) => {
    const now = new Date().toISOString();
    writeStorageValue(gusStorageKeys.lastSitrepAt, now);
    writeStorageValue(gusStorageKeys.lastSitrepId, shownMessage.messageId);
    rememberShownMessage(shownMessage);
  }, [rememberShownMessage]);

  const canAutoOpen = useCallback(
    (candidate: GusMessage, allowTypingOverride: boolean) => {
      const now = Date.now();
      const lastShownAt = readStorageTimeMs(gusStorageKeys.lastShownAt);
      const lastDismissedAt = readStorageTimeMs(gusStorageKeys.lastDismissedAt);
      const lastShownMessageId = readStorageValue(gusStorageKeys.lastMessageId);

      if (!canAutoShow || open) return false;
      if (!shouldAutoOpenGusNotification(notificationSettings, candidate)) return false;
      if (popupsThisSessionRef.current >= gusPopupTiming.maxPopupsPerSession) return false;
      if (lastShownMessageId === candidate.messageId) return false;
      if (lastShownAt && now - lastShownAt < gusPopupTiming.globalCooldownMs) return false;
      if (lastDismissedAt && now - lastDismissedAt < gusPopupTiming.dismissedCooldownMs) return false;
      if (!allowTypingOverride && now < typingUntilRef.current) return false;
      if (hasOpenModal()) return false;

      return true;
    },
    [canAutoShow, notificationSettings, open],
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

    if (!canAutoShow || open) return undefined;

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
      const autonomousMessage = gusFeatureFlags.gusAutonomousSocialCoachEnabled
        ? createGusAutonomousMessage(
            nextDecision,
            nextContext,
            `${nextDecision.decisionId}:${pathname}:${popupsThisSessionRef.current}:${Date.now()}`,
            readRecentSocialLineIds(),
          )
        : nextMessage;
      setActiveMessage(autonomousMessage);
      rememberShownMessage(autonomousMessage);
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
    canAutoShow,
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

  useEffect(() => {
    if (sitrepTimerRef.current) {
      window.clearInterval(sitrepTimerRef.current);
      sitrepTimerRef.current = null;
    }

    if (!gusFeatureFlags.gusSitrepEnabled || !canAutoShow || open) return undefined;

    sitrepTimerRef.current = window.setInterval(() => {
      const nextContext: GusContext = {
        companyId: companyId ?? undefined,
        jobsiteId: jobsiteId ?? undefined,
        userId: userId ?? undefined,
        ...liveContext,
        currentPage,
        route: pathname,
      };
      const baseSitrepMessage = buildGusSitrepMessage(nextContext);
      if (!baseSitrepMessage) return;

      const now = Date.now();
      const lastSitrepAt = readStorageTimeMs(gusStorageKeys.lastSitrepAt);
      const lastSitrepId = readStorageValue(gusStorageKeys.lastSitrepId);
      const sitrepMessage =
        lastSitrepId === baseSitrepMessage.messageId
          ? buildGusSteadySitrepMessage(baseSitrepMessage)
          : baseSitrepMessage;
      const isCriticalSitrep = sitrepMessage.priority <= 1;

      if (lastSitrepId === sitrepMessage.messageId) return;
      if (lastSitrepAt && now - lastSitrepAt < gusSitrepTiming.sitrepIntervalMs) return;
      if (now < typingUntilRef.current) return;
      if (hasOpenModal()) return;

      if (!isCriticalSitrep) {
        const lastShownAt = readStorageTimeMs(gusStorageKeys.lastShownAt);
        const lastDismissedAt = readStorageTimeMs(gusStorageKeys.lastDismissedAt);
        if (lastShownAt && now - lastShownAt < gusPopupTiming.globalCooldownMs) return;
        if (lastDismissedAt && now - lastDismissedAt < gusPopupTiming.dismissedCooldownMs) return;
      }

      const safeSitrep = {
        ...sitrepMessage,
        shouldSpeak: gusSitrepTiming.sitrepCriticalVoiceOnly ? sitrepMessage.priority <= 2 : sitrepMessage.shouldSpeak,
      };
      if (!shouldAutoOpenGusNotification(notificationSettings, safeSitrep)) return;
      setActiveMessage(safeSitrep);
      rememberSitrepMessage(safeSitrep);
      setOpen(true);
    }, gusSitrepTiming.sitrepIntervalMs);

    return () => {
      if (sitrepTimerRef.current) {
        window.clearInterval(sitrepTimerRef.current);
        sitrepTimerRef.current = null;
      }
    };
  }, [
    companyId,
    currentPage,
    canAutoShow,
    jobsiteId,
    liveContext,
    notificationSettings,
    open,
    pathname,
    rememberSitrepMessage,
    userId,
  ]);

  function openAssistant() {
    const nextRouteMessage = findRouteMessage(pathname, readStorageValue(gusStorageKeys.lastMessageId));
    const nextMessage = decideGusBehavior({
      context,
      routeMessage: nextRouteMessage,
      feedback,
      quietMode,
    });
    const autonomousMessage = gusFeatureFlags.gusAutonomousSocialCoachEnabled
      ? createGusAutonomousMessage(
          nextMessage,
          context,
          `${nextMessage.decisionId}:${pathname}:manual:${Date.now()}`,
          readRecentSocialLineIds(),
        )
      : nextMessage.message;
    setActiveMessage(autonomousMessage);
    rememberShownMessage(autonomousMessage);
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
    canAutoShow,
    voiceEnabled,
    feedback,
    openAssistant,
    minimizeAssistant,
    dismissAssistant,
    disableForToday,
    recordFeedback,
  };
}
