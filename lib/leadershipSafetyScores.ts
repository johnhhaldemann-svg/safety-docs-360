import { isAdminRole, normalizeAppRole } from "@/lib/rbac";

export type LeadershipSafetyRole =
  | "company_admin"
  | "manager"
  | "safety_manager"
  | "project_manager"
  | "field_supervisor"
  | "foreman";

export type LeadershipSafetySignal = {
  label: string;
  detail: string;
  points: number;
  count?: number;
};

export type LeadershipSafetyEvidenceRef = {
  id: string;
  label: string;
  href: string;
  sourceModule: string;
  sourceId?: string | null;
  detail?: string;
};

export type LeadershipSafetyScore = {
  companyId: string;
  userId: string;
  role: LeadershipSafetyRole;
  windowStart: string;
  windowEnd: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  trend: number;
  lastScoredAt: string;
  positiveSignals: LeadershipSafetySignal[];
  negativeSignals: LeadershipSafetySignal[];
  evidenceRefs: LeadershipSafetyEvidenceRef[];
};

export type LeadershipScoreLeader = {
  userId: string;
  role: string;
  name?: string | null;
  email?: string | null;
};

export type LeadershipScoreAssignment = {
  user_id?: string | null;
  jobsite_id?: string | null;
  role?: string | null;
};

export type LeadershipScoreRows = {
  incidents?: Array<Record<string, unknown>>;
  permits?: Array<Record<string, unknown>>;
  jsas?: Array<Record<string, unknown>>;
  jsaActivities?: Array<Record<string, unknown>>;
  correctiveActions?: Array<Record<string, unknown>>;
  recommendations?: Array<Record<string, unknown>>;
  behaviorEvents?: Array<Record<string, unknown>>;
};

export const LEADERSHIP_SAFETY_ROLES: LeadershipSafetyRole[] = [
  "company_admin",
  "manager",
  "safety_manager",
  "project_manager",
  "field_supervisor",
  "foreman",
];

const COMPANY_WIDE_ROLES = new Set<LeadershipSafetyRole>([
  "company_admin",
  "manager",
  "safety_manager",
]);

const FIELD_SCOPED_ROLES = new Set<LeadershipSafetyRole>([
  "project_manager",
  "field_supervisor",
  "foreman",
]);

function text(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" ? value.trim() : "";
}

function bool(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return value === true || value === "true" || value === 1;
}

