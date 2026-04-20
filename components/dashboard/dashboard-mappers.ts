import {
  getDocumentStatusLabel,
  isApprovedDocumentStatus,
  isSubmittedDocumentStatus,
} from "@/lib/documentStatus";
import { CONTRACTOR_SAFETY_BLUEPRINT_BUILDER_LABEL } from "@/lib/safetyBlueprintLabels";
import type {
  DashboardDataState,
  DashboardDocument,
  DashboardSummaryItem,
  DashboardViewModel,
} from "@/components/dashboard/types";

const s = (v?: string | null) => (v ?? "").trim().toLowerCase();
const approved = (d: DashboardDocument) => isApprovedDocumentStatus(d.status, Boolean(d.final_file_path));
const pending = (d: DashboardDocument) => isSubmittedDocumentStatus(d.status, Boolean(d.final_file_path));
const active = (status?: string | null) => !["closed", "archived", "expired", "verified_closed"].includes(s(status));
const overdue = (row: { due_at?: string | null; status?: string | null }) =>
  Boolean(row.due_at && active(row.status) && new Date(row.due_at).getTime() < Date.now());

function rel(ts?: string | null) {
  if (!ts) return "Updated recently";
  const mins = Math.max(1, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function due(ts?: string | null) {
  if (!ts) return "No due date";
  const days = Math.ceil((new Date(ts).getTime() - Date.now()) / 86400000);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  return days === 1 ? "Due tomorrow" : `Due in ${days} days`;
}

function docTitle(d: DashboardDocument) {
  return d.document_title ?? d.project_name ?? d.file_name ?? "Untitled document";
}

function banner(data: DashboardDataState) {
  if (data.companyWorkspaceError) return { message: data.companyWorkspaceError, tone: "error" as const };
  return data.analyticsSummaryIssue ?? undefined;
}

function emptySummary(title: string, description: string) {
  return { title, description, items: [] as DashboardSummaryItem[], empty: { title: "Nothing yet", description } };
}

function jobsites(data: DashboardDataState) {
  return new Map(data.workspaceSummary.jobsites.filter((j) => j.id).map((j) => [j.id as string, j.name] as const));
}

function recentDocs(data: DashboardDataState) {
  return data.documents
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6)
    .map((d) => ({
      id: d.id,
      title: docTitle(d),
      detail: getDocumentStatusLabel(d.status, Boolean(d.final_file_path)),
      meta: rel(d.created_at),
      tone: approved(d) ? ("success" as const) : pending(d) ? ("warning" as const) : ("info" as const),
    }));
}

function reports(data: DashboardDataState) {
  return (data.analyticsSummary?.recentReports ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    detail: r.tag,
    meta: "Recent workspace submission",
    tone: r.tag === "HAZARD" || r.tag === "NEAR MISS" ? ("warning" as const) : ("info" as const),
  }));
}

function riskItems(data: DashboardDataState) {
  const names = jobsites(data);
  const overdueItems = data.workspaceSummary.observations.filter(overdue).slice(0, 3).map((row, i) => ({
    id: row.id ?? `obs-${i}`,
    title: row.title?.trim() || row.category?.trim() || "Corrective action overdue",
    detail: row.jobsite_id ? names.get(row.jobsite_id) ?? "Assigned jobsite" : "No jobsite assigned",
    meta: due(row.due_at),
    tone: "warning" as const,
  }));
  const incidentItems = data.workspaceSummary.incidents.filter((r) => active(r.status)).slice(0, 3).map((row, i) => ({
    id: row.id ?? `inc-${i}`,
    title: row.title?.trim() || "Open incident",
    detail: row.jobsite_id ? names.get(row.jobsite_id) ?? "Assigned jobsite" : "Company-wide follow-up",
    meta: row.stop_work_status === "stop_work_active" ? "Stop-work active" : row.sif_flag ? "SIF follow-up required" : "Needs follow-up",
    tone: row.stop_work_status === "stop_work_active" ? ("error" as const) : row.sif_flag ? ("warning" as const) : ("info" as const),
  }));
  const permitItems = data.workspaceSummary.permits.filter((r) => active(r.status)).slice(0, 3).map((row, i) => ({
    id: row.id ?? `permit-${i}`,
    title: row.title?.trim() || "Active permit",
    detail: row.jobsite_id ? names.get(row.jobsite_id) ?? "Assigned jobsite" : "No jobsite assigned",
    meta: row.stop_work_status === "stop_work_active" ? "Restriction in place" : row.sif_flag ? "High-risk permit" : "Permit review item",
    tone: row.stop_work_status === "stop_work_active" ? ("error" as const) : row.sif_flag ? ("warning" as const) : ("info" as const),
  }));
  return { overdueItems, incidentItems, permitItems };
}

