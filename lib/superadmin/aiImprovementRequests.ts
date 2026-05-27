import { normalizeAppRole } from "@/lib/rbac";

export const AI_IMPROVEMENT_STATUSES = [
  "draft",
  "proposed",
  "in_progress",
  "awaiting_super_admin_approval",
  "approved",
  "rejected",
  "merged",
  "deployed",
  "failed",
  "rolled_back",
] as const;

export type AiImprovementStatus = (typeof AI_IMPROVEMENT_STATUSES)[number];

export const AI_IMPROVEMENT_RISK_LEVELS = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type AiImprovementRiskLevel = (typeof AI_IMPROVEMENT_RISK_LEVELS)[number];

export const AI_IMPROVEMENT_ACTOR_TYPES = ["user", "ai", "system"] as const;
export type AiImprovementActorType = (typeof AI_IMPROVEMENT_ACTOR_TYPES)[number];

export const AI_IMPROVEMENT_AUDIT_EVENTS = [
  "ai_improvement_request_created",
  "ai_improvement_request_updated",
  "codex_branch_linked",
  "pull_request_linked",
  "tests_completed",
  "approval_requested",
  "super_admin_approved",
  "super_admin_rejected",
  "unauthorized_approval_attempt",
  "deployment_triggered",
  "rollback_triggered",
] as const;

export type AiImprovementAuditEventType = (typeof AI_IMPROVEMENT_AUDIT_EVENTS)[number];

