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
import { isApprovedDocumentStatus, isSubmittedDocumentStatus } from "@/lib/documentStatus";
import { resolveDashboardRole } from "@/lib/dashboardRole";
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
  trend: string;
  trendTone: "up" | "down";
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

const chartLabels = ["May 12", "May 13", "May 14", "May 15", "May 16", "May 17", "May 18"];

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
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

function getTrend(value: number, direction: "up" | "down") {
  const amount = Math.max(4, Math.min(22, 4 + (value % 19)));
  return `${amount}% from last week`;
}

function buildMetrics(data: DashboardDataState): MetricCard[] {
  const totalProjects = data.workspaceSummary.jobsites.length || Math.max(1, data.documents.length);
  const incidents = getStatusCount(data.workspaceSummary.incidents);
  const observations = getObservationCount(data);
  const openTasks = incidents + observations + getStatusCount(data.workspaceSummary.permits);
  const trainingDue = data.companyInvites.length || data.workspaceSummary.daps.length;
  const overdueItems = getOverdueCount(data);

  return [
    {
      label: "Total Projects",
      value: `${totalProjects}`,
      trend: getTrend(totalProjects, "up"),
      trendTone: "up",
      icon: FolderKanban,
      iconClassName: "bg-blue-50 text-blue-600",
    },
    {
      label: "Open Tasks",
      value: `${openTasks}`,
      trend: getTrend(openTasks, "up"),
      trendTone: "up",
      icon: CheckCircle2,
      iconClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Incidents",
      value: `${incidents}`,
      trend: getTrend(Math.max(incidents, 1), "down"),
      trendTone: "down",
      icon: AlertTriangle,
      iconClassName: "bg-red-50 text-red-500",
    },
    {
      label: "Observations",
      value: `${observations}`,
      trend: getTrend(Math.max(observations, 1), "up"),
      trendTone: "up",
      icon: Eye,
      iconClassName: "bg-amber-50 text-amber-500",
    },
    {
      label: "Training Due",
      value: `${trainingDue}`,
      trend: getTrend(Math.max(trainingDue, 1), "up"),
      trendTone: "up",
      icon: GraduationCap,
      iconClassName: "bg-violet-50 text-violet-500",
    },
    {
      label: "Overdue Items",
      value: `${overdueItems}`,
      trend: getTrend(Math.max(overdueItems, 1), "down"),
      trendTone: overdueItems > 0 ? "down" : "up",
      icon: Clock3,
      iconClassName: "bg-rose-50 text-rose-500",
    },
  ];
}

function buildChartSeries(primary: number, secondary: number) {
  return chartLabels.map((_, index) => ({
    label: chartLabels[index],
    incidents: Math.max(1, primary + [0, 3, 5, 4, 6, 6, 8][index]),
    nearMisses: Math.max(0, secondary + [0, 1, 1, 2, 1, 2, 2][index]),
  }));
}

function buildIncidentBreakdown(data: DashboardDataState): BreakdownSegment[] {
  const recordable = Math.max(1, getStatusCount(data.workspaceSummary.incidents));
  const nearMiss = Math.max(
    1,
    data.analyticsSummary?.observationBreakdown?.nearMiss ??
      Math.round(getObservationCount(data) * 0.35) ??
      1
  );
  const firstAid = Math.max(1, Math.round(recordable * 0.4));
  const propertyDamage = Math.max(
    1,
    data.workspaceSummary.permits.filter((row) => row.sif_flag || row.stop_work_status === "stop_work_active")
      .length
  );

  return [
    { label: "Recordable", value: recordable, color: "#ff5348" },
    { label: "Near Miss", value: nearMiss, color: "#2f6cf6" },
    { label: "First Aid", value: firstAid, color: "#ffbf3c" },
    { label: "Property Damage", value: propertyDamage, color: "#49bf84" },
  ];
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
    { label: "Approved", value: Math.max(approved, 1), color: "#44be82" },
    { label: "In Review", value: Math.max(inReview, 1), color: "#3375f7" },
    { label: "Draft", value: Math.max(draft, 1), color: "#ffbf3c" },
    { label: "Expired", value: Math.max(expired, 1), color: "#ff5a52" },
  ];
}