function ranking(data: DashboardDataState): DashboardSummaryItem[] {
  const names = jobsites(data);
  return (data.analyticsSummary?.jobsiteRiskScore ?? []).slice(0, 5).map((row) => ({
    id: row.jobsiteId,
    label: names.get(row.jobsiteId) ?? "Unassigned jobsite",
    value: `${row.score}`,
    note: `${row.overdue} overdue - ${row.stopWork} stop-work - ${row.incidents} incidents`,
    href: "/jobsites",
    tone: row.score >= 10 ? ("error" as const) : row.score >= 5 ? ("warning" as const) : ("info" as const),
  }));
}

function hazards(data: DashboardDataState): DashboardSummaryItem[] {
  return (data.analyticsSummary?.topHazardCategories ?? []).slice(0, 3).map((h) => ({
    id: h.category,
    label: h.category.replace(/_/g, " "),
    value: `${h.count}`,
    note: "Recurring hazard signal in the current review window.",
    href: "/analytics",
    tone: h.count >= 5 ? ("warning" as const) : ("info" as const),
  }));
}

function loading(role: string): DashboardViewModel {
  return {
    hero: { eyebrow: "Loading dashboard", title: `Preparing ${role} workspace`, description: "Gathering current risk, backlog, and next-action signals.", actions: [] },
    metrics: [
      { title: "Attention now", value: "Loading", detail: "Pulling live workload." },
      { title: "Overdue / risk", value: "Loading", detail: "Checking open issues." },
      { title: "Next action", value: "Loading", detail: "Resolving role workflow." },
      { title: "Activity", value: "Loading", detail: "Fetching updates." },
    ],
    priority: { title: "What needs attention now", description: "Priority items will appear after loading.", items: [], empty: { title: "Nothing yet", description: "Priority items will appear after loading." } },
    nextActions: { title: "What should this user do next", description: "Recommended actions will appear after loading.", items: [], empty: { title: "Nothing yet", description: "Recommended actions will appear after loading." } },
    activity: { title: "Recent activity", description: "Recent activity will appear after loading.", items: [], empty: { title: "Nothing yet", description: "Recent activity will appear after loading." } },
    insights: { title: "Risk snapshot", description: "Insights will appear after loading.", items: [], empty: { title: "Nothing yet", description: "Insights will appear after loading." } },
    support: { title: "Coverage / support", description: "Support signals will appear after loading.", items: [], empty: { title: "Nothing yet", description: "Support signals will appear after loading." } },
  };
}

