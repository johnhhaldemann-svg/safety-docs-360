import { NextResponse } from "next/server";
import { getClientIpAddress } from "@/lib/legal";
import { getCompanyScope, normalizeUuid } from "@/lib/companyScope";
import { canManageCompanyAccess } from "@/lib/companyPermissions";
import {
  isMissingCompanyDataRequestsError,
  normalizeCompanyDataRequestScope,
  normalizeCompanyDataRequestType,
} from "@/lib/companyDataRequests";
import { recordCompanySecurityEvent } from "@/lib/companySecurityEvents";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import type {
  CompanyDataRequest,
  CompanyDataRequestScope,
  JsonObject,
} from "@/types/enterprise-readiness";

export const runtime = "nodejs";

type MessageError = { message?: string | null };

type DataRequestsQuery = {
  eq: (column: string, value: string) => DataRequestsQuery;
  order: (column: string, options?: { ascending?: boolean }) => DataRequestsQuery;
  range: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: unknown;
    count: number | null;
    error: MessageError | null;
  }>;
};

type InsertDataRequestQuery = {
  select: (columns: string) => {
    single: () => PromiseLike<{
      data: unknown;
      error: MessageError | null;
    }>;
  };
};

function parseBoundedInteger(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

function canManageCompanyEvidence(auth: {
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

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown) {
  const text = readString(value);
  return text ? text : null;
}

function readJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as JsonObject;
}

async function resolveCompanyId(params: {
  request: Request;
  auth: {
    role: string;
    team: string;
    user: { id: string };
    supabase: Parameters<typeof getCompanyScope>[0]["supabase"];
    permissionMap?: { can_view_all_company_data?: boolean };
  };
}) {
  const url = new URL(params.request.url);
  const requestedCompanyId = normalizeUuid(url.searchParams.get("companyId"));
  const maySelectCompany =
    isAdminRole(params.auth.role) ||
    Boolean(params.auth.permissionMap?.can_view_all_company_data);
  const companyScope = await getCompanyScope({
    supabase: params.auth.supabase,
    userId: params.auth.user.id,
    fallbackTeam: params.auth.team,
    authUser: params.auth.user,
  });

  return maySelectCompany && requestedCompanyId
    ? requestedCompanyId
    : companyScope.companyId;
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

  if (!canManageCompanyEvidence(auth)) {
    return NextResponse.json(
      { error: "You do not have permission to view company data requests." },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const companyId = await resolveCompanyId({ request, auth });
  if (!companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  const limit = parseBoundedInteger(url.searchParams.get("limit"), 25, 100);
  const offset = parseBoundedInteger(url.searchParams.get("offset"), 0, 10_000);
  const status = readString(url.searchParams.get("status"));

  let query = (
    auth.supabase.from("company_data_requests") as unknown as {
      select: (columns: string, options?: { count?: "exact" }) => DataRequestsQuery;
    }
  )
    .select("*", { count: "exact" })
    .eq("company_id", companyId);

  if (status) {
    query = query.eq("status", status);
  }

  const result = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (isMissingCompanyDataRequestsError(result.error)) {
    return NextResponse.json({
      requests: [],
      pagination: { limit, offset, nextOffset: null, total: 0 },
      warning: "Run the enterprise IT readiness migration to enable company data requests.",
    });
  }

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message || "Failed to load company data requests." },
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
    requests: ((result.data as CompanyDataRequest[] | null) ?? []),
    pagination: { limit, offset, nextOffset, total },
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_manage_company_users",
      "can_manage_users",
      "can_view_analytics",
      "can_view_all_company_data",
    ],
  });

  if ("error" in auth) return auth.error;

  if (!canManageCompanyEvidence(auth)) {
    return NextResponse.json(
      { error: "You do not have permission to create company data requests." },
      { status: 403 }
    );
  }

  const companyId = await resolveCompanyId({ request, auth });
  if (!companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const requestType = normalizeCompanyDataRequestType(
    body?.requestType ?? body?.request_type
  );
  const requestScope =
    normalizeCompanyDataRequestScope(body?.requestScope ?? body?.request_scope) ??
    ("company" satisfies CompanyDataRequestScope);
  const title = readString(body?.title);

  if (!requestType) {
    return NextResponse.json(
      { error: "requestType must be export, deletion, correction, or privacy_review." },
      { status: 400 }
    );
  }

  if (!title) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }

  const payload = {
    company_id: companyId,
    request_type: requestType,
    request_scope: requestScope,
    subject_user_id: normalizeUuid(readOptionalString(body?.subjectUserId ?? body?.subject_user_id)),
    subject_email: readOptionalString(body?.subjectEmail ?? body?.subject_email)?.toLowerCase() ?? null,
    jobsite_id: normalizeUuid(readOptionalString(body?.jobsiteId ?? body?.jobsite_id)),
    document_id: normalizeUuid(readOptionalString(body?.documentId ?? body?.document_id)),
    status: "submitted",
    requested_by: auth.user.id,
    title,
    description: readOptionalString(body?.description),
    due_at: readOptionalString(body?.dueAt ?? body?.due_at),
    metadata: readJsonObject(body?.metadata),
  };

  const result = await (
    auth.supabase.from("company_data_requests") as unknown as {
      insert: (values: Record<string, unknown>) => InsertDataRequestQuery;
    }
  )
    .insert(payload)
    .select("*")
    .single();

  if (isMissingCompanyDataRequestsError(result.error)) {
    return NextResponse.json(
      { error: "Run the enterprise IT readiness migration before creating data requests." },
      { status: 501 }
    );
  }

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message || "Failed to create company data request." },
      { status: 500 }
    );
  }

  const created = result.data as CompanyDataRequest;
  await recordCompanySecurityEvent({
    supabase: auth.supabase,
    companyId,
    actorUserId: auth.user.id,
    actorRole: auth.role,
    eventType: "data_request_submitted",
    resourceType: "data_request",
    resourceId: created.id,
    title: "Company data request submitted",
    detail: `${requestType} request opened for ${requestScope} scope.`,
    ipAddress: getClientIpAddress(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      requestType,
      requestScope,
      status: created.status,
      subjectEmail: created.subject_email,
    },
  });

  return NextResponse.json({ request: created }, { status: 201 });
}
