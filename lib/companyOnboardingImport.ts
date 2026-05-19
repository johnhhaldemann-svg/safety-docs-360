import {
  isInvalidEmail,
  normalizeDateOnly,
  normalizeEmail,
  normalizeEmployeeStatus,
  normalizePhone,
  normalizeReadinessStatus,
  parseCertificationExpirationsText,
  parseDelimitedList,
  uniqueStrings,
} from "@/lib/companyTrackedEmployees";

export const COMPANY_ONBOARDING_IMPORT_TYPES = [
  "employees",
  "jobsites",
  "training_records",
] as const;

export type CompanyOnboardingImportType =
  (typeof COMPANY_ONBOARDING_IMPORT_TYPES)[number];

export const EMPLOYEE_TEMPLATE_COLUMNS = [
  "employee_id",
  "full_name",
  "email",
  "phone",
  "job_title",
  "trade_specialty",
  "readiness_status",
  "years_experience",
  "status",
  "jobsite_names",
  "certifications",
  "certification_expirations",
] as const;

export const JOBSITE_TEMPLATE_COLUMNS = [
  "name",
  "jobsite_number",
  "project_number",
  "location",
  "status",
  "project_manager",
  "safety_lead",
  "start_date",
  "end_date",
  "notes",
] as const;

export const TRAINING_RECORD_TEMPLATE_COLUMNS = [
  "employee_id",
  "email",
  "full_name",
  "requirement_title",
  "training_title",
  "completed_on",
  "expires_on",
  "provider",
  "source",
  "notes",
] as const;

const JOBSITE_STATUSES = new Set(["planned", "active", "completed", "archived"]);

export type ImportRowError = {
  rowNumber: number;
  entity: CompanyOnboardingImportType;
  field?: string;
  message: string;
};

export type NormalizedEmployeeImportRow = {
  rowNumber: number;
  externalEmployeeId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  phoneNormalized: string | null;
  jobTitle: string | null;
  tradeSpecialty: string | null;
  readinessStatus: string;
  yearsExperience: number | null;
  status: string;
  jobsiteNames: string[];
  certifications: string[];
  certificationExpirations: Record<string, string>;
};

export type NormalizedJobsiteImportRow = {
  rowNumber: number;
  name: string;
  jobsiteNumber: string;
  projectNumber: string | null;
  location: string | null;
  status: string;
  projectManager: string | null;
  safetyLead: string | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
};

export type NormalizedTrainingRecordImportRow = {
  rowNumber: number;
  externalEmployeeId: string | null;
  email: string | null;
  fullName: string | null;
  requirementTitle: string | null;
  trainingTitle: string;
  completedOn: string | null;
  expiresOn: string | null;
  provider: string | null;
  source: string;
  notes: string | null;
};

