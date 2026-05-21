"use client";

import type { ChecklistEvaluationResponse } from "@/lib/compliance/evaluation";

type Props = {
  title?: string;
  loading: boolean;
  error: string;
  data: ChecklistEvaluationResponse | null;
  onRefresh: () => void;
};

const STATUS_STYLES: Record<string, string> = {
  covered: "bg-emerald-500/10 text-emerald-300",
  partial: "bg-amber-500/10 text-amber-300",
  missing: "bg-rose-500/10 text-rose-300",
  needs_user_input: "bg-orange-500/10 text-orange-300",
  not_applicable: "bg-slate-600/40 text-slate-300",
};

export function ChecklistCoveragePanel({
  title = "Checklist Coverage",
  loading,
  error,
  data,
  onRefresh,
}: Props) {
  const topRows = data?.rows.slice(0, 12) ?? [];
  return (
    <div className="rounded-[1.4rem] border border-slate-700/80 bg-slate-950/50 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Advisory</div>
          <h2 className="mt-1 text-lg font-bold text-slate-100">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {data?.summary ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4">
          <div>Covered: {data.summary.covered}</div>
          <div>Needs input: {data.summary.needsUserInput}</div>
          <div>Missing: {data.summary.missing}</div>
          <div>Manual review: {data.summary.manualReview}</div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      {topRows.length ? (
        <div className="mt-4 space-y-2">
          {topRows.map((row) => (
            <div key={row.id} className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-sm font-semibold text-slate-100">{row.item}</div>
                <span
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                    STATUS_STYLES[row.coverage] ?? STATUS_STYLES.not_applicable
                  }`}
                >
                  {row.coverage.replaceAll("_", " ")}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-300">
                Action: {row.aiAction.replaceAll("_", " ")} · Confidence: {row.confidence} · Manual review:{" "}
                {row.manualReviewNeeded ? "Yes" : "No"}
              </div>
              {row.missingFields.length > 0 ? (
                <div className="mt-2 text-xs text-orange-300">
                  Missing: {row.missingFields.slice(0, 4).join(", ")}
                </div>
              ) : null}
            </div>
          ))}
          {(data?.rows.length ?? 0) > topRows.length ? (
            <p className="text-xs text-slate-400">
              Showing {topRows.length} of {data?.rows.length} checklist rows.
            </p>
          ) : null}
          {data?.sourcePolicy ? <p className="text-xs text-slate-400">{data.sourcePolicy}</p> : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">
          Run checklist evaluation to see coverage, gaps, and required user input.
        </p>
      )}
    </div>
  );
}
