"use client";

import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  ProvenanceBadge,
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
  const [mainTab, setMainTab] = useState("intake");
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
    <div className="space-y-4 text-[13px]">
      <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/90 px-4 py-3 shadow-[var(--app-shadow-soft)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--app-accent-primary)]">
              Safety Intelligence
            </p>
            <h1 className="mt-1 text-xl font-black leading-tight text-[var(--app-text-strong)]">
              {jobsiteId ? "Jobsite execution workflow" : "Company workflow"}
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--app-text)]">
              Start with one work package, review rule-based coverage, then generate a draft. The detailed queue and diagnostics stay tucked away so this page feels like a workflow, not a report dump.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Link
              href="/command-center"
              className="rounded-lg border border-[var(--app-border-strong)] bg-white/85 px-3 py-2 text-xs font-semibold text-[var(--app-text-strong)] hover:bg-white"
            >
              Command Center
            </Link>
            <Link
              href={analyticsHref}
              className="rounded-lg bg-[var(--app-accent-primary)] px-3 py-2 text-xs font-semibold text-white shadow-[var(--app-shadow-primary-button)]"
            >
              View analytics
            </Link>
          </div>
        </div>
      </div>

      {status ? <InlineMessage tone={status.tone}>{status.message}</InlineMessage> : null}

      <Tabs.Root value={mainTab} onValueChange={setMainTab} className="space-y-4">
        <Tabs.List className="flex flex-wrap gap-1.5 rounded-2xl border border-[var(--app-border-strong)] bg-white/90 p-1.5 shadow-[var(--app-shadow-soft)]">
          {(
            [
              ["intake", "Intake"],
              ["rules", "Rules & conflicts"],
              ["generate", "Generate"],
              ["review", "Review"],
            ] as const
          ).map(([value, label]) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--app-text)] transition data-[state=active]:bg-[var(--app-accent-primary)] data-[state=active]:text-white data-[state=active]:shadow-[var(--app-shadow-primary-button)]"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <WorkflowPath
          title="Workflow progress"
          description="Four stages — complete intake before generating so outputs stay rule-grounded."
          steps={stages.map((stage) => ({
            label: stage.label,
            detail: stage.detail,
            active: stage.active,
            complete: stage.complete,
          }))}
        />

        <Tabs.Content value="intake" className="outline-none">
          <WorkflowPanel
            eyebrow="Stage 1"
            title="Capture work package"
            description="Enter the task once. Safety Intelligence uses this as the source for rules, conflicts, and generation."
            aside={<StatusBadge label={latestDraft ? "Captured" : "Waiting"} tone={latestDraft ? "success" : "neutral"} />}
          >
            {!fixedJobsiteId ? (
              <label className="mb-4 grid max-w-md gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--app-text)]">
                Review scope
                <select
                  value={selectedJobsiteId ?? ""}
                  onChange={(event) => setSelectedJobsiteId(event.target.value || null)}
                  className={`${appNativeSelectClassName} h-9 text-xs normal-case tracking-normal`}
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
            <TradeTaskIntakeForm trades={dashboard?.trades ?? []} onSubmit={handleIntake} initialJobsiteId={scopedJobsiteId} />
          </WorkflowPanel>
        </Tabs.Content>

        <Tabs.Content value="rules" className="outline-none">
          <WorkflowPanel
            eyebrow="Stage 2"
            title="Rules & conflicts"
            description="Deterministic checks before anything is generated."
            aside={
              <div className="flex flex-wrap items-center gap-2">
                <ProvenanceBadge kind="rules" />
                <StatusBadge
                  label={
                    scopedJobsiteId
                      ? selectedJobsiteName
                        ? selectedJobsiteName
                        : "Jobsite"
                      : latestIntake
                        ? "Evaluated"
                        : "Pending"
                  }
                  tone={scopedJobsiteId ? "info" : latestIntake ? "success" : "warning"}
                />
              </div>
            }
          >
            {!fixedJobsiteId ? (
              <InlineMessage tone="neutral">
                Company-wide review is broad. Pick a jobsite in Intake when you want a tighter field-ready view.
              </InlineMessage>
            ) : null}
            <LiveRiskMatrix summary={dashboard?.summary ?? null} />
            <div className="mt-4 space-y-3">
              <SimOpsMap conflicts={dashboard?.liveConflicts ?? []} />
              <PermitTriggerPanel intake={latestIntake} />
            </div>
          </WorkflowPanel>
        </Tabs.Content>

        <Tabs.Content value="generate" className="outline-none">
          <WorkflowPanel
            eyebrow="Stage 3"
            title="Generate draft"
            description="Generate after intake so the draft is tied to the rule context."
            aside={<StatusBadge label={generated ? "Ready" : "Draft"} tone={generated ? "success" : "info"} />}
          >
            <DocumentGenerationPanel onGenerate={handleGenerate} generated={generated} />
          </WorkflowPanel>
        </Tabs.Content>

        <Tabs.Content value="review" className="outline-none space-y-4">
          <WorkflowPanel
            eyebrow="Stage 4"
            title="Review queue"
            description="Recent generated drafts waiting for approval."
            aside={<StatusBadge label={`${documents.length}`} tone={documents.length ? "info" : "neutral"} />}
          >
            <AdminReviewQueue documents={documents} />
          </WorkflowPanel>
          <WorkflowPanel eyebrow="Coverage" title="Permit · training · PPE review" description="Rule-based gap list for the current scope.">
            <SafetyReviewPanel review={review} loading={loading} />
          </WorkflowPanel>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function WorkflowPanel({
  eyebrow,
  title,
  description,
  aside,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--app-border-strong)] bg-white/90 p-4 shadow-[var(--app-shadow-soft)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--app-text)]">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-0.5 text-base font-black leading-tight text-[var(--app-text-strong)]">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-[var(--app-text)]">{description}</p> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}
