import type { RawTaskInput } from "@/types/safety-intelligence";

type CompanyIncidentRow = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  title: string;
  description: string | null;
  category: string;
  severity: string;
  occurred_at: string | null;
};

function normalizeToken(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function adaptCompanyIncidentToTaskInput(row: CompanyIncidentRow): RawTaskInput {
  const normalizedCategory = normalizeToken(row.category);
  return {
    companyId: row.company_id,
    jobsiteId: row.jobsite_id,
    sourceModule: "company_incident",
    sourceId: row.id,
    taskCode: normalizeToken(row.category),
    taskTitle: row.title,
    description: row.description,
    hazardFamilies: normalizedCategory ? [normalizedCategory as any] : [],
    startsAt: row.occurred_at,
    metadata: {
      adapter: "company_incident",
      severity: row.severity,
    },
  };
}
