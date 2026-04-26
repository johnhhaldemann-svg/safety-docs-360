"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CompanyMemoryBankPanel } from "@/components/company-ai/CompanyMemoryBankPanel";
import { buildAdoptionChecklist } from "@/components/dashboard/onboardingChecklist";
import { emptyOnboardingState, type OnboardingState } from "@/lib/onboardingState";
import {
  ActionTile,
  EmptyState,
  InlineMessage,
  MetricTile,
  PageHero,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonQuietClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";
import {
  buildSafetyManagerWorkflowRails,
  buildCommandCenterNotices,
  getRecommendationsEmptyMessage,
  getRiskMemoryEmptyMessage,
  summarizeOpenWork,
  type WorkspaceSummary,
} from "@/components/command-center/model";
import { InductionReadinessCard } from "@/components/command-center/InductionReadinessCard";
import { fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

type AnalyticsSummaryPayload = {
  summary?: {
    companyDashboard?: {
      totalOpenObservations?: number;
      openIncidents?: number;
      totalActiveJobsites?: number;
    };
    riskMemory?: {
      windowDays?: number;
      facetCount?: number;
      topScopes?: Array<{ code: string | null; count: number }>;
      topHazards?: Array<{ code: string | null; count: number }>;
      aggregatedWithBaseline?: { score: number; band: string };
      aggregated?: { score: number; band: string; sampleSize?: number };
    };
    riskMemoryRecommendations?: Array<{
      id: string;
      kind: string;
      title: string;
      body: string;
      confidence: number;
      created_at: string;
    }>;
  };
  warning?: string;
  error?: string;
};

type CommandCenterAdoptionPayload = {
  companyProfile?: {
    name?: string | null;
    industry?: string | null;
    phone?: string | null;
    address_line_1?: string | null;
    city?: string | null;
    state_region?: string | null;
    country?: string | null;
  } | null;
  companyUsers: Array<{ status?: string | null }>;
  companyInvites: Array<{ status?: string | null }>;
  documents: Array<{ status?: string | null; final_file_path?: string | null; draft_file_path?: string | null }>;
  onboardingState: OnboardingState;
};

function LaunchCard({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[var(--app-border-strong)] bg-white/90 p-4 shadow-[var(--app-shadow-soft)] transition hover:-translate-y-0.5 hover:border-[var(--app-accent-surface-35)]"
    >
      <p className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{description}</p>
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-accent-primary)]">{label}</p>
    </Link>
  );
}

function StatTile({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number | string;
  href: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-[var(--app-border-strong)] bg-white/88 px-4 py-4 shadow-[var(--app-shadow-soft)] transition hover:border-[var(--app-accent-surface-35)]"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--app-text)]">{label}</span>
      <span className="mt-2 text-2xl font-bold tracking-tight text-[var(--app-text-strong)]">{value}</span>
      {hint ? <span className="mt-2 text-xs leading-5 text-[var(--app-text)]">{hint}</span> : null}
    </Link>
  );
}

function rollupTone(band: string) {
  const value = band.trim().toLowerCase();
  if (value.includes("high") || value.includes("critical") || value.includes("severe")) return "error" as const;
  if (value.includes("moderate") || value.includes("elevated")) return "warning" as const;
  if (!value || value === "-") return "neutral" as const;
  return "success" as const;
}

