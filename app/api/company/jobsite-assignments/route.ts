import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole, normalizeAppRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

type AssignmentPayload = {
  userId?: string;
  jobsiteIds?: string[];
};

function canManageAssignments(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager"
  );
}

function isMissingAssignmentsTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_jobsite_assignments");
}

function roleNeedsJobsiteAssignments(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return (
    normalized === "project_manager" ||
    normalized === "foreman" ||
    normalized === "field_user" ||
    normalized === "read_only" ||
    normalized === "company_user"
  );
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data", "can_view_dashboards"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ jobsites: [], assignments: [] });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim() || "";

  const jobsitesResult = await auth.supabase
    .from("company_jobsites")
    .select("id, name, status")
    .eq("company_id", companyScope.companyId)
    .order("name", { ascending: true });
  if (jobsitesResult.error) {
    return NextResponse.json(
      { error: jobsitesResult.error.message || "Failed to load jobsites." },
      { status: 500 }
    );
  }

  let assignmentQuery = auth.supabase
    .from("company_jobsite_assignments")
    .select("id, user_id, jobsite_id, role")
    .eq("company_id", companyScope.companyId);
  if (userId) {
    assignmentQuery = assignmentQuery.eq("user_id", userId);
  }
  const assignmentsResult = await assignmentQuery;
  if (assignmentsResult.error) {
    if (isMissingAssignmentsTable(assignmentsResult.error.message)) {
      return NextResponse.json(
        {
          jobsites: jobsitesResult.data ?? [],
          assignments: [],
          warning:
            "Jobsite assignments table is not available yet. Run the latest Supabase migration first.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: assignmentsResult.error.message || "Failed to load jobsite assignments." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    jobsites: jobsitesResult.data ?? [],
    assignments: assignmentsResult.data ?? [],
  });
}

export async function PUT(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageAssignments(auth.role)) {
    return NextResponse.json(
      { error: "Only company admins, safety managers, and operations managers can manage assignments." },
      { status: 403 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
  });
  if (!companyScope.companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => null)) as AssignmentPayload | null;
  const userId = body?.userId?.trim() ?? "";
  const jobsiteIds = (body?.jobsiteIds ?? []).map((id) => id.trim()).filter(Boolean);
  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const roleResult = await auth.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (roleResult.error) {
    return NextResponse.json(
      { error: roleResult.error.message || "Failed to validate target user role." },
      { status: 500 }
    );
  }
  if (!roleResult.data) {
    return NextResponse.json({ error: "Target user is not in this company." }, { status: 404 });
  }
  if (!roleNeedsJobsiteAssignments(roleResult.data.role)) {
    return NextResponse.json(
      { error: "This role has company-wide access and does not require jobsite assignments." },
      { status: 400 }
    );
  }

  const validJobsitesResult = await auth.supabase
    .from("company_jobsites")
    .select("id")
    .eq("company_id", companyScope.companyId)
    .in("id", jobsiteIds.length > 0 ? jobsiteIds : ["00000000-0000-0000-0000-000000000000"]);
  if (jobsiteIds.length > 0 && validJobsitesResult.error) {
    return NextResponse.json(
      { error: validJobsitesResult.error.message || "Failed to validate jobsite assignments." },
      { status: 500 }
    );
  }
  const validIds = new Set(
    ((validJobsitesResult.data as Array<{ id: string }> | null) ?? []).map((row) => row.id)
  );
  const invalidIds = jobsiteIds.filter((id) => !validIds.has(id));
  if (invalidIds.length > 0) {
    return NextResponse.json(
      { error: "One or more jobsites are invalid for this company scope." },
      { status: 400 }
    );
  }

  const deleteResult = await auth.supabase
    .from("company_jobsite_assignments")
    .delete()
    .eq("company_id", companyScope.companyId)
    .eq("user_id", userId);
  if (deleteResult.error && !isMissingAssignmentsTable(deleteResult.error.message)) {
    return NextResponse.json(
      { error: deleteResult.error.message || "Failed to clear existing assignments." },
      { status: 500 }
    );
  }

  const assignmentRole = normalizeAppRole(roleResult.data?.role ?? null);

  if (jobsiteIds.length > 0) {
    const insertResult = await auth.supabase.from("company_jobsite_assignments").insert(
      jobsiteIds.map((jobsiteId) => ({
        company_id: companyScope.companyId,
        user_id: userId,
        jobsite_id: jobsiteId,
        role: assignmentRole,
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
    userId,
    assignedJobsiteCount: jobsiteIds.length,
  });
}
