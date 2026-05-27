import { applyHealthListFilters, tenantIdForScope } from "@/lib/superadmin/health/filters";
import { recordEventLog } from "@/lib/superadmin/health/eventLog";
import {
  CHANGE_RISK_LEVELS,
  type HealthChangeRiskLevel,
  type HealthScopeFilters,
  type HealthSupabaseClient,
} from "@/lib/superadmin/health/types";

function cleanText(value: unknown, fallback: string, max = 160) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (text || fallback).slice(0, max);
}

function optionalText(value: unknown, max = 500) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text ? text.slice(0, max) : null;
}

function optionalJson(value: unknown) {
  return value === undefined ? null : value;
}

function riskLevel(value: unknown): HealthChangeRiskLevel {
  return typeof value === "string" && (CHANGE_RISK_LEVELS as readonly string[]).includes(value)
    ? (value as HealthChangeRiskLevel)
    : "medium";
}

export type ChangeLogInput = {
  tenantId?: string | null;
  companyId?: string | null;
  jobsiteId?: string | null;
  changedByUserId?: string | null;
  ownerId?: string | null;
  objectType: string;
  objectId: string;
  changeType: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  reason?: string | null;
  riskLevel?: HealthChangeRiskLevel;
  rollbackAvailable?: boolean;
};

export function normalizeChangeLogInput(input: ChangeLogInput) {
  const companyId = optionalText(input.companyId, 80);
  return {
    tenant_id: tenantIdForScope({ tenantId: input.tenantId, companyId }),
    company_id: companyId,
    jobsite_id: optionalText(input.jobsiteId, 80),
    changed_by_user_id: optionalText(input.changedByUserId, 80),
    owner_id: optionalText(input.ownerId, 80),
    object_type: cleanText(input.objectType, "unknown"),
    object_id: cleanText(input.objectId, "unknown"),
    change_type: cleanText(input.changeType, "updated"),
    before_value: optionalJson(input.beforeValue),
    after_value: optionalJson(input.afterValue),
    reason: optionalText(input.reason, 1000),
    risk_level: riskLevel(input.riskLevel),
    rollback_available: input.rollbackAvailable === true,
  };
}

export async function recordChangeLog(client: HealthSupabaseClient, input: ChangeLogInput) {
  const normalized = normalizeChangeLogInput(input);
  const result = await client
    .from("change_log")
    .insert(normalized)
    .select("*")
    .single();

  if (result.error) {
    throw new Error(result.error.message ?? "Unable to record change log entry.");
  }

  const change = result.data as Record<string, unknown>;
  await recordEventLog(client, {
    tenantId: String(normalized.tenant_id),
    companyId: normalized.company_id,
    jobsiteId: normalized.jobsite_id,
    actorUserId: normalized.changed_by_user_id,
    ownerId: normalized.owner_id,
    module: "change_log",
    objectType: normalized.object_type,
    objectId: normalized.object_id,
    action: normalized.change_type,
    severity: normalized.risk_level === "critical" ? "critical" : normalized.risk_level === "high" ? "high" : "medium",
    eventStatus: normalized.risk_level === "critical" || normalized.risk_level === "high" ? "pending_review" : "recorded",
    metadata: {
      changeLogId: change.id,
      rollbackAvailable: normalized.rollback_available,
      reason: normalized.reason,
    },
  });

  return change;
}

export async function listChangeLog(client: HealthSupabaseClient, filters: HealthScopeFilters) {
  const result = await applyHealthListFilters(
    client.from("change_log").select("*"),
    filters,
    {
      severityColumn: "risk_level",
      ownerColumn: "owner_id",
    }
  );

  if (result.error) {
    throw new Error(result.error.message ?? "Unable to load change log.");
  }

  return (result.data ?? []) as Array<Record<string, unknown>>;
}
