import * as XLSX from "xlsx";

/** POST /api/company/observations body shape (JSON keys). */
export type FieldIssueObservationImportPayload = {
  title: string;
  description?: string;
  jobsiteId?: string;
  severity?: string;
  category?: string;
  status?: string;
  dueAt?: string;
  observationType?: string;
  sifPotential?: boolean;
  sifCategory?: string;
  dapActivityId?: string;
  assignedUserId?: string;
};

export type FieldIssueJobsiteRef = { id: string; name: string };

export type FieldIssueImportRowOk = {
  sheetRow: number;
  payload: FieldIssueObservationImportPayload;
};

export type FieldIssueImportRowErr = {
  sheetRow: number;
  message: string;
};

export type FieldIssueUserLookup = {
  /** Lowercased email -> user id */
  emailToUserId: Map<string, string>;
};

const STATUS_SET = new Set([
  "open",
  "assigned",
  "in_progress",
  "corrected",
  "verified_closed",
  "escalated",
  "stop_work",
]);

const SEVERITY_SET = new Set(["low", "medium", "high", "critical"]);

const CATEGORY_SET = new Set([
  "hazard",
  "near_miss",
  "incident",
  "good_catch",
  "ppe_violation",
  "housekeeping",
  "equipment_issue",
  "fall_hazard",
  "electrical_hazard",
  "excavation_trench_concern",
  "fire_hot_work_concern",
  "corrective_action",
]);

const OBSERVATION_TYPE_SET = new Set(["positive", "negative", "near_miss"]);

const SIF_CATEGORY_SET = new Set([
  "fall_from_height",
  "struck_by",
  "caught_between",
  "electrical",
  "excavation_collapse",
  "confined_space",
  "hazardous_energy",
  "crane_rigging",
  "line_of_fire",
]);

/** First row of the downloadable template (human-readable headers). */
export const FIELD_ISSUE_IMPORT_TEMPLATE_HEADERS = [
  "title",
  "description",
  "jobsite_id",
  "jobsite_name",
  "severity",
  "category",
  "status",
  "due_at",
  "observation_type",
  "sif_potential",
  "sif_category",
  "dap_activity_id",
  "assigned_user_email",
] as const;

