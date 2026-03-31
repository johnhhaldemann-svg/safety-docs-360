import environmentalRows from "./environmental-audit-rows.json";
import healthSafetyRows from "./health-safety-audit-rows.json";

export type AuditExcelRow = Record<string, string | undefined>;

const ENV_PRIORITY = [
  "Category/Requirement",
  "Category/Requirement_1",
  "Permit Type/Condition",
  "Permit #",
  "Renew Date",
  "Value",
  "Compliant",
  "Comments",
  "Comments_1",
  "Comments_2",
  "Comments_3",
  "Permit Type/Condition_1",
  "Permit #_1",
  "Renew Date_1",
  "Value_1",
  "Compliant_1",
  "Date",
  "Date_1",
  "Y/N",
  "Y/N_1",
] as const;

function isBlank(v: unknown): v is null | undefined | "" {
  return v == null || String(v).trim() === "";
}

/** True when a column still has real checklist text after stripping template "N/A" padding. */
export function meaningfulTemplateCategory(value: string | undefined): boolean {
  if (isBlank(value)) return false;
  const withoutNa = String(value)
    .replace(/\s*N\/A\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return withoutNa.length >= 4;
}

/**
 * Environmental workbook mixes program checklist lines with site-filled permit/equipment rows.
 * Keep only rows that still carry at least one program/category column (generic template).
 */
export function shouldIncludeEnvironmentalRow(row: AuditExcelRow): boolean {
  return (
    meaningfulTemplateCategory(row["Category/Requirement"]) ||
    meaningfulTemplateCategory(row["Category/Requirement_1"])
  );
}

function looksLikeFacilityPermitNumber(value: string): boolean {
  return /^[A-Z]\d{4,}\s*$/i.test(value.trim());
}

/** Remove example permit IDs and tagged equipment lines copied from one facility. */
export function sanitizeEnvironmentalRow(row: AuditExcelRow): AuditExcelRow {
  const out: AuditExcelRow = { ...row };
  for (const key of ["Permit #", "Permit #_1"] as const) {
    const v = out[key];
    if (v && looksLikeFacilityPermitNumber(String(v))) {
      delete out[key];
    }
  }
  for (const key of ["Permit Type/Condition", "Permit Type/Condition_1"] as const) {
    const v = out[key];
    if (!v) continue;
    const t = String(v).trim();
    if (/\b(Furnace|Oven|Boiler|Scrubber|Press|Tank|Kiln|Generator)\s*#\s*\d+/i.test(t)) {
      delete out[key];
    }
  }
  for (const key of ["Comments_1", "Comments_2", "Comments_3"] as const) {
    const v = out[key];
    if (v && /\bS\/N\b|Model\s*#/i.test(String(v))) {
      delete out[key];
    }
  }
  return out;
}

/** Excel repeats a header row with literal column titles. */
export function isChecklistColumnHeaderRow(row: AuditExcelRow): boolean {
  return String(row["Category/Requirement"] ?? "").trim() === "Category/Requirement";
}

export function rowHasContent(row: AuditExcelRow): boolean {
  return Object.values(row).some((v) => !isBlank(v));
}

export function splitIntoSections(rows: AuditExcelRow[]): AuditExcelRow[][] {
  const sections: AuditExcelRow[][] = [];
  let current: AuditExcelRow[] = [];
  for (const row of rows) {
    if (isChecklistColumnHeaderRow(row)) {
      if (current.length) sections.push(current);
      current = [];
      continue;
    }
    if (rowHasContent(row)) {
      current.push(row);
    }
  }
  if (current.length) sections.push(current);
  return sections;
}

export function humanizeFieldKey(key: string): string {
  if (key === "Category/Requirement") return "Program / category (left)";
  if (key === "Category/Requirement_1") return "Program / category (right)";
  if (key === "Permit Type/Condition") return "Permit type / condition (left)";
  if (key === "Permit Type/Condition_1") return "Permit type / condition (right)";
  if (key === "Permit #") return "Permit # (left)";
  if (key === "Permit #_1") return "Permit # (right)";
  if (key === "Renew Date") return "Renew date (left)";
  if (key === "Renew Date_1") return "Renew date (right)";
  if (key === "Value") return "Value (left)";
  if (key === "Value_1") return "Value (right)";
  if (key === "Compliant") return "Compliant (left)";
  if (key === "Compliant_1") return "Compliant (right)";
  if (key === "Comments") return "Comments";
  if (key === "Comments_1") return "Comments (detail 1)";
  if (key === "Comments_2") return "Comments (detail 2)";
  if (key === "Comments_3") return "Comments (detail 3)";
  if (key === "Date") return "Date (left)";
  if (key === "Date_1") return "Date (right)";
  if (key === "Y/N") return "Y/N (left)";
  if (key === "Y/N_1") return "Y/N (right)";
  return key.replace(/_/g, " ");
}

export function orderedRowEntries(row: AuditExcelRow): [string, string][] {
  const entries = Object.entries(row).filter(([, v]) => !isBlank(v)) as [string, string][];
  const rank = (k: string) => {
    const i = (ENV_PRIORITY as readonly string[]).indexOf(k);
    return i === -1 ? 999 : i;
  };
  entries.sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  return entries;
}

export function getEnvironmentalSections(): AuditExcelRow[][] {
  const source = environmentalRows as AuditExcelRow[];
  const filtered = source.filter(
    (row) => isChecklistColumnHeaderRow(row) || shouldIncludeEnvironmentalRow(row)
  );
  return splitIntoSections(filtered).map((section) => section.map(sanitizeEnvironmentalRow));
}

export function getHealthSafetySections(): AuditExcelRow[][] {
  return splitIntoSections(healthSafetyRows as AuditExcelRow[]);
}
