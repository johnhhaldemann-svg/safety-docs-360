"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, ClipboardCheck, ExternalLink, Eye, FileSearch, Flag, Gauge, Plus, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonQuietClassName,
  appButtonSecondaryClassName,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import type {
  ApprovedKnowledgeRow,
  ApprovedSourceRow,
  GusAnswerAuditRow,
  GusLearningReviewItemRow,
  GusRequiredControlType,
  GusLearningTrustLevel,
  ResearchQueueRow,
} from "@/lib/gusLearning/types";

const supabase = getSupabaseBrowserClient();

type Overview = {
  sources: ApprovedSourceRow[];
  pendingResearch: ResearchQueueRow[];
  approvedFindings: ResearchQueueRow[];
  rejectedFindings: ResearchQueueRow[];
  expiredKnowledge: ApprovedKnowledgeRow[];
  knowledgeDueForReview: ApprovedKnowledgeRow[];
  changeLog: Array<{ id: string; change_type: string; change_reason: string | null; created_at: string }>;
  feedbackForReview: Array<{ id: string; answer_id: string; feedback_type: string; comment: string | null; created_at: string }>;
  answerAudits: GusAnswerAuditRow[];
  reviewItems: GusLearningReviewItemRow[];
  weakCitationKnowledge: ApprovedKnowledgeRow[];
};

const SOURCE_TYPES = [
  "OSHA",
  "NIOSH",
  "CDC",
  "NFPA reference",
  "manufacturer manual",
  "company policy",
  "site safety plan",
  "SDS",
  "owner requirement",
  "insurance carrier guidance",
  "blog_article",
  "other",
] as const;

const CONTROL_TYPES: Array<{ value: GusRequiredControlType; label: string }> = [
  { value: "regulatory_requirement", label: "OSHA / regulatory requirement" },
  { value: "company_policy", label: "Company policy" },
  { value: "site_requirement", label: "Site-specific requirement" },
  { value: "manufacturer_instruction", label: "Manufacturer instruction" },
  { value: "best_practice", label: "Best practice" },
  { value: "ai_suggestion", label: "AI suggestion" },
];

const MODULES = ["trenching", "hot work", "LOTO", "confined space", "fall protection", "electrical", "PPE", "JSA", "permits", "training"];

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function moduleList(value: string[]) {
  return value.length ? value.join(", ") : "No module assigned";
}

function statusTone(status: string) {
  if (status === "approved" || status === "current") return "success" as const;
  if (status === "rejected" || status === "archived") return "error" as const;
  return "warning" as const;
}

function qualityTone(score: number) {
  if (score >= 75) return "success" as const;
  if (score >= 55) return "warning" as const;
  return "error" as const;
}

function RowShell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-[var(--app-border)] bg-white/95 p-4 shadow-[var(--app-shadow-soft)]">{children}</div>;
}

function PendingFinding({
  row,
  token,
  onDone,
}: {
  row: ResearchQueueRow;
  token: string;
  onDone: () => void;
}) {
  const [summary, setSummary] = useState(row.raw_summary);
  const [controlType, setControlType] = useState<GusRequiredControlType>("best_practice");
  const [reviewDueDate, setReviewDueDate] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().slice(0, 10);
  });
  const [jurisdiction, setJurisdiction] = useState(row.jurisdiction);
  const [citationExcerpt, setCitationExcerpt] = useState("");
  const [citationLocator, setCitationLocator] = useState("");
  const [verificationNotes, setVerificationNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const patch = async (action: "approve" | "reject" | "request_more_review") => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/gus-learning/findings/${row.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          approvedSummary: summary,
          requiredControlType: controlType,
          reviewDueDate,
          jurisdiction,
          citationExcerpt,
          citationLocator,
          verificationNotes,
          reviewerNotes: notes,
          affectedModules: row.affected_modules,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Review action failed.");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review action failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RowShell>
      <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--app-text-strong)]">{row.topic}</p>
          <p className="mt-1 text-xs text-[var(--app-muted)]">{row.question}</p>
          <a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--app-accent-primary)]" href={row.source_url} target="_blank" rel="noreferrer">
            {row.source_title || row.source_domain}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={row.source_type} tone="info" />
          <StatusBadge label={row.status.replace(/_/g, " ")} tone="warning" />
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_17rem]">
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={5} className="rounded-xl border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)]" />
        <div className="space-y-2">
          <select value={controlType} onChange={(e) => setControlType(e.target.value as GusRequiredControlType)} className={appNativeSelectClassName}>
            {CONTROL_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className="w-full rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm" placeholder="Jurisdiction" />
          <input value={reviewDueDate} onChange={(e) => setReviewDueDate(e.target.value)} type="date" className="w-full rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm" />
          <input value={citationLocator} onChange={(e) => setCitationLocator(e.target.value)} className="w-full rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm" placeholder="Citation locator / section" />
          <textarea value={citationExcerpt} onChange={(e) => setCitationExcerpt(e.target.value)} rows={2} className="w-full rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm" placeholder="Approved citation excerpt" />
          <textarea value={verificationNotes} onChange={(e) => setVerificationNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm" placeholder="Verification notes" />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm" placeholder="Reviewer notes" />
        </div>
      </div>
      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={saving} onClick={() => void patch("approve")} className={appButtonPrimaryClassName}>
          <CheckCircle2 className="h-4 w-4" />
          Approve
        </button>
        <button type="button" disabled={saving} onClick={() => void patch("request_more_review")} className={appButtonSecondaryClassName}>
          <FileSearch className="h-4 w-4" />
          More review
        </button>
        <button type="button" disabled={saving} onClick={() => void patch("reject")} className={appButtonQuietClassName}>
          <XCircle className="h-4 w-4" />
          Reject
        </button>
      </div>
    </RowShell>
  );
}