export type AiImprovementRequest = {
  id: string;
  title: string;
  description: string;
  proposed_by: string | null;
  created_by_type: AiImprovementActorType;
  status: AiImprovementStatus;
  risk_level: AiImprovementRiskLevel;
  affected_area: string;
  branch_name: string | null;
  pull_request_url: string | null;
  latest_commit_sha: string | null;
  test_summary: string;
  codex_summary: string;
  rollback_plan: string;
  checks_passed: boolean;
  super_admin_override_reason: string | null;
  approved_by_super_admin_id: string | null;
  approved_at: string | null;
  rejected_by_super_admin_id: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type AiImprovementAuditEvent = {
  id: string;
  improvement_request_id: string | null;
  actor_id: string | null;
  actor_type: AiImprovementActorType;
  event_type: AiImprovementAuditEventType;
  old_status: AiImprovementStatus | null;
  new_status: AiImprovementStatus | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AiImprovementActor = {
  id?: string | null;
  type: AiImprovementActorType;
  role?: string | null;
};

export type AiImprovementRequestInput = {
  title?: unknown;
  description?: unknown;
  proposedBy?: unknown;
  proposed_by?: unknown;
  createdByType?: unknown;
  created_by_type?: unknown;
  status?: unknown;
  riskLevel?: unknown;
  risk_level?: unknown;
  affectedArea?: unknown;
  affected_area?: unknown;
  branchName?: unknown;
  branch_name?: unknown;
  pullRequestUrl?: unknown;
  pull_request_url?: unknown;
  latestCommitSha?: unknown;
  latest_commit_sha?: unknown;
  testSummary?: unknown;
  test_summary?: unknown;
  codexSummary?: unknown;
  codex_summary?: unknown;
  rollbackPlan?: unknown;
  rollback_plan?: unknown;
  checksPassed?: unknown;
  checks_passed?: unknown;
};

export type AiImprovementApprovalInput = {
  overrideReason?: unknown;
  superAdminOverrideReason?: unknown;
  super_admin_override_reason?: unknown;
  actorType?: unknown;
  actor_type?: unknown;
};

export type AiImprovementRejectionInput = {
  rejectionReason?: unknown;
  rejection_reason?: unknown;
  actorType?: unknown;
  actor_type?: unknown;
};

type SupabaseError = { message?: string | null };
type SupabaseResult<T> = {
  data: T | null;
  error: SupabaseError | null;
};

type SelectQuery<T> = PromiseLike<SupabaseResult<T>> & {
  eq(column: string, value: string): SelectQuery<T>;
  order(column: string, options?: { ascending?: boolean }): SelectQuery<T>;
  limit(count: number): SelectQuery<T>;
  maybeSingle(): PromiseLike<SupabaseResult<T>>;
  single(): PromiseLike<SupabaseResult<T>>;
};

type InsertQuery<T> = PromiseLike<SupabaseResult<T>> & {
  select(columns?: string): InsertQuery<T>;
  single(): PromiseLike<SupabaseResult<T>>;
};

type UpdateQuery<T> = {
  eq(column: string, value: string): UpdateQuery<T>;
  select(columns?: string): UpdateQuery<T>;
  single(): PromiseLike<SupabaseResult<T>>;
};

type TableQuery = {
  select<T = unknown>(columns?: string): SelectQuery<T>;
  insert<T = unknown>(values: unknown): InsertQuery<T>;
  update<T = unknown>(values: unknown): UpdateQuery<T>;
};

export type AiImprovementSupabaseClient = {
  from(table: string): TableQuery;
};

function assertNoSupabaseError<T>(result: SupabaseResult<T>, action: string): T {
  if (result.error) {
    throw new Error(`${action}: ${result.error.message ?? "Supabase request failed."}`);
  }

  return result.data as T;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(value: unknown, fieldName: string) {
  const text = optionalText(value);
  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }
  return text;
}

function textOrEmpty(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined);
}

export function isAiImprovementStatus(value: unknown): value is AiImprovementStatus {
  return (
    typeof value === "string" &&
    AI_IMPROVEMENT_STATUSES.includes(value as AiImprovementStatus)
  );
}

export function normalizeAiImprovementStatus(value: unknown): AiImprovementStatus {
  return isAiImprovementStatus(value) ? value : "draft";
}

export function isAiImprovementRiskLevel(value: unknown): value is AiImprovementRiskLevel {
  return (
    typeof value === "string" &&
    AI_IMPROVEMENT_RISK_LEVELS.includes(value as AiImprovementRiskLevel)
  );
}

export function normalizeAiImprovementRiskLevel(value: unknown): AiImprovementRiskLevel {
  return isAiImprovementRiskLevel(value) ? value : "medium";
}

export function normalizeAiImprovementActorType(value: unknown): AiImprovementActorType {
  return typeof value === "string" &&
    AI_IMPROVEMENT_ACTOR_TYPES.includes(value as AiImprovementActorType)
    ? (value as AiImprovementActorType)
    : "user";
}

export function canApproveAiImprovement(actor: AiImprovementActor) {
  return actor.type === "user" && normalizeAppRole(actor.role) === "super_admin";
}

export function normalizeAiImprovementRequestInput(input: AiImprovementRequestInput) {
  const createdByType = normalizeAiImprovementActorType(
    firstDefined(input.createdByType, input.created_by_type)
  );

  return {
    title: requiredText(input.title, "Title"),
    description: textOrEmpty(input.description),
    proposed_by: optionalText(firstDefined(input.proposedBy, input.proposed_by)),
    created_by_type: createdByType,
    status: normalizeAiImprovementStatus(input.status),
    risk_level: normalizeAiImprovementRiskLevel(
      firstDefined(input.riskLevel, input.risk_level)
    ),
    affected_area: textOrEmpty(firstDefined(input.affectedArea, input.affected_area)),
    branch_name: optionalText(firstDefined(input.branchName, input.branch_name)),
    pull_request_url: optionalText(
      firstDefined(input.pullRequestUrl, input.pull_request_url)
    ),
    latest_commit_sha: optionalText(
      firstDefined(input.latestCommitSha, input.latest_commit_sha)
    ),
    test_summary: textOrEmpty(firstDefined(input.testSummary, input.test_summary)),
    codex_summary: textOrEmpty(firstDefined(input.codexSummary, input.codex_summary)),
    rollback_plan: textOrEmpty(firstDefined(input.rollbackPlan, input.rollback_plan)),
    checks_passed: Boolean(firstDefined(input.checksPassed, input.checks_passed)),
  };
}

export function normalizeAiImprovementRequestPatch(input: AiImprovementRequestInput) {
  const patch: Record<string, unknown> = {};

  if (input.title !== undefined) patch.title = requiredText(input.title, "Title");
  if (input.description !== undefined) patch.description = textOrEmpty(input.description);
  if (input.status !== undefined) patch.status = normalizeAiImprovementStatus(input.status);
  if (input.riskLevel !== undefined || input.risk_level !== undefined) {
    patch.risk_level = normalizeAiImprovementRiskLevel(
      firstDefined(input.riskLevel, input.risk_level)
    );
  }
  if (input.affectedArea !== undefined || input.affected_area !== undefined) {
    patch.affected_area = textOrEmpty(firstDefined(input.affectedArea, input.affected_area));
  }
  if (input.branchName !== undefined || input.branch_name !== undefined) {
    patch.branch_name = optionalText(firstDefined(input.branchName, input.branch_name));
  }
  if (input.pullRequestUrl !== undefined || input.pull_request_url !== undefined) {
    patch.pull_request_url = optionalText(
      firstDefined(input.pullRequestUrl, input.pull_request_url)
    );
  }
  if (input.latestCommitSha !== undefined || input.latest_commit_sha !== undefined) {
    patch.latest_commit_sha = optionalText(
      firstDefined(input.latestCommitSha, input.latest_commit_sha)
    );
  }
  if (input.testSummary !== undefined || input.test_summary !== undefined) {
    patch.test_summary = textOrEmpty(firstDefined(input.testSummary, input.test_summary));
  }
  if (input.codexSummary !== undefined || input.codex_summary !== undefined) {
    patch.codex_summary = textOrEmpty(firstDefined(input.codexSummary, input.codex_summary));
  }
  if (input.rollbackPlan !== undefined || input.rollback_plan !== undefined) {
    patch.rollback_plan = textOrEmpty(firstDefined(input.rollbackPlan, input.rollback_plan));
  }
  if (input.checksPassed !== undefined || input.checks_passed !== undefined) {
    patch.checks_passed = Boolean(firstDefined(input.checksPassed, input.checks_passed));
  }

  return patch;
}

export function parseApprovalInput(input: AiImprovementApprovalInput) {
  return {
    actorType: normalizeAiImprovementActorType(firstDefined(input.actorType, input.actor_type)),
    overrideReason: optionalText(
      firstDefined(
        input.overrideReason,
        input.superAdminOverrideReason,
        input.super_admin_override_reason
      )
    ),
  };
}

export function parseRejectionInput(input: AiImprovementRejectionInput) {
  return {
    actorType: normalizeAiImprovementActorType(firstDefined(input.actorType, input.actor_type)),
    rejectionReason: requiredText(
      firstDefined(input.rejectionReason, input.rejection_reason),
      "Rejection reason"
    ),
  };
}

function auditMetadata(value?: Record<string, unknown>) {
  return value ?? {};
}

export async function recordAiImprovementAuditEvent(params: {
  client: AiImprovementSupabaseClient;
  requestId?: string | null;
  actor: AiImprovementActor;
  eventType: AiImprovementAuditEventType;
  oldStatus?: AiImprovementStatus | null;
  newStatus?: AiImprovementStatus | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const result = await params.client
    .from("ai_improvement_audit_events")
    .insert({
      improvement_request_id: params.requestId ?? null,
      actor_id: params.actor.id ?? null,
      actor_type: params.actor.type,
      event_type: params.eventType,
      old_status: params.oldStatus ?? null,
      new_status: params.newStatus ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      metadata: auditMetadata(params.metadata),
    })
    .select("*")
    .single();

  return assertNoSupabaseError(
    result as SupabaseResult<AiImprovementAuditEvent>,
    "Unable to record AI improvement audit event"
  );
}

export async function listAiImprovementRequests(
  client: AiImprovementSupabaseClient,
  limit = 100
) {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 200));
  const result = await client
    .from("ai_improvement_requests")
    .select<AiImprovementRequest[]>("*")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  return assertNoSupabaseError(
    result as SupabaseResult<AiImprovementRequest[]>,
    "Unable to load AI improvement requests"
  );
}

