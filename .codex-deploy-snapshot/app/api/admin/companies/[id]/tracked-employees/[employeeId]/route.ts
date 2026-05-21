import { NextResponse } from "next/server";
import {
  isInvalidEmail,
  normalizeEmail,
  normalizeEmployeeStatus,
  normalizePhone,
  normalizeReadinessStatus,
  parseCertificationExpirationsText,
  parseDelimitedList,
} from "@/lib/companyTrackedEmployees";
import { authorizeRequest } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; employeeId: string }> };

const EMPLOYEE_SELECT =
  "id, company_id, external_employee_id, full_name, email, email_normalized, phone, phone_normalized, job_title, trade_specialty, readiness_status, years_experience, status, certifications, certification_expirations, source, archived_at, created_at, updated_at";

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, { requireAdmin: true });
  if ("error" in auth) return auth.error;

  if (auth.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only a Super Admin can update training-only employees from a company profile." },
      { status: 403 }
    );
  }

  const { id: rawCompanyId, employeeId: rawEmployeeId } = await context.params;
  const companyId = rawCompanyId.trim();
  const employeeId = rawEmployeeId.trim();
  if (!companyId || !employeeId) {
    return NextResponse.json({ error: "Company id and employee id are required." }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json(
      { error: "Server database configuration is required for cross-company employee updates." },
      { status: 503 }
    );
  }

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

  const result = await db
    .from("company_employee_profiles")
    .update(updates)
    .eq("company_id", companyId)
    .eq("id", employeeId)
    .select(EMPLOYEE_SELECT)
    .maybeSingle();

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message || "Failed to update training-only employee." },
      { status: 500 }
    );
  }
  if (!result.data) {
    return NextResponse.json({ error: "Training-only employee not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, employee: result.data });
}
