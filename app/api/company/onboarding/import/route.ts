import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { canMutateCompanyTrainingRequirements } from "@/lib/companyTrainingAccess";
import {
  buildImportTypeFromPayload,
  countValidRowsByType,
  dedupeImportRows,
  makeEmployeeImportKey,
  makeJobsiteImportKey,
  makeTrainingImportKey,
  normalizeRowsArray,
  validateEmployeeImportRows,
  validateJobsiteImportRows,
  validateTrainingRecordImportRows,
} from "@/lib/companyOnboardingImport";
import {
  insertTrainingRecordRows,
  upsertJobsiteRows,
  upsertTrackedEmployeeRows,
} from "@/lib/companyOnboardingPersistence";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  if (!canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "Only company admins, managers, and safety managers can import onboarding data." },
      { status: 403 }
    );
  }
  if (auth.role === "sales_demo") {
    return NextResponse.json({ error: "Demo workspaces cannot import onboarding data." }, { status: 403 });
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

  const payload = (await request.json().catch(() => null)) as
    | {
        employees?: unknown;
        jobsites?: unknown;
        trainingRecords?: unknown;
        training_records?: unknown;
        source?: unknown;
        notes?: unknown;
      }
    | null;
  if (!payload) {
    return NextResponse.json({ error: "Import payload is required." }, { status: 400 });
  }

  const employeeValidation = validateEmployeeImportRows(normalizeRowsArray(payload.employees));
  const jobsiteValidation = validateJobsiteImportRows(normalizeRowsArray(payload.jobsites));
  const trainingValidation = validateTrainingRecordImportRows(
    normalizeRowsArray(payload.trainingRecords ?? payload.training_records)
  );

  const employees = dedupeImportRows(employeeValidation.validRows, makeEmployeeImportKey);
  const jobsites = dedupeImportRows(jobsiteValidation.validRows, makeJobsiteImportKey);
  const trainingRecords = dedupeImportRows(trainingValidation.validRows, makeTrainingImportKey);
  const validationErrors = [
    ...employeeValidation.rowErrors,
    ...jobsiteValidation.rowErrors,
    ...trainingValidation.rowErrors,
  ];

  if (employees.length + jobsites.length + trainingRecords.length === 0) {
    return NextResponse.json(
      {
        error: validationErrors[0]?.message ?? "No valid import rows were provided.",
        rowErrors: validationErrors,
      },
      { status: 400 }
    );
  }

  const db = createSupabaseAdminClient() ?? auth.supabase;
  const rowErrors = [...validationErrors];
  let acceptedCount = 0;
  let hardError: string | null = null;

  if (jobsites.length > 0) {
    const result = await upsertJobsiteRows({
      db,
      companyId: companyScope.companyId,
      actorUserId: auth.user.id,
      rows: jobsites,
    });
    if (result.error) hardError = result.error;
    acceptedCount += result.acceptedCount;
    rowErrors.push(...result.rowErrors);
  }

  if (!hardError && employees.length > 0) {
    const result = await upsertTrackedEmployeeRows({
      db,
      companyId: companyScope.companyId,
      actorUserId: auth.user.id,
      rows: employees,
      source: typeof payload.source === "string" ? payload.source.trim() || "manual_upload" : "manual_upload",
    });
    if (result.error) hardError = result.error;
    acceptedCount += result.acceptedCount;
    rowErrors.push(...result.rowErrors);
  }

  if (!hardError && trainingRecords.length > 0) {
    const result = await insertTrainingRecordRows({
      db,
      companyId: companyScope.companyId,
      actorUserId: auth.user.id,
      rows: trainingRecords,
    });
    if (result.error) hardError = result.error;
    acceptedCount += result.acceptedCount;
    rowErrors.push(...result.rowErrors);
  }

  if (hardError) {
    return NextResponse.json({ error: hardError, rowErrors }, { status: 500 });
  }

  const validCounts = countValidRowsByType({ employees, jobsites, trainingRecords });
  const totalValidRows = validCounts.employees + validCounts.jobsites + validCounts.training_records;
  const skippedCount =
    validationErrors.length +
    Math.max(0, totalValidRows - acceptedCount);

  const importType = buildImportTypeFromPayload(payload);
  await db.from("company_onboarding_imports").insert({
    company_id: companyScope.companyId,
    import_type: importType,
    source: typeof payload.source === "string" ? payload.source.trim() || "manual_upload" : "manual_upload",
    entity_counts: validCounts,
    accepted_count: acceptedCount,
    skipped_count: skippedCount,
    notes: typeof payload.notes === "string" ? payload.notes.trim() || null : null,
    created_by: auth.user.id,
  });

  return NextResponse.json({
    success: true,
    importType,
    acceptedCount,
    skippedCount,
    entityCounts: validCounts,
    rowErrors,
  });
}
