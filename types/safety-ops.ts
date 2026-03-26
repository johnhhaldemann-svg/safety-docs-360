export type AppRole =
  | "platform_admin"
  | "internal_reviewer"
  | "employee"
  | "company_admin"
  | "safety_manager"
  | "project_manager"
  | "foreman"
  | "field_user"
  | "read_only";

export type ObservationStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "corrected"
  | "verified_closed"
  | "escalated"
  | "stop_work";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ObservationType = "positive" | "negative" | "near_miss";

export interface Company {
  id: string;
  name: string;
  status: "pending" | "approved" | "suspended";
  created_by: string | null;
  created_at: string;
}

export interface Jobsite {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface Dap {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  work_date: string | null;
  created_by: string | null;
  supervisor_name: string | null;
  weather_summary: string | null;
  overall_risk_level: string | null;
  signed_by: string | null;
  signed_at: string | null;
  status: string;
}

export interface DapActivity {
  id: string;
  dap_id: string;
  company_id?: string;
  jobsite_id?: string | null;
  trade: string | null;
  activity_name: string;
  area: string | null;
  crew_size: number | null;
  hazard_category: string | null;
  hazard_description: string | null;
  mitigation: string | null;
  permit_required: boolean;
  permit_type: string | null;
  planned_risk_level: string | null;
  status: string;
}

export interface Observation {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  dap_activity_id: string | null;
  observed_at?: string | null;
  observer_id?: string | null;
  trade?: string | null;
  area?: string | null;
  activity_name?: string | null;
  hazard_category?: string | null;
  observation_type?: ObservationType | null;
  title: string;
  description: string | null;
  risk_level?: "low" | "medium" | "high" | null;
  severity?: RiskLevel | null;
  sif_potential?: boolean | null;
  sif_category?: string | null;
  responsible_party?: string | null;
  status: ObservationStatus;
  corrective_action?: string | null;
  identified_at?: string | null;
  corrected_at?: string | null;
  verified_at?: string | null;
  due_at?: string | null;
  created_at: string;
  closed_at?: string | null;
}

export interface ObservationPhoto {
  id: string;
  observation_id: string;
  file_path: string;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Permit {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  dap_activity_id: string | null;
  observation_id?: string | null;
  permit_type: string;
  issued_to: string | null;
  issued_by: string | null;
  issued_at: string | null;
  expires_at: string | null;
  status: string;
}

export interface Incident {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  observation_id: string | null;
  incident_type: string | null;
  severity: RiskLevel | null;
  description: string | null;
  root_cause: string | null;
  reported_by: string | null;
  reported_at: string | null;
  status: string;
}

export interface DailyReport {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  title: string;
  report_type: string;
  status: string;
  generated_at: string | null;
  file_path: string | null;
}
