import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { canMutateCompanyTrainingRequirements } from "@/lib/companyTrainingAccess";
import { isMissingTrackedEmployeesSchemaError, uniqueStrings } from "@/lib/companyTrackedEmployees";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type AssignmentPayload = {
  jobsiteIds?: string[];
};

export async function PUT(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  if (!canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "Only company admins, managers, and safety managers can assign tracked employees to jobsites." },
      { status: 403 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (isCompanyRole(auth.role) && !companyScope.companyId) {
    return NextResponse.json(
      { error: "This company account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Company workspace is required." }, { status: 400 });
  }
  if (auth.role === "sales_demo") {
    return NextResponse.json({ error: "Demo workspaces cannot save tracked employee jobsite assignments." }, { status: 403 });
  }

  const { id: rawId } = await context.params;
  const employeeId = rawId.trim();
  if (!employeeId) {
    return NextResponse.json({ error: "Employee id is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as AssignmentPayload | null;
  if (body?.jobsiteIds !== undefined && !Array.isArray(body.jobsiteIds)) {
    return NextResponse.json({ error: "jobsiteIds must be an array." }, { status: 400 });
  }
  const jobsiteIds = uniqueStrings((body?.jobsiteIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean));

  const db = createSupabaseAdminClient() ?? auth.supabase;

  const employeeResult = await db
    .from("company_employee_profiles")
    .select("id, status")
    .eq("company_id", companyScope.companyId)
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeResult.error) {
    return NextResponse.json(
      { error: employeeResult.error.message || "Failed to validate tracked employee." },
      { status: 500 }
    );
  }
  if (!employeeResult.data) {
    return NextResponse.json({ error: "Tracked employee not found." }, { status: 404 });
  }
  if ((employeeResult.data as { status?: string | null }).status === "archived") {
    return NextResponse.json({ error: "Archived tracked employees cannot be assigned to jobsites." }, { status: 400 });
  }

  if (jobsiteIds.length > 0) {
    const jobsitesResult = await db
      .from("company_jobsites")
      .select("id")
      .eq("company_id", companyScope.companyId)
      .neq("status", "archived")
      .in("id", jobsiteIds);

    if (jobsitesResult.error) {
      return NextResponse.json(
        { error: jobsitesResult.error.message || "Failed to validate jobsite assignments." },
        { status: 500 }
      );
    }

    const validIds = new Set(((jobsitesResult.data as Array<{ id: string }> | null) ?? []).map((row) => row.id));
    const invalidIds = jobsiteIds.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "One or more jobsites are invalid for this company scope." },
        { status: 400 }
      );
    }
  }

  const currentResult = await db
    .from("company_employee_jobsite_assignments")
    .select("id, jobsite_id")
    .eq("company_id", companyScope.companyId)
    .eq("employee_id", employeeId)
    .eq("status", "active");

  if (currentResult.error) {
    if (isMissingTrackedEmployeesSchemaError(currentResult.error.message)) {
      return NextResponse.json(
        { error: "Tracked employee jobsite assignment schema is not installed yet." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: currentResult.error.message || "Failed to load current jobsite assignments." },
      { status: 500 }
    );
  }

  const currentRows = (currentResult.data as Array<{ id: string; jobsite_id: string }> | null) ?? [];
  const requestedIds = new Set(jobsiteIds);
  const currentIds = new Set(currentRows.map((row) => row.jobsite_id));
  const removedAssignmentIds = currentRows
    .filter((row) => !requestedIds.has(row.jobsite_id))
    .map((row) => row.id);
  const missingJobsiteIds = jobsiteIds.filter((id) => !currentIds.has(id));

  if (removedAssignmentIds.length > 0) {
    const archiveResult = await db
      .from("company_employee_jobsite_assignments")
      .update({
        status: "archived",
        archived_at: new Date().toISOString(),
        archived_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .eq("company_id", companyScope.companyId)
      .eq("employee_id", employeeId)
      .in("id", removedAssignmentIds);

    if (archiveResult.error) {
      return NextResponse.json(
        { error: archiveResult.error.message || "Failed to archive removed jobsite assignments." },
        { status: 500 }
      );
    }
  }

  if (missingJobsiteIds.length > 0) {
    const insertResult = await db.from("company_employee_jobsite_assignments").insert(
      missingJobsiteIds.map((jobsiteId) => ({
        company_id: companyScope.companyId,
        employee_id: employeeId,
        jobsite_id: jobsiteId,
        status: "active",
        created_by: auth.user.id,
        updated_by: auth.user.id,
      }))
    );

    if (insertResult.error) {
      return NextResponse.json(
        { error: insertResult.error.message || "Failed to save jobsite assignments." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    employeeId,
    assignedJobsiteCount: jobsiteIds.length,
  });
}