export function getCompanyAdminDashboardModel(data: DashboardDataState): DashboardViewModel {
  if (data.loading) return loading("company admin");
  const risks = riskItems(data);
  if (data.workspaceProduct === "csep") {
    const submitted = data.documents.filter(pending).length;
    const approvedCount = data.documents.filter(approved).length;
    return {
      hero: { eyebrow: "Company admin dashboard", title: `${getCompanyName(data)} CSEP workspace`, description: "This company is on the focused CSEP experience, so the dashboard stays centered on document throughput and the next builder action.", actions: [{ label: CONTRACTOR_SAFETY_BLUEPRINT_BUILDER_LABEL, href: "/csep", variant: "primary" }, { label: "Open library", href: "/library", variant: "secondary" }] },
      banner: banner(data),
      metrics: [
        { title: "In review", value: `${submitted}`, detail: "CSEP files waiting in review.", tone: "attention" },
        { title: "Approved", value: `${approvedCount}`, detail: "Completed CSEP files in the library." },
        { title: "Drafts", value: `${data.documents.length - submitted - approvedCount}`, detail: "Unsubmitted work still in progress." },
        { title: "Credits", value: data.creditBalance == null ? "Unknown" : `${data.creditBalance}`, detail: "Current credit balance." },
      ],
      priority: { title: "What needs attention now", description: "Clear anything stuck in review and keep the builder queue moving.", items: recentDocs(data).filter((i) => i.tone !== "success").slice(0, 5), empty: { title: "No CSEP items need attention", description: "The current builder queue is clear.", actionHref: "/csep", actionLabel: "Open builder" } },
      nextActions: { title: "What should this user do next", description: "Use the focused CSEP workflow instead of the broader company workspace.", items: [{ title: "Start a new CSEP", description: "Open the builder and begin the next contractor safety package.", href: "/csep", actionLabel: "Open builder", tone: "attention" }, { title: "Review completed files", description: "Open approved files and keep deliverables organized.", href: "/library", actionLabel: "Open library" }], empty: { title: "No actions yet", description: "Use the builder to start the next package." } },
      activity: { title: "Recent activity", description: "Latest document updates in the focused CSEP workspace.", items: recentDocs(data), empty: { title: "No document activity yet", description: "Your CSEP document feed will show up here after the first file is created.", actionHref: "/csep", actionLabel: "Start a CSEP" } },
      insights: { title: "Workspace snapshot", description: "A compact throughput view for the CSEP-only workspace.", items: [{ id: "documents-total", label: "Total documents", value: `${data.documents.length}`, note: "All CSEP records currently visible in the workspace.", href: "/search", tone: "info" }, { id: "queue-balance", label: "Review queue", value: `${submitted}`, note: "Documents still waiting for approval or completion.", href: "/library", tone: submitted > 0 ? "warning" : "success" }], empty: emptySummary("Workspace snapshot", "Metrics will appear once your CSEP records load.").empty },
      support: { title: "Support signals", description: "Keep an eye on company access and backlog from the focused workspace.", items: [{ id: "pending-users", label: "Pending approvals", value: `${data.companyUsers.filter((u) => u.status === "Pending").length}`, note: "Users still waiting for activation.", href: "/company-users", tone: "warning" }, { id: "inactive-users", label: "Inactive users", value: `${data.companyUsers.filter((u) => u.status === "Inactive").length}`, note: "Accounts with no recent sign-in.", href: "/company-users", tone: "info" }], empty: emptySummary("Support signals", "Support signals will appear after company access loads.").empty },
    };
  }
  const pendingApprovals = data.companyUsers.filter((u) => u.status === "Pending").length;
  return {
    hero: { eyebrow: "Company admin dashboard", title: `What needs attention across ${getCompanyName(data)}`, description: "Start with urgent approvals and overdue risk items, then move into company activity and the highest-risk jobsites.", actions: [{ label: "Open command center", href: "/command-center", variant: "primary" }, { label: "Manage company users", href: "/company-users", variant: "secondary" }] },
    banner: banner(data),
    metrics: [
      { title: "Pending approvals", value: `${pendingApprovals}`, detail: "Users and access decisions waiting now.", tone: "attention" },
      { title: "Open incidents", value: `${data.workspaceSummary.incidents.filter((r) => active(r.status)).length}`, detail: "Incident records still requiring follow-up." },
      { title: "Overdue actions", value: `${data.workspaceSummary.observations.filter(overdue).length}`, detail: "Corrective actions already past due." },
      { title: "Training expirations", value: data.companyInvites.length > 0 ? `${data.companyInvites.length}` : "Pending sync", detail: "Temporary proxy until the training expiration feed is wired." },
    ],
    priority: { title: "What needs attention now", description: "The highest-risk backlog across approvals, incidents, and overdue corrective actions.", items: [...risks.overdueItems, ...risks.incidentItems].slice(0, 6), empty: { title: "Urgent items are clear", description: "No overdue corrective actions or open incident escalations are visible right now.", actionHref: "/analytics", actionLabel: "Open analytics" } },
    nextActions: { title: "What should this user do next", description: "The fastest ways to keep company-wide work moving without extra dashboard clutter.", items: [{ title: "Review pending approvals", description: "Confirm access and unblock the workforce.", href: "/company-users", actionLabel: "Open company users", tone: "attention" }, { title: "Check overdue site risk", description: "Open jobsites and focus on the locations with the highest combined risk.", href: "/jobsites", actionLabel: "Open jobsites" }, { title: "Open executive analytics", description: "Review hazard concentration, incident trends, and closure performance.", href: "/analytics", actionLabel: "Open analytics" }, { title: "Audit training coverage", description: "Open the training matrix and resolve coverage gaps.", href: "/training-matrix", actionLabel: "Open training matrix" }], empty: { title: "No actions yet", description: "Recommended admin actions will appear here." } },
    activity: { title: "Recent workspace activity", description: "Recent submissions and company activity signals from the live workspace.", items: reports(data).length > 0 ? reports(data) : recentDocs(data), empty: { title: "No recent workspace activity", description: "Recent submissions will appear here as soon as records move through the workspace.", actionHref: "/library", actionLabel: "Open library" } },
    insights: { title: "Jobsite health ranking", description: "Highest-risk jobsites ranked by combined incident, stop-work, and overdue action signals.", items: ranking(data), empty: { title: "No jobsite health ranking yet", description: "This list will appear after jobsites and analytics data begin flowing.", actionHref: "/jobsites", actionLabel: "Open jobsites" } },
    support: { title: "Training and hazard signals", description: "Secondary context for what looks overdue or risky right now.", items: ([{ id: "pending-users", label: "Pending approvals", value: `${pendingApprovals}`, note: "Users still waiting for company activation.", href: "/company-users", tone: pendingApprovals > 0 ? ("warning" as const) : ("success" as const) }, { id: "inactive-workers", label: "Inactive workers", value: `${data.companyUsers.filter((u) => u.status === "Inactive").length}`, note: "Accounts with no recent sign-in that may need follow-up.", href: "/company-users", tone: "info" as const }, { id: "training-expirations", label: "Training expirations", value: data.companyInvites.length > 0 ? `${data.companyInvites.length}` : "Pending sync", note: "Training expiration feed is not wired yet, so open invites are shown as a temporary signal.", href: "/training-matrix", tone: data.companyInvites.length > 0 ? ("warning" as const) : ("info" as const) }, ...hazards(data)] as DashboardSummaryItem[]).slice(0, 6), empty: emptySummary("Training and hazard signals", "Support signals will appear here when data is available.").empty },
  };
}

