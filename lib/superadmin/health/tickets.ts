import { applyHealthListFilters, tenantIdForScope } from "@/lib/superadmin/health/filters";
import { recordEventLog } from "@/lib/superadmin/health/eventLog";
import {
  HEALTH_SEVERITIES,
  type HealthScopeFilters,
  type HealthSeverity,
  type HealthSupabaseClient,
} from "@/lib/superadmin/health/types";
import { isPlatformHelpTicketStatus, normalizePlatformHelpTicketRow } from "@/lib/platformHelpTickets";
import type { PlatformHelpTicketPriority } from "@/types/platform-support";

function cleanText(value: unknown, fallback: string, max = 240) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (text || fallback).slice(0, max);
}

function cleanLongText(value: unknown, fallback: string, max = 4000) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function optionalText(value: unknown, max = 500) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text ? text.slice(0, max) : null;
}

export function ticketPriorityFromSeverity(severity: HealthSeverity): PlatformHelpTicketPriority {
  if (severity === "critical") return "critical";
  if (severity === "high") return "high";
  return "normal";
}

function normalizeSeverity(value: unknown): HealthSeverity {
  return typeof value === "string" && (HEALTH_SEVERITIES as readonly string[]).includes(value)
    ? (value as HealthSeverity)
    : "medium";
}

export type HealthTicketInput = {
  tenantId?: string | null;
  companyId?: string | null;
  jobsiteId?: string | null;
  submitterUserId: string;
  submitterEmail?: string | null;
  submitterName?: string | null;
  submitterRole?: string | null;
  companyName?: string | null;
  sourceType: string;
  sourceId?: string | null;
  title: string;
  description: string;
  severity?: HealthSeverity;
  ownerId?: string | null;
  rootCause?: string | null;
  recommendedFix?: string | null;
  dueAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function normalizeHealthTicketInput(input: HealthTicketInput) {
  const companyId = optionalText(input.companyId, 80);
  const severity = normalizeSeverity(input.severity);
  return {
    tenant_id: tenantIdForScope({ tenantId: input.tenantId, companyId }),
    company_id: companyId,
    jobsite_id: optionalText(input.jobsiteId, 80),
    submitter_user_id: cleanText(input.submitterUserId, ""),
    submitter_email: optionalText(input.submitterEmail, 320),
    submitter_name: optionalText(input.submitterName, 160),
    submitter_role: optionalText(input.submitterRole, 80),
    company_name: optionalText(input.companyName, 160),
    category: "other",
    priority: ticketPriorityFromSeverity(severity),
    status: "open",
    title: cleanText(input.title, "Health ticket"),
    description: cleanLongText(input.description, "A SuperAdmin Health issue needs review."),
    page_url: "/superadmin/health",
    browser_user_agent: null,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    source_type: cleanText(input.sourceType, "manual"),
    source_id: optionalText(input.sourceId, 160),
    severity,
    owner_id: optionalText(input.ownerId, 80),
    root_cause: optionalText(input.rootCause, 1000),
    recommended_fix: optionalText(input.recommendedFix, 1000),
    due_at: optionalText(input.dueAt, 80),
  };
}

export async function createHealthHelpTicket(client: HealthSupabaseClient, input: HealthTicketInput) {
  const normalized = normalizeHealthTicketInput(input);
  if (!normalized.submitter_user_id) {
    throw new Error("Submitter user id is required.");
  }

  const result = await client
    .from("platform_help_tickets")
    .insert(normalized)
    .select("*")
    .single();

  if (result.error) {
    throw new Error(result.error.message ?? "Unable to create health help ticket.");
  }

  const ticket = result.data as Record<string, unknown>;
  await recordEventLog(client, {
    tenantId: String(normalized.tenant_id),
    companyId: normalized.company_id,
    jobsiteId: normalized.jobsite_id,
    actorUserId: normalized.submitter_user_id,
    ownerId: normalized.owner_id,
    module: "help_tickets",
    objectType: "platform_help_ticket",
    objectId: typeof ticket.id === "string" ? ticket.id : null,
    action: "ticket_created",
    severity: normalized.severity,
    eventStatus: "pending_review",
    metadata: {
      sourceType: normalized.source_type,
      sourceId: normalized.source_id,
      title: normalized.title,
    },
  });

  return normalizePlatformHelpTicketRow(ticket);
}

export async function listHealthHelpTickets(client: HealthSupabaseClient, filters: HealthScopeFilters) {
  const result = await applyHealthListFilters(
    client.from("platform_help_tickets").select("*"),
    filters,
    {
      statusColumn: "status",
      severityColumn: "severity",
      ownerColumn: "owner_id",
      includeTenant: true,
    }
  );

  if (result.error) {
    throw new Error(result.error.message ?? "Unable to load help tickets.");
  }

  return ((result.data ?? []) as Array<Record<string, unknown>>).map(normalizePlatformHelpTicketRow);
}

export async function updateHealthHelpTicket(
  client: HealthSupabaseClient,
  params: {
    id: string;
    tenantId: string;
    actorUserId: string;
    status?: string;
    resolutionEvidence?: string | null;
  }
) {
  const updates: Record<string, unknown> = {};
  if (params.status) {
    if (!isPlatformHelpTicketStatus(params.status)) throw new Error("Unsupported ticket status.");
    updates.status = params.status;
    if (params.status === "resolved") updates.resolved_at = new Date().toISOString();
    if (params.status === "closed") updates.closed_at = new Date().toISOString();
  }
  if (params.resolutionEvidence !== undefined) {
    updates.resolution_evidence = optionalText(params.resolutionEvidence, 4000);
  }

  const result = await client
    .from("platform_help_tickets")
    .update(updates)
    .eq("id", params.id)
    .eq("tenant_id", params.tenantId)
    .select("*")
    .single();

  if (result.error) {
    throw new Error(result.error.message ?? "Unable to update help ticket.");
  }

  await recordEventLog(client, {
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    module: "help_tickets",
    objectType: "platform_help_ticket",
    objectId: params.id,
    action: "ticket_updated",
    severity: "medium",
    eventStatus: params.status === "resolved" || params.status === "closed" ? "resolved" : "pending_review",
    metadata: { status: params.status ?? null },
  });

  return normalizePlatformHelpTicketRow(result.data as Record<string, unknown>);
}
