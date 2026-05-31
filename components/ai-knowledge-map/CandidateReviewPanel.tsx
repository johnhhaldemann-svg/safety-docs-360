"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, FileText, Globe2, GitBranch, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { buildCandidatePromotionPreview, candidateRequiresSecondApproval } from "@/lib/aiKnowledgeMap/reviewGate";
import type { AiKnowledgeEvidence, AiKnowledgeIngestCandidate } from "@/lib/aiKnowledgeMap/types";

type CandidateResponse = {
  candidates?: AiKnowledgeIngestCandidate[];
  error?: string;
};

type LearningBatch = {
  id: string;
  status: string;
  sourceCounts: Record<string, number>;
  candidateCounts: Record<string, number>;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type BatchResponse = {
  batches?: LearningBatch[];
  error?: string;
};

const GROUPS = [
  { key: "document", label: "Documents", icon: FileText },
  { key: "internet_source", label: "Internet sources", icon: Globe2 },
  { key: "relationship", label: "Relationships", icon: GitBranch },
  { key: "failed_source", label: "Failed sources", icon: ShieldAlert },
] as const;

const REVIEW_VISIBLE_STATUSES = new Set(["pending_review", "pending_second_approval", "approved"]);

export function CandidateReviewPanel({ companyId }: { companyId: string | null }) {
  const [candidates, setCandidates] = useState<AiKnowledgeIngestCandidate[]>([]);
  const [failedSources, setFailedSources] = useState<AiKnowledgeIngestCandidate[]>([]);
  const [batches, setBatches] = useState<LearningBatch[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const all = [...candidates, ...failedSources];
    return GROUPS.map((group) => ({
      ...group,
      items: all.filter((candidate) => candidateSourceKey(candidate) === group.key),
    })).filter((group) => group.items.length > 0);
  }, [candidates, failedSources]);

  const pendingIds = useMemo(() => candidates.filter((candidate) => REVIEW_VISIBLE_STATUSES.has(candidate.validationStatus)).map((candidate) => candidate.id), [candidates]);
  const selectedPendingIds = useMemo(() => pendingIds.filter((id) => selectedIds.has(id)), [pendingIds, selectedIds]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "all", limit: "60" });
      if (companyId && companyId !== "all") params.set("companyId", companyId);
      const failedParams = new URLSearchParams({ status: "failed", candidateType: "failed_source", limit: "8" });
      if (companyId && companyId !== "all") failedParams.set("companyId", companyId);
      const [candidateResponse, batchResponse, failedResponse] = await Promise.all([
        fetch(`/api/ai-knowledge-map/candidates?${params.toString()}`),
        fetch(`/api/ai-knowledge-map/learning-check?${params.toString()}`),
        fetch(`/api/ai-knowledge-map/candidates?${failedParams.toString()}`),
      ]);
      const candidateBody = await candidateResponse.json().catch(() => null) as CandidateResponse | null;
      const batchBody = await batchResponse.json().catch(() => null) as BatchResponse | null;
      const failedBody = await failedResponse.json().catch(() => null) as CandidateResponse | null;
      setCandidates(candidateResponse.ok ? (candidateBody?.candidates ?? []).filter((candidate) => REVIEW_VISIBLE_STATUSES.has(candidate.validationStatus)) : []);
      setBatches(batchResponse.ok ? batchBody?.batches ?? [] : []);
      setFailedSources(failedResponse.ok ? failedBody?.candidates ?? [] : []);
      setSelectedIds(new Set());
      setMessage(candidateResponse.ok && batchResponse.ok && failedResponse.ok ? null : candidateBody?.error ?? batchBody?.error ?? failedBody?.error ?? "Candidate queue unavailable.");
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
    await reviewIds([candidate.id], action, candidate.candidateType);
  }

  async function reviewIds(candidateIds: string[], action: "approve" | "reject" | "incorrect", label = "selected") {
    if (candidateIds.length === 0) return;
    const reason = action === "approve"
      ? `Super Admin approved ${label} learned AI candidate(s) for trusted graph memory.`
      : window.prompt(`Enter the reason this learned candidate is ${action}:`, "")?.trim();
    if (!reason) {
      setMessage(`${action === "incorrect" ? "Incorrect" : "Reject"} review requires a reason.`);
      return;
    }
    setWorking(`${action}:${candidateIds.join(",")}`);
    setMessage(null);
    try {
      const response = await fetch(action === "approve" ? "/api/ai-knowledge-map/approve-candidate" : "/api/ai-knowledge-map/reject-candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateIds,
          status: action === "incorrect" ? "incorrect" : undefined,
          reason,
        }),
      });
      const body = await response.json().catch(() => null) as { errors?: Array<{ error: string }> } | null;
      if (!response.ok && response.status !== 207) throw new Error(body?.errors?.[0]?.error ?? "Review failed.");
      setMessage(action === "approve" ? "Approved learned candidates were promoted when dependencies were ready." : `Learned candidates marked ${action}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review failed.");
    } finally {
      setWorking(null);
    }
  }

  function toggle(candidateId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  }

  function selectAllPending() {
    setSelectedIds(new Set(pendingIds));
  }

  return (
    <aside className="rounded-xl border border-white/10 bg-slate-950/72 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-white">What AI Engine Learned</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Human Review is required before learning-check candidates enter the trusted map.</p>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> : null}
      </div>
      <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-2 text-xs font-bold text-amber-100">
        Trusted memory suggestions do not prove compliance. Verify source evidence, scope, and controls before approval.
      </p>
      {message ? <p className="mt-3 rounded-lg border border-sky-300/20 bg-sky-300/10 p-2 text-xs font-bold text-sky-100">{message}</p> : null}
      {batches.length > 0 ? <LearningBatchHistory batches={batches} /> : null}
      {pendingIds.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={selectAllPending} className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1.5 text-xs font-black text-slate-100 hover:bg-white/[0.09]">
            Select all pending
          </button>
          <button type="button" disabled={selectedPendingIds.length === 0 || Boolean(working)} onClick={() => void reviewIds(selectedPendingIds, "approve", "selected")} className="rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2 py-1.5 text-xs font-black text-emerald-100 hover:bg-emerald-300/16 disabled:opacity-60">
            Approve selected ({selectedPendingIds.length})
          </button>
        </div>
      ) : null}
      <div className="mt-3 max-h-[560px] space-y-4 overflow-auto pr-1 2xl:max-h-[680px]">
        {grouped.map((group) => (
          <section key={group.key} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-2">
              <group.icon className="h-3.5 w-3.5 text-sky-300" />
              <h4 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{group.label}</h4>
              <span className="ml-auto rounded-md border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-black text-slate-300">{group.items.length}</span>
            </div>
            <div className="mt-3 space-y-3">
              {group.items.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  selected={selectedIds.has(candidate.id)}
                  working={Boolean(working)}
                  onToggle={() => toggle(candidate.id)}
                  onReview={(action) => void review(candidate, action)}
                />
              ))}
            </div>
          </section>
        ))}
        {!loading && grouped.length === 0 ? <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-100">No learned candidates need review in this view.</p> : null}
      </div>
    </aside>
  );
}

function LearningBatchHistory({ batches }: { batches: LearningBatch[] }) {
  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-center gap-2">
        <Clock3 className="h-3.5 w-3.5 text-sky-300" />
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Learning check history</p>
      </div>
      <div className="mt-2 space-y-2">
        {batches.slice(0, 4).map((batch) => (
          <div key={batch.id} className="grid grid-cols-[1fr_auto] gap-3 text-xs font-semibold text-slate-400">
            <span>{new Date(batch.createdAt).toLocaleString()}</span>
            <span className="font-black text-slate-200">{Number(batch.candidateCounts.totalCandidates ?? 0)} candidates</span>
            <span className="col-span-2 text-[11px] text-slate-500">
              {Number(batch.sourceCounts.documents ?? 0)} docs, {Number(batch.sourceCounts.internetSources ?? 0)} sources, {Number(batch.candidateCounts.failedSourceCandidates ?? 0)} failed, {String(batch.metadata.runSlot ?? "manual")}, {batch.status.replace(/_/g, " ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  selected,
  working,
  onToggle,
  onReview,
}: {
  candidate: AiKnowledgeIngestCandidate;
  selected: boolean;
  working: boolean;
  onToggle: () => void;
  onReview: (action: "approve" | "reject" | "incorrect") => void;
}) {
  const metadata = candidate.metadata;
  const preview = buildCandidatePromotionPreview(candidate);
  const learnedSummary = text(metadata.learnedSummary) ?? candidate.semanticSummary ?? candidate.reason ?? "Candidate needs review.";
  const confidence = typeof metadata.confidenceScore === "number" ? metadata.confidenceScore : candidate.confidenceScore;
  const riskLevel = text(metadata.riskLevel) ?? "unknown";
  const sourceUrl = text(metadata.sourceUrl);
  const sourceDocument = text(metadata.sourceDocument);
  const evidence = evidenceItems(candidate);
  const failed = candidate.candidateType === "failed_source";
  const highRiskSecondApproval = candidateRequiresSecondApproval(candidate);
  const waitingSecondApproval = candidate.validationStatus === "pending_second_approval";
  return (
    <article className={`rounded-lg border p-3 ${failed ? "border-red-300/20 bg-red-300/10" : "border-white/10 bg-white/[0.04]"}`}>
      <div className="flex items-start gap-2">
        {!failed ? (
          <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900" aria-label={`Select ${candidate.title}`} />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{candidateSourceLabel(candidate)}</p>
              <p className="truncate text-sm font-black text-white">{candidate.title}</p>
            </div>
            <span className={`rounded-md border px-2 py-1 text-[10px] font-black ${failed ? "border-red-300/25 bg-red-300/10 text-red-100" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}>
              {candidate.validationStatus.replace(/_/g, " ")}
            </span>
          </div>
          <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-slate-300">{learnedSummary}</p>
          {highRiskSecondApproval ? (
            <p className="mt-2 rounded-md border border-red-300/20 bg-red-300/10 p-2 text-[11px] font-black text-red-100">
              {waitingSecondApproval ? "Second Super Admin approval required before this high/critical memory can be promoted." : "High/critical memory requires two different Super Admin approvals before it can influence trusted AI memory."}
            </p>
          ) : null}
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-400">
            <Detail label="Confidence" value={confidence == null ? "not scored" : `${Math.round(confidence * 100)}%`} />
            <Detail label="Risk" value={riskLevel} />
            <Detail label="Source" value={sourceDocument ?? sourceUrl ?? candidate.sourceTable ?? "unknown"} />
            <Detail label="Why it matters" value={candidate.reason ?? "AI learning check found safety-relevant content for review."} />
          </div>
          <div className="mt-2 rounded-md border border-sky-300/15 bg-sky-300/10 p-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-100">Promotion preview</p>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-300">
              Creates {preview.willCreateNode ? "trusted node + vector memory" : preview.willCreateEdge ? "trusted relationship edge" : "audit record"}. Affected: {preview.affectedSurfaces.slice(0, 4).join(", ")}.
            </p>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-400">Review due: {new Date(preview.reviewDueAt).toLocaleDateString()}</p>
            {preview.dependencyWarnings.slice(0, 2).map((warning) => (
              <p key={warning} className="mt-1 text-[11px] font-black leading-5 text-amber-100">{warning}</p>
            ))}
          </div>
          <div className="mt-2 rounded-md border border-white/10 bg-black/10 p-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Provenance certificate</p>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-400">
              Candidate {preview.provenancePreview.candidateId}; source {preview.provenancePreview.sourceTable ?? "unknown"}:{preview.provenancePreview.sourceId ?? "unknown"}; compliance proof: no.
            </p>
          </div>
          {evidence.length > 0 ? (
            <div className="mt-2 rounded-md border border-white/10 bg-black/10 p-2">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Source evidence</p>
              {evidence.slice(0, 2).map((item, index) => (
                <p key={`${item.label}-${index}`} className="mt-1 line-clamp-2 text-[11px] font-semibold leading-5 text-slate-400">{item.label}: {item.detail}</p>
              ))}
            </div>
          ) : null}
          {!failed ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" disabled={working} onClick={() => onReview("approve")} className="inline-flex items-center justify-center gap-1 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2 py-1.5 text-xs font-black text-emerald-100 hover:bg-emerald-300/16 disabled:opacity-60">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </button>
              <button type="button" disabled={working} onClick={() => onReview("reject")} className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1.5 text-xs font-black text-slate-100 hover:bg-white/[0.09] disabled:opacity-60">
                Reject
              </button>
              <button type="button" disabled={working} onClick={() => onReview("incorrect")} className="inline-flex items-center justify-center gap-1 rounded-md border border-red-400/25 bg-red-400/10 px-2 py-1.5 text-xs font-black text-red-100 hover:bg-red-400/16 disabled:opacity-60">
                <XCircle className="h-3.5 w-3.5" />
                Incorrect
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
      <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className="mt-1 block line-clamp-2 text-slate-300">{value}</span>
    </div>
  );
}

function candidateSourceKey(candidate: AiKnowledgeIngestCandidate) {
  const sourceKind = typeof candidate.metadata.sourceKind === "string" ? candidate.metadata.sourceKind : null;
  if (sourceKind === "document" || sourceKind === "internet_source" || sourceKind === "failed_source") return sourceKind;
  if (candidate.candidateType === "edge") return "relationship";
  if (candidate.candidateType === "failed_source") return "failed_source";
  return "document";
}

function candidateSourceLabel(candidate: AiKnowledgeIngestCandidate) {
  const key = candidateSourceKey(candidate);
  if (key === "internet_source") return "internet source";
  if (key === "failed_source") return "failed source";
  return key;
}

function evidenceItems(candidate: AiKnowledgeIngestCandidate) {
  const metadataEvidence = Array.isArray(candidate.metadata.sourceEvidence) ? candidate.metadata.sourceEvidence as AiKnowledgeEvidence[] : [];
  return metadataEvidence.length > 0 ? metadataEvidence : candidate.sourceEvidence;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
