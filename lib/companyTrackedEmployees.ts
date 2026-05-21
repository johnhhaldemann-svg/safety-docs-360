import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseCertificationExpirations,
  type CertificationExpirationMap,
} from "@/lib/certificationExpirations";

export const TRACKED_EMPLOYEE_SOURCE_LABEL = "Tracked employee, no license";

export const WORKER_TYPE_OPTIONS = [
  "Employee",
  "Contractor",
  "Agency Worker",
  "Supplier",
  "Visitor",
  "Temporary Worker",
  "External Worker",
] as const;

export const ACCESS_STATUS_OPTIONS = [
  "active",
  "pending_review",
  "restricted",
  "blocked",
  "inactive",
] as const;

const WORKER_TYPES = new Set<string>(WORKER_TYPE_OPTIONS);
const ACCESS_STATUSES = new Set<string>(ACCESS_STATUS_OPTIONS);

const READINESS_STATUSES = new Set([
  "ready",
  "travel_ready",
  "limited",
  "needs_training",
  "onboarding",
]);

const EMPLOYEE_STATUSES = new Set(["active", "inactive", "archived"]);

export type TrackedEmployeeProfileRow = {
  id: string;
  company_id: string;
  external_employee_id: string | null;
  full_name: string;
  email: string | null;
  email_normalized: string | null;
  phone: string | null;
  phone_normalized: string | null;
  job_title: string | null;
  trade_specialty: string | null;
  readiness_status: string | null;
  years_experience: number | null;
  status: string | null;
  worker_type?: string | null;
  company_name?: string | null;
  department_name?: string | null;
  manager_id?: string | null;
  supervisor_id?: string | null;
  responsible_sponsor_id?: string | null;
  access_status?: string | null;
  access_start_date?: string | null;
  access_end_date?: string | null;
  restrictions?: string[] | null;
  certifications: string[] | null;
  certification_expirations: Record<string, string> | null;
  source?: string | null;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TrackedEmployeeTrainingRecordRow = {
  id: string;
  company_id: string;
  employee_id: string;
  requirement_id: string | null;
  title: string;
  completed_on: string | null;
  expires_on: string | null;
  provider: string | null;
  source: string | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TrackedEmployeeAssignmentRow = {
  id: string;
  company_id: string;
  employee_id: string;
  jobsite_id: string;
  status: string | null;
  jobsite?: {
    id: string;
    name: string;
    status?: string | null;
  } | null;
};

export type TrackedEmployeeWithRecords = TrackedEmployeeProfileRow & {
  trainingRecords: TrackedEmployeeTrainingRecordRow[];
  jobsiteAssignments: TrackedEmployeeAssignmentRow[];
};

export function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function isInvalidEmail(value: unknown): boolean {
  const raw = String(value ?? "").trim();
  return Boolean(raw) && !normalizeEmail(raw);
}

export function normalizePhone(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D+/g, "");
  if (!digits) return null;
  return digits.length >= 7 ? digits : null;
}

export function normalizeReadinessStatus(value: unknown): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return READINESS_STATUSES.has(normalized) ? normalized : "ready";
}

export function normalizeEmployeeStatus(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  return EMPLOYEE_STATUSES.has(normalized) ? normalized : "active";
}

export function normalizeWorkerType(value: unknown): (typeof WORKER_TYPE_OPTIONS)[number] {
  const raw = String(value ?? "").trim();
  if (WORKER_TYPES.has(raw)) return raw as (typeof WORKER_TYPE_OPTIONS)[number];
  const normalized = raw.toLowerCase().replace(/[_-]+/g, " ");
  const match = WORKER_TYPE_OPTIONS.find((option) => option.toLowerCase() === normalized);
  return match ?? "External Worker";
}

export function normalizeAccessStatus(value: unknown): (typeof ACCESS_STATUS_OPTIONS)[number] {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ACCESS_STATUSES.has(normalized) ? (normalized as (typeof ACCESS_STATUS_OPTIONS)[number]) : "restricted";
}

