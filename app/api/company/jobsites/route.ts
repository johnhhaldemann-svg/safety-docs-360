import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

type JobsitePayload = {
  name?: string;
  projectNumber?: string;
  location?: string;
  status?: string;
  projectManager?: string;
  safetyLead?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
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

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data", "can_view_analytics"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
  });

  if (!companyScope.companyId) {
    return NextResponse.json({ jobsites: [] });
  }

  const jobsitesResult = await auth.supabase
    .from("company_jobsites")
    .select(
      "id, company_id, name, project_number, location, status, project_manager, safety_lead, start_date, end_date, notes, created_at, updated_at, archived_at"
    )
    .eq("company_id", companyScope.companyId)
    .order("updated_at", { ascending: false });

  if (jobsitesResult.error) {
    if (isMissingJobsitesTable(jobsitesResult.error.message)) {
      return NextResponse.json({
        jobsites: [],
        warning:
          "The company jobsites table has not been created yet, so the workspace is using document-based jobsite grouping for now.",
      });
    }

    return NextResponse.json(
      { error: jobsitesResult.error.message || "Failed to load company jobsites." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    jobsites: jobsitesResult.data ?? [],
    scopeCompanyId: companyScope.companyId,
    scopeCompanyName: companyScope.companyName,
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data", "can_view_analytics"],
  });

  if ("error" in auth) {
    return auth.error;
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

  if (!isAdminRole(auth.role) && auth.role !== "company_admin" && auth.role !== "manager") {
    return NextResponse.json(
      { error: "Only company admins and operations managers can add jobsites." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as JobsitePayload | null;
  const name = body?.name?.trim() ?? "";
  const projectNumber = body?.projectNumber?.trim() ?? "";
  const location = body?.location?.trim() ?? "";
  const projectManager = body?.projectManager?.trim() ?? "";
  const safetyLead = body?.safetyLead?.trim() ?? "";
  const startDate = body?.startDate?.trim() ?? "";
  const endDate = body?.endDate?.trim() ?? "";
  const notes = body?.notes?.trim() ?? "";
  const status = normalizeJobsiteStatus(body?.status);

  if (!name) {
    return NextResponse.json({ error: "Jobsite name is required." }, { status: 400 });
  }

  const insertResult = await auth.supabase
    .from("company_jobsites")
    .insert({
      company_id: companyScope.companyId,
      name,
      project_number: projectNumber || null,
      location: location || null,
      status,
      project_manager: projectManager || null,
      safety_lead: safetyLead || null,
      start_date: startDate || null,
      end_date: endDate || null,
      notes: notes || null,
      created_by: auth.user.id,
      updated_by: auth.user.id,
      archived_at: status === "archived" ? new Date().toISOString() : null,
    })
    .select(
      "id, company_id, name, project_number, location, status, project_manager, safety_lead, start_date, end_date, notes, created_at, updated_at, archived_at"
    )
    .single();

  if (insertResult.error) {
    if (isMissingJobsitesTable(insertResult.error.message)) {
      return NextResponse.json(
        {
          error:
            "The company jobsites table is not available yet. Run the latest Supabase jobsites migration first.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: insertResult.error.message || "Failed to create the jobsite." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    jobsite: insertResult.data,
    message: "Jobsite added to the company workspace.",
  });
}
