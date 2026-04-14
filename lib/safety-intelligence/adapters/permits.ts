import type { RawTaskInput } from "@/types/safety-intelligence";

type CompanyPermitRow = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  permit_type: string;
  title: string;
  status: string;
  severity: string;
};

function normalizeToken(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function adaptCompanyPermitToTaskInput(row: CompanyPermitRow): RawTaskInput {
  const normalizedPermit = normalizeToken(row.permit_type);
  return {
    companyId: row.company_id,
    jobsiteId: row.jobsite_id,
    sourceModule: "company_permit",
    sourceId: row.id,
    taskCode: normalizeToken(row.permit_type),
    taskTitle: row.title,
    description: `Permit status: ${row.status}`,
    permitTriggers: normalizedPermit ? [normalizedPermit as any] : [],
    metadata: {
      adapter: "company_permit",
      severity: row.severity,
      status: row.status,
    },
  };
}
