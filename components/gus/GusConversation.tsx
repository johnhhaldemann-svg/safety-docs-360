"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, RefreshCw, Send, Trash2 } from "lucide-react";
import { useGusSpeechInput } from "@/components/gus/useGusSpeechInput";
import type { GusContext } from "@/lib/gus/gusContext";
import { createGusProactiveConversationLine } from "@/lib/gus/gusSocialCoach";
import type {
  GusConversationResponse,
  GusConversationTurn,
  GusDecision,
  GusSafetyPreferenceMemory,
} from "@/lib/gus/gusTypes";

type GusConversationProps = {
  context: GusContext;
  decision: GusDecision;
  initialMessage: string;
  queuedPrompt?: { id: number; prompt: string } | null;
  onQueuedPromptHandled?: (id: number) => void;
  onAssistantReply?: (answer: string) => void;
};

function makeTurn(role: GusConversationTurn["role"], content: string): GusConversationTurn {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function defaultPreferences(): GusSafetyPreferenceMemory {
  return {
    preferredDetailLevel: "balanced",
    usefulTopics: [],
    repeatedThemes: [],
    updatedAt: new Date(0).toISOString(),
  };
}

function normalizeTurnContent(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function isDuplicateOrEcho(proactive: string, currentMessage: string) {
  const proactiveText = normalizeTurnContent(proactive);
  const currentText = normalizeTurnContent(currentMessage);
  if (!proactiveText || !currentText) return false;
  return proactiveText === currentText || proactiveText.includes(currentText) || currentText.includes(proactiveText);
}

export function GusConversation({
  context,
  decision,
  initialMessage,
  queuedPrompt,
  onQueuedPromptHandled,
  onAssistantReply,
}: GusConversationProps) {
  const proactiveDecisionRef = useRef("");
  const [turns, setTurns] = useState<GusConversationTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [safetyPreferences, setSafetyPreferences] = useState<GusSafetyPreferenceMemory>(defaultPreferences);

  useEffect(() => {
    const proactive = createGusProactiveConversationLine(
      decision,
      context,
      `${decision.decisionId}:${context.route}:conversation`,
    );
    if (!proactive) return undefined;
    if (isDuplicateOrEcho(proactive, initialMessage)) return undefined;
    if (proactiveDecisionRef.current === decision.decisionId) return undefined;

    const timer = window.setTimeout(() => {
      proactiveDecisionRef.current = decision.decisionId;
      setTurns((current) => {
        if (current.some((turn) => turn.role === "assistant" && turn.content === proactive)) return current;
        return [...current, makeTurn("assistant", proactive)].slice(-10);
      });
    }, decision.attentionLevel === "critical" ? 700 : 1400);

    return () => window.clearTimeout(timer);
  }, [context, decision, initialMessage]);

  const sendMessage = useCallback(async (message: string) => {
    const clean = message.replace(/\s+/g, " ").trim();
    if (!clean || loading) return;

    const userTurn = makeTurn("user", clean);
    const nextTurns = [...turns, userTurn].slice(-9);
    setTurns(nextTurns);
    setDraft("");
    setLoading(true);
    setError(null);
    setLastUserMessage(clean);

    try {
      const response = await fetch("/api/gus/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: clean,
          history: nextTurns,
          context,
          decision,
          safetyPreferences,
        }),
      });
      const payload = (await response.json().catch(() => null)) as Partial<GusConversationResponse> & {
        error?: string;
      } | null;

      if (!response.ok || !payload?.answer) {
        throw new Error(payload?.error || "Gus could not answer that yet.");
      }

      setSafetyPreferences(payload.safetyPreferences ?? safetyPreferences);
      onAssistantReply?.(payload.answer as string);
      setTurns((current) => [...current, makeTurn("assistant", payload.answer as string)].slice(-10));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gus could not answer that yet.");
    } finally {
      setLoading(false);
    }
  }, [context, decision, loading, onAssistantReply, safetyPreferences, turns]);

  const speechInput = useGusSpeechInput((transcript) => {
    void sendMessage(transcript);
  });

  useEffect(() => {
    if (!queuedPrompt?.prompt) return;
    const timer = window.setTimeout(() => {
      void sendMessage(queuedPrompt.prompt);
      onQueuedPromptHandled?.(queuedPrompt.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [onQueuedPromptHandled, queuedPrompt, sendMessage]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  function clearChat() {
    setTurns([]);
    setDraft("");
    setError(null);
    setLastUserMessage(null);
  }

  return (
    <section className="rounded-xl border border-[var(--app-border)] bg-white" aria-label="Talk with Gus">
      <div className="flex items-center justify-between border-b border-[var(--app-border)] px-3 py-2">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--app-muted)]">
            Talk with Gus
          </h3>
          <p className="mt-0.5 text-xs font-semibold text-[var(--app-muted)]">
            Calm mentor mode. Draft guidance only.
          </p>
        </div>
        <button
          type="button"
          onClick={clearChat}
          className="grid h-8 w-8 place-items-center rounded-lg text-[var(--app-muted)] transition hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text-strong)]"
          aria-label="Clear current Gus chat"
          title="Clear current chat"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-36 space-y-3 overflow-y-auto px-3 py-3">
        {turns.map((turn) => (
          <div
            key={turn.id}
            className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <p
              className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-5 ${
                turn.role === "user"
                  ? "bg-[var(--app-accent-primary)] text-white"
                  : "border border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-text-strong)]"
              }`}
            >
              {turn.content}
            </p>
          </div>
        ))}
        {loading ? (
          <p className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 text-sm font-semibold text-[var(--app-muted)]">
            Gus is thinking through the safe next step...
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="mx-3 mb-3 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          <span>{error}</span>
          {lastUserMessage ? (
            <button
              type="button"
              onClick={() => sendMessage(lastUserMessage)}
              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-amber-900 shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {speechInput.errorMessage || speechInput.interimTranscript ? (
        <p className="mx-3 mb-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 text-xs font-semibold text-[var(--app-muted)]">
          {speechInput.interimTranscript || speechInput.errorMessage}
        </p>
      ) : null}

      <form onSubmit={submit} className="flex gap-2 border-t border-[var(--app-border)] p-3">
        <label className="sr-only" htmlFor="gus-conversation-input">
          Message Gus
        </label>
        <input
          id="gus-conversation-input"
          value={speechInput.interimTranscript || draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          placeholder={speechInput.isListening ? "Listening to you..." : "Ask Gus a safety question..."}
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-white px-3 text-sm text-[var(--app-text-strong)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-ring)]"
          disabled={loading || speechInput.isListening}
        />
        {speechInput.enabled ? (
          <button
            type="button"
            onClick={speechInput.toggleListening}
            disabled={loading || speechInput.status === "unsupported" || speechInput.status === "disabled"}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50 ${
              speechInput.isListening
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-[var(--app-border)] bg-white text-[var(--app-text-strong)] hover:bg-[var(--app-panel-soft)]"
            }`}
            aria-label={speechInput.isListening ? "Stop talking to Gus" : "Talk to Gus"}
            title={
              speechInput.status === "unsupported"
                ? "Mic input is unavailable in this browser"
                : speechInput.isListening
                  ? "Stop listening"
                  : "Talk to Gus"
            }
          >
            {speechInput.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={loading || !draft.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--app-accent-primary)] text-white shadow-[var(--app-shadow-primary-button)] transition hover:bg-[var(--app-accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send message to Gus"
          title="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