export async function getAiImprovementRequest(
  client: AiImprovementSupabaseClient,
  id: string
) {
  const result = await client
    .from("ai_improvement_requests")
    .select<AiImprovementRequest>("*")
    .eq("id", id)
    .maybeSingle();

  return assertNoSupabaseError(
    result as SupabaseResult<AiImprovementRequest | null>,
    "Unable to load AI improvement request"
  );
}

function eventTypeForPatch(
  patch: Record<string, unknown>,
  oldStatus: AiImprovementStatus,
  newStatus: AiImprovementStatus
): AiImprovementAuditEventType {
  if (newStatus === "awaiting_super_admin_approval" && oldStatus !== newStatus) {
    return "approval_requested";
  }
  if ("pull_request_url" in patch) return "pull_request_linked";
  if ("branch_name" in patch || "latest_commit_sha" in patch) return "codex_branch_linked";
  if ("test_summary" in patch || "checks_passed" in patch) return "tests_completed";
  if (newStatus === "deployed" && oldStatus !== newStatus) return "deployment_triggered";
  if (newStatus === "rolled_back" && oldStatus !== newStatus) return "rollback_triggered";
  return "ai_improvement_request_updated";
}

export async function createAiImprovementRequest(params: {
  client: AiImprovementSupabaseClient;
  input: AiImprovementRequestInput;
  actor: AiImprovementActor;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const row = normalizeAiImprovementRequestInput(params.input);
  const result = await params.client
    .from("ai_improvement_requests")
    .insert({
      ...row,
      proposed_by: row.proposed_by ?? (params.actor.type === "user" ? params.actor.id ?? null : null),
    })
    .select("*")
    .single();
  const request = assertNoSupabaseError(
    result as SupabaseResult<AiImprovementRequest>,
    "Unable to create AI improvement request"
  );

  await recordAiImprovementAuditEvent({
    client: params.client,
    requestId: request.id,
    actor: params.actor,
    eventType: "ai_improvement_request_created",
    newStatus: request.status,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      title: request.title,
      riskLevel: request.risk_level,
      affectedArea: request.affected_area,
    },
  });

  return request;
}

