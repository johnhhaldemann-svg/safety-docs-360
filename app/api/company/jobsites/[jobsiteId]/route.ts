import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

type JobsiteUpdatePayload = {
  name?: string;
  jobsiteNumber?: string;
  projectNumber?: string;
  location?: string;
  status?: string;
  projectManager?: string;
  safetyLead?: string;
  zipCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  auditCustomerId?: string | null;
  customerCompanyName?: string;
  customerReportEmail?: string;
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

function isDuplicateNameViolation(code?: string | null, message?: string | null) {
  return code === "23505" && (message ?? "").toLowerCase().includes("company_jobsites");
}

function isDuplicateJobsiteNumberViolation(code?: string | null, message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return code === "23505" && normalized.includes("jobsite_number");
}

function normalizeEmail(value?: string | null) {
  const email = (value ?? "").trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "invalid";
}

const JOBSITE_SELECT =
  "id, company_id, name, jobsite_number, project_number, location, status, project_manager, safety_lead, zip_code, weather_address_line_1, weather_address_line_2, weather_city, weather_state, weather_country, weather_latitude, weather_longitude, weather_location_source, weather_location_confidence, nws_grid_id, nws_grid_x, nws_grid_y, nws_forecast_url, nws_forecast_hourly_url, weather_enabled, weather_last_checked_at, audit_customer_id, customer_company_name, customer_report_email, start_date, end_date, notes, created_at, updated_at, archived_at";

function normalizeZipCode(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{5})(?:-?(\d{4}))?$/);
  return match ? (match[2] ? `${match[1]}-${match[2]}` : match[1]) : "invalid";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobsiteId: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data", "can_view_analytics"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  const { jobsiteId } = await params;
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

  if (!isAdminRole(auth.role) && auth.role !== "company_admin" && auth.role !== "manager" && auth.role !== "safety_manager") {
    return NextResponse.json(
      { error: "Only company admins, safety managers, and operations managers can manage jobsites." },
      { status: 403 }
    );
  }

  const existingResult = await auth.supabase
    .from("company_jobsites")
    .select("id, company_id")
    .eq("id", jobsiteId)
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
  const trimmedName = typeof body?.name === "string" ? body.name.trim() : undefined;
  if (typeof body?.name === "string" && !trimmedName) {
    return NextResponse.json({ error: "Jobsite name cannot be empty." }, { status: 400 });
  }
  const trimmedJobsiteNumber = typeof body?.jobsiteNumber === "string" ? body.jobsiteNumber.trim() : undefined;
  if (typeof body?.jobsiteNumber === "string" && !trimmedJobsiteNumber) {
    return NextResponse.json({ error: "Jobsite number cannot be empty." }, { status: 400 });
  }
  const customerReportEmail =
    typeof body?.customerReportEmail === "string" ? normalizeEmail(body.customerReportEmail) : undefined;
  const zipCode =
    typeof body?.zipCode === "string" ? normalizeZipCode(body.zipCode) : undefined;
  if (customerReportEmail === "invalid") {
    return NextResponse.json({ error: "Enter a valid customer report email." }, { status: 400 });
  }
  if (zipCode === "invalid") {
    return NextResponse.json({ error: "Enter a valid 5-digit ZIP code or ZIP+4." }, { status: 400 });
  }
  const auditCustomerId =
    typeof body?.auditCustomerId === "string" ? body.auditCustomerId.trim() : body?.auditCustomerId === null ? null : undefined;
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

  if (trimmedName) {
    const escapedName = trimmedName.replace(/[%_]/g, "\\$&");
    const duplicateCheck = await auth.supabase
      .from("company_jobsites")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyScope.companyId)
      .ilike("name", escapedName)
      .neq("id", jobsiteId);

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
  }

  if (trimmedJobsiteNumber) {
    const escapedJobsiteNumber = trimmedJobsiteNumber.replace(/[%_]/g, "\\$&");
    const duplicateJobsiteNumberCheck = await auth.supabase
      .from("company_jobsites")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyScope.companyId)
      .ilike("jobsite_number", escapedJobsiteNumber)
      .neq("id", jobsiteId);

    if (duplicateJobsiteNumberCheck.error) {
      if (isMissingJobsitesTable(duplicateJobsiteNumberCheck.error.message)) {
        return NextResponse.json(
          {
            error:
              "The company jobsites table is not available yet. Run the latest Supabase jobsites migration first.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: duplicateJobsiteNumberCheck.error.message || "Failed to validate the jobsite number." },
        { status: 500 }
      );
    }

    if (duplicateJobsiteNumberCheck.count && duplicateJobsiteNumberCheck.count > 0) {
      return NextResponse.json(
        { error: "A jobsite with this jobsite number already exists for your company." },
        { status: 409 }
      );
    }
  }

  const normalizedStatus = normalizeJobsiteStatus(body?.status);
  const archived =
    typeof body?.archived === "boolean"
      ? body.archived
      : normalizedStatus === "archived";

  const updateValues = {
    ...(typeof trimmedName === "string" ? { name: trimmedName } : {}),
    ...(typeof trimmedJobsiteNumber === "string" ? { jobsite_number: trimmedJobsiteNumber } : {}),
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
    ...(typeof zipCode !== "undefined" ? { zip_code: zipCode } : {}),
    ...(typeof body?.addressLine1 === "string"
      ? { weather_address_line_1: body.addressLine1.trim() || null }
      : {}),
    ...(typeof body?.addressLine2 === "string"
      ? { weather_address_line_2: body.addressLine2.trim() || null }
      : {}),
    ...(typeof body?.city === "string"
      ? { weather_city: body.city.trim() || null }
      : {}),
    ...(typeof body?.state === "string"
      ? { weather_state: body.state.trim().toUpperCase() || null }
      : {}),
    ...(typeof body?.country === "string"
      ? { weather_country: body.country.trim().toUpperCase() || null }
      : {}),
    ...(typeof auditCustomerId !== "undefined" ? { audit_customer_id: auditCustomerId || null } : {}),
    ...(typeof body?.customerCompanyName === "string"
      ? { customer_company_name: body.customerCompanyName.trim() || null }
      : {}),
    ...(typeof customerReportEmail !== "undefined"
      ? { customer_report_email: customerReportEmail }
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
    .eq("id", jobsiteId)
    .eq("company_id", companyScope.companyId)
    .select(JOBSITE_SELECT)
    .single();

  if (updateResult.error) {
    if (isDuplicateNameViolation(updateResult.error.code, updateResult.error.message)) {
      return NextResponse.json(
        { error: "A jobsite with this name already exists for your company." },
        { status: 409 }
      );
    }

    if (isDuplicateJobsiteNumberViolation(updateResult.error.code, updateResult.error.message)) {
      return NextResponse.json(
        { error: "A jobsite with this jobsite number already exists for your company." },
        { status: 409 }
      );
    }

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
