import { NextResponse } from "next/server";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { canManageCompanyPermits } from "@/lib/companyFeatureAccess";
import { getCompanyScope } from "@/lib/companyScope";
import { loadCompanyWorkspaceUsers } from "@/lib/companyWorkspaceDirectory";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { authorizeRequest } from "@/lib/rbac";
import {
  autoAssignSchedulePermits,
  type SchedulePermitAssignmentScope,
} from "@/lib/schedulePermitAutoAssignment";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

function normalizeScope(value: unknown): SchedulePermitAssignmentScope | null {
  const scope = String(value ?? "weekly").trim().toLowerCase();
  return scope === "daily" || scope === "weekly" ? scope : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobsiteId: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_field_work", "can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageCompanyPermits(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "Only permitted field leaders can auto-assign permits." },
      { status: 403 }
    );
  }

  const { jobsiteId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const scope = normalizeScope(body?.scope);
  if (!scope) {
    return NextResponse.json({ error: "scope must be daily or weekly." }, { status: 400 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json(
      { error: "You can only auto-assign permits for assigned jobsites." },
      { status: 403 }
    );
  }

  const adminClient = createSupabaseAdminClient();
  const directory = adminClient
    ? await loadCompanyWorkspaceUsers({
        adminClient,
        authUser: auth.user,
        companyId: companyScope.companyId,
        scopeTeam: companyScope.companyName?.trim() || auth.team || "General",
      })
    : { users: [] };

  const result = await autoAssignSchedulePermits({
    supabase: auth.supabase,
    profileClient: adminClient ?? auth.supabase,
    companyId: companyScope.companyId,
    jobsiteId,
    scope,
    dryRun: Boolean(body?.dryRun),
    actorUserId: auth.user.id,
    directoryUsers: directory.users,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
