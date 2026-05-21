"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DashboardOverviewFiltersBar } from "@/components/dashboard/DashboardOverviewFiltersBar";
import { InlineMessage, appButtonQuietClassName } from "@/components/WorkspacePrimitives";
import { TrustSummaryPanel } from "@/components/leadership/TrustSummaryPanel";
import { useDashboardLayout } from "@/components/dashboard/use-dashboard-layout";
import { fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
import { formatTitleCase } from "@/lib/formatTitleCase";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { getDashboardOverviewSectionVisibility } from "@/lib/dashboardVisibility";
import { resolveDashboardRole } from "@/lib/dashboardRole";
import { canAccessCompanyWorkspaceHref } from "@/lib/companyFeatureAccess";
import type { PermissionMap } from "@/lib/rbac";
import type { DashboardBlockId, DashboardDataState } from "@/components/dashboard/types";
import type { DashboardOverview, EngineHealthItem, TrafficLightStatus, TrendPoint } from "@/src/lib/dashboard/types";
import { SectionCard } from "@/src/components/dashboard/SectionCard";
import { MetricCard } from "@/src/components/dashboard/MetricCard";
import { StatusBadge } from "@/src/components/dashboard/StatusBadge";
import { ObservationDualLineChart } from "@/src/components/dashboard/ObservationDualLineChart";
import { StatusBarChart } from "@/src/components/dashboard/StatusBarChart";
import { ContractorRiskTable } from "@/src/components/dashboard/ContractorRiskTable";
import { PermitComplianceTable } from "@/src/components/dashboard/PermitComplianceTable";
import { DocumentReadinessPanel } from "@/src/components/dashboard/DocumentReadinessPanel";
import { EngineHealthPanel } from "@/src/components/dashboard/EngineHealthPanel";
import { AiInsightsPanel } from "@/src/components/dashboard/AiInsightsPanel";
import { DashboardDomainEmptyState } from "@/src/components/dashboard/DashboardDomainEmptyState";
import {
  DashboardDetailsTabs,
  readDashboardTab,
  type DashboardTabId,
} from "@/src/components/dashboard/DashboardDetailsTabs";
import { PerformanceHubPanel } from "@/src/components/dashboard/PerformanceHubPanel";
import {
  EMERGING_THEMES_EMPTY,
  HEADLINE_HEALTH_EMPTY,
  INCIDENTS_EMPTY,
  TRAINING_EMPTY,
} from "@/src/lib/dashboard/dashboardOverviewEmptyMessages";
import {
  documentReadinessPortfolioBand,
  openHighRiskCountBand,
  overdueCorrectiveCountBand,
  permitPortfolioSummaryBand,
  safetyHealthCompositeBand,
  trainingReadinessSummaryBand,
} from "@/src/lib/dashboard/dashboardStatusSemantics";
import {
  correctiveHasAnyActivity,
  documentPipelineTotal,
  headlineKpisAreMeaningful,
  trendHasPositiveValues,
  workforceReadinessHasSignals,
} from "@/src/lib/dashboard/overviewDataPresence";
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  Database,
  FileText,
  GraduationCap,
  MapPin,
  RadioTower,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";

const supabase = getSupabaseBrowserClient();
const isOfflineDesktop = process.env.NEXT_PUBLIC_OFFLINE_DESKTOP === "1";

function canLoadDashboardOverview(map: PermissionMap | null): boolean {
  if (!map) return true;
  return Boolean(
    map.can_view_dashboards ||
    map.can_view_all_company_data ||
    map.can_view_analytics ||
    map.can_manage_company_users
  );
}

function partitionEngineHealth(items: EngineHealthItem[]): { smart: EngineHealthItem[]; platform: EngineHealthItem[] } {
  const platform: EngineHealthItem[] = [];
  const smart: EngineHealthItem[] = [];
  for (const item of items) {
    const n = item.moduleName.toLowerCase();
    if (
      n.includes("supabase connection") ||
      n.includes("document storage bucket") ||
      n.includes("document export") ||
      n.includes("dashboard data service")
    ) {
      platform.push(item);
    } else {
      smart.push(item);
    }
  }
  return { smart, platform };
}

function incidentOutlook(incidentTrend: TrendPoint[]): "improving" | "worsening" | "stable" {
  const vals = incidentTrend.map((p) => (Number.isFinite(p.value) ? p.value : 0));
  if (vals.length < 2) return "stable";
  const mid = Math.floor(vals.length / 2);
  const a = vals.slice(0, mid).reduce((s, v) => s + v, 0) / Math.max(1, mid);
  const b = vals.slice(mid).reduce((s, v) => s + v, 0) / Math.max(1, vals.length - mid);
  if (b > a * 1.05) return "worsening";
  if (b < a * 0.95) return "improving";
  return "stable";
}

function outlookLabel(o: ReturnType<typeof incidentOutlook>): string {
  if (o === "improving") return "Improving";
  if (o === "worsening") return "Trending upward";
  return "Stable";
}

function outlookTone(o: ReturnType<typeof incidentOutlook>): "success" | "error" | "neutral" {
  if (o === "improving") return "success";
  if (o === "worsening") return "error";
  return "neutral";
}

function isActiveJobsite(status?: string | null): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  return normalized === "active" || normalized === "planned" || normalized === "action needed";
}

function dashboardRangeLabel(value: string | null): string {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "7d") return "Last 7 days";
  if (normalized === "30d") return "Last 30 days";
  if (normalized === "ytd") return "Year to date";
  if (normalized === "custom") return "Custom window";
  return "Last 90 days";
}

function dashboardRiskLabel(value: string | null): string {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "high") return "High risk";
  if (normalized === "medium") return "Medium risk";
  if (normalized === "low") return "Low risk";
  return "All risk levels";
}

type DailyCommandAction = {
  id: string;
  title: string;
  detail: string;
  href: string;
  meta: string;
  tone: "neutral" | "success" | "warning" | "error" | "info";
};

function isDailyCommandAction(item: DailyCommandAction | null): item is DailyCommandAction {
  return item !== null;
}

function commandToneClasses(status: TrafficLightStatus): {
  border: string;
  bg: string;
  text: string;
  strip: string;
  glow: string;
} {
  if (status === "red") {
    return {
      border: "border-red-200",
      bg: "bg-red-50",
      text: "text-red-700",
      strip: "bg-red-500",
      glow: "shadow-[0_0_0_5px_rgba(239,68,68,0.12)]",
    };
  }
  if (status === "yellow") {
    return {
      border: "border-amber-200",
      bg: "bg-amber-50",
      text: "text-amber-700",
      strip: "bg-amber-500",
      glow: "shadow-[0_0_0_5px_rgba(245,158,11,0.14)]",
    };
  }
  return {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    strip: "bg-emerald-500",
    glow: "shadow-[0_0_0_5px_rgba(16,185,129,0.13)]",
  };
}

