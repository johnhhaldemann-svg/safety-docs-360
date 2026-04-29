import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";

export const runtime = "nodejs";

type AuditCustomerPayload = {
  name?: string;
  reportEmail?: string | null;
  contactName?: string | null;
  phone?: string | null;
  notes?: string | null;
};

const CUSTOMER_SELECT =
  "id, company_id, name, report_email, contact_name, phone, notes, status, created_at, updated_at, archived_at";

function normalizeEmail(value?: string | null) {
  const email = (value ?? "").trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "invalid";
}

function isCustomerManagerRole(role?: string | null) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager"
  );
}

function isMissingCustomersTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_audit_customers");
}

function isDuplicateCustomerName(code?: string | null, message?: string | null) {
  return code === "23505" && (message ?? "").toLowerCase().includes("company_audit_customers");
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_manage_company_users",
      "can_view_all_company_data",
      "can_view_analytics",
      "can_create_documents",
      "can_view_dashboards",
    ],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ customers: [] });

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "1";

  let query = auth.supabase
    .from("company_audit_customers")
    .select(CUSTOMER_SELECT)
    .eq("company_id", companyScope.companyId)
    .order("name", { ascending: true });
  if (!includeArchived) query = query.neq("status", "archived");

  const result = await query;
  if (result.error) {
    if (isMissingCustomersTable(result.error.message)) {
      return NextResponse.json({
        customers: [],
        warning: "Audit customer directory is not available yet. Run the latest migration.",
      });
    }
    return NextResponse.json(
      { error: result.error.message || "Failed to load audit customers." },
      { status: 500 }
    );
  }

  return NextResponse.json({ customers: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data", "can_view_analytics"],
  });
  if ("error" in auth) return auth.error;
  if (!isCustomerManagerRole(auth.role)) {
    return NextResponse.json(
      { error: "Only company admins and safety managers can manage audit customers." },
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

  const body = (await request.json().catch(() => null)) as AuditCustomerPayload | null;
  const name = body?.name?.trim() ?? "";
  const reportEmail = normalizeEmail(body?.reportEmail);
  if (!name) return NextResponse.json({ error: "Customer company name is required." }, { status: 400 });
  if (reportEmail === "invalid") {
    return NextResponse.json({ error: "Enter a valid customer audit email." }, { status: 400 });
  }

  const insertResult = await auth.supabase
    .from("company_audit_customers")
    .insert({
      company_id: companyScope.companyId,
      name,
      report_email: reportEmail,
      contact_name: body?.contactName?.trim() || null,
      phone: body?.phone?.trim() || null,
      notes: body?.notes?.trim() || null,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select(CUSTOMER_SELECT)
    .single();

  if (insertResult.error) {
    if (isMissingCustomersTable(insertResult.error.message)) {
      return NextResponse.json(
        { error: "Audit customer directory is not available yet. Run the latest migration." },
        { status: 500 }
      );
    }
    if (isDuplicateCustomerName(insertResult.error.code, insertResult.error.message)) {
      return NextResponse.json(
        { error: "A customer company with this name already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: insertResult.error.message || "Failed to create audit customer." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    customer: insertResult.data,
    message: "Audit customer added.",
  });
}
