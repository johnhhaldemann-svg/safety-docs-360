"use client";

/**
 * Legacy standalone company-admin screen (not mounted from `/dashboard`).
 * The live role dashboard is `components/dashboard/company-admin-dashboard.tsx`
 * via `RoleDashboardResolver` on [`app/(app)/dashboard/page.tsx`](./page.tsx).
 * Prefer editing the `components/dashboard/*` pipeline (mappers, `DashboardView`, layout APIs).
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ActivityFeed,
  EmptyState,
  InlineMessage,
  SectionCard,
  StatusBadge,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import { CompanyAiAssistPanel } from "@/components/company-ai/CompanyAiAssistPanel";
import { CompanyMemoryBankPanel } from "@/components/company-ai/CompanyMemoryBankPanel";
import { PilotAccountPanel } from "../../../components/company-workspace/PilotAccountPanel";
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
import {
  CONTRACTOR_SAFETY_BLUEPRINT_BUILDER_LABEL,
  CONTRACTOR_SAFETY_BLUEPRINT_TITLE,
} from "@/lib/safetyBlueprintLabels";
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
  pilot_trial_ends_at?: string | null;
  pilot_converted_at?: string | null;
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

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getPulseTone(score: number): "neutral" | "success" | "warning" | "info" | "error" {
  if (score >= 85) return "success";
  if (score >= 65) return "info";
  if (score >= 45) return "warning";
  return "error";
}

function getPulseLabel(score: number) {
  if (score >= 85) return "Thriving";
  if (score >= 65) return "Strong";
  if (score >= 45) return "Needs attention";
  return "At risk";
}

function isRelationCacheIssue(message?: string | null) {
  const lower = (message ?? "").toLowerCase();
  return lower.includes("company_daps") || lower.includes("company_jsas") || lower.includes("schema cache");
}

function normalizeWorkspaceIssue(message?: string | null) {
  if (!message) return null;
  if (isRelationCacheIssue(message)) {
    return "Workspace JSA data is still syncing behind the scenes. Refresh Workspace in a moment if you want the newest counts.";
  }
  return message.trim();
}

const DASHBOARD_FILTER_STORAGE_KEY = "safety360:company-dashboard-filters";

export function CompanyAdminDashboard({
  loading,
  workspaceLoaded,
  workspaceError,
  onRefreshWorkspace,
  onCompanyProfileUpdated,
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
  analyticsSummaryIssue,
  workspaceProduct = "full",
}: {
  loading: boolean;
  workspaceLoaded: boolean;
  workspaceError?: string | null;
  onRefreshWorkspace: () => void;
  onCompanyProfileUpdated?: () => void | Promise<void>;
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
  analyticsSummaryIssue?: { message: string; tone: "error" | "warning" } | null;
}) {
  const [selectedJobsite, setSelectedJobsite] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [referenceTime] = useState(() => Date.now());
  const normalizedWorkspaceError = normalizeWorkspaceIssue(workspaceError);
  const normalizedAnalyticsIssue = analyticsSummaryIssue
    ? {
        message: normalizeWorkspaceIssue(analyticsSummaryIssue.message) ?? analyticsSummaryIssue.message,
        tone: isRelationCacheIssue(analyticsSummaryIssue.message) ? "warning" : analyticsSummaryIssue.tone,
      }
    : null;

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = window.localStorage.getItem(DASHBOARD_FILTER_STORAGE_KEY);
        if (!stored) {
          setFiltersLoaded(true);
          return;
        }

        const parsed = JSON.parse(stored) as {
          searchQuery?: string;
          selectedJobsite?: string;
        } | null;

        if (typeof parsed?.searchQuery === "string") {
          setSearchQuery(parsed.searchQuery);
        }
        if (typeof parsed?.selectedJobsite === "string" && parsed.selectedJobsite.trim()) {
          setSelectedJobsite(parsed.selectedJobsite);
        }
      } catch {
        // Ignore malformed or unavailable persisted filters.
      } finally {
        setFiltersLoaded(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!filtersLoaded) return;

    try {
      window.localStorage.setItem(
        DASHBOARD_FILTER_STORAGE_KEY,
        JSON.stringify({ searchQuery, selectedJobsite })
      );
    } catch {
      // Ignore storage write failures.
    }
  }, [filtersLoaded, searchQuery, selectedJobsite]);

  useEffect(() => {
    if (selectedJobsite === "all") return;
    if (jobsites.some((jobsite) => jobsite.name === selectedJobsite)) return;
    queueMicrotask(() => {
      setSelectedJobsite("all");
    });
  }, [jobsites, selectedJobsite]);

  if (workspaceProduct === "csep") {
    const csepDocs = documents.filter((d) => /csep/i.test(d.document_type ?? ""));
    const pendingCsep = csepDocs.filter((d) =>
      isSubmittedDocumentStatus(d.status, Boolean(d.final_file_path))
    ).length;
    const approvedCsep = csepDocs.filter((d) => isApprovedDocument(d)).length;

    return (
      <div className="space-y-6">
        <PilotAccountPanel companyProfile={companyProfile} onUpdated={onCompanyProfileUpdated} />
        <section className="rounded-[1.9rem] border border-[#dbe9ff] bg-slate-900/90 p-6 shadow-[0_16px_36px_rgba(148,163,184,0.12)]">
          <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">
            {CONTRACTOR_SAFETY_BLUEPRINT_TITLE} workspace
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
            {companyProfile?.name?.trim() || "Company Workspace"}
          </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              This account is limited to the trade partner blueprint builder. Create and
              submit {` ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE}`} files for company review without the full
              company workspace yet.
            </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/csep"
              className="app-btn-gradient-primary inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm"
            >
              {CONTRACTOR_SAFETY_BLUEPRINT_BUILDER_LABEL}
            </Link>
            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-950/50 px-5 py-3 text-sm font-semibold text-slate-300"
            >
              Profile
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: `${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} records`,
              value: String(csepDocs.length),
              note: "Drafts and submissions",
            },
            { label: "Pending review", value: String(pendingCsep), note: "Awaiting admin review" },
            {
              label: "Approved",
              value: String(approvedCsep),
              note: `Completed ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} files`,
            },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{card.label}</div>
              <div className="mt-2 text-3xl font-black text-white">{loading ? "-" : card.value}</div>
              <p className="mt-2 text-sm text-slate-300">{card.note}</p>
            </div>
          ))}
        </section>

        <div id="company-knowledge" className="grid gap-4 lg:grid-cols-2 scroll-mt-8">
          <CompanyAiAssistPanel
            surface="csep"
            title={`${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} workspace assistant`}
          />
          <CompanyMemoryBankPanel />
        </div>
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

  const hasActiveFilters = normalizedSearch.length > 0 || selectedJobsite !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedJobsite("all");
  };

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
  const currentDate = new Date(referenceTime);
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const documentsThisMonth = documents.filter((document) => {
    const createdAt = new Date(document.created_at);
    return createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear;
  });
  const approvedThisMonth = approvedDocuments.filter((document) => {
    const createdAt = new Date(document.created_at);
    return createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear;
  });
  const workspacePulseScore = clampNumber(
    72 +
      Math.min(12, approvedDocuments.length * 2) +
      Math.min(8, activeUsers.length * 2) +
      Math.min(8, onlineUsers.length * 2) +
      Math.min(6, jobsites.length * 2) +
      (creditBalance !== null && creditBalance > 0 ? 4 : 0) -
      highRiskAlerts.length * 12 -
      pendingDocuments.length * 4 -
      pendingUsers.length * 3 -
      companyInvites.length * 2 -
      attentionDocuments.length * 5 -
      overdueActionsCount * 2,
    0,
    100
  );
  const workspacePulseLabel = getPulseLabel(workspacePulseScore);
  const workspacePulseTone = getPulseTone(workspacePulseScore);
  const workspaceBadgeCards = [
    {
      id: "team-online",
      title:
        onlineUsers.length > 0
          ? `${onlineUsers.length} team member${onlineUsers.length === 1 ? "" : "s"} online`
          : "Team offline",
      detail:
        onlineUsers.length > 0
          ? "Fresh activity is coming through the workspace now."
          : "The board is quiet, which makes it a good time to prep the next move.",
      tone: onlineUsers.length > 0 ? ("success" as const) : ("neutral" as const),
    },
    {
      id: "site-map",
      title:
        jobsites.length > 0
          ? `${jobsites.length} site${jobsites.length === 1 ? "" : "s"} mapped`
          : "First site still to create",
      detail:
        jobsites.length > 0
          ? "The workspace already has a growing site map."
          : "Add the first jobsite and the dashboard starts to feel alive.",
      tone: jobsites.length > 0 ? ("info" as const) : ("neutral" as const),
    },
    {
      id: "clean-board",
      title:
        pendingDocuments.length === 0 && pendingUsers.length === 0 && highRiskAlerts.length === 0
          ? "Clean board"
          : "Board in motion",
      detail:
        pendingDocuments.length === 0 && pendingUsers.length === 0 && highRiskAlerts.length === 0
          ? "No urgent approvals or escalations are waiting."
          : `${pendingDocuments.length + pendingUsers.length + highRiskAlerts.length} item${pendingDocuments.length + pendingUsers.length + highRiskAlerts.length === 1 ? "" : "s"} still need a little attention.`,
      tone:
        pendingDocuments.length === 0 && pendingUsers.length === 0 && highRiskAlerts.length === 0
          ? ("success" as const)
          : ("warning" as const),
    },
    {
      id: "credits-ready",
      title:
        creditBalance !== null
          ? `${creditBalance} credit${creditBalance === 1 ? "" : "s"} ready`
          : "Credits pending",
      detail:
        creditBalance !== null && creditBalance > 0
          ? "The marketplace has room for a few more unlocks."
          : "Top up credits if the team needs more marketplace unlocks.",
      tone:
        creditBalance !== null && creditBalance > 0 ? ("success" as const) : ("warning" as const),
    },
  ];

  const priorityQueueItems: Array<{
    id: string;
    title: string;
    detail: string;
    href: string;
    button: string;
    tone: "success" | "warning" | "info";
  }> = [];

  if (highRiskAlerts.length > 0) {
    const alert = highRiskAlerts[0];
    priorityQueueItems.push({
      id: "high-risk-alert",
      title: alert.title,
      detail: alert.detail,
      href: "/field-id-exchange",
      button: "Review alert",
      tone: "warning",
    });
  }

  if (pendingUsers.length > 0) {
    priorityQueueItems.push({
      id: "pending-users",
      title: `${pendingUsers.length} company user${pendingUsers.length === 1 ? "" : "s"} waiting for approval`,
      detail: "Open company users to approve, suspend, or activate access.",
      href: "/company-users",
      button: "Review users",
      tone: "info",
    });
  }

  if (pendingDocuments.length > 0) {
    priorityQueueItems.push({
      id: "pending-documents",
      title: `${pendingDocuments.length} document${pendingDocuments.length === 1 ? "" : "s"} still pending review`,
      detail: "Open the library queue and follow up on the newest submissions.",
      href: "/library",
      button: "Review docs",
      tone: "warning",
    });
  }

  if (companyInvites.length > 0) {
    priorityQueueItems.push({
      id: "pending-invites",
      title: `${companyInvites.length} invite${companyInvites.length === 1 ? "" : "s"} still waiting`,
      detail: "Remind invited employees to finish account setup.",
      href: "/company-users",
      button: "Open invites",
      tone: "info",
    });
  }

  priorityQueueItems.splice(3);

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
      title: "JSA completion today",
      value: `${dashboardMetrics.dapCompletionToday.percent}%`,
      note: `${dashboardMetrics.dapCompletionToday.completed}/${dashboardMetrics.dapCompletionToday.total} planned activities completed today`,
      href: "/jsa",
      tone: "info" as const,
    },
  ];
  const headlineKpiCards = kpiCards.slice(0, 4);
  const supportingKpiCards = kpiCards.slice(4);

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
              .join(" | ")
          : "No hazard category trends yet.",
    },
  ];

  const workspaceSummarySection = (
    <section className="app-shell-bright rounded-[2rem] p-6">
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="app-soft-panel flex items-start gap-4 rounded-[1.7rem] p-5">
            <div className="app-photo-placeholder flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.6rem] text-xl font-black text-[var(--app-accent-primary)]">
              {companyInitials || "CO"}
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--app-text-soft)]">
                Company Workspace
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--app-text-strong)] sm:text-4xl">
                {companyName}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--app-text)]">
                Keep jobsites, documents, team access, field reporting, and overdue items in one place.
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="app-soft-panel rounded-[1.7rem] px-4 py-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-soft)]">
                Notifications
              </div>
              <div className="mt-2 text-2xl font-black text-[var(--app-text-strong)]">{notificationCount}</div>
              <div className="mt-1 text-xs leading-5 text-[var(--app-text)]">
                Pending approvals, invites, and review items
              </div>
            </div>
            <div className="app-soft-panel rounded-[1.7rem] px-4 py-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--app-text-soft)]">
                Workspace status
              </div>
              <div className="mt-2 text-sm font-semibold text-[var(--app-text-strong)]">
                {priorityQueueItems.length > 0
                  ? `${priorityQueueItems.length} action item${priorityQueueItems.length === 1 ? "" : "s"} waiting`
                  : "Board is clear"}
              </div>
              <div className="mt-1 text-xs leading-5 text-[var(--app-text)]">
                {priorityQueueItems.length > 0
                  ? "Start with Today's focus to clear reviews, approvals, and escalations."
                  : "Use the sections below to review documents, team access, and field activity."}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px_190px_auto]">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search jobsites, documents, or employees..."
            className={`${appNativeSelectClassName} placeholder:text-[var(--app-text-soft)]`}
          />
          <select
            value={selectedJobsite}
            onChange={(event) => setSelectedJobsite(event.target.value)}
            className={appNativeSelectClassName}
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
            className="app-ghost-btn px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Loading..." : workspaceLoaded ? "Refresh Workspace" : "Load Workspace"}
          </button>
          <Link
            href="/company-users"
            className="app-ghost-btn px-4 py-2.5 text-sm"
          >
            {pendingUsers.length} pending approvals
          </Link>
          <details className="relative">
            <summary className="app-btn-gradient-primary flex cursor-pointer list-none items-center justify-center px-5 py-2.5 text-sm">
              Add New
            </summary>
            <div className="app-dropdown-menu absolute right-0 top-[calc(100%+0.75rem)] z-10 w-64 p-2">
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
                  className="app-dropdown-item block px-3 py-3"
                >
                  <div className="text-sm font-semibold text-[var(--app-text-strong)]">{item.label}</div>
                  <div className="mt-1 text-xs text-[var(--app-text)]">{item.note}</div>
                </Link>
              ))}
            </div>
          </details>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-soft)]">
          <span>{filteredDocuments.length} documents match</span>
          <span>|</span>
          <span>{filteredJobsites.length} jobsites match</span>
          <span>|</span>
          <span>{filteredUsers.length} users match</span>
          {hasActiveFilters ? (
            <>
              <span>|</span>
              <button
                type="button"
                onClick={clearFilters}
                className="font-semibold text-[var(--app-accent-primary)] transition hover:text-[var(--app-accent-primary-hover)]"
              >
                Clear filters
              </button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );

  return (
    <div className="company-admin-dashboard space-y-8">
      <PilotAccountPanel companyProfile={companyProfile} onUpdated={onCompanyProfileUpdated} />
      <section className="app-shell-bright rounded-[2rem] p-6">
        <div className="flex flex-col gap-6">
          {!workspaceLoaded || normalizedWorkspaceError ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                normalizedWorkspaceError
                  ? "border-amber-500/35 bg-amber-950/40 text-amber-100"
                  : "border-sky-500/35 bg-sky-950/35 text-sky-100"
              }`}
            >
              {normalizedWorkspaceError
                ? normalizedWorkspaceError
                : "This workspace loads on demand. Click Refresh Workspace to pull the latest company data."}
            </div>
          ) : null}

          {workspaceLoaded && normalizedAnalyticsIssue ? (
            <InlineMessage tone={normalizedAnalyticsIssue.tone}>{normalizedAnalyticsIssue.message}</InlineMessage>
          ) : null}

          {workspaceLoaded ? (
            <div id="company-knowledge" className="scroll-mt-8">
              <CompanyMemoryBankPanel />
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <SectionCard
        title="Today's focus"
        description="The items that need attention first in this workspace."
        aside={
          <StatusBadge
            label={
              priorityQueueItems.length > 0
                ? `${priorityQueueItems.length} action${priorityQueueItems.length === 1 ? "" : "s"}`
                : "Queue clear"
            }
            tone={priorityQueueItems.length > 0 ? "warning" : "success"}
          />
        }
        className="h-full"
      >
        {priorityQueueItems.length === 0 ? (
          <EmptyState
            title="Nice work, the board is clear"
            description="Approvals, document reviews, and high-risk alerts are all in good shape."
            actionHref="/library"
            actionLabel="Open library"
          />
        ) : (
          <div className="grid gap-3 xl:grid-cols-3">
            {priorityQueueItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 transition hover:border-sky-500/35 hover:bg-sky-950/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                      Priority
                    </div>
                    <div className="mt-2 text-lg font-bold text-slate-100">{item.title}</div>
                  </div>
                  <StatusBadge label={item.button} tone={item.tone} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">{item.detail}</p>
                <div className="mt-4 text-sm font-semibold text-sky-300">Open now</div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Board health"
        description="A quick read on momentum, wins, and the next useful move."
        aside={<StatusBadge label={workspacePulseLabel} tone={workspacePulseTone} />}
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
              Pulse score
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-black tracking-tight text-white">
                {workspacePulseScore}
              </span>
              <span className="pb-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
                /100
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {workspacePulseLabel} based on approvals, users online, jobsites, and current queue health.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
              This month
            </div>
            <div className="mt-3 text-3xl font-black text-white">{documentsThisMonth.length} docs</div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {approvedThisMonth.length} approvals landed this month, with {pendingDocuments.length} still moving.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
              Team badges
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {workspaceBadgeCards.map((badge) => (
                <StatusBadge key={badge.id} label={badge.title} tone={badge.tone} />
              ))}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Small wins that make the workspace feel organized and alive.
            </p>
          </div>

        </div>
      </SectionCard>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {headlineKpiCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-[1.35rem] border border-slate-700/80 bg-slate-900/90 p-5 shadow-sm transition hover:border-sky-500/35 hover:shadow-md"
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
              {card.title}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-4xl font-black tracking-tight text-white">
                {loading ? "-" : card.value}
              </div>
              <StatusBadge label={card.title.split(" ")[0]} tone={card.tone} />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">{card.note}</p>
          </Link>
        ))}
      </section>

      <SectionCard
        title="Operations radar"
        description="Track the rest of the active field, incident, and completion metrics without burying the page."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {supportingKpiCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 transition hover:border-sky-500/35 hover:bg-sky-950/30"
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {card.title}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-3xl font-black text-white">{loading ? "-" : card.value}</div>
                <StatusBadge label={card.title.split(" ")[0]} tone={card.tone} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">{card.note}</p>
            </Link>
          ))}
        </div>
      </SectionCard>

      {workspaceSummarySection}

      <section id="jobsites" className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <SectionCard
          title="Jobsites"
          description="Use this area to organize active sites and keep work grouped by location."
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
                className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300"
              >
                View Jobsites
              </a>
            </div>
          }
        >
          {filteredJobsites.length === 0 ? (
            <EmptyState
              title="No jobsites are active yet"
              description="That gives you a clean slate. Add the first site and the board will start organizing itself around it."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredJobsites.map((jobsite) => (
                <div key={jobsite.name} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold text-white">{jobsite.name}</div>
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
                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Project number
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-100">
                        {jobsite.projectNumber}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Team
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-100">
                        {companyUsers.length} team members
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Pending docs
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-100">
                        {jobsite.pendingDocuments}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Last activity
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-100">
                        {formatRelative(jobsite.lastActivity)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                    <span>{jobsite.totalDocuments} tracked document{jobsite.totalDocuments === 1 ? "" : "s"}</span>
                    <Link href="/jobsites" className="font-semibold text-sky-300">
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
          description="Documents that need review or follow-up today."
        >
          {pendingDocuments.length === 0 ? (
            <EmptyState
              title="The review queue is clear"
              description="Submitted company documents will appear here when they need review or follow-up."
            />
          ) : (
            <div className="space-y-3">
              {pendingDocuments.slice(0, 5).map((document) => (
                <div key={document.id} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">
                        {getDocumentLabel(document)}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                      {(document.project_name?.trim() || "General Workspace")} | {document.document_type || "Document"}
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
          title="Documents"
          description="Track drafts, submissions, approvals, and completed files."
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
                className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300"
              >
                Upload Existing Document
              </Link>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {documentSnapshotCards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {card.title}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-3xl font-black text-white">{card.value}</div>
                  <StatusBadge label={card.title.split(" ")[0]} tone={card.tone} />
                </div>
                <div className="mt-3 text-sm text-slate-500">{card.note}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-700/80">
            <div className="grid grid-cols-[minmax(0,1.7fr)_0.9fr_1fr_0.9fr_0.9fr_1fr] gap-3 bg-slate-950/50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              <div>Document</div>
              <div>Type</div>
              <div>Jobsite</div>
              <div>Status</div>
              <div>Submitted</div>
              <div>Action</div>
            </div>
            <div className="divide-y divide-slate-200 bg-slate-900/90">
              {filteredDocuments.slice(0, 8).map((document) => (
                <div
                  key={document.id}
                  className="grid grid-cols-[minmax(0,1.7fr)_0.9fr_1fr_0.9fr_0.9fr_1fr] gap-3 px-4 py-4 text-sm text-slate-300"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-100">{getDocumentLabel(document)}</div>
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
                    <Link href="/library" className="font-semibold text-sky-300">
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
          title="Team"
          description="See who is online, waiting, invited, or inactive."
          aside={
            <Link
              href="/company-users"
              className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300"
            >
              Manage team
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {userSnapshotCards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {card.title}
                </div>
                <div className="mt-3 text-3xl font-black text-white">{card.value}</div>
                <div className="mt-2 text-sm text-slate-500">{card.note}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {filteredUsers.slice(0, 6).map((user) => (
              <div key={user.id} className="rounded-2xl border border-slate-700/80 bg-slate-900/90 px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{user.name}</div>
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
                      className="mt-2 inline-flex font-semibold text-sky-300"
                    >
                      Open user access
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 ? (
              <EmptyState
                title="No users match this search"
                description="Try a different search or invite the next teammate into the workspace."
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
                Open issues
              </Link>
              <Link
                href="/safety-submit"
                className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300"
              >
                Open safety submission
              </Link>
            </div>
          }
        >
          {liveMatrixSummary.length === 0 ? (
            <EmptyState
              title="No matrix items are live yet"
              description="That’s a quiet board for now. As issues are created and reviewed, rows will appear here by category."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-700/80">
              <div className="grid grid-cols-[minmax(0,1.3fr)_0.8fr_0.8fr_0.8fr_0.8fr] gap-3 bg-slate-950/50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                <div>Category</div>
                <div>Open</div>
                <div>In Progress</div>
                <div>Closed</div>
                <div>Overdue</div>
              </div>
              <div className="divide-y divide-slate-200 bg-slate-900/90">
                {liveMatrixSummary.map((row) => (
                  <div
                    key={row.category}
                    className="grid grid-cols-[minmax(0,1.3fr)_0.8fr_0.8fr_0.8fr_0.8fr] gap-3 px-4 py-3 text-sm text-slate-300"
                  >
                    <div className="font-semibold text-slate-100">{row.category.replace(/_/g, " ")}</div>
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
          description="Today's items that still need follow-up from the company side."
        >
            {correctiveActions.length === 0 ? (
              <EmptyState
                title="No overdue actions right now"
                description="Pending approvals, document review items, and waiting invites will appear here when the company workspace needs action."
              />
            ) : (
              <div className="space-y-3">
                {correctiveActions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{item.title}</div>
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
                <div key={module.key} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {module.label}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-100">
                    {module.total} total | {module.open} open | {module.inProgress} active | {module.closed} closed
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
              description="The workspace is calm. Critical escalations and active stop-work items will appear here automatically."
            />
          ) : (
              <div className="space-y-3">
                {highRiskAlerts.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{item.title}</div>
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
          title="Reports"
          description="Simple reporting blocks that show what needs action today."
          aside={
            <Link
              href="/reports"
              className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300"
            >
              Open reports
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {reportWidgets.map((widget) => (
              <div
                key={widget.title}
                className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4"
              >
                <div className="text-sm font-semibold text-slate-100">{widget.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{widget.note}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Alerts"
          description="Everything the company should keep an eye on in the current workspace."
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
                className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4"
              >
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {alert.label}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-100">{alert.value}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
