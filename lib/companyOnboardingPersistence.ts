import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type ImportRowError,
  type NormalizedEmployeeImportRow,
  type NormalizedJobsiteImportRow,
  type NormalizedTrainingRecordImportRow,
} from "@/lib/companyOnboardingImport";
import {
  isMissingTrackedEmployeesSchemaError,
  normalizeEmail,
  type TrackedEmployeeProfileRow,
} from "@/lib/companyTrackedEmployees";

const EMPLOYEE_SELECT =
  "id, company_id, external_employee_id, full_name, email, email_normalized, phone, phone_normalized, job_title, trade_specialty, readiness_status, years_experience, status, certifications, certification_expirations, source, archived_at, created_at, updated_at";

type JobsiteRow = {
  id: string;
  company_id: string;
  name: string;
  status: string | null;
};

type RequirementRow = {
  id: string;
  title: string;
  match_keywords: string[] | null;
};

type TrainingRecordIdentityRow = {
  id: string;
  employee_id: string;
  title: string;
  completed_on: string | null;
  expires_on: string | null;
};

function lower(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function employeeKey(row: Pick<TrackedEmployeeProfileRow, "external_employee_id" | "email_normalized" | "full_name">) {
  return {
    external: lower(row.external_employee_id),
    email: lower(row.email_normalized),
    name: lower(row.full_name),
  };
}

export function findEmployeeMatch(
  employees: TrackedEmployeeProfileRow[],
  input: {
    externalEmployeeId?: string | null;
    email?: string | null;
    fullName?: string | null;
  }
) {
  const external = lower(input.externalEmployeeId);
  const email = lower(input.email);
  const name = lower(input.fullName);

  if (external) {
    const match = employees.find((employee) => employeeKey(employee).external === external);
    if (match) return match;
  }

  if (email) {
    const match = employees.find((employee) => employeeKey(employee).email === email);
    if (match) return match;
  }

  if (name) {
    const matches = employees.filter((employee) => employeeKey(employee).name === name);
    if (matches.length === 1) return matches[0];
  }

  return null;
}

async function loadExistingTrackedEmployees(db: SupabaseClient, companyId: string) {
  const result = await db
    .from("company_employee_profiles")
    .select(EMPLOYEE_SELECT)
    .eq("company_id", companyId);

  if (result.error) {
    return {
      employees: [] as TrackedEmployeeProfileRow[],
      error: result.error.message,
      missingSchema: isMissingTrackedEmployeesSchemaError(result.error.message),
    };
  }

  return {
    employees: (result.data ?? []) as TrackedEmployeeProfileRow[],
    error: null,
    missingSchema: false,
  };
}

async function loadJobsites(db: SupabaseClient, companyId: string) {
  const result = await db
    .from("company_jobsites")
    .select("id, company_id, name, status")
    .eq("company_id", companyId);
  return {
    jobsites: (result.data ?? []) as JobsiteRow[],
    error: result.error?.message ?? null,
  };
}

async function assignEmployeeToJobsites(params: {
  db: SupabaseClient;
  companyId: string;
  actorUserId: string;
  employeeId: string;
  rowNumber: number;
  jobsiteNames: string[];
  jobsites: JobsiteRow[];
}) {
  const rowErrors: ImportRowError[] = [];
  const byName = new Map(params.jobsites.map((jobsite) => [lower(jobsite.name), jobsite]));
  const assignments: Array<Record<string, unknown>> = [];

  for (const name of params.jobsiteNames) {
    const jobsite = byName.get(lower(name));
    if (!jobsite) {
      rowErrors.push({
        rowNumber: params.rowNumber,
        entity: "employees",
        field: "jobsite_names",
        message: `Jobsite "${name}" was not found. Employee was imported without that assignment.`,
      });
      continue;
    }

    const existing = await params.db
      .from("company_employee_jobsite_assignments")
      .select("id", { count: "exact", head: true })
      .eq("company_id", params.companyId)
      .eq("employee_id", params.employeeId)
      .eq("jobsite_id", jobsite.id)
      .eq("status", "active");

    if (existing.error) {
      rowErrors.push({
        rowNumber: params.rowNumber,
        entity: "employees",
        field: "jobsite_names",
        message: existing.error.message || `Failed to validate assignment for "${name}".`,
      });
      continue;
    }
    if (existing.count && existing.count > 0) continue;

    assignments.push({
      company_id: params.companyId,
      employee_id: params.employeeId,
      jobsite_id: jobsite.id,
      status: "active",
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
    });
  }

  if (assignments.length > 0) {
    const result = await params.db.from("company_employee_jobsite_assignments").insert(assignments);
    if (result.error) {
      rowErrors.push({
        rowNumber: params.rowNumber,
        entity: "employees",
        field: "jobsite_names",
        message: result.error.message || "Failed to save jobsite assignments.",
      });
    }
  }

  return rowErrors;
}

export async function upsertTrackedEmployeeRows(params: {
  db: SupabaseClient;
  companyId: string;
  actorUserId: string;
  rows: NormalizedEmployeeImportRow[];
  source?: string;
}): Promise<{
  employees: TrackedEmployeeProfileRow[];
  acceptedCount: number;
  rowErrors: ImportRowError[];
  error: string | null;
}> {
  const existing = await loadExistingTrackedEmployees(params.db, params.companyId);
  if (existing.error) {
    return {
      employees: [],
      acceptedCount: 0,
      rowErrors: [],
      error: existing.missingSchema
        ? "Tracked employee schema is not installed yet. Run the latest migration first."
        : existing.error,
    };
  }

  const jobsitesResult = await loadJobsites(params.db, params.companyId);
  const jobsites = jobsitesResult.error ? [] : jobsitesResult.jobsites;
  const employees = [...existing.employees];
  const rowErrors: ImportRowError[] = [];
  let acceptedCount = 0;

  for (const row of params.rows) {
    const match = findEmployeeMatch(employees, {
      externalEmployeeId: row.externalEmployeeId,
      email: row.email,
      fullName: row.fullName,
    });
    const payload = {
      company_id: params.companyId,
      external_employee_id: row.externalEmployeeId,
      full_name: row.fullName,
      email: row.email,
      email_normalized: row.email,
      phone: row.phone,
      phone_normalized: row.phoneNormalized,
      job_title: row.jobTitle,
      trade_specialty: row.tradeSpecialty,
      readiness_status: row.readinessStatus,
      years_experience: row.yearsExperience,
      status: row.status,
      certifications: row.certifications,
      certification_expirations: row.certificationExpirations,
      source: params.source ?? "manual_upload",
      archived_at: row.status === "archived" ? new Date().toISOString() : null,
      archived_by: row.status === "archived" ? params.actorUserId : null,
      updated_by: params.actorUserId,
    };

    const result = match
      ? await params.db
          .from("company_employee_profiles")
          .update(payload)
          .eq("company_id", params.companyId)
          .eq("id", match.id)
          .select(EMPLOYEE_SELECT)
          .single()
      : await params.db
          .from("company_employee_profiles")
          .insert({ ...payload, created_by: params.actorUserId })
          .select(EMPLOYEE_SELECT)
          .single();

    if (result.error || !result.data) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        entity: "employees",
        message: result.error?.message || "Failed to save employee row.",
      });
      continue;
    }

    const saved = result.data as TrackedEmployeeProfileRow;
    const existingIndex = employees.findIndex((employee) => employee.id === saved.id);
    if (existingIndex >= 0) employees[existingIndex] = saved;
    else employees.push(saved);

    acceptedCount++;
    if (row.jobsiteNames.length > 0) {
      rowErrors.push(
        ...(await assignEmployeeToJobsites({
          db: params.db,
          companyId: params.companyId,
          actorUserId: params.actorUserId,
          employeeId: saved.id,
          rowNumber: row.rowNumber,
          jobsiteNames: row.jobsiteNames,
          jobsites,
        }))
      );
    }
  }

  return { employees, acceptedCount, rowErrors, error: null };
}