export default function GusLearningReviewPage() {
  const [token, setToken] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState<(typeof SOURCE_TYPES)[number]>("OSHA");
  const [researchTopic, setResearchTopic] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [researchUrl, setResearchUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) throw new Error("Sign in required.");
      setToken(session.access_token);
      const res = await fetch("/api/admin/gus-learning/overview", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = (await res.json().catch(() => null)) as Overview & { error?: string };
      if (!res.ok) throw new Error(data?.error || "Failed to load Gus learning review.");
      setOverview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Gus learning review.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const ov = overview;
    return [
      { label: "Pending", value: ov?.pendingResearch.length ?? 0 },
      { label: "Approved", value: ov?.approvedFindings.length ?? 0 },
      { label: "Expired", value: ov?.expiredKnowledge.length ?? 0 },
      { label: "Review items", value: ov?.reviewItems.length ?? 0 },
    ];
  }, [overview]);

  const addSource = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/gus-learning/sources", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceName, sourceUrl, sourceType }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to add source.");
      setSourceName("");
      setSourceUrl("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add source.");
    } finally {
      setBusy(false);
    }
  };

  const requestResearch = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/gus-learning/research", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ topic: researchTopic, question: researchQuestion, sourceUrl: researchUrl, affectedModules: MODULES.filter((moduleName) => researchTopic.toLowerCase().includes(moduleName.toLowerCase())) }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to queue research.");
      setResearchTopic("");
      setResearchQuestion("");
      setResearchUrl("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to queue research.");
    } finally {
      setBusy(false);
    }
  };

  const updateSourceTrust = async (source: ApprovedSourceRow, trustLevel: GusLearningTrustLevel) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/gus-learning/sources/${source.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ trustLevel }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to update source trust.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update source trust.");
    } finally {
      setBusy(false);
    }
  };

  const archiveKnowledgeItem = async (row: ApprovedKnowledgeRow) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/gus-learning/knowledge/${row.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", reason: "Archived from Gus learning review dashboard." }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to archive knowledge.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to archive knowledge.");
    } finally {
      setBusy(false);
    }
  };

  const updateReviewItem = async (row: GusLearningReviewItemRow, action: "start_review" | "resolve" | "archive") => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/gus-learning/review-items/${row.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewNotes: action === "resolve" ? "Resolved from Gus learning review dashboard." : "Updated from Gus learning review dashboard." }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to update review item.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update review item.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="space-y-6">
      <PageHero
        eyebrow="Gus Verified Learning Engine"
        title="Gus learning review"
        description="Review internet research, approve verified safety knowledge, manage source trust, and keep Gus from turning unapproved content into official guidance."
        actions={
          <button type="button" onClick={() => void load()} className={appButtonSecondaryClassName}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      {error ? <InlineMessage tone="error" onRetry={() => void load()}>{error}</InlineMessage> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[var(--app-border)] bg-white/95 p-4 shadow-[var(--app-shadow-soft)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{loading ? "..." : stat.value}</p>
          </div>
        ))}
      </div>

      <SectionCard eyebrow="Queue" title="Pending research findings" description="Findings stay here until a company admin approves, rejects, or requests more review.">
        {overview?.pendingResearch.length ? overview.pendingResearch.map((row) => <PendingFinding key={row.id} row={row} token={token} onDone={() => void load()} />) : <EmptyState title="No pending findings" description="Approved-source research requests will appear here for human review." align="left" />}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard eyebrow="Answer review" title="Learning review items" description="Feedback and weak evidence are routed here before they become research or knowledge changes.">
          {(overview?.reviewItems ?? []).length ? overview?.reviewItems.slice(0, 10).map((row) => (
            <RowShell key={row.id}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-bold text-[var(--app-text-strong)]">{row.title}</p>
                  <p className="mt-1 text-xs text-[var(--app-muted)]">{row.recommended_admin_action}</p>
                  {row.user_comment ? <p className="mt-2 text-xs text-[var(--app-text)]">{row.user_comment}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={row.item_type.replace(/_/g, " ")} tone="warning" />
                  <StatusBadge label={row.status.replace(/_/g, " ")} tone={statusTone(row.status)} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy || row.status === "in_review"} onClick={() => void updateReviewItem(row, "start_review")} className={appButtonSecondaryClassName}>
                  <Eye className="h-4 w-4" />
                  Review
                </button>
                <button type="button" disabled={busy} onClick={() => void updateReviewItem(row, "resolve")} className={appButtonPrimaryClassName}>
                  <ClipboardCheck className="h-4 w-4" />
                  Resolve
                </button>
              </div>
            </RowShell>
          )) : <EmptyState title="No learning review items" description="Unsafe, incorrect, missing-source, weak-citation, and expired-source issues will appear here." align="left" icon={Flag} />}
        </SectionCard>

        <SectionCard eyebrow="Answer audit" title="Recent verified answers" description="Trace what Gus retrieved, cited, and rejected for recent verified answers.">
          {(overview?.answerAudits ?? []).length ? overview?.answerAudits.slice(0, 10).map((row) => (
            <RowShell key={row.id}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-bold text-[var(--app-text-strong)]">{row.question}</p>
                  <p className="mt-1 text-xs text-[var(--app-muted)]">
                    {row.retrieval_method} retrieval · {row.selected_knowledge_ids.length} cited · {row.rejected_candidate_ids.length} rejected
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={row.confidence} tone={row.confidence === "High" ? "success" : row.confidence === "Medium" ? "warning" : "error"} />
                  {row.unsupported ? <StatusBadge label="unsupported" tone="error" /> : null}
                  {row.needs_review ? <StatusBadge label="needs review" tone="warning" /> : null}
                </div>
              </div>
            </RowShell>
          )) : <EmptyState title="No answer audits" description="Verified-answer trace records will appear after users ask Gus safety questions." align="left" icon={Gauge} />}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard eyebrow="Research" title="Request approved-source research" description="Gus will fetch only active, non-blocked approved sources.">
          <input value={researchTopic} onChange={(e) => setResearchTopic(e.target.value)} className="w-full rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm" placeholder="Topic, e.g. trenching protective systems" />
          <textarea value={researchQuestion} onChange={(e) => setResearchQuestion(e.target.value)} rows={3} className="w-full rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm" placeholder="Question Gus should research" />
          <input value={researchUrl} onChange={(e) => setResearchUrl(e.target.value)} className="w-full rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm" placeholder="Approved source URL" />
          <button type="button" disabled={busy || !researchTopic || !researchQuestion || !researchUrl} onClick={() => void requestResearch()} className={appButtonPrimaryClassName}>
            <FileSearch className="h-4 w-4" />
            Queue research
          </button>
        </SectionCard>

        <SectionCard eyebrow="Sources" title="Source management" description="Only active approved sources can be researched. Blocked sources are never used.">
          <div className="grid gap-2">
            <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm" placeholder="Source name" />
            <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm" placeholder="Source URL" />
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value as (typeof SOURCE_TYPES)[number])} className={appNativeSelectClassName}>
              {SOURCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <button type="button" disabled={busy || !sourceName || !sourceUrl} onClick={() => void addSource()} className={appButtonPrimaryClassName}>
              <Plus className="h-4 w-4" />
              Add source
            </button>
          </div>
          <div className="space-y-2">
            {(overview?.sources ?? []).slice(0, 8).map((source) => (
              <RowShell key={source.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-[var(--app-text-strong)]">{source.source_name}</p>
                    <p className="text-xs text-[var(--app-muted)]">{source.domain} · {source.jurisdiction}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={source.trust_level} tone={source.trust_level === "blocked" ? "error" : source.trust_level === "high" ? "success" : "warning"} />
                    {(["high", "medium", "low", "blocked"] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        disabled={busy || source.trust_level === level}
                        onClick={() => void updateSourceTrust(source, level)}
                        className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--app-text-strong)] disabled:opacity-45"
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </RowShell>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard eyebrow="Approved" title="Approved findings" description="Approved findings are now available to Gus as verified knowledge.">
          {(overview?.approvedFindings ?? []).length ? overview?.approvedFindings.slice(0, 8).map((row) => (
            <RowShell key={row.id}>
              <p className="text-sm font-bold text-[var(--app-text-strong)]">{row.topic}</p>
              <p className="mt-1 text-xs text-[var(--app-muted)]">{moduleList(row.affected_modules)}</p>
              <StatusBadge label={row.status} tone="success" />
            </RowShell>
          )) : <EmptyState title="No approved findings yet" description="Approved research will appear here after human review." align="left" />}
        </SectionCard>

        <SectionCard eyebrow="Rejected" title="Rejected findings" description="Rejected content is kept for audit context but is not used as verified knowledge.">
          {(overview?.rejectedFindings ?? []).length ? overview?.rejectedFindings.slice(0, 8).map((row) => (
            <RowShell key={row.id}>
              <p className="text-sm font-bold text-[var(--app-text-strong)]">{row.topic}</p>
              <p className="mt-1 text-xs text-[var(--app-muted)]">{row.reviewer_notes || "Rejected without notes"}</p>
              <StatusBadge label={row.status} tone="error" />
            </RowShell>
          )) : <EmptyState title="No rejected findings" description="Rejected or unsuitable findings will appear here." align="left" />}
        </SectionCard>
      </div>

      <SectionCard eyebrow="Knowledge" title="Expired knowledge and due reviews" description="Expired knowledge remains viewable, but Gus warns that it may be outdated and prioritizes newer active records.">
        {[...(overview?.expiredKnowledge ?? []), ...(overview?.knowledgeDueForReview ?? [])].slice(0, 12).map((row) => (
          <RowShell key={`${row.id}-${row.review_status}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-bold text-[var(--app-text-strong)]">{row.knowledge_title}</p>
                <p className="mt-1 text-xs text-[var(--app-muted)]">Review due {formatDate(row.review_due_date)} · {row.required_control_type.replace(/_/g, " ")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label={row.review_status.replace(/_/g, " ")} tone={statusTone(row.review_status)} />
                <button type="button" disabled={busy} onClick={() => void archiveKnowledgeItem(row)} className={appButtonQuietClassName}>
                  <Archive className="h-4 w-4" />
                  Archive
                </button>
              </div>
            </div>
          </RowShell>
        ))}
        {!(overview?.expiredKnowledge.length || overview?.knowledgeDueForReview.length) ? <EmptyState title="No review-due knowledge" description="Approved knowledge is current based on configured review dates." align="left" icon={ShieldCheck} /> : null}
      </SectionCard>

      <SectionCard eyebrow="Citation quality" title="Weak citations and low-quality knowledge" description="These records are still visible to admins, but Gus de-prioritizes them until citations and review notes improve.">
        {(overview?.weakCitationKnowledge ?? []).length ? overview?.weakCitationKnowledge.slice(0, 12).map((row) => (
          <RowShell key={row.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-bold text-[var(--app-text-strong)]">{row.knowledge_title}</p>
                <p className="mt-1 text-xs text-[var(--app-muted)]">
                  {row.citation_locator || "No citation locator"} · {row.citation_excerpt ? "Excerpt present" : "Missing excerpt"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label={`quality ${Math.round(Number(row.quality_score ?? 0))}`} tone={qualityTone(Number(row.quality_score ?? 0))} />
                <StatusBadge label={row.required_control_type.replace(/_/g, " ")} tone="info" />
              </div>
            </div>
          </RowShell>
        )) : <EmptyState title="No weak citations" description="Approved knowledge has enough citation detail for the current quality threshold." align="left" />}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard eyebrow="Feedback" title="Flagged Gus answers" description="Unsafe, incorrect, and missing-source feedback is sent here for review.">
          {(overview?.feedbackForReview ?? []).length ? overview?.feedbackForReview.slice(0, 10).map((row) => (
            <RowShell key={row.id}>
              <p className="text-sm font-bold text-[var(--app-text-strong)]">{row.feedback_type.replace(/_/g, " ")}</p>
              <p className="mt-1 text-xs text-[var(--app-muted)]">{row.comment || row.answer_id}</p>
            </RowShell>
          )) : <EmptyState title="No flagged answers" description="Gus answer feedback that needs admin review will appear here." align="left" />}
        </SectionCard>

        <SectionCard eyebrow="Audit" title="Change log" description="Knowledge changes are retained for traceability.">
          {(overview?.changeLog ?? []).length ? overview?.changeLog.slice(0, 10).map((row) => (
            <RowShell key={row.id}>
              <p className="text-sm font-bold text-[var(--app-text-strong)]">{row.change_type}</p>
              <p className="mt-1 text-xs text-[var(--app-muted)]">{row.change_reason || "No reason entered"} · {formatDate(row.created_at)}</p>
            </RowShell>
          )) : <EmptyState title="No changes logged" description="Approvals, edits, archives, and expirations will appear here." align="left" />}
        </SectionCard>
      </div>
    </main>
  );
}
