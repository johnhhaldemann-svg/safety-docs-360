export type WorkforceReadiness = "healthy" | "needs_attention" | "blocked";

export type WorkforceUserLike = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

export type WorkforceInviteLike = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at?: string | null;
};

export type WorkforceTrackedEmployeeLike = {
  id: string;
  full_name: string;
  email?: string | null;
  readiness_status?: string | null;
  status?: string | null;
  jobsiteAssignments?: Array<{ jobsite_id?: string | null; status?: string | null }>;
};

export type WorkforceActionKind =
  | "approve"
  | "assign_jobsites"
  | "assign_tracked_jobsites"
  | "copy_invite"
  | "resolve_training"
  | "review_suspended"
  | "review_audit";

export type WorkforceActionItem = {
  id: string;
  kind: WorkforceActionKind;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  targetTab: "overview" | "access" | "users" | "training" | "audit";
  userId?: string;
  inviteId?: string;
  employeeId?: string;
};

export type WorkspaceLoadState = {
  loading: boolean;
  criticalErrors: string[];
  warnings: string[];
};

export type WorkforceCommandCenterInput<
  TUser extends WorkforceUserLike = WorkforceUserLike,
  TInvite extends WorkforceInviteLike = WorkforceInviteLike,
  TTrackedEmployee extends WorkforceTrackedEmployeeLike = WorkforceTrackedEmployeeLike,
> = {
  users: TUser[];
  invites: TInvite[];
  trackedEmployees: TTrackedEmployee[];
  assignmentMap: Record<string, string[]>;
  activeJobsiteCount: number;
  dataRequestReviewCount: number;
  loadState: WorkspaceLoadState;
  nowMs?: number;
};

export type WorkforceCommandCenter<
  TUser extends WorkforceUserLike = WorkforceUserLike,
  TInvite extends WorkforceInviteLike = WorkforceInviteLike,
  TTrackedEmployee extends WorkforceTrackedEmployeeLike = WorkforceTrackedEmployeeLike,
> = {
  readiness: WorkforceReadiness;
  readinessLabel: string;
  readinessDetail: string;
  activeUsers: TUser[];
  pendingUsers: TUser[];
  suspendedUsers: TUser[];
  assignmentGaps: TUser[];
  trackedAssignmentGaps: TTrackedEmployee[];
  staleInvites: TInvite[];
  trainingGaps: TTrackedEmployee[];
  actionItems: WorkforceActionItem[];
};

const STALE_INVITE_DAYS = 7;
const FIELD_SCOPED_ROLES = new Set([
  "project_manager",
  "field_supervisor",
  "foreman",
  "field_user",
  "read_only",
  "company_user",
  "project manager",
  "field supervisor",
  "field user",
  "read only",
  "company user",
]);

