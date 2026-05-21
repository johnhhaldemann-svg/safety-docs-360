import type { SafetyIngestionSourceType, StandardSeverity } from "@/types/safety-intelligence";

export const SOURCE_TYPE_ALIASES: Record<string, SafetyIngestionSourceType> = {
  sor: "sor",
  safety_observation: "sor",
  safety_observation_report: "sor",
  observation: "observation",
  observation_report: "observation",
  jsa: "jsa",
  dap: "jsa",
  daily_activity_plan: "jsa",
  incident: "incident_report",
  incident_report: "incident_report",
  injury: "incident_report",
  near_miss: "incident_report",
  corrective_action: "corrective_action",
  corrective: "corrective_action",
  action_item: "corrective_action",
  permit: "permit",
  work_permit: "permit",
  ptw: "permit",
  other: "other",
};

export const SEVERITY_ALIASES: Record<string, StandardSeverity> = {
  low: "low",
  minor: "low",
  medium: "medium",
  moderate: "medium",
  med: "medium",
  high: "high",
  serious: "high",
  severe: "critical",
  critical: "critical",
  fatal: "critical",
  sif: "critical",
};

export const DIRECT_COMPANY_FIELD_KEYS = new Set([
  "company_name",
  "companyname",
  "contractor_company",
  "contractorcompany",
  "gc_cm",
  "gccm",
  "owner_client",
  "ownerclient",
  "employer",
  "vendor_name",
  "vendorname",
]);

export const TITLE_ALIASES = [
  "title",
  "name",
  "subject",
  "activity_name",
  "task_title",
  "permit_title",
];

export const SUMMARY_ALIASES = [
  "summary",
  "short_description",
  "brief_description",
  "narrative_summary",
];

export const DESCRIPTION_ALIASES = [
  "description",
  "details",
  "hazard_description",
  "narrative",
];

export const TRADE_ALIASES = [
  "trade",
  "trade_code",
  "work_trade",
  "craft",
  "discipline",
];

export const CATEGORY_ALIASES = [
  "category",
  "category_code",
  "hazard_category",
  "type",
  "permit_type",
  "incident_type",
];

export const SOURCE_ID_ALIASES = [
  "source_record_id",
  "sourceid",
  "source_id",
  "record_id",
  "submission_id",
  "permit_id",
  "incident_id",
  "id",
];

export const JOBSITE_ID_ALIASES = [
  "jobsite_id",
  "jobsiteid",
  "project_id",
  "projectid",
];

export const SOURCE_TYPE_ALIASES_FIELDS = [
  "source_type",
  "sourcetype",
  "form_type",
  "record_type",
  "module",
];

export const SEVERITY_FIELD_ALIASES = [
  "severity",
  "risk_level",
  "priority",
  "objective_severity",
];

export const CREATED_AT_ALIASES = [
  "source_created_at",
  "created_at",
  "submitted_at",
  "reported_at",
  "date",
];

export const EVENT_AT_ALIASES = [
  "event_at",
  "event_date",
  "occurred_at",
  "incident_date",
  "observation_date",
  "work_date",
  "issued_at",
];

export const DUE_AT_ALIASES = ["due_at", "due_date"];
export const VALID_FROM_ALIASES = ["valid_from", "start_at", "starts_at"];
export const VALID_TO_ALIASES = ["valid_to", "end_at", "ends_at", "expires_at"];

export const CORPORATE_SUFFIXES = [
  "inc",
  "inc.",
  "llc",
  "l.l.c.",
  "ltd",
  "ltd.",
  "corp",
  "corp.",
  "co",
  "co.",
  "company",
  "lp",
  "l.p.",
  "pllc",
  "plc",
  "gmbh",
  "sa",
];
