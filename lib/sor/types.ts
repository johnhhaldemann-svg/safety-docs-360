export type SorStatus = "draft" | "submitted" | "locked" | "superseded";

export type SorRecordRow = {
  id: string;
  company_id: string;
  date: string;
  project: string;
  location: string;
  trade: string;
  category: string;
  subcategory: string | null;
  description: string;
  severity: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  status: SorStatus;
  version_number: number;
  previous_version_id: string | null;
  record_hash: string | null;
  previous_hash: string | null;
  change_reason: string | null;
  is_deleted: boolean;
};

export type SorAuditLogRow = {
  id: string;
  sor_id: string;
  company_id: string;
  action_type: "create" | "submit" | "edit" | "supersede" | "soft_delete" | "restore" | "lock";
  user_id: string | null;
  timestamp: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  notes: string | null;
};
