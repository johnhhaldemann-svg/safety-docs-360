"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  FileText,
  FolderKanban,
  GraduationCap,
  HardHat,
  Plus,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import {
  adminSideSections,
  companyAdminSideSections,
  companyManagerSideSections,
  companyUserSideSections,
  flattenNavItemsFromSections,
  userSideSections,
  type NavItem,
  type NavSection,
} from "@/lib/appNavigation";
import { canAccessCompanyWorkspaceHref } from "@/lib/companyFeatureAccess";
import { isApprovedDocumentStatus, isSubmittedDocumentStatus } from "@/lib/documentStatus";
import { resolveDashboardRole } from "@/lib/dashboardRole";
import { normalizeAppRole } from "@/lib/rbac";
import { getCsepNavSectionsForRole } from "@/lib/workspaceProduct";
import type {
  DashboardDataState,
  DashboardDocument,
  DashboardFeedItem,
  DashboardJobsite,
  DashboardRiskRow,
} from "@/components/dashboard/types";

type MetricCard = {
  label: string;
  value: string;
  detail: string;
  detailTone: "neutral" | "success" | "warning" | "danger";
  icon: typeof FolderKanban;
  iconClassName: string;
};

type BreakdownSegment = {
  label: string;
  value: number;
  color: string;
};

type ProjectRow = {
  id: string;
  name: string;
  subtitle: string;
  progress: number;
  status: "On Track" | "At Risk" | "Needs Review";
  openTasks: number;
  overdue: number;
};

type ChartPoint = {
  label: string;
  observations: number;
  sifSignals: number;
};

type DashboardRouteLink = {
  href: string;
  label: string;
  icon: typeof FolderKanban;
};

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeHref(href: string) {
  return href.split("#")[0] ?? href;
}

function isActiveStatus(status?: string | null) {
  return !["closed", "archived", "expired", "verified_closed", "completed", "inactive"].includes(
    normalize(status)
  );
}

function getCompanyName(data: DashboardDataState) {
  return data.companyProfile?.name?.trim() || data.userTeam || "Main Office";
}

function getRoleLabel(role: string) {
  const dashboardRole = resolveDashboardRole(role);
  if (dashboardRole === "company_admin") return "Company Admin";
  if (dashboardRole === "safety_manager") return "Safety Manager";
  if (dashboardRole === "field_supervisor") return "Field Supervisor";
  return "Project Manager";
}

function getWorkspaceLabel(data: DashboardDataState) {
  return data.workspaceProduct === "csep" ? "CSEP Workspace" : "Company Workspace";
}

function getDocumentTitle(document: DashboardDocument) {
  return (
    document.document_title?.trim() ||
    document.project_name?.trim() ||
    document.file_name?.trim() ||
    "Untitled document"
  );
}

function getRelativeTime(timestamp?: string | null) {
  if (!timestamp) return "Recently";

  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function getStatusCount(rows: DashboardRiskRow[]) {
  return rows.filter((row) => isActiveStatus(row.status)).length;
}

function getObservationCount(data: DashboardDataState) {
  return data.workspaceSummary.observations.filter((row) => isActiveStatus(row.status)).length;
}

function getOverdueCount(data: DashboardDataState) {
  return data.workspaceSummary.observations.filter((row) => {
    if (!isActiveStatus(row.status) || !row.due_at) {
      return false;
    }
    return new Date(row.due_at).getTime() < Date.now();
  }).length;
}

function getPastSevenDays(): Array<{ iso: string; label: string }> {
  const days: Array<{ iso: string; label: string }> = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    days.push({ iso, label });
  }
  return days;
}

function trendCountsByIsoDay(trends: Array<{ date: string; count: number }> | undefined) {
  const map = new Map<string, number>();
  for (const row of trends ?? []) {
    const day = String(row.date).slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + (Number(row.count) || 0));
  }
  return map;
}

function countRowsCreatedOnDay<T extends { created_at?: string | null }>(rows: T[], iso: string) {
  return rows.filter((row) => {
    const ts = row.created_at;
    if (!ts) return false;
    return String(ts).slice(0, 10) === iso;
  }).length;
}

