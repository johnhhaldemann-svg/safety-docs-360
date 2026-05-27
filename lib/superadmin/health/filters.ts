import {
  HEALTH_EVENT_STATUSES,
  HEALTH_SEVERITIES,
  SUPERADMIN_HEALTH_PLATFORM_TENANT_ID,
  type HealthScopeFilters,
} from "@/lib/superadmin/health/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLATFORM_UUID_RE = /^00000000-0000-0000-0000-000000000000$/i;

function normalizeUuid(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!UUID_RE.test(trimmed) && !PLATFORM_UUID_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function normalizeIsoDate(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeLimit(value: string | number | null | undefined) {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(200, Math.round(parsed)));
}

export function normalizeHealthScopeFilters(input: URLSearchParams | Record<string, unknown>): HealthScopeFilters {
  const read = (key: string) =>
    input instanceof URLSearchParams
      ? input.get(key)
      : typeof input[key] === "string" || typeof input[key] === "number"
        ? String(input[key])
        : null;

  const companyId = normalizeUuid(read("companyId") ?? read("company_id"));
  const tenantId =
    normalizeUuid(read("tenantId") ?? read("tenant_id")) ??
    companyId ??
    SUPERADMIN_HEALTH_PLATFORM_TENANT_ID;
  const severity = read("severity")?.trim().toLowerCase() ?? null;
  const status = read("status")?.trim().toLowerCase() ?? null;

  return {
    tenantId,
    companyId,
    jobsiteId: normalizeUuid(read("jobsiteId") ?? read("jobsite_id")),
    dateFrom: normalizeIsoDate(read("dateFrom") ?? read("date_from")),
    dateTo: normalizeIsoDate(read("dateTo") ?? read("date_to")),
    severity: severity && (HEALTH_SEVERITIES as readonly string[]).includes(severity) ? severity : null,
    ownerId: normalizeUuid(read("ownerId") ?? read("owner_id")),
    status: status && (HEALTH_EVENT_STATUSES as readonly string[]).includes(status) ? status : status || null,
    limit: normalizeLimit(read("limit")),
  };
}

export function applyHealthListFilters<T extends { eq: (column: string, value: string) => T; gte: (column: string, value: string) => T; lte: (column: string, value: string) => T; order: (column: string, options?: { ascending?: boolean }) => T; limit: (count: number) => T }>(
  query: T,
  filters: HealthScopeFilters,
  options: {
    statusColumn?: string;
    severityColumn?: string;
    ownerColumn?: string;
    createdColumn?: string;
    includeTenant?: boolean;
  } = {}
) {
  const createdColumn = options.createdColumn ?? "created_at";
  let next = query;
  if (options.includeTenant ?? true) next = next.eq("tenant_id", filters.tenantId);
  if (filters.companyId) next = next.eq("company_id", filters.companyId);
  if (filters.jobsiteId) next = next.eq("jobsite_id", filters.jobsiteId);
  if (filters.severity && options.severityColumn) next = next.eq(options.severityColumn, filters.severity);
  if (filters.status && options.statusColumn) next = next.eq(options.statusColumn, filters.status);
  if (filters.ownerId && options.ownerColumn) next = next.eq(options.ownerColumn, filters.ownerId);
  if (filters.dateFrom) next = next.gte(createdColumn, filters.dateFrom);
  if (filters.dateTo) next = next.lte(createdColumn, filters.dateTo);
  return next.order(createdColumn, { ascending: false }).limit(filters.limit);
}

export function tenantIdForScope(input: { tenantId?: string | null; companyId?: string | null }) {
  return normalizeUuid(input.tenantId) ?? normalizeUuid(input.companyId) ?? SUPERADMIN_HEALTH_PLATFORM_TENANT_ID;
}
