"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ActivityFeed,
  EmptyState,
  SectionCard,
  StatusBadge,
} from "@/components/WorkspacePrimitives";
import {
  getDocumentStatusLabel,
  isApprovedDocumentStatus,
  isSubmittedDocumentStatus,
  normalizeDocumentStatus,
} from "@/lib/documentStatus";
import type { CompanyJobsite } from "@/components/company-workspace/useCompanyWorkspaceData";
import type {
  LiveMatrixRow,
  ModuleSummaryItem,
} from "@/components/company-workspace/useCompanyWorkspaceData";
import type { WorkspaceProduct } from "@/lib/workspaceProduct";

type DocumentRow = {
  id: string;
  created_at: string;
  project_name: string | null;
  document_title?: string | null;
  document_type: string | null;
  category?: string | null;
  status: string | null;
  draft_file_path?: string | null;
  final_file_path?: string | null;
  file_name?: string | null;
};

type CompanyUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  team: string;
  status: string;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

type CompanyInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at?: string | null;
};

type CompanyProfile = {
  id: string;
  name: string | null;
  team_key: string | null;
  industry: string | null;
  phone: string | null;
  website: string | null;
  address_line_1: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  status: string | null;
};

function formatRelative(timestamp?: string | null) {
  if (!timestamp) return "Recently";

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function isOnline(lastSignInAt?: string | null) {
  if (!lastSignInAt) return false;
  return Date.now() - new Date(lastSignInAt).getTime() <= 1000 * 60 * 20;
}

function getDocumentLabel(document: DocumentRow) {
  return (
    document.document_title ??
    document.project_name ??
    document.file_name ??
    "Untitled document"
  );
}

function isApprovedDocument(document: DocumentRow) {
  return isApprovedDocumentStatus(document.status, Boolean(document.final_file_path));
}

function getStatusTone(label: string): "neutral" | "success" | "warning" | "info" {
  if (label === "Active" || label === "Online" || label === "Ready") return "success";
  if (label === "Pending" || label === "Suspended" || label === "Action needed") {
    return "warning";
  }
  return "info";
}

export function CompanyAdminDashboard({
  loading,
  workspaceLoaded,
  workspaceError,
  onRefreshWorkspace,
  documents,
  companyUsers,
  companyInvites,
  companyProfile,
  jobsites,
  creditBalance,
  liveMatrixSummary,
  moduleSummaries,
  highRiskAlerts,
  companyDashboardMetrics,
  workspaceProduct = "full",
}: {
  loading: boolean;
  workspaceLoaded: boolean;
  workspaceError?: string | null;
  onRefreshWorkspace: () => void;
  documents: DocumentRow[];
  workspaceProduct?: WorkspaceProduct;
  companyUsers: CompanyUser[];
  companyInvites: CompanyInvite[];
  companyProfile: CompanyProfile | null;
  jobsites: CompanyJobsite[];
  creditBalance: number | null;
  liveMatrixSummary: LiveMatrixRow[];
  moduleSummaries: ModuleSummaryItem[];
  highRiskAlerts: Array<{ id: string; title: string; detail: string; tone: "warning" | "info" }>;
  companyDashboardMetrics: {
    totalActiveJobsites: number;
    totalOpenObservations: number;
    totalHighRiskObservations: number;
    sifCount: number;
    averageClosureTimeHours: number;
    topHazardCategories: Array<{ category: string; count: number }>;
    openIncidents: number;
    dapCompletionToday: { completed: number; total: number; percent: number };
  } | null;
}) {
  const [selectedJobsite, setSelectedJobsite] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [referenceTime] = useState(() => Date.now());

  if (workspaceProduct === "csep") {
    const csepDocs = documents.filter((d) => /csep/i.test(d.document_type ?? ""));
    const pendingCsep = csepDocs.filter((d) =>
      isSubmittedDocumentStatus(d.status, Boolean(d.final_file_path))
    ).length;
    const approvedCsep = csepDocs.filter((d) => isApprovedDocument(d)).length;

    return (
      <div className="space-y-6">
        <section className="rounded-[1.9rem] border border-[#dbe9ff] bg-white p-6 shadow-[0_16px_36px_rgba(148,163,184,0.12)]">
          <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">CSEP workspace</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {companyProfile?.name?.trim() || "Company Workspace"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            This account is limited to the CSEP builder. Create and submit Construction Safety &amp; Environmental Plans
            for admin review—without the full company operations suite.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/csep"
              className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#4f7cff_0%,_#5b6cff_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(79,124,255,0.24)]"
            >
              Open CSEP builder
            </Link>
            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Profile
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "CSEP records", value: String(csepDocs.length), note: "Drafts and submissions" },
            { label: "Pending review", value: String(pendingCsep), note: "Awaiting admin review" },
            { label: "Approved", value: String(approvedCsep), note: "Completed CSEP files" },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{card.label}</div>
              <div className="mt-2 text-3xl font-black text-slate-950">{loading ? "-" : card.value}</div>
              <p className="mt-2 text-sm text-slate-500">{card.note}</p>
            </div>
          ))}
        </section>
      </div>
    );
  }

  const companyName = companyProfile?.name?.trim() || "Company Workspace";
  const companyLocation =
    [companyProfile?.city?.trim(), companyProfile?.state_region?.trim()]
      .filter(Boolean)
      .join(", ") || "Location not set";
  const companyInitials = companyName
    .split(/\s+/)
    .map((part) => part.trim()[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const pendingUsers = companyUsers.filter((user) => user.status === "Pending");
  const activeUsers = companyUsers.filter((user) => user.status === "Active");
  const suspendedUsers = companyUsers.filter((user) => user.status === "Suspended");
  const onlineUsers = activeUsers.filter((user) => isOnline(user.last_sign_in_at));
  const pendingDocuments = documents.filter((document) =>
    isSubmittedDocumentStatus(document.status, Boolean(document.final_file_path))
  );
  const draftDocuments = documents.filter(
    (document) =>
      normalizeDocumentStatus(document.status, Boolean(document.final_file_path)) === "draft"
  );
  const approvedDocuments = documents.filter((document) => isApprovedDocument(document));
  const attentionDocuments = documents.filter((document) => {
    const normalized = normalizeDocumentStatus(
      document.status,
      Boolean(document.final_file_path)
    );
    return (
      normalized !== "approved" &&
      normalized !== "submitted" &&
      normalized !== "draft" &&
      normalized !== "archived"
    );
  });
  const jobsiteOptions = ["all", ...jobsites.map((jobsite) => jobsite.name)];
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredDocuments = documents.filter((document) => {
    const matchesJobsite =
      selectedJobsite === "all" ||
      (document.project_name?.trim() || "General Workspace") === selectedJobsite;
    const matchesSearch =
      !normalizedSearch ||
      [
        document.project_name,
        document.document_title,
        document.document_type,
        document.file_name,
        document.category,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));

    return matchesJobsite && matchesSearch;
  });

  const filteredJobsites = jobsites.filter((jobsite) => {
    const matchesJobsite = selectedJobsite === "all" || jobsite.name === selectedJobsite;
    const matchesSearch =
      !normalizedSearch ||
      [jobsite.name, jobsite.location, jobsite.projectNumber].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      );
    return matchesJobsite && matchesSearch;
  });

  const filteredUsers = companyUsers.filter((user) => {
    const matchesSearch =
      !normalizedSearch ||
      [user.name, user.email, user.role].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      );
    return matchesSearch;
  });

  const overdueActionsCount =
    pendingUsers.length +
    pendingDocuments.filter(
      (document) =>
        referenceTime - new Date(document.created_at).getTime() > 1000 * 60 * 60 * 24 * 3
    ).length;
  const notificationCount =
    pendingUsers.length + pendingDocuments.length + companyInvites.length;
  const activeJobsitesCount = jobsites.filter((jobsite) =>
    ["Active", "Action needed", "Planned"].includes(jobsite.status)
  ).length;
  const dashboardMetrics = companyDashboardMetrics ?? {
    totalActiveJobsites: activeJobsitesCount,
    totalOpenObservations: liveMatrixSummary.reduce((sum, row) => sum + row.open + row.inProgress, 0),
    totalHighRiskObservations: highRiskAlerts.length,
    sifCount: highRiskAlerts.length,
    averageClosureTimeHours: 0,
    topHazardCategories: [] as Array<{ category: string; count: number }>,
    openIncidents: moduleSummaries.find((item) => item.key === "incidents")?.open ?? 0,
    dapCompletionToday: { completed: 0, total: 0, percent: 0 },
  };

  const kpiCards = [
    {
      title: "Total Users",
      value: String(companyUsers.length),
      note: "Employees assigned to this company workspace",
      href: "/company-users",
      tone: "info" as const,
    },
    {
      title: "Users Online Now",
      value: String(onlineUsers.length),
      note: "People active in the last 20 minutes",
      href: "/company-users",
      tone: onlineUsers.length > 0 ? ("success" as const) : ("neutral" as const),
    },
    {
      title: "Current Active Jobsites",
      value: String(dashboardMetrics.totalActiveJobsites),
      note: "Total active jobsites in company scope",
      href: "/jobsites",
      tone: dashboardMetrics.totalActiveJobsites > 0 ? ("success" as const) : ("neutral" as const),
    },
    {
      title: "Open Observations",
      value: String(dashboardMetrics.totalOpenObservations),
      note: "All open/in-progress field observations",
      href: "/field-id-exchange",
      tone: dashboardMetrics.totalOpenObservations > 0 ? ("warning" as const) : ("success" as const),
    },
    {
      title: "High-Risk Observations",
      value: String(dashboardMetrics.totalHighRiskObservations),
      note: "High/critical observations requiring priority attention",
      href: "/field-id-exchange",
      tone: dashboardMetrics.totalHighRiskObservations > 0 ? ("warning" as const) : ("success" as const),
    },
    {
      title: "SIF Count",
      value: String(dashboardMetrics.sifCount),
      note: "SIF-potential observations in current analytics window",
      href: "/analytics",
      tone: dashboardMetrics.sifCount > 0 ? ("warning" as const) : ("success" as const),
    },
    {
      title: "Avg Closure Time (hrs)",
      value: String(dashboardMetrics.averageClosureTimeHours),
      note: "Average time to verified closure",
      href: "/analytics",
      tone: "info" as const,
    },
    {
      title: "Open Incidents",
      value: String(dashboardMetrics.openIncidents),
      note: "Incidents not yet closed",
      href: "/incidents",
      tone: dashboardMetrics.openIncidents > 0 ? ("warning" as const) : ("success" as const),
    },
    {
      title: "DAP Completion Today",
      value: `${dashboardMetrics.dapCompletionToday.percent}%`,
      note: `${dashboardMetrics.dapCompletionToday.completed}/${dashboardMetrics.dapCompletionToday.total} planned activities completed today`,
      href: "/daps",
      tone: "info" as const,
    },
  ];

  const documentSnapshotCards = [
    {
      title: "Pending Review",
      value: String(pendingDocuments.length),
      note: "Company documents waiting for next action",
      tone: pendingDocuments.length > 0 ? ("warning" as const) : ("success" as const),
    },
    {
      title: "Draft Documents",
      value: String(draftDocuments.length),
      note: "Unsubmitted records still being prepared",
      tone: draftDocuments.length > 0 ? ("info" as const) : ("neutral" as const),
    },
    {
      title: "Approved Documents",
      value: String(approvedDocuments.length),
      note: "Completed files ready to open or distribute",
      tone: approvedDocuments.length > 0 ? ("success" as const) : ("neutral" as const),
    },
    {
      title: "Needs Revision",
      value: String(attentionDocuments.length),
      note: "Records that still need correction or follow-up",
      tone: attentionDocuments.length > 0 ? ("warning" as const) : ("neutral" as const),
    },
  ];

  const userSnapshotCards = [
    {
      title: "Pending Invites",
      value: String(companyInvites.length),
      note: "Invites waiting for employees to set up their accounts",
    },
    {
      title: "Awaiting Approval",
      value: String(pendingUsers.length),
      note: "Employees who created accounts and need approval",
    },
    {
      title: "Inactive / Suspended",
      value: String(suspendedUsers.length),
      note: "Accounts currently blocked from the workspace",
    },
    {
      title: "Expiring Certifications",
      value: "0",
      note: "Certification expiration tracking is ready for rollout",
    },
  ];

  const recentActivityItems = [
    ...filteredDocuments.slice(0, 4).map((document) => ({
      id: document.id,
      title: getDocumentLabel(document),
      detail:
        `${document.project_name || "General Workspace"} - ${getDocumentStatusLabel(document.status, Boolean(document.final_file_path))}`,
      meta: formatRelative(document.created_at),
      tone: isApprovedDocument(document)
        ? ("success" as const)
        : isSubmittedDocumentStatus(document.status, Boolean(document.final_file_path))
          ? ("warning" as const)
          : ("info" as const),
    })),
    ...pendingUsers.slice(0, 2).map((user) => ({
      id: `user-${user.id}`,
      title: `${user.name} is waiting for approval`,
      detail: "Approve or suspend access from Company Users.",
      meta: formatRelative(user.created_at),
      tone: "warning" as const,
    })),
  ].slice(0, 6);

  const correctiveActions = [
    ...(highRiskAlerts.length > 0
      ? [
          {
            id: "high-risk-alerts",
            title: `${highRiskAlerts.length} high-risk alert${highRiskAlerts.length === 1 ? "" : "s"} require immediate review`,
            detail: "Open permits/incidents modules and clear escalations or stop-work states.",
            meta: "Critical",
            tone: "warning" as const,
          },
        ]
      : []),
    ...(pendingUsers.length > 0
      ? [
          {
            id: "approvals",
            title: `${pendingUsers.length} employee approval${pendingUsers.length === 1 ? "" : "s"} need review`,
            detail: "Open Users to approve or suspend new account setups.",
            meta: "Today",
            tone: "warning" as const,
          },
        ]
      : []),
    ...(pendingDocuments.length > 0
      ? [
          {
            id: "documents",
            title: `${pendingDocuments.length} document${pendingDocuments.length === 1 ? "" : "s"} still pending review`,
            detail: "Use Documents to follow up on the company document pipeline.",
            meta: "Action needed",
            tone: "warning" as const,
          },
        ]
      : []),
    ...(companyInvites.length > 0
      ? [
          {
            id: "invites",
            title: `${companyInvites.length} invite${companyInvites.length === 1 ? "" : "s"} still waiting`,
            detail: "Remind invited employees to finish account setup.",
            meta: "Waiting",
            tone: "info" as const,
          },
        ]
      : []),
  ];

  const reportWidgets = [
    {
      title: "Document Status Breakdown",
      note: `${approvedDocuments.length} approved, ${pendingDocuments.length} pending, ${draftDocuments.length} draft, ${attentionDocuments.length} needing follow-up.`,
    },
    {
      title: "Online Team Snapshot",
      note: `${onlineUsers.length} online now, ${pendingUsers.length} awaiting approval, ${suspendedUsers.length} inactive.`,
    },
    {
      title: "Certification Tracking",
      note: "Employee certification reviews and expiration alerts are ready for rollout next.",
    },
    {
      title: "Jobsite Reporting",
      note: `${activeJobsitesCount} active jobsite${activeJobsitesCount === 1 ? "" : "s"} currently moving work through the company board.`,
    },
    {
      title: "Top Hazard Categories",
      note:
        dashboardMetrics.topHazardCategories.length > 0
          ? dashboardMetrics.topHazardCategories
              .slice(0, 3)
              .map((item) => `${item.category.replace(/_/g, " ")} (${item.count})`)
              .join(" · ")
          : "No hazard category trends yet.",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-[1.9rem] border border-[#dbe9ff] bg-white p-6 shadow-[0_16px_36px_rgba(148,163,184,0.12)]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.6rem] bg-[linear-gradient(135deg,_#dbeafe_0%,_#bfdbfe_100%)] text-xl font-black text-sky-700">
                {companyInitials || "CO"}
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                  Company Workspace
                </div>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  {companyName}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  Run company operations from one place: jobsites, documents, company access, field reporting, and overdue actions.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge label={companyProfile?.status?.trim() || "Active"} tone="success" />
                  <StatusBadge label={companyLocation} tone="info" />
                  <StatusBadge
                    label={creditBalance === null ? "Credits pending" : `${creditBalance} credits`}
                    tone={creditBalance && creditBalance > 0 ? "success" : "neutral"}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  Notifications
                </div>
                <div className="mt-2 text-xl font-black text-slate-950">{notificationCount}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Pending approvals, invites, and review items
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  Workspace Lead
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  Manage company operations
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Invite users, manage jobsites, and keep safety records moving
                </div>
              </div>
            </div>
          </div>

          {!workspaceLoaded || workspaceError ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                workspaceError
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-sky-200 bg-sky-50 text-sky-800"
              }`}
            >
              {workspaceError
                ? workspaceError
                : "This workspace loads on demand. Click Refresh Workspace to pull the latest company data."}
            </div>
          ) : null}

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px_170px_auto]">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search jobsites, documents, or employees..."
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400"
            />
            <select
              value={selectedJobsite}
              onChange={(event) => setSelectedJobsite(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400"
            >
              {jobsiteOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All jobsites" : option}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onRefreshWorkspace}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Loading..." : workspaceLoaded ? "Refresh Workspace" : "Load Workspace"}
            </button>
            <Link
              href="/company-users"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              {pendingUsers.length} pending approvals
            </Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#4f7cff_0%,_#5b6cff_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(79,124,255,0.24)]">
                Add New
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.75rem)] z-10 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                {[
                  { href: "/jobsites", label: "Add Jobsite", note: "Set up the next active project." },
                  { href: "/company-users", label: "Add User", note: "Invite and approve employees." },
                  { href: "/submit", label: "Submit New Document", note: "Start a document workflow." },
                  { href: "/field-id-exchange", label: "Report Safety Issue", note: "Track site concerns and actions." },
                  { href: "/upload", label: "Upload File", note: "Add field files or supporting records." },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="block rounded-xl px-3 py-3 transition hover:bg-slate-50"
                  >
                    <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.note}</div>
                  </Link>
                ))}
              </div>
            </details>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md"
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
              {card.title}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-4xl font-black tracking-tight text-slate-950">
                {loading ? "-" : card.value}
              </div>
              <StatusBadge label={card.title.split(" ")[0]} tone={card.tone} />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">{card.note}</p>
          </Link>
        ))}
      </section>

      <section id="jobsites" className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <SectionCard
          title="Jobsites Overview"
          description="Jobsite rows are grouped from the company documents you already have in the system, so you can organize the workspace before dedicated site assignment tables are added."
          aside={
            <div className="flex flex-wrap gap-2">
              <a
                href="/jobsites"
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Add Jobsite
              </a>
              <a
                href="/jobsites"
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Archive Jobsite
              </a>
            </div>
          }
        >
          {filteredJobsites.length === 0 ? (
            <EmptyState
              title="No jobsites are active yet"
              description="As project names are used in submitted documents, your company dashboard will group them here as jobsites."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredJobsites.map((jobsite) => (
                <div key={jobsite.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold text-slate-950">{jobsite.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{jobsite.location}</div>
                    </div>
                    <StatusBadge
                      label={jobsite.status}
                      tone={
                        jobsite.status === "Action needed"
                          ? "warning"
                          : jobsite.status === "Active"
                            ? "success"
                            : "neutral"
                      }
                    />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Project number
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {jobsite.projectNumber}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Team users
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {companyUsers.length} workspace users
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Pending docs
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {jobsite.pendingDocuments}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Last activity
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {formatRelative(jobsite.lastActivity)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                    <span>{jobsite.totalDocuments} tracked document{jobsite.totalDocuments === 1 ? "" : "s"}</span>
                    <Link href="/jobsites" className="font-semibold text-sky-700">
                      View Site
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Pending Documents"
            description="The document queue that needs the company’s attention today."
        >
          {pendingDocuments.length === 0 ? (
            <EmptyState
              title="No documents are waiting right now"
              description="Submitted company documents will appear here as soon as they need review or follow-up."
            />
          ) : (
            <div className="space-y-3">
              {pendingDocuments.slice(0, 5).map((document) => (
                <div key={document.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {getDocumentLabel(document)}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {(document.project_name?.trim() || "General Workspace")} · {document.document_type || "Document"}
                      </div>
                    </div>
                    <StatusBadge label={getDocumentStatusLabel(document.status, Boolean(document.final_file_path))} tone="warning" />
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Submitted {formatRelative(document.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </section>

      <section id="documents" className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <SectionCard
          title="Document Control"
          description="Track the full company document pipeline from draft through approval."
          aside={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/submit"
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Submit New Document
              </Link>
              <Link
                href="/upload"
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Upload Existing Document
              </Link>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {documentSnapshotCards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {card.title}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-3xl font-black text-slate-950">{card.value}</div>
                  <StatusBadge label={card.title.split(" ")[0]} tone={card.tone} />
                </div>
                <div className="mt-3 text-sm text-slate-500">{card.note}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[minmax(0,1.7fr)_0.9fr_1fr_0.9fr_0.9fr_1fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              <div>Document</div>
              <div>Type</div>
              <div>Jobsite</div>
              <div>Status</div>
              <div>Submitted</div>
              <div>Action</div>
            </div>
            <div className="divide-y divide-slate-200 bg-white">
              {filteredDocuments.slice(0, 8).map((document) => (
                <div
                  key={document.id}
                  className="grid grid-cols-[minmax(0,1.7fr)_0.9fr_1fr_0.9fr_0.9fr_1fr] gap-3 px-4 py-4 text-sm text-slate-700"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">{getDocumentLabel(document)}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {document.file_name || "Company workspace record"}
                    </div>
                  </div>
                  <div>{document.document_type || "Document"}</div>
                  <div>{document.project_name || "General Workspace"}</div>
                  <div>
                    <StatusBadge
                      label={getDocumentStatusLabel(document.status, Boolean(document.final_file_path))}
                      tone={
                        isApprovedDocument(document)
                          ? "success"
                          : isSubmittedDocumentStatus(document.status, Boolean(document.final_file_path))
                            ? "warning"
                            : "info"
                      }
                    />
                  </div>
                  <div className="text-slate-500">{formatRelative(document.created_at)}</div>
                  <div>
                    <Link href="/library" className="font-semibold text-sky-700">
                      View
                    </Link>
                  </div>
                </div>
              ))}
              {filteredDocuments.length === 0 ? (
                <div className="px-4 py-8">
                  <EmptyState
                    title="No documents match this view"
                    description="Change the search or jobsite filter, or add a new document to start the company record pipeline."
                  />
                </div>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Users"
          description="The company access snapshot: who is online, waiting, invited, or inactive."
          aside={
            <Link
              href="/company-users"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Manage Users
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {userSnapshotCards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {card.title}
                </div>
                <div className="mt-3 text-3xl font-black text-slate-950">{card.value}</div>
                <div className="mt-2 text-sm text-slate-500">{card.note}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {filteredUsers.slice(0, 6).map((user) => (
              <div key={user.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{user.email}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge label={user.role} tone="info" />
                      <StatusBadge
                        label={isOnline(user.last_sign_in_at) ? "Online" : user.status}
                        tone={isOnline(user.last_sign_in_at) ? "success" : getStatusTone(user.status)}
                      />
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>Last active {formatRelative(user.last_sign_in_at || user.created_at)}</div>
                    <div className="mt-1">Certifications managed in profile</div>
                    <Link
                      href="/company-users"
                      className="mt-2 inline-flex font-semibold text-sky-700"
                    >
                      Open user access
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 ? (
              <EmptyState
                title="No company users match this view"
                description="Invite your first employee or adjust the current dashboard search."
              />
            ) : null}
          </div>
        </SectionCard>
      </section>

      <section id="field-id-exchange" className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Live Safety Observation Matrix"
          description="Daily operations matrix showing open, in-progress, closed, and overdue corrective action counts by category."
          aside={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/field-id-exchange"
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Open Corrective Actions
              </Link>
              <Link
                href="/safety-submit"
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Individual Safety Submission
              </Link>
            </div>
          }
        >
          {liveMatrixSummary.length === 0 ? (
            <EmptyState
              title="No matrix items are live yet"
              description="As corrective actions are created and reviewed, matrix rows will appear here by category."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[minmax(0,1.3fr)_0.8fr_0.8fr_0.8fr_0.8fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                <div>Category</div>
                <div>Open</div>
                <div>In Progress</div>
                <div>Closed</div>
                <div>Overdue</div>
              </div>
              <div className="divide-y divide-slate-200 bg-white">
                {liveMatrixSummary.map((row) => (
                  <div
                    key={row.category}
                    className="grid grid-cols-[minmax(0,1.3fr)_0.8fr_0.8fr_0.8fr_0.8fr] gap-3 px-4 py-3 text-sm text-slate-700"
                  >
                    <div className="font-semibold text-slate-900">{row.category.replace(/_/g, " ")}</div>
                    <div>{row.open}</div>
                    <div>{row.inProgress}</div>
                    <div>{row.closed}</div>
                    <div className={row.overdue > 0 ? "font-semibold text-amber-700" : "text-slate-500"}>
                      {row.overdue}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <div id="action-board" className="space-y-6">
          <ActivityFeed
            title="Recent Activity"
            description="The latest document, invite, and access activity across the company workspace."
            items={
              recentActivityItems.length > 0
                ? recentActivityItems
                : [
                    {
                      id: "empty-company-activity",
                      title: "No workspace activity yet",
                      detail: "New documents, invites, and access changes will show up here.",
                      meta: "Waiting",
                      tone: "neutral" as const,
                    },
                  ]
            }
          />

          <SectionCard
            title="Field Issues & Overdue Items"
            description="Today’s items that still need follow-up from the company side."
          >
            {correctiveActions.length === 0 ? (
              <EmptyState
                title="No overdue actions right now"
                description="Pending approvals, document review items, and waiting invites will appear here when the company workspace needs action."
              />
            ) : (
              <div className="space-y-3">
                {correctiveActions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                        <div className="mt-1 text-sm text-slate-500">{item.detail}</div>
                      </div>
                      <StatusBadge label={item.meta} tone={item.tone} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Module Summary"
            description="Scaffold modules with live totals to guide daily operations."
          >
            <div className="grid gap-3">
              {moduleSummaries.map((module) => (
                <div key={module.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {module.label}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {module.total} total · {module.open} open · {module.inProgress} active · {module.closed} closed
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="High-Risk Alerts"
            description="Auto-escalated SIF and stop-work items from permits and incidents."
          >
            {highRiskAlerts.length === 0 ? (
              <EmptyState
                title="No high-risk alerts right now"
                description="Critical escalations and active stop-work items will appear here automatically."
              />
            ) : (
              <div className="space-y-3">
                {highRiskAlerts.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                        <div className="mt-1 text-sm text-slate-500">{item.detail}</div>
                      </div>
                      <StatusBadge label="High Risk" tone={item.tone} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </section>

      <section id="reports" className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Reports & Trends"
            description="High-level reporting blocks that help the workspace lead answer what needs action today."
          aside={
            <Link
              href="/reports"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Open Reports
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {reportWidgets.map((widget) => (
              <div
                key={widget.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="text-sm font-semibold text-slate-900">{widget.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{widget.note}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Alerts & Notifications"
            description="Everything the workspace lead should keep an eye on in the current workspace."
        >
          <div className="space-y-3">
            {[
              {
                label: "Pending employee approvals",
                value: `${pendingUsers.length} waiting`,
              },
              {
                label: "Pending document reviews",
                value: `${pendingDocuments.length} in queue`,
              },
              {
                label: "Invites not accepted",
                value: `${companyInvites.length} outstanding`,
              },
              {
                label: "Overdue action items",
                value: `${overdueActionsCount} flagged`,
              },
            ].map((alert) => (
              <div
                key={alert.label}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {alert.label}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{alert.value}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
