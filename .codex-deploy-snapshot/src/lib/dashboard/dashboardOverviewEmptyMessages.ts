/** Canonical copy for prevention overview empty states (dashboard overview shell). */

export const OBSERVATIONS_EMPTY = {
  title: "Observations",
  description:
    "No observations have been recorded for this period. Once field observations are submitted, this section will show trends, repeat issues, and emerging risks.",
} as const;

export const CORRECTIVE_ACTIONS_EMPTY = {
  title: "Corrective actions",
  description: "No corrective actions are currently open for this period.",
} as const;

export const INCIDENTS_EMPTY = {
  title: "Incidents",
  description: "No incidents or near misses have been recorded for this period.",
} as const;

export const PERMITS_EMPTY = {
  title: "Permits",
  description:
    "No permit activity found for this period. Permit compliance will appear once high-risk work permits are created or reviewed.",
} as const;

export const TRAINING_EMPTY = {
  title: "Training",
  description:
    "No training records found for this selection. Workforce readiness will populate once training records are uploaded or assigned.",
} as const;

export const DOCUMENTS_EMPTY = {
  title: "Documents",
  description:
    "No documents found for this selection. Document readiness will populate as CSEPs, PSHSEPs, JSAs, permits, and supporting records are submitted.",
} as const;

export const ENGINE_HEALTH_ALL_CLEAR = {
  title: "Engine health",
  description: "No system breaks detected. Connected modules are responding normally.",
} as const;

export const HEADLINE_HEALTH_EMPTY = {
  title: "Current safety health",
  description:
    "No headline signals were returned for this selection. Adjust the date range or jobsite filters, or record incidents, observations, permits, training, and documents so composite health and readiness can be calculated.",
} as const;

export const EMERGING_THEMES_EMPTY = {
  title: "Emerging themes",
  description:
    "No ranked risk themes were returned for this period. Themes appear once observations, assessments, or related records populate for your filters.",
} as const;

export const CONTRACTOR_SCORECARDS_EMPTY = {
  title: "Contractor scorecards",
  description:
    "No contractor evaluation or compliance rows matched this selection. Scorecards will populate when contractor records and documents are available for your company.",
} as const;