export function templateCsvFor(type: CompanyOnboardingImportType): string {
  const columns = columnsForType(type);
  const sample =
    type === "employees"
      ? [
          "E-1001",
          "Jordan Lee",
          "jordan.lee@example.com",
          "555-0100",
          "Foreman",
          "Structural Steel and Erection",
          "ready",
          "12",
          "active",
          "North Tower; Warehouse Retrofit",
          "OSHA 10 Construction; First Aid / CPR",
          "OSHA 10 Construction:2027-08-12; First Aid / CPR:2026-11-15",
        ]
      : type === "jobsites"
        ? [
            "North Tower",
            "SITE-0001",
            "NT-001",
            "Austin, TX",
            "active",
            "Nora Williams",
            "Maria Chen",
            "2026-06-01",
            "2026-12-15",
            "Initial project import",
          ]
        : [
            "E-1001",
            "jordan.lee@example.com",
            "Jordan Lee",
            "OSHA 10",
            "OSHA 10 Construction",
            "2025-08-12",
            "2027-08-12",
            "ABC Safety",
            "manual_upload",
            "Imported from legacy roster",
          ];

  return [columns, sample].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

export function columnsForType(type: CompanyOnboardingImportType): readonly string[] {
  if (type === "employees") return EMPLOYEE_TEMPLATE_COLUMNS;
  if (type === "jobsites") return JOBSITE_TEMPLATE_COLUMNS;
  return TRAINING_RECORD_TEMPLATE_COLUMNS;
}

function csvEscape(value: unknown) {
  const raw = String(value ?? "");
  return /[",\n\r]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanNullable(value: unknown): string | null {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function valueFor(row: Record<string, unknown>, names: string[]): unknown {
  const exact = names.find((name) => Object.prototype.hasOwnProperty.call(row, name));
  if (exact) return row[exact];

  const normalizedNames = new Set(names.map(normalizeKey));
  for (const [key, value] of Object.entries(row)) {
    if (normalizedNames.has(normalizeKey(key))) return value;
  }

  return "";
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function fullNameForEmployeeRow(row: Record<string, unknown>) {
  const direct = cleanString(
    valueFor(row, [
      "full_name",
      "full name",
      "fullName",
      "employee_name",
      "employee name",
      "worker_name",
      "worker name",
      "person_name",
      "person name",
      "name",
    ])
  );
  if (direct) return direct;

  const firstName = cleanString(valueFor(row, ["first_name", "first name", "firstName", "first"]));
  const middleName = cleanString(
    valueFor(row, ["middle_name", "middle name", "middleName", "middle"])
  );
  const lastName = cleanString(valueFor(row, ["last_name", "last name", "lastName", "last"]));
  return [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
}

function normalizeYears(value: unknown): number | null | "invalid" {
  const raw = cleanString(value);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 80) return "invalid";
  return parsed;
}

function normalizeJobsiteStatus(value: unknown) {
  const normalized = cleanString(value).toLowerCase();
  return JOBSITE_STATUSES.has(normalized) ? normalized : "active";
}

export function validateEmployeeImportRows(
  rows: Array<Record<string, unknown>>
): { validRows: NormalizedEmployeeImportRow[]; rowErrors: ImportRowError[] } {
  const validRows: NormalizedEmployeeImportRow[] = [];
  const rowErrors: ImportRowError[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const fullName = fullNameForEmployeeRow(row);
    const rawEmail = valueFor(row, ["email", "email_address", "email address"]);
    const email = normalizeEmail(rawEmail);
    const yearsExperience = normalizeYears(valueFor(row, ["years_experience", "years experience", "yearsExperience"]));
    const certifications = parseDelimitedList(valueFor(row, ["certifications", "certification"]));
    const certificationExpirations = parseCertificationExpirationsText(
      valueFor(row, ["certification_expirations", "certification expirations", "certificationExpirations", "cert_expirations"]),
      certifications.length ? new Set(certifications) : undefined
    );

    if (!fullName) {
      rowErrors.push({ rowNumber, entity: "employees", field: "full_name", message: "Full name is required." });
      return;
    }
    if (isInvalidEmail(rawEmail)) {
      rowErrors.push({ rowNumber, entity: "employees", field: "email", message: "Email is not valid." });
      return;
    }
    if (yearsExperience === "invalid") {
      rowErrors.push({
        rowNumber,
        entity: "employees",
        field: "years_experience",
        message: "Years experience must be a number from 0 to 80.",
      });
      return;
    }

    const phone = cleanNullable(valueFor(row, ["phone", "phone_number", "phone number"]));
    validRows.push({
      rowNumber,
      externalEmployeeId: cleanNullable(
        valueFor(row, [
          "employee_id",
          "external_employee_id",
          "employee id",
          "employeeId",
          "employee_number",
          "employee number",
          "worker_id",
          "worker id",
          "badge_id",
          "badge id",
          "badge",
        ])
      ),
      fullName,
      email,
      phone,
      phoneNormalized: normalizePhone(phone),
      jobTitle: cleanNullable(
        valueFor(row, ["job_title", "job title", "jobTitle", "position", "title", "role"])
      ),
      tradeSpecialty: cleanNullable(
        valueFor(row, [
          "trade_specialty",
          "trade specialty",
          "tradeSpecialty",
          "trade",
          "craft",
          "discipline",
        ])
      ),
      readinessStatus: normalizeReadinessStatus(valueFor(row, ["readiness_status", "readiness status", "readinessStatus"])),
      yearsExperience,
      status: normalizeEmployeeStatus(valueFor(row, ["status"])),
      jobsiteNames: parseDelimitedList(valueFor(row, ["jobsite_names", "jobsite names", "jobsiteNames", "jobsites"])),
      certifications,
      certificationExpirations,
    });
  });

  return { validRows, rowErrors };
}

export function validateJobsiteImportRows(
  rows: Array<Record<string, unknown>>
): { validRows: NormalizedJobsiteImportRow[]; rowErrors: ImportRowError[] } {
  const validRows: NormalizedJobsiteImportRow[] = [];
  const rowErrors: ImportRowError[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = cleanString(valueFor(row, ["name", "jobsite", "jobsite_name", "jobsite name"]));
    const jobsiteNumber = cleanString(valueFor(row, ["jobsite_number", "jobsite number", "jobsiteNumber"]));
    const startDate = normalizeDateOnly(valueFor(row, ["start_date", "start date"]));
    const endDate = normalizeDateOnly(valueFor(row, ["end_date", "end date"]));

    if (!name) {
      rowErrors.push({ rowNumber, entity: "jobsites", field: "name", message: "Jobsite name is required." });
      return;
    }
    if (!jobsiteNumber) {
      rowErrors.push({ rowNumber, entity: "jobsites", field: "jobsite_number", message: "Jobsite number is required." });
      return;
    }
    if (cleanString(valueFor(row, ["start_date", "start date"])) && !startDate) {
      rowErrors.push({ rowNumber, entity: "jobsites", field: "start_date", message: "Start date is not valid." });
      return;
    }
    if (cleanString(valueFor(row, ["end_date", "end date"])) && !endDate) {
      rowErrors.push({ rowNumber, entity: "jobsites", field: "end_date", message: "End date is not valid." });
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      rowErrors.push({ rowNumber, entity: "jobsites", field: "end_date", message: "End date must be after start date." });
      return;
    }

    validRows.push({
      rowNumber,
      name,
      jobsiteNumber,
      projectNumber: cleanNullable(valueFor(row, ["project_number", "project number", "projectNumber"])),
      location: cleanNullable(valueFor(row, ["location", "address"])),
      status: normalizeJobsiteStatus(valueFor(row, ["status"])),
      projectManager: cleanNullable(valueFor(row, ["project_manager", "project manager", "projectManager"])),
      safetyLead: cleanNullable(valueFor(row, ["safety_lead", "safety lead", "safetyLead"])),
      startDate,
      endDate,
      notes: cleanNullable(valueFor(row, ["notes"])),
    });
  });

  return { validRows, rowErrors };
}

export function validateTrainingRecordImportRows(
  rows: Array<Record<string, unknown>>
): { validRows: NormalizedTrainingRecordImportRow[]; rowErrors: ImportRowError[] } {
  const validRows: NormalizedTrainingRecordImportRow[] = [];
  const rowErrors: ImportRowError[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const externalEmployeeId = cleanNullable(valueFor(row, ["employee_id", "external_employee_id", "employee id", "employeeId"]));
    const rawEmail = valueFor(row, ["email", "email_address", "email address"]);
    const email = normalizeEmail(rawEmail);
    const fullName = cleanNullable(valueFor(row, ["full_name", "full name", "fullName", "name"]));
    const requirementTitle = cleanNullable(valueFor(row, ["requirement_title", "requirement title", "requirementTitle"]));
    const trainingTitle =
      cleanNullable(valueFor(row, ["training_title", "training title", "trainingTitle", "title"])) ??
      requirementTitle ??
      "";
    const completedOn = normalizeDateOnly(valueFor(row, ["completed_on", "completed on", "completedOn", "completed_date"]));
    const expiresOn = normalizeDateOnly(valueFor(row, ["expires_on", "expires on", "expiresOn", "expiration_date"]));

    if (!externalEmployeeId && !email && !fullName) {
      rowErrors.push({
        rowNumber,
        entity: "training_records",
        field: "employee_id",
        message: "Employee ID, email, or full name is required to match a tracked employee.",
      });
      return;
    }
    if (isInvalidEmail(rawEmail)) {
      rowErrors.push({ rowNumber, entity: "training_records", field: "email", message: "Email is not valid." });
      return;
    }
    if (!trainingTitle) {
      rowErrors.push({
        rowNumber,
        entity: "training_records",
        field: "training_title",
        message: "Training title or requirement title is required.",
      });
      return;
    }
    if (cleanString(valueFor(row, ["completed_on", "completed on", "completed_date"])) && !completedOn) {
      rowErrors.push({
        rowNumber,
        entity: "training_records",
        field: "completed_on",
        message: "Completed date is not valid.",
      });
      return;
    }
    if (cleanString(valueFor(row, ["expires_on", "expires on", "expiration_date"])) && !expiresOn) {
      rowErrors.push({
        rowNumber,
        entity: "training_records",
        field: "expires_on",
        message: "Expiration date is not valid.",
      });
      return;
    }
    if (completedOn && expiresOn && expiresOn < completedOn) {
      rowErrors.push({
        rowNumber,
        entity: "training_records",
        field: "expires_on",
        message: "Expiration date must be after completed date.",
      });
      return;
    }

    validRows.push({
      rowNumber,
      externalEmployeeId,
      email,
      fullName,
      requirementTitle,
      trainingTitle,
      completedOn,
      expiresOn,
      provider: cleanNullable(valueFor(row, ["provider"])),
      source: cleanNullable(valueFor(row, ["source"])) ?? "manual_upload",
      notes: cleanNullable(valueFor(row, ["notes"])),
    });
  });

  return { validRows, rowErrors };
}

