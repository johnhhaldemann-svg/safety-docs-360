export const SEVERITY_OPTIONS = ["Low", "Medium", "High", "Critical"] as const;
export type ObservationSeverity = (typeof SEVERITY_OPTIONS)[number];

export const STATUS_OPTIONS = ["Open", "In Progress", "Closed"] as const;
export type ObservationStatus = (typeof STATUS_OPTIONS)[number];

export const OBSERVATION_TYPES = ["Hazard", "Positive", "Near_Miss"] as const;

export const UPDATE_TYPES = [
  "Comment",
  "Status Change",
  "Corrective Action",
  "Assignment",
  "Closeout",
] as const;