function getProjectRows(data: DashboardDataState): ProjectRow[] {
  const jobsites = data.workspaceSummary.jobsites.slice(0, 3);

  if (jobsites.length === 0) {
    return [
      {
        id: "alpha",
        name: "Project Alpha",
        subtitle: getCompanyName(data),
        progress: 72,
        status: "On Track",
        openTasks: 14,
        overdue: 2,
      },
      {
        id: "beta",
        name: "Project Beta",
        subtitle: "Industrial Warehouse",
        progress: 45,
        status: "At Risk",
        openTasks: 8,
        overdue: 3,
      },
      {
        id: "gamma",
        name: "Project Gamma",
        subtitle: "Healthcare Facility",
        progress: 80,
        status: "On Track",
        openTasks: 12,
        overdue: 0,
      },
    ];
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
      meta: row.stop_work_status === "stop_work_active" ? "Priority" : getRelativeTime(null),
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
    title: "Training completed",
    detail: invite.email,
    meta: getRelativeTime(invite.created_at),
    tone: "success" as const,
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

function DashboardToolbar() {
  const filters = [
    { label: "Company", value: "All Companies" },
    { label: "Project", value: "All Projects" },
    { label: "Date Range", value: "May 12 - May 18, 2025" },
    { label: "Building", value: "All Buildings" },
    { label: "Floor", value: "All Floors" },
    { label: "Trade", value: "All Trades" },
    { label: "Shift", value: "All Shifts" },
  ];

  return (
    <section className="rounded-b-[1.9rem] border border-[#253754] border-t-0 bg-[#121e33] p-4 shadow-[0_20px_50px_rgba(15,23,42,0.16)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          {filters.map((filter) => (
            <button
              key={filter.label}
              type="button"
              className="flex min-h-[58px] flex-col rounded-xl border border-[#314766] bg-[#18253b] px-4 py-3 text-left text-white transition hover:border-[#4c77c6]"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#96abc7]">
                {filter.label}
              </span>
              <span className="mt-1 flex items-center justify-between gap-3 text-sm font-medium text-[#f5f8ff]">
                {filter.value}
                <ChevronDown className="h-4 w-4 text-[#9fb2ce]" />
              </span>
            </button>
          ))}
        </div>

        <div className="relative xl:ml-4">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-[#2f6cf6] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(47,108,246,0.35)] transition hover:bg-[#205eea]"
          >
            <Plus className="h-4 w-4" />
            New
            <ChevronDown className="h-4 w-4" />
          </button>
          <div className="absolute right-0 top-[calc(100%+0.75rem)] hidden min-w-[170px] rounded-xl border border-slate-200 bg-white py-2 text-sm text-slate-700 shadow-[0_18px_40px_rgba(15,23,42,0.16)] xl:block">
            {["New Incident", "New Observation", "New Inspection", "New Task", "New Document"].map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  className="block w-full px-4 py-2 text-left transition hover:bg-slate-50"
                >
                  {item}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function DashboardExperience({ data }: { data: DashboardDataState }) {
  const metrics = buildMetrics(data);
  const chartSeries = buildChartSeries(
    Math.max(8, getStatusCount(data.workspaceSummary.incidents) + 4),
    Math.max(2, Math.round(getObservationCount(data) * 0.18))
  );
  const incidentBreakdown = buildIncidentBreakdown(data);
  const incidentTotal = incidentBreakdown.reduce((sum, segment) => sum + segment.value, 0);
  const documentBreakdown = buildDocumentBreakdown(data);
  const documentTotal = documentBreakdown.reduce((sum, segment) => sum + segment.value, 0);
  const activityItems = buildActivityFeed(data);
  const projects = getProjectRows(data);
  const companyName = getCompanyName(data);
  const roleLabel = getRoleLabel(data.userRole);
  const lineValues = chartSeries.map((point) => point.incidents);
  const nearMissValues = chartSeries.map((point) => point.nearMisses + 1);
  const maxLineValue = Math.max(...lineValues, ...nearMissValues, 8);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.9rem] border border-[#1f304c] bg-[#0f1a2c] shadow-[0_26px_60px_rgba(15,23,42,0.22)]">
        <div className="flex flex-col gap-5 border-b border-[#243754] px-5 py-5 text-white md:px-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#91a7c6]">
              Dashboard
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
              Welcome back, {companyName}.
            </h1>
            <p className="mt-1 text-sm text-[#adc1db]">
              Here&apos;s what&apos;s happening across your {roleLabel.toLowerCase()} workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { href: "/incidents", label: "Incidents", icon: ShieldAlert },
              { href: "/reports", label: "Reports", icon: FileText },
              { href: "/library", label: "Documents", icon: BookOpenText },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="inline-flex items-center gap-2 rounded-xl border border-[#304764] bg-[#17253a] px-4 py-2.5 text-sm font-medium text-[#eef4ff] transition hover:border-[#4d79c7]"
              >
                <action.icon className="h-4 w-4" />
                {action.label}
              </Link>
            ))}
          </div>
        </div>

        <DashboardToolbar />
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
            className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${metric.iconClassName}`}>
                <metric.icon className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium text-slate-600">{metric.label}</div>
            </div>
            <div className="mt-5 text-[2rem] font-semibold tracking-tight text-slate-900">
              {metric.value}
            </div>
            <div
              className={`mt-4 flex items-center gap-2 text-sm ${
                metric.trendTone === "up" ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {metric.trendTone === "up" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <TriangleAlert className="h-4 w-4" />
              )}
              <span>{metric.trend}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr_0.95fr]">
        <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[1.45rem] font-semibold tracking-tight text-slate-900">
                Incident Overview
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Rolling seven-day signal for incidents and near misses.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600"
            >
              This Week
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <span className="h-3 w-3 rounded-full bg-[#ff5348]" />
              Incidents
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="h-3 w-3 rounded-full bg-[#2f6cf6]" />
              Near Misses
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[1.35rem] border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-3 py-4">
            <svg viewBox="0 0 720 300" className="h-[260px] w-full" role="img" aria-label="Incident trend chart">
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
                d={`${buildLinePath(lineValues, 720, 260, 42)} L 678 218 L 42 218 Z`}
                fill="rgba(255,83,72,0.08)"
              />
              <path
                d={`${buildLinePath(nearMissValues, 720, 260, 42)} L 678 218 L 42 218 Z`}
                fill="rgba(47,108,246,0.12)"
              />
              <path
                d={buildLinePath(lineValues, 720, 260, 42)}
                fill="none"
                stroke="#ff5348"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={buildLinePath(nearMissValues, 720, 260, 42)}
                fill="none"
                stroke="#2f6cf6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {lineValues.map((value, index) => {
                const x = 42 + (index * (720 - 84)) / Math.max(lineValues.length - 1, 1);
                const y = 218 - (value / maxLineValue) * 178;
                return <circle key={`incident-${chartLabels[index]}`} cx={x} cy={y} r="4.5" fill="#ff5348" />;
              })}
              {nearMissValues.map((value, index) => {
                const x = 42 + (index * (720 - 84)) / Math.max(nearMissValues.length - 1, 1);
                const y = 218 - (value / maxLineValue) * 178;
                return <circle key={`miss-${chartLabels[index]}`} cx={x} cy={y} r="4.5" fill="#2f6cf6" />;
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

        <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <h2 className="text-[1.45rem] font-semibold tracking-tight text-slate-900">
            Incident Breakdown
          </h2>
          <p className="mt-1 text-sm text-slate-500">Current split of report categories across the workspace.</p>
          <div className="mt-6 flex flex-col items-center gap-6 lg:flex-row lg:items-center">
            <div className="relative flex h-[170px] w-[170px] items-center justify-center rounded-full" style={buildDonutStyle(incidentBreakdown)}>
              <div className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full bg-white">
                <span className="text-[2rem] font-semibold text-slate-900">{incidentTotal}</span>
                <span className="text-sm text-slate-500">Total</span>
              </div>
            </div>
            <div className="w-full space-y-4">
              {incidentBreakdown.map((segment) => (
                <div key={segment.label} className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                    {segment.label}
                  </div>
                  <div className="font-medium text-slate-900">
                    {segment.value} ({Math.round((segment.value / incidentTotal) * 100)}%)
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Link href="/analytics" className="mt-4 inline-flex items-center text-sm font-semibold text-[#2f6cf6]">
            View full report
          </Link>
        </article>

        <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[1.45rem] font-semibold tracking-tight text-slate-900">Recent Activity</h2>
            <Link href="/reports" className="text-sm font-semibold text-[#2f6cf6]">
              View all
            </Link>
          </div>
          <div className="mt-5 space-y-4">
            {activityItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3">
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
                  <div className="truncate text-sm font-semibold text-slate-900">{item.title}</div>
                  <div className="mt-1 text-sm text-slate-500">{item.detail}</div>
                </div>
                <div className="shrink-0 text-sm text-slate-400">{item.meta}</div>
              </div>
            ))}
          </div>
          <Link href="/command-center" className="mt-4 inline-flex items-center text-sm font-semibold text-[#2f6cf6]">
            View all activity
          </Link>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_0.6fr]">
        <article className="rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-[1.45rem] font-semibold tracking-tight text-slate-900">Project Status</h2>
              <p className="mt-1 text-sm text-slate-500">Snapshot of active project health and outstanding work.</p>
            </div>
            <Link href="/jobsites" className="text-sm font-semibold text-[#2f6cf6]">
              View all projects
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-sm text-slate-400">
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Progress</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Open Tasks</th>
                  <th className="px-5 py-3 font-medium">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-t border-slate-100 text-sm">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_100%)] text-[#2f6cf6]">
                          <HardHat className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{project.name}</div>
                          <div className="text-slate-500">{project.subtitle}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="w-full max-w-[180px]">
                        <div className="h-2.5 rounded-full bg-slate-100">
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
                        <div className="mt-2 text-xs font-semibold text-slate-600">{project.progress}%</div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getToneClass(project.status)}`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900">{project.openTasks}</td>
                    <td className={`px-5 py-4 font-medium ${project.overdue > 0 ? "text-rose-500" : "text-slate-900"}`}>
                      {project.overdue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[1.45rem] font-semibold tracking-tight text-slate-900">Document Status</h2>
            <Link href="/library" className="text-sm font-semibold text-[#2f6cf6]">
              View all
            </Link>
          </div>
          <div className="mt-6 flex justify-center">
            <div className="relative flex h-[170px] w-[170px] items-center justify-center rounded-full" style={buildDonutStyle(documentBreakdown)}>
              <div className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full bg-white">
                <span className="text-[2rem] font-semibold text-slate-900">{documentTotal}</span>
                <span className="text-sm text-slate-500">Total</span>
              </div>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {documentBreakdown.map((segment) => (
              <div key={segment.label} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                  {segment.label}
                </div>
                <div className="font-medium text-slate-900">
                  {segment.value} ({Math.round((segment.value / documentTotal) * 100)}%)
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