export function getSafetyManagerDashboardModel(data: DashboardDataState): DashboardViewModel {
  if (data.loading) return loading("safety manager");
  const risks = riskItems(data);
  const reviewDocuments = data.documents.filter(pending).length;
  const permitReview = data.workspaceSummary.permits.filter((r) => active(r.status)).length;
  const incidentFollowups = data.workspaceSummary.incidents.filter((r) => active(r.status)).length;
  const overdueCount = data.workspaceSummary.observations.filter(overdue).length;
  return {
    hero: { eyebrow: "Safety manager dashboard", title: "Your review queue and follow-up workload", description: "This dashboard stays centered on what needs review now, what looks overdue or risky, and the next safety workflow to clear.", actions: [{ label: "Open permits", href: "/permits", variant: "primary" }, { label: "Review incidents", href: "/incidents", variant: "secondary" }] },
    banner: banner(data),
    metrics: [{ title: "Personal work queue", value: `${reviewDocuments + permitReview + incidentFollowups + overdueCount}`, detail: "Combined document, permit, incident, and overdue follow-ups.", tone: "attention" }, { title: "Docs needing review", value: `${reviewDocuments}`, detail: "Submitted files still waiting on review." }, { title: "Permit review items", value: `${permitReview}`, detail: "Active permits still open across current jobsites." }, { title: "Incident follow-ups", value: `${incidentFollowups}`, detail: "Open incidents still requiring response or closure." }],
    priority: { title: "What needs attention now", description: "Highest-priority review items and overdue follow-ups in the safety queue.", items: [...risks.overdueItems, ...risks.permitItems, ...risks.incidentItems].slice(0, 6), empty: { title: "Your priority queue is clear", description: "No overdue corrective actions, permit escalations, or open incidents are visible right now.", actionHref: "/command-center", actionLabel: "Open command center" } },
    nextActions: { title: "What should this user do next", description: "Start with the queue that clears the most risk and then move into recurring review work.", items: [{ title: "Review documents in queue", description: "Open in-review files and keep approvals moving for the field.", href: "/library", actionLabel: "Open library", tone: "attention" }, { title: "Work permit review items", description: "Clear active permits and check for stop-work or SIF escalation flags.", href: "/permits", actionLabel: "Open permits" }, { title: "Follow up on incidents", description: "Complete incident response items and keep leadership informed.", href: "/incidents", actionLabel: "Open incidents" }, { title: "Close training gaps", description: "Open the training matrix and resolve gaps before the next shift or audit cycle.", href: "/training-matrix", actionLabel: "Open training matrix" }], empty: { title: "No actions yet", description: "Recommended safety-manager actions will appear here." } },
    activity: { title: "Recent submissions", description: "Latest documents and submission activity that may need a safety review.", items: recentDocs(data).filter((i) => i.tone !== "success").slice(0, 6), empty: { title: "No recent submissions", description: "Recent document or report submissions will show up here as they land.", actionHref: "/library", actionLabel: "Open library" } },
    insights: { title: "Risk and review signals", description: "A compact snapshot of where this safety role should concentrate next.", items: ([...hazards(data), { id: "overdue-audits", label: "Overdue audits", value: overdueCount > 0 ? `${overdueCount}` : "Pending sync", note: overdueCount > 0 ? "Overdue corrective actions currently visible in the company workspace." : "Audit due dates are not connected yet.", href: "/reports", tone: overdueCount > 0 ? ("warning" as const) : ("info" as const) }] as DashboardSummaryItem[]).slice(0, 5), empty: emptySummary("Risk and review signals", "Insights will appear when analytics data is available.").empty },
    support: { title: "Coverage gaps and support", description: "Secondary signals to help prioritize the next operational step.", items: ([{ id: "review-documents", label: "Documents needing review", value: `${reviewDocuments}`, note: "Items in review that need a decision or follow-up.", href: "/library", tone: reviewDocuments > 0 ? ("warning" as const) : ("success" as const) }, { id: "training-gaps", label: "Training gaps", value: data.companyInvites.length > 0 ? `${data.companyInvites.length}` : "Pending sync", note: "Temporary proxy signal based on unresolved company invites and onboarding backlog.", href: "/training-matrix", tone: data.companyInvites.length > 0 ? ("warning" as const) : ("info" as const) }, { id: "permit-followups", label: "Permit follow-ups", value: `${permitReview + incidentFollowups}`, note: "Combined permit and incident follow-up items still open across assigned work.", href: "/permits", tone: permitReview + incidentFollowups > 0 ? ("warning" as const) : ("success" as const) }] as DashboardSummaryItem[]), empty: emptySummary("Coverage gaps and support", "Support indicators will appear here when the workspace finishes loading.").empty },
  };
}