function buildChartSeries(data: DashboardDataState): ChartPoint[] {
  const days = getPastSevenDays();
  const obsFromAnalytics = trendCountsByIsoDay(data.analyticsSummary?.observationTrends);
  const sifFromAnalytics = trendCountsByIsoDay(data.analyticsSummary?.sifTrends);
  const incidentsWithSif = data.workspaceSummary.incidents.filter((row) => Boolean(row.sif_flag));

  return days.map(({ iso, label }) => {
    const observationsFromApi = obsFromAnalytics.get(iso);
    const observations =
      observationsFromApi !== undefined
        ? observationsFromApi
        : countRowsCreatedOnDay(data.workspaceSummary.observations, iso);

    const sifFromApi = sifFromAnalytics.get(iso);
    const sifSignals =
      sifFromApi !== undefined ? sifFromApi : countRowsCreatedOnDay(incidentsWithSif, iso);

    return { label, observations, sifSignals };
  });
}

function getDashboardNavItems(data: DashboardDataState): NavItem[] {
  const normalizedRole = normalizeAppRole(data.userRole);
  const isAdminLike =
    normalizedRole === "admin" ||
    normalizedRole === "platform_admin" ||
    normalizedRole === "super_admin";
  const isCompanyAdminUser = normalizedRole === "company_admin";
  const isCompanyManagerUser =
    normalizedRole === "manager" || normalizedRole === "safety_manager";
  const isCompanyUser = [
    "company_user",
    "project_manager",
    "field_supervisor",
    "foreman",
    "field_user",
    "read_only",
  ].includes(normalizedRole);

  let sections: NavSection[] =
    isAdminLike ? adminSideSections : userSideSections;

  if (data.workspaceProduct === "csep" && (isCompanyAdminUser || isCompanyManagerUser || isCompanyUser)) {
    sections = getCsepNavSectionsForRole(normalizedRole) as NavSection[];
  } else if (isCompanyAdminUser) {
    sections = companyAdminSideSections;
  } else if (isCompanyManagerUser) {
    sections = companyManagerSideSections;
  } else if (isCompanyUser) {
    sections = companyUserSideSections;
  }

  return flattenNavItemsFromSections(
    sections.map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        isAdminLike
          ? true
          : canAccessCompanyWorkspaceHref(item.href, normalizedRole, data.permissionMap)
      ),
    }))
  );
}

function pickNavItem(navItems: NavItem[], candidates: string[]) {
  const navMap = new Map(navItems.map((item) => [normalizeHref(item.href), item] as const));
  for (const candidate of candidates) {
    const item = navMap.get(candidate);
    if (item) {
      return item;
    }
  }
  return null;
}

function buildToolbarFilters(data: DashboardDataState) {
  const jobsitesCount = data.workspaceSummary.jobsites.length;
  const reportsCount = data.workspaceSummary.reports.length;
  const liveStatus = data.companyWorkspaceLoading
    ? "Syncing now"
    : data.companyWorkspaceLoaded
      ? "Live data"
      : "Loading";

  return [
    { label: "Company", value: getCompanyName(data) },
    { label: "Role", value: getRoleLabel(data.userRole) },
    { label: "Workspace", value: getWorkspaceLabel(data) },
    { label: "Jobsites", value: `${jobsitesCount} active` },
    { label: "Documents", value: `${data.documents.length} records` },
    { label: "Reports", value: `${reportsCount} items` },
    { label: "Status", value: liveStatus },
  ];
}

