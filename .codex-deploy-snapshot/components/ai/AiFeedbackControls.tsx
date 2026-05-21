"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, RefreshCw, Send, ThumbsDown } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

type Outcome = "accepted" | "edited" | "rejected" | "regenerated" | "field-used";

type Props = {
  surface: string;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
  className?: string;
};

const ACTIONS: Array<{
  outcome: Outcome;
  label: string;
  title: string;
  rating: number;
  icon: typeof Check;
}> = [
  { outcome: "accepted", label: "Accept", title: "Mark this AI output as accepted", rating: 5, icon: Check },
  { outcome: "edited", label: "Edited", title: "Mark this AI output as edited", rating: 3, icon: Pencil },
  { outcome: "rejected", label: "Reject", title: "Mark this AI output as rejected", rating: 1, icon: ThumbsDown },
  { outcome: "regenerated", label: "Rerun", title: "Mark this AI output as needing regeneration", rating: 2, icon: RefreshCw },
  { outcome: "field-used", label: "Field used", title: "Mark this AI output as used in the field", rating: 5, icon: Send },
];

export function AiFeedbackControls({ surface, sourceId, metadata, className = "" }: Props) {
  const [saving, setSaving] = useState<Outcome | null>(null);
  const [saved, setSaved] = useState<Outcome | null>(null);
  const [error, setError] = useState("");
  const metadataPayload = useMemo(() => metadata ?? {}, [metadata]);

  async function sendFeedback(outcome: Outcome, rating: number) {
    setSaving(outcome);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in to save feedback.");
      }

      const response = await fetch("/api/company/ai/feedback", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          surface,
          sourceId,
          outcome,
          rating,
          metadata: {
            ...metadataPayload,
            ...(outcome === "field-used" ? { usedInField: true } : {}),
            ...(outcome === "regenerated" ? { regeneratedCount: 1 } : {}),
          },
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to save feedback.");
      }
      setSaved(outcome);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save feedback.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.outcome}
              type="button"
              title={action.title}
              aria-label={action.title}
              onClick={() => void sendFeedback(action.outcome, action.rating)}
              disabled={saving != null}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--app-border)] bg-white/90 px-2.5 text-xs font-semibold text-[var(--app-text-strong)] shadow-sm transition hover:bg-[var(--app-panel-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon className={`h-3.5 w-3.5 ${saving === action.outcome ? "animate-spin" : ""}`} aria-hidden="true" />
              {action.label}
            </button>
          );
        })}
      </div>
      {saved ? (
        <p className="text-xs font-semibold text-emerald-700">Learning signal saved: {saved.replace("-", " ")}.</p>
      ) : null}
      {error ? (
        <p className="text-xs font-semibold text-amber-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
