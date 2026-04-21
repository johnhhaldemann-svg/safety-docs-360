import {
  getDocumentStatusLabel,
  isApprovedDocumentStatus,
  isSubmittedDocumentStatus,
} from "@/lib/documentStatus";
import type { DashboardRole } from "@/lib/dashboardRole";
import { CONTRACTOR_SAFETY_BLUEPRINT_BUILDER_LABEL } from "@/lib/safetyBlueprintLabels";
import type {
  DashboardActionSection,
  DashboardBanner,
  DashboardBlockId,
  DashboardBlockModel,
  DashboardDataState,
  DashboardDocument,
  DashboardFeedItem,
  DashboardFeedSection,
  DashboardMetric,
  DashboardSummaryItem,
  DashboardSummarySection,
  DashboardViewModel,
} from "@/components/dashboard/types";

const s = (value?: string | null) => (value ?? "").trim().toLowerCase();
const approved = (document: DashboardDocument) =>
  isApprovedDocumentStatus(document.status, Boolean(document.final_file_path));
const pending = (document: DashboardDocument) =>
  isSubmittedDocumentStatus(document.status, Boolean(document.final_file_path));
const active = (status?: string | null) =>
  !["closed", "archived", "expired", "verified_closed", "completed", "inactive"].includes(
    s(status)
  );
const overdue = (row: { due_at?: string | null; status?: string | null }) =>
  Boolean(row.due_at && active(row.status) && new Date(row.due_at).getTime() < Date.now());