export async function upsertJobsiteRows(params: {
  db: SupabaseClient;
  companyId: string;
  actorUserId: string;
  rows: NormalizedJobsiteImportRow[];
}): Promise<{
  jobsites: JobsiteRow[];
  acceptedCount: number;
  rowErrors: ImportRowError[];
  error: string | null;
}> {
  const jobsitesResult = await loadJobsites(params.db, params.companyId);
  if (jobsitesResult.error) {
    return {
      jobsites: [],
      acceptedCount: 0,
      rowErrors: [],
      error: jobsitesResult.error,
    };
  }

  const jobsites = [...jobsitesResult.jobsites];
  const rowErrors: ImportRowError[] = [];
  let acceptedCount = 0;

  for (const row of params.rows) {
    const match = jobsites.find((jobsite) => lower(jobsite.name) === lower(row.name));
    const payload = {
      company_id: params.companyId,
      name: row.name,
      project_number: row.projectNumber,
      location: row.location,
      status: row.status,
      project_manager: row.projectManager,
      safety_lead: row.safetyLead,
      start_date: row.startDate,
      end_date: row.endDate,
      notes: row.notes,
      archived_at: row.status === "archived" ? new Date().toISOString() : null,
      updated_by: params.actorUserId,
    };

    const result = match
      ? await params.db
          .from("company_jobsites")
          .update(payload)
          .eq("company_id", params.companyId)
          .eq("id", match.id)
          .select("id, company_id, name, status")
          .single()
      : await params.db
          .from("company_jobsites")
          .insert({ ...payload, created_by: params.actorUserId })
          .select("id, company_id, name, status")
          .single();

    if (result.error || !result.data) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        entity: "jobsites",
        message: result.error?.message || "Failed to save jobsite row.",
      });
      continue;
    }

    const saved = result.data as JobsiteRow;
    const existingIndex = jobsites.findIndex((jobsite) => jobsite.id === saved.id);
    if (existingIndex >= 0) jobsites[existingIndex] = saved;
    else jobsites.push(saved);
    acceptedCount++;
  }

  return { jobsites, acceptedCount, rowErrors, error: null };
}

