"use client";

import { useState } from "react";
import type { AiKnowledgeEdge } from "@/lib/aiKnowledgeMap/types";
import { relationshipLabel, validationTone } from "@/components/ai-knowledge-map/mapTheme";

type ReviewStatus = "approved" | "rejected" | "incorrect";

export function RelationshipValidationPanel({
  edges,
  onValidate,
}: {
  edges: AiKnowledgeEdge[];
  onValidate: (edge: AiKnowledgeEdge, status: ReviewStatus, reason?: string) => void;
}) {
  const [pendingReview, setPendingReview] = useState<{ edgeKey: string; status: Exclude<ReviewStatus, "approved">; reason: string } | null>(null);

  return (
    <section className="pointer-events-auto relative z-20 rounded-xl border border-white/10 bg-slate-950/72 p-4 shadow-2xl backdrop-blur">
      <h2 className="text-sm font-black text-white">Relationship Review</h2>
      <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-300/10 p-2 text-xs font-bold text-amber-100">
        Approved relationships support AI memory, but they do not prove compliance. Verify evidence and scope before approving.
      </p>
      <div className="mt-3 max-h-[360px] space-y-3 overflow-auto pb-3 pr-1">
        {edges.slice(0, 8).map((edge) => {
          const edgeKey = reviewEdgeKey(edge);
          const activeReview = pendingReview?.edgeKey === edgeKey ? pendingReview : null;
          const canConfirm = activeReview ? activeReview.reason.replace(/\s+/g, " ").trim().length >= 12 : false;
          return (
          <article key={edgeKey} className="relative rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-white">{relationshipLabel(edge.relationshipType)}</span>
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${validationTone(edge.validationStatus)}`}>{edge.validationStatus.replace(/_/g, " ")}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-300">{edge.reason}</p>
            {edge.evidenceText ? <p className="mt-2 rounded-md border border-white/10 bg-black/10 p-2 text-[11px] font-semibold leading-5 text-slate-400">Evidence: {edge.evidenceText}</p> : null}
            {!edge.id ? (
              <p className="mt-3 rounded-md border border-sky-300/20 bg-sky-300/10 p-2 text-[11px] font-bold text-sky-100">
                This relationship is display-only until it is saved as a review candidate with a database ID.
              </p>
            ) : null}
            <div className="relative z-10 mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <ReviewButton label="Approve" tone="approve" onClick={() => onValidate(edge, "approved")} />
              <ReviewButton label="Reject" tone="reject" onClick={() => setPendingReview({ edgeKey, status: "rejected", reason: "" })} />
              <ReviewButton label="Incorrect" tone="incorrect" onClick={() => setPendingReview({ edgeKey, status: "incorrect", reason: "" })} />
            </div>
            {activeReview ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/15 p-3">
                <label className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-300" htmlFor={`relationship-review-${edgeKey}`}>
                  Reason for marking {activeReview.status.replace(/_/g, " ")}
                </label>
                <textarea
                  id={`relationship-review-${edgeKey}`}
                  value={activeReview.reason}
                  onChange={(event) => setPendingReview({ ...activeReview, reason: event.target.value })}
                  className="mt-2 min-h-20 w-full resize-y rounded-md border border-white/10 bg-slate-950/80 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-sky-300/50"
                  placeholder="Example: Relationship is incorrect because the evidence does not support this permit/control connection."
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <ReviewButton
                    label={`Confirm ${activeReview.status === "incorrect" ? "Incorrect" : "Reject"}`}
                    tone={activeReview.status === "incorrect" ? "incorrect" : "reject"}
                    disabled={!canConfirm}
                    onClick={() => {
                      if (!canConfirm) return;
                      onValidate(edge, activeReview.status, activeReview.reason.trim());
                      setPendingReview(null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setPendingReview(null)}
                    className="min-h-10 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-slate-200 hover:bg-white/[0.08]"
                  >
                    Cancel
                  </button>
                </div>
                {!canConfirm ? <p className="mt-2 text-[11px] font-bold text-amber-100">Add a meaningful reason, at least 12 characters, before submitting.</p> : null}
              </div>
            ) : null}
          </article>
          );
        })}
        {edges.length === 0 ? <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-100">No relationships need review in this view.</p> : null}
      </div>
    </section>
  );
}

function reviewEdgeKey(edge: AiKnowledgeEdge) {
  return edge.id ?? `${edge.sourceNodeId}-${edge.targetNodeId}-${edge.relationshipType}`;
}

function ReviewButton({
  label,
  tone,
  onClick,
  disabled = false,
}: {
  label: string;
  tone: "approve" | "reject" | "incorrect";
  onClick: () => void;
  disabled?: boolean;
}) {
  const classes = {
    approve: "border-emerald-300/40 bg-emerald-300/15 text-emerald-50 hover:bg-emerald-300/25",
    reject: "border-amber-300/40 bg-amber-300/15 text-amber-50 hover:bg-amber-300/25",
    incorrect: "border-red-300/40 bg-red-300/15 text-red-50 hover:bg-red-300/25",
  };
  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled) return;
        onClick();
      }}
      disabled={disabled}
      className={`pointer-events-auto min-h-10 rounded-md border px-3 py-2 text-sm font-black shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 ${classes[tone]}`}
    >
      {label}
    </button>
  );
}
