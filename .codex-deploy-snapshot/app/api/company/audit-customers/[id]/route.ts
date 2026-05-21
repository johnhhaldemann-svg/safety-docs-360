import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type AuditCustomerUpdatePayload = {
  name?: string;
  reportEmail?: string | null;
  contactName?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  country?: string | null;
  notes?: string | null;
  status?: "active" | "archived";
  archived?: boolean;
};

const CUSTOMER_SELECT =
  "id, company_id, name, report_email, contact_name, phone, address_line1, address_line2, city, state_region, postal_code, country, notes, status, created_at, updated_at, archived_at";

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

export async function PATCH(request: Request, context: RouteContext) {
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

  const { id } = await context.params;
  const customerId = String(id ?? "").trim();
  if (!customerId) return NextResponse.json({ error: "Customer id is required." }, { status: 400 });

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const existing = await auth.supabase
    .from("company_audit_customers")
    .select("id")
    .eq("company_id", companyScope.companyId)
    .eq("id", customerId)
    .maybeSingle();
  if (existing.error) {
    if (isMissingCustomersTable(existing.error.message)) {
      return NextResponse.json(
        { error: "Audit customer directory is not available yet. Run the latest migration." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: existing.error.message || "Failed to find audit customer." },
      { status: 500 }
    );
  }
  if (!existing.data) return NextResponse.json({ error: "Audit customer not found." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as AuditCustomerUpdatePayload | null;
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  if (typeof body?.name === "string" && !name) {
    return NextResponse.json({ error: "Customer company name cannot be empty." }, { status: 400 });
  }
  const reportEmail = typeof body?.reportEmail === "string" ? normalizeEmail(body.reportEmail) : undefined;
  if (reportEmail === "invalid") {
    return NextResponse.json({ error: "Enter a valid customer audit email." }, { status: 400 });
  }

  const archived =
    typeof body?.archived === "boolean"
      ? body.archived
      : body?.status === "archived";
  const status = archived ? "archived" : body?.status === "active" ? "active" : undefined;

  const updateValues = {
    ...(typeof name === "string" ? { name } : {}),
    ...(typeof reportEmail !== "undefined" ? { report_email: reportEmail } : {}),
    ...(typeof body?.contactName === "string" ? { contact_name: body.contactName.trim() || null } : {}),
    ...(typeof body?.phone === "string" ? { phone: body.phone.trim() || null } : {}),
    ...(typeof body?.addressLine1 === "string" ? { address_line1: body.addressLine1.trim() || null } : {}),
    ...(typeof body?.addressLine2 === "string" ? { address_line2: body.addressLine2.trim() || null } : {}),
    ...(typeof body?.city === "string" ? { city: body.city.trim() || null } : {}),
    ...(typeof body?.stateRegion === "string" ? { state_region: body.stateRegion.trim() || null } : {}),
    ...(typeof body?.postalCode === "string" ? { postal_code: body.postalCode.trim() || null } : {}),
    ...(typeof body?.country === "string" ? { country: body.country.trim() || null } : {}),
    ...(typeof body?.notes === "string" ? { notes: body.notes.trim() || null } : {}),
    ...(status ? { status } : {}),
    ...(typeof body?.archived === "boolean" || body?.status ? { archived_at: archived ? new Date().toISOString() : null } : {}),
    updated_by: auth.user.id,
  };

  const updateResult = await auth.supabase
    .from("company_audit_customers")
    .update(updateValues)
    .eq("company_id", companyScope.companyId)
    .eq("id", customerId)
    .select(CUSTOMER_SELECT)
    .single();

  if (updateResult.error) {
    if (isDuplicateCustomerName(updateResult.error.code, updateResult.error.message)) {
      return NextResponse.json(
        { error: "A customer company with this name already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: updateResult.error.message || "Failed to update audit customer." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    customer: updateResult.data,
    message: archived ? "Audit customer archived." : "Audit customer updated.",
  });
}