function riskBandFromScore(score: number): TrafficLightStatus {
  if (score >= 70) return "red";
  if (score >= 40) return "yellow";
  return "green";
}

function riskBandFromCount(count: number): TrafficLightStatus {
  if (count >= 8) return "red";
  if (count >= 1) return "yellow";
  return "green";
}

function formatJobsiteMeta(jobsite: DashboardDataState["workspaceSummary"]["jobsites"][number] | null): string {
  if (!jobsite) return "All accessible jobsites";
  const pieces = [jobsite.location, jobsite.status].filter((item): item is string => Boolean(item?.trim()));
  return pieces.length > 0 ? pieces.join(" / ") : "Location details pending";
}

function buildDailyCommandActions(params: {
  overview: DashboardOverview;
  missingPermitsTotal: number;
  credentialGaps: { expiredCredentials: number; expiringSoonCredentials: number };
  documentPipelineTotal: number;
}): DailyCommandAction[] {
  const { overview, missingPermitsTotal, credentialGaps, documentPipelineTotal } = params;
  const highSeverityRisk = overview.topRisks.find(
    (risk) => risk.severity === "critical" || risk.severity === "high"
  );
  const overdueSample = overview.overdueCorrectiveSamples?.[0];
  const documentBacklog =
    overview.documentReadiness.submitted +
    overview.documentReadiness.underReview +
    overview.documentReadiness.missingRequired +
    overview.documentReadiness.expiringSoon;

  const actions: Array<DailyCommandAction | null> = [
    overview.summary.openHighRiskItems > 0
      ? {
          id: "open-high-risk",
          title: "Verify high-risk work",
          detail: highSeverityRisk
            ? `${formatTitleCase(highSeverityRisk.name) || highSeverityRisk.name}: ${highSeverityRisk.recommendation}`
            : "Open high-risk items need field verification before related work continues.",
          href: "/field-id-exchange",
          meta: `${overview.summary.openHighRiskItems} open`,
          tone: "error" as const,
        }
      : null,
    overview.summary.overdueCorrectiveActions > 0
      ? {
          id: "overdue-correctives",
          title: "Close overdue correctives",
          detail: overdueSample
            ? `${formatTitleCase((overdueSample.category ?? "Corrective action").replace(/_/g, " "))} is past due.`
            : "Past-due corrective actions are unresolved exposure until verified and closed.",
          href: "/field-id-exchange",
          meta: `${overview.summary.overdueCorrectiveActions} overdue`,
          tone: "error" as const,
        }
      : null,
    missingPermitsTotal > 0
      ? {
          id: "missing-permits",
          title: "Resolve permit blockers",
          detail: "Missing required permit coverage should be cleared before high-energy or regulated work proceeds.",
          href: "/permits",
          meta: `${missingPermitsTotal} missing`,
          tone: "warning" as const,
        }
      : null,
    credentialGaps.expiredCredentials > 0
      ? {
          id: "expired-credentials",
          title: "Review expired credentials",
          detail: "Expired credentials can block worker readiness for regulated or high-risk assignments.",
          href: "/training-matrix",
          meta: `${credentialGaps.expiredCredentials} expired`,
          tone: "warning" as const,
        }
      : null,
    documentBacklog > 0
      ? {
          id: "document-readiness",
          title: "Clear document readiness",
          detail:
            documentPipelineTotal > 0
              ? "Submitted, in-review, missing, or expiring documents are waiting on review."
              : "Document readiness needs source records before the rate is meaningful.",
          href: "/documents",
          meta: `${documentBacklog} item${documentBacklog === 1 ? "" : "s"}`,
          tone: "info" as const,
        }
      : null,
  ];

  return actions.filter(isDailyCommandAction).slice(0, 3);
}

