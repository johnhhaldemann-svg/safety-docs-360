"use client";

/**
 * Renders the AI Approval Memory recall verdict as a compact badge. Shared across review
 * surfaces (Prediction Validation, AI Improvements, AI Knowledge Map). Renders nothing
 * when there is no comparable history yet.
 */
export type ApprovalRecallSummary = {
  recommendation: "likely_approvable" | "likely_not_approvable" | "uncertain" | "no_evidence";
  score: number | null;
  confidence: "none" | "low" | "medium" | "high";
  consideredCount: number;
} | null | undefined;

// Light pills so the badge reads on both the dark Command Center tables and the
// light review cards (AI Improvements).
const TONES: Record<string, { label: string; cls: string }> = {
  likely_approvable: { label: "Likely approvable", cls: "border-emerald-400 bg-emerald-100 text-emerald-800" },
  likely_not_approvable: { label: "Likely not approvable", cls: "border-red-400 bg-red-100 text-red-800" },
  uncertain: { label: "Uncertain", cls: "border-slate-300 bg-slate-100 text-slate-700" },
};

export function ApprovalRecallBadge({ recall, className }: { recall: ApprovalRecallSummary; className?: string }) {
  if (!recall || recall.recommendation === "no_evidence" || recall.consideredCount === 0) return null;
  const pct = recall.score == null ? null : `${Math.round(recall.score * 100)}%`;
  const tone = TONES[recall.recommendation] ?? TONES.uncertain;
  return (
    <span
      title={`Based on ${recall.consideredCount} comparable past decision${recall.consideredCount === 1 ? "" : "s"} (${recall.confidence} confidence)`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone.cls}${className ? ` ${className}` : ""}`}
    >
      AI memory: {tone.label}
      {pct ? ` · ${pct}` : ""}
    </span>
  );
}
