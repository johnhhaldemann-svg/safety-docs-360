export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type CompanySecurityEventType =
  | "login_observed"
  | "session_observed"
  | "user_invited"
  | "user_access_updated"
  | "user_suspended"
  | "user_removed"
  | "file_upload_link_created"
  | "file_uploaded"
  | "file_downloaded"
  | "report_export_link_created"
  | "company_setting_updated"
  | "billing_admin_action"
  | "security_sensitive_ai_action"
  | "data_request_submitted"
  | "data_request_updated"
  | "data_request_completed";

export type CompanySecurityResourceType =
  | "auth_session"
  | "company_invite"
  | "company_user"
  | "company_membership"
  | "document"
  | "report"
  | "storage_object"
  | "company_setting"
  | "billing"
  | "ai_review"
  | "data_request"
  | "other";

export type CompanySecurityEvent = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  actor_user_id: string | null;
  actor_role: string | null;
  event_type: CompanySecurityEventType | string;
  resource_type: CompanySecurityResourceType | string;
  resource_id: string | null;
  title: string;
  detail: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: JsonObject;
  occurred_at: string;
};

export const COMPANY_DATA_REQUEST_TYPES = [
  "export",
  "deletion",
  "correction",
  "privacy_review",
] as const;

export type CompanyDataRequestType = (typeof COMPANY_DATA_REQUEST_TYPES)[number];

export const COMPANY_DATA_REQUEST_SCOPES = [
  "company",
  "jobsite",
  "user",
  "document",
  "other",
] as const;

export type CompanyDataRequestScope = (typeof COMPANY_DATA_REQUEST_SCOPES)[number];

export const COMPANY_DATA_REQUEST_STATUSES = [
  "submitted",
  "reviewing",
  "waiting_on_customer",
  "completed",
  "denied",
  "canceled",
] as const;

export type CompanyDataRequestStatus = (typeof COMPANY_DATA_REQUEST_STATUSES)[number];

export type CompanyDataRequest = {
  id: string;
  company_id: string;
  request_type: CompanyDataRequestType;
  request_scope: CompanyDataRequestScope;
  subject_user_id: string | null;
  subject_email: string | null;
  jobsite_id: string | null;
  document_id: string | null;
  status: CompanyDataRequestStatus;
  requested_by: string | null;
  reviewed_by: string | null;
  completed_by: string | null;
  title: string;
  description: string | null;
  reviewer_notes: string | null;
  completion_evidence: string | null;
  evidence_storage_path: string | null;
  metadata: JsonObject;
  due_at: string | null;
  reviewed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