function buildUnifiedQuickActions(navItems: NavItem[]): DashboardRouteLink[] {
  const definitions: Array<{
    candidates: string[];
    label?: string;
    icon: typeof FolderKanban;
  }> = [
    { candidates: ["/command-center", "/reports", "/analytics"], icon: ShieldAlert },
    { candidates: ["/field-id-exchange", "/jsa"], icon: AlertTriangle },
    { candidates: ["/library", "/search", "/submit"], icon: BookOpenText },
    { candidates: ["/incidents"], label: "New incident", icon: AlertTriangle },
    { candidates: ["/field-id-exchange"], label: "New issue", icon: ShieldAlert },
    { candidates: ["/jsa"], label: "New JSA", icon: HardHat },
    { candidates: ["/permits"], label: "New permit", icon: CheckCircle2 },
    { candidates: ["/submit"], label: "New submission", icon: FileText },
    { candidates: ["/upload"], label: "New upload", icon: FolderKanban },
    { candidates: ["/csep", "/peshep"], label: "Build document", icon: BookOpenText },
  ];

  const used = new Set<string>();

  return definitions
    .map((definition) => {
      const item = pickNavItem(navItems, definition.candidates);
      if (!item) {
        return null;
      }

      const normalizedHref = normalizeHref(item.href);
      if (used.has(normalizedHref)) {
        return null;
      }
      used.add(normalizedHref);

      return {
        href: item.href,
        label: definition.label ?? item.label,
        icon: definition.icon,
      } satisfies DashboardRouteLink;
    })
    .filter((item): item is DashboardRouteLink => item != null);
}

function pickHref(navItems: NavItem[], candidates: string[]) {
  return pickNavItem(navItems, candidates)?.href ?? "/dashboard";
}

function buildMetrics(data: DashboardDataState): MetricCard[] {
  const cd = data.analyticsSummary?.companyDashboard;
  const jobsitesCount = data.workspaceSummary.jobsites.length;
  const incidents = getStatusCount(data.workspaceSummary.incidents);
  const observations = getObservationCount(data);
  const permits = getStatusCount(data.workspaceSummary.permits);
  const openWorkItems = incidents + observations + permits;
  const pendingInvites = data.companyInvites.length;
  const openDaps = data.workspaceSummary.daps.filter((row) => isActiveStatus(row.status)).length;
  const trainingSignal = pendingInvites + openDaps;
  const overdueItems = getOverdueCount(data);

  return [
    {
      label: "Active jobsites",
      value: `${cd?.totalActiveJobsites ?? jobsitesCount}`,
      detail:
        cd != null
          ? `Open observations (30d window): ${cd.totalOpenObservations}`
          : "Jobsites linked to your company workspace.",
      detailTone: "neutral",
      icon: FolderKanban,
      iconClassName: "bg-blue-50 text-blue-600",
    },
    {
      label: "Open work items",
      value: `${openWorkItems}`,
      detail: "Sum of active incidents, corrective actions, and permits in workspace.",
      detailTone: openWorkItems > 0 ? "warning" : "neutral",
      icon: CheckCircle2,
      iconClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Incidents",
      value: `${incidents}`,
      detail:
        cd != null
          ? `Open incidents in analytics window: ${cd.openIncidents}`
          : "Active incidents in workspace list.",
      detailTone: incidents > 0 ? "warning" : "neutral",
      icon: AlertTriangle,
      iconClassName: "bg-red-50 text-red-500",
    },
    {
      label: "Observations",
      value: `${observations}`,
      detail:
        cd != null
          ? `High-risk observations: ${cd.totalHighRiskObservations}`
          : "Open corrective actions in workspace.",
      detailTone: observations > 0 ? "warning" : "neutral",
      icon: Eye,
      iconClassName: "bg-amber-50 text-amber-500",
    },
    {
      label: "Training / DAP signal",
      value: `${trainingSignal}`,
      detail: "Pending invites plus open JSAs (workspace).",
      detailTone: trainingSignal > 0 ? "warning" : "neutral",
      icon: GraduationCap,
      iconClassName: "bg-violet-50 text-violet-500",
    },
    {
      label: "Overdue items",
      value: `${overdueItems}`,
      detail: "Corrective actions with due date in the past.",
      detailTone: overdueItems > 0 ? "danger" : "success",
      icon: Clock3,
      iconClassName: "bg-rose-50 text-rose-500",
    },
  ];
}

