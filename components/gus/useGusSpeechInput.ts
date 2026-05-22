"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { gusFeatureFlags, gusStorageKeys } from "@/components/gus/gusConfig";

type GusSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<{
      isFinal: boolean;
      0?: { transcript?: string };
    }>;
  }) => void) | null;
};

type GusSpeechRecognitionConstructor = new () => GusSpeechRecognition;

type SpeechWindow = Window & {
  SpeechRecognition?: GusSpeechRecognitionConstructor;
  webkitSpeechRecognition?: GusSpeechRecognitionConstructor;
};

export type GusSpeechInputStatus =
  | "disabled"
  | "unsupported"
  | "idle"
  | "requesting"
  | "listening"
  | "error";

function writeStorageValue(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Mic transcript persistence should fail quietly.
  }
}

export function normalizeGusMicTranscript(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function recognitionConstructor(): GusSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function isGusMicInputSupported() {
  return Boolean(recognitionConstructor());
}

export function useGusSpeechInput(onTranscript: (transcript: string) => void) {
  const recognitionRef = useRef<GusSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [status, setStatus] = useState<GusSpeechInputStatus>(() => {
    if (!gusFeatureFlags.gusMicInputEnabled) return "disabled";
    return isGusMicInputSupported() ? "idle" : "unsupported";
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    if (!gusFeatureFlags.gusMicInputEnabled) {
      setStatus("disabled");
      setErrorMessage("Mic input is not enabled.");
      return;
    }

    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setStatus("unsupported");
      setErrorMessage("Mic input is unavailable in this browser.");
      return;
    }

    try {
      recognitionRef.current?.abort();
      finalTranscriptRef.current = "";
      setInterimTranscript("");
      setErrorMessage(null);
      setStatus("requesting");

      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onstart = () => setStatus("listening");
      recognition.onerror = (event) => {
        const permissionBlocked = event.error === "not-allowed" || event.error === "service-not-allowed";
        setStatus("error");
        setErrorMessage(permissionBlocked ? "Microphone permission is blocked." : "Gus could not hear that clearly.");
      };
      recognition.onresult = (event) => {
        let interim = "";
        let final = finalTranscriptRef.current;

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = normalizeGusMicTranscript(result[0]?.transcript ?? "");
          if (!transcript) continue;
          if (result.isFinal) {
            final = normalizeGusMicTranscript(`${final} ${transcript}`);
          } else {
            interim = normalizeGusMicTranscript(`${interim} ${transcript}`);
          }
        }

        finalTranscriptRef.current = final;
        setInterimTranscript(interim || final);
      };
      recognition.onend = () => {
        const finalTranscript = normalizeGusMicTranscript(finalTranscriptRef.current);
        recognitionRef.current = null;
        setInterimTranscript("");
        setStatus((currentStatus) => (currentStatus === "error" ? "error" : "idle"));

        if (finalTranscript) {
          writeStorageValue(gusStorageKeys.lastMicTranscript, finalTranscript);
          onTranscript(finalTranscript);
        }
      };
      recognition.start();
    } catch {
      setStatus("error");
      setErrorMessage("Gus could not start microphone input.");
    }
  }, [onTranscript]);

  const toggleListening = useCallback(() => {
    if (status === "listening" || status === "requesting") {
      stopListening();
      return;
    }
    startListening();
  }, [startListening, status, stopListening]);

  return useMemo(
    () => ({
      enabled: gusFeatureFlags.gusMicInputEnabled,
      status,
      errorMessage,
      interimTranscript,
      isListening: status === "listening" || status === "requesting",
      startListening,
      stopListening,
      toggleListening,
    }),
    [errorMessage, interimTranscript, startListening, status, stopListening, toggleListening],
  );
}