export function getFieldSupervisorDashboardModel(data: DashboardDataState): DashboardViewModel {
  if (data.loading) return loading("field supervisor");
  const risks = riskItems(data);
  const activeJobsites = data.workspaceSummary.jobsites.filter((j) => !["archived", "completed", "inactive"].includes(s(j.status))).length;
  const restrictions = data.workspaceSummary.permits.filter((r) => r.stop_work_status === "stop_work_active" || r.sif_flag).length;
  return {
    hero: { eyebrow: "Field supervisor dashboard", title: "Today's site status and next field actions", description: "The top of this dashboard stays focused on active site conditions, open observations, permit restrictions, and the fastest next action for the field.", actions: [{ label: "Open jobsites", href: "/jobsites", variant: "primary" }, { label: "Review DAPs", href: "/jsa", variant: "secondary" }] },
    banner: banner(data),
    metrics: [{ title: "Today's site status", value: restrictions > 0 ? "Needs review" : activeJobsites > 0 ? "Ready" : "No active sites", detail: "Live field summary across your assigned jobsites.", tone: restrictions > 0 ? "attention" : "elevated" }, { title: "Active permits", value: `${data.workspaceSummary.permits.filter((r) => active(r.status)).length}`, detail: "Permits currently active across visible sites." }, { title: "Open observations", value: `${data.workspaceSummary.observations.filter((r) => active(r.status)).length}`, detail: "Open observation and corrective-action items in the field queue." }, { title: "Weather / restrictions", value: restrictions > 0 ? `${restrictions}` : "No live feed", detail: restrictions > 0 ? "Restriction or high-risk permit signals are active." : "Weather integration is not wired yet." }],
    priority: { title: "What needs attention now", description: "Field-facing items that could block work, create risk, or need a same-day response.", items: [...risks.permitItems, ...risks.overdueItems, ...risks.incidentItems].slice(0, 6), empty: { title: "Field queue is clear", description: "No active permit restrictions, overdue corrective actions, or incident escalations are visible right now.", actionHref: "/jobsites", actionLabel: "Open jobsites" } },
    nextActions: { title: "What should this user do next", description: "Move directly into the next field workflow without digging through the full navigation.", items: [{ title: "Start walk", description: "Open assigned jobsites and begin the next field walk or site check.", href: "/jobsites", actionLabel: "Open jobsites", tone: "attention" }, { title: "Report observation", description: "Capture a new field observation or issue from the exchange workflow.", href: "/field-id-exchange", actionLabel: "Open exchange" }, { title: "Open permit board", description: "Review active permits and confirm there are no open restrictions before work starts.", href: "/jobsites", actionLabel: "View permit board" }, { title: "Review DAPs", description: "Open JSAs/DAPs and clear the next activity package for the site.", href: "/jsa", actionLabel: "Open DAP review" }], empty: { title: "No actions yet", description: "Recommended field actions will appear here." } },
    activity: { title: "Recent field activity", description: "Live permit, observation, and submission movement relevant to today's field work.", items: [...risks.permitItems, ...reports(data)].slice(0, 6), empty: { title: "No recent field activity", description: "Field activity will appear once permits, reports, or observations start moving.", actionHref: "/jobsites", actionLabel: "Open jobsites" } },
    insights: { title: "Site risk snapshot", description: "A compact view of which jobsites and field items need the most attention.", items: [...ranking(data).slice(0, 3), { id: "open-daps", label: "Open DAP review", value: `${data.workspaceSummary.daps.filter((r) => active(r.status)).length}`, note: "Open DAPs/JSAs still needing a field review or completion check.", href: "/jsa", tone: "warning" }], empty: emptySummary("Site risk snapshot", "The site ranking will appear after jobsite and analytics data load.").empty },
    support: { title: "Coverage and support", description: "Helpful context for crews, weather, and assigned site workload.", items: [{ id: "site-coverage", label: "Sites in your queue", value: `${activeJobsites}`, note: "Active jobsites currently visible to this field role.", href: "/jobsites", tone: "info" }, { id: "dap-review", label: "DAP review items", value: `${data.workspaceSummary.daps.filter((r) => active(r.status)).length}`, note: "Open JSAs/DAPs that still need a field review or completion check.", href: "/jsa", tone: "warning" }, { id: "weather", label: "Weather / restrictions", value: restrictions > 0 ? `${restrictions}` : "No live feed", note: restrictions > 0 ? "Stop-work or restriction flags are active on current permits." : "Weather integration is not wired yet. Check the active permit board before kickoff.", href: "/jobsites", tone: restrictions > 0 ? "warning" : "info" }, { id: "crews", label: "Crews on site", value: "Pending sync", note: "Crew roster data is not connected yet. Use jobsites and DAP activity as the current field signal.", href: "/jobsites", tone: "info" }], empty: emptySummary("Coverage and support", "Crew and weather indicators will appear here once connected.").empty },
  };
}