export function countValidRowsByType(params: {
  employees?: NormalizedEmployeeImportRow[];
  jobsites?: NormalizedJobsiteImportRow[];
  trainingRecords?: NormalizedTrainingRecordImportRow[];
}) {
  return {
    employees: params.employees?.length ?? 0,
    jobsites: params.jobsites?.length ?? 0,
    training_records: params.trainingRecords?.length ?? 0,
  };
}

export function normalizeRowsArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    .filter((row) => {
      const values = Object.values(row).map((entry) => String(entry ?? "").trim());
      return values.some(Boolean);
    })
    .map((row) => {
      const normalized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(row)) {
        normalized[normalizeKey(key)] = val;
      }
      return normalized;
    });
}

export function buildImportTypeFromPayload(payload: {
  employees?: unknown;
  jobsites?: unknown;
  trainingRecords?: unknown;
  training_records?: unknown;
}): CompanyOnboardingImportType | "mixed" {
  const present = [
    normalizeRowsArray(payload.employees).length > 0 ? "employees" : null,
    normalizeRowsArray(payload.jobsites).length > 0 ? "jobsites" : null,
    normalizeRowsArray(payload.trainingRecords ?? payload.training_records).length > 0
      ? "training_records"
      : null,
  ].filter(Boolean);
  return present.length === 1 ? (present[0] as CompanyOnboardingImportType) : "mixed";
}

export function dedupeImportRows<T extends { rowNumber: number }>(
  rows: T[],
  keyFor: (row: T) => string | null
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = keyFor(row);
    if (key) {
      const normalized = key.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
    }
    out.push(row);
  }
  return out;
}

export function makeEmployeeImportKey(row: NormalizedEmployeeImportRow) {
  return row.externalEmployeeId || row.email || row.fullName;
}

export function makeJobsiteImportKey(row: NormalizedJobsiteImportRow) {
  return row.name;
}

export function makeTrainingImportKey(row: NormalizedTrainingRecordImportRow) {
  return uniqueStrings([
    row.externalEmployeeId ?? "",
    row.email ?? "",
    row.fullName ?? "",
    row.requirementTitle ?? "",
    row.trainingTitle,
    row.completedOn ?? "",
    row.expiresOn ?? "",
  ]).join("|");
}
