import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCompanyScope } from "@/lib/companyScope";
import { canMutateCompanyTrainingRequirements } from "@/lib/companyTrainingAccess";
import { normalizeDateOnly } from "@/lib/companyTrackedEmployees";
import { authorizeRequest, isCompanyRole, type PermissionMap } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; recordId: string }> };

type AuthorizedRequestContext = {
  supabase: SupabaseClient;
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> };
  role: string;
  team: string;
  permissionMap: PermissionMap;
};

type CompanyScopeContext = { companyId: string; companyName: string };

async function resolveCompany(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return { auth, response: auth.error } as const;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (isCompanyRole(auth.role) && !companyScope.companyId) {
    return {
      auth,
      response: NextResponse.json(
        { error: "This company account is not linked to a company workspace yet." },
        { status: 400 }
      ),
    } as const;
  }

  if (!companyScope.companyId) {
    return {
      auth,
      response: NextResponse.json({ error: "Company workspace is required." }, { status: 400 }),
    } as const;
  }

  return { auth, companyScope, response: null } as const;
}

function cleanOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

async function validateRequirement(
  db: SupabaseClient,
  companyId: string,
  value: unknown
): Promise<{ requirementId?: string | null; response?: NextResponse }> {
  if (value === undefined) return {};
  const requirementId = typeof value === "string" ? value.trim() : "";
  if (!requirementId) return { requirementId: null };

  const requirement = await db
    .from("company_training_requirements")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", requirementId)
    .maybeSingle();

  if (requirement.error) {
    return {
      response: NextResponse.json(
        { error: requirement.error.message || "Failed to validate training requirement." },
        { status: 500 }
      ),
    };
  }
  if (!requirement.data) {
    return {
      response: NextResponse.json({ error: "Training requirement not found." }, { status: 400 }),
    };
  }
  return { requirementId };
}

export async function PATCH(request: Request, context: RouteContext) {
  const resolved = await resolveCompany(request);
  if (resolved.response) return resolved.response;
  if (!("companyScope" in resolved)) {
    return NextResponse.json({ error: "Company workspace is required." }, { status: 400 });
  }
  const auth = resolved.auth as AuthorizedRequestContext;
  const companyScope = resolved.companyScope as CompanyScopeContext;

  if (!canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "Only company admins, managers, and safety managers can update training records." },
      { status: 403 }
    );
  }
  if (auth.role === "sales_demo") {
    return NextResponse.json({ error: "Demo workspaces cannot update tracked employee training." }, { status: 403 });
  }

  const { id: rawId, recordId: rawRecordId } = await context.params;
  const employeeId = rawId.trim();
  const recordId = rawRecordId.trim();
  if (!employeeId || !recordId) {
    return NextResponse.json({ error: "Employee id and training record id are required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Request body is required." }, { status: 400 });

  const title = String(body.trainingTitle ?? body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Training title is required." }, { status: 400 });

  const completedOn = normalizeDateOnly(body.completedOn ?? body.completed_on);
  const expiresOn = normalizeDateOnly(body.expiresOn ?? body.expires_on);
  if ((body.completedOn || body.completed_on) && !completedOn) {
    return NextResponse.json({ error: "Completed date is not valid." }, { status: 400 });
  }
  if ((body.expiresOn || body.expires_on) && !expiresOn) {
    return NextResponse.json({ error: "Expiration date is not valid." }, { status: 400 });
  }
  if (completedOn && expiresOn && expiresOn < completedOn) {
    return NextResponse.json({ error: "Expiration date must be after completed date." }, { status: 400 });
  }

  const db = createSupabaseAdminClient() ?? auth.supabase;
  const requirement = await validateRequirement(
    db,
    companyScope.companyId,
    body.requirementId ?? body.requirement_id
  );
  if (requirement.response) return requirement.response;

  const updates: Record<string, unknown> = {
    title,
    completed_on: completedOn,
    expires_on: expiresOn,
    provider: cleanOptionalText(body.provider),
    source: typeof body.source === "string" ? body.source.trim() || "manual" : "manual",
    notes: cleanOptionalText(body.notes),
    updated_by: auth.user.id,
  };
  if ("requirementId" in body || "requirement_id" in body) {
    updates.requirement_id = requirement.requirementId ?? null;
  }

  const result = await db
    .from("company_employee_training_records")
    .update(updates)
    .eq("company_id", companyScope.companyId)
    .eq("employee_id", employeeId)
    .eq("id", recordId)
    .select("id, company_id, employee_id, requirement_id, title, completed_on, expires_on, provider, source, notes, created_at, updated_at")
    .maybeSingle();

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message || "Failed to update training record." },
      { status: 500 }
    );
  }
  if (!result.data) {
    return NextResponse.json({ error: "Training record not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, record: result.data });
}

export async function DELETE(request: Request, context: RouteContext) {
  const resolved = await resolveCompany(request);
  if (resolved.response) return resolved.response;
  if (!("companyScope" in resolved)) {
    return NextResponse.json({ error: "Company workspace is required." }, { status: 400 });
  }
  const auth = resolved.auth as AuthorizedRequestContext;
  const companyScope = resolved.companyScope as CompanyScopeContext;

  if (!canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "Only company admins, managers, and safety managers can delete training records." },
      { status: 403 }
    );
  }
  if (auth.role === "sales_demo") {
    return NextResponse.json({ error: "Demo workspaces cannot delete tracked employee training." }, { status: 403 });
  }

  const { id: rawId, recordId: rawRecordId } = await context.params;
  const employeeId = rawId.trim();
  const recordId = rawRecordId.trim();
  if (!employeeId || !recordId) {
    return NextResponse.json({ error: "Employee id and training record id are required." }, { status: 400 });
  }

  const db = createSupabaseAdminClient() ?? auth.supabase;
  const result = await db
    .from("company_employee_training_records")
    .delete()
    .eq("company_id", companyScope.companyId)
    .eq("employee_id", employeeId)
    .eq("id", recordId)
    .select("id")
    .maybeSingle();

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message || "Failed to delete training record." },
      { status: 500 }
    );
  }
  if (!result.data) {
    return NextResponse.json({ error: "Training record not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
