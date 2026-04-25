export type WorkspaceRow = Record<string, unknown>;

export type WorkspaceSummary = {
  jobsites?: WorkspaceRow[];
  observations?: WorkspaceRow[];
  daps?: WorkspaceRow[];
  permits?: WorkspaceRow[];
  incidents?: WorkspaceRow[];
  reports?: WorkspaceRow[];
  error?: string;
};

export type CommandCenterNotice = {
  tone: "neutral" | "warning" | "error";
  message: string;
};

export type WorkflowRail = {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  tone: "neutral" | "warning" | "info";
};

function str(value: unknown) {
  return String(value ?? "").trim();
}

function isObservationOpen(row: WorkspaceRow) {
  return str(row.status).toLowerCase() !== "verified_closed";
}

function isIncidentOpen(row: WorkspaceRow) {
  return str(row.status).toLowerCase() !== "closed";
}

function isPermitActive(row: WorkspaceRow) {
  return str(row.status).toLowerCase() === "active";
}

function permitStopWork(row: WorkspaceRow) {
  const status = str(row.stop_work_status);
  return status === "stop_work_active" || status === "stop_work_requested";
}

function isJsaInFlight(row: WorkspaceRow) {
  const status = str(row.status).toLowerCase();
  if (!status) return false;
  return status !== "completed" && status !== "archived";
}

function isReportDraftish(row: WorkspaceRow) {
  const status = str(row.status).toLowerCase();
  if (!status) return false;
  return status !== "published" && status !== "final";
}

function isOverdueObservation(row: WorkspaceRow) {
  if (!isObservationOpen(row)) return false;
  const due = str(row.due_at);
  if (!due) return false;
  const time = Date.parse(due);
  return Number.isFinite(time) && time < Date.now();
}

export function summarizeOpenWork(workspace: WorkspaceSummary | null) {
  const observations = workspace?.observations ?? [];
  const incidents = workspace?.incidents ?? [];
  const permits = workspace?.permits ?? [];
  const daps = workspace?.daps ?? [];
  const reports = workspace?.reports ?? [];

  return {
    openObservations: observations.filter(isObservationOpen).length,
    overdueObservations: observations.filter(isOverdueObservation).length,
    openIncidents: incidents.filter(isIncidentOpen).length,
    activePermits: permits.filter(isPermitActive).length,
    stopWorkPermits: permits.filter(permitStopWork).length,
    openJsas: daps.filter(isJsaInFlight).length,
    openReports: reports.filter(isReportDraftish).length,
  };
}

export function buildCommandCenterNotices(params: {
  warning?: string | null;
  analyticsError?: string | null;
  workspaceError?: string | null;
}): CommandCenterNotice[] {
  const notices: CommandCenterNotice[] = [];
  if (params.warning) {
    notices.push({ tone: "neutral", message: params.warning });
  }
  if (params.analyticsError) {
    notices.push({ tone: "error", message: params.analyticsError });
  }
  if (params.workspaceError) {
    notices.push({ tone: "warning", message: params.workspaceError });
  }
  return notices;
}

export function getRiskMemoryEmptyMessage(loading: boolean) {
  return loading
    ? "Loading Risk Memory..."
    : "Risk Memory is not available for this account or window.";
}

export function getRecommendationsEmptyMessage(count: number) {
  return count > 0 ? null : "No active recommendations yet. They appear as Risk Memory and other AI workflows generate them.";
}

export function buildSafetyManagerWorkflowRails(summary: ReturnType<typeof summarizeOpenWork>): WorkflowRail[] {
  const submissionTone =
    summary.openJsas > 0 || summary.activePermits > 0 || summary.openReports > 0 ? "warning" : "info";
  const readinessTone = summary.overdueObservations > 0 ? "warning" : "info";
  const complianceTone = summary.stopWorkPermits > 0 || summary.openObservations > 0 ? "warning" : "neutral";

  return [
    {
      title: "Start a jobsite",
      description:
        summary.openObservations > 0
          ? `${summary.openObservations} open issue${summary.openObservations === 1 ? "" : "s"} should be reviewed before new scopes mobilize.`
          : "Open the active jobsite list and launch the next project-scoped workspace from one place.",
      href: "/jobsites",
      actionLabel: "Open jobsites",
      tone: summary.openObservations > 0 ? "warning" : "info",
    },
    {
      title: "Prepare a submission",
      description:
        summary.openJsas > 0 || summary.openReports > 0
          ? `${summary.openJsas} JSA${summary.openJsas === 1 ? "" : "s"} and ${summary.openReports} report draft${summary.openReports === 1 ? "" : "s"} are already in flight.`
          : "Launch document preparation, gather source files, and move the next package toward review.",
      href: "/submit",
      actionLabel: "Submit package",
      tone: submissionTone,
    },
    {
      title: "Verify worker readiness",
      description:
        summary.overdueObservations > 0
          ? `${summary.overdueObservations} overdue issue${summary.overdueObservations === 1 ? "" : "s"} may block clean worker readiness.`
          : "Use training and profile readiness to confirm the right people are clear for site access.",
      href: "/training-matrix",
      actionLabel: "Review gaps",
      tone: readinessTone,
    },
    {
      title: "Resolve a compliance gap",
      description:
        summary.stopWorkPermits > 0
          ? `${summary.stopWorkPermits} permit${summary.stopWorkPermits === 1 ? "" : "s"} include stop-work status and need immediate follow-up.`
          : "Review open issues, permits, and incidents that still need human closure before work can move forward.",
      href: summary.stopWorkPermits > 0 ? "/permits" : "/field-id-exchange",
      actionLabel: summary.stopWorkPermits > 0 ? "Review permits" : "Resolve issues",
      tone: complianceTone,
    },
  ];
}