function dateMs(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function hasDate(value: unknown) {
  return dateMs(value) != null;
}

function normalizeStatus(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeSeverity(value: unknown) {
  const severity = String(value ?? "").trim().toLowerCase();
  if (severity === "critical" || severity === "high" || severity === "medium" || severity === "low") {
    return severity;
  }
  return "medium";
}

function severityPoints(severity: string) {
  if (severity === "critical") return 14;
  if (severity === "high") return 9;
  if (severity === "medium") return 5;
  return 2;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function gradeForLeadershipScore(score: number): LeadershipSafetyScore["grade"] {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function isLeadershipSafetyRole(role: string | null | undefined): role is LeadershipSafetyRole {
  return LEADERSHIP_SAFETY_ROLES.includes(normalizeAppRole(role) as LeadershipSafetyRole);
}

export function leaderScopeForAssignments(
  leader: { userId: string; role: LeadershipSafetyRole },
  assignments: LeadershipScoreAssignment[],
  allJobsiteIds: string[]
) {
  if (COMPANY_WIDE_ROLES.has(leader.role)) {
    return { companyWide: true, jobsiteIds: allJobsiteIds };
  }
  const jobsiteIds = assignments
    .filter((assignment) => assignment.user_id === leader.userId)
    .map((assignment) => assignment.jobsite_id ?? "")
    .filter(Boolean);
  return { companyWide: false, jobsiteIds: Array.from(new Set(jobsiteIds)) };
}

export function canViewLeadershipSafetyScore(params: {
  viewerRole: string;
  viewerUserId: string;
  targetUserId: string;
  targetRole: string;
  viewerJobsiteIds?: string[];
  targetJobsiteIds?: string[];
}) {
  if (params.viewerUserId === params.targetUserId) return true;
  const viewerRole = normalizeAppRole(params.viewerRole);
  const targetRole = normalizeAppRole(params.targetRole);
  if (isAdminRole(viewerRole) || viewerRole === "company_admin" || viewerRole === "manager") return true;
  if (viewerRole === "safety_manager") {
    return targetRole === "project_manager" || targetRole === "field_supervisor" || targetRole === "foreman";
  }
  const overlaps =
    (params.viewerJobsiteIds ?? []).length === 0 ||
    (params.targetJobsiteIds ?? []).some((jobsiteId) => (params.viewerJobsiteIds ?? []).includes(jobsiteId));
  if (viewerRole === "project_manager") {
    return overlaps && (targetRole === "field_supervisor" || targetRole === "foreman");
  }
  if (viewerRole === "field_supervisor") {
    return overlaps && targetRole === "foreman";
  }
  return false;
}

function scopedRows(rows: Array<Record<string, unknown>>, jobsiteIds: string[], companyWide: boolean) {
  if (companyWide) return rows;
  const allowed = new Set(jobsiteIds);
  return rows.filter((row) => {
    const jobsiteId = text(row, "jobsite_id");
    return jobsiteId && allowed.has(jobsiteId);
  });
}

function pushSignal(
  signals: LeadershipSafetySignal[],
  label: string,
  detail: string,
  points: number,
  count?: number
) {
  signals.push({ label, detail, points, ...(count != null ? { count } : {}) });
}

function evidence(
  refs: LeadershipSafetyEvidenceRef[],
  row: Record<string, unknown>,
  sourceModule: string,
  label: string,
  href: string,
  detail?: string
) {
  const id = text(row, "id");
  if (!id || refs.some((ref) => ref.sourceModule === sourceModule && ref.sourceId === id)) return;
  refs.push({ id: `${sourceModule}-${id}`, sourceModule, sourceId: id, label, href, detail });
}

function title(row: Record<string, unknown>, fallback: string) {
  return text(row, "title") || text(row, "task_name") || text(row, "recommended_action") || fallback;
}

export function buildLeadershipSafetyScore(params: {
  companyId: string;
  leader: LeadershipScoreLeader & { role: LeadershipSafetyRole };
  assignments: LeadershipScoreAssignment[];
  allJobsiteIds: string[];
  rows: LeadershipScoreRows;
  windowStart: string;
  windowEnd: string;
  previousScore?: number | null;
  now?: string;
}) {
  const scope = leaderScopeForAssignments(params.leader, params.assignments, params.allJobsiteIds);
  const positives: LeadershipSafetySignal[] = [];
  const negatives: LeadershipSafetySignal[] = [];
  const evidenceRefs: LeadershipSafetyEvidenceRef[] = [];
  let delta = 0;

  if (!scope.companyWide && scope.jobsiteIds.length === 0) {
    pushSignal(negatives, "No assigned jobsites", "This leadership role has no assigned jobsites to verify.", -8);
    delta -= 8;
  }

  const incidents = scopedRows(params.rows.incidents ?? [], scope.jobsiteIds, scope.companyWide);
  const injuryIncidents = incidents.filter((row) => {
    const injuryType = text(row, "injury_type");
    const category = text(row, "category").toLowerCase();
    return bool(row, "recordable") || Boolean(injuryType) || category.includes("incident");
  });
  if (injuryIncidents.length > 0) {
    const penalty = injuryIncidents.reduce((total, row) => {
      const severity = normalizeSeverity(row.severity);
      let p = severityPoints(severity);
      if (bool(row, "recordable")) p += 5;
      if (bool(row, "sif_flag") || String(row.escalation_level ?? "").toLowerCase() === "critical") p += 6;
      const status = normalizeStatus(row.status);
      if (status.includes("closed") || status.includes("complete")) p -= 3;
      evidence(evidenceRefs, row, "incidents", title(row, "Injury or incident"), "/incidents", `Severity: ${severity}`);
      return total + Math.max(3, p);
    }, 0);
    const cappedPenalty = Math.min(28, penalty);
    pushSignal(
      negatives,
      "Assigned job injury exposure",
      "Injuries or recordable incidents were logged on assigned work. Prompt investigation and verified controls reduce the impact.",
      -cappedPenalty,
      injuryIncidents.length
    );
    delta -= cappedPenalty;
  }

  const permits = scopedRows(params.rows.permits ?? [], scope.jobsiteIds, scope.companyWide);
  const closedPermits = permits.filter((row) => normalizeStatus(row.status) === "closed");
  const stalePermits = permits.filter((row) => {
    const status = normalizeStatus(row.status);
    const dueMs = dateMs(row.due_at);
    return status === "expired" || (status !== "closed" && dueMs != null && dueMs < Date.now());
  });
  const unownedPermits = permits.filter((row) => !text(row, "owner_user_id"));
  const stopWorkOpen = permits.filter((row) => {
    const status = normalizeStatus(row.stop_work_status);
    return status === "stop_work_active" || status === "stop_work_requested";
  });
  if (closedPermits.length > 0) {
    const points = Math.min(10, closedPermits.length * 2);
    pushSignal(positives, "Permit closure discipline", "Permits were closed or completed in the selected window.", points, closedPermits.length);
    delta += points;
  }
  const permitPenalty = Math.min(24, stalePermits.length * 5 + unownedPermits.length * 2 + stopWorkOpen.length * 5);
  if (permitPenalty > 0) {
    pushSignal(negatives, "Permit follow-through gaps", "Expired, overdue, unowned, or unresolved stop-work permits remain on assigned work.", -permitPenalty, stalePermits.length + unownedPermits.length + stopWorkOpen.length);
    delta -= permitPenalty;
    for (const row of [...stalePermits, ...stopWorkOpen].slice(0, 4)) {
      evidence(evidenceRefs, row, "permits", title(row, "Permit follow-through gap"), "/permits", `Status: ${text(row, "status") || "open"}`);
    }
  }

  const jsas = scopedRows(params.rows.jsas ?? [], scope.jobsiteIds, scope.companyWide);
  const closedJsas = jsas.filter((row) => normalizeStatus(row.status) === "closed");
  const activeJsas = jsas.filter((row) => ["active", "submitted"].includes(normalizeStatus(row.status)));
  const staleDraftJsas = jsas.filter((row) => {
    const status = normalizeStatus(row.status);
    const created = dateMs(row.created_at);
    return status === "draft" && created != null && Date.now() - created > 3 * 24 * 60 * 60 * 1000;
  });
  const thinJsas = jsas.filter((row) => {
    const description = text(row, "description");
    return description.length > 0 && description.length < 30;
  });
  if (closedJsas.length + activeJsas.length > 0) {
    const points = Math.min(12, closedJsas.length * 3 + activeJsas.length);
    pushSignal(positives, "JSA process discipline", "JSAs are active, submitted, or closed for assigned work.", points, closedJsas.length + activeJsas.length);
    delta += points;
  }
  const jsaPenalty = Math.min(24, staleDraftJsas.length * 5 + thinJsas.length * 4);
  if (jsaPenalty > 0) {
    pushSignal(negatives, "JSA quality or closure gaps", "Draft, stale, thin, or poorly completed JSAs reduce confidence in pre-task planning.", -jsaPenalty, staleDraftJsas.length + thinJsas.length);
    delta -= jsaPenalty;
    for (const row of [...staleDraftJsas, ...thinJsas].slice(0, 4)) {
      evidence(evidenceRefs, row, "jsas", title(row, "JSA quality gap"), "/jsa", `Status: ${text(row, "status") || "draft"}`);
    }
  }

  const jsaActivities = scopedRows(params.rows.jsaActivities ?? [], scope.jobsiteIds, scope.companyWide);
  const weakActivities = jsaActivities.filter((row) => {
    const mitigation = text(row, "mitigation").toLowerCase();
    const needsPermit = row.permit_required === true || row.permit_required === "true";
    return mitigation.length < 20 || (needsPermit && !text(row, "permit_type"));
  });
  if (weakActivities.length > 0) {
    const penalty = Math.min(18, weakActivities.length * 4);
    pushSignal(negatives, "Task control gaps", "JSA steps are missing specific controls or permit detail.", -penalty, weakActivities.length);
    delta -= penalty;
  }

  const actions = scopedRows(params.rows.correctiveActions ?? [], scope.jobsiteIds, scope.companyWide);
  const closedActions = actions.filter((row) => normalizeStatus(row.status) === "verified_closed" || hasDate(row.closed_at));
  const overdueActions = actions.filter((row) => {
    const dueMs = dateMs(row.due_at);
    const status = normalizeStatus(row.status);
    return dueMs != null && dueMs < Date.now() && status !== "verified_closed" && !hasDate(row.closed_at);
  });
  if (closedActions.length > 0) {
    const points = Math.min(14, closedActions.length * 3);
    pushSignal(positives, "Corrective action follow-through", "Corrective actions were verified or closed in the selected window.", points, closedActions.length);
    delta += points;
  }
  if (overdueActions.length > 0) {
    const penalty = Math.min(24, overdueActions.length * 5);
    pushSignal(negatives, "Overdue corrective actions", "Open corrective actions are past due on assigned work.", -penalty, overdueActions.length);
    delta -= penalty;
    for (const row of overdueActions.slice(0, 4)) {
      evidence(evidenceRefs, row, "corrective_actions", title(row, "Overdue corrective action"), "/field-id-exchange", `Due: ${text(row, "due_at") || "past due"}`);
    }
  }

  const recommendations = scopedRows(params.rows.recommendations ?? [], scope.jobsiteIds, scope.companyWide);
  const activeHighConfidence = recommendations.filter((row) => !bool(row, "dismissed") && Number(row.confidence ?? 0) >= 0.7);
  const dismissedHighConfidence = recommendations.filter((row) => bool(row, "dismissed") && Number(row.confidence ?? 0) >= 0.7);
  if (activeHighConfidence.length > 0) {
    const points = Math.min(8, activeHighConfidence.length * 2);
    pushSignal(positives, "AI risk recommendations available", "High-confidence Risk Memory recommendations are visible for leadership triage.", points, activeHighConfidence.length);
    delta += points;
  }
  if (dismissedHighConfidence.length > 0) {
    const penalty = Math.min(10, dismissedHighConfidence.length * 3);
    pushSignal(negatives, "High-confidence AI recommendations dismissed", "High-confidence recommendations were dismissed and should be reviewed for context.", -penalty, dismissedHighConfidence.length);
    delta -= penalty;
  }

  const behaviorEvents = scopedRows(params.rows.behaviorEvents ?? [], scope.jobsiteIds, scope.companyWide).filter((row) => {
    const supervisorId = text(row, "supervisor_id");
    return !supervisorId || supervisorId === params.leader.userId;
  });
  const openBehaviorEvents = behaviorEvents.filter((row) => normalizeStatus(row.status) === "open");
  const resolvedBehaviorEvents = behaviorEvents.filter((row) => normalizeStatus(row.status) === "resolved");
  if (resolvedBehaviorEvents.length > 0) {
    const points = Math.min(8, resolvedBehaviorEvents.length * 2);
    pushSignal(positives, "Behavior-risk follow-through", "Behavior-risk events were resolved in the selected window.", points, resolvedBehaviorEvents.length);
    delta += points;
  }
  if (openBehaviorEvents.length > 0) {
    const priorityDrivers = new Set(["missing_supervisor_verification", "training_gap", "permit_mismatch", "open_corrective_action"]);
    const penalty = Math.min(
      22,
      openBehaviorEvents.reduce((total, row) => {
        const driver = text(row, "risk_driver");
        return total + (priorityDrivers.has(driver) ? 5 : 3);
      }, 0)
    );
    pushSignal(negatives, "Open behavior-risk signals", "Supervisor verification, training, permit, or corrective-action behavior-risk signals remain open.", -penalty, openBehaviorEvents.length);
    delta -= penalty;
    for (const row of openBehaviorEvents.slice(0, 4)) {
      evidence(evidenceRefs, row, "behavior_risk", title(row, "Behavior-risk signal"), "/analytics/predictive-model", text(row, "risk_driver"));
    }
  }

  if (positives.length === 0 && negatives.length === 0) {
    pushSignal(positives, "No elevated leadership gaps found", "No scored negative signals were found in this window.", 4);
    delta += 4;
  }

  const rawScore = 82 + delta;
  const score = clampScore(rawScore);
  return {
    companyId: params.companyId,
    userId: params.leader.userId,
    role: params.leader.role,
    windowStart: params.windowStart,
    windowEnd: params.windowEnd,
    score,
    grade: gradeForLeadershipScore(score),
    trend: params.previousScore == null ? 0 : score - params.previousScore,
    lastScoredAt: params.now ?? new Date().toISOString(),
    positiveSignals: positives.sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 6),
    negativeSignals: negatives.sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 6),
    evidenceRefs: evidenceRefs.slice(0, 10),
  } satisfies LeadershipSafetyScore;
}

export function buildLeadershipSafetyScores(params: {
  companyId: string;
  leaders: LeadershipScoreLeader[];
  assignments: LeadershipScoreAssignment[];
  allJobsiteIds: string[];
  rows: LeadershipScoreRows;
  windowStart: string;
  windowEnd: string;
  previousScoresByUserId?: Record<string, number | null>;
  now?: string;
}) {
  return params.leaders
    .map((leader) => ({ ...leader, role: normalizeAppRole(leader.role) }))
    .filter((leader): leader is LeadershipScoreLeader & { role: LeadershipSafetyRole } =>
      isLeadershipSafetyRole(leader.role)
    )
    .map((leader) =>
      buildLeadershipSafetyScore({
        companyId: params.companyId,
        leader,
        assignments: params.assignments,
        allJobsiteIds: params.allJobsiteIds,
        rows: params.rows,
        windowStart: params.windowStart,
        windowEnd: params.windowEnd,
        previousScore: params.previousScoresByUserId?.[leader.userId] ?? null,
        now: params.now,
      })
    );
}
