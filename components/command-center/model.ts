export type WorkspaceRow = Record<string, unknown>;

export type WorkspaceSummary = {
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
