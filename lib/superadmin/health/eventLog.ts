import { applyHealthListFilters, tenantIdForScope } from "@/lib/superadmin/health/filters";
import {
  HEALTH_EVENT_STATUSES,
  HEALTH_SEVERITIES,
  type HealthEventStatus,
  type HealthScopeFilters,
  type HealthSeverity,
  type HealthSupabaseClient,
} from "@/lib/superadmin/health/types";

function cleanText(value: unknown, fallback: string, max = 120) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (text || fallback).slice(0, max);
}

function optionalText(value: unknown, max = 240) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text ? text.slice(0, max) : null;
}

function severity(value: unknown): HealthSeverity {
  return typeof value === "string" && (HEALTH_SEVERITIES as readonly string[]).includes(value)
    ? (value as HealthSeverity)
    : "low";
}

function eventStatus(value: unknown): HealthEventStatus {
  return typeof value === "string" && (HEALTH_EVENT_STATUSES as readonly string[]).includes(value)
    ? (value as HealthEventStatus)
    : "recorded";
}

function objectMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export type EventLogInput = {
  tenantId?: string | null;
  companyId?: string | null;
  jobsiteId?: string | null;
  actorUserId?: string | null;
  ownerId?: string | null;
  module: string;
  objectType: string;
  objectId?: string | null;
  action: string;
  severity?: HealthSeverity;
  eventStatus?: HealthEventStatus;
  metadata?: Record<string, unknown> | null;
};

export function normalizeEventLogInput(input: EventLogInput) {
  const companyId = optionalText(input.companyId, 80);
  return {
    tenant_id: tenantIdForScope({ tenantId: input.tenantId, companyId }),
    company_id: companyId,
    jobsite_id: optionalText(input.jobsiteId, 80),
    actor_user_id: optionalText(input.actorUserId, 80),
    owner_id: optionalText(input.ownerId, 80),
    module: cleanText(input.module, "platform"),
    object_type: cleanText(input.objectType, "unknown"),
    object_id: optionalText(input.objectId, 160),
    action: cleanText(input.action, "recorded"),
    severity: severity(input.severity),
    event_status: eventStatus(input.eventStatus),
    metadata: objectMetadata(input.metadata),
  };
}

export async function recordEventLog(client: HealthSupabaseClient, input: EventLogInput) {
  const result = await client
    .from("event_log")
    .insert(normalizeEventLogInput(input))
    .select("*")
    .single();

  if (result.error) {
    throw new Error(result.error.message ?? "Unable to record event log entry.");
  }

  return result.data as Record<string, unknown>;
}

export async function listEventLog(client: HealthSupabaseClient, filters: HealthScopeFilters) {
  const query = client
    .from("event_log")
    .select("*");
  const result = await applyHealthListFilters(query, filters, {
    statusColumn: "event_status",
    severityColumn: "severity",
    ownerColumn: "owner_id",
  });

  if (result.error) {
    throw new Error(result.error.message ?? "Unable to load event log.");
  }

  return (result.data ?? []) as Array<Record<string, unknown>>;
}
