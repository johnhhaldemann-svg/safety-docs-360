"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ImagePlus, Mic, MicOff, RefreshCw, Send, Trash2, X } from "lucide-react";
import { useGusSpeechInput } from "@/components/gus/useGusSpeechInput";
import type { GusContext } from "@/lib/gus/gusContext";
import { createGusProactiveConversationLine } from "@/lib/gus/gusSocialCoach";
import type {
  GusConversationResponse,
  GusConversationTurn,
  GusDecision,
  GusPhotoReviewOutput,
  GusPhotoReviewRiskLevel,
  GusSafetyPreferenceMemory,
  GusThoughtDraftResponse,
} from "@/lib/gus/gusTypes";

type GusConversationProps = {
  context: GusContext;
  decision: GusDecision;
  initialMessage: string;
  queuedPrompt?: { id: number; prompt: string } | null;
  onQueuedPromptHandled?: (id: number) => void;
  onAssistantReply?: (answer: string) => void;
};

type GusStructuredDetails = Pick<
  GusConversationResponse,
  "suggestedActions" | "missingInformation" | "riskFlags" | "recommendedControls"
>;

type GusDisplayTurn = GusConversationTurn & {
  structuredDetails?: GusStructuredDetails;
  thoughtDraft?: GusThoughtDraftResponse;
  photoReview?: GusPhotoReviewOutput;
  imagePreviewUrl?: string;
  fileName?: string;
};

type GusConversationMode = "ask" | "formulate";

type SelectedPhoto = {
  file: File;
  previewUrl: string;
};

