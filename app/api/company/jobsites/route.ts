import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope } from "@/lib/jobsiteAccess";
import { demoCompanyJobsiteRows } from "@/lib/demoWorkspace";

export const runtime = "nodejs";

type JobsitePayload = {
  name?: string;
  projectNumber?: string;
  location?: string;
  status?: string;
  projectManager?: string;
  safetyLead?: string;
  auditCustomerId?: string | null;
  customerCompanyName?: string;
  customerReportEmail?: string;
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

function isDuplicateNameViolation(code?: string | null, message?: string | null) {
  return code === "23505" && (message ?? "").toLowerCase().includes("company_jobsites");
}

function normalizeEmail(value?: string | null) {
  const email = (value ?? "").trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "invalid";
}

const JOBSITE_SELECT =
  "id, company_id, name, project_number, location, status, project_manager, safety_lead, audit_customer_id, customer_company_name, customer_report_email, start_date, end_date, notes, created_at, updated_at, archived_at";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_manage_company_users",
      "can_view_all_company_data",
      "can_view_analytics",
      "can_manage_daps",
      "can_create_documents",
      "can_view_dashboards",
    ],
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (auth.role === "sales_demo") {
    return NextResponse.json({
      jobsites: demoCompanyJobsiteRows,
      scopeCompanyId: "demo-company",
      scopeCompanyName: "Summit Ridge Constructors",
    });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json({ jobsites: [] });
  }

  /**
   * Reads must use `company_jobsites` first — that is what POST inserts into.
   * `compat_company_jobsites` projects legacy `public.jobsites`; if that view exists and returns
   * rows, we previously preferred it and hid every managed jobsite created via this API (empty list
   * after “success”).
   */
  const tableResult = await auth.supabase
    .from("company_jobsites")
    .select(JOBSITE_SELECT)
    .eq("company_id", companyScope.companyId)
    .order("updated_at", { ascending: false });

  let jobsitesResult = tableResult;

  if (tableResult.error && isMissingJobsitesTable(tableResult.error.message)) {
    const compatJobsitesResult = await auth.supabase
      .from("compat_company_jobsites")
      .select(
        "id, company_id, name, project_number, location, status, start_date, end_date, notes, created_at, updated_at"
      )
      .eq("company_id", companyScope.companyId)
      .order("updated_at", { ascending: false });

    if (!compatJobsitesResult.error) {
      jobsitesResult = {
        data: (compatJobsitesResult.data ?? []).map((row) => ({
          ...row,
          project_manager: null,
          safety_lead: null,
          audit_customer_id: null,
          customer_company_name: null,
          customer_report_email: null,
          archived_at: row.status === "archived" ? row.updated_at : null,
        })),
        error: null,
      } as unknown as typeof tableResult;
    }
  }
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

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

  const allJobsites = jobsitesResult.data ?? [];
  const jobsites =
    jobsiteScope.restricted && jobsiteScope.jobsiteIds.length > 0
      ? allJobsites.filter((jobsite) => jobsiteScope.jobsiteIds.includes(jobsite.id))
      : jobsiteScope.restricted
        ? []
        : allJobsites;

  return NextResponse.json({
    jobsites,
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
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  if (
    !isAdminRole(auth.role) &&
    auth.role !== "company_admin" &&
    auth.role !== "manager" &&
    auth.role !== "safety_manager"
  ) {
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
  const auditCustomerId = body?.auditCustomerId?.trim() ?? "";
  const customerCompanyName = body?.customerCompanyName?.trim() ?? "";
  const customerReportEmail = normalizeEmail(body?.customerReportEmail);
  const startDate = body?.startDate?.trim() ?? "";
  const endDate = body?.endDate?.trim() ?? "";
  const notes = body?.notes?.trim() ?? "";
  const status = normalizeJobsiteStatus(body?.status);

  if (!name) {
    return NextResponse.json({ error: "Jobsite name is required." }, { status: 400 });
  }
  if (customerReportEmail === "invalid") {
    return NextResponse.json({ error: "Enter a valid customer report email." }, { status: 400 });
  }
  if (auditCustomerId) {
    const customerCheck = await auth.supabase
      .from("company_audit_customers")
      .select("id")
      .eq("company_id", companyScope.companyId)
      .eq("id", auditCustomerId)
      .maybeSingle();

    if (customerCheck.error) {
      return NextResponse.json(
        { error: customerCheck.error.message || "Failed to validate the audit customer." },
        { status: 500 }
      );
    }
    if (!customerCheck.data) {
      return NextResponse.json({ error: "Select a valid audit customer for this jobsite." }, { status: 400 });
    }
  }

  const escapedName = name.replace(/[%_]/g, "\\$&");
  const duplicateCheck = await auth.supabase
    .from("company_jobsites")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyScope.companyId)
    .ilike("name", escapedName);

  if (duplicateCheck.error) {
    if (isMissingJobsitesTable(duplicateCheck.error.message)) {
      return NextResponse.json(
        {
          error:
            "The company jobsites table is not available yet. Run the latest Supabase jobsites migration first.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: duplicateCheck.error.message || "Failed to validate the jobsite name." },
      { status: 500 }
    );
  }

  if (duplicateCheck.count && duplicateCheck.count > 0) {
    return NextResponse.json(
      { error: "A jobsite with this name already exists for your company." },
      { status: 409 }
    );
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
      audit_customer_id: auditCustomerId || null,
      customer_company_name: customerCompanyName || null,
      customer_report_email: customerReportEmail,
      start_date: startDate || null,
      end_date: endDate || null,
      notes: notes || null,
      created_by: auth.user.id,
      updated_by: auth.user.id,
      archived_at: status === "archived" ? new Date().toISOString() : null,
    })
    .select(JOBSITE_SELECT)
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

    if (isDuplicateNameViolation(insertResult.error.code, insertResult.error.message)) {
      return NextResponse.json(
        { error: "A jobsite with this name already exists for your company." },
        { status: 409 }
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
