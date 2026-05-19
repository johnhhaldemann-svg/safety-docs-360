export const SOR_IMPORT_TEMPLATE_COLUMNS = [
  "date",
  "project",
  "location",
  "trade",
  "hazard_category_code",
  "category",
  "subcategory",
  "description",
  "severity",
  "status",
  "external_id",
  "notes",
] as const;

const SOR_IMPORT_TEMPLATE_SAMPLE_ROW = [
  "2026-05-18",
  "Riverside Commercial Tower",
  "Level 3 north deck",
  "Steel Erection",
  "falls_elevation",
  "Fall Protection",
  "Leading edge",
  "North deck, leading edge missing temporary guardrail",
  "high",
  "draft",
  "LEGACY-SOR-1001",
  "Imported from legacy SOR log",
] as const;

function csvEscape(value: unknown) {
  const raw = String(value ?? "");
  return /[",\n\r]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

export function sorImportTemplateCsv(): string {
  return [SOR_IMPORT_TEMPLATE_COLUMNS, SOR_IMPORT_TEMPLATE_SAMPLE_ROW]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n") + "\n";
}
