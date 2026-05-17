import { NextResponse } from "next/server";
import { getCompanyScope, normalizeUuid } from "@/lib/companyScope";
import { canManageCompanyAccess } from "@/lib/companyPermissions";
import {
  isMissingCompanyDataRequestsError,
  normalizeCompanyDataRequestStatus,
} from "@/lib/companyDataRequests";
import { recordCompanySecurityEvent } from "@/lib/companySecurityEvents";
import { getClientIpAddress } from "@/lib/legal";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import type {
  CompanyDataRequest,
  CompanyDataRequestStatus,
  JsonObject,
} from "@/types/enterprise-readiness";

export const runtime = "nodejs";

type MessageError = { message?: string | null };

type SelectSingleQuery = {
  eq: (column: string, value: string) => SelectSingleQuery;
  maybeSingle: () => PromiseLike<{
    data: unknown;
    error: MessageError | null;
  }>;
};

type UpdateQuery = {
  eq: (column: string, value: string) => UpdateQuery;
  select: (columns: string) => {
    single: () => PromiseLike<{
      data: unknown;
      error: MessageError | null;
    }>;
  };
};

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

function readJsonObject(value: unknown): JsonObject | undefined {
  if (value === undefined) return undefined;
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

function buildStatusPatch(params: {
  status: CompanyDataRequestStatus | null;
  actorUserId: string;
  nowIso: string;
}) {
  if (!params.status) return {};

  const patch: Record<string, unknown> = {
    status: params.status,
  };

  if (
    params.status === "reviewing" ||
    params.status === "waiting_on_customer" ||
    params.status === "denied"
  ) {
    patch.reviewed_by = params.actorUserId;
    patch.reviewed_at = params.nowIso;
  }

  if (params.status === "completed") {
    patch.reviewed_by = params.actorUserId;
    patch.reviewed_at = params.nowIso;
    patch.completed_by = params.actorUserId;
    patch.completed_at = params.nowIso;
  }

  return patch;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
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
      { error: "You do not have permission to update company data requests." },
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

  const { id } = await context.params;
  const requestId = normalizeUuid(id);
  if (!requestId) {
    return NextResponse.json({ error: "Invalid data request id." }, { status: 400 });
  }

  const existingResult = await (
    auth.supabase.from("company_data_requests") as unknown as {
      select: (columns: string) => SelectSingleQuery;
    }
  )
    .select("*")
    .eq("id", requestId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (isMissingCompanyDataRequestsError(existingResult.error)) {
    return NextResponse.json(
      { error: "Run the enterprise IT readiness migration before updating data requests." },
      { status: 501 }
    );
  }

  if (existingResult.error) {
    return NextResponse.json(
      { error: existingResult.error.message || "Failed to load company data request." },
      { status: 500 }
    );
  }

  if (!existingResult.data) {
    return NextResponse.json({ error: "Data request not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const nextStatus = normalizeCompanyDataRequestStatus(body?.status);
  if ("status" in (body ?? {}) && !nextStatus) {
    return NextResponse.json(
      {
        error:
          "status must be submitted, reviewing, waiting_on_customer, completed, denied, or canceled.",
      },
      { status: 400 }
    );
  }
  const patch: Record<string, unknown> = {
    ...buildStatusPatch({
      status: nextStatus,
      actorUserId: auth.user.id,
      nowIso: new Date().toISOString(),
    }),
  };

  if ("reviewerNotes" in (body ?? {}) || "reviewer_notes" in (body ?? {})) {
    patch.reviewer_notes = readOptionalString(body?.reviewerNotes ?? body?.reviewer_notes);
  }
  if ("completionEvidence" in (body ?? {}) || "completion_evidence" in (body ?? {})) {
    patch.completion_evidence = readOptionalString(
      body?.completionEvidence ?? body?.completion_evidence
    );
  }
  if ("evidenceStoragePath" in (body ?? {}) || "evidence_storage_path" in (body ?? {})) {
    patch.evidence_storage_path = readOptionalString(
      body?.evidenceStoragePath ?? body?.evidence_storage_path
    );
  }
  if ("dueAt" in (body ?? {}) || "due_at" in (body ?? {})) {
    patch.due_at = readOptionalString(body?.dueAt ?? body?.due_at);
  }
  if ("title" in (body ?? {})) {
    const title = readString(body?.title);
    if (!title) {
      return NextResponse.json({ error: "title cannot be blank." }, { status: 400 });
    }
    patch.title = title;
  }
  if ("description" in (body ?? {})) {
    patch.description = readOptionalString(body?.description);
  }
  if ("metadata" in (body ?? {})) {
    patch.metadata = readJsonObject(body?.metadata);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Provide at least one data request field to update." },
      { status: 400 }
    );
  }

  const updateResult = await (
    auth.supabase.from("company_data_requests") as unknown as {
      update: (values: Record<string, unknown>) => UpdateQuery;
    }
  )
    .update(patch)
    .eq("id", requestId)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (updateResult.error) {
    return NextResponse.json(
      { error: updateResult.error.message || "Failed to update company data request." },
      { status: 500 }
    );
  }

  const updated = updateResult.data as CompanyDataRequest;
  await recordCompanySecurityEvent({
    supabase: auth.supabase,
    companyId,
    actorUserId: auth.user.id,
    actorRole: auth.role,
    eventType: updated.status === "completed" ? "data_request_completed" : "data_request_updated",
    resourceType: "data_request",
    resourceId: updated.id,
    title:
      updated.status === "completed"
        ? "Company data request completed"
        : "Company data request updated",
    detail: `${updated.request_type} request is ${updated.status}.`,
    ipAddress: getClientIpAddress(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      previousStatus: (existingResult.data as CompanyDataRequest).status,
      nextStatus: updated.status,
    },
  });

  return NextResponse.json({ request: updated });
}
