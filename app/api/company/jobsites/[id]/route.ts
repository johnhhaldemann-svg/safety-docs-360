import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

type JobsiteUpdatePayload = {
  name?: string;
  projectNumber?: string;
  location?: string;
  status?: string;
  projectManager?: string;
  safetyLead?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  archived?: boolean;
};

const JOBSITE_STATUSES = new Set(["planned", "active", "completed", "archived"]);

function normalizeJobsiteStatus(status?: string | null) {
  const normalized = (status ?? "").trim().toLowerCase();
  return JOBSITE_STATUSES.has(normalized) ? normalized : "active";
}

function isMissingJobsitesTable(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("company_jobsites");
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data", "can_view_analytics"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await params;
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

  if (!isAdminRole(auth.role) && auth.role !== "company_admin" && auth.role !== "manager") {
    return NextResponse.json(
      { error: "Only company admins and operations managers can manage jobsites." },
      { status: 403 }
    );
  }

  const existingResult = await auth.supabase
    .from("company_jobsites")
    .select("id, company_id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (existingResult.error) {
    if (isMissingJobsitesTable(existingResult.error.message)) {
      return NextResponse.json(
        {
          error:
            "The company jobsites table is not available yet. Run the latest Supabase jobsites migration first.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: existingResult.error.message || "Failed to find the jobsite." },
      { status: 500 }
    );
  }

  if (!existingResult.data) {
    return NextResponse.json({ error: "Jobsite not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as JobsiteUpdatePayload | null;
  const normalizedStatus = normalizeJobsiteStatus(body?.status);
  const archived =
    typeof body?.archived === "boolean"
      ? body.archived
      : normalizedStatus === "archived";

  const updateValues = {
    ...(typeof body?.name === "string" ? { name: body.name.trim() || null } : {}),
    ...(typeof body?.projectNumber === "string"
      ? { project_number: body.projectNumber.trim() || null }
      : {}),
    ...(typeof body?.location === "string" ? { location: body.location.trim() || null } : {}),
    ...(typeof body?.projectManager === "string"
      ? { project_manager: body.projectManager.trim() || null }
      : {}),
    ...(typeof body?.safetyLead === "string"
      ? { safety_lead: body.safetyLead.trim() || null }
      : {}),
    ...(typeof body?.startDate === "string" ? { start_date: body.startDate.trim() || null } : {}),
    ...(typeof body?.endDate === "string" ? { end_date: body.endDate.trim() || null } : {}),
    ...(typeof body?.notes === "string" ? { notes: body.notes.trim() || null } : {}),
    ...(body?.status ? { status: archived ? "archived" : normalizedStatus } : {}),
    archived_at: archived ? new Date().toISOString() : null,
    updated_by: auth.user.id,
  };

  const updateResult = await auth.supabase
    .from("company_jobsites")
    .update(updateValues)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select(
      "id, company_id, name, project_number, location, status, project_manager, safety_lead, start_date, end_date, notes, created_at, updated_at, archived_at"
    )
    .single();

  if (updateResult.error) {
    return NextResponse.json(
      { error: updateResult.error.message || "Failed to update the jobsite." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    jobsite: updateResult.data,
    message: archived ? "Jobsite archived." : "Jobsite updated.",
  });
}
