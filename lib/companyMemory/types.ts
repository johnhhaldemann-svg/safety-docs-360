export type CompanyMemorySource =
  | "manual"
  | "document_excerpt"
  | "incident_summary"
  | "other";

export type CompanyMemoryItemRow = {
  id: string;
  company_id: string;
  source: CompanyMemorySource;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyMemoryMatchRow = CompanyMemoryItemRow & {
  similarity?: number;
};