export async function updateAiImprovementRequest(params: {
  client: AiImprovementSupabaseClient;
  id: string;
  input: AiImprovementRequestInput;
  actor: AiImprovementActor;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const existing = await getAiImprovementRequest(params.client, params.id);
  if (!existing) {
    throw new Error("AI improvement request not found.");
  }

  const patch = normalizeAiImprovementRequestPatch(params.input);
  if (Object.keys(patch).length === 0) {
    return existing;
  }

  const result = await params.client
    .from("ai_improvement_requests")
    .update<AiImprovementRequest>(patch)
    .eq("id", params.id)
    .select("*")
    .single();
  const updated = assertNoSupabaseError(
    result as SupabaseResult<AiImprovementRequest>,
    "Unable to update AI improvement request"
  );

  await recordAiImprovementAuditEvent({
    client: params.client,
    requestId: updated.id,
    actor: params.actor,
    eventType: eventTypeForPatch(patch, existing.status, updated.status),
    oldStatus: existing.status,
    newStatus: updated.status,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: { changedFields: Object.keys(patch) },
  });

  return updated;
}

export async function approveAiImprovementRequest(params: {
  client: AiImprovementSupabaseClient;
  id: string;
  actor: AiImprovementActor;
  overrideReason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  if (!canApproveAiImprovement(params.actor)) {
    await recordAiImprovementAuditEvent({
      client: params.client,
      requestId: params.id,
      actor: params.actor,
      eventType: "unauthorized_approval_attempt",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: { attemptedAction: "approve" },
    });
    throw new Error("Super Admin user approval is required.");
  }

  const existing = await getAiImprovementRequest(params.client, params.id);
  if (!existing) {
    throw new Error("AI improvement request not found.");
  }

  const overrideReason = optionalText(params.overrideReason);
  if (!existing.checks_passed && !overrideReason) {
    throw new Error("Required checks must pass before approval unless a Super Admin override reason is provided.");
  }

  const approvedAt = new Date().toISOString();
  const result = await params.client
    .from("ai_improvement_requests")
    .update<AiImprovementRequest>({
      status: "approved",
      approved_by_super_admin_id: params.actor.id ?? null,
      approved_at: approvedAt,
      super_admin_override_reason: overrideReason,
    })
    .eq("id", params.id)
    .select("*")
    .single();
  const updated = assertNoSupabaseError(
    result as SupabaseResult<AiImprovementRequest>,
    "Unable to approve AI improvement request"
  );

  await recordAiImprovementAuditEvent({
    client: params.client,
    requestId: updated.id,
    actor: params.actor,
    eventType: "super_admin_approved",
    oldStatus: existing.status,
    newStatus: updated.status,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      checksPassed: existing.checks_passed,
      overrideUsed: Boolean(overrideReason),
    },
  });

  return updated;
}

export async function rejectAiImprovementRequest(params: {
  client: AiImprovementSupabaseClient;
  id: string;
  actor: AiImprovementActor;
  rejectionReason: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  if (!canApproveAiImprovement(params.actor)) {
    throw new Error("Super Admin user rejection is required.");
  }

  const reason = requiredText(params.rejectionReason, "Rejection reason");
  const existing = await getAiImprovementRequest(params.client, params.id);
  if (!existing) {
    throw new Error("AI improvement request not found.");
  }

  const rejectedAt = new Date().toISOString();
  const result = await params.client
    .from("ai_improvement_requests")
    .update<AiImprovementRequest>({
      status: "rejected",
      rejected_by_super_admin_id: params.actor.id ?? null,
      rejected_at: rejectedAt,
      rejection_reason: reason,
    })
    .eq("id", params.id)
    .select("*")
    .single();
  const updated = assertNoSupabaseError(
    result as SupabaseResult<AiImprovementRequest>,
    "Unable to reject AI improvement request"
  );

  await recordAiImprovementAuditEvent({
    client: params.client,
    requestId: updated.id,
    actor: params.actor,
    eventType: "super_admin_rejected",
    oldStatus: existing.status,
    newStatus: updated.status,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: { rejectionReason: reason },
  });

  return updated;
}