function makeTurn(
  role: GusConversationTurn["role"],
  content: string,
  extras: Partial<GusDisplayTurn> = {},
): GusDisplayTurn {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extras,
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

function hasItems(items: string[] | undefined) {
  return Boolean(items?.length);
}

function riskTone(level: GusPhotoReviewRiskLevel) {
  if (level === "critical") return "border-red-200 bg-red-50 text-red-900";
  if (level === "high") return "border-amber-200 bg-amber-50 text-amber-950";
  if (level === "moderate") return "border-blue-200 bg-blue-50 text-blue-950";
  if (level === "low") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function DetailSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-current/10 bg-white/68 px-2.5 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-current/65">{title}</p>
      <ul className="mt-1 space-y-1 text-xs leading-4 text-current/80">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function StructuredDetails({ details }: { details: GusStructuredDetails }) {
  const hasDetails =
    hasItems(details.riskFlags) ||
    hasItems(details.missingInformation) ||
    hasItems(details.recommendedControls) ||
    hasItems(details.suggestedActions);

  if (!hasDetails) return null;

  return (
    <div className="mt-2 grid gap-2">
      <DetailSection title="Risks" items={details.riskFlags} />
      <DetailSection title="Missing info" items={details.missingInformation} />
      <DetailSection title="Controls" items={details.recommendedControls} />
      <DetailSection title="Next safe steps" items={details.suggestedActions} />
    </div>
  );
}

function ThoughtDraftDetails({
  draft,
  copied,
  onCopy,
}: {
  draft: GusThoughtDraftResponse;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="mt-2 grid gap-2">
      <DetailSection title="Risks" items={draft.riskFlags} />

      <div className="rounded-lg border border-current/10 bg-white/78 px-2.5 py-2">
        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-current/65">Clarified thought</p>
        <p className="mt-1 text-xs leading-5 text-current/85">{draft.clarifiedThought}</p>
      </div>

      <div className="rounded-lg border border-current/10 bg-white/78 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-current/65">Draft text</p>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-current/10 bg-white px-2 text-[10px] font-black uppercase tracking-[0.08em] text-current/70 transition hover:bg-white/80"
          >
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-current/85">{draft.draftText}</p>
      </div>

      <DetailSection title="Talking points" items={draft.talkingPoints} />
      <DetailSection title="Follow-up questions" items={draft.followUpQuestions} />
      <DetailSection title="Missing info" items={draft.missingInformation} />
      <DetailSection title="Controls" items={draft.recommendedControls} />
      <DetailSection title="Next safe steps" items={draft.suggestedActions} />
    </div>
  );
}

function PhotoReviewDetails({ review }: { review: GusPhotoReviewOutput }) {
  return (
    <div className={`mt-2 grid gap-2 rounded-xl border p-2.5 ${riskTone(review.riskLevel)}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-current/15 bg-white/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-current/70">
          {review.riskLevel} photo check
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-current/60">
          Draft guidance
        </span>
      </div>
      <DetailSection title="Positive visible indicators" items={review.whatLooksRight} />
      <DetailSection title="Concerns" items={review.concerns} />
      <DetailSection title="Critical flags" items={review.criticalFlags} />
      <DetailSection title="Missing info" items={review.missingInformation} />
      <DetailSection title="Controls" items={review.recommendedControls} />
      <DetailSection title="Next safe steps" items={review.nextActions} />
      <DetailSection title="Limitations" items={review.limitations} />
    </div>
  );
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
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [turns, setTurns] = useState<GusDisplayTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewingPhoto, setReviewingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null);
  const [safetyPreferences, setSafetyPreferences] = useState<GusSafetyPreferenceMemory>(defaultPreferences);
  const [mode, setMode] = useState<GusConversationMode>("ask");
  const [copiedDraftTurnId, setCopiedDraftTurnId] = useState<string | null>(null);

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

  useEffect(() => {
    return () => {
      if (selectedPhoto?.previewUrl) URL.revokeObjectURL(selectedPhoto.previewUrl);
    };
  }, [selectedPhoto]);

  const sendMessage = useCallback(async (message: string) => {
    const clean = message.replace(/\s+/g, " ").trim();
    if (!clean || loading || reviewingPhoto) return;

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

      const details: GusStructuredDetails = {
        suggestedActions: payload.suggestedActions ?? [],
        missingInformation: payload.missingInformation ?? [],
        riskFlags: payload.riskFlags ?? [],
        recommendedControls: payload.recommendedControls ?? [],
      };
      setSafetyPreferences(payload.safetyPreferences ?? safetyPreferences);
      onAssistantReply?.(payload.answer as string);
      setTurns((current) => [...current, makeTurn("assistant", payload.answer as string, { structuredDetails: details })].slice(-10));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gus could not answer that yet.");
    } finally {
      setLoading(false);
    }
  }, [context, decision, loading, onAssistantReply, reviewingPhoto, safetyPreferences, turns]);

  const sendThoughtDraft = useCallback(async (message: string) => {
    const clean = message.replace(/\s+/g, " ").trim();
    if (!clean || loading || reviewingPhoto) return;

    const userTurn = makeTurn("user", clean);
    const nextTurns = [...turns, userTurn].slice(-9);
    setTurns(nextTurns);
    setDraft("");
    setLoading(true);
    setError(null);
    setLastUserMessage(clean);
    setCopiedDraftTurnId(null);

    try {
      const response = await fetch("/api/gus/thought-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: clean,
          history: nextTurns,
          context,
          decision,
        }),
      });
      const payload = (await response.json().catch(() => null)) as Partial<GusThoughtDraftResponse> & {
        error?: string;
      } | null;

      if (!response.ok || !payload?.draftText || !payload?.clarifiedThought) {
        throw new Error(payload?.error || "Gus could not formulate that thought yet.");
      }

      const thoughtDraft: GusThoughtDraftResponse = {
        clarifiedThought: payload.clarifiedThought,
        draftText: payload.draftText,
        talkingPoints: payload.talkingPoints ?? [],
        followUpQuestions: payload.followUpQuestions ?? [],
        missingInformation: payload.missingInformation ?? [],
        riskFlags: payload.riskFlags ?? [],
        recommendedControls: payload.recommendedControls ?? [],
        suggestedActions: payload.suggestedActions ?? [],
        draftOnly: true,
        humanReviewRequired: true,
      };
      const spokenSummary = thoughtDraft.talkingPoints.slice(0, 2).join(" ") || thoughtDraft.clarifiedThought;
      onAssistantReply?.(spokenSummary);
      setTurns((current) =>
        [
          ...current,
          makeTurn("assistant", "I shaped that into draft wording. Keep it in draft until a human safety check.", {
            thoughtDraft,
          }),
        ].slice(-10),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gus could not formulate that thought yet.");
    } finally {
      setLoading(false);
    }
  }, [context, decision, loading, onAssistantReply, reviewingPhoto, turns]);

  const sendDraftInput = useCallback(
    (message: string) => {
      if (mode === "formulate") {
        void sendThoughtDraft(message);
        return;
      }
      void sendMessage(message);
    },
    [mode, sendMessage, sendThoughtDraft],
  );

  const speechInput = useGusSpeechInput((transcript) => {
    sendDraftInput(transcript);
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
    sendDraftInput(draft);
  }

  function clearSelectedPhoto() {
    setSelectedPhoto((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function handlePhotoSelected(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose a jobsite photo image for Gus to check.");
      return;
    }
    setError(null);
    setSelectedPhoto((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return {
        file,
        previewUrl: URL.createObjectURL(file),
      };
    });
  }

  async function reviewPhoto() {
    if (!selectedPhoto || loading || reviewingPhoto) return;

    const note = draft.replace(/\s+/g, " ").trim();
    const userTurn = makeTurn("user", note ? `Check photo: ${note}` : `Check photo: ${selectedPhoto.file.name}`, {
      fileName: selectedPhoto.file.name,
    });
    const nextTurns = [...turns, userTurn].slice(-9);
    const formData = new FormData();
    formData.append("file", selectedPhoto.file);
    formData.append("message", note);
    formData.append("context", JSON.stringify(context));
    formData.append("decision", JSON.stringify(decision));
    formData.append("safetyPreferences", JSON.stringify(safetyPreferences));

    setTurns(nextTurns);
    setDraft("");
    setError(null);
    setReviewingPhoto(true);

    try {
      const response = await fetch("/api/gus/photo-review", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as (Partial<GusPhotoReviewOutput> & { error?: string }) | null;

      if (!response.ok || !payload?.answer) {
        throw new Error(payload?.error || "Gus could not review that photo yet.");
      }

      const review = payload as GusPhotoReviewOutput;
      onAssistantReply?.(review.answer);
      setTurns((current) => [...current, makeTurn("assistant", review.answer, { photoReview: review })].slice(-10));
      clearSelectedPhoto();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gus could not review that photo yet.");
    } finally {
      setReviewingPhoto(false);
    }
  }

  function clearChat() {
    setTurns([]);
    setDraft("");
    setError(null);
    setLastUserMessage(null);
    setCopiedDraftTurnId(null);
    clearSelectedPhoto();
  }

  async function copyDraftText(turnId: string | undefined, draftText: string) {
    if (!turnId) return;
    try {
      await navigator.clipboard.writeText(draftText);
      setCopiedDraftTurnId(turnId);
    } catch {
      setError("Gus could not copy that draft text from this browser.");
    }
  }

  const busy = loading || reviewingPhoto;
  const inputPlaceholder =
    mode === "formulate"
      ? speechInput.isListening
        ? "Listening to your rough thought..."
        : "Say or paste the rough thought..."
      : speechInput.isListening
        ? "Listening to you..."
        : "Ask Gus a safety question or add photo context...";

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

      <div className="max-h-80 space-y-3 overflow-y-auto px-3 py-3">
        {turns.map((turn) => (
          <div
            key={turn.id}
            className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-5 ${
                turn.role === "user"
                  ? "bg-[var(--app-accent-primary)] text-white"
                  : "border border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-text-strong)]"
              }`}
            >
              {turn.imagePreviewUrl ? (
                <img
                  src={turn.imagePreviewUrl}
                  alt={turn.fileName ? `Uploaded photo ${turn.fileName}` : "Uploaded photo for Gus review"}
                  className="mb-2 max-h-32 w-full rounded-lg object-cover"
                />
              ) : null}
              <p>{turn.content}</p>
              {turn.structuredDetails ? <StructuredDetails details={turn.structuredDetails} /> : null}
              {turn.thoughtDraft ? (
                <ThoughtDraftDetails
                  draft={turn.thoughtDraft}
                  copied={copiedDraftTurnId === turn.id}
                  onCopy={() => void copyDraftText(turn.id, turn.thoughtDraft?.draftText ?? "")}
                />
              ) : null}
              {turn.photoReview ? <PhotoReviewDetails review={turn.photoReview} /> : null}
            </div>
          </div>
        ))}
        {busy ? (
          <p className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 text-sm font-semibold text-[var(--app-muted)]">
            {reviewingPhoto ? "Gus is checking the photo for visible safety concerns..." : "Gus is thinking through the safe next step..."}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="mx-3 mb-3 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          <span>{error}</span>
          {lastUserMessage ? (
            <button
              type="button"
              onClick={() => sendDraftInput(lastUserMessage)}
              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-amber-900 shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {selectedPhoto ? (
        <div className="mx-3 mb-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-2">
          <div className="flex items-center gap-2">
            <img src={selectedPhoto.previewUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-[var(--app-text-strong)]">{selectedPhoto.file.name}</p>
              <p className="text-[11px] font-semibold text-[var(--app-muted)]">
                Gus will check visible jobsite conditions only.
              </p>
            </div>
            <button
              type="button"
              onClick={clearSelectedPhoto}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--app-muted)] hover:bg-white"
              aria-label="Remove selected photo"
              title="Remove photo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={reviewPhoto}
            disabled={busy}
            className="mt-2 inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-[var(--app-accent-primary)] px-3 py-1.5 text-xs font-black text-white shadow-[var(--app-shadow-primary-button)] transition hover:bg-[var(--app-accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Check photo
          </button>
        </div>
      ) : null}

      {speechInput.errorMessage || speechInput.interimTranscript ? (
        <p className="mx-3 mb-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 text-xs font-semibold text-[var(--app-muted)]">
          {speechInput.interimTranscript || speechInput.errorMessage}
        </p>
      ) : null}

      <div className="mx-3 mb-3 inline-flex rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-1">
        {(["ask", "formulate"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={`min-h-8 rounded-md px-3 text-xs font-black uppercase tracking-[0.08em] transition ${
              mode === item
                ? "bg-white text-[var(--app-text-strong)] shadow-sm"
                : "text-[var(--app-muted)] hover:bg-white/65 hover:text-[var(--app-text-strong)]"
            }`}
            aria-pressed={mode === item}
          >
            {item === "ask" ? "Ask" : "Formulate"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-[var(--app-border)] p-3">
        <label className="sr-only" htmlFor="gus-conversation-input">
          Message Gus
        </label>
        <input
          id="gus-conversation-input"
          value={speechInput.interimTranscript || draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          placeholder={inputPlaceholder}
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-white px-3 text-sm text-[var(--app-text-strong)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-ring)]"
          disabled={busy || speechInput.isListening}
        />
        <input
          ref={photoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => handlePhotoSelected(event.currentTarget.files?.[0])}
        />
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          disabled={busy}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--app-border)] bg-white text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Upload a photo for Gus to check"
          title="Upload photo"
        >
          <ImagePlus className="h-4 w-4" />
        </button>
        {speechInput.enabled ? (
          <button
            type="button"
            onClick={speechInput.toggleListening}
            disabled={busy || speechInput.status === "unsupported" || speechInput.status === "disabled"}
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
          disabled={busy || !draft.trim()}
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
