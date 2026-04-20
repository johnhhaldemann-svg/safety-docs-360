"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminReviewQueue } from "@/components/safety-intelligence/AdminReviewQueue";
import { DocumentGenerationPanel } from "@/components/safety-intelligence/DocumentGenerationPanel";
import { LiveRiskMatrix } from "@/components/safety-intelligence/LiveRiskMatrix";
import { PermitTriggerPanel } from "@/components/safety-intelligence/PermitTriggerPanel";
import { SafetyReviewPanel } from "@/components/safety-intelligence/SafetyReviewPanel";
import { SimOpsMap } from "@/components/safety-intelligence/SimOpsMap";
import { TradeTaskIntakeForm, type TradeTaskDraft } from "@/components/safety-intelligence/TradeTaskIntakeForm";
import type {
  GeneratedDocumentPayload,
  IntakePayload,
  SafetyReviewPayload,
  SafetyDashboardPayload,
} from "@/components/safety-intelligence/types";
import { buildSafetyWorkspaceStages, getSafetyWorkspaceStatus } from "@/components/safety-intelligence/workspaceModel";
import {
  appNativeSelectClassName,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
  WorkflowPath,
} from "@/components/WorkspacePrimitives";
import { fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Sign in to use Safety Intelligence.");
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

export function SafetyIntelligenceWorkflow({
  jobsiteId,
}: {
  jobsiteId?: string | null;
}) {
  const fixedJobsiteId = jobsiteId ?? null;
  const [dashboard, setDashboard] = useState<SafetyDashboardPayload | null>(null);
  const [documents, setDocuments] = useState<Array<{
    id: string;
    document_type: string;
    title: string;
    status: string;
    generated_at: string;
  }>>([]);
  const [review, setReview] = useState<SafetyReviewPayload | null>(null);
  const [jobsites, setJobsites] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedJobsiteId, setSelectedJobsiteId] = useState<string | null>(fixedJobsiteId);
  const [latestDraft, setLatestDraft] = useState<TradeTaskDraft | null>(null);
  const [latestIntake, setLatestIntake] = useState<IntakePayload | null>(null);
  const [generated, setGenerated] = useState<GeneratedDocumentPayload | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");
  const [loading, setLoading] = useState(true);
  const scopedJobsiteId = fixedJobsiteId ?? selectedJobsiteId;

  useEffect(() => {
    setSelectedJobsiteId(fixedJobsiteId);
  }, [fixedJobsiteId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const jobsiteQuery = scopedJobsiteId ? `?jobsiteId=${encodeURIComponent(scopedJobsiteId)}` : "";
      const requests = [
        fetchWithTimeoutSafe(`/api/company/safety-intelligence/dashboard${jobsiteQuery}`, { headers }, 15000, "Dashboard"),
        fetchWithTimeoutSafe(`/api/company/safety-intelligence/documents/generate${jobsiteQuery}`, { headers }, 15000, "Documents"),
        fetchWithTimeoutSafe(`/api/company/safety-intelligence/review${jobsiteQuery}`, { headers }, 15000, "Review"),
      ] as const;
      const jobsitesRequest = fixedJobsiteId
        ? Promise.resolve(null)
        : fetchWithTimeoutSafe("/api/company/jobsites", { headers }, 15000, "Jobsites");
      const [dashboardRes, docsRes, reviewRes, jobsitesRes] = await Promise.all([
        ...requests,
        jobsitesRequest,
      ]);
      const dashboardJson = (await dashboardRes.json().catch(() => null)) as SafetyDashboardPayload | null;
      const docsJson = (await docsRes.json().catch(() => null)) as { documents?: typeof documents; error?: string } | null;
      const reviewJson = (await reviewRes.json().catch(() => null)) as SafetyReviewPayload | { error?: string } | null;
      const jobsitesJson = jobsitesRes
        ? ((await jobsitesRes.json().catch(() => null)) as
            | { jobsites?: Array<{ id: string; name: string }>; error?: string }
            | null)
        : null;

      if (!dashboardRes.ok) {
        setMessage(dashboardJson && "error" in dashboardJson ? String((dashboardJson as { error?: string }).error) : "Failed to load dashboard.");
        setMessageTone("error");
      } else {
        setDashboard(dashboardJson);
      }

      if (docsRes.ok) {
        setDocuments(docsJson?.documents ?? []);
      }

      if (reviewRes.ok) {
        setReview((reviewJson ?? null) as SafetyReviewPayload | null);
      } else if (!dashboardRes.ok) {
        setReview(null);
      }

      if (jobsitesRes?.ok) {
        setJobsites(jobsitesJson?.jobsites ?? []);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load Safety Intelligence.");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }, [fixedJobsiteId, scopedJobsiteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleIntake = useCallback(
    async (draft: TradeTaskDraft & { jobsiteId?: string | null }) => {
      try {
        const headers = {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        };
        const response = await fetchWithTimeoutSafe(
          "/api/company/safety-intelligence/intake",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              companyId: "workspace",
              jobsiteId: draft.jobsiteId ?? scopedJobsiteId ?? null,
              sourceModule: "manual",
              tradeCode: draft.tradeCode,
              taskTitle: draft.taskTitle,
              description: draft.description,
              workAreaLabel: draft.workAreaLabel,
              startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
              endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
              weatherConditionCode: draft.weatherConditionCode,
            }),
          },
          15000,
          "Task intake"
        );
        const json = (await response.json().catch(() => null)) as IntakePayload & { error?: string };
        if (!response.ok) {
          throw new Error(json?.error || "Failed to run intake.");
        }
        setLatestDraft(draft);
        setLatestIntake(json);
        setGenerated(null);
        setMessage("Intake completed. Rules and conflict evaluation are ready for document generation.");
        setMessageTone("success");
        await load();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to run intake.");
        setMessageTone("error");
      }
    },
    [load, scopedJobsiteId]
  );

  const handleGenerate = useCallback(
    async (documentType: string) => {
      if (!latestDraft) {
        setMessage("Run intake first so Safety Intelligence has a reviewed work package to generate from.");
        setMessageTone("warning");
        return;
      }

      try {
        const headers = {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        };
        const response = await fetchWithTimeoutSafe(
          "/api/company/safety-intelligence/documents/generate",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              documentType,
              input: {
                companyId: "workspace",
                jobsiteId: scopedJobsiteId ?? null,
                sourceModule: "manual",
                tradeCode: latestDraft.tradeCode,
                taskTitle: latestDraft.taskTitle,
                description: latestDraft.description,
                workAreaLabel: latestDraft.workAreaLabel,
                startsAt: latestDraft.startsAt ? new Date(latestDraft.startsAt).toISOString() : null,
                endsAt: latestDraft.endsAt ? new Date(latestDraft.endsAt).toISOString() : null,
                weatherConditionCode: latestDraft.weatherConditionCode,
              },
            }),
          },
          45000,
          "Document generation"
        );
        const json = (await response.json().catch(() => null)) as GeneratedDocumentPayload & { error?: string };
        if (!response.ok) {
          throw new Error(json?.error || "Failed to generate document.");
        }
        setGenerated(json);
        setMessage("Document draft and risk outputs generated. Review queue is ready for the next handoff.");
        setMessageTone("success");
        await load();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to generate document.");
        setMessageTone("error");
      }
    },
    [latestDraft, load, scopedJobsiteId]
  );

  const stages = useMemo(
    () =>
      buildSafetyWorkspaceStages({
        hasDraft: Boolean(latestDraft),
        hasIntake: Boolean(latestIntake),
        hasGenerated: Boolean(generated),
      }),
    [generated, latestDraft, latestIntake]
  );
  const status = getSafetyWorkspaceStatus({ loading, message, messageTone });
  const analyticsHref = scopedJobsiteId ? `/jobsites/${scopedJobsiteId}/analytics` : "/analytics/safety-intelligence";
  const selectedJobsiteName = jobsites.find((candidate) => candidate.id === scopedJobsiteId)?.name ?? null;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Safety Intelligence"
        title={jobsiteId ? "Jobsite execution workflow" : "Guided company workflow"}
        description="Run intake, deterministic rules, conflict checks, and document generation as one staged workflow. AI stays behind the rules engine so the product remains auditable and polished."
        actions={
          <>
            {!fixedJobsiteId ? (
              <label className="flex min-w-[240px] flex-col gap-2 text-sm font-medium text-[var(--app-text-strong)]">
                Review scope
                <select
                  value={selectedJobsiteId ?? ""}
                  onChange={(event) => setSelectedJobsiteId(event.target.value || null)}
                  className={appNativeSelectClassName}
                >
                  <option value="">All company work</option>
                  {jobsites.map((jobsite) => (
                    <option key={jobsite.id} value={jobsite.id}>
                      {jobsite.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <Link
              href="/command-center"
              className="rounded-xl border border-[var(--app-border-strong)] bg-white/85 px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] hover:bg-white"
            >
              Command Center
            </Link>
            <Link
              href={analyticsHref}
              className="rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_22px_rgba(79,125,243,0.22)]"
            >
              View analytics
            </Link>
          </>
        }
      />

      {status ? <InlineMessage tone={status.tone}>{status.message}</InlineMessage> : null}

      <WorkflowPath
        title="Workflow stages"
        description="Each stage is explicit so the user always knows whether they are defining work, reviewing deterministic risk, generating outputs, or handing drafts into queue management."
        steps={stages}
      />

      <SectionCard
        title="Intake"
        description="Capture the work package in a normalized format before the platform evaluates rules or lets AI generate anything."
        aside={<StatusBadge label={latestDraft ? "Captured" : "Waiting for input"} tone={latestDraft ? "success" : "neutral"} />}
      >
        <TradeTaskIntakeForm trades={dashboard?.trades ?? []} onSubmit={handleIntake} initialJobsiteId={scopedJobsiteId} />
      </SectionCard>

      <SectionCard
        title="Rules & conflicts"
        description="This is the deterministic stage. Permit triggers, hazards, controls, training, and simultaneous-operation risks are evaluated before the AI layer can draft outputs."
        aside={
          <StatusBadge
            label={
              scopedJobsiteId
                ? selectedJobsiteName
                  ? `Scoped to ${selectedJobsiteName}`
                  : "Jobsite scope"
                : latestIntake
                  ? "Evaluated"
                  : "Pending intake"
            }
            tone={scopedJobsiteId ? "info" : latestIntake ? "success" : "warning"}
          />
        }
      >
        {!fixedJobsiteId ? (
          <InlineMessage tone="neutral">
            Company-wide review is the default. Switch to a jobsite above to inspect live bucketed work instead of the broader task-library coverage model.
          </InlineMessage>
        ) : null}
        <div className="grid gap-6 xl:grid-cols-2">
          <LiveRiskMatrix summary={dashboard?.summary ?? null} />
          <SimOpsMap conflicts={dashboard?.liveConflicts ?? []} />
        </div>
        <PermitTriggerPanel intake={latestIntake} />
        <SafetyReviewPanel review={review} loading={loading} />
      </SectionCard>

      <SectionCard
        title="Generate"
        description="Generate reviewed drafts only after the work package has been standardized and evaluated. This keeps the output tied to the deterministic context above."
        aside={<StatusBadge label={generated ? "Draft ready" : "Ready when intake is complete"} tone={generated ? "success" : "info"} />}
      >
        <DocumentGenerationPanel onGenerate={handleGenerate} generated={generated} />
      </SectionCard>

      <SectionCard
        title="Review queue"
        description="Generated drafts persist into the company-scoped queue so approvals and publication can happen outside the generation step."
        aside={<StatusBadge label={`${documents.length} queued`} tone={documents.length ? "info" : "neutral"} />}
      >
        <AdminReviewQueue documents={documents} />
      </SectionCard>
    </div>
  );
}
