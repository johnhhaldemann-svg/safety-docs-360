"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { AiKnowledgeIngestCandidate } from "@/lib/aiKnowledgeMap/types";

type CandidateResponse = {
  candidates?: AiKnowledgeIngestCandidate[];
  error?: string;
};

export function CandidateReviewPanel({ companyId }: { companyId: string | null }) {
  const [candidates, setCandidates] = useState<AiKnowledgeIngestCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "pending_review", limit: "12" });
      if (companyId && companyId !== "all") params.set("companyId", companyId);
      const response = await fetch(`/api/ai-knowledge-map/candidates?${params.toString()}`);
      const body = await response.json().catch(() => null) as CandidateResponse | null;
      setCandidates(response.ok ? body?.candidates ?? [] : []);
      setMessage(response.ok ? null : body?.error ?? "Candidate queue unavailable.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    // Candidate review is server-owned state; refresh when the selected company scope changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function review(candidate: AiKnowledgeIngestCandidate, action: "approve" | "reject" | "incorrect") {
    setWorking(candidate.id);
    setMessage(null);
    try {
      const response = await fetch(action === "approve" ? "/api/ai-knowledge-map/approve-candidate" : "/api/ai-knowledge-map/reject-candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: candidate.id,
          status: action === "incorrect" ? "incorrect" : undefined,
          reason: `Super Admin marked ${candidate.candidateType} candidate ${action}.`,
        }),
      });
      const body = await response.json().catch(() => null) as { errors?: Array<{ error: string }> } | null;
      if (!response.ok && response.status !== 207) throw new Error(body?.errors?.[0]?.error ?? "Review failed.");
      setMessage(action === "approve" ? "Candidate approved and promoted when dependencies are ready." : `Candidate marked ${action}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review failed.");
    } finally {
      setWorking(null);
    }
  }

  return (
    <aside className="rounded-xl border border-white/10 bg-slate-950/72 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-white">Human Review</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Pending candidates must be approved before becoming trusted AI memory.</p>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> : null}
      </div>
      {message ? <p className="mt-3 rounded-lg border border-sky-300/20 bg-sky-300/10 p-2 text-xs font-bold text-sky-100">{message}</p> : null}
      <div className="mt-3 space-y-3">
        {candidates.map((candidate) => (
          <div key={candidate.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{candidate.candidateType}</p>
                <p className="truncate text-sm font-black text-white">{candidate.title}</p>
              </div>
              <span className="rounded-md border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[10px] font-black text-amber-100">pending</span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-400">{candidate.reason ?? candidate.semanticSummary ?? "Candidate needs review."}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" disabled={working === candidate.id} onClick={() => void review(candidate, "approve")} className="inline-flex items-center justify-center gap-1 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2 py-1.5 text-xs font-black text-emerald-100 hover:bg-emerald-300/16 disabled:opacity-60">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </button>
              <button type="button" disabled={working === candidate.id} onClick={() => void review(candidate, "reject")} className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1.5 text-xs font-black text-slate-100 hover:bg-white/[0.09] disabled:opacity-60">
                Reject
              </button>
              <button type="button" disabled={working === candidate.id} onClick={() => void review(candidate, "incorrect")} className="inline-flex items-center justify-center gap-1 rounded-md border border-red-400/25 bg-red-400/10 px-2 py-1.5 text-xs font-black text-red-100 hover:bg-red-400/16 disabled:opacity-60">
                <XCircle className="h-3.5 w-3.5" />
                Incorrect
              </button>
            </div>
          </div>
        ))}
        {!loading && candidates.length === 0 ? <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-100">No pending candidates in this view.</p> : null}
      </div>
    </aside>
  );
}