function buildSignalBreakdown(data: DashboardDataState): BreakdownSegment[] {
  const obs = data.analyticsSummary?.observationBreakdown;
  const openIncidents = getStatusCount(data.workspaceSummary.incidents);
  const openObservations = getObservationCount(data);
  const segments: BreakdownSegment[] = [];

  if (openIncidents > 0) {
    segments.push({ label: "Open incidents", value: openIncidents, color: "#ff5348" });
  }

  if (obs) {
    if (obs.nearMiss > 0) {
      segments.push({ label: "Near miss (obs.)", value: obs.nearMiss, color: "#2f6cf6" });
    }
    if (obs.hazard > 0) {
      segments.push({ label: "Hazard (obs.)", value: obs.hazard, color: "#ffbf3c" });
    }
    if (obs.positive > 0) {
      segments.push({ label: "Positive (obs.)", value: obs.positive, color: "#49bf84" });
    }
    if (obs.other > 0) {
      segments.push({ label: "Other (obs.)", value: obs.other, color: "#94a3b8" });
    }
  } else if (openObservations > 0) {
    segments.push({
      label: "Open corrective actions",
      value: openObservations,
      color: "#2f6cf6",
    });
  }

  return segments;
}

function buildDocumentBreakdown(data: DashboardDataState): BreakdownSegment[] {
  const approved = data.documents.filter((document) =>
    isApprovedDocumentStatus(document.status, Boolean(document.final_file_path))
  ).length;
  const inReview = data.documents.filter((document) =>
    isSubmittedDocumentStatus(document.status, Boolean(document.final_file_path))
  ).length;
  const expired = data.documents.filter((document) => normalize(document.status) === "expired").length;
  const draft = Math.max(data.documents.length - approved - inReview - expired, 0);

  return [
    { label: "Approved", value: approved, color: "#44be82" },
    { label: "In Review", value: inReview, color: "#3375f7" },
    { label: "Draft", value: draft, color: "#ffbf3c" },
    { label: "Expired", value: expired, color: "#ff5a52" },
  ].filter((segment) => segment.value > 0);
}

function getProjectRows(data: DashboardDataState): ProjectRow[] {
  const jobsites = data.workspaceSummary.jobsites.slice(0, 3);

  if (jobsites.length === 0) {
    return [];
  }

  return jobsites.map((jobsite: DashboardJobsite, index) => {
    const activeIncidents = data.workspaceSummary.incidents.filter(
      (row) => row.jobsite_id === jobsite.id && isActiveStatus(row.status)
    ).length;
    const overdueItems = data.workspaceSummary.observations.filter((row) => {
      if (row.jobsite_id !== jobsite.id || !row.due_at || !isActiveStatus(row.status)) {
        return false;
      }
      return new Date(row.due_at).getTime() < Date.now();
    }).length;
    const openTasks = data.workspaceSummary.observations.filter(
      (row) => row.jobsite_id === jobsite.id && isActiveStatus(row.status)
    ).length;
    const progress = Math.max(28, Math.min(92, 78 - activeIncidents * 8 - overdueItems * 6 + index * 6));
    const status: ProjectRow["status"] =
      overdueItems > 2 || activeIncidents > 2
        ? "Needs Review"
        : overdueItems > 0 || activeIncidents > 0
          ? "At Risk"
          : "On Track";

    return {
      id: jobsite.id ?? `${jobsite.name}-${index}`,
      name: jobsite.name,
      subtitle: jobsite.location?.trim() || jobsite.project_number?.trim() || "Company project",
      progress,
      status,
      openTasks,
      overdue: overdueItems,
    };
  });
}