export function formatAccessStatus(value?: string | null) {
  const normalized = normalizeAccessStatus(value);
  if (normalized === "pending_review") return "Pending Review";
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeDateOnly(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 20000 && value < 70000) {
      const ms = Date.UTC(1899, 11, 30) + value * 86400000;
      return new Date(ms).toISOString().slice(0, 10);
    }
    return null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const d = new Date(`${raw}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : raw;
  }

  const slashed = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(raw);
  if (slashed) {
    const month = Number(slashed[1]);
    const day = Number(slashed[2]);
    const yearRaw = Number(slashed[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day
    ) {
      return d.toISOString().slice(0, 10);
    }
  }

  return null;
}

export function parseDelimitedList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(value.map((entry) => String(entry ?? "")));
  }
  return uniqueStrings(
    String(value ?? "")
      .split(/[;,|]+/)
      .map((entry) => entry.trim())
  );
}

export function normalizeRestrictions(value: unknown): string[] {
  return parseDelimitedList(value);
}

export function uniqueStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function parseCertificationExpirationsText(
  value: unknown,
  allowedNames?: Set<string>
): CertificationExpirationMap {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    const parsed = parseCertificationExpirations(value);
    if (!allowedNames) return parsed;
    return Object.fromEntries(
      Object.entries(parsed).filter(([name]) => allowedNames.has(name))
    );
  }

  const out: CertificationExpirationMap = {};
  const parts = String(value)
    .split(/[;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const [nameRaw, ...dateParts] = part.split(/[:=,]/);
    const name = nameRaw?.trim() ?? "";
    const date = normalizeDateOnly(dateParts.join("-").trim());
    if (!name || !date) continue;
    if (allowedNames && !allowedNames.has(name)) continue;
    out[name] = date;
  }

  return out;
}

export function isMissingTrackedEmployeesSchemaError(message?: string | null) {
  const lower = (message ?? "").toLowerCase();
  return (
    lower.includes("company_employee_profiles") ||
    lower.includes("company_employee_training_records") ||
    lower.includes("company_employee_jobsite_assignments") ||
    lower.includes("schema cache") ||
    lower.includes("does not exist") ||
    lower.includes("could not find")
  );
}

function laterDate(left: string | null | undefined, right: string | null | undefined) {
  if (!left) return right ?? null;
  if (!right) return left;
  return right > left ? right : left;
}

export function buildTrackedEmployeeMatrixProfile(
  profile: Pick<
    TrackedEmployeeProfileRow,
    "certifications" | "certification_expirations" | "job_title" | "trade_specialty"
  >,
  trainingRecords: Array<Pick<TrackedEmployeeTrainingRecordRow, "title" | "expires_on">>
) {
  const certifications = uniqueStrings([
    ...(profile.certifications ?? []),
    ...trainingRecords.map((record) => record.title ?? ""),
  ]);

  const expirationMap = parseCertificationExpirations(profile.certification_expirations ?? {});
  for (const record of trainingRecords) {
    const title = record.title?.trim();
    if (!title) continue;
    expirationMap[title] = laterDate(expirationMap[title], record.expires_on) ?? "";
    if (!expirationMap[title]) {
      delete expirationMap[title];
    }
  }

  return {
    certifications,
    certificationExpirations: expirationMap,
    job_title: profile.job_title ?? "",
    trade_specialty: profile.trade_specialty ?? "",
  };
}

export async function loadTrackedCompanyEmployees(params: {
  db: SupabaseClient;
  companyId: string;
  jobsiteIds?: string[];
  includeArchived?: boolean;
}): Promise<{
  employees: TrackedEmployeeWithRecords[];
  warning: string | null;
  error: string | null;
}> {
  const { db, companyId, includeArchived = false } = params;
  const jobsiteIds = params.jobsiteIds?.filter(Boolean) ?? [];

  let employeeIdsFromAssignments: string[] | null = null;
  let scopedAssignments: TrackedEmployeeAssignmentRow[] = [];

  if (jobsiteIds.length > 0) {
    const assignmentsResult = await db
      .from("company_employee_jobsite_assignments")
      .select("id, company_id, employee_id, jobsite_id, status")
      .eq("company_id", companyId)
      .eq("status", "active")
      .in("jobsite_id", jobsiteIds);

    if (assignmentsResult.error) {
      if (isMissingTrackedEmployeesSchemaError(assignmentsResult.error.message)) {
        return { employees: [], warning: "Tracked employee schema is not installed yet.", error: null };
      }
      return { employees: [], warning: null, error: assignmentsResult.error.message };
    }

    scopedAssignments = (assignmentsResult.data ?? []) as TrackedEmployeeAssignmentRow[];
    employeeIdsFromAssignments = uniqueStrings(scopedAssignments.map((row) => row.employee_id));
    if (employeeIdsFromAssignments.length === 0) {
      return { employees: [], warning: null, error: null };
    }
  }

  let employeeQuery = db
    .from("company_employee_profiles")
    .select(
      "id, company_id, external_employee_id, full_name, email, email_normalized, phone, phone_normalized, job_title, trade_specialty, readiness_status, years_experience, status, worker_type, company_name, department_name, manager_id, supervisor_id, responsible_sponsor_id, access_status, access_start_date, access_end_date, restrictions, certifications, certification_expirations, source, archived_at, created_at, updated_at"
    )
    .eq("company_id", companyId);

  if (!includeArchived) {
    employeeQuery = employeeQuery.neq("status", "archived");
  }
  if (employeeIdsFromAssignments) {
    employeeQuery = employeeQuery.in("id", employeeIdsFromAssignments);
  }

  const employeesResult = await employeeQuery.order("full_name", { ascending: true });
  if (employeesResult.error) {
    if (isMissingTrackedEmployeesSchemaError(employeesResult.error.message)) {
      return { employees: [], warning: "Tracked employee schema is not installed yet.", error: null };
    }
    return { employees: [], warning: null, error: employeesResult.error.message };
  }

  const profiles = (employeesResult.data ?? []) as TrackedEmployeeProfileRow[];
  const employeeIds = profiles.map((row) => row.id);

  const [recordsResult, assignmentResult] = employeeIds.length
    ? await Promise.all([
        db
          .from("company_employee_training_records")
          .select(
            "id, company_id, employee_id, requirement_id, title, completed_on, expires_on, provider, source, notes, created_at, updated_at"
          )
          .eq("company_id", companyId)
          .in("employee_id", employeeIds),
        jobsiteIds.length > 0
          ? Promise.resolve({ data: scopedAssignments, error: null })
          : db
              .from("company_employee_jobsite_assignments")
              .select("id, company_id, employee_id, jobsite_id, status")
              .eq("company_id", companyId)
              .eq("status", "active")
              .in("employee_id", employeeIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

  const detailError = recordsResult.error?.message || assignmentResult.error?.message;
  if (detailError) {
    if (isMissingTrackedEmployeesSchemaError(detailError)) {
      return { employees: [], warning: "Tracked employee schema is not installed yet.", error: null };
    }
    return { employees: [], warning: null, error: detailError };
  }

  const recordsByEmployee = new Map<string, TrackedEmployeeTrainingRecordRow[]>();
  for (const record of (recordsResult.data ?? []) as TrackedEmployeeTrainingRecordRow[]) {
    const list = recordsByEmployee.get(record.employee_id) ?? [];
    list.push(record);
    recordsByEmployee.set(record.employee_id, list);
  }

  const assignmentsByEmployee = new Map<string, TrackedEmployeeAssignmentRow[]>();
  for (const assignment of (assignmentResult.data ?? []) as TrackedEmployeeAssignmentRow[]) {
    const list = assignmentsByEmployee.get(assignment.employee_id) ?? [];
    list.push(assignment);
    assignmentsByEmployee.set(assignment.employee_id, list);
  }

  return {
    employees: profiles.map((profile) => ({
      ...profile,
      trainingRecords: recordsByEmployee.get(profile.id) ?? [],
      jobsiteAssignments: assignmentsByEmployee.get(profile.id) ?? [],
    })),
    warning: null,
    error: null,
  };
}