async function loadRequirements(db: SupabaseClient, companyId: string) {
  const result = await db
    .from("company_training_requirements")
    .select("id, title, match_keywords")
    .eq("company_id", companyId);

  return {
    requirements: (result.data ?? []) as RequirementRow[],
    error: result.error?.message ?? null,
  };
}

function findRequirement(requirements: RequirementRow[], title: string | null) {
  const normalized = lower(title);
  if (!normalized) return null;

  return (
    requirements.find((requirement) => lower(requirement.title) === normalized) ??
    requirements.find((requirement) =>
      (requirement.match_keywords ?? []).some((keyword) => lower(keyword) === normalized)
    ) ??
    null
  );
}

async function loadTrainingRecordIdentities(db: SupabaseClient, companyId: string) {
  const result = await db
    .from("company_employee_training_records")
    .select("id, employee_id, title, completed_on, expires_on")
    .eq("company_id", companyId);

  return {
    records: (result.data ?? []) as TrainingRecordIdentityRow[],
    error: result.error?.message ?? null,
  };
}

function trainingRecordKey(input: {
  employeeId: string;
  title: string;
  completedOn?: string | null;
  expiresOn?: string | null;
}) {
  return [
    input.employeeId,
    lower(input.title),
    input.completedOn ?? "",
    input.expiresOn ?? "",
  ].join("|");
}