export function getDefaultDashboardModel(data: DashboardDataState): DashboardViewModel {
  if (data.loading) return loading("default");
  return {
    hero: { eyebrow: "Workspace dashboard", title: "Your dashboard is ready", description: "This account does not map to a specialized role dashboard yet, so the home page stays focused on safe defaults and the next obvious workspace actions.", actions: [{ label: "Open library", href: "/library", variant: "primary" }, { label: "Search records", href: "/search", variant: "secondary" }] },
    banner: banner(data),
    metrics: [{ title: "Needs attention now", value: `${data.documents.filter(pending).length}`, detail: "Documents currently waiting in review.", tone: "attention" }, { title: "Overdue / risky", value: `${data.workspaceSummary.observations.filter(overdue).length}`, detail: "Overdue corrective-action items visible to this account." }, { title: "Next action", value: data.documents.length > 0 ? "Open library" : "Update profile", detail: "Best next step based on what is currently available." }, { title: "Recent activity", value: `${data.documents.length}`, detail: "Visible records in the current workspace." }],
    priority: { title: "What needs attention now", description: "Safe defaults for accounts without a dedicated role-based dashboard.", items: recentDocs(data).filter((i) => i.tone !== "success").slice(0, 5), empty: { title: "Nothing urgent in view", description: "This default dashboard will surface priority items here when records need attention.", actionHref: "/search", actionLabel: "Search records" } },
    nextActions: { title: "What should this user do next", description: "Open the most useful baseline workspace tools without assuming company-wide access.", items: [{ title: "Open library", description: "Review completed or approved records available to this account.", href: "/library", actionLabel: "Open library", tone: "attention" }, { title: "Search records", description: "Find files, records, and pages without navigating the full menu.", href: "/search", actionLabel: "Open search" }, { title: "Update profile", description: "Keep your construction profile and role details current.", href: "/profile", actionLabel: "Open profile" }], empty: { title: "No actions yet", description: "Baseline actions will appear here." } },
    activity: { title: "Recent activity", description: "Latest records visible to this account.", items: recentDocs(data), empty: { title: "No recent activity", description: "Activity will appear here after your first workspace records are created or approved.", actionHref: "/profile", actionLabel: "Open profile" } },
    insights: { title: "Workspace snapshot", description: "Simple counts and access-safe signals for this account.", items: [{ id: "approved-docs", label: "Completed documents", value: `${data.documents.filter(approved).length}`, note: "Approved files currently visible in your workspace.", href: "/library", tone: "success" }, { id: "in-review-docs", label: "Documents in review", value: `${data.documents.filter(pending).length}`, note: "Files still in the review workflow.", href: "/library", tone: "warning" }], empty: emptySummary("Workspace snapshot", "Simple workspace insights will appear here.").empty },
    support: { title: "Support and access", description: "Helpful baseline context for what this account can do next.", items: [{ id: "library-access", label: "Completed records", value: `${data.documents.filter(approved).length}`, note: "Approved and completed records available in your library.", href: "/library", tone: "info" }, { id: "search", label: "Searchable files", value: `${data.documents.length}`, note: "Documents currently available for search and lookup.", href: "/search", tone: "success" }], empty: emptySummary("Support and access", "Support indicators will appear here when data is available.").empty },
  };
}

function getCompanyName(data: DashboardDataState) {
  return data.companyProfile?.name?.trim() || data.userTeam || "your company";
}