export function normalizeRoleKey(role?: string | null) {
  return String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function roleNeedsAssignments(role?: string | null) {
  const key = normalizeRoleKey(role);
  return FIELD_SCOPED_ROLES.has(key) || FIELD_SCOPED_ROLES.has(key.replaceAll("_", " "));
}

export function isActiveStatus(status?: string | null) {
  return String(status ?? "").trim().toLowerCase() === "active";
}

export function isPendingStatus(status?: string | null) {
  return String(status ?? "").trim().toLowerCase() === "pending";
}

export function isSuspendedStatus(status?: string | null) {
  return String(status ?? "").trim().toLowerCase() === "suspended";
}

export function isStaleInvite(
  invite: Pick<WorkforceInviteLike, "created_at">,
  nowMs = Date.now()
) {
  if (!invite.created_at) return false;
  const createdMs = new Date(invite.created_at).getTime();
  if (!Number.isFinite(createdMs)) return false;
  return nowMs - createdMs >= STALE_INVITE_DAYS * 24 * 60 * 60 * 1000;
}

export function trackedEmployeeNeedsTraining(employee: WorkforceTrackedEmployeeLike) {
  if (String(employee.status ?? "active").toLowerCase() === "archived") return false;
  const readiness = String(employee.readiness_status ?? "ready").toLowerCase();
  return readiness === "needs_training" || readiness === "limited" || readiness === "onboarding";
}

export function trackedEmployeeNeedsJobsiteAssignment(employee: WorkforceTrackedEmployeeLike) {
  if (String(employee.status ?? "active").toLowerCase() !== "active") return false;
  return (employee.jobsiteAssignments ?? []).filter(
    (assignment) => String(assignment.status ?? "active").toLowerCase() === "active"
  ).length === 0;
}

export function buildWorkforceCommandCenter<
  TUser extends WorkforceUserLike,
  TInvite extends WorkforceInviteLike,
  TTrackedEmployee extends WorkforceTrackedEmployeeLike,
>(
  input: WorkforceCommandCenterInput<TUser, TInvite, TTrackedEmployee>
): WorkforceCommandCenter<TUser, TInvite, TTrackedEmployee> {
  const activeUsers = input.users.filter((user) => isActiveStatus(user.status));
  const pendingUsers = input.users.filter((user) => isPendingStatus(user.status));
  const suspendedUsers = input.users.filter((user) => isSuspendedStatus(user.status));
  const assignmentGaps =
    input.activeJobsiteCount > 0
      ? activeUsers.filter(
          (user) => roleNeedsAssignments(user.role) && (input.assignmentMap[user.id] ?? []).length === 0
        )
      : [];
  const trackedAssignmentGaps =
    input.activeJobsiteCount > 0
      ? input.trackedEmployees.filter(trackedEmployeeNeedsJobsiteAssignment)
      : [];
  const staleInvites = input.invites.filter((invite) => isStaleInvite(invite, input.nowMs));
  const trainingGaps = input.trackedEmployees.filter(trackedEmployeeNeedsTraining);

  const actionItems: WorkforceActionItem[] = [
    ...pendingUsers.map((user) => ({
      id: `approve-${user.id}`,
      kind: "approve" as const,
      title: `Approve ${user.name}`,
      detail: `${user.email || "Pending employee"} finished account setup and needs workspace access.`,
      severity: "critical" as const,
      targetTab: "access" as const,
      userId: user.id,
    })),
    ...assignmentGaps.map((user) => ({
      id: `assign-${user.id}`,
      kind: "assign_jobsites" as const,
      title: `Assign jobsites for ${user.name}`,
      detail: `${user.role} is field-scoped and currently has no jobsite access.`,
      severity: "warning" as const,
      targetTab: "users" as const,
      userId: user.id,
    })),
    ...trackedAssignmentGaps.map((employee) => ({
      id: `assign-tracked-${employee.id}`,
      kind: "assign_tracked_jobsites" as const,
      title: `Assign jobsites for ${employee.full_name}`,
      detail: `${employee.email || "Tracked worker"} has no active jobsite assignment.`,
      severity: "warning" as const,
      targetTab: "training" as const,
      employeeId: employee.id,
    })),
    ...staleInvites.map((invite) => ({
      id: `invite-${invite.id}`,
      kind: "copy_invite" as const,
      title: `Follow up with ${invite.email}`,
      detail: `This ${invite.role} invite is older than ${STALE_INVITE_DAYS} days.`,
      severity: "warning" as const,
      targetTab: "access" as const,
      inviteId: invite.id,
    })),
    ...trainingGaps.map((employee) => ({
      id: `training-${employee.id}`,
      kind: "resolve_training" as const,
      title: `Resolve training for ${employee.full_name}`,
      detail: `${employee.email || "Tracked worker"} is marked ${employee.readiness_status ?? "not ready"}.`,
      severity: "warning" as const,
      targetTab: "training" as const,
      employeeId: employee.id,
    })),
    ...suspendedUsers.map((user) => ({
      id: `suspended-${user.id}`,
      kind: "review_suspended" as const,
      title: `Review suspended access for ${user.name}`,
      detail: `${user.email || "Suspended user"} is blocked from the company workspace.`,
      severity: "info" as const,
      targetTab: "access" as const,
      userId: user.id,
    })),
  ];

  if (input.dataRequestReviewCount > 0) {
    actionItems.push({
      id: "audit-review",
      kind: "review_audit",
      title: "Review data request evidence",
      detail: `${input.dataRequestReviewCount} data request${
        input.dataRequestReviewCount === 1 ? "" : "s"
      } need review or completion.`,
      severity: "info",
      targetTab: "audit",
    });
  }

  if (input.loadState.criticalErrors.length > 0) {
    return {
      readiness: "blocked",
      readinessLabel: "Blocked",
      readinessDetail: input.loadState.criticalErrors[0] ?? "Critical workforce data could not load.",
      activeUsers,
      pendingUsers,
      suspendedUsers,
      assignmentGaps,
      trackedAssignmentGaps,
      staleInvites,
      trainingGaps,
      actionItems,
    };
  }

  if (actionItems.some((item) => item.severity === "critical" || item.severity === "warning")) {
    return {
      readiness: "needs_attention",
      readinessLabel: "Needs attention",
      readinessDetail: "There are approvals, assignment gaps, stale invites, or training readiness items to resolve.",
      activeUsers,
      pendingUsers,
      suspendedUsers,
      assignmentGaps,
      trackedAssignmentGaps,
      staleInvites,
      trainingGaps,
      actionItems,
    };
  }

  return {
    readiness: "healthy",
    readinessLabel: "Healthy",
    readinessDetail: "No pending approvals, field assignment gaps, stale invites, or training readiness gaps are visible.",
    activeUsers,
    pendingUsers,
    suspendedUsers,
    assignmentGaps,
    trackedAssignmentGaps,
    staleInvites,
    trainingGaps,
    actionItems,
  };
}
