import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { canMutateCompanyTrainingRequirements } from "@/lib/companyTrainingAccess";
import {
  isInvalidEmail,
  normalizeEmail,
  normalizeEmployeeStatus,
  normalizePhone,
  normalizeReadinessStatus,
  parseCertificationExpirationsText,
  parseDelimitedList,
} from "@/lib/companyTrackedEmployees";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const EMPLOYEE_SELECT =
  "id, company_id, external_employee_id, full_name, email, email_normalized, phone, phone_normalized, job_title, trade_specialty, readiness_status, years_experience, status, certifications, certification_expirations, source, archived_at, created_at, updated_at";

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  if (!canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "Only company admins, managers, and safety managers can update tracked employees." },
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
    return NextResponse.json({ error: "Demo workspaces cannot update tracked employees." }, { status: 403 });
  }

  const { id: rawId } = await context.params;
  const id = rawId.trim();
  if (!id) return NextResponse.json({ error: "Employee id is required." }, { status: 400 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Request body is required." }, { status: 400 });

  const updates: Record<string, unknown> = {
    updated_by: auth.user.id,
  };

  if (typeof body.fullName === "string" || typeof body.full_name === "string") {
    const fullName = String(body.fullName ?? body.full_name).trim();
    if (!fullName) return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    updates.full_name = fullName;
  }

  if (body.employeeId !== undefined || body.external_employee_id !== undefined) {
    updates.external_employee_id = String(body.employeeId ?? body.external_employee_id ?? "").trim() || null;
  }

  if (body.email !== undefined) {
    if (isInvalidEmail(body.email)) {
      return NextResponse.json({ error: "Email is not valid." }, { status: 400 });
    }
    const email = normalizeEmail(body.email);
    updates.email = email;
    updates.email_normalized = email;
  }

  if (body.phone !== undefined) {
    const phone = String(body.phone ?? "").trim();
    updates.phone = phone || null;
    updates.phone_normalized = normalizePhone(phone);
  }

  if (body.jobTitle !== undefined || body.job_title !== undefined) {
    updates.job_title = String(body.jobTitle ?? body.job_title ?? "").trim() || null;
  }
  if (body.tradeSpecialty !== undefined || body.trade_specialty !== undefined) {
    updates.trade_specialty = String(body.tradeSpecialty ?? body.trade_specialty ?? "").trim() || null;
  }
  if (body.readinessStatus !== undefined || body.readiness_status !== undefined) {
    updates.readiness_status = normalizeReadinessStatus(body.readinessStatus ?? body.readiness_status);
  }
  if (body.yearsExperience !== undefined || body.years_experience !== undefined) {
    const raw = body.yearsExperience ?? body.years_experience;
    const parsed = raw === null || raw === "" ? null : Number.parseInt(String(raw), 10);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 80)) {
      return NextResponse.json({ error: "Years experience must be between 0 and 80." }, { status: 400 });
    }
    updates.years_experience = parsed;
  }
  if (body.status !== undefined) {
    const status = normalizeEmployeeStatus(body.status);
    updates.status = status;
    updates.archived_at = status === "archived" ? new Date().toISOString() : null;
    updates.archived_by = status === "archived" ? auth.user.id : null;
  }
  if (body.certifications !== undefined) {
    updates.certifications = parseDelimitedList(body.certifications);
  }
  if (body.certificationExpirations !== undefined || body.certification_expirations !== undefined) {
    const certs =
      Array.isArray(updates.certifications)
        ? (updates.certifications as string[])
        : parseDelimitedList(body.certifications);
    updates.certification_expirations = parseCertificationExpirationsText(
      body.certificationExpirations ?? body.certification_expirations,
      certs.length ? new Set(certs) : undefined
    );
  }

  const db = createSupabaseAdminClient() ?? auth.supabase;
  const result = await db
    .from("company_employee_profiles")
    .update(updates)
    .eq("company_id", companyScope.companyId)
    .eq("id", id)
    .select(EMPLOYEE_SELECT)
    .maybeSingle();

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message || "Failed to update tracked employee." },
      { status: 500 }
    );
  }
  if (!result.data) {
    return NextResponse.json({ error: "Tracked employee not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, employee: result.data });
}