export function CommandCenterWorkspace() {
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsSummaryPayload | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [analyticsErr, setAnalyticsErr] = useState("");
  const [workspaceErr, setWorkspaceErr] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [adoption, setAdoption] = useState<CommandCenterAdoptionPayload>({
    companyProfile: null,
    companyUsers: [],
    companyInvites: [],
    documents: [],
    onboardingState: emptyOnboardingState(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    setAnalyticsErr("");
    setWorkspaceErr("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setAnalyticsErr("Sign in to load Command Center.");
        setWorkspace(null);
        setAnalytics(null);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const [
        analyticsResponse,
        workspaceResponse,
        meResponse,
        usersResponse,
        documentsResponse,
        onboardingResponse,
      ] = await Promise.all([
        fetchWithTimeoutSafe(`/api/company/analytics/summary?days=${days}`, { headers }, 20000, "Analytics"),
        fetchWithTimeoutSafe("/api/company/workspace/summary", { headers }, 20000, "Workspace"),
        fetchWithTimeoutSafe("/api/auth/me", { headers }, 15000, "Current user"),
        fetchWithTimeoutSafe("/api/company/users", { headers }, 15000, "Company users"),
        fetchWithTimeoutSafe("/api/workspace/documents", { headers }, 15000, "Workspace documents"),
        fetchWithTimeoutSafe(
          "/api/onboarding/state",
          {
            method: "PATCH",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ markCommandCenterViewed: true }),
          },
          15000,
          "Onboarding state"
        ),
      ]);

      const analyticsJson = (await analyticsResponse.json().catch(() => null)) as AnalyticsSummaryPayload | null;
      const workspaceJson = (await workspaceResponse.json().catch(() => null)) as WorkspaceSummary | null;
      const meJson = (await meResponse.json().catch(() => null)) as
        | { user?: { companyProfile?: CommandCenterAdoptionPayload["companyProfile"] } }
        | null;
      const usersJson = (await usersResponse.json().catch(() => null)) as
        | {
            users?: CommandCenterAdoptionPayload["companyUsers"];
            invites?: CommandCenterAdoptionPayload["companyInvites"];
          }
        | null;
      const documentsJson = (await documentsResponse.json().catch(() => null)) as
        | { documents?: CommandCenterAdoptionPayload["documents"] }
        | null;
      const onboardingJson = (await onboardingResponse.json().catch(() => null)) as OnboardingState | null;

      if (!analyticsResponse.ok) {
        setAnalyticsErr(analyticsJson?.error || "Could not load analytics summary.");
        setAnalytics(null);
      } else {
        setAnalytics(analyticsJson);
      }

      if (!workspaceResponse.ok) {
        setWorkspaceErr(workspaceJson?.error || "Could not load workspace summary.");
        setWorkspace(null);
      } else {
        setWorkspace(workspaceJson);
      }

      setAdoption({
        companyProfile: meResponse.ok ? meJson?.user?.companyProfile ?? null : null,
        companyUsers: usersResponse.ok ? usersJson?.users ?? [] : [],
        companyInvites: usersResponse.ok ? usersJson?.invites ?? [] : [],
        documents: documentsResponse.ok ? documentsJson?.documents ?? [] : [],
        onboardingState:
          onboardingResponse.ok && onboardingJson ? onboardingJson : emptyOnboardingState(),
      });

      setLastLoadedAt(new Date());
    } catch (error) {
      setAnalyticsErr(error instanceof Error ? error.message : "Failed to load Command Center.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const openWork = useMemo(() => summarizeOpenWork(workspace), [workspace]);
  const notices = useMemo(
    () =>
      buildCommandCenterNotices({
        warning: analytics?.warning ?? null,
        analyticsError: analyticsErr,
        workspaceError: workspaceErr,
      }),
    [analytics?.warning, analyticsErr, workspaceErr]
  );

  const risk = analytics?.summary?.riskMemory;
  const companyDashboard = analytics?.summary?.companyDashboard;
  const recommendations = analytics?.summary?.riskMemoryRecommendations ?? [];
  const workflowRails = useMemo(() => buildSafetyManagerWorkflowRails(openWork), [openWork]);
  const band = risk?.aggregatedWithBaseline?.band ?? risk?.aggregated?.band ?? "-";
  const score = risk?.aggregatedWithBaseline?.score ?? risk?.aggregated?.score ?? null;
  const recommendationEmptyMessage = getRecommendationsEmptyMessage(recommendations.length);
  const adoptionChecklist = useMemo(
    () =>
      buildAdoptionChecklist({
        companyProfile: adoption.companyProfile,
        companyUsers: adoption.companyUsers,
        companyInvites: adoption.companyInvites,
        jobsites: (workspace?.jobsites ?? []) as Array<{ status?: string | null }>,
        documents: adoption.documents,
        commandCenterViewed:
          adoption.onboardingState.completedSteps.includes("command_center") ||
          Boolean(adoption.onboardingState.lastSeenCommandCenterAt),
      }),
    [adoption, workspace?.jobsites]
  );

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Command Center"
        title="Intelligence operating hub for safety managers"
        description="Monitor current risk, decide what needs attention, and launch directly into the workflows that move work forward. Everything on this page stays scoped to your company."
        actions={
          <>
            <div className="flex flex-wrap items-center gap-2">
              {([30, 90] as const).map((windowDays) => (
                <button
                  key={windowDays}
                  type="button"
                  onClick={() => setDays(windowDays)}
                  className={[
                    "rounded-full px-3.5 py-2 text-xs font-semibold transition",
                    days === windowDays
                      ? "bg-[var(--app-accent-primary)] text-white shadow-[var(--app-shadow-primary-button)]"
                      : "border border-[var(--app-border-strong)] bg-white/80 text-[var(--app-text-strong)] hover:bg-white",
                  ].join(" ")}
                >
                  {windowDays}d window
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className={`${appButtonPrimaryClassName} disabled:opacity-50`}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </>
        }
      />

      {notices.map((notice) => (
        <InlineMessage key={`${notice.tone}-${notice.message}`} tone={notice.tone}>
          {notice.message}
        </InlineMessage>
      ))}

      {lastLoadedAt ? (
        <p className="text-xs text-[var(--app-text)]">
          Last updated {lastLoadedAt.toLocaleString()}. Open-work counts use the latest workspace snapshot. Risk
          Memory reflects the selected window.
        </p>
      ) : null}

      <SectionCard
        eyebrow="Start Here"
        title="Workspace launch checklist"
        description={`${adoptionChecklist.completedCount} of ${adoptionChecklist.totalCount} adoption milestones complete. Use this path to turn an approved workspace into an active operating system.`}
        aside={
          <StatusBadge
            label={adoptionChecklist.nextItem ? `Next: ${adoptionChecklist.nextItem.label}` : "Launch complete"}
            tone={adoptionChecklist.nextItem ? "warning" : "success"}
          />
        }
        tone="attention"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {adoptionChecklist.items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="rounded-2xl border border-[var(--app-border)] bg-white/90 px-4 py-4 shadow-[var(--app-shadow-soft)] transition hover:border-[var(--app-accent-border-28)]"
            >
              <StatusBadge label={item.complete ? "Done" : "Next"} tone={item.complete ? "success" : "warning"} />
              <p className="mt-3 text-sm font-semibold text-[var(--app-text-strong)]">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{item.note}</p>
            </Link>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Today / Attention"
        title="What needs attention now"
        description="Start here before you move into the detailed workflow screens. These cards summarize the live work picture safety managers care about most."
        tone="attention"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            eyebrow="Current risk"
            title={band === "-" ? "Awaiting rollup" : band}
            value={score != null ? Number(score).toFixed(1) : "-"}
            detail="Risk Memory score for the selected window."
            tone="attention"
          />
          <MetricTile
            eyebrow="Open work"
            title="Issues"
            value={String(openWork.openObservations)}
            detail={`${openWork.overdueObservations} overdue and ${openWork.openIncidents} incident${openWork.openIncidents === 1 ? "" : "s"} still open.`}
          />
          <MetricTile
            eyebrow="Permit pressure"
            title="Active permits"
            value={String(openWork.activePermits)}
            detail={`${openWork.stopWorkPermits} permit${openWork.stopWorkPermits === 1 ? "" : "s"} with stop-work status need review.`}
          />
          <MetricTile
            eyebrow="In progress"
            title="JSAs + reports"
            value={String(openWork.openJsas + openWork.openReports)}
            detail={`${openWork.openJsas} JSA${openWork.openJsas === 1 ? "" : "s"} and ${openWork.openReports} report draft${openWork.openReports === 1 ? "" : "s"} are still moving.`}
          />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Workflow Rails"
        title="Core operator paths"
        description="Use these rails to move from signal to action without hunting through separate modules."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {workflowRails.map((rail) => (
            <ActionTile
              key={rail.title}
              eyebrow={rail.tone === "warning" ? "Needs attention" : "Guided flow"}
              title={rail.title}
              description={rail.description}
              href={rail.href}
              actionLabel={rail.actionLabel}
              tone={rail.tone === "warning" ? "attention" : rail.tone === "info" ? "elevated" : "panel"}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Work Area"
        title="Current Risk"
        description="Start with the current risk rollup, then jump straight into the workflow or drill-down surface that matches the decision you need to make."
        aside={<StatusBadge label={band === "-" ? "Awaiting rollup" : band} tone={rollupTone(band)} />}
      >
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/90 p-5 shadow-[var(--app-shadow-soft)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Risk Memory</p>
              {risk ? (
                <>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <p className="text-4xl font-bold tracking-tight text-[var(--app-text-strong)]">{band}</p>
                    {score != null ? (
                      <p className="text-sm font-semibold text-[var(--app-text)]">Score {Number(score).toFixed(1)}</p>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">
                    {risk.facetCount ?? 0} facets in the last {risk.windowDays ?? days} days. Use this as the executive
                    signal before moving into workflow triage.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-[var(--app-text)]">{getRiskMemoryEmptyMessage(loading)}</p>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/90 p-5 shadow-[var(--app-shadow-soft)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Coverage</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-2xl font-bold tracking-tight text-[var(--app-text-strong)]">
                    {companyDashboard ? (companyDashboard.totalOpenObservations ?? 0) : "-"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--app-text)]">
                    {companyDashboard ? "open issues in range" : "awaiting analytics sync"}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight text-[var(--app-text-strong)]">
                    {companyDashboard ? (companyDashboard.totalActiveJobsites ?? 0) : "-"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--app-text)]">
                    {companyDashboard ? "active jobsites" : "awaiting analytics sync"}
                  </p>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <InductionReadinessCard />
            </div>

            <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 p-5 shadow-[var(--app-shadow-soft)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Top scopes</p>
              <div className="mt-4 space-y-2">
                {(risk?.topScopes ?? []).slice(0, 4).map((row, index) => (
                  <div
                    key={`${row.code ?? "scope"}-${index}`}
                    className="flex items-center justify-between rounded-xl bg-[var(--app-panel)] px-3 py-2.5"
                  >
                    <span className="text-sm font-medium text-[var(--app-text-strong)]">{row.code ?? "Unmapped"}</span>
                    <strong className="text-[var(--app-accent-primary)]">{row.count}</strong>
                  </div>
                ))}
                {!risk?.topScopes?.length ? (
                  <p className="text-sm text-[var(--app-text)]">Scope rollups will appear here when Risk Memory is available.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 p-5 shadow-[var(--app-shadow-soft)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Top hazards</p>
              <div className="mt-4 space-y-2">
                {(risk?.topHazards ?? []).slice(0, 4).map((row, index) => (
                  <div
                    key={`${row.code ?? "hazard"}-${index}`}
                    className="flex items-center justify-between rounded-xl bg-[var(--app-panel)] px-3 py-2.5"
                  >
                    <span className="text-sm font-medium text-[var(--app-text-strong)]">{row.code ?? "Unmapped"}</span>
                    <strong className="text-[var(--semantic-warning)]">{row.count}</strong>
                  </div>
                ))}
                {!risk?.topHazards?.length ? (
                  <p className="text-sm text-[var(--app-text)]">Hazard concentration will appear here when signals are available.</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <LaunchCard
              href="/safety-intelligence"
              title="Start Safety Intelligence workflow"
              description="Move from executive signal into intake, rules, conflicts, and document generation."
              label="Run workflow"
            />
            <LaunchCard
              href="/analytics/safety-intelligence"
              title="View Safety Intelligence analytics"
              description="Open the drill-down companion page for throughput, conflicts, and generated document volume."
              label="Open analytics"
            />
            <LaunchCard
              href="/analytics"
              title="Open Risk Memory analytics"
              description="Inspect the full trend view when the rollup needs deeper analysis before action."
              label="Drill down"
            />
            <LaunchCard
              href="/settings/risk-memory"
              title="Tune Risk Memory setup"
              description="Adjust taxonomy and configuration without leaving the intelligence operating model."
              label="Configure"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Work Area"
        title="Open Work"
        description="Use the current workload picture to decide where human follow-up is needed before or after smart-generated outputs."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Open issues"
            value={openWork.openObservations}
            href="/field-id-exchange"
            hint="Corrective actions not verified closed"
          />
          <StatTile label="Overdue issues" value={openWork.overdueObservations} href="/field-id-exchange" hint="Open items past due" />
          <StatTile label="Open incidents" value={openWork.openIncidents} href="/incidents" />
          <StatTile label="Active permits" value={openWork.activePermits} href="/permits" />
          <StatTile label="Stop work" value={openWork.stopWorkPermits} href="/permits" hint="Requested or active" />
          <StatTile label="JSAs in flight" value={openWork.openJsas} href="/jsa" />
          <StatTile label="Reports draft" value={openWork.openReports} href="/reports" />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Recommended Next Step"
        title="Recommended Actions"
        description="Stored recommendations stay company-scoped. Use them as the action list that sits between the risk rollup and the execution workflow."
      >
        {recommendationEmptyMessage ? (
          <EmptyState
            title="No smart recommendations yet"
            description={recommendationEmptyMessage}
            actionHref="/analytics"
            actionLabel="Open Risk Memory analytics"
          />
        ) : (
          <div className="grid gap-3">
            {recommendations.map((recommendation) => (
              <div
                key={recommendation.id}
                className="rounded-2xl border border-[var(--app-border-strong)] bg-white/90 px-4 py-4 shadow-[var(--app-shadow-soft)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--app-text-strong)]">{recommendation.title}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--app-text)]">{recommendation.body}</p>
                  </div>
                  <StatusBadge
                    label={`${recommendation.kind} - ${Math.round((recommendation.confidence ?? 0) * 100)}%`}
                    tone="info"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Supporting Context"
        title="Company Knowledge"
        description="Keep reusable company context close to the hub so assistants and downstream workflows can stay grounded in your actual procedures."
      >
        <div className="grid gap-4 lg:grid-cols-[0.3fr_0.7fr]">
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] p-4">
            <p className="text-sm font-semibold text-[var(--app-text-strong)]">What belongs here</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--app-text)]">
              <li>Company procedures and recurring site rules</li>
              <li>Lessons learned worth reusing across jobsites</li>
              <li>Uploaded references that intelligence workflows should retrieve later</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/safety-intelligence"
                className={appButtonQuietClassName.replace("rounded-xl", "rounded-full").replace("px-4 py-2.5", "px-3 py-1.5").replace("text-sm", "text-xs")}
              >
                Open workflow
              </Link>
              <Link
                href="/analytics"
                className={appButtonSecondaryClassName.replace("rounded-xl", "rounded-full").replace("px-4 py-2.5", "px-3 py-1.5").replace("text-sm", "text-xs")}
              >
                Open analytics
              </Link>
            </div>
          </div>
          <CompanyMemoryBankPanel />
        </div>
      </SectionCard>

      {loading ? <InlineMessage tone="neutral">Refreshing Command Center data...</InlineMessage> : null}
    </div>
  );
}
