import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCompanyScope } from "@/lib/companyScope";
import {
  canMutateCompanyTrainingRequirements,
  canViewCompanyTrainingMatrix,
} from "@/lib/companyTrainingAccess";
import {
  loadTrackedCompanyEmployees,
  normalizeEmployeeStatus,
  normalizeReadinessStatus,
} from "@/lib/companyTrackedEmployees";
import {
  upsertTrackedEmployeeRows,
} from "@/lib/companyOnboardingPersistence";
import {
  normalizeRowsArray,
  validateEmployeeImportRows,
} from "@/lib/companyOnboardingImport";
import { authorizeRequest, isCompanyRole, type PermissionMap } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

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

export async function GET(request: Request) {
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
    return NextResponse.json({ employees: [], jobsites: [], warning: null });
  }

  const db = createSupabaseAdminClient() ?? auth.supabase;
  const tracked = await loadTrackedCompanyEmployees({
    db,
    companyId: companyScope.companyId,
  });

  if (tracked.error) {
    return NextResponse.json({ error: tracked.error }, { status: 500 });
  }

  const jobsitesResult = await db
    .from("company_jobsites")
    .select("id, name, status")
    .eq("company_id", companyScope.companyId)
    .neq("status", "archived")
    .order("name", { ascending: true });

  return NextResponse.json({
    employees: tracked.employees,
    jobsites: jobsitesResult.error ? [] : jobsitesResult.data ?? [],
    warning: tracked.warning ?? jobsitesResult.error?.message ?? null,
  });
}

export async function POST(request: Request) {
  const resolved = await resolveCompany(request);
  if (resolved.response) return resolved.response;
  if (!("companyScope" in resolved)) {
    return NextResponse.json({ error: "Company workspace is required." }, { status: 400 });
  }
  const auth = resolved.auth as AuthorizedRequestContext;
  const companyScope = resolved.companyScope as CompanyScopeContext;

  if (!canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "Only company admins, managers, and safety managers can add tracked employees." },
      { status: 403 }
    );
  }

  if (auth.role === "sales_demo") {
    return NextResponse.json({ error: "Demo workspaces cannot save tracked employees." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Request body is required." }, { status: 400 });
  }

  const normalizedRows = normalizeRowsArray([
    {
      ...body,
      readiness_status: normalizeReadinessStatus(body.readiness_status ?? body.readinessStatus),
      status: normalizeEmployeeStatus(body.status),
    },
  ]);
  const validation = validateEmployeeImportRows(normalizedRows);
  if (validation.rowErrors.length > 0 || validation.validRows.length === 0) {
    return NextResponse.json(
      { error: validation.rowErrors[0]?.message ?? "Employee row is not valid.", rowErrors: validation.rowErrors },
      { status: 400 }
    );
  }

  const result = await upsertTrackedEmployeeRows({
    db: createSupabaseAdminClient() ?? auth.supabase,
    companyId: companyScope.companyId,
    actorUserId: auth.user.id,
    rows: validation.validRows,
    source: "manual",
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    employee: result.employees.at(-1) ?? null,
    rowErrors: result.rowErrors,
  });
}
