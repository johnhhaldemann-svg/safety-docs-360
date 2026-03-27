import type { ObservationSeverity, ObservationStatus } from "./constants";

export type SafetyObservationRow = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  project_id: string | null;
  title: string;
  description: string | null;
  observation_type: string;
  category: string;
  subcategory: string;
  severity: string;
  status: string;
  trade: string | null;
  location: string | null;
  linked_dap_id: string | null;
  linked_jsa_id: string | null;
  linked_incident_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  closed_by: string | null;
  due_date: string | null;
  closed_at: string | null;
  photo_urls: unknown;
  tags: unknown;
  corrective_action: string | null;
  immediate_action_taken: string | null;
  created_at: string;
  updated_at: string;
};

export type SafetyObservationKpis = {
  totalObservations: number;
  openHazards: number;
  highCriticalOpen: number;
  positiveObservations: number;
  nearMisses: number;
  closedThisWeek: number;
};

export type SafetyObservationsListResponse = {
  observations: SafetyObservationRow[];
  total: number;
  page: number;
  pageSize: number;
  kpis: SafetyObservationKpis;
};

export type SafetyObservationFormInput = {
  observation_type: string;
  category: string;
  subcategory: string;
  severity: ObservationSeverity;
  status: ObservationStatus;
  jobsite_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  trade: string | null;
  immediate_action_taken: string | null;
  corrective_action: string | null;
  assigned_to: string | null;
  due_date: string | null;
  photo_urls: string[];
};
