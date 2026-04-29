import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";

export const runtime = "nodejs";

type LocationPayload = {
  auditCustomerId?: string | null;
  name?: string;
  projectNumber?: string | null;
  location?: string | null;
  reportEmail?: string | null;
  status?: string | null;
  projectManager?: string | null;
  safetyLead?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
};

const LOCATION_SELECT =
  "id, company_id, audit_customer_id, name, project_number, location, report_email, status, project_manager, safety_lead, start_date, end_date, notes, created_at, updated_at, archived_at";

const LOCATION_STATUSES = new Set(["planned", "active", "completed", "archived"]);

function normalizeStatus(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  return LOCATION_STATUSES.has(normalized) ? normalized : "active";
}

function normalizeEmail(value?: string | null) {
  const email = (value ?? "").trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "invalid";
}

function isLocationManagerRole(role?: string | null) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager"
  );
}

function isMissingLocationTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_audit_customer_locations");
}

function isDuplicateLocation(code?: string | null, message?: string | null) {
  return code === "23505" && (message ?? "").toLowerCase().includes("company_audit_customer_locations");
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_manage_company_users",
      "can_view_all_company_data",
      "can_view_analytics",
      "can_create_documents",
      "can_view_dashboards",
      "can_submit_documents",
    ],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ locations: [] });

  const { searchParams } = new URL(request.url);
  const auditCustomerId = searchParams.get("auditCustomerId")?.trim() || "";
  const includeArchived = searchParams.get("includeArchived") === "1";

  let query = auth.supabase
    .from("company_audit_customer_locations")
    .select(LOCATION_SELECT)
    .eq("company_id", companyScope.companyId)
    .order("name", { ascending: true });
  if (auditCustomerId) query = query.eq("audit_customer_id", auditCustomerId);
  if (!includeArchived) query = query.neq("status", "archived");

  const result = await query;
  if (result.error) {
    if (isMissingLocationTable(result.error.message)) {
      return NextResponse.json({
        locations: [],
        warning: "Audit customer locations are not available yet. Run the latest migration.",
      });
    }
    return NextResponse.json(
      { error: result.error.message || "Failed to load audit customer locations." },
      { status: 500 }
    );
  }

  return NextResponse.json({ locations: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data", "can_view_analytics"],
  });
  if ("error" in auth) return auth.error;
  if (!isLocationManagerRole(auth.role)) {
    return NextResponse.json(
      { error: "Only company admins and safety managers can manage audit locations." },
      { status: 403 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as LocationPayload | null;
  const auditCustomerId = body?.auditCustomerId?.trim() ?? "";
  const name = body?.name?.trim() ?? "";
  const reportEmail = normalizeEmail(body?.reportEmail);
  if (!auditCustomerId) return NextResponse.json({ error: "Customer company is required." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Audit job/location name is required." }, { status: 400 });
  if (reportEmail === "invalid") {
    return NextResponse.json({ error: "Enter a valid report email." }, { status: 400 });
  }

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
  if (!customerCheck.data) return NextResponse.json({ error: "Select a valid audit customer." }, { status: 400 });

  const insertResult = await auth.supabase
    .from("company_audit_customer_locations")
    .insert({
      company_id: companyScope.companyId,
      audit_customer_id: auditCustomerId,
      name,
      project_number: body?.projectNumber?.trim() || null,
      location: body?.location?.trim() || null,
      report_email: reportEmail,
      status: normalizeStatus(body?.status),
      project_manager: body?.projectManager?.trim() || null,
      safety_lead: body?.safetyLead?.trim() || null,
      start_date: body?.startDate?.trim() || null,
      end_date: body?.endDate?.trim() || null,
      notes: body?.notes?.trim() || null,
      created_by: auth.user.id,
      updated_by: auth.user.id,
      archived_at: normalizeStatus(body?.status) === "archived" ? new Date().toISOString() : null,
    })
    .select(LOCATION_SELECT)
    .single();

  if (insertResult.error) {
    if (isMissingLocationTable(insertResult.error.message)) {
      return NextResponse.json(
        { error: "Audit customer locations are not available yet. Run the latest migration." },
        { status: 500 }
      );
    }
    if (isDuplicateLocation(insertResult.error.code, insertResult.error.message)) {
      return NextResponse.json(
        { error: "This customer already has an audit job/location with that name." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: insertResult.error.message || "Failed to create audit location." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    location: insertResult.data,
    message: "Audit job/location added to the customer.",
  });
}
