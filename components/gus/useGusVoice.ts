"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  gusStorageKeys,
  isGusAllowedRoute,
  isGusDisabledRoute,
} from "@/components/gus/gusConfig";
import {
  canGusSpeak,
  resolveGusReplaySpeechText,
  sanitizeGusSpeechText,
  type GusTtsVoice,
} from "@/lib/gus/gusVoice";
import type { GusMessage } from "@/lib/gus/gusTypes";

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
    // Voice preferences should fail quietly when storage is unavailable.
  }
}

function removeStorageValue(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Voice preferences should fail quietly when storage is unavailable.
  }
}

function readTimeMs(key: string) {
  const value = readStorageValue(key);
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readFutureTimeMs(key: string) {
  const value = readTimeMs(key);
  return value > Date.now() ? value : 0;
}

function endOfTodayIso() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

function isTextEntryElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

type UseGusVoiceOptions = {
  message: GusMessage;
  route: string;
  assistantOpen: boolean;
  voice?: GusTtsVoice;
};

type SpeakOptions = {
  force?: boolean;
  preferBrowserVoice?: boolean;
};

export function useGusVoice({ message, route, assistantOpen, voice = "marin" }: UseGusVoiceOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const typingUntilRef = useRef(0);
  const [voiceEnabled, setVoiceEnabled] = useState(() => readStorageValue(gusStorageKeys.voiceEnabled) === "true");
  const [textOnlyMode, setTextOnlyMode] = useState(() => readStorageValue(gusStorageKeys.textOnlyMode) === "true");
  const [disabledUntilMs, setDisabledUntilMs] = useState(() => readFutureTimeMs(gusStorageKeys.voiceDisabledUntil));
  const [isSuppressedToday, setIsSuppressedToday] = useState(() => readFutureTimeMs(gusStorageKeys.voiceDisabledUntil) > 0);
  const [lastSpokenText, setLastSpokenText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "muted" | "error">("idle");
  const speechText = sanitizeGusSpeechText(message.spokenText ?? message.message);
  const routeAllowsVoice = isGusAllowedRoute(route) && !isGusDisabledRoute(route);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const canSpeakAtMoment = useCallback(
    () =>
      canGusSpeak({
        route,
        message,
        voiceEnabled,
        textOnlyMode,
        disabledUntilMs,
        isUserTyping: Date.now() < typingUntilRef.current,
      }),
    [disabledUntilMs, message, route, textOnlyMode, voiceEnabled],
  );

  const speak = useCallback(
    async (text: string, options: SpeakOptions = {}) => {
      const cleanedText = sanitizeGusSpeechText(text);
      if (!cleanedText) return;
      if (!options.force && !canSpeakAtMoment()) {
        setStatus(voiceEnabled ? "muted" : "idle");
        return;
      }

      setStatus("loading");
      stopAudio();
      const speakWithBrowserVoice = () => {
        if (
          typeof window === "undefined" ||
          !("speechSynthesis" in window) ||
          !("SpeechSynthesisUtterance" in window)
        ) {
          return false;
        }

        try {
          const utterance = new window.SpeechSynthesisUtterance(cleanedText);
          const voices = window.speechSynthesis.getVoices();
          const preferredVoice =
            voices.find((item) => /english|en-/i.test(`${item.lang} ${item.name}`) && /female|samantha|victoria|zira|google/i.test(item.name)) ??
            voices.find((item) => /^en/i.test(item.lang));

          if (preferredVoice) utterance.voice = preferredVoice;
          utterance.rate = 0.95;
          utterance.pitch = 1;
          utterance.volume = 1;
          utterance.onend = () => setStatus("idle");
          utterance.onerror = () => setStatus("error");
          setLastSpokenText(cleanedText);
          setStatus("playing");
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
          return true;
        } catch {
          return false;
        }
      };

      if (options.preferBrowserVoice && speakWithBrowserVoice()) return;

      try {
        const response = await fetch("/api/gus/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: cleanedText,
            voice,
            speed: 1,
            format: "mp3",
          }),
        });
        if (!response.ok) {
          if (speakWithBrowserVoice()) return;
          throw new Error("Failed to generate Gus speech.");
        }

        const audioBlob = await response.blob();
        const objectUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(objectUrl);
        audioRef.current = audio;
        objectUrlRef.current = objectUrl;
        audio.onended = () => setStatus("idle");
        audio.onerror = () => setStatus("error");
        setLastSpokenText(cleanedText);
        setStatus("playing");
        await audio.play();
      } catch {
        if (speakWithBrowserVoice()) return;
        setStatus("error");
      }
    },
    [canSpeakAtMoment, stopAudio, voice, voiceEnabled],
  );

  useEffect(() => {
    function noteTyping(event: Event) {
      if (!isTextEntryElement(event.target)) return;
      typingUntilRef.current = Date.now() + 2500;
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
    if (!assistantOpen || !speechText) return undefined;
    const timer = window.setTimeout(() => {
      void speak(speechText);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [assistantOpen, message.messageId, speak, speechText]);

  useEffect(() => stopAudio, [stopAudio]);

  function turnOnVoice() {
    writeStorageValue(gusStorageKeys.voiceEnabled, "true");
    writeStorageValue(gusStorageKeys.textOnlyMode, "false");
    removeStorageValue(gusStorageKeys.voiceDisabledUntil);
    setVoiceEnabled(true);
    setTextOnlyMode(false);
    setDisabledUntilMs(0);
    setIsSuppressedToday(false);
    setStatus("idle");
    if (speechText) void speak(speechText, { force: true, preferBrowserVoice: true });
  }

  function muteVoice() {
    writeStorageValue(gusStorageKeys.voiceEnabled, "false");
    setVoiceEnabled(false);
    stopAudio();
    setStatus("muted");
  }

  function useTextOnlyMode() {
    writeStorageValue(gusStorageKeys.voiceEnabled, "false");
    writeStorageValue(gusStorageKeys.textOnlyMode, "true");
    setVoiceEnabled(false);
    setTextOnlyMode(true);
    stopAudio();
    setStatus("muted");
  }

  function doNotSpeakAgainToday() {
    const until = endOfTodayIso();
    writeStorageValue(gusStorageKeys.voiceDisabledUntil, until);
    setDisabledUntilMs(Date.parse(until));
    stopAudio();
    setStatus("muted");
  }

  function replayLast() {
    const replayText = resolveGusReplaySpeechText(lastSpokenText, speechText);
    if (!replayText) return;
    void speak(replayText, { force: true, preferBrowserVoice: true });
  }

  return {
    voiceEnabled,
    textOnlyMode,
    routeAllowsVoice,
    isSuppressedToday,
    lastSpokenText,
    status,
    turnOnVoice,
    muteVoice,
    useTextOnlyMode,
    doNotSpeakAgainToday,
    replayLast,
  };
}