export function excelSerialToDate(serial: number): Date {
  const ms = (serial - 25569) * 86400 * 1000;
  return new Date(ms);
}

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/** Map normalized header -> canonical field key */
function canonicalFieldKey(normalized: string): string | null {
  const aliases: Record<string, string> = {
    title: "title",
    issue_title: "title",
    summary: "title",
    description: "description",
    details: "description",
    jobsite_id: "jobsite_id",
    jobsiteid: "jobsite_id",
    jobsite: "jobsite_name",
    jobsite_name: "jobsite_name",
    sitename: "jobsite_name",
    severity: "severity",
    category: "category",
    status: "status",
    workflow_status: "status",
    due_at: "due_at",
    dueat: "due_at",
    due_date: "due_at",
    duedate: "due_at",
    observation_type: "observation_type",
    observationtype: "observation_type",
    sif_potential: "sif_potential",
    sifpotential: "sif_potential",
    sif_category: "sif_category",
    sifcategory: "sif_category",
    dap_activity_id: "dap_activity_id",
    jsa_activity_id: "dap_activity_id",
    activity_id: "dap_activity_id",
    assigned_user_email: "assigned_user_email",
    assignee_email: "assigned_user_email",
    assigned_user_id: "assigned_user_id",
    assignee_id: "assigned_user_id",
  };
  return aliases[normalized] ?? null;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function parseDueAt(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = excelSerialToDate(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return s.length >= 8 ? s : null;
}

function parseSifPotential(value: unknown): boolean | undefined {
  const s = cellToString(value).toLowerCase();
  if (!s) return undefined;
  if (["yes", "true", "1", "y"].includes(s)) return true;
  if (["no", "false", "0", "n"].includes(s)) return false;
  return undefined;
}

function resolveJobsiteId(
  row: Record<string, unknown>,
  jobsites: FieldIssueJobsiteRef[]
): { jobsiteId: string | null; error?: string } {
  const idRaw = cellToString(row.jobsite_id ?? "");
  if (idRaw) {
    const match = jobsites.find((j) => j.id === idRaw);
    if (!match) {
      return { jobsiteId: null, error: `jobsite_id not found: ${idRaw}` };
    }
    return { jobsiteId: match.id };
  }
  const nameRaw = cellToString(row.jobsite_name ?? row.jobsite ?? "");
  if (!nameRaw) {
    return { jobsiteId: null };
  }
  const lower = nameRaw.toLowerCase();
  const match = jobsites.find((j) => j.name.trim().toLowerCase() === lower);
  if (match) return { jobsiteId: match.id };
  return { jobsiteId: null, error: `jobsite_name not matched: ${nameRaw}` };
}

/**
 * Parse first worksheet of an .xlsx/.xls file into observation payloads.
 * Row 1 = headers; data from row 2. `sheetRow` is 1-based Excel row index.
 */
export function parseFieldIssueExcelBuffer(
  buffer: ArrayBuffer,
  jobsites: FieldIssueJobsiteRef[],
  userLookup?: FieldIssueUserLookup | null
): { ok: FieldIssueImportRowOk[]; errors: FieldIssueImportRowErr[] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { ok: [], errors: [{ sheetRow: 0, message: "Workbook has no sheets." }] };
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];

  if (!rows.length) {
    return { ok: [], errors: [{ sheetRow: 1, message: "Sheet is empty." }] };
  }

  const headerRow = rows[0] ?? [];
  const colIndexToKey: (string | null)[] = headerRow.map((cell) => {
    const n = normalizeKey(cellToString(cell));
    if (!n) return null;
    return canonicalFieldKey(n);
  });

  const ok: FieldIssueImportRowOk[] = [];
  const errors: FieldIssueImportRowErr[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const sheetRow = i + 1;
    const line = rows[i] ?? [];
    const row: Record<string, unknown> = {};
    colIndexToKey.forEach((key, colIdx) => {
      if (!key) return;
      row[key] = line[colIdx];
    });

    const title = cellToString(row.title ?? "");
    if (!title) {
      const empty = line.every((c) => cellToString(c) === "");
      if (empty) continue;
      errors.push({ sheetRow, message: "title is required." });
      continue;
    }

    const jobsiteResult = resolveJobsiteId(row, jobsites);
    if (jobsiteResult.error) {
      errors.push({ sheetRow, message: jobsiteResult.error });
      continue;
    }

    const severityRaw = cellToString(row.severity ?? "");
    const categoryRaw = cellToString(row.category ?? "");
    const statusRaw = cellToString(row.status ?? "");
    const obsRaw = cellToString(row.observation_type ?? "").toLowerCase() || "negative";

    if (severityRaw && !SEVERITY_SET.has(severityRaw.trim().toLowerCase())) {
      errors.push({
        sheetRow,
        message: `Invalid severity "${severityRaw}". Use: ${[...SEVERITY_SET].join(", ")}.`,
      });
      continue;
    }
    if (categoryRaw && !CATEGORY_SET.has(categoryRaw.trim().toLowerCase())) {
      errors.push({
        sheetRow,
        message: `Invalid category "${categoryRaw}". Use: ${[...CATEGORY_SET].join(", ")}.`,
      });
      continue;
    }
    if (statusRaw && !STATUS_SET.has(statusRaw.trim().toLowerCase())) {
      errors.push({
        sheetRow,
        message: `Invalid status "${statusRaw}". Use: ${[...STATUS_SET].join(", ")}.`,
      });
      continue;
    }
    if (!OBSERVATION_TYPE_SET.has(obsRaw)) {
      errors.push({
        sheetRow,
        message: `Invalid observation_type "${obsRaw}". Use: positive, negative, near_miss.`,
      });
      continue;
    }

    const sifCatRaw = cellToString(row.sif_category ?? "").toLowerCase();
    if (sifCatRaw && !SIF_CATEGORY_SET.has(sifCatRaw)) {
      errors.push({
        sheetRow,
        message: `Invalid sif_category "${sifCatRaw}".`,
      });
      continue;
    }

    let sifPotential = parseSifPotential(row.sif_potential);
    if (obsRaw === "negative" && sifPotential === undefined) {
      sifPotential = false;
    }
    if (obsRaw !== "negative") {
      sifPotential = false;
    }
    if (sifPotential === true && !sifCatRaw) {
      errors.push({
        sheetRow,
        message: "sif_category is required when sif_potential is yes/true.",
      });
      continue;
    }

    const dueAt = parseDueAt(row.due_at);
    const dapId = cellToString(row.dap_activity_id ?? "");

    let assignedUserId: string | undefined;
    const emailRaw = cellToString(row.assigned_user_email ?? "").toLowerCase();
    const idAssignee = cellToString(row.assigned_user_id ?? "");
    if (emailRaw && userLookup?.emailToUserId) {
      assignedUserId = userLookup.emailToUserId.get(emailRaw) ?? undefined;
      if (!assignedUserId) {
        errors.push({ sheetRow, message: `assigned_user_email not found: ${emailRaw}` });
        continue;
      }
    } else if (idAssignee) {
      assignedUserId = idAssignee;
    }

    const payload: FieldIssueObservationImportPayload = {
      title,
      description: cellToString(row.description ?? "") || undefined,
      jobsiteId: jobsiteResult.jobsiteId || undefined,
      severity: severityRaw ? severityRaw.trim().toLowerCase() : "medium",
      category: categoryRaw ? categoryRaw.trim().toLowerCase() : "hazard",
      status: statusRaw ? statusRaw.trim().toLowerCase() : "open",
      dueAt: dueAt ?? undefined,
      observationType: obsRaw,
      sifPotential,
      sifCategory: sifPotential && sifCatRaw ? sifCatRaw : undefined,
      dapActivityId: dapId || undefined,
      assignedUserId,
    };

    ok.push({ sheetRow, payload });
  }

  return { ok, errors };
}

/** Build a minimal .xlsx template with header row and one example row. */
export function buildFieldIssueImportTemplateXlsx(): Uint8Array {
  const exampleRow = [
    "Example: Unguarded leading edge",
    "North side deck — no rail or warning line",
    "",
    "",
    "high",
    "fall_hazard",
    "open",
    "",
    "negative",
    "yes",
    "fall_from_height",
    "",
    "",
  ];
  const aoa = [[...FIELD_ISSUE_IMPORT_TEMPLATE_HEADERS], exampleRow];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Issues");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
  return out;
}