function buildActivityFeed(data: DashboardDataState): DashboardFeedItem[] {
  const jobsiteNames = new Map(
    data.workspaceSummary.jobsites
      .filter((jobsite) => jobsite.id)
      .map((jobsite) => [jobsite.id as string, jobsite.name] as const)
  );

  const incidentItems = data.workspaceSummary.incidents
    .filter((row) => isActiveStatus(row.status))
    .slice(0, 2)
    .map((row, index) => ({
      id: row.id ?? `incident-${index}`,
      title: row.title?.trim() || "New incident reported",
      detail: row.jobsite_id ? jobsiteNames.get(row.jobsite_id) ?? "Assigned jobsite" : "Company-wide item",
      meta:
        row.stop_work_status === "stop_work_active"
          ? "Stop work"
          : getRelativeTime(row.created_at ?? null),
      tone: row.stop_work_status === "stop_work_active" ? ("error" as const) : ("warning" as const),
    }));

  const documentItems = data.documents
    .slice()
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 3)
    .map((document) => ({
      id: document.id,
      title: getDocumentTitle(document),
      detail: document.project_name?.trim() || document.document_type?.trim() || "Document activity",
      meta: getRelativeTime(document.created_at),
      tone: isApprovedDocumentStatus(document.status, Boolean(document.final_file_path))
        ? ("success" as const)
        : isSubmittedDocumentStatus(document.status, Boolean(document.final_file_path))
          ? ("warning" as const)
          : ("info" as const),
    }));

  const inviteItems = data.companyInvites.slice(0, 1).map((invite) => ({
    id: invite.id,
    title: `Team invite (${invite.role})`,
    detail: invite.email,
    meta: getRelativeTime(invite.created_at),
    tone: "info" as const,
  }));

  return [...incidentItems, ...documentItems, ...inviteItems].slice(0, 5);
}

function getToneClass(status: ProjectRow["status"]) {
  if (status === "On Track") return "bg-emerald-50 text-emerald-700";
  if (status === "At Risk") return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
}

function buildDonutStyle(segments: BreakdownSegment[]) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) {
    return { background: "#e2e8f0" };
  }
  let start = 0;
  const stops = segments.map((segment) => {
    const size = (segment.value / total) * 360;
    const stop = `${segment.color} ${start}deg ${start + size}deg`;
    start += size;
    return stop;
  });
  return {
    background: `conic-gradient(${stops.join(", ")})`,
  };
}

function buildLinePath(values: number[], width: number, height: number, padding: number) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
      const y = height - padding - ((value - min) / span) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function DashboardToolbar({
  filters,
  quickActions,
}: {
  filters: Array<{ label: string; value: string }>;
  quickActions: DashboardRouteLink[];
}) {
  const primaryQuickAction = quickActions[0] ?? null;

  return (
    <section className="rounded-b-[1.9rem] border border-[var(--app-border-subtle)] border-t-0 bg-[rgba(255,255,255,0.88)] p-4 shadow-[var(--app-shadow-soft)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          {filters.map((filter) => (
            <div
              key={filter.label}
              className="flex min-h-[58px] flex-col rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-left text-[var(--app-text-strong)] shadow-sm transition hover:border-[rgba(37,99,235,0.28)]"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                {filter.label}
              </span>
              <span className="mt-1 text-sm font-medium text-[var(--app-text-strong)]">{filter.value}</span>
            </div>
          ))}
        </div>

        {primaryQuickAction ? (
          <details className="group relative xl:ml-4">
            <summary className="inline-flex list-none items-center gap-2 rounded-xl bg-[var(--app-accent-primary)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)] transition hover:bg-[var(--app-accent-primary-hover)] active:bg-[var(--app-accent-primary-active)] marker:content-none">
              <Plus className="h-4 w-4" />
              Actions
              <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.75rem)] z-20 hidden min-w-[220px] rounded-xl border border-[var(--app-border-subtle)] bg-white py-2 text-sm text-[var(--app-text)] shadow-[var(--app-shadow-soft)] group-open:block">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-[var(--app-accent-primary-soft)]"
                >
                  <action.icon className="h-4 w-4 text-[#2f6cf6]" />
                  {action.label}
                </Link>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function metricDetailClass(tone: MetricCard["detailTone"]) {
  if (tone === "success") return "text-emerald-600";
  if (tone === "warning") return "text-amber-600";
  if (tone === "danger") return "text-rose-600";
  return "text-[var(--app-muted)]";
}

