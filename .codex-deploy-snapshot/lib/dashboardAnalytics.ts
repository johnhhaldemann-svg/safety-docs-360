/**
 * Contract for `/api/company/dashboard-metrics` — additive home-dashboard analytics.
 *
 * Naming:
 * - **SOR reports** (`sorReportsCount`): rows in `company_sor_records` (safety observation reports).
 *   There is no `jobsite_id` on this table; counts are always company-wide even when
 *   `jobsiteScoped` is true for other metrics.
 * - **Corrective actions** (`correctiveActionsInWindowCount`): `company_corrective_actions` in the window.
 *   When `jobsiteScoped`, only rows whose `jobsite_id` is in the user’s assignment list are counted
 *   (unassigned rows are excluded, matching workspace summary behavior).
 * - **Near miss (corrective)** (`nearMissCorrectiveActionsCount`): corrective actions with
 *   `observation_type === 'near_miss'`.
 * - **Near miss (incident record)** (`incidentNearMissRecordsCount`): `company_incidents` with
 *   `category === 'near_miss'` in the window (some surfaces use this instead of corrective rows).
 */

export type DashboardHomeMetrics = {
  windowDays: number;
  since: string;
  sorReportsCount: number;
  correctiveActionsInWindowCount: number;
  nearMissCorrectiveActionsCount: number;
  positiveObservationsCount: number;
  incidentNearMissRecordsCount: number;
  activeContractorsCount: number;
  trainingRequirementDefinitionsCount: number;
  /** True when counts (except SOR) are filtered to assigned jobsites only. */
  jobsiteScoped: boolean;
};

export const DASHBOARD_METRICS_FIELD_HELP = {
  sorReportsCount: "company_sor_records in window, not jobsite-filtered (no jobsite column).",
  correctiveActionsInWindowCount: "company_corrective_actions in window.",
  nearMissCorrectiveActionsCount: "Corrective actions with observation_type near_miss.",
  positiveObservationsCount: "Corrective actions with observation_type positive.",
  incidentNearMissRecordsCount: "company_incidents in window with category near_miss.",
  activeContractorsCount: "company_contractors where active is true.",
  trainingRequirementDefinitionsCount: "Rows in company_training_requirements for the company.",
  jobsiteScoped: "Whether corrective/incident counts use jobsite_id assignment scope.",
} as const;