export async function insertTrainingRecordRows(params: {
  db: SupabaseClient;
  companyId: string;
  actorUserId: string;
  rows: NormalizedTrainingRecordImportRow[];
}): Promise<{
  acceptedCount: number;
  rowErrors: ImportRowError[];
  error: string | null;
}> {
  const existing = await loadExistingTrackedEmployees(params.db, params.companyId);
  if (existing.error) {
    return {
      acceptedCount: 0,
      rowErrors: [],
      error: existing.missingSchema
        ? "Tracked employee schema is not installed yet. Run the latest migration first."
        : existing.error,
    };
  }

  const requirementsResult = await loadRequirements(params.db, params.companyId);
  if (requirementsResult.error) {
    return { acceptedCount: 0, rowErrors: [], error: requirementsResult.error };
  }

  const trainingRecordsResult = await loadTrainingRecordIdentities(params.db, params.companyId);
  if (trainingRecordsResult.error) {
    return { acceptedCount: 0, rowErrors: [], error: trainingRecordsResult.error };
  }

  const existingTrainingKeys = new Set(
    trainingRecordsResult.records.map((record) =>
      trainingRecordKey({
        employeeId: record.employee_id,
        title: record.title,
        completedOn: record.completed_on,
        expiresOn: record.expires_on,
      })
    )
  );

  const employees = [...existing.employees];
  const rowErrors: ImportRowError[] = [];
  let acceptedCount = 0;

  for (const row of params.rows) {
    let employee = findEmployeeMatch(employees, {
      externalEmployeeId: row.externalEmployeeId,
      email: row.email,
      fullName: row.fullName,
    });

    if (!employee && row.fullName) {
      const created = await params.db
        .from("company_employee_profiles")
        .insert({
          company_id: params.companyId,
          external_employee_id: row.externalEmployeeId,
          full_name: row.fullName,
          email: row.email,
          email_normalized: row.email,
          status: "active",
          readiness_status: "ready",
          certifications: [],
          certification_expirations: {},
          source: "training_record_import",
          created_by: params.actorUserId,
          updated_by: params.actorUserId,
        })
        .select(EMPLOYEE_SELECT)
        .single();

      if (created.error || !created.data) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          entity: "training_records",
          message: created.error?.message || "Failed to create tracked employee for training row.",
        });
        continue;
      }
      employee = created.data as TrackedEmployeeProfileRow;
      employees.push(employee);
    }

    if (!employee) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        entity: "training_records",
        field: "employee_id",
        message: "No matching tracked employee was found for this training record.",
      });
      continue;
    }

    const requirement = findRequirement(requirementsResult.requirements, row.requirementTitle);
    const duplicateKey = trainingRecordKey({
      employeeId: employee.id,
      title: row.trainingTitle,
      completedOn: row.completedOn,
      expiresOn: row.expiresOn,
    });
    if (existingTrainingKeys.has(duplicateKey)) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        entity: "training_records",
        message: "Matching training record already exists and was skipped.",
      });
      continue;
    }

    const result = await params.db.from("company_employee_training_records").insert({
      company_id: params.companyId,
      employee_id: employee.id,
      requirement_id: requirement?.id ?? null,
      title: row.trainingTitle,
      completed_on: row.completedOn,
      expires_on: row.expiresOn,
      provider: row.provider,
      source: row.source,
      notes: row.notes,
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
    });

    if (result.error) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        entity: "training_records",
        message: result.error.message || "Failed to save training record.",
      });
      continue;
    }

    acceptedCount++;
    existingTrainingKeys.add(duplicateKey);
  }

  return { acceptedCount, rowErrors, error: null };
}

export function trackedEmployeePayloadFromManual(body: Record<string, unknown>): NormalizedEmployeeImportRow {
  const email = normalizeEmail(body.email);
  return {
    rowNumber: 1,
    externalEmployeeId: typeof body.employeeId === "string" ? body.employeeId.trim() || null : null,
    fullName: String(body.fullName ?? body.full_name ?? "").trim(),
    email,
    phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
    phoneNormalized: typeof body.phone === "string" ? body.phone.replace(/\D+/g, "") || null : null,
    jobTitle: typeof body.jobTitle === "string" ? body.jobTitle.trim() || null : null,
    tradeSpecialty: typeof body.tradeSpecialty === "string" ? body.tradeSpecialty.trim() || null : null,
    readinessStatus: String(body.readinessStatus ?? "ready"),
    yearsExperience:
      typeof body.yearsExperience === "number" && Number.isFinite(body.yearsExperience)
        ? body.yearsExperience
        : null,
    status: String(body.status ?? "active"),
    jobsiteNames: [],
    certifications: Array.isArray(body.certifications)
      ? body.certifications.map(String).filter(Boolean)
      : [],
    certificationExpirations:
      body.certificationExpirations &&
      typeof body.certificationExpirations === "object" &&
      !Array.isArray(body.certificationExpirations)
        ? (body.certificationExpirations as Record<string, string>)
        : {},
  };
}
