import type { SupabaseClient } from "@supabase/supabase-js";
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
  type ImportRowError,
} from "@/lib/companyOnboardingImport";
import {
  insertTrainingRecordRows,
  upsertJobsiteRows,
  upsertTrackedEmployeeRows,
} from "@/lib/companyOnboardingPersistence";

export type CompanyOnboardingImportPayload = {
  employees?: unknown;
  jobsites?: unknown;
  trainingRecords?: unknown;
  training_records?: unknown;
  source?: unknown;
  notes?: unknown;
};

export type CompanyOnboardingImportResult =
  | {
      ok: true;
      status: 200;
      body: {
        success: true;
        importType: ReturnType<typeof buildImportTypeFromPayload>;
        acceptedCount: number;
        skippedCount: number;
        entityCounts: ReturnType<typeof countValidRowsByType>;
        rowErrors: ImportRowError[];
      };
    }
  | {
      ok: false;
      status: 400 | 500;
      body: {
        error: string;
        rowErrors: ImportRowError[];
      };
    };

function sourceFromPayload(payload: CompanyOnboardingImportPayload) {
  return typeof payload.source === "string"
    ? payload.source.trim() || "manual_upload"
    : "manual_upload";
}

export async function runCompanyOnboardingImport(params: {
  db: SupabaseClient;
  companyId: string;
  actorUserId: string;
  payload: CompanyOnboardingImportPayload;
}): Promise<CompanyOnboardingImportResult> {
  const { db, companyId, actorUserId, payload } = params;

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
    return {
      ok: false,
      status: 400,
      body: {
        error: validationErrors[0]?.message ?? "No valid import rows were provided.",
        rowErrors: validationErrors,
      },
    };
  }

  const rowErrors = [...validationErrors];
  let acceptedCount = 0;
  let hardError: string | null = null;

  if (jobsites.length > 0) {
    const result = await upsertJobsiteRows({
      db,
      companyId,
      actorUserId,
      rows: jobsites,
    });
    if (result.error) hardError = result.error;
    acceptedCount += result.acceptedCount;
    rowErrors.push(...result.rowErrors);
  }

  if (!hardError && employees.length > 0) {
    const result = await upsertTrackedEmployeeRows({
      db,
      companyId,
      actorUserId,
      rows: employees,
      source: sourceFromPayload(payload),
    });
    if (result.error) hardError = result.error;
    acceptedCount += result.acceptedCount;
    rowErrors.push(...result.rowErrors);
  }

  if (!hardError && trainingRecords.length > 0) {
    const result = await insertTrainingRecordRows({
      db,
      companyId,
      actorUserId,
      rows: trainingRecords,
    });
    if (result.error) hardError = result.error;
    acceptedCount += result.acceptedCount;
    rowErrors.push(...result.rowErrors);
  }

  if (hardError) {
    return {
      ok: false,
      status: 500,
      body: { error: hardError, rowErrors },
    };
  }

  const validCounts = countValidRowsByType({ employees, jobsites, trainingRecords });
  const totalValidRows =
    validCounts.employees + validCounts.jobsites + validCounts.training_records;
  const skippedCount =
    validationErrors.length + Math.max(0, totalValidRows - acceptedCount);

  const importType = buildImportTypeFromPayload(payload);
  await db.from("company_onboarding_imports").insert({
    company_id: companyId,
    import_type: importType,
    source: sourceFromPayload(payload),
    entity_counts: validCounts,
    accepted_count: acceptedCount,
    skipped_count: skippedCount,
    notes: typeof payload.notes === "string" ? payload.notes.trim() || null : null,
    created_by: actorUserId,
  });

  return {
    ok: true,
    status: 200,
    body: {
      success: true,
      importType,
      acceptedCount,
      skippedCount,
      entityCounts: validCounts,
      rowErrors,
    },
  };
}