export function DashboardOverviewShell({ workspace }: { workspace: DashboardDataState }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dashboardLayout = useDashboardLayout({ role: resolveDashboardRole(workspace.userRole) });
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoMessage, setDemoMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pinningBlockId, setPinningBlockId] = useState<DashboardBlockId | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTabId>(() => readDashboardTab(searchParams.get("tab")));

  const allowed = useMemo(() => canLoadDashboardOverview(workspace.permissionMap), [workspace.permissionMap]);

  const overviewVisibility = useMemo(
    () =>
      getDashboardOverviewSectionVisibility({
        userRole: workspace.userRole,
        permissionMap: workspace.permissionMap,
        linkedContractorId: workspace.linkedContractorId,
      }),
    [workspace.linkedContractorId, workspace.permissionMap, workspace.userRole]
  );

  const overviewQuery = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tab");
    return params.toString();
  }, [searchParams]);

  const selectTab = useCallback(
    (value: string) => {
      const tab = readDashboardTab(value);
      setActiveTab(tab);
      const next = new URLSearchParams(searchParams.toString());
      if (tab === "operations") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const pinDashboardBlock = useCallback(
    async (blockId: DashboardBlockId) => {
      setPinningBlockId(blockId);
      try {
        await dashboardLayout.pin(blockId);
      } finally {
        setPinningBlockId(null);
      }
    },
    [dashboardLayout]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setActiveTab(readDashboardTab(searchParams.get("tab")));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchParams]);

  useEffect(() => {
    const syncTabFromUrl = () => {
      setActiveTab(readDashboardTab(new URLSearchParams(window.location.search).get("tab")));
    };
    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, []);

  const load = useCallback(async () => {
    if (!allowed) return;
    if (workspace.loading || !workspace.companyWorkspaceLoaded) return;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      setOverview(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const qs = overviewQuery;
    const overviewUrl = `/api/dashboard/overview${qs ? `?${qs}` : ""}`;
    const res = await fetchWithTimeoutSafe(
      overviewUrl,
      { headers: { Authorization: `Bearer ${token}` } },
      20000,
      "Prevention overview"
    );
    if (res.status === 403) {
      let msg = "This overview is not available for your workspace or role.";
      try {
        const j = (await res.json()) as { error?: string };
        if (typeof j?.error === "string" && j.error.trim()) msg = j.error.trim();
      } catch {
        /* ignore */
      }
      setError(msg);
      setOverview(null);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError(isOfflineDesktop ? null : "Prevention overview could not be loaded right now.");
      setOverview(null);
      setLoading(false);
      return;
    }
    try {
      const body = (await res.json()) as DashboardOverview;
      setOverview(body);
    } catch {
      setError(isOfflineDesktop ? null : "Overview response was not valid JSON.");
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [allowed, overviewQuery, workspace.companyWorkspaceLoaded, workspace.loading]);

  useEffect(() => {
    // Data fetch after workspace gate; `load` updates overview state when the response returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional async overview hydration
    void load();
  }, [load]);

  if (!allowed) {
    return null;
  }

  const filters = <DashboardOverviewFiltersBar workspace={workspace} />;

  if (workspace.loading) {
    return (
      <div className="space-y-6">
        {filters}
        <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] px-4 py-8 text-center text-sm text-[var(--app-muted)]">
          Preparing prevention overview…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {filters}
        <InlineMessage tone="warning">{error}</InlineMessage>
      </div>
    );
  }

  if (loading && !overview) {
    return (
      <div className="space-y-6">
        {filters}
        <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] px-4 py-8 text-center text-sm text-[var(--app-muted)]">
          Loading prevention overview…
        </div>
      </div>
    );
  }

  if (!overview) {
    return <div className="space-y-6">{filters}</div>;
  }

  const outlook = incidentOutlook(overview.incidentTrend);
  const topEmerging = overview.topRisks.slice(0, 5);

  const correctiveSegments = [
    { key: "open", label: "Open", value: overview.correctiveActionStatus.open, tone: "yellow" as const },
    { key: "overdue", label: "Overdue", value: overview.correctiveActionStatus.overdue, tone: "red" as const },
    { key: "closed", label: "Closed", value: overview.correctiveActionStatus.closed, tone: "green" as const },
  ];

  const missingPermitsTotal = overview.permitCompliance.reduce((s, p) => s + p.missing, 0);
  const overdueRows = overview.overdueCorrectiveSamples ?? [];
  const obsCategories = overview.observationCategoryTop ?? [];
  const cred = overview.credentialGaps ?? { expiredCredentials: 0, expiringSoonCredentials: 0 };

  const disconnectedSources = overview.engineHealth.filter(
    (e) => e.status !== "green" && /not connected|missing|could not/i.test(e.message)
  );
  const activeJobsites = workspace.workspaceSummary.jobsites.filter((jobsite) =>
    isActiveJobsite(jobsite.status)
  ).length;
  const companyName = formatTitleCase(workspace.companyProfile?.name?.trim() || workspace.userTeam || "Workspace");
  const connectedSourceCount = overview.engineHealth.filter((item) => item.status === "green").length;
  const totalSourceCount = overview.engineHealth.length;
  const selectedScopeLabel = [
    dashboardRangeLabel(searchParams.get("range")),
    dashboardRiskLabel(searchParams.get("riskLevel")),
    searchParams.get("jobsiteId") ? "Filtered jobsite" : "All jobsites",
    searchParams.get("contractorId") ? "Filtered contractor" : "All contractors",
  ].join(" / ");

  const doc = overview.documentReadiness;
  const pipelineTotal = doc.draft + doc.submitted + doc.underReview + doc.approved + doc.rejected;
  const weakDocs =
    pipelineTotal > 0 && doc.draft + doc.underReview > doc.approved * 0.5
      ? "Draft and in-review documents outweigh approved output—a potential control gap in review throughput. Recommended action: clear approvals before work continues that depends on verified documents."
      : null;

  const { smart: smartEngine, platform: platformEngine } = partitionEngineHealth(overview.engineHealth);
  const smartEngineDisplay =
    smartEngine.length > 0
      ? smartEngine
      : overview.engineHealth.filter(
          (i) =>
            !/supabase connection|document storage bucket|document export|dashboard data service/i.test(
              i.moduleName.toLowerCase()
            )
        );
  const smartEngineFinal = smartEngineDisplay.length > 0 ? smartEngineDisplay : overview.engineHealth;

  const permitRateMeasured =
    overview.permitCompliance.length > 0 ||
    missingPermitsTotal > 0 ||
    overview.summary.permitComplianceRate > 0;
  const trainingMeasured = workforceReadinessHasSignals(
    overview.summary.trainingReadinessRate,
    cred.expiredCredentials,
    cred.expiringSoonCredentials
  );
  const documentRateMeasured =
    documentPipelineTotal(doc) > 0 || overview.summary.documentReadinessRate > 0;
  const incidentsHaveData =
    overview.summary.incidentCount > 0 ||
    overview.summary.nearMissCount > 0 ||
    trendHasPositiveValues(overview.incidentTrend);

  const sifPotentialTheme = overview.topRisks.some(
    (r) =>
      /sif|serious\s*injury|potential\s*fatal/i.test(r.name) &&
      (r.severity === "critical" || r.severity === "high")
  );
  const healthCompositeBand = safetyHealthCompositeBand(overview.summary, { sifPotentialTheme });
  const permitSummaryBand = permitPortfolioSummaryBand(
    overview.summary.permitComplianceRate,
    permitRateMeasured,
    missingPermitsTotal
  );
  const trainingSummaryBand = trainingReadinessSummaryBand(
    overview.summary.trainingReadinessRate,
    trainingMeasured,
    cred.expiredCredentials
  );
  const documentSummaryBand = documentReadinessPortfolioBand(
    overview.summary.documentReadinessRate,
    documentRateMeasured,
    doc
  );
  const dailyActions = buildDailyCommandActions({
    overview,
    missingPermitsTotal,
    credentialGaps: cred,
    documentPipelineTotal: pipelineTotal,
  });
  const jobsiteRiskScores = new Map(
    (workspace.analyticsSummary?.jobsiteRiskScore ?? []).map((row) => [row.jobsiteId, row])
  );
  const activeJobsiteRows = workspace.workspaceSummary.jobsites.filter((jobsite) =>
    isActiveJobsite(jobsite.status)
  );
  const selectedJobsiteId =
    searchParams.get("jobsiteId")?.trim() ||
    workspace.analyticsSummary?.jobsiteRiskScore?.[0]?.jobsiteId ||
    activeJobsiteRows[0]?.id ||
    workspace.workspaceSummary.jobsites[0]?.id ||
    "";
  const selectedJobsite =
    workspace.workspaceSummary.jobsites.find((jobsite) => jobsite.id === selectedJobsiteId) ??
    activeJobsiteRows[0] ??
    workspace.workspaceSummary.jobsites[0] ??
    null;
  const selectedRiskScore =
    (selectedJobsite?.id ? jobsiteRiskScores.get(selectedJobsite.id)?.score : undefined) ??
    Math.max(overview.summary.openHighRiskItems, overview.summary.overdueCorrectiveActions);
  const selectedRiskBand = riskBandFromScore(Math.min(100, Math.max(0, selectedRiskScore)));
  const riskTone = commandToneClasses(selectedRiskBand);
  const commandPins = (activeJobsiteRows.length > 0 ? activeJobsiteRows : workspace.workspaceSummary.jobsites)
    .slice(0, 6)
    .map((jobsite, index) => {
      const positions = [
        { left: 64, top: 42 },
        { left: 46, top: 58 },
        { left: 73, top: 62 },
        { left: 34, top: 40 },
        { left: 57, top: 72 },
        { left: 80, top: 32 },
      ];
      const score = jobsite.id ? jobsiteRiskScores.get(jobsite.id)?.score ?? 0 : 0;
      return {
        id: jobsite.id ?? `${jobsite.name}-${index}`,
        name: formatTitleCase(jobsite.name) || jobsite.name,
        meta: formatJobsiteMeta(jobsite),
        score,
        selected: Boolean(jobsite.id && jobsite.id === selectedJobsite?.id),
        position: positions[index] ?? { left: 50, top: 50 },
        band: riskBandFromScore(Math.min(100, Math.max(0, score))),
      };
    });
  const commandMetrics = [
    {
      id: "site-risk",
      label: "Overall site risk",
      value: `${Math.round(selectedRiskScore)}/100`,
      hint: selectedJobsite ? formatTitleCase(selectedJobsite.name) || selectedJobsite.name : "Workspace scope",
      icon: ShieldAlert,
      band: selectedRiskBand,
      href: selectedJobsite?.id ? `/jobsites/${encodeURIComponent(selectedJobsite.id)}` : "/jobsites",
    },
    {
      id: "incident-risk",
      label: "Incident signal",
      value: outlookLabel(outlook),
      hint: incidentsHaveData ? "Trend from current window" : "Waiting on incident volume",
      icon: TrendingUp,
      band: outlook === "worsening" ? ("red" as const) : outlook === "stable" ? ("yellow" as const) : ("green" as const),
      href: "/analytics",
    },
    {
      id: "open-actions",
      label: "Open corrective actions",
      value: overview.correctiveActionStatus.open,
      hint: `${overview.correctiveActionStatus.overdue} overdue`,
      icon: ClipboardCheck,
      band: riskBandFromCount(overview.correctiveActionStatus.overdue),
      href: "/field-id-exchange",
    },
    {
      id: "workforce",
      label: "Workforce readiness",
      value: trainingMeasured ? `${Math.round(overview.summary.trainingReadinessRate)}%` : "No signal",
      hint: `${cred.expiredCredentials} expired credentials`,
      icon: Users,
      band: trainingSummaryBand,
      href: "/training-matrix?status=complete",
    },
  ];
  const builderActions = [
    canAccessCompanyWorkspaceHref("/csep", workspace.userRole, workspace.permissionMap)
      ? {
          href: "/csep",
          label: "Build CSEP",
          icon: ShieldCheck,
          primary: true,
        }
      : null,
    workspace.workspaceProduct !== "csep" &&
    canAccessCompanyWorkspaceHref("/peshep", workspace.userRole, workspace.permissionMap)
      ? {
          href: "/peshep",
          label: "Build PESHEP",
          icon: FileText,
          primary: false,
        }
      : null,
  ].filter((item): item is {
    href: string;
    label: string;
    icon: typeof ShieldCheck;
    primary: boolean;
  } => item != null);
  const renderPinButton = (blockId: DashboardBlockId, label = "Pin to dashboard") => (
    <button
      type="button"
      className={`${appButtonQuietClassName} px-3 py-2 text-xs`}
      disabled={dashboardLayout.saving || pinningBlockId !== null}
      onClick={() => void pinDashboardBlock(blockId)}
    >
      {pinningBlockId === blockId ? "Pinning..." : label}
    </button>
  );

  async function loadDemoEnvironment() {
    if (!window.confirm("Load isolated demo data and switch your active workspace to Demo Construction?")) return;
    setDemoLoading(true);
    setDemoMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sign in before loading the demo environment.");
      const res = await fetch("/api/demo/load", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; companyName?: string; counts?: { jobsites?: number; microsoftTasks?: number } }
        | null;
      if (!res.ok) throw new Error(data?.error || "Failed to load demo environment.");
      setDemoMessage({
        tone: "success",
        text: `${data?.companyName ?? "Demo Construction"} loaded with ${data?.counts?.jobsites ?? 0} projects and ${
          data?.counts?.microsoftTasks ?? 0
        } schedule activities.`,
      });
      router.push("/dashboard?demo=loaded");
      router.refresh();
      void load();
    } catch (err) {
      setDemoMessage({ tone: "error", text: err instanceof Error ? err.message : "Failed to load demo environment." });
    }
    setDemoLoading(false);
  }

  return (
    <div className="space-y-8">
      {filters}
      {demoMessage ? <InlineMessage tone={demoMessage.tone}>{demoMessage.text}</InlineMessage> : null}
      {dashboardLayout.message ? (
        <InlineMessage tone={dashboardLayout.message.tone}>{dashboardLayout.message.text}</InlineMessage>
      ) : null}
      <section className="overflow-hidden rounded-lg border border-[rgba(24,45,75,0.18)] bg-[#f8fbff] text-sm text-[var(--app-text)] shadow-[0_22px_52px_rgba(23,42,70,0.12)]">
        <div className="border-b border-[rgba(87,113,151,0.18)] bg-[linear-gradient(90deg,#07182c_0%,#0c2645_48%,#0f3865_100%)] px-4 py-4 text-white sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100">
                  <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
                  Site Command
                </span>
                <span className="rounded-md border border-white/15 bg-white/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-200">
                  Executive Overview
                </span>
              </div>
              <h2 className="mt-3 font-app-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {companyName}
              </h2>
              <p className="mt-1 max-w-3xl text-xs font-semibold uppercase tracking-[0.12em] text-blue-100/82">
                {selectedScopeLabel}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {builderActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={[
                      "inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition",
                      action.primary
                        ? "border border-blue-400 bg-blue-500 text-white hover:bg-blue-400"
                        : "border border-white/18 bg-white/10 text-blue-50 hover:bg-white/16",
                    ].join(" ")}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {action.label}
                  </Link>
                );
              })}
              <StatusBadge
                label={`${connectedSourceCount}/${totalSourceCount || 0} sources green`}
                tone={connectedSourceCount === totalSourceCount ? "success" : "warning"}
              />
              <StatusBadge label={`${activeJobsites} active jobsites`} tone={activeJobsites > 0 ? "info" : "neutral"} />
              <button
                type="button"
                onClick={() => void loadDemoEnvironment()}
                disabled={demoLoading}
                className="inline-flex items-center gap-2 rounded-md border border-white/18 bg-white/10 px-3 py-2 text-xs font-bold text-blue-50 shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Database className="h-3.5 w-3.5" />
                {demoLoading ? "Loading demo..." : "Load Demo Environment"}
              </button>
              {renderPinButton("priority_queue", "Pin queue")}
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="rounded-md border border-white/18 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border-b border-[rgba(87,113,151,0.18)] p-4 sm:p-5 xl:border-b-0 xl:border-r">
            <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_270px]">
              <div className="overflow-hidden rounded-lg border border-[rgba(59,91,132,0.22)] bg-white shadow-[0_16px_34px_rgba(31,55,91,0.09)]">
                <div className="flex flex-col gap-3 border-b border-[rgba(87,113,151,0.14)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Jobsite Risk Map
                    </p>
                    <h3 className="mt-0.5 font-app-display text-xl font-bold tracking-tight text-[var(--app-text-strong)]">
                      {selectedJobsite ? formatTitleCase(selectedJobsite.name) || selectedJobsite.name : "Workspace Coverage"}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={formatJobsiteMeta(selectedJobsite)} tone="info" />
                    <StatusBadge
                      label={`${Math.round(selectedRiskScore)} risk index`}
                      trafficLight={selectedRiskBand}
                    />
                  </div>
                </div>
                <div className="relative min-h-[390px] overflow-hidden bg-[#dcecf4]">
                  <div
                    className="absolute inset-0 opacity-95"
                    style={{
                      backgroundImage:
                        "linear-gradient(25deg, rgba(14,98,134,0.16) 0 1px, transparent 1px 84px), linear-gradient(115deg, rgba(9,69,118,0.13) 0 1px, transparent 1px 96px), radial-gradient(circle at 22% 78%, rgba(13,148,136,0.2), transparent 18%), radial-gradient(circle at 82% 20%, rgba(37,99,235,0.18), transparent 20%), linear-gradient(180deg, #e8f4fb 0%, #c9e5ef 100%)",
                    }}
                    aria-hidden="true"
                  />
                  <div className="absolute left-[8%] top-[18%] h-[66%] w-[74%] rounded-[48%] border border-blue-900/8 bg-white/14 blur-[0.2px]" aria-hidden="true" />
                  <div className="absolute left-[12%] top-[20%] h-[52%] w-[54%] rotate-[-8deg] rounded-[45%] border border-blue-900/10 bg-white/20" aria-hidden="true" />
                  <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3">
                    <span className="rounded-md border border-white/70 bg-white/86 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                      Live Operational View
                    </span>
                    <span className="rounded-md border border-white/70 bg-white/86 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                      {commandPins.length || activeJobsites} sites
                    </span>
                  </div>
                  <div className="absolute inset-0">
                    {commandPins.map((pin) => {
                      const pinTone = commandToneClasses(pin.band);
                      return (
                        <div
                          key={pin.id}
                          className="absolute -translate-x-1/2 -translate-y-1/2"
                          style={{ left: `${pin.position.left}%`, top: `${pin.position.top}%` }}
                        >
                          <div className="group relative">
                            <span
                              className={`absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full ${pinTone.bg} opacity-55 ring-1 ring-current/20 ${pinTone.text}`}
                              aria-hidden="true"
                            />
                            <span
                              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border-2 bg-white ${pinTone.border} ${pinTone.text} ${pin.selected ? pinTone.glow : "shadow-[0_8px_18px_rgba(15,23,42,0.16)]"}`}
                              aria-hidden="true"
                            >
                              <MapPin className="h-5 w-5 fill-current/12" />
                            </span>
                            {pin.selected ? (
                              <div className="absolute left-8 top-5 w-52 rounded-lg border border-slate-200 bg-white/96 p-3 text-left shadow-[0_18px_34px_rgba(15,23,42,0.18)]">
                                <p className="text-xs font-bold text-slate-950">{pin.name}</p>
                                <p className="mt-1 text-[11px] leading-4 text-slate-500">{pin.meta}</p>
                                <div className="mt-2 flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5">
                                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Risk</span>
                                  <span className={`font-app-display text-sm font-bold ${pinTone.text}`}>{Math.round(pin.score)}</span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="absolute bottom-4 left-4 max-w-sm rounded-lg border border-white/72 bg-white/88 px-3 py-2 text-xs leading-relaxed text-slate-600 shadow-sm">
                    Site pins are based on accessible workspace jobsites. Select a jobsite filter above to focus the command view.
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className={`rounded-lg border ${riskTone.border} ${riskTone.bg} p-4 shadow-[0_14px_30px_rgba(31,55,91,0.08)]`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Risk Beacon</p>
                      <p className="mt-1 text-sm font-bold text-slate-950">
                        {selectedJobsite ? formatTitleCase(selectedJobsite.name) || selectedJobsite.name : "Workspace"}
                      </p>
                    </div>
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white ${riskTone.border} ${riskTone.text}`}>
                      <ShieldAlert className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-5 flex items-center justify-center">
                    <div className={`relative flex h-40 w-40 items-center justify-center rounded-full border ${riskTone.border} bg-white shadow-inner`}>
                      <span className={`absolute inset-3 rounded-full border border-dashed ${riskTone.border}`} aria-hidden="true" />
                      <span className={`absolute inset-7 rounded-full ${riskTone.bg}`} aria-hidden="true" />
                      <div className="relative text-center">
                        <p className={`font-app-display text-5xl font-bold leading-none ${riskTone.text}`}>
                          {Math.round(selectedRiskScore)}
                        </p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Risk Index</p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-slate-600">
                    Beacon reflects jobsite risk ranking when available, then open high-risk and overdue control signals.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 2xl:grid-cols-1">
                  <div className="rounded-lg border border-[rgba(59,91,132,0.18)] bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Open actions</p>
                    <p className="font-app-display mt-1 text-3xl font-bold text-[var(--app-text-strong)]">
                      {overview.correctiveActionStatus.open}
                    </p>
                    <p className="text-xs text-[var(--app-muted)]">{overview.correctiveActionStatus.overdue} overdue</p>
                  </div>
                  <div className="rounded-lg border border-[rgba(59,91,132,0.18)] bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Readiness</p>
                    <p className="font-app-display mt-1 text-3xl font-bold text-[var(--app-text-strong)]">
                      {trainingMeasured ? `${Math.round(overview.summary.trainingReadinessRate)}%` : "--"}
                    </p>
                    <p className="text-xs text-[var(--app-muted)]">Training compliance</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {commandMetrics.map((metric) => {
                const Icon = metric.icon;
                const tone = commandToneClasses(metric.band);
                return (
                  <Link
                    key={metric.id}
                    href={metric.href ?? "/dashboard"}
                    className={`relative overflow-hidden rounded-lg border ${tone.border} bg-white px-4 py-3 shadow-[0_10px_22px_rgba(31,55,91,0.06)]`}
                  >
                    <span className={`absolute inset-x-0 top-0 h-1 ${tone.strip}`} aria-hidden="true" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                          {metric.label}
                        </p>
                        <p className="font-app-display mt-1 truncate text-2xl font-bold text-[var(--app-text-strong)]">
                          {metric.value}
                        </p>
                      </div>
                      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tone.bg} ${tone.text}`}>
                        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--app-muted)]">{metric.hint}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="bg-[linear-gradient(180deg,#ffffff_0%,#f1f6ff_100%)] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
                  Action Rail
                </p>
                <h3 className="mt-1 text-base font-bold tracking-tight text-[var(--app-text-strong)]">Clear These First</h3>
              </div>
              <StatusBadge label={dailyActions.length ? `${dailyActions.length} active` : "Clear"} tone={dailyActions.length ? "warning" : "success"} />
            </div>
            {dailyActions.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {dailyActions.map((action, index) => {
                  const actionTone =
                    action.tone === "error" ? commandToneClasses("red") : action.tone === "warning" ? commandToneClasses("yellow") : commandToneClasses("green");
                  return (
                    <Link
                      key={action.id}
                      href={action.href}
                      className={`group relative block overflow-hidden rounded-lg border ${actionTone.border} bg-white px-3 py-3 shadow-[0_10px_22px_rgba(31,55,91,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(31,55,91,0.1)]`}
                    >
                      <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${actionTone.strip}`} aria-hidden="true" />
                      <div className="flex items-start gap-3 pl-2">
                        <span className={`font-app-display flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${actionTone.bg} text-sm font-bold ${actionTone.text}`}>
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-[var(--app-text-strong)]">{action.title}</p>
                            <StatusBadge label={action.meta} tone={action.tone} />
                          </div>
                          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[var(--app-muted)]">{action.detail}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-[var(--app-border-subtle)] bg-white px-3 py-3 text-sm text-[var(--app-muted)]">
                No high-priority daily actions are visible for this scope.
              </p>
            )}
            <div className="mt-4 rounded-lg border border-[rgba(59,91,132,0.18)] bg-white p-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Control Coverage</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-blue-50 px-2 py-2">
                  <p className="font-app-display text-lg font-bold text-blue-700">{overview.summary.openHighRiskItems}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-700/78">High Risk</p>
                </div>
                <div className="rounded-md bg-emerald-50 px-2 py-2">
                  <p className="font-app-display text-lg font-bold text-emerald-700">
                    {documentRateMeasured ? `${Math.round(overview.summary.documentReadinessRate)}%` : "--"}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700/78">Docs</p>
                </div>
                <div className="rounded-md bg-amber-50 px-2 py-2">
                  <p className="font-app-display text-lg font-bold text-amber-700">{missingPermitsTotal}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700/78">Permits</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {overview.leadershipTrust ? <TrustSummaryPanel trust={overview.leadershipTrust} /> : null}

      <DashboardDetailsTabs
        activeTab={activeTab}
        onTabChange={selectTab}
        panels={{
          operations: (
            <>
      <SectionCard
        eyebrow="Prevention snapshot"
        title="1. Current Safety Health"
        tone="elevated"
        aside={renderPinButton("metric_primary", "Pin KPIs")}
        description={
          overviewVisibility.preventionHeadlineMode === "field"
            ? "Open exposure, overdue follow-up, and readiness for visible work."
            : "Headline indicators for the selected window."
        }
      >
        {headlineKpisAreMeaningful(overview) ? (
          <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3">
            {overviewVisibility.preventionHeadlineMode === "field" ? (
              <>
                <MetricCard
                  label="Open high-risk items"
                  value={overview.summary.openHighRiskItems}
                  hint="High-risk work exposure—requires field verification"
                  statusBand={openHighRiskCountBand(overview.summary.openHighRiskItems)}
                />
                <MetricCard
                  label="Overdue corrective actions"
                  value={overview.summary.overdueCorrectiveActions}
                  hint="Missing control follow-through past due date"
                  statusBand={overdueCorrectiveCountBand(overview.summary.overdueCorrectiveActions)}
                  href="/field-id-exchange?status=overdue"
                />
                <MetricCard
                  label="Training readiness rate"
                  value={trainingMeasured ? `${Math.round(overview.summary.trainingReadinessRate)}%` : "Not enough data yet"}
                  valueMuted={!trainingMeasured}
                  statusBand={trainingSummaryBand}
                  href="/training-matrix?status=complete"
                  hint={
                    trainingMeasured
                      ? undefined
                      : "No training or credential rows in this selection—rate is hidden until records exist."
                  }
                />
              </>
            ) : (
              <>
                <MetricCard
                  label="Safety health score"
                  value={overview.summary.safetyHealthScore}
                  hint="0–100 composite prevention posture"
                  statusBand={healthCompositeBand}
                />
                <MetricCard
                  label="Open high-risk items"
                  value={overview.summary.openHighRiskItems}
                  hint="High-risk work exposure—requires field verification"
                  statusBand={openHighRiskCountBand(overview.summary.openHighRiskItems)}
                />
                <MetricCard
                  label="Overdue corrective actions"
                  value={overview.summary.overdueCorrectiveActions}
                  hint="Missing control follow-through past due date"
                  statusBand={overdueCorrectiveCountBand(overview.summary.overdueCorrectiveActions)}
                  href="/field-id-exchange?status=overdue"
                />
                <MetricCard
                  label="Permit compliance rate"
                  value={permitRateMeasured ? `${Math.round(overview.summary.permitComplianceRate)}%` : "Not enough data yet"}
                  valueMuted={!permitRateMeasured}
                  statusBand={permitSummaryBand}
                  href="/permits?filter=permit-exposure"
                  hint={
                    permitRateMeasured
                      ? undefined
                      : "No permit activity in this selection—rate is not shown so it is not mistaken for measured compliance."
                  }
                />
                <MetricCard
                  label="Training readiness rate"
                  value={trainingMeasured ? `${Math.round(overview.summary.trainingReadinessRate)}%` : "Not enough data yet"}
                  valueMuted={!trainingMeasured}
                  statusBand={trainingSummaryBand}
                  href="/training-matrix?status=complete"
                  hint={
                    trainingMeasured
                      ? undefined
                      : "No training or credential rows in this selection—rate is hidden until records exist."
                  }
                />
                <MetricCard
                  label="Document readiness rate"
                  value={documentRateMeasured ? `${Math.round(overview.summary.documentReadinessRate)}%` : "Not enough data yet"}
                  valueMuted={!documentRateMeasured}
                  statusBand={documentSummaryBand}
                  hint={
                    documentRateMeasured
                      ? undefined
                      : "No documents in workflow for this selection—rate is hidden until files are submitted."
                  }
                />
              </>
            )}
          </div>
        ) : (
          <DashboardDomainEmptyState
            icon={Activity}
            title={HEADLINE_HEALTH_EMPTY.title}
            description={HEADLINE_HEALTH_EMPTY.description}
          />
        )}
      </SectionCard>
            </>
          ),

          trends: (
            <>
      {overviewVisibility.showForecast ? (
      <SectionCard
        eyebrow="Forward view"
        title="2. Smart Safety Forecast"
        tone="elevated"
        aside={renderPinButton("graph_hazard_trends", "Pin forecast")}
        description="Incident and near-miss buckets compared across the period."
      >
        {incidentsHaveData ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">Incident signal</span>
              <StatusBadge label={outlookLabel(outlook)} tone={outlookTone(outlook)} />
            </div>
            {outlook === "worsening" ? (
              <p className="mt-3 text-sm leading-relaxed text-[var(--app-text)]">
                Recent buckets show higher counts than earlier in the window. Recommended action: confirm staffing, scope changes,
                and energy isolation / fall protection where work is active. Pre-task review needed on the highest-hazard tasks.
              </p>
            ) : outlook === "improving" ? (
              <p className="mt-3 text-sm leading-relaxed text-[var(--app-text)]">
                Counts are easing compared with earlier in the window. Sustain the controls and supervision behaviors that
                likely contributed—document them for other sites.
              </p>
            ) : (
              <p className="mt-3 text-sm text-[var(--app-muted)]">
                Incident signal is stable in this window. Keep routine verification so a quiet chart does not mask a repeat issue
                on the ground.
              </p>
            )}
          </>
        ) : (
          <DashboardDomainEmptyState
            icon={AlertTriangle}
            title={INCIDENTS_EMPTY.title}
            description={INCIDENTS_EMPTY.description}
          />
        )}
      </SectionCard>
      ) : null}

      {(overviewVisibility.showEmergingThemes || overviewVisibility.showObservationMix) && (
      <SectionCard
        eyebrow="Early signal"
        title={
          overviewVisibility.showEmergingThemes
            ? "3. Emerging Risk Areas"
            : "3. Observation activity"
        }
        tone="panel"
        aside={renderPinButton(
          overviewVisibility.showObservationMix ? "graph_observation_mix" : "hazard_trends",
          "Pin signal"
        )}
        description={
          overviewVisibility.showEmergingThemes
            ? "Ranked themes and field observation mix."
            : "Positive versus other observation volume for your visible scope."
        }
      >
        {overviewVisibility.showEmergingThemes ? (
        <div>
          <h3 className="text-sm font-bold text-[var(--app-text-strong)]">Top Emerging Themes</h3>
          {topEmerging.length === 0 ? (
            <div className="mt-2">
              <DashboardDomainEmptyState
                icon={ScanLine}
                title={EMERGING_THEMES_EMPTY.title}
                description={EMERGING_THEMES_EMPTY.description}
              />
            </div>
          ) : (
            <ul className="mt-2 space-y-2">
              {topEmerging.map((r, i) => (
                <li
                  key={`${r.name}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--app-border)] bg-white/90 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-[var(--app-text-strong)]">
                    {i + 1}. {formatTitleCase(r.name) || r.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-app-display font-bold text-[var(--app-text-strong)]">{r.count}</span>
                    <StatusBadge
                      label={r.severity}
                      trafficLight={r.severity === "low" ? "green" : r.severity === "medium" ? "yellow" : "red"}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        ) : null}
        {overviewVisibility.showObservationMix ? (
        <div className={overviewVisibility.showEmergingThemes ? "mt-6" : undefined}>
          <ObservationDualLineChart
            points={overview.observationTrend}
            title="Observation mix by period"
            description="Compare positive versus other observation volume. Divergence can indicate a missing control or weak verification—escalate when negative volume climbs."
          />
        </div>
        ) : null}
        {overviewVisibility.showEmergingThemes ? (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-[var(--app-text-strong)]">Repeat Observation Categories</h3>
          {obsCategories.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--app-muted)]">No repeat observation categories for this period.</p>
          ) : (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {obsCategories.slice(0, 8).map((c, i) => (
                <li key={`${c.name}-${i}`} className="flex items-center justify-between rounded-xl border border-[var(--app-border)] bg-white/88 px-3 py-2 text-sm">
                  <span className="truncate font-medium text-[var(--app-text-strong)]">
                    {formatTitleCase(c.name) || c.name}
                  </span>
                  <span className="font-app-display font-bold text-[var(--app-text-strong)]">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        ) : null}
      </SectionCard>
      )}
            </>
          ),

          risks: (
            <>
      {overviewVisibility.showCorrectiveCenter ? (
      <SectionCard
        eyebrow="Closure discipline"
        title="4. Corrective Action Control Center"
        tone="attention"
        aside={renderPinButton("graph_risk_reduction", "Pin correctives")}
        description="Open, overdue, and closed posture plus follow-up list."
      >
        <StatusBarChart
          segments={correctiveSegments}
          title="Corrective status mix"
          description="Open and overdue items are prevention debt until verified in the field and closed in the system."
          showCompositionStrip
        />
        {correctiveHasAnyActivity(overview.correctiveActionStatus) ? (
          <div className="mt-4">
            <MetricCard
              label="Average days to close"
              value={overview.correctiveActionStatus.averageDaysToClose ?? "—"}
              hint={overview.correctiveActionStatus.averageDaysToClose == null ? "Need closed rows with dates." : undefined}
            />
          </div>
        ) : null}
        {correctiveHasAnyActivity(overview.correctiveActionStatus) ? (
          <div className="mt-6">
            <h3 className="text-sm font-bold text-[var(--app-text-strong)]">Overdue Items (Requires Field Verification)</h3>
            {overdueRows.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--app-muted)]">
                No overdue corrective actions require follow-up for this view.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-[var(--app-border-subtle)] overflow-hidden rounded-xl border border-[var(--app-border)] bg-white/92 text-sm">
                {overdueRows.map((row) => (
                  <li key={row.id} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--app-text-strong)]">
                        {formatTitleCase((row.category ?? "Uncategorized").replace(/_/g, " "))}
                      </p>
                      <p className="text-xs text-[var(--app-muted)]">
                        {row.observation_type ? `${row.observation_type} · ` : null}
                        Due {row.due_at ? new Date(row.due_at).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <Link href="/field-id-exchange" className="shrink-0 text-xs font-semibold text-[var(--app-accent-primary)]">
                      View correctives
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </SectionCard>
      ) : null}

      {overviewVisibility.showContractorScorecards ? (
      <SectionCard
        eyebrow="Partners on site"
        title="6. Contractor Risk Scorecards"
        tone="elevated"
        aside={renderPinButton("risk_ranking", "Pin scorecards")}
        description="Ranking from compliance documents and evaluations."
      >
        <ContractorRiskTable contractors={overview.contractorRiskScores} />
      </SectionCard>
      ) : null}
            </>
          ),

          readiness: (
            <>
      {overviewVisibility.showPermits ? (
      <SectionCard
        eyebrow="Permits and daily plans"
        title="5. JSA / Permit Compliance"
        tone="panel"
        aside={renderPinButton("permit_followups", "Pin permits")}
        description="Type-level permit posture and JSA completion."
      >
        {overview.permitCompliance.length > 0 || missingPermitsTotal > 0 ? (
          <p className="text-sm text-[var(--app-text)]">
            <span className="font-semibold text-[var(--app-text-strong)]">Missing required permits (bucketed): </span>
            {missingPermitsTotal}
          </p>
        ) : null}
        <div className="mt-4">
          <PermitComplianceTable permits={overview.permitCompliance} jsaCompletionRate={overview.summary.jsaCompletionRate} />
        </div>
      </SectionCard>
      ) : null}

      {overviewVisibility.showWorkforceReadiness ? (
      <SectionCard
        eyebrow="Credentials and roles"
        title="7. Workforce Readiness"
        tone="panel"
        aside={renderPinButton("training_signal", "Pin training")}
        description="Training coverage and credential timing."
      >
        {trainingMeasured ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricCard
              label="Overall training readiness"
              value={`${Math.round(overview.summary.trainingReadinessRate)}%`}
              statusBand={trainingReadinessSummaryBand(
                overview.summary.trainingReadinessRate,
                true,
                cred.expiredCredentials
              )}
              href="/training-matrix?status=complete"
            />
            <MetricCard
              label="Expired credentials (docs)"
              value={cred.expiredCredentials}
              hint="Contractor documents past expiry"
              statusBand={cred.expiredCredentials > 0 ? "red" : "green"}
              href="/training-matrix?status=overdue"
            />
            <MetricCard
              label="Expiring soon (30d)"
              value={cred.expiringSoonCredentials}
              statusBand={cred.expiringSoonCredentials > 0 ? "yellow" : "green"}
              href="/training-matrix?status=expiring_soon"
            />
          </div>
        ) : (
          <DashboardDomainEmptyState
            icon={GraduationCap}
            title={TRAINING_EMPTY.title}
            description={TRAINING_EMPTY.description}
          />
        )}
        <p className="mt-4 text-sm text-[var(--app-muted)]">
          Role-based training gaps are not shown in this overview yet—use the training matrix when HR connects assignments so
          missing control signals include role coverage.
        </p>
      </SectionCard>
      ) : null}

      {overviewVisibility.showDocumentReadiness ? (
      <SectionCard
        eyebrow="Evidence trail"
        title="8. Document Readiness"
        tone="elevated"
        aside={renderPinButton("recent_documents", "Pin documents")}
        description="Lifecycle counts for documents in scope."
      >
        <DocumentReadinessPanel
          readiness={overview.documentReadiness}
          overallStatusBand={documentPipelineTotal(doc) > 0 ? documentSummaryBand : undefined}
        />
      </SectionCard>
      ) : null}

            </>
          ),

          system: (
            <>
      {overviewVisibility.showAiInsights ? (
      <SectionCard
        eyebrow="Narrative review"
        title="9. Safety Intelligence Review"
        tone="panel"
        aside={renderPinButton("support_signals", "Pin review")}
        description="Rules-based takeaways and assignable recommended actions."
      >
        <AiInsightsPanel
          insights={overview.aiInsights}
          title="Findings"
          description="Each item states what changed, why it matters, who is affected, what to do next, and how the trend compares in this window."
        />
        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-bold text-[var(--app-text-strong)]">Data Sources Needing Attention</h3>
          {disconnectedSources.length === 0 ? (
            <p className="text-sm text-[var(--app-muted)]">No disconnected modules flagged, or all sources responded.</p>
          ) : (
            <ul className="list-inside list-disc text-sm text-[var(--app-text)]">
              {disconnectedSources.map((e) => (
                <li key={e.moduleName}>{formatTitleCase(e.moduleName) || e.moduleName}</li>
              ))}
            </ul>
          )}
          {weakDocs ? <InlineMessage tone="warning">{weakDocs}</InlineMessage> : null}
        </div>
      </SectionCard>
      ) : null}

      {overviewVisibility.showEngineHealth ? (
      <SectionCard
        eyebrow="Signal pipeline"
        title="10. Smart Safety Engine Health"
        tone="elevated"
        aside={renderPinButton("graph_workspace_signals", "Pin engine")}
        description="Status of the data paths that feed this overview."
      >
        <EngineHealthPanel items={smartEngineFinal} />
      </SectionCard>
      ) : null}

      {overviewVisibility.showSuperadminPlatformHealth ? (
        <SectionCard
          eyebrow="Platform"
          title="11. Superadmin System Health"
          tone="attention"
          description="Read-only infrastructure checks for sessions, storage, and routes."
        >
          {platformEngine.length > 0 ? (
            <EngineHealthPanel
              title="Infrastructure and routes"
              description="Checks most relevant to keeping overview and export paths reliable."
              items={platformEngine}
            />
          ) : (
            <p className="text-sm text-[var(--app-muted)]">
              No dedicated infrastructure rows were split out for this response—review section 10 for the full engine list.
            </p>
          )}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <InlineMessage tone="neutral">
              Failed uploads and failed document builds are not included in this feed yet—monitor via logs or your observability stack.
            </InlineMessage>
            <Link
              href="/superadmin/system-health"
              className="shrink-0 text-sm font-semibold text-[var(--app-accent-primary)] hover:text-[var(--app-link-hover)]"
            >
              Open full Superadmin System Health →
            </Link>
          </div>
        </SectionCard>
      ) : null}
            </>
          ),
        }}
      />
      <details className="group rounded-xl border border-[var(--app-border)] bg-white/92 px-4 py-4 shadow-[0_8px_20px_rgba(44,58,86,0.04)] sm:px-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">
              Secondary analytics
            </p>
            <h2 className="mt-0.5 text-lg font-bold tracking-tight text-[var(--app-text-strong)]">
              Performance Hub
            </h2>
          </div>
          <span className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] px-3 py-2 text-xs font-semibold text-[var(--app-text)] group-open:hidden">
            Show
          </span>
          <span className="hidden rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] px-3 py-2 text-xs font-semibold text-[var(--app-text)] group-open:inline-flex">
            Hide
          </span>
        </summary>
        <div className="mt-4">
          <PerformanceHubPanel overview={overview} activeJobsites={activeJobsites} />
        </div>
      </details>
    </div>
  );
}
