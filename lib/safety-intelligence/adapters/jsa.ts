import type { RawTaskInput } from "@/types/safety-intelligence";

type CompanyJsaActivityRow = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  trade: string | null;
  activity_name: string;
  area: string | null;
  crew_size: number | null;
  hazard_category: string | null;
  hazard_description: string | null;
  mitigation: string | null;
  permit_required: boolean;
  permit_type: string | null;
  work_date: string | null;
};

function normalizeToken(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function adaptCompanyJsaActivityToTaskInput(row: CompanyJsaActivityRow): RawTaskInput {
  const normalizedHazard = normalizeToken(row.hazard_category);
  const normalizedPermit = normalizeToken(row.permit_type);
  return {
    companyId: row.company_id,
    jobsiteId: row.jobsite_id,
    sourceModule: "company_jsa_activity",
    sourceId: row.id,
    tradeCode: normalizeToken(row.trade) || null,
    taskCode: normalizeToken(row.activity_name) || null,
    taskTitle: row.activity_name,
    description: row.hazard_description,
    hazardFamilies: normalizedHazard ? [normalizedHazard as any] : [],
    requiredControls: row.mitigation ? [row.mitigation] : [],
    permitTriggers: row.permit_required && normalizedPermit ? [normalizedPermit as any] : [],
    workAreaLabel: row.area,
    startsAt: row.work_date ? new Date(`${row.work_date}T07:00:00.000Z`).toISOString() : null,
    crewSize: row.crew_size,
    metadata: {
      adapter: "company_jsa_activity",
    },
  };
}
