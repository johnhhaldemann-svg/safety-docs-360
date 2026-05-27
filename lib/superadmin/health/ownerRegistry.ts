import { applyHealthListFilters, tenantIdForScope } from "@/lib/superadmin/health/filters";
import { recordEventLog } from "@/lib/superadmin/health/eventLog";
import {
  OWNER_AUTHORITY_LEVELS,
  OWNER_VALIDATION_STATUSES,
  type HealthOwnerAuthorityLevel,
  type HealthOwnerValidationStatus,
  type HealthScopeFilters,
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

function validationStatus(value: unknown): HealthOwnerValidationStatus {
  return typeof value === "string" && (OWNER_VALIDATION_STATUSES as readonly string[]).includes(value)
    ? (value as HealthOwnerValidationStatus)
    : "pending_verification";
}

function authorityLevel(value: unknown): HealthOwnerAuthorityLevel {
  return typeof value === "string" && (OWNER_AUTHORITY_LEVELS as readonly string[]).includes(value)
    ? (value as HealthOwnerAuthorityLevel)
    : "standard";
}

export type OwnerRegistryInput = {
  id?: string | null;
  tenantId?: string | null;
  ownerType: string;
  ownerUserId: string;
  companyId?: string | null;
  jobsiteId?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  validationStatus?: HealthOwnerValidationStatus;
  authorityLevel?: HealthOwnerAuthorityLevel;
  startsAt?: string | null;
  expiresAt?: string | null;
  actorUserId?: string | null;
};

export function normalizeOwnerRegistryInput(input: OwnerRegistryInput) {
  const companyId = optionalText(input.companyId, 80);
  return {
    ...(input.id ? { id: input.id } : {}),
    tenant_id: tenantIdForScope({ tenantId: input.tenantId, companyId }),
    owner_type: cleanText(input.ownerType, "platform_owner"),
    owner_user_id: cleanText(input.ownerUserId, ""),
    company_id: companyId,
    jobsite_id: optionalText(input.jobsiteId, 80),
    object_type: optionalText(input.objectType, 120),
    object_id: optionalText(input.objectId, 160),
    validation_status: validationStatus(input.validationStatus),
    authority_level: authorityLevel(input.authorityLevel),
    starts_at: optionalText(input.startsAt, 80),
    expires_at: optionalText(input.expiresAt, 80),
  };
}

export async function upsertOwnerRegistryRecord(client: HealthSupabaseClient, input: OwnerRegistryInput) {
  const normalized = normalizeOwnerRegistryInput(input);
  if (!normalized.owner_user_id) {
    throw new Error("Owner user id is required.");
  }

  const result = await client
    .from("owner_registry")
    .upsert(normalized, input.id ? { onConflict: "id" } : undefined)
    .select("*")
    .single();

  if (result.error) {
    throw new Error(result.error.message ?? "Unable to upsert owner registry record.");
  }

  const owner = result.data as Record<string, unknown>;
  await recordEventLog(client, {
    tenantId: String(normalized.tenant_id),
    companyId: normalized.company_id,
    jobsiteId: normalized.jobsite_id,
    actorUserId: input.actorUserId,
    ownerId: typeof owner.id === "string" ? owner.id : null,
    module: "owner_registry",
    objectType: normalized.object_type ?? "owner_registry",
    objectId: normalized.object_id ?? (typeof owner.id === "string" ? owner.id : null),
    action: "owner_registry_upserted",
    severity: normalized.validation_status === "verified" ? "low" : "medium",
    eventStatus: normalized.validation_status === "verified" ? "recorded" : "pending_review",
    metadata: {
      validationStatus: normalized.validation_status,
      authorityLevel: normalized.authority_level,
    },
  });

  return owner;
}

export async function listOwnerRegistry(client: HealthSupabaseClient, filters: HealthScopeFilters) {
  const result = await applyHealthListFilters(
    client.from("owner_registry").select("*"),
    filters,
    {
      statusColumn: "validation_status",
      ownerColumn: "owner_user_id",
    }
  );

  if (result.error) {
    throw new Error(result.error.message ?? "Unable to load owner registry.");
  }

  return (result.data ?? []) as Array<Record<string, unknown>>;
}