export function DashboardExperience({ data }: { data: DashboardDataState }) {
  const navItems = getDashboardNavItems(data);
  const toolbarFilters = buildToolbarFilters(data);
  const quickActions = buildUnifiedQuickActions(navItems);
  const metrics = buildMetrics(data);
  const chartSeries = buildChartSeries(data);
  const incidentBreakdown = buildSignalBreakdown(data);
  const incidentTotal = incidentBreakdown.reduce((sum, segment) => sum + segment.value, 0);
  const documentBreakdown = buildDocumentBreakdown(data);
  const documentTotal = documentBreakdown.reduce((sum, segment) => sum + segment.value, 0);
  const activityItems = buildActivityFeed(data);
  const projects = getProjectRows(data);
  const companyName = getCompanyName(data);
  const roleLabel = getRoleLabel(data.userRole);
  const incidentReportHref = pickHref(navItems, [
    "/analytics",
    "/reports",
    "/incidents",
    "/field-id-exchange",
  ]);
  const recentActivityHref = pickHref(navItems, [
    "/command-center",
    "/reports",
    "/field-id-exchange",
    "/dashboard",
  ]);
  const projectHref = pickHref(navItems, ["/jobsites", "/dashboard"]);
  const documentHref = pickHref(navItems, ["/library", "/search", "/dashboard"]);
  const observationLine = chartSeries.map((point) => point.observations);
  const sifLine = chartSeries.map((point) => point.sifSignals);
  const maxLineValue = Math.max(1, ...observationLine, ...sifLine);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.9rem] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(241,247,255,0.96)_100%)] shadow-[var(--app-shadow)]">
        <div className="flex flex-col gap-5 border-b border-[var(--app-border-subtle)] px-5 py-5 md:px-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">
              Dashboard
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--app-text-strong)] sm:text-[2rem]">
              Welcome back, {companyName}.
            </h1>
            <p className="mt-1 text-sm text-[var(--app-text)]">
              Here&apos;s what&apos;s happening across your {roleLabel.toLowerCase()} workspace.
            </p>
          </div>
        </div>

        <DashboardToolbar filters={toolbarFilters} quickActions={quickActions} />
      </section>

      {data.analyticsSummaryIssue ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {data.analyticsSummaryIssue.message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-[1.35rem] border border-[var(--app-border-subtle)] bg-white p-5 shadow-[var(--app-shadow-soft)]"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${metric.iconClassName}`}>
                <metric.icon className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium text-[var(--app-text)]">{metric.label}</div>
            </div>
            <div className="mt-5 text-[2rem] font-semibold tracking-tight text-[var(--app-text-strong)]">
              {metric.value}
            </div>
            <p className={`mt-4 text-sm leading-snug ${metricDetailClass(metric.detailTone)}`}>{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr_0.95fr]">
        <article className="rounded-[1.5rem] border border-[var(--app-border-subtle)] bg-white p-5 shadow-[var(--app-shadow-soft)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[1.45rem] font-semibold tracking-tight text-[var(--app-text-strong)]">Activity trend</h2>
              <p className="mt-1 text-sm text-[var(--app-muted)]">
                Last 7 calendar days. Prefers company analytics daily trends when loaded; otherwise uses workspace
                record creation dates.
              </p>
            </div>
            <span className="inline-flex items-center rounded-xl border border-[var(--app-border-subtle)] px-3 py-2 text-xs font-medium text-[var(--app-muted)]">
              Last 7 days
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-[var(--app-text)]">
              <span className="h-3 w-3 rounded-full bg-[#ff5348]" />
              SIF-related signals
            </div>
            <div className="flex items-center gap-2 text-[var(--app-text)]">
              <span className="h-3 w-3 rounded-full bg-[#2f6cf6]" />
              Corrective actions opened
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[1.35rem] border border-[var(--app-border-subtle)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-3 py-4">
            <svg viewBox="0 0 720 300" className="h-[260px] w-full" role="img" aria-label="Workspace activity trend chart">
              {[0, 1, 2, 3].map((index) => {
                const y = 40 + index * 55;
                return (
                  <g key={y}>
                    <line x1="42" x2="690" y1={y} y2={y} stroke="#e7edf7" strokeWidth="1" />
                    <text x="8" y={y + 4} fill="#64748b" fontSize="12">
                      {Math.round(maxLineValue - (index * maxLineValue) / 3)}
                    </text>
                  </g>
                );
              })}
              <path
                d={`${buildLinePath(sifLine, 720, 260, 42)} L 678 218 L 42 218 Z`}
                fill="rgba(255,83,72,0.08)"
              />
              <path
                d={`${buildLinePath(observationLine, 720, 260, 42)} L 678 218 L 42 218 Z`}
                fill="rgba(47,108,246,0.12)"
              />
              <path
                d={buildLinePath(sifLine, 720, 260, 42)}
                fill="none"
                stroke="#ff5348"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={buildLinePath(observationLine, 720, 260, 42)}
                fill="none"
                stroke="#2f6cf6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {sifLine.map((value, index) => {
                const x = 42 + (index * (720 - 84)) / Math.max(sifLine.length - 1, 1);
                const y = 218 - (value / maxLineValue) * 178;
                return (
                  <circle key={`sif-${chartSeries[index]?.label ?? index}`} cx={x} cy={y} r="4.5" fill="#ff5348" />
                );
              })}
              {observationLine.map((value, index) => {
                const x = 42 + (index * (720 - 84)) / Math.max(observationLine.length - 1, 1);
                const y = 218 - (value / maxLineValue) * 178;
                return (
                  <circle
                    key={`obs-${chartSeries[index]?.label ?? index}`}
                    cx={x}
                    cy={y}
                    r="4.5"
                    fill="#2f6cf6"
                  />
                );
              })}
              {chartSeries.map((point, index) => {
                const x = 42 + (index * (720 - 84)) / Math.max(chartSeries.length - 1, 1);
                return (
                  <text key={point.label} x={x - 16} y="248" fill="#64748b" fontSize="12">
                    {point.label}
                  </text>
                );
              })}
            </svg>
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-[var(--app-border-subtle)] bg-white p-5 shadow-[var(--app-shadow-soft)]">
          <h2 className="text-[1.45rem] font-semibold tracking-tight text-[var(--app-text-strong)]">Open safety mix</h2>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            Incidents from the workspace list; observation categories from analytics when available.
          </p>
          {incidentTotal > 0 ? (
            <div className="mt-6 flex flex-col items-center gap-6 lg:flex-row lg:items-center">
              <div
                className="relative flex h-[170px] w-[170px] items-center justify-center rounded-full"
                style={buildDonutStyle(incidentBreakdown)}
              >
                <div className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-[2rem] font-semibold text-[var(--app-text-strong)]">{incidentTotal}</span>
                  <span className="text-sm text-[var(--app-muted)]">Total</span>
                </div>
              </div>
              <div className="w-full space-y-4">
                {incidentBreakdown.map((segment) => (
                  <div key={segment.label} className="flex items-center justify-between gap-4 text-sm">
                    <div className="flex items-center gap-2 text-[var(--app-text)]">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                      {segment.label}
                    </div>
                    <div className="font-medium text-[var(--app-text-strong)]">
                      {segment.value} ({Math.round((segment.value / incidentTotal) * 100)}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-[var(--app-muted)]">
              No open incidents or observation breakdown yet. As data syncs, categories will appear here.
            </p>
          )}
          <Link href={incidentReportHref} className="mt-4 inline-flex items-center text-sm font-semibold text-[#2f6cf6]">
            View full report
          </Link>
        </article>

        <article className="rounded-[1.5rem] border border-[var(--app-border-subtle)] bg-white p-5 shadow-[var(--app-shadow-soft)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[1.45rem] font-semibold tracking-tight text-[var(--app-text-strong)]">Recent Activity</h2>
            <Link href={recentActivityHref} className="text-sm font-semibold text-[#2f6cf6]">
              View all
            </Link>
          </div>
          <div className="mt-5 space-y-4">
            {activityItems.length > 0 ? (
              activityItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-[var(--app-border-subtle)] p-3">
                  <div
                    className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${
                      item.tone === "success"
                        ? "bg-emerald-50 text-emerald-600"
                        : item.tone === "warning"
                          ? "bg-amber-50 text-amber-500"
                          : item.tone === "error"
                            ? "bg-rose-50 text-rose-500"
                            : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    {item.tone === "success" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : item.tone === "warning" ? (
                      <TriangleAlert className="h-5 w-5" />
                    ) : item.tone === "error" ? (
                      <ShieldAlert className="h-5 w-5" />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-[var(--app-text-strong)]">{item.title}</div>
                    <div className="mt-1 text-sm text-[var(--app-muted)]">{item.detail}</div>
                  </div>
                  <div className="shrink-0 text-sm text-[var(--app-muted)]">{item.meta}</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--app-border-subtle)] px-4 py-6 text-sm text-[var(--app-muted)]">
                Activity will appear here as incidents, documents, and workspace updates come in.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_0.6fr]">
        <article className="rounded-[1.5rem] border border-[var(--app-border-subtle)] bg-white shadow-[var(--app-shadow-soft)]">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--app-border-subtle)] px-5 py-4">
            <div>
              <h2 className="text-[1.45rem] font-semibold tracking-tight text-[var(--app-text-strong)]">Project Status</h2>
              <p className="mt-1 text-sm text-[var(--app-muted)]">Snapshot of active project health and outstanding work.</p>
            </div>
            <Link href={projectHref} className="text-sm font-semibold text-[#2f6cf6]">
              View all projects
            </Link>
          </div>
          <div className="overflow-x-auto">
            {projects.length > 0 ? (
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-sm text-[var(--app-muted)]">
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 font-medium">Progress</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Open observations</th>
                    <th className="px-5 py-3 font-medium">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className="border-t border-[var(--app-border-subtle)] text-sm">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_100%)] text-[#2f6cf6]">
                            <HardHat className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--app-text-strong)]">{project.name}</div>
                            <div className="text-[var(--app-muted)]">{project.subtitle}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="w-full max-w-[180px]">
                          <div className="h-2.5 rounded-full bg-[var(--app-panel-soft)]">
                            <div
                              className={`h-2.5 rounded-full ${
                                project.status === "On Track"
                                  ? "bg-emerald-500"
                                  : project.status === "At Risk"
                                    ? "bg-amber-400"
                                    : "bg-rose-500"
                              }`}
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                          <div className="mt-2 text-xs font-semibold text-[var(--app-text)]">{project.progress}%</div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getToneClass(project.status)}`}
                        >
                          {project.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-medium text-[var(--app-text-strong)]">{project.openTasks}</td>
                      <td className={`px-5 py-4 font-medium ${project.overdue > 0 ? "text-rose-500" : "text-[var(--app-text-strong)]"}`}>
                        {project.overdue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-5 py-10 text-center text-sm text-[var(--app-muted)]">
                <p>No jobsites in your workspace yet.</p>
                <Link href={projectHref} className="mt-3 inline-block font-semibold text-[#2f6cf6]">
                  Go to jobsites or workspace setup
                </Link>
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-[var(--app-border-subtle)] bg-white p-5 shadow-[var(--app-shadow-soft)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[1.45rem] font-semibold tracking-tight text-[var(--app-text-strong)]">Document Status</h2>
            <Link href={documentHref} className="text-sm font-semibold text-[#2f6cf6]">
              View all
            </Link>
          </div>
          {documentTotal > 0 ? (
            <>
              <div className="mt-6 flex justify-center">
                <div
                  className="relative flex h-[170px] w-[170px] items-center justify-center rounded-full"
                  style={buildDonutStyle(documentBreakdown)}
                >
                  <div className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full bg-white">
                    <span className="text-[2rem] font-semibold text-[var(--app-text-strong)]">{documentTotal}</span>
                    <span className="text-sm text-[var(--app-muted)]">Total</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {documentBreakdown.map((segment) => (
                  <div key={segment.label} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2 text-[var(--app-text)]">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                      {segment.label}
                    </div>
                    <div className="font-medium text-[var(--app-text-strong)]">
                      {segment.value} ({Math.round((segment.value / documentTotal) * 100)}%)
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-6 text-sm text-[var(--app-muted)]">No documents in this workspace yet.</p>
          )}
        </article>
      </section>
    </div>
  );
}
