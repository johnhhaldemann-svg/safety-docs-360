import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  hashIntakeToken,
  normalizeEmail,
  normalizePhone,
  normalizeTrainingTitle,
  parseExpirationMap,
  parseStringArray,
} from "@/lib/contractorTraining";
import { isAllowedConstructionPosition, isAllowedConstructionTrade } from "@/lib/constructionProfileOptions";

export const runtime = "nodejs";

function asString(value: unknown) {
  return String(value ?? "").trim();
}

function asNullableString(value: unknown) {
  const text = asString(value);
  return text || null;
}

function asDateString(value: unknown) {
  const text = asString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

async function loadToken(token: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: "Contractor intake requires server database configuration." }, { status: 503 }) } as const;
  }

  const tokenResult = await admin
    .from("contractor_employee_intake_tokens")
    .select("id, company_id, jobsite_id, assignment_id, contractor_employee_id, expires_at, used_at, revoked_at")
    .eq("token_hash", hashIntakeToken(token))
    .maybeSingle();

  if (tokenResult.error) {
    return { error: NextResponse.json({ error: tokenResult.error.message || "Failed to load intake token." }, { status: 500 }) } as const;
  }

  const row = tokenResult.data as {
    id: string;
    company_id: string;
    jobsite_id: string;
    assignment_id: string;
    contractor_employee_id: string;
    expires_at: string;
    used_at: string | null;
    revoked_at: string | null;
  } | null;

  if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
    return { error: NextResponse.json({ error: "This contractor intake link is invalid or expired." }, { status: 404 }) } as const;
  }

  return { admin, tokenRow: row } as const;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!token) return NextResponse.json({ error: "token is required." }, { status: 400 });

  const scoped = await loadToken(token);
  if ("error" in scoped) return scoped.error;

  const [employeeResult, jobsiteResult, requirementsResult, recordsResult] = await Promise.all([
    scoped.admin
      .from("contractor_employee_profiles")
      .select("id, full_name, email, phone, contractor_company_name, trade_specialty, job_title, readiness_status, years_experience, certifications, certification_expirations")
      .eq("id", scoped.tokenRow.contractor_employee_id)
      .maybeSingle(),
    scoped.admin
      .from("company_jobsites")
      .select("id, name")
      .eq("id", scoped.tokenRow.jobsite_id)
      .maybeSingle(),
    scoped.admin
      .from("jobsite_contractor_training_requirements")
      .select("id, title, sort_order, apply_trades, apply_positions")
      .eq("company_id", scoped.tokenRow.company_id)
      .eq("jobsite_id", scoped.tokenRow.jobsite_id)
      .order("sort_order", { ascending: true }),
    scoped.admin
      .from("contractor_employee_training_records")
      .select("id, requirement_id, title, completed_on, expires_on, notes")
      .eq("contractor_employee_id", scoped.tokenRow.contractor_employee_id),
  ]);

  for (const result of [employeeResult, jobsiteResult, requirementsResult, recordsResult]) {
    if (result.error) {
      return NextResponse.json({ error: result.error.message || "Failed to load intake form." }, { status: 500 });
    }
  }

  const employee = employeeResult.data as Record<string, unknown> | null;
  if (!employee) return NextResponse.json({ error: "Contractor employee not found." }, { status: 404 });

  return NextResponse.json({
    token: { expiresAt: scoped.tokenRow.expires_at, submittedAt: scoped.tokenRow.used_at },
    jobsite: jobsiteResult.data ?? null,
    employee: {
      fullName: employee.full_name ?? "",
      email: employee.email ?? "",
      phone: employee.phone ?? "",
      contractorCompanyName: employee.contractor_company_name ?? "",
      tradeSpecialty: employee.trade_specialty ?? "",
      jobTitle: employee.job_title ?? "",
      readinessStatus: employee.readiness_status ?? "ready",
      yearsExperience: employee.years_experience ?? null,
      certifications: Array.isArray(employee.certifications) ? employee.certifications : [],
      certificationExpirations:
        employee.certification_expirations && typeof employee.certification_expirations === "object"
          ? employee.certification_expirations
          : {},
    },
    requirements: requirementsResult.data ?? [],
    records: recordsResult.data ?? [],
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const token = asString(body?.token);
  if (!token) return NextResponse.json({ error: "token is required." }, { status: 400 });

  const scoped = await loadToken(token);
  if ("error" in scoped) return scoped.error;

  const fullName = asString(body?.fullName);
  if (!fullName) return NextResponse.json({ error: "Full name is required." }, { status: 400 });

  const certifications = parseStringArray(body?.certifications);
  const certificationExpirations = parseExpirationMap(body?.certificationExpirations);

  const updateProfile = await scoped.admin
    .from("contractor_employee_profiles")
    .update({
      full_name: fullName,
      email: asNullableString(body?.email),
      email_normalized: normalizeEmail(asNullableString(body?.email)),
      phone: asNullableString(body?.phone),
      phone_normalized: normalizePhone(asNullableString(body?.phone)),
      contractor_company_name: asNullableString(body?.contractorCompanyName),
      trade_specialty: isAllowedConstructionTrade(asString(body?.tradeSpecialty)) ? asString(body?.tradeSpecialty) : null,
      job_title: isAllowedConstructionPosition(asString(body?.jobTitle)) ? asString(body?.jobTitle) : null,
      readiness_status: asString(body?.readinessStatus) || "ready",
      years_experience: Number.isFinite(Number(body?.yearsExperience)) ? Number(body?.yearsExperience) : null,
      certifications,
      certification_expirations: certificationExpirations,
    })
    .eq("id", scoped.tokenRow.contractor_employee_id);

  if (updateProfile.error) {
    return NextResponse.json({ error: updateProfile.error.message || "Failed to update profile." }, { status: 500 });
  }

  const trainingRows = Array.isArray(body?.trainingRecords) ? body.trainingRecords : [];
  for (const raw of trainingRows) {
    const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const title = normalizeTrainingTitle(asString(row.title));
    if (!title) continue;
    const requirementId = asNullableString(row.requirementId);
    const payload = {
      contractor_employee_id: scoped.tokenRow.contractor_employee_id,
      requirement_id: requirementId,
      title,
      completed_on: asDateString(row.completedOn),
      expires_on: asDateString(row.expiresOn),
      notes: asNullableString(row.notes),
    };
    const result = requirementId
      ? await scoped.admin
          .from("contractor_employee_training_records")
          .upsert(payload, { onConflict: "contractor_employee_id,requirement_id" })
      : await scoped.admin.from("contractor_employee_training_records").insert(payload);
    if (result.error) {
      return NextResponse.json({ error: result.error.message || "Failed to save training record." }, { status: 500 });
    }
  }

  const existingCertRecords = await scoped.admin
    .from("contractor_employee_training_records")
    .select("id, title")
    .eq("contractor_employee_id", scoped.tokenRow.contractor_employee_id)
    .is("requirement_id", null);
  if (existingCertRecords.error) {
    return NextResponse.json({ error: existingCertRecords.error.message || "Failed to load certification records." }, { status: 500 });
  }
  const submittedCertTitles = new Set(certifications.map((cert) => normalizeTrainingTitle(cert)).filter(Boolean));
  const staleCertRecordIds = ((existingCertRecords.data ?? []) as Array<{ id: string; title: string | null }>)
    .filter((record) => !submittedCertTitles.has(normalizeTrainingTitle(record.title ?? "")))
    .map((record) => record.id);
  if (staleCertRecordIds.length > 0) {
    const removeStale = await scoped.admin
      .from("contractor_employee_training_records")
      .delete()
      .in("id", staleCertRecordIds);
    if (removeStale.error) {
      return NextResponse.json({ error: removeStale.error.message || "Failed to remove old certification records." }, { status: 500 });
    }
  }

  for (const cert of certifications) {
    const title = normalizeTrainingTitle(cert);
    if (!title) continue;
    const existing = await scoped.admin
      .from("contractor_employee_training_records")
      .select("id")
      .eq("contractor_employee_id", scoped.tokenRow.contractor_employee_id)
      .is("requirement_id", null)
      .eq("title", title)
      .maybeSingle();
    if (existing.error) {
      return NextResponse.json({ error: existing.error.message || "Failed to check certification record." }, { status: 500 });
    }
    const certPayload = {
      contractor_employee_id: scoped.tokenRow.contractor_employee_id,
      title,
      completed_on: null,
      expires_on: certificationExpirations[title] ?? null,
    };
    const saveCert = existing.data?.id
      ? await scoped.admin
          .from("contractor_employee_training_records")
          .update(certPayload)
          .eq("id", existing.data.id)
      : await scoped.admin.from("contractor_employee_training_records").insert(certPayload);
    if (saveCert.error) {
      return NextResponse.json({ error: saveCert.error.message || "Failed to save certification record." }, { status: 500 });
    }
  }

  await scoped.admin
    .from("contractor_employee_intake_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", scoped.tokenRow.id);

  return NextResponse.json({ success: true });
}