function formatRelative(timestamp?: string | null) {
  if (!timestamp) return "Updated recently";

  const minutes = Math.max(1, Math.round((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatDue(timestamp?: string | null) {
  if (!timestamp) return "No due date";

  const days = Math.ceil((new Date(timestamp).getTime() - Date.now()) / 86400000);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  return days === 1 ? "Due tomorrow" : `Due in ${days} days`;
}

function documentTitle(document: DashboardDocument) {
  return document.document_title ?? document.project_name ?? document.file_name ?? "Untitled document";
}

function getCompanyName(data: DashboardDataState) {
  return data.companyProfile?.name?.trim() || data.userTeam || "your company";
}

function banner(data: DashboardDataState): DashboardBanner | undefined {
  if (data.companyWorkspaceError) {
    return { message: data.companyWorkspaceError, tone: "error" };
  }
  return data.analyticsSummaryIssue ?? undefined;
}

function jobsites(data: DashboardDataState) {
  return new Map(
    data.workspaceSummary.jobsites
      .filter((jobsite) => jobsite.id)
      .map((jobsite) => [jobsite.id as string, jobsite.name] as const)
  );
}

function metric(title: string, value: string, detail: string, tone?: DashboardMetric["tone"]) {
  return { title, value, detail, tone };
}

function feedSection(
  title: string,
  description: string,
  items: DashboardFeedItem[],
  empty: DashboardFeedSection["empty"]
): DashboardFeedSection {
  return { title, description, items, empty };
}

function actionSection(
  title: string,
  description: string,
  items: DashboardActionSection["items"],
  empty: DashboardActionSection["empty"]
): DashboardActionSection {
  return { title, description, items, empty };
}

function summarySection(
  title: string,
  description: string,
  items: DashboardSummaryItem[],
  empty: DashboardSummarySection["empty"]
): DashboardSummarySection {
  return { title, description, items, empty };
}

function recentDocumentsItems(data: DashboardDataState) {
  return data.documents
    .slice()
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 6)
    .map((document) => ({
      id: document.id,
      title: documentTitle(document),
      detail: getDocumentStatusLabel(document.status, Boolean(document.final_file_path)),
      meta: formatRelative(document.created_at),
      tone: approved(document)
        ? ("success" as const)
        : pending(document)
          ? ("warning" as const)
          : ("info" as const),
    }));
}

function recentReportsItems(data: DashboardDataState) {
  return (data.analyticsSummary?.recentReports ?? []).map((report) => ({
    id: report.id,
    title: report.title,
    detail: report.tag,
    meta: "Recent workspace submission",
    tone:
      report.tag === "HAZARD" || report.tag === "NEAR MISS"
        ? ("warning" as const)
        : ("info" as const),
  }));
}

function riskItems(data: DashboardDataState) {
  const jobsiteNames = jobsites(data);

  const overdueItems = data.workspaceSummary.observations
    .filter(overdue)
    .slice(0, 4)
    .map((row, index) => ({
      id: row.id ?? `obs-${index}`,
      title: row.title?.trim() || row.category?.trim() || "Corrective action overdue",
      detail: row.jobsite_id ? jobsiteNames.get(row.jobsite_id) ?? "Assigned jobsite" : "No jobsite assigned",
      meta: formatDue(row.due_at),
      tone: "warning" as const,
    }));

  const incidentItems = data.workspaceSummary.incidents
    .filter((row) => active(row.status))
    .slice(0, 4)
    .map((row, index) => ({
      id: row.id ?? `inc-${index}`,
      title: row.title?.trim() || "Open incident",
      detail: row.jobsite_id ? jobsiteNames.get(row.jobsite_id) ?? "Assigned jobsite" : "Company-wide follow-up",
      meta:
        row.stop_work_status === "stop_work_active"
          ? "Stop-work active"
          : row.sif_flag
            ? "SIF follow-up required"
            : "Needs follow-up",
      tone:
        row.stop_work_status === "stop_work_active"
          ? ("error" as const)
          : row.sif_flag
            ? ("warning" as const)
            : ("info" as const),
    }));

  const permitItems = data.workspaceSummary.permits
    .filter((row) => active(row.status))
    .slice(0, 4)
    .map((row, index) => ({
      id: row.id ?? `permit-${index}`,
      title: row.title?.trim() || "Active permit",
      detail: row.jobsite_id ? jobsiteNames.get(row.jobsite_id) ?? "Assigned jobsite" : "No jobsite assigned",
      meta:
        row.stop_work_status === "stop_work_active"
          ? "Restriction in place"
          : row.sif_flag
            ? "High-risk permit"
            : "Permit review item",
      tone:
        row.stop_work_status === "stop_work_active"
          ? ("error" as const)
          : row.sif_flag
            ? ("warning" as const)
            : ("info" as const),
    }));

  return { overdueItems, incidentItems, permitItems };
}

function rankingItems(data: DashboardDataState, href = "/jobsites"): DashboardSummaryItem[] {
  const jobsiteNames = jobsites(data);

  return (data.analyticsSummary?.jobsiteRiskScore ?? []).slice(0, 5).map((row) => ({
    id: row.jobsiteId,
    label: jobsiteNames.get(row.jobsiteId) ?? "Unassigned jobsite",
    value: `${row.score}`,
    note: `${row.overdue} overdue - ${row.stopWork} stop-work - ${row.incidents} incidents`,
    href,
    tone:
      row.score >= 10 ? ("error" as const) : row.score >= 5 ? ("warning" as const) : ("info" as const),
  }));
}

function hazardItems(data: DashboardDataState, href = "/analytics"): DashboardSummaryItem[] {
  return (data.analyticsSummary?.topHazardCategories ?? []).slice(0, 4).map((hazard) => ({
    id: hazard.category,
    label: hazard.category.replace(/_/g, " "),
    value: `${hazard.count}`,
    note: "Recurring hazard signal in the current review window.",
    href,
    tone: hazard.count >= 5 ? ("warning" as const) : ("info" as const),
  }));
}

function accessItems(data: DashboardDataState, role: DashboardRole): DashboardSummaryItem[] {
  const pendingUsers = data.companyUsers.filter((user) => user.status === "Pending").length;
  const inactiveUsers = data.companyUsers.filter((user) => user.status === "Inactive").length;

  if (data.companyUsers.length > 0 || role === "company_admin") {
    return [
      {
        id: "pending-approvals",
        label: "Pending approvals",
        value: `${pendingUsers}`,
        note: "Users still waiting for activation or approval.",
        href: "/company-users",
        tone: pendingUsers > 0 ? "warning" : "success",
      },
      {
        id: "inactive-workers",
        label: "Inactive workers",
        value: `${inactiveUsers}`,
        note: "Accounts with no recent sign-in that may need follow-up.",
        href: "/company-users",
        tone: inactiveUsers > 0 ? "info" : "success",
      },
      {
        id: "team-size",
        label: "Active company users",
        value: `${data.companyUsers.length}`,
        note: "Current roster visible from the company workspace.",
        href: "/company-users",
        tone: "info",
      },
    ];
  }

  return [
    {
      id: "my-role",
      label: "Current role",
      value: data.userRole || "Viewer",
      note: "The current role driving this dashboard experience.",
      href: "/profile",
      tone: "info",
    },
    {
      id: "workspace-team",
      label: "Workspace team",
      value: data.userTeam || "General",
      note: "Current team label tied to this account.",
      href: "/profile",
      tone: "info",
    },
    {
      id: "library-access",
      label: "Completed records",
      value: `${data.documents.filter(approved).length}`,
      note: "Approved files currently visible in your library.",
      href: "/library",
      tone: "success",
    },
  ];
}

function trainingItems(data: DashboardDataState, role: DashboardRole): DashboardSummaryItem[] {
  const pendingUsers = data.companyUsers.filter((user) => user.status === "Pending").length;
  const activeJobsites = data.workspaceSummary.jobsites.filter((jobsite) => active(jobsite.status)).length;
  const proxyTrainingGap = data.companyInvites.length || pendingUsers;
  const trainingHref = role === "default" ? "/profile" : "/training-matrix";
  const jobsiteHref = role === "default" ? "/search" : "/jobsites";
  const accessHref = role === "default" ? "/profile" : "/company-users";

  return [
    {
      id: "training-gap-proxy",
      label: "Training gaps",
      value: proxyTrainingGap > 0 ? `${proxyTrainingGap}` : "Clear",
      note:
        proxyTrainingGap > 0
          ? "Temporary proxy based on unresolved invites and pending user setup."
          : "No onboarding or invite backlog is visible right now.",
      href: trainingHref,
      tone: proxyTrainingGap > 0 ? "warning" : "success",
    },
    {
      id: "jobsites-in-scope",
      label: "Active jobsites",
      value: `${activeJobsites}`,
      note: "Current site count that training coverage should support.",
      href: jobsiteHref,
      tone: "info",
    },
    {
      id: "training-records",
      label: "Open invites",
      value: `${data.companyInvites.length}`,
      note: "Current invite backlog used as a temporary training-readiness signal.",
      href: accessHref,
      tone: data.companyInvites.length > 0 ? "warning" : "info",
    },
  ];
}

function genericRiskItems(data: DashboardDataState, href = "/search"): DashboardSummaryItem[] {
  const openIncidents = data.workspaceSummary.incidents.filter((row) => active(row.status)).length;
  const overdueActions = data.workspaceSummary.observations.filter(overdue).length;
  const activePermits = data.workspaceSummary.permits.filter((row) => active(row.status)).length;

  return [
    {
      id: "open-incidents",
      label: "Open incidents",
      value: `${openIncidents}`,
      note: "Incident follow-ups currently visible in the workspace.",
      href,
      tone: openIncidents > 0 ? "warning" : "success",
    },
    {
      id: "overdue-actions",
      label: "Overdue actions",
      value: `${overdueActions}`,
      note: "Corrective actions that are already past due.",
      href,
      tone: overdueActions > 0 ? "warning" : "success",
    },
    {
      id: "active-permits",
      label: "Active permits",
      value: `${activePermits}`,
      note: "Permits currently active across visible sites.",
      href,
      tone: activePermits > 0 ? "info" : "success",
    },
  ];
}

function buildBlocks(params: {
  metrics: DashboardMetric[];
  priorityQueue: DashboardFeedSection;
  nextActions: DashboardActionSection;
  recentActivity: DashboardFeedSection;
  recentDocuments: DashboardFeedSection;
  recentReports: DashboardFeedSection;
  riskRanking: DashboardSummarySection;
  hazardTrends: DashboardSummarySection;
  supportSignals: DashboardSummarySection;
  companyAccess: DashboardSummarySection;
  trainingSignal: DashboardSummarySection;
  permitFollowups: DashboardFeedSection;
  incidentFollowups: DashboardFeedSection;
}): Record<DashboardBlockId, DashboardBlockModel> {
  const [primary, secondary, tertiary, quaternary] = params.metrics;

  return {
    metric_primary: {
      kind: "metric",
      title: primary.title,
      value: primary.value,
      detail: primary.detail,
      tone: primary.tone,
    },
    metric_secondary: {
      kind: "metric",
      title: secondary.title,
      value: secondary.value,
      detail: secondary.detail,
      tone: secondary.tone,
    },
    metric_tertiary: {
      kind: "metric",
      title: tertiary.title,
      value: tertiary.value,
      detail: tertiary.detail,
      tone: tertiary.tone,
    },
    metric_quaternary: {
      kind: "metric",
      title: quaternary.title,
      value: quaternary.value,
      detail: quaternary.detail,
      tone: quaternary.tone,
    },
    priority_queue: {
      kind: "feed",
      eyebrow: "Priority queue",
      section: params.priorityQueue,
    },
    next_actions: {
      kind: "action",
      section: params.nextActions,
    },
    recent_activity: {
      kind: "feed",
      eyebrow: "Live activity",
      section: params.recentActivity,
    },
    recent_documents: {
      kind: "feed",
      eyebrow: "Documents",
      section: params.recentDocuments,
    },
    recent_reports: {
      kind: "feed",
      eyebrow: "Reports",
      section: params.recentReports,
    },
    risk_ranking: {
      kind: "summary",
      eyebrow: "Risk ranking",
      section: params.riskRanking,
    },
    hazard_trends: {
      kind: "summary",
      eyebrow: "Hazard trends",
      section: params.hazardTrends,
    },
    support_signals: {
      kind: "summary",
      eyebrow: "Support signals",
      section: params.supportSignals,
    },
    company_access: {
      kind: "summary",
      eyebrow: "Company access",
      section: params.companyAccess,
    },
    training_signal: {
      kind: "summary",
      eyebrow: "Training signal",
      section: params.trainingSignal,
    },
    permit_followups: {
      kind: "feed",
      eyebrow: "Permit follow-ups",
      section: params.permitFollowups,
    },
    incident_followups: {
      kind: "feed",
      eyebrow: "Incident follow-ups",
      section: params.incidentFollowups,
    },
  };
}

function loading(role: DashboardRole, title: string): DashboardViewModel {
  const loadingFeed = feedSection(
    "Loading block",
    "Waiting for current workspace signals.",
    [],
    {
      title: "Nothing yet",
      description: "This block will populate once the dashboard finishes loading.",
    }
  );
  const loadingSummary = summarySection(
    "Loading block",
    "Waiting for current workspace signals.",
    [],
    {
      title: "Nothing yet",
      description: "This block will populate once the dashboard finishes loading.",
    }
  );

  return {
    role,
    hero: {
      eyebrow: "Loading dashboard",
      title,
      description: "Gathering current risk, backlog, and next-action signals.",
      actions: [],
    },
    blocks: buildBlocks({
      metrics: [
        metric("Attention now", "Loading", "Pulling live workload.", "attention"),
        metric("Queue", "Loading", "Checking role-specific queue."),
        metric("Risk", "Loading", "Resolving risk indicators."),
        metric("Activity", "Loading", "Fetching current activity."),
      ],
      priorityQueue: loadingFeed,
      nextActions: actionSection(
        "Loading actions",
        "Recommended actions will appear after loading.",
        [],
        {
          title: "Nothing yet",
          description: "Recommended actions will appear after loading.",
        }
      ),
      recentActivity: loadingFeed,
      recentDocuments: loadingFeed,
      recentReports: loadingFeed,
      riskRanking: loadingSummary,
      hazardTrends: loadingSummary,
      supportSignals: loadingSummary,
      companyAccess: loadingSummary,
      trainingSignal: loadingSummary,
      permitFollowups: loadingFeed,
      incidentFollowups: loadingFeed,
    }),
  };
}

export function getCompanyAdminDashboardModel(data: DashboardDataState): DashboardViewModel {
  if (data.loading) {
    return loading("company_admin", "Preparing company admin dashboard");
  }

  const risks = riskItems(data);
  const recentDocuments = recentDocumentsItems(data);
  const recentReports = recentReportsItems(data);
  const access = accessItems(data, "company_admin");
  const training = trainingItems(data, "company_admin");

  if (data.workspaceProduct === "csep") {
    const inReview = data.documents.filter(pending).length;
    const approvedCount = data.documents.filter(approved).length;
    const draftCount = data.documents.length - inReview - approvedCount;

    return {
      role: "company_admin",
      hero: {
        eyebrow: "Company admin dashboard",
        title: `${getCompanyName(data)} CSEP workspace`,
        description:
          "This company is on the focused CSEP experience, so the dashboard stays centered on document throughput and the next builder action.",
        actions: [
          {
            label: CONTRACTOR_SAFETY_BLUEPRINT_BUILDER_LABEL,
            href: "/csep",
            variant: "primary",
          },
          {
            label: "Open library",
            href: "/library",
            variant: "secondary",
          },
        ],
      },
      banner: banner(data),
      blocks: buildBlocks({
        metrics: [
          metric("In review", `${inReview}`, "CSEP files waiting in review.", "attention"),
          metric("Approved", `${approvedCount}`, "Completed CSEP files in the library."),
          metric("Drafts", `${draftCount}`, "Unsubmitted work still in progress."),
          metric(
            "Credits",
            data.creditBalance == null ? "Unknown" : `${data.creditBalance}`,
            "Current credit balance."
          ),
        ],
        priorityQueue: feedSection(
          "Document queue",
          "Clear anything stuck in review and keep the builder queue moving.",
          recentDocuments.filter((item) => item.tone !== "success").slice(0, 6),
          {
            title: "No CSEP items need attention",
            description: "The current builder queue is clear.",
            actionHref: "/csep",
            actionLabel: "Open builder",
          }
        ),
        nextActions: actionSection(
          "What should this user do next",
          "Use the focused CSEP workflow instead of the broader company workspace.",
          [
            {
              title: "Start a new CSEP",
              description: "Open the builder and begin the next contractor safety package.",
              href: "/csep",
              actionLabel: "Open builder",
              tone: "attention",
            },
            {
              title: "Review completed files",
              description: "Open approved files and keep deliverables organized.",
              href: "/library",
              actionLabel: "Open library",
            },
          ],
          {
            title: "No actions yet",
            description: "Use the builder to start the next package.",
          }
        ),
        recentActivity: feedSection(
          "Recent activity",
          "Latest document updates in the focused CSEP workspace.",
          recentDocuments,
          {
            title: "No document activity yet",
            description:
              "Your CSEP document feed will show up here after the first file is created.",
            actionHref: "/csep",
            actionLabel: "Start a CSEP",
          }
        ),
        recentDocuments: feedSection(
          "Recent documents",
          "Latest CSEP documents visible to this company workspace.",
          recentDocuments,
          {
            title: "No documents yet",
            description: "Create the first CSEP to populate the document list.",
            actionHref: "/csep",
            actionLabel: "Open builder",
          }
        ),
        recentReports: feedSection(
          "Recent reports",
          "CSEP work stays focused on document throughput, so recent document activity is shown here too.",
          recentReports.length > 0 ? recentReports : recentDocuments.slice(0, 4),
          {
            title: "No recent reports yet",
            description: "Recent report signals will appear here once they are available.",
            actionHref: "/library",
            actionLabel: "Open library",
          }
        ),
        riskRanking: summarySection(
          "Workspace snapshot",
          "A compact throughput view for the CSEP-only workspace.",
          [
            {
              id: "documents-total",
              label: "Total documents",
              value: `${data.documents.length}`,
              note: "All CSEP records currently visible in the workspace.",
              href: "/search",
              tone: "info",
            },
            {
              id: "queue-balance",
              label: "Review queue",
              value: `${inReview}`,
              note: "Documents still waiting for approval or completion.",
              href: "/library",
              tone: inReview > 0 ? "warning" : "success",
            },
            {
              id: "completed-deliverables",
              label: "Completed deliverables",
              value: `${approvedCount}`,
              note: "Approved CSEP files already available in the library.",
              href: "/library",
              tone: approvedCount > 0 ? "success" : "info",
            },
          ],
          {
            title: "Workspace snapshot",
            description: "Metrics will appear once your CSEP records load.",
          }
        ),
        hazardTrends: summarySection(
          "Document health",
          "Status-based document trends for the focused CSEP workspace.",
          [
            {
              id: "draft-documents",
              label: "Drafts",
              value: `${draftCount}`,
              note: "Documents still being prepared before submission.",
              href: "/csep",
              tone: draftCount > 0 ? "info" : "success",
            },
            {
              id: "in-review-documents",
              label: "In review",
              value: `${inReview}`,
              note: "Submitted packages still waiting for review.",
              href: "/library",
              tone: inReview > 0 ? "warning" : "success",
            },
            {
              id: "approved-documents",
              label: "Approved",
              value: `${approvedCount}`,
              note: "Completed files available to open right now.",
              href: "/library",
              tone: approvedCount > 0 ? "success" : "info",
            },
          ],
          {
            title: "Document health",
            description: "Status trends will appear once records exist.",
          }
        ),
        supportSignals: summarySection(
          "Support signals",
          "Keep an eye on company access and backlog from the focused workspace.",
          access,
          {
            title: "Support signals",
            description: "Support signals will appear after company access loads.",
          }
        ),
        companyAccess: summarySection(
          "Company access",
          "Company user and activation signals tied to the CSEP workspace.",
          access,
          {
            title: "Company access",
            description: "Company access data will appear after the user roster loads.",
          }
        ),
        trainingSignal: summarySection(
          "Training signal",
          "Training readiness is still proxied by invite and onboarding activity in this focused workspace.",
          training,
          {
            title: "Training signal",
            description: "Training signals will appear once invite and team data load.",
          }
        ),
        permitFollowups: feedSection(
          "Permit follow-ups",
          "The focused CSEP workspace does not route permit workflows, so this block stays in a waiting state.",
          [],
          {
            title: "No permit workflow in this workspace",
            description: "Open the broader company workspace if you need permit follow-ups.",
            actionHref: "/library",
            actionLabel: "Open library",
          }
        ),
        incidentFollowups: feedSection(
          "Incident follow-ups",
          "The focused CSEP workspace does not route incident workflows, so this block stays in a waiting state.",
          [],
          {
            title: "No incident workflow in this workspace",
            description: "Open the broader company workspace if you need incident follow-ups.",
            actionHref: "/library",
            actionLabel: "Open library",
          }
        ),
      }),
    };
  }

  const pendingApprovals = data.companyUsers.filter((user) => user.status === "Pending").length;
  const supportItems = [
    {
      id: "pending-users",
      label: "Pending approvals",
      value: `${pendingApprovals}`,
      note: "Users still waiting for company activation.",
      href: "/company-users",
      tone: pendingApprovals > 0 ? ("warning" as const) : ("success" as const),
    },
    {
      id: "inactive-workers",
      label: "Inactive workers",
      value: `${data.companyUsers.filter((user) => user.status === "Inactive").length}`,
      note: "Accounts with no recent sign-in that may need follow-up.",
      href: "/company-users",
      tone: "info" as const,
    },
    {
      id: "training-expirations",
      label: "Training gaps",
      value: data.companyInvites.length > 0 ? `${data.companyInvites.length}` : "Pending sync",
      note:
        data.companyInvites.length > 0
          ? "Invite backlog used as a temporary training coverage proxy."
          : "Training expiration feed is not wired yet.",
      href: "/training-matrix",
      tone: data.companyInvites.length > 0 ? ("warning" as const) : ("info" as const),
    },
    ...hazardItems(data),
  ].slice(0, 6);

  return {
    role: "company_admin",
    hero: {
      eyebrow: "Company admin dashboard",
      title: `What needs attention across ${getCompanyName(data)}`,
      description:
        "Start with urgent approvals and overdue risk items, then move into company activity and the highest-risk jobsites.",
      actions: [
        {
          label: "Open command center",
          href: "/command-center",
          variant: "primary",
        },
        {
          label: "Manage company users",
          href: "/company-users",
          variant: "secondary",
        },
      ],
    },
    banner: banner(data),
    blocks: buildBlocks({
      metrics: [
        metric(
          "Pending approvals",
          `${pendingApprovals}`,
          "Users and access decisions waiting now.",
          "attention"
        ),
        metric(
          "Open incidents",
          `${data.workspaceSummary.incidents.filter((row) => active(row.status)).length}`,
          "Incident records still requiring follow-up."
        ),
        metric(
          "Overdue actions",
          `${data.workspaceSummary.observations.filter(overdue).length}`,
          "Corrective actions already past due."
        ),
        metric(
          "Training expirations",
          data.companyInvites.length > 0 ? `${data.companyInvites.length}` : "Pending sync",
          "Temporary proxy until the training expiration feed is wired."
        ),
      ],
      priorityQueue: feedSection(
        "What needs attention now",
        "The highest-risk backlog across approvals, incidents, and overdue corrective actions.",
        [...risks.overdueItems, ...risks.incidentItems].slice(0, 6),
        {
          title: "Urgent items are clear",
          description: "No overdue corrective actions or open incident escalations are visible right now.",
          actionHref: "/analytics",
          actionLabel: "Open analytics",
        }
      ),
      nextActions: actionSection(
        "What should this user do next",
        "The fastest ways to keep company-wide work moving without extra dashboard clutter.",
        [
          {
            title: "Review pending approvals",
            description: "Confirm access and unblock the workforce.",
            href: "/company-users",
            actionLabel: "Open company users",
            tone: "attention",
          },
          {
            title: "Check overdue site risk",
            description: "Open jobsites and focus on the locations with the highest combined risk.",
            href: "/jobsites",
            actionLabel: "Open jobsites",
          },
          {
            title: "Open executive analytics",
            description: "Review hazard concentration, incident trends, and closure performance.",
            href: "/analytics",
            actionLabel: "Open analytics",
          },
          {
            title: "Audit training coverage",
            description: "Open the training matrix and resolve coverage gaps.",
            href: "/training-matrix",
            actionLabel: "Open training matrix",
          },
        ],
        {
          title: "No actions yet",
          description: "Recommended admin actions will appear here.",
        }
      ),
      recentActivity: feedSection(
        "Recent workspace activity",
        "Recent submissions and company activity signals from the live workspace.",
        recentReports.length > 0 ? recentReports : recentDocuments,
        {
          title: "No recent workspace activity",
          description: "Recent submissions will appear here as soon as records move through the workspace.",
          actionHref: "/library",
          actionLabel: "Open library",
        }
      ),
      recentDocuments: feedSection(
        "Recent documents",
        "The newest documents visible from the company workspace.",
        recentDocuments,
        {
          title: "No recent documents",
          description: "New document activity will appear here as soon as files move through the workspace.",
          actionHref: "/library",
          actionLabel: "Open library",
        }
      ),
      recentReports: feedSection(
        "Recent reports",
        "Fresh report and submission signals from the current review window.",
        recentReports,
        {
          title: "No reports yet",
          description: "Recent report submissions will appear here as soon as they are available.",
          actionHref: "/reports",
          actionLabel: "Open reports",
        }
      ),
      riskRanking: summarySection(
        "Jobsite health ranking",
        "Highest-risk jobsites ranked by combined incident, stop-work, and overdue action signals.",
        rankingItems(data),
        {
          title: "No jobsite health ranking yet",
          description: "This list will appear after jobsites and analytics data begin flowing.",
          actionHref: "/jobsites",
          actionLabel: "Open jobsites",
        }
      ),
      hazardTrends: summarySection(
        "Hazard trends",
        "Recurring hazard and trend signals pulled from the current analytics window.",
        hazardItems(data),
        {
          title: "No hazard trends yet",
          description: "Hazard signals will appear here when analytics data is available.",
          actionHref: "/analytics",
          actionLabel: "Open analytics",
        }
      ),
      supportSignals: summarySection(
        "Training and hazard signals",
        "Secondary context for what looks overdue or risky right now.",
        supportItems,
        {
          title: "Training and hazard signals",
          description: "Support signals will appear here when data is available.",
        }
      ),
      companyAccess: summarySection(
        "Company access",
        "The current user and access posture across the company workspace.",
        access,
        {
          title: "Company access",
          description: "User access indicators will appear after the company roster loads.",
        }
      ),
      trainingSignal: summarySection(
        "Training signal",
        "Current training and readiness proxy indicators for the company workspace.",
        training,
        {
          title: "Training signal",
          description: "Training indicators will appear here when the roster and invite feed are ready.",
        }
      ),
      permitFollowups: feedSection(
        "Permit follow-ups",
        "Permit-related review and restriction items that still need attention.",
        risks.permitItems,
        {
          title: "No permit follow-ups",
          description: "There are no active permit escalations or restrictions visible right now.",
          actionHref: "/permits",
          actionLabel: "Open permits",
        }
      ),
      incidentFollowups: feedSection(
        "Incident follow-ups",
        "Incident records that still need response, closure, or leadership attention.",
        risks.incidentItems,
        {
          title: "No incident follow-ups",
          description: "There are no active incident escalations visible right now.",
          actionHref: "/incidents",
          actionLabel: "Open incidents",
        }
      ),
    }),
  };
}

export function getSafetyManagerDashboardModel(data: DashboardDataState): DashboardViewModel {
  if (data.loading) {
    return loading("safety_manager", "Preparing safety manager dashboard");
  }

  const risks = riskItems(data);
  const recentDocuments = recentDocumentsItems(data);
  const recentReports = recentReportsItems(data);
  const reviewDocuments = data.documents.filter(pending).length;
  const permitReview = data.workspaceSummary.permits.filter((row) => active(row.status)).length;
  const incidentFollowups = data.workspaceSummary.incidents.filter((row) => active(row.status)).length;
  const overdueCount = data.workspaceSummary.observations.filter(overdue).length;
  const safetyHazardTrendItems: DashboardSummaryItem[] = [
    ...hazardItems(data),
    {
      id: "overdue-audits",
      label: "Overdue audits",
      value: overdueCount > 0 ? `${overdueCount}` : "Pending sync",
      note:
        overdueCount > 0
          ? "Overdue corrective actions currently visible in the company workspace."
          : "Audit due dates are not connected yet.",
      href: "/reports",
      tone: overdueCount > 0 ? ("warning" as const) : ("info" as const),
    },
  ].slice(0, 5);

  return {
    role: "safety_manager",
    hero: {
      eyebrow: "Safety manager dashboard",
      title: "Your review queue and follow-up workload",
      description:
        "This dashboard stays centered on what needs review now, what looks overdue or risky, and the next safety workflow to clear.",
      actions: [
        { label: "Open permits", href: "/permits", variant: "primary" },
        { label: "Review incidents", href: "/incidents", variant: "secondary" },
      ],
    },
    banner: banner(data),
    blocks: buildBlocks({
      metrics: [
        metric(
          "Personal work queue",
          `${reviewDocuments + permitReview + incidentFollowups + overdueCount}`,
          "Combined document, permit, incident, and overdue follow-ups.",
          "attention"
        ),
        metric("Docs needing review", `${reviewDocuments}`, "Submitted files still waiting on review."),
        metric("Permit review items", `${permitReview}`, "Active permits still open across current jobsites."),
        metric(
          "Incident follow-ups",
          `${incidentFollowups}`,
          "Open incidents still requiring response or closure."
        ),
      ],
      priorityQueue: feedSection(
        "What needs attention now",
        "Highest-priority review items and overdue follow-ups in the safety queue.",
        [...risks.overdueItems, ...risks.permitItems, ...risks.incidentItems].slice(0, 6),
        {
          title: "Your priority queue is clear",
          description: "No overdue corrective actions, permit escalations, or open incidents are visible right now.",
          actionHref: "/command-center",
          actionLabel: "Open command center",
        }
      ),
      nextActions: actionSection(
        "What should this user do next",
        "Start with the queue that clears the most risk and then move into recurring review work.",
        [
          {
            title: "Review documents in queue",
            description: "Open in-review files and keep approvals moving for the field.",
            href: "/library",
            actionLabel: "Open library",
            tone: "attention",
          },
          {
            title: "Work permit review items",
            description: "Clear active permits and check for stop-work or SIF escalation flags.",
            href: "/permits",
            actionLabel: "Open permits",
          },
          {
            title: "Follow up on incidents",
            description: "Complete incident response items and keep leadership informed.",
            href: "/incidents",
            actionLabel: "Open incidents",
          },
          {
            title: "Close training gaps",
            description: "Open the training matrix and resolve gaps before the next shift or audit cycle.",
            href: "/training-matrix",
            actionLabel: "Open training matrix",
          },
        ],
        {
          title: "No actions yet",
          description: "Recommended safety-manager actions will appear here.",
        }
      ),
      recentActivity: feedSection(
        "Recent submissions",
        "Latest documents and submission activity that may need a safety review.",
        recentDocuments.filter((item) => item.tone !== "success").slice(0, 6),
        {
          title: "No recent submissions",
          description: "Recent document or report submissions will show up here as they land.",
          actionHref: "/library",
          actionLabel: "Open library",
        }
      ),
      recentDocuments: feedSection(
        "Recent documents",
        "Documents that recently moved and may need a safety decision or follow-up.",
        recentDocuments,
        {
          title: "No recent documents",
          description: "Document updates will appear here after the next submission lands.",
          actionHref: "/library",
          actionLabel: "Open library",
        }
      ),
      recentReports: feedSection(
        "Recent reports",
        "Recent safety reports and generated submission signals.",
        recentReports,
        {
          title: "No recent reports",
          description: "Report submissions will appear here when they start flowing through the workspace.",
          actionHref: "/reports",
          actionLabel: "Open reports",
        }
      ),
      riskRanking: summarySection(
        "Risk ranking",
        "The highest-risk jobsites and work areas based on the current analytics signal.",
        rankingItems(data).length > 0 ? rankingItems(data) : genericRiskItems(data, "/analytics"),
        {
          title: "No risk ranking yet",
          description: "Risk ranking will appear here once analytics data is available.",
          actionHref: "/analytics",
          actionLabel: "Open analytics",
        }
      ),
      hazardTrends: summarySection(
        "Risk and review signals",
        "A compact snapshot of where this safety role should concentrate next.",
        safetyHazardTrendItems,
        {
          title: "Risk and review signals",
          description: "Insights will appear when analytics data is available.",
        }
      ),
      supportSignals: summarySection(
        "Coverage gaps and support",
        "Secondary signals to help prioritize the next operational step.",
        [
          {
            id: "review-documents",
            label: "Documents needing review",
            value: `${reviewDocuments}`,
            note: "Items in review that need a decision or follow-up.",
            href: "/library",
            tone: reviewDocuments > 0 ? "warning" : "success",
          },
          {
            id: "training-gaps",
            label: "Training gaps",
            value: data.companyInvites.length > 0 ? `${data.companyInvites.length}` : "Pending sync",
            note:
              data.companyInvites.length > 0
                ? "Temporary proxy signal based on unresolved company invites and onboarding backlog."
                : "Training expiration feed is not connected yet.",
            href: "/training-matrix",
            tone: data.companyInvites.length > 0 ? "warning" : "info",
          },
          {
            id: "permit-followups-total",
            label: "Permit follow-ups",
            value: `${permitReview + incidentFollowups}`,
            note: "Combined permit and incident follow-up items still open across assigned work.",
            href: "/permits",
            tone: permitReview + incidentFollowups > 0 ? "warning" : "success",
          },
        ],
        {
          title: "Coverage gaps and support",
          description: "Support indicators will appear here when the workspace finishes loading.",
        }
      ),
      companyAccess: summarySection(
        "Company access",
        "Company and roster context that can change the safety review workload.",
        accessItems(data, "safety_manager"),
        {
          title: "Company access",
          description: "Roster context will appear here after user and team data load.",
        }
      ),
      trainingSignal: summarySection(
        "Training signal",
        "Training readiness indicators that support the next safety decision.",
        trainingItems(data, "safety_manager"),
        {
          title: "Training signal",
          description: "Training indicators will appear when the roster and invite feed are ready.",
        }
      ),
      permitFollowups: feedSection(
        "Permit follow-ups",
        "Active permits that still need review, closure, or restriction management.",
        risks.permitItems,
        {
          title: "No permit follow-ups",
          description: "There are no active permit review items visible right now.",
          actionHref: "/permits",
          actionLabel: "Open permits",
        }
      ),
      incidentFollowups: feedSection(
        "Incident follow-ups",
        "Open incidents that still need response, closure, or communications.",
        risks.incidentItems,
        {
          title: "No incident follow-ups",
          description: "There are no active incident follow-ups visible right now.",
          actionHref: "/incidents",
          actionLabel: "Open incidents",
        }
      ),
    }),
  };
}

export function getFieldSupervisorDashboardModel(data: DashboardDataState): DashboardViewModel {
  if (data.loading) {
    return loading("field_supervisor", "Preparing field supervisor dashboard");
  }

  const risks = riskItems(data);
  const recentDocuments = recentDocumentsItems(data);
  const recentReports = recentReportsItems(data);
  const activeJobsites = data.workspaceSummary.jobsites.filter((jobsite) => active(jobsite.status)).length;
  const restrictions = data.workspaceSummary.permits.filter(
    (permit) => permit.stop_work_status === "stop_work_active" || permit.sif_flag
  ).length;
  const activeDaps = data.workspaceSummary.daps.filter((row) => active(row.status)).length;

  return {
    role: "field_supervisor",
    hero: {
      eyebrow: "Field supervisor dashboard",
      title: "Today's site status and next field actions",
      description:
        "The top of this dashboard stays focused on active site conditions, open observations, permit restrictions, and the fastest next action for the field.",
      actions: [
        { label: "Open jobsites", href: "/jobsites", variant: "primary" },
        { label: "Review DAPs", href: "/jsa", variant: "secondary" },
      ],
    },
    banner: banner(data),
    blocks: buildBlocks({
      metrics: [
        metric(
          "Today's site status",
          restrictions > 0 ? "Needs review" : activeJobsites > 0 ? "Ready" : "No active sites",
          "Live field summary across your assigned jobsites.",
          restrictions > 0 ? "attention" : "elevated"
        ),
        metric(
          "Active permits",
          `${data.workspaceSummary.permits.filter((row) => active(row.status)).length}`,
          "Permits currently active across visible sites."
        ),
        metric(
          "Open observations",
          `${data.workspaceSummary.observations.filter((row) => active(row.status)).length}`,
          "Open observation and corrective-action items in the field queue."
        ),
        metric(
          "Weather / restrictions",
          restrictions > 0 ? `${restrictions}` : "No live feed",
          restrictions > 0
            ? "Restriction or high-risk permit signals are active."
            : "Weather integration is not wired yet."
        ),
      ],
      priorityQueue: feedSection(
        "What needs attention now",
        "Field-facing items that could block work, create risk, or need a same-day response.",
        [...risks.permitItems, ...risks.overdueItems, ...risks.incidentItems].slice(0, 6),
        {
          title: "Field queue is clear",
          description: "No active permit restrictions, overdue corrective actions, or incident escalations are visible right now.",
          actionHref: "/jobsites",
          actionLabel: "Open jobsites",
        }
      ),
      nextActions: actionSection(
        "What should this user do next",
        "Move directly into the next field workflow without digging through the full navigation.",
        [
          {
            title: "Start walk",
            description: "Open assigned jobsites and begin the next field walk or site check.",
            href: "/jobsites",
            actionLabel: "Open jobsites",
            tone: "attention",
          },
          {
            title: "Report observation",
            description: "Capture a new field observation or issue from the exchange workflow.",
            href: "/field-id-exchange",
            actionLabel: "Open exchange",
          },
          {
            title: "Open permit board",
            description: "Review active permits and confirm there are no open restrictions before work starts.",
            href: "/jobsites",
            actionLabel: "View permit board",
          },
          {
            title: "Review DAPs",
            description: "Open JSAs/DAPs and clear the next activity package for the site.",
            href: "/jsa",
            actionLabel: "Open DAP review",
          },
        ],
        {
          title: "No actions yet",
          description: "Recommended field actions will appear here.",
        }
      ),
      recentActivity: feedSection(
        "Recent field activity",
        "Live permit, observation, and submission movement relevant to today's field work.",
        [...risks.permitItems, ...recentReports].slice(0, 6),
        {
          title: "No recent field activity",
          description: "Field activity will appear once permits, reports, or observations start moving.",
          actionHref: "/jobsites",
          actionLabel: "Open jobsites",
        }
      ),
      recentDocuments: feedSection(
        "Recent documents",
        "The newest documents visible to the field workflow.",
        recentDocuments,
        {
          title: "No recent documents",
          description: "Field-facing document updates will appear here as soon as records move.",
          actionHref: "/search",
          actionLabel: "Search records",
        }
      ),
      recentReports: feedSection(
        "Recent reports",
        "Recent report submissions and field activity signals.",
        recentReports,
        {
          title: "No recent reports",
          description: "Field report submissions will appear here when they are available.",
          actionHref: "/jobsites",
          actionLabel: "Open jobsites",
        }
      ),
      riskRanking: summarySection(
        "Site risk snapshot",
        "A compact view of which jobsites and field items need the most attention.",
        [
          ...rankingItems(data).slice(0, 3),
          {
            id: "open-daps",
            label: "Open DAP review",
            value: `${activeDaps}`,
            note: "Open DAPs/JSAs still needing a field review or completion check.",
            href: "/jsa",
            tone: activeDaps > 0 ? "warning" : "success",
          },
        ],
        {
          title: "Site risk snapshot",
          description: "The site ranking will appear after jobsite and analytics data load.",
          actionHref: "/jobsites",
          actionLabel: "Open jobsites",
        }
      ),
      hazardTrends: summarySection(
        "Hazard trends",
        "Recurring field hazard patterns from the current analytics window.",
        hazardItems(data).length > 0 ? hazardItems(data) : genericRiskItems(data, "/jobsites"),
        {
          title: "No hazard trends yet",
          description: "Field hazard trends will appear when analytics data is available.",
          actionHref: "/analytics",
          actionLabel: "Open analytics",
        }
      ),
      supportSignals: summarySection(
        "Coverage and support",
        "Helpful context for crews, weather, and assigned site workload.",
        [
          {
            id: "site-coverage",
            label: "Sites in your queue",
            value: `${activeJobsites}`,
            note: "Active jobsites currently visible to this field role.",
            href: "/jobsites",
            tone: "info",
          },
          {
            id: "dap-review",
            label: "DAP review items",
            value: `${activeDaps}`,
            note: "Open JSAs/DAPs that still need a field review or completion check.",
            href: "/jsa",
            tone: activeDaps > 0 ? "warning" : "success",
          },
          {
            id: "weather",
            label: "Weather / restrictions",
            value: restrictions > 0 ? `${restrictions}` : "No live feed",
            note:
              restrictions > 0
                ? "Stop-work or restriction flags are active on current permits."
                : "Weather integration is not wired yet. Check the active permit board before kickoff.",
            href: "/jobsites",
            tone: restrictions > 0 ? "warning" : "info",
          },
          {
            id: "crews",
            label: "Crews on site",
            value: "Pending sync",
            note: "Crew roster data is not connected yet. Use jobsites and DAP activity as the current field signal.",
            href: "/jobsites",
            tone: "info",
          },
        ],
        {
          title: "Coverage and support",
          description: "Crew and weather indicators will appear here once connected.",
        }
      ),
      companyAccess: summarySection(
        "Company access",
        "The access posture and role context that shape this field workflow.",
        accessItems(data, "field_supervisor"),
        {
          title: "Company access",
          description: "Access context will appear here once account information is ready.",
        }
      ),
      trainingSignal: summarySection(
        "Training signal",
        "Training and onboarding signals that can affect field readiness.",
        trainingItems(data, "field_supervisor"),
        {
          title: "Training signal",
          description: "Training indicators will appear when the roster and invite feed are ready.",
        }
      ),
      permitFollowups: feedSection(
        "Permit follow-ups",
        "Permit restrictions, escalations, and open reviews visible to this field role.",
        risks.permitItems,
        {
          title: "No permit follow-ups",
          description: "There are no active permit restrictions or reviews visible right now.",
          actionHref: "/jobsites",
          actionLabel: "Open jobsites",
        }
      ),
      incidentFollowups: feedSection(
        "Incident follow-ups",
        "Incident items that still need a field response or completion check.",
        risks.incidentItems,
        {
          title: "No incident follow-ups",
          description: "There are no active incident follow-up items visible right now.",
          actionHref: "/incidents",
          actionLabel: "Open incidents",
        }
      ),
    }),
  };
}

export function getDefaultDashboardModel(data: DashboardDataState): DashboardViewModel {
  if (data.loading) {
    return loading("default", "Preparing workspace dashboard");
  }

  const recentDocuments = recentDocumentsItems(data);
  const recentReports = recentReportsItems(data);
  const risks = riskItems(data);
  const approvedCount = data.documents.filter(approved).length;
  const pendingCount = data.documents.filter(pending).length;

  return {
    role: "default",
    hero: {
      eyebrow: "Workspace dashboard",
      title: "Your dashboard is ready",
      description:
        "This account does not map to a specialized role dashboard yet, so the home page stays focused on safe defaults and the next obvious workspace actions.",
      actions: [
        { label: "Open library", href: "/library", variant: "primary" },
        { label: "Search records", href: "/search", variant: "secondary" },
      ],
    },
    banner: banner(data),
    blocks: buildBlocks({
      metrics: [
        metric("Needs attention now", `${pendingCount}`, "Documents currently waiting in review.", "attention"),
        metric(
          "Overdue / risky",
          `${data.workspaceSummary.observations.filter(overdue).length}`,
          "Overdue corrective-action items visible to this account."
        ),
        metric(
          "Next action",
          data.documents.length > 0 ? "Open library" : "Update profile",
          "Best next step based on what is currently available."
        ),
        metric("Recent activity", `${data.documents.length}`, "Visible records in the current workspace."),
      ],
      priorityQueue: feedSection(
        "What needs attention now",
        "Safe defaults for accounts without a dedicated role-based dashboard.",
        recentDocuments.filter((item) => item.tone !== "success").slice(0, 5),
        {
          title: "Nothing urgent in view",
          description: "This default dashboard will surface priority items here when records need attention.",
          actionHref: "/search",
          actionLabel: "Search records",
        }
      ),
      nextActions: actionSection(
        "What should this user do next",
        "Open the most useful baseline workspace tools without assuming company-wide access.",
        [
          {
            title: "Open library",
            description: "Review completed or approved records available to this account.",
            href: "/library",
            actionLabel: "Open library",
            tone: "attention",
          },
          {
            title: "Search records",
            description: "Find files, records, and pages without navigating the full menu.",
            href: "/search",
            actionLabel: "Open search",
          },
          {
            title: "Update profile",
            description: "Keep your construction profile and role details current.",
            href: "/profile",
            actionLabel: "Open profile",
          },
        ],
        {
          title: "No actions yet",
          description: "Baseline actions will appear here.",
        }
      ),
      recentActivity: feedSection(
        "Recent activity",
        "Latest records visible to this account.",
        recentDocuments,
        {
          title: "No recent activity",
          description: "Activity will appear here after your first workspace records are created or approved.",
          actionHref: "/profile",
          actionLabel: "Open profile",
        }
      ),
      recentDocuments: feedSection(
        "Recent documents",
        "Recent documents that are visible to this account.",
        recentDocuments,
        {
          title: "No recent documents",
          description: "Documents will appear here after your first record is created or shared with you.",
          actionHref: "/search",
          actionLabel: "Search records",
        }
      ),
      recentReports: feedSection(
        "Recent reports",
        "Recent reports and generated submission signals available to this account.",
        recentReports,
        {
          title: "No recent reports",
          description: "Report signals will appear here when they become available.",
          actionHref: "/search",
          actionLabel: "Search records",
        }
      ),
      riskRanking: summarySection(
        "Workspace snapshot",
        "Simple counts and access-safe signals for this account.",
        [
          {
            id: "approved-docs",
            label: "Completed documents",
            value: `${approvedCount}`,
            note: "Approved files currently visible in your workspace.",
            href: "/library",
            tone: "success",
          },
          {
            id: "in-review-docs",
            label: "Documents in review",
            value: `${pendingCount}`,
            note: "Files still in the review workflow.",
            href: "/library",
            tone: "warning",
          },
          ...genericRiskItems(data, "/search").slice(0, 1),
        ],
        {
          title: "Workspace snapshot",
          description: "Simple workspace insights will appear here.",
        }
      ),
      hazardTrends: summarySection(
        "Hazard trends",
        "Access-safe hazard and risk trend signals available to this account.",
        hazardItems(data, "/search").length > 0
          ? hazardItems(data, "/search")
          : genericRiskItems(data, "/search"),
        {
          title: "No hazard trends yet",
          description: "Hazard and risk trend signals will appear here when analytics data is available.",
          actionHref: "/search",
          actionLabel: "Search records",
        }
      ),
      supportSignals: summarySection(
        "Support and access",
        "Helpful baseline context for what this account can do next.",
        [
          {
            id: "library-access",
            label: "Completed records",
            value: `${approvedCount}`,
            note: "Approved and completed records available in your library.",
            href: "/library",
            tone: "info",
          },
          {
            id: "search",
            label: "Searchable files",
            value: `${data.documents.length}`,
            note: "Documents currently available for search and lookup.",
            href: "/search",
            tone: "success",
          },
        ],
        {
          title: "Support and access",
          description: "Support indicators will appear here when data is available.",
        }
      ),
      companyAccess: summarySection(
        "Company access",
        "Account-safe access context and profile indicators.",
        accessItems(data, "default"),
        {
          title: "Company access",
          description: "Account and access indicators will appear here when profile data is available.",
        }
      ),
      trainingSignal: summarySection(
        "Training signal",
        "Training and readiness indicators available to this account.",
        trainingItems(data, "default"),
        {
          title: "Training signal",
          description: "Training indicators will appear when invite and profile data are available.",
        }
      ),
      permitFollowups: feedSection(
        "Permit follow-ups",
        "Permit-related items visible to this account.",
        risks.permitItems,
        {
          title: "No permit follow-ups",
          description: "There are no visible permit follow-up items right now.",
          actionHref: "/search",
          actionLabel: "Search records",
        }
      ),
      incidentFollowups: feedSection(
        "Incident follow-ups",
        "Incident items visible to this account.",
        risks.incidentItems,
        {
          title: "No incident follow-ups",
          description: "There are no visible incident follow-up items right now.",
          actionHref: "/search",
          actionLabel: "Search records",
        }
      ),
    }),
  };
}
