"use client";
import { deferEffect } from "@/lib/deferredEffect";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  appButtonPrimaryClassName,
  appButtonQuietClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";

type AiImprovementStatus =
  | "draft"
  | "proposed"
  | "in_progress"
  | "awaiting_super_admin_approval"
  | "approved"
  | "rejected"
  | "merged"
  | "deployed"
  | "failed"
  | "rolled_back";

type AiImprovementRiskLevel = "low" | "medium" | "high" | "critical";

type AiImprovementRequest = {
  id: string;
  title: string;
  description: string;
  proposed_by: string | null;
  created_by_type: "user" | "ai" | "system";
  status: AiImprovementStatus;
  risk_level: AiImprovementRiskLevel;
  affected_area: string;
  branch_name: string | null;
  pull_request_url: string | null;
  latest_commit_sha: string | null;
  test_summary: string;
  codex_summary: string;
  rollback_plan: string;
  checks_passed: boolean;
  super_admin_override_reason: string | null;
  approved_by_super_admin_id: string | null;
  approved_at: string | null;
  rejected_by_super_admin_id: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function riskClass(risk: AiImprovementRiskLevel) {
  if (risk === "critical") return "border-red-300 bg-red-50 text-red-950";
  if (risk === "high") return "border-orange-300 bg-orange-50 text-orange-950";
  if (risk === "medium") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function statusClass(status: AiImprovementStatus) {
  if (status === "approved" || status === "merged" || status === "deployed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (status === "rejected" || status === "failed" || status === "rolled_back") {
    return "border-red-200 bg-red-50 text-red-950";
  }
  if (status === "awaiting_super_admin_approval") {
    return "border-blue-200 bg-blue-50 text-blue-950";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function isApprovalOpen(status: AiImprovementStatus) {
  return (
    status === "proposed" ||
    status === "in_progress" ||
    status === "awaiting_super_admin_approval"
  );
}

function DetailBlock({ labelText, value }: { labelText: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
        {labelText}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--app-text)]">
        {value || "Not provided."}
      </p>
    </div>
  );
}

function AiImprovementCard({
  request,
  rejectionReason,
  onReasonChange,
  onApprove,
  onReject,
  busyAction,
}: {
  request: AiImprovementRequest;
  rejectionReason: string;
  onReasonChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  busyAction: string | null;
}) {
  const highRisk = request.risk_level === "high" || request.risk_level === "critical";
  const canAct = isApprovalOpen(request.status);
  const approving = busyAction === `approve:${request.id}`;
  const rejecting = busyAction === `reject:${request.id}`;

  return (
    <article className="rounded-xl border border-[var(--app-border)] bg-white p-5 shadow-[0_10px_22px_rgba(44,58,86,0.055)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(request.status)}`}>
              {label(request.status)}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${riskClass(request.risk_level)}`}>
              {label(request.risk_level)} risk
            </span>
            {request.checks_passed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Checks passed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-950">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Checks pending
              </span>
            )}
          </div>
          <h2 className="mt-3 text-xl font-black text-[var(--app-text-strong)]">
            {request.title}
          </h2>
          <p className="mt-2 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-[var(--app-text)]">
            {request.description || "No description provided."}
          </p>
        </div>
        <div className="text-left text-xs leading-5 text-[var(--app-muted)] lg:text-right">
          <p className="font-bold text-[var(--app-text-strong)]">Created</p>
          <p>{formatDate(request.created_at)}</p>
          <p className="mt-2">Actor: {label(request.created_by_type)}</p>
        </div>
      </div>

      {highRisk ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-950">
          High-risk or critical AI changes need extra review before approval.
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <DetailBlock labelText="Affected Area" value={request.affected_area} />
        <DetailBlock labelText="Codex Summary" value={request.codex_summary} />
        <DetailBlock labelText="Test Summary" value={request.test_summary} />
        <DetailBlock labelText="Rollback Plan" value={request.rollback_plan} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 font-semibold text-[var(--app-text-strong)]">
          <GitBranch className="h-4 w-4" aria-hidden />
          {request.branch_name || "No branch linked"}
        </span>
        {request.pull_request_url ? (
          <Link href={request.pull_request_url} className={appButtonQuietClassName} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" aria-hidden />
            Open pull request
          </Link>
        ) : (
          <span className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-muted)]">
            No pull request linked
          </span>
        )}
      </div>

      <div className="mt-5 border-t border-[var(--app-border)] pt-4">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
            Rejection Reason
          </span>
          <textarea
            value={rejectionReason}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={3}
            disabled={!canAct || approving || rejecting}
            className="w-full rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)] disabled:cursor-not-allowed disabled:bg-slate-50"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onApprove}
            disabled={!canAct || approving || rejecting}
            className={`${appButtonPrimaryClassName} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {approving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
            Approve
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={!canAct || approving || rejecting}
            className={`${appButtonSecondaryClassName} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {rejecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
            Reject
          </button>
        </div>
      </div>
    </article>
  );
}

export default function SuperadminAiImprovementsPage() {
  const [requests, setRequests] = useState<AiImprovementRequest[]>([]);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const summary = useMemo(() => {
    return {
      total: requests.length,
      awaiting: requests.filter((request) => request.status === "awaiting_super_admin_approval").length,
      highRisk: requests.filter((request) => request.risk_level === "high" || request.risk_level === "critical").length,
    };
  }, [requests]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/superadmin/ai-improvements", {
        credentials: "include",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as {
        requests?: AiImprovementRequest[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error || "Could not load AI improvement requests.");
      }
      setRequests(body.requests ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load AI improvement requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => deferEffect(() => {
    void load();
  }), [load]);

  async function approve(id: string) {
    setBusyAction(`approve:${id}`);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/superadmin/ai-improvements/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorType: "user" }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        request?: AiImprovementRequest;
        error?: string;
      };
      if (!response.ok || !body.request) {
        throw new Error(body.error || "Could not approve AI improvement request.");
      }
      setRequests((current) =>
        current.map((request) => (request.id === id ? body.request as AiImprovementRequest : request))
      );
      setNotice("AI improvement request approved.");
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Could not approve AI improvement request.");
    } finally {
      setBusyAction(null);
    }
  }

  async function reject(id: string) {
    const rejectionReason = rejectionReasons[id]?.trim() ?? "";
    if (!rejectionReason) {
      setError("Rejection reason is required.");
      return;
    }
    setBusyAction(`reject:${id}`);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/superadmin/ai-improvements/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorType: "user", rejectionReason }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        request?: AiImprovementRequest;
        error?: string;
      };
      if (!response.ok || !body.request) {
        throw new Error(body.error || "Could not reject AI improvement request.");
      }
      setRequests((current) =>
        current.map((request) => (request.id === id ? body.request as AiImprovementRequest : request))
      );
      setNotice("AI improvement request rejected.");
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Could not reject AI improvement request.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Super Admin"
        title="AI Improvements"
        description="Review AI-assisted platform changes, risk, pull requests, test evidence, and rollback plans before any production-impacting approval."
        actions={
          <>
            <button type="button" onClick={load} className={appButtonSecondaryClassName}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </button>
            <Link href="/superadmin/ai-engine" className={appButtonSecondaryClassName}>
              AI Engine
            </Link>
          </>
        }
      />

      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      {notice ? <InlineMessage tone="success">{notice}</InlineMessage> : null}

      <SectionCard
        eyebrow="Queue"
        title="Approval Workbench"
        description={`${summary.total} total requests, ${summary.awaiting} awaiting approval, ${summary.highRisk} high or critical risk.`}
      >
        {loading ? (
          <div className="flex items-center gap-3 text-sm font-semibold text-[var(--app-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading AI improvement requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--app-border-strong)] bg-white p-8 text-center">
            <p className="text-sm font-bold text-[var(--app-text-strong)]">No AI improvement requests</p>
            <p className="mt-2 text-sm text-[var(--app-muted)]">
              New AI-assisted change proposals will appear here for Super Admin review.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <AiImprovementCard
                key={request.id}
                request={request}
                rejectionReason={rejectionReasons[request.id] ?? ""}
                onReasonChange={(value) =>
                  setRejectionReasons((current) => ({ ...current, [request.id]: value }))
                }
                onApprove={() => void approve(request.id)}
                onReject={() => void reject(request.id)}
                busyAction={busyAction}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
