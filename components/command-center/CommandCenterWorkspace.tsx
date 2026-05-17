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
  ProvenanceBadge,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonQuietClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";
import type { SafetyDashboardPayload } from "@/components/safety-intelligence/types";
import {
  buildSafetyManagerWorkflowRails,
  buildCommandCenterNotices,
  getRecommendationsEmptyMessage,
  getRiskMemoryEmptyMessage,
  summarizeOpenWork,
  type WorkspaceSummary,
} from "@/components/command-center/model";
import { InductionReadinessCard } from "@/components/command-center/InductionReadinessCard";
import { PredictiveModelView } from "@/components/analytics/PredictiveModelView";
import { AppTabBar } from "@/components/AppTabBar";
import { Sparkline } from "@/components/metrics/Sparkline";
import { TrustSummaryPanel } from "@/components/leadership/TrustSummaryPanel";
import { useUrlTabState } from "@/hooks/useUrlTabState";
import { canAccessCompanyWorkspaceHref } from "@/lib/companyFeatureAccess";
import { fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import type { AnalyticsSummary } from "@/components/analytics/types";
import type { PredictiveRiskPayload } from "@/lib/predictiveRisk";
import type { PermissionMap } from "@/lib/rbac";
import type { WorkspaceProduct } from "@/lib/workspaceProduct";

const COMMAND_CENTER_HUB_TABS = ["overview", "risk-memory", "predictive-risk", "insights", "open-work"] as const;
const COMMAND_CENTER_URL_TABS = [...COMMAND_CENTER_HUB_TABS, "risk"] as const;
const INSIGHTS_SECTIONS = ["recommendations", "safety-intelligence", "knowledge"] as const;
const INSIGHTS_SECTION_LABELS: Record<InsightsSection, string> = {
  recommendations: "Recommendations",
  "safety-intelligence": "Safety Intelligence",
  knowledge: "Company Knowledge",
};

const supabase = getSupabaseBrowserClient();

type HubTab = (typeof COMMAND_CENTER_HUB_TABS)[number];
type InsightsSection = (typeof INSIGHTS_SECTIONS)[number];

type AnalyticsSummaryPayload = {
  summary?: AnalyticsSummary;
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

type BuilderAccess = {
  csep: boolean;
  peshep: boolean;
};

function formatCategory(raw: string | null | undefined) {
  const value = String(raw ?? "").trim();
  if (!value) return "Unmapped";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function metricValue(value: number | null | undefined) {
  return value == null ? "-" : String(value);
}

function rollupTone(band: string) {
  const value = band.trim().toLowerCase();
  if (value.includes("high") || value.includes("critical") || value.includes("severe")) return "error" as const;
  if (value.includes("moderate") || value.includes("elevated")) return "warning" as const;
  if (!value || value === "-") return "neutral" as const;
  return "success" as const;
}

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

function RiskMemoryDetails({
  risk,
  trend,
}: {
  risk: AnalyticsSummary["riskMemory"] | undefined;
  trend: AnalyticsSummary["riskMemoryTrend"] | undefined;
}) {
  if (!risk) return null;

  return (
    <div className="space-y-4">
      {trend && trend.points.length > 0 ? (
        <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 px-4 py-4 shadow-[var(--app-shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">30-day company risk score</p>
              <p className="mt-1 text-xs text-[var(--app-muted)]">Persisted nightly by the Risk Memory rollup.</p>
            </div>
            {trend.latest ? (
              <div className="text-right">
                <p className="text-2xl font-bold text-[var(--app-text-strong)]">{trend.latest.score.toFixed(1)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-muted)]">{trend.latest.band}</p>
              </div>
            ) : null}
          </div>
          <div className="mt-3">
            <Sparkline
              points={trend.points.map((point) => ({ date: point.date, count: point.score }))}
              windowDays={30}
              loading={false}
              variant="compact"
            />
          </div>
          {trend.deltaScore != null ? (
            <p className="mt-2 text-xs text-[var(--app-muted)]">
              {trend.deltaScore > 0 ? "+" : ""}
              {trend.deltaScore.toFixed(1)} points vs {trend.points.length}d ago.
            </p>
          ) : null}
        </div>
      ) : (
        <InlineMessage tone="neutral">30-day risk score trend will appear after the next Risk Memory rollup.</InlineMessage>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 p-5 shadow-[var(--app-shadow-soft)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Top scopes</p>
          <div className="mt-4 space-y-2">
            {risk.topScopes.slice(0, 6).map((row, index) => (
              <div key={`${row.code ?? "scope"}-${index}`} className="flex items-center justify-between rounded-xl bg-[var(--app-panel)] px-3 py-2.5">
                <span className="text-sm font-medium text-[var(--app-text-strong)]">{formatCategory(row.code)}</span>
                <strong className="text-[var(--app-accent-primary)]">{row.count}</strong>
              </div>
            ))}
            {risk.topScopes.length === 0 ? <p className="text-sm text-[var(--app-text)]">No scope tags yet.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 p-5 shadow-[var(--app-shadow-soft)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Top hazards</p>
          <div className="mt-4 space-y-2">
            {risk.topHazards.slice(0, 6).map((row, index) => (
              <div key={`${row.code ?? "hazard"}-${index}`} className="flex items-center justify-between rounded-xl bg-[var(--app-panel)] px-3 py-2.5">
                <span className="text-sm font-medium text-[var(--app-text-strong)]">{formatCategory(row.code)}</span>
                <strong className="text-[var(--semantic-warning)]">{row.count}</strong>
              </div>
            ))}
            {risk.topHazards.length === 0 ? <p className="text-sm text-[var(--app-text)]">No hazard tags yet.</p> : null}
          </div>
        </div>
      </div>

      {(risk.topLocationGrids?.length ?? 0) > 0 || (risk.topLocationAreas?.length ?? 0) > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 p-5 shadow-[var(--app-shadow-soft)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Location grids</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--app-text)]">
              {(risk.topLocationGrids ?? []).slice(0, 6).map((row) => (
                <li key={`${row.label}-${row.count}`} className="flex justify-between gap-3 rounded-xl bg-[var(--app-panel)] px-3 py-2">
                  <span>{row.label}</span>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 p-5 shadow-[var(--app-shadow-soft)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Areas / zones</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--app-text)]">
              {(risk.topLocationAreas ?? []).slice(0, 6).map((row) => (
                <li key={`${row.label}-${row.count}`} className="flex justify-between gap-3 rounded-xl bg-[var(--app-panel)] px-3 py-2">
                  <span>{row.label}</span>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {risk.baselineHints && risk.baselineHints.length > 0 ? (
        <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] px-4 py-3 text-sm text-[var(--app-text)]">
          <span className="font-semibold text-[var(--app-text-strong)]">Baseline patterns matched: </span>
          {risk.baselineHints.map((hint) => `${hint.scope_code}+${hint.hazard_code}`).join(" / ")}
        </div>
      ) : null}
    </div>
  );
}

function RecommendationsList({
  recommendations,
  loading,
  dismissingId,
  onDismiss,
}: {
  recommendations: NonNullable<AnalyticsSummary["riskMemoryRecommendations"]>;
  loading: boolean;
  dismissingId: string | null;
  onDismiss: (id: string) => void;
}) {
  const emptyMessage = getRecommendationsEmptyMessage(recommendations.length);
  if (emptyMessage) {
    return (
      <EmptyState
        title="No smart recommendations yet"
        description={emptyMessage}
        actionHref="/analytics"
        actionLabel="Open Safety analytics"
      />
    );
  }

  return (
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
              {recommendation.evidence ? <p className="mt-2 text-xs leading-5 text-[var(--app-muted)]">{recommendation.evidence}</p> : null}
              {recommendation.businessImpact ? <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">{recommendation.businessImpact}</p> : null}
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <StatusBadge
                label={`${recommendation.sourceModule ?? recommendation.kind} - ${Math.round((recommendation.confidence ?? 0) * 100)}%`}
                tone="info"
              />
              <button
                type="button"
                disabled={loading || dismissingId === recommendation.id}
                onClick={() => onDismiss(recommendation.id)}
                className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-muted)] hover:text-[var(--semantic-danger)] disabled:opacity-40"
              >
                {dismissingId === recommendation.id ? "Dismissing..." : "Dismiss"}
              </button>
            </div>
          </div>
          {recommendation.actionHref ? (
            <Link href={recommendation.actionHref} className="mt-3 inline-flex text-xs font-bold text-[var(--app-accent-primary)] hover:text-[var(--app-link-hover)]">
              Open action path
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function CommandCenterWorkspace() {
  const [days, setDays] = useState(90);
  const [predictiveJobsiteId, setPredictiveJobsiteId] = useState("");
  const [insightsSection, setInsightsSection] = useState<InsightsSection>("recommendations");
  const { value: rawHubTab, setValue: setHubTabValue } = useUrlTabState(
    "tab",
    COMMAND_CENTER_URL_TABS,
    "overview"
  );
  const hubTab = (rawHubTab === "risk" ? "risk-memory" : rawHubTab) as HubTab;

  const [loading, setLoading] = useState(true);
  const [predictiveLoading, setPredictiveLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsSummaryPayload | null>(null);
  const [predictiveRisk, setPredictiveRisk] = useState<PredictiveRiskPayload | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [analyticsErr, setAnalyticsErr] = useState("");
  const [predictiveErr, setPredictiveErr] = useState("");
  const [workspaceErr, setWorkspaceErr] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [riskRecWorking, setRiskRecWorking] = useState(false);
  const [riskSnapWorking, setRiskSnapWorking] = useState(false);
  const [dismissingRecId, setDismissingRecId] = useState<string | null>(null);
  const [siWorkloadSummary, setSiWorkloadSummary] = useState<SafetyDashboardPayload["summary"] | null>(null);
  const [builderAccess, setBuilderAccess] = useState<BuilderAccess>({ csep: false, peshep: false });
  const [adoption, setAdoption] = useState<CommandCenterAdoptionPayload>({
    companyProfile: null,
    companyUsers: [],
    companyInvites: [],
    documents: [],
    onboardingState: emptyOnboardingState(),
  });

  useEffect(() => {
    if (rawHubTab === "risk") setHubTabValue("risk-memory");
  }, [rawHubTab, setHubTabValue]);

  const load = useCallback(async () => {
    setLoading(true);
    setPredictiveLoading(true);
    setAnalyticsErr("");
    setPredictiveErr("");
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
        setPredictiveRisk(null);
        setSiWorkloadSummary(null);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const predictiveParams = new URLSearchParams({ days: String(days) });
      if (predictiveJobsiteId) predictiveParams.set("jobsiteId", predictiveJobsiteId);
      const [
        analyticsResponse,
        workspaceResponse,
        siWorkloadResponse,
        predictiveResponse,
        meResponse,
        usersResponse,
        documentsResponse,
        onboardingResponse,
      ] = await Promise.all([
        fetchWithTimeoutSafe(`/api/company/analytics/summary?days=${days}`, { headers }, 20000, "Analytics"),
        fetchWithTimeoutSafe("/api/company/workspace/summary", { headers }, 20000, "Workspace"),
        fetchWithTimeoutSafe("/api/company/safety-intelligence/analytics/summary", { headers }, 15000, "Safety Intelligence workload"),
        fetchWithTimeoutSafe(`/api/company/predictive-risk?${predictiveParams.toString()}`, { headers }, 20000, "Predictive risk"),
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
      const siWorkloadJson = (await siWorkloadResponse.json().catch(() => null)) as {
        summary?: SafetyDashboardPayload["summary"];
        error?: string;
      } | null;
      const predictiveJson = (await predictiveResponse.json().catch(() => null)) as
        | (PredictiveRiskPayload & { error?: string })
        | null;
      const meJson = (await meResponse.json().catch(() => null)) as
        | {
            user?: {
              companyProfile?: CommandCenterAdoptionPayload["companyProfile"];
              permissionMap?: PermissionMap;
              role?: string;
              workspaceProduct?: WorkspaceProduct;
            };
          }
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

      if (!siWorkloadResponse.ok) {
        setSiWorkloadSummary(null);
      } else {
        setSiWorkloadSummary(siWorkloadJson?.summary ?? null);
      }

      if (!predictiveResponse.ok) {
        setPredictiveErr(predictiveJson?.error || "Could not load predictive risk.");
        setPredictiveRisk(null);
      } else {
        setPredictiveRisk(predictiveJson);
      }

      if (meResponse.ok) {
        const role = meJson?.user?.role ?? "";
        const permissionMap = meJson?.user?.permissionMap ?? null;
        const workspaceProduct = meJson?.user?.workspaceProduct === "csep" ? "csep" : "full";
        setBuilderAccess({
          csep: canAccessCompanyWorkspaceHref("/csep", role, permissionMap),
          peshep:
            workspaceProduct !== "csep" &&
            canAccessCompanyWorkspaceHref("/peshep", role, permissionMap),
        });
      } else {
        setBuilderAccess({ csep: false, peshep: false });
      }

      setAdoption({
        companyProfile: meResponse.ok ? meJson?.user?.companyProfile ?? null : null,
        companyUsers: usersResponse.ok ? usersJson?.users ?? [] : [],
        companyInvites: usersResponse.ok ? usersJson?.invites ?? [] : [],
        documents: documentsResponse.ok ? documentsJson?.documents ?? [] : [],
        onboardingState: onboardingResponse.ok && onboardingJson ? onboardingJson : emptyOnboardingState(),
      });

      setLastLoadedAt(new Date());
    } catch (error) {
      setAnalyticsErr(error instanceof Error ? error.message : "Failed to load Command Center.");
    } finally {
      setLoading(false);
      setPredictiveLoading(false);
    }
  }, [days, predictiveJobsiteId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
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

  const summary = analytics?.summary;
  const risk = summary?.riskMemory;
  const riskTrend = summary?.riskMemoryTrend;
  const companyDashboard = summary?.companyDashboard;
  const benchmarking = summary?.benchmarking;
  const injuryAnalytics = summary?.injuryAnalytics;
  const recommendations = summary?.riskMemoryRecommendations ?? [];
  const workflowRails = useMemo(() => buildSafetyManagerWorkflowRails(openWork), [openWork]);
  const band = risk?.aggregatedWithBaseline?.band ?? risk?.aggregated?.band ?? "-";
  const score = risk?.aggregatedWithBaseline?.score ?? risk?.aggregated?.score ?? null;
  const predictiveSummary = predictiveRisk?.summary;
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
  const documentBuilderLaunches = [
    builderAccess.csep
      ? {
          href: "/csep",
          title: "CSEP builder",
          description: "Create a contractor safety plan package.",
          label: "Build CSEP",
        }
      : null,
    builderAccess.peshep
      ? {
          href: "/peshep",
          title: "PESHEP builder",
          description: "Create a project environmental, safety, and health plan package.",
          label: "Build PESHEP",
        }
      : null,
  ].filter((item): item is { href: string; title: string; description: string; label: string } => item != null);

  async function getAuthHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Missing auth token.");
    return { Authorization: `Bearer ${session.access_token}` };
  }

  async function refreshRiskRecommendations(mode: "rules" | "both") {
    setRiskRecWorking(true);
    setAnalyticsErr("");
    try {
      const headers = { ...(await getAuthHeaders()), "Content-Type": "application/json" };
      const timeoutMs = mode === "both" ? 45000 : 20000;
      const res = await fetchWithTimeoutSafe(
        "/api/company/risk-memory/recommendations/generate",
        { method: "POST", headers, body: JSON.stringify({ days, mode }) },
        timeoutMs,
        "Risk recommendations"
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Could not generate recommendations.");
      await load();
    } catch (error) {
      setAnalyticsErr(error instanceof Error ? error.message : "Recommendation refresh failed.");
    } finally {
      setRiskRecWorking(false);
    }
  }

  async function saveRiskMemorySnapshot() {
    setRiskSnapWorking(true);
    setAnalyticsErr("");
    try {
      const headers = { ...(await getAuthHeaders()), "Content-Type": "application/json" };
      const res = await fetchWithTimeoutSafe(
        "/api/company/risk-memory/snapshot",
        { method: "POST", headers, body: JSON.stringify({ days }) },
        20000,
        "Risk memory snapshot"
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Could not save snapshot.");
      await load();
    } catch (error) {
      setAnalyticsErr(error instanceof Error ? error.message : "Snapshot save failed.");
    } finally {
      setRiskSnapWorking(false);
    }
  }

  async function dismissRiskRecommendation(id: string) {
    setDismissingRecId(id);
    setAnalyticsErr("");
    try {
      const headers = { ...(await getAuthHeaders()), "Content-Type": "application/json" };
      const res = await fetchWithTimeoutSafe(
        `/api/company/risk-memory/recommendations/${encodeURIComponent(id)}`,
        { method: "PATCH", headers, body: JSON.stringify({ dismissed: true }) },
        15000,
        "Dismiss recommendation"
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Could not dismiss recommendation.");
      await load();
    } catch (error) {
      setAnalyticsErr(error instanceof Error ? error.message : "Dismiss failed.");
    } finally {
      setDismissingRecId(null);
    }
  }

  const overviewContent = (
    <div className="space-y-6">
      <SectionCard
        eyebrow="Unified Operations"
        title="Insights and risk snapshot"
        description="One place for the signals safety leaders use first: current risk, open work, predictive pressure, recommendations, and Safety Intelligence activity."
        tone="attention"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricTile
            eyebrow="Current risk"
            title={band === "-" ? "Awaiting rollup" : band}
            value={score != null ? Number(score).toFixed(1) : "-"}
            detail={`${risk?.facetCount ?? 0} Risk Memory facets in ${risk?.windowDays ?? days} days.`}
            tone="attention"
          />
          <MetricTile
            eyebrow="Predictive risk"
            title="Avg score"
            value={metricValue(predictiveSummary?.averageRiskScore)}
            detail={`${predictiveSummary?.highRiskLocationCount ?? 0} high-risk location${predictiveSummary?.highRiskLocationCount === 1 ? "" : "s"}.`}
          />
          <MetricTile
            eyebrow="Recommendations"
            title="Active"
            value={String(recommendations.length)}
            detail="Stored smart or rules-based actions for leadership triage."
          />
          <MetricTile
            eyebrow="Open work"
            title="Issues"
            value={String(openWork.openObservations)}
            detail={`${openWork.overdueObservations} overdue and ${openWork.openIncidents} open incident${openWork.openIncidents === 1 ? "" : "s"}.`}
          />
          <MetricTile
            eyebrow="Safety Intel"
            title="Activity"
            value={String(siWorkloadSummary?.totals.aiReviews ?? 0)}
            detail={`${siWorkloadSummary?.totals.openConflicts ?? 0} open rule conflict${siWorkloadSummary?.totals.openConflicts === 1 ? "" : "s"}.`}
          />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Launch"
        title="Workspace launch checklist"
        description={`${adoptionChecklist.completedCount} of ${adoptionChecklist.totalCount} adoption milestones complete. Keep setup progress close to the operating hub.`}
        aside={<StatusBadge label={adoptionChecklist.nextItem ? `Next: ${adoptionChecklist.nextItem.label}` : "Launch complete"} tone={adoptionChecklist.nextItem ? "warning" : "success"} />}
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

      {documentBuilderLaunches.length > 0 ? (
        <SectionCard
          eyebrow="Builders"
          title="Document builders"
          description="Start formal builder packages from the operating hub."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {documentBuilderLaunches.map((item) => (
              <LaunchCard
                key={item.href}
                href={item.href}
                title={item.title}
                description={item.description}
                label={item.label}
              />
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        eyebrow="Drill-downs"
        title="Deep analysis paths"
        description="The hub shows what matters first. These detailed pages remain available when you need more context."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LaunchCard href="/analytics" title="Safety analytics" description="Observation, incident, benchmarking, and Risk Memory detail." label="Open analytics" />
          <LaunchCard href="/analytics/predictive-model" title="Predictive model detail" description="Full predictive model surface with ranked locations and drivers." label="Open model" />
          <LaunchCard href="/analytics/safety-intelligence" title="Safety Intelligence activity" description="Review batches, conflicts, reviews, and generated output volume." label="Open activity" />
          <LaunchCard href="/safety-intelligence" title="Safety Intelligence workflow" description="Run intake, rules, conflicts, and document-generation workflows." label="Start workflow" />
        </div>
      </SectionCard>
    </div>
  );

  const riskMemoryContent = (
    <div className="space-y-6">
      <SectionCard
        eyebrow="Risk Management"
        title="Risk Memory"
        description="Current company risk rollup, recurring scope/hazard patterns, hotspots, benchmark context, and snapshot controls."
        aside={<StatusBadge label={band === "-" ? "Awaiting rollup" : band} tone={rollupTone(band)} />}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricTile eyebrow="Risk score" title={band === "-" ? "Awaiting rollup" : band} value={score != null ? Number(score).toFixed(1) : "-"} detail="Baseline-adjusted score when available." tone="attention" />
          <MetricTile eyebrow="Facet rows" title="Signals" value={metricValue(risk?.facetCount)} detail={`Selected window: ${risk?.windowDays ?? days} days.`} />
          <MetricTile eyebrow="Open CA hints" title="Corrective actions" value={metricValue(risk?.openCorrectiveFacetHints.openStyleStatuses)} detail="Open-style statuses feeding risk context." />
          <MetricTile eyebrow="Rollup confidence" title="Heuristic" value={risk?.derivedRollupConfidence != null ? `${Math.round(risk.derivedRollupConfidence * 100)}%` : "-"} detail="Based on signal depth and score strength." />
          <MetricTile eyebrow="Benchmark rate" title="Incident rate" value={benchmarking?.incidentRate != null ? benchmarking.incidentRate.toFixed(2) : "-"} detail="Per 200k exposure hours when configured." />
        </div>

        {!risk ? <InlineMessage tone="neutral">{getRiskMemoryEmptyMessage(loading)}</InlineMessage> : <RiskMemoryDetails risk={risk} trend={riskTrend} />}

        {benchmarking ? (
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 p-4 text-sm text-[var(--app-text)] shadow-[var(--app-shadow-soft)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Industry and trade benchmarks</p>
            <p className="mt-2">
              NAICS <span className="font-mono font-semibold text-[var(--app-text-strong)]">{benchmarking.industryCode ?? "-"}</span>
              {" / "}Industry ref. {benchmarking.industryInjuryRate ?? "-"}
              {" / "}Trade ref. {benchmarking.tradeInjuryRate ?? "-"}
              {" / "}Workspace rate {benchmarking.incidentRate != null ? benchmarking.incidentRate.toFixed(2) : "-"}
            </p>
          </div>
        ) : null}

        {injuryAnalytics ? (
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/88 p-4 text-sm text-[var(--app-text)] shadow-[var(--app-shadow-soft)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Injury analytic inputs</p>
            <p className="mt-2">
              Avg severity {injuryAnalytics.averageSeverityScore} (n={injuryAnalytics.severitySampleSize}) / SOR-to-injury ratio{" "}
              {injuryAnalytics.sorToInjuryRatio ?? "-"} / Observation-to-injury {injuryAnalytics.observationToInjuryConversionRate != null ? `${injuryAnalytics.observationToInjuryConversionRate}%` : "-"}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={riskSnapWorking || loading} onClick={() => void saveRiskMemorySnapshot()} className={`${appButtonPrimaryClassName} disabled:opacity-50`}>
            {riskSnapWorking ? "Saving..." : "Save today's rollup snapshot"}
          </button>
          <Link href="/settings/risk-memory" className={appButtonSecondaryClassName}>
            Configure Risk Memory
          </Link>
          <Link href="/analytics" className={appButtonQuietClassName}>
            Full analytics
          </Link>
        </div>
      </SectionCard>
    </div>
  );

  const predictiveContent = (
    <PredictiveModelView
      data={predictiveRisk}
      loading={predictiveLoading}
      error={predictiveErr}
      days={days}
      selectedJobsiteId={predictiveJobsiteId}
      onDaysChange={setDays}
      onJobsiteChange={setPredictiveJobsiteId}
      onRefresh={() => void load()}
    />
  );

  const insightsContent = (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Insights sections">
        {INSIGHTS_SECTIONS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setInsightsSection(value)}
            className={[
              "rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition",
              insightsSection === value
                ? "bg-[var(--app-accent-primary)] text-white shadow-[var(--app-shadow-primary-button)]"
                : "border border-[var(--app-border-strong)] bg-white/80 text-[var(--app-text-strong)] hover:bg-white",
            ].join(" ")}
          >
            {INSIGHTS_SECTION_LABELS[value]}
          </button>
        ))}
      </div>

      {insightsSection === "recommendations" ? (
        <SectionCard
          eyebrow="Recommended Next Step"
          title="Insights & Recommendations"
          description="Stored recommendations stay company-scoped. Generate rule-based or smart recommendations, then move directly into the action path."
          actions={
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={riskRecWorking || loading} onClick={() => void refreshRiskRecommendations("rules")} className={`${appButtonSecondaryClassName} disabled:opacity-50`}>
                {riskRecWorking ? "Generating..." : "Rule-based"}
              </button>
              <button type="button" disabled={riskRecWorking || loading} onClick={() => void refreshRiskRecommendations("both")} className={`${appButtonPrimaryClassName} disabled:opacity-50`}>
                {riskRecWorking ? "Generating..." : "Smart + rules"}
              </button>
            </div>
          }
        >
          <RecommendationsList
            recommendations={recommendations}
            loading={loading || riskRecWorking}
            dismissingId={dismissingRecId}
            onDismiss={(id) => void dismissRiskRecommendation(id)}
          />
        </SectionCard>
      ) : null}

      {insightsSection === "safety-intelligence" ? (
        <SectionCard
          eyebrow="Safety Intelligence"
          title="Workflow activity"
          description="Company-scoped snapshot of Safety Intelligence volume so you can triage before opening lists or conflicts."
          aside={
            <Link href="/analytics/safety-intelligence" className={`${appButtonSecondaryClassName} whitespace-nowrap px-3 py-2 text-xs`}>
              Full activity view
            </Link>
          }
        >
          {siWorkloadSummary ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Pipeline batches</p>
                <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{siWorkloadSummary.totals.bucketRuns}</p>
              </div>
              <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">AI-assisted reviews</p>
                  <ProvenanceBadge kind="ai" />
                </div>
                <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{siWorkloadSummary.totals.aiReviews}</p>
              </div>
              <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Open rule conflicts</p>
                  <ProvenanceBadge kind="rules" />
                </div>
                <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{siWorkloadSummary.totals.openConflicts}</p>
              </div>
              <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Documents generated</p>
                  <ProvenanceBadge kind="hybrid" />
                </div>
                <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{siWorkloadSummary.totals.generatedDocuments}</p>
              </div>
            </div>
          ) : (
            <InlineMessage tone="neutral">Workflow metrics are not available for this account yet, or your role does not include analytics access.</InlineMessage>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <LaunchCard href="/safety-intelligence" title="Start workflow" description="Run intake, rules, conflicts, document generation, and review." label="Open workflow" />
            <LaunchCard href="/analytics/safety-intelligence" title="Activity detail" description="Inspect batches, reviews, conflicts, and generated documents." label="Open analytics" />
            <LaunchCard href="/reports" title="Reports" description="Review generated reports and document handoffs." label="Open reports" />
          </div>
        </SectionCard>
      ) : null}

      {insightsSection === "knowledge" ? (
        <SectionCard
          eyebrow="Supporting Context"
          title="Company Knowledge"
          description="Keep reusable company context close to the hub so assistants and downstream workflows can stay grounded in actual procedures."
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
                <Link href="/safety-intelligence" className={appButtonQuietClassName}>
                  Open workflow
                </Link>
                <Link href="/analytics" className={appButtonSecondaryClassName}>
                  Open analytics
                </Link>
              </div>
            </div>
            <CompanyMemoryBankPanel />
          </div>
        </SectionCard>
      ) : null}
    </div>
  );

  const openWorkContent = (
    <div className="space-y-6">
      <SectionCard
        eyebrow="Workflow Rails"
        title="Core operator paths"
        description="Move from signal to action without hunting through separate modules."
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
        title="Open Work"
        description="Use the current workload picture to decide where human follow-up is needed before or after smart-generated outputs."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Open issues" value={openWork.openObservations} href="/field-id-exchange" hint="Corrective actions not verified closed" />
          <StatTile label="Overdue issues" value={openWork.overdueObservations} href="/field-id-exchange" hint="Open items past due" />
          <StatTile label="Open incidents" value={openWork.openIncidents} href="/incidents" />
          <StatTile label="Active permits" value={openWork.activePermits} href="/permits" />
          <StatTile label="Stop work" value={openWork.stopWorkPermits} href="/permits" hint="Requested or active" />
          <StatTile label="JSAs in flight" value={openWork.openJsas} href="/jsa" />
          <StatTile label="Reports draft" value={openWork.openReports} href="/reports" />
          <StatTile label="Active jobsites" value={companyDashboard?.totalActiveJobsites ?? "-"} href="/jobsites" />
        </div>
      </SectionCard>

      <InductionReadinessCard />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Command Center"
        title="Unified risk and insights hub"
        description="Review Risk Memory, predictive signals, recommendations, Safety Intelligence activity, and open work from one company-scoped operating area."
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
            <button type="button" onClick={() => void load()} disabled={loading || predictiveLoading} className={`${appButtonPrimaryClassName} disabled:opacity-50`}>
              {loading || predictiveLoading ? "Refreshing..." : "Refresh"}
            </button>
          </>
        }
      />

      {notices.map((notice) => (
        <InlineMessage key={`${notice.tone}-${notice.message}`} tone={notice.tone}>
          {notice.message}
        </InlineMessage>
      ))}
      {predictiveErr ? <InlineMessage tone="warning">{predictiveErr}</InlineMessage> : null}

      {lastLoadedAt ? (
        <p className="text-xs text-[var(--app-text)]">
          Last updated {lastLoadedAt.toLocaleString()}. Risk, predictive, insight, and open-work views use the selected window.
        </p>
      ) : null}

      {summary?.leadershipTrust ? <TrustSummaryPanel trust={summary.leadershipTrust} compact /> : null}

      <AppTabBar
        value={hubTab}
        onValueChange={(next) => setHubTabValue(next)}
        items={[
          { value: "overview", label: "Overview", content: overviewContent },
          { value: "risk-memory", label: "Risk Memory", content: riskMemoryContent },
          { value: "predictive-risk", label: "Predictive Risk", content: predictiveContent },
          { value: "insights", label: "Insights & Recommendations", content: insightsContent },
          { value: "open-work", label: "Open Work", content: openWorkContent },
        ]}
      />

      {loading ? <InlineMessage tone="neutral">Refreshing Command Center data...</InlineMessage> : null}
    </div>
  );
}
