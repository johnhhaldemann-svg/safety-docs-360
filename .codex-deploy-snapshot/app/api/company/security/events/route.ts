import { NextResponse } from "next/server";
import { getCompanyScope, normalizeUuid } from "@/lib/companyScope";
import { canManageCompanyAccess } from "@/lib/companyPermissions";
import { isAdminRole, authorizeRequest } from "@/lib/rbac";
import { isMissingCompanySecurityEventsError } from "@/lib/companySecurityEvents";
import type { CompanySecurityEvent } from "@/types/enterprise-readiness";

export const runtime = "nodejs";

type MessageError = { message?: string | null };

type SecurityEventsQuery = {
  eq: (column: string, value: string) => SecurityEventsQuery;
  order: (column: string, options?: { ascending?: boolean }) => SecurityEventsQuery;
  range: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: unknown;
    count: number | null;
    error: MessageError | null;
  }>;
};

function parseBoundedInteger(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

function canReadCompanySecurityEvidence(auth: {
  role: string;
  permissionMap?: {
    can_manage_company_users?: boolean;
    can_manage_users?: boolean;
    can_view_all_company_data?: boolean;
  };
}) {
  return (
    canManageCompanyAccess(auth.role) ||
    Boolean(auth.permissionMap?.can_manage_company_users) ||
    Boolean(auth.permissionMap?.can_manage_users) ||
    Boolean(auth.permissionMap?.can_view_all_company_data)
  );
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_manage_company_users",
      "can_manage_users",
      "can_view_analytics",
      "can_view_all_company_data",
    ],
  });

  if ("error" in auth) return auth.error;

  if (!canReadCompanySecurityEvidence(auth)) {
    return NextResponse.json(
      { error: "You do not have permission to view company security events." },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  const requestedCompanyId = normalizeUuid(url.searchParams.get("companyId"));
  const maySelectCompany =
    isAdminRole(auth.role) || Boolean(auth.permissionMap?.can_view_all_company_data);
  const companyId = maySelectCompany && requestedCompanyId
    ? requestedCompanyId
    : companyScope.companyId;

  if (!companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  const limit = parseBoundedInteger(url.searchParams.get("limit"), 25, 100);
  const offset = parseBoundedInteger(url.searchParams.get("offset"), 0, 10_000);
  const eventType = url.searchParams.get("eventType")?.trim() || "";

  let query = (
    auth.supabase.from("company_security_events") as unknown as {
      select: (columns: string, options?: { count?: "exact" }) => SecurityEventsQuery;
    }
  )
    .select(
      "id, company_id, jobsite_id, actor_user_id, actor_role, event_type, resource_type, resource_id, title, detail, ip_address, user_agent, metadata, occurred_at",
      { count: "exact" }
    )
    .eq("company_id", companyId);

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  const result = await query
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (isMissingCompanySecurityEventsError(result.error)) {
    return NextResponse.json({
      events: [],
      pagination: { limit, offset, nextOffset: null, total: 0 },
      warning: "Run the enterprise IT readiness migration to enable company security events.",
    });
  }

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message || "Failed to load company security events." },
      { status: 500 }
    );
  }

  const total = result.count ?? null;
  const nextOffset =
    total !== null
      ? offset + limit < total
        ? offset + limit
        : null
      : Array.isArray(result.data) && result.data.length === limit
        ? offset + limit
        : null;

  return NextResponse.json({
    events: ((result.data as CompanySecurityEvent[] | null) ?? []),
    pagination: { limit, offset, nextOffset, total },
  });
}
