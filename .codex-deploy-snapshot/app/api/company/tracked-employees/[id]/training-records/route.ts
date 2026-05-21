import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCompanyScope } from "@/lib/companyScope";
import {
  canMutateCompanyTrainingRequirements,
  canViewCompanyTrainingMatrix,
} from "@/lib/companyTrainingAccess";
import { normalizeDateOnly } from "@/lib/companyTrackedEmployees";
import { authorizeRequest, isCompanyRole, type PermissionMap } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

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

async function employeeExists(db: SupabaseClient, companyId: string, employeeId: string) {
  const result = await db
    .from("company_employee_profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", employeeId)
    .maybeSingle();
  return Boolean(result.data && !result.error);
}

export async function GET(request: Request, context: RouteContext) {
  const resolved = await resolveCompany(request);
  if (resolved.response) return resolved.response;
  if (!("companyScope" in resolved)) {
    return NextResponse.json({ error: "Company workspace is required." }, { status: 400 });
  }
  const auth = resolved.auth as AuthorizedRequestContext;
  const companyScope = resolved.companyScope as CompanyScopeContext;

  if (!canViewCompanyTrainingMatrix(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "You do not have access to tracked employee training data." },
      { status: 403 }
    );
  }

  if (auth.role === "sales_demo") {
    return NextResponse.json({ records: [] });
  }

  const { id: rawId } = await context.params;
  const employeeId = rawId.trim();
  const db = createSupabaseAdminClient() ?? auth.supabase;

  const records = await db
    .from("company_employee_training_records")
    .select("id, company_id, employee_id, requirement_id, title, completed_on, expires_on, provider, source, notes, created_at, updated_at")
    .eq("company_id", companyScope.companyId)
    .eq("employee_id", employeeId)
    .order("completed_on", { ascending: false });

  if (records.error) {
    return NextResponse.json(
      { error: records.error.message || "Failed to load training records." },
      { status: 500 }
    );
  }

  return NextResponse.json({ records: records.data ?? [] });
}

export async function POST(request: Request, context: RouteContext) {
  const resolved = await resolveCompany(request);
  if (resolved.response) return resolved.response;
  if (!("companyScope" in resolved)) {
    return NextResponse.json({ error: "Company workspace is required." }, { status: 400 });
  }
  const auth = resolved.auth as AuthorizedRequestContext;
  const companyScope = resolved.companyScope as CompanyScopeContext;

  if (!canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "Only company admins, managers, and safety managers can add training records." },
      { status: 403 }
    );
  }
  if (auth.role === "sales_demo") {
    return NextResponse.json({ error: "Demo workspaces cannot save tracked employee training." }, { status: 403 });
  }

  const { id: rawId } = await context.params;
  const employeeId = rawId.trim();
  if (!employeeId) return NextResponse.json({ error: "Employee id is required." }, { status: 400 });

  const db = createSupabaseAdminClient() ?? auth.supabase;
  if (!(await employeeExists(db, companyScope.companyId, employeeId))) {
    return NextResponse.json({ error: "Tracked employee not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Request body is required." }, { status: 400 });

  const title = String(body.trainingTitle ?? body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Training title is required." }, { status: 400 });
  }

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

  let requirementId =
    typeof body.requirementId === "string"
      ? body.requirementId.trim()
      : typeof body.requirement_id === "string"
        ? body.requirement_id.trim()
        : "";
  if (requirementId) {
    const requirement = await db
      .from("company_training_requirements")
      .select("id")
      .eq("company_id", companyScope.companyId)
      .eq("id", requirementId)
      .maybeSingle();
    if (requirement.error) {
      return NextResponse.json(
        { error: requirement.error.message || "Failed to validate training requirement." },
        { status: 500 }
      );
    }
    if (!requirement.data) {
      return NextResponse.json({ error: "Training requirement not found." }, { status: 400 });
    }
  } else {
    requirementId = "";
  }

  const result = await db
    .from("company_employee_training_records")
    .insert({
      company_id: companyScope.companyId,
      employee_id: employeeId,
      requirement_id: requirementId || null,
      title,
      completed_on: completedOn,
      expires_on: expiresOn,
      provider: typeof body.provider === "string" ? body.provider.trim() || null : null,
      source: typeof body.source === "string" ? body.source.trim() || "manual" : "manual",
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select("id, company_id, employee_id, requirement_id, title, completed_on, expires_on, provider, source, notes, created_at, updated_at")
    .single();

  if (result.error || !result.data) {
    return NextResponse.json(
      { error: result.error?.message || "Failed to add training record." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, record: result.data });
}
