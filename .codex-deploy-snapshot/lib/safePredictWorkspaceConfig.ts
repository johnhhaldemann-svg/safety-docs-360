export type SafePredictWorkspaceSlug =
  | "incidents"
  | "observations"
  | "corrective-actions"
  | "inspections"
  | "hazards"
  | "training"
  | "permits"
  | "documents"
  | "analytics"
  | "reports"
  | "settings";

export type SafePredictWorkspaceConfig = {
  slug: SafePredictWorkspaceSlug;
  title: string;
  subtitle: string;
  primaryAction: string;
  summary: Array<{ label: string; value: string; detail: string }>;
};

export const safePredictWorkspaceConfigs: Record<SafePredictWorkspaceSlug, SafePredictWorkspaceConfig> = {
  incidents: {
    slug: "incidents",
    title: "Incidents",
    subtitle: "Review incident signals that are feeding the SafePredict risk picture.",
    primaryAction: "Log Incident",
    summary: [
      { label: "Open Incident Reviews", value: "6", detail: "2 high-priority" },
      { label: "Near Misses", value: "14", detail: "Last 30 days" },
      { label: "Avg. Closure Time", value: "4.8d", detail: "Down 11%" },
    ],
  },
  observations: {
    slug: "observations",
    title: "Observations",
    subtitle: "Review field observations and near-miss signals before they become incidents.",
    primaryAction: "Submit Observation",
    summary: [
      { label: "Open Observations", value: "24", detail: "6 high-signal findings" },
      { label: "Near Miss Signals", value: "14", detail: "Last 30 days" },
      { label: "Converted to Actions", value: "9", detail: "Awaiting verification" },
    ],
  },
  "corrective-actions": {
    slug: "corrective-actions",
    title: "Corrective Actions",
    subtitle: "Track every mitigation from assignment through verification.",
    primaryAction: "New Corrective Action",
    summary: [
      { label: "Open Actions", value: "18", detail: "Across 5 risks" },
      { label: "Overdue", value: "5", detail: "Needs escalation" },
      { label: "Closed This Month", value: "42", detail: "Up 24%" },
    ],
  },
  inspections: {
    slug: "inspections",
    title: "Jobsite Audits",
    subtitle: "Run standalone audits by company and active jobsite, then submit findings for review.",
    primaryAction: "Start Audit",
    summary: [
      { label: "Completed", value: "128", detail: "This week" },
      { label: "Failed Checks", value: "9", detail: "4 repeat findings" },
      { label: "Due Soon", value: "17", detail: "Next 7 days" },
    ],
  },
  hazards: {
    slug: "hazards",
    title: "Hazards",
    subtitle: "Track the top hazard drivers behind the current SafePredict risk score.",
    primaryAction: "Log Hazard",
    summary: [
      { label: "Active Hazards", value: "18", detail: "5 elevated drivers" },
      { label: "Critical Areas", value: "3", detail: "Press, height, traffic" },
      { label: "Controls Needed", value: "11", detail: "Linked to action queue" },
    ],
  },
  training: {
    slug: "training",
    title: "Training",
    subtitle: "Manage readiness gaps that increase forecasted safety risk.",
    primaryAction: "Assign Training",
    summary: [
      { label: "Compliance", value: "78%", detail: "312 workers ready" },
      { label: "Expiring Soon", value: "60", detail: "Within 30 days" },
      { label: "Overdue", value: "28", detail: "LOTO and fall protection" },
    ],
  },
  permits: {
    slug: "permits",
    title: "Permits",
    subtitle: "Monitor active, expiring, and expired permits for high-risk work.",
    primaryAction: "Create Permit",
    summary: [
      { label: "Active Permits", value: "42", detail: "Across 12 sites" },
      { label: "Expiring Soon", value: "11", detail: "Needs renewal" },
      { label: "Expired", value: "2", detail: "Work hold required" },
    ],
  },
  documents: {
    slug: "documents",
    title: "Documents",
    subtitle: "Manage the jobsite document control register inside the new SafetyDoc360 platform.",
    primaryAction: "Build Document",
    summary: [
      { label: "Controlled Documents", value: "10", detail: "Across active jobsites" },
      { label: "Ready For Use", value: "5", detail: "Current versions" },
      { label: "Drafts", value: "5", detail: "Needs review" },
    ],
  },
  analytics: {
    slug: "analytics",
    title: "Analytics",
    subtitle: "Analyze risk trends, model confidence, mitigation progress, and site signals.",
    primaryAction: "Open Analytics",
    summary: [
      { label: "Risk Trend", value: "Elevated", detail: "Next 30 days" },
      { label: "Model Confidence", value: "87%", detail: "High confidence" },
      { label: "Risk Reduction", value: "9 pts", detail: "After completed actions" },
    ],
  },
  reports: {
    slug: "reports",
    title: "Reports",
    subtitle: "Export leadership snapshots and review SafePredict activity history.",
    primaryAction: "Export Report",
    summary: [
      { label: "Risk Score", value: "68", detail: "All sites" },
      { label: "Risk Trend", value: "Elevated", detail: "Next 30 days" },
      { label: "Actions Closed", value: "42", detail: "Last 30 days" },
    ],
  },
  settings: {
    slug: "settings",
    title: "Settings",
    subtitle: "Configure local MVP preferences, risk thresholds, and workflow defaults.",
    primaryAction: "Save Settings",
    summary: [
      { label: "Risk Bands", value: "4", detail: "Low to critical" },
      { label: "Refresh Cadence", value: "15m", detail: "Mock data interval" },
      { label: "Mode", value: "Local", detail: "No external services" },
    ],
  },
};

export const safePredictWorkspaceSlugs = Object.keys(safePredictWorkspaceConfigs) as SafePredictWorkspaceSlug[];

export function getSafePredictWorkspaceConfig(slug: string) {
  return safePredictWorkspaceConfigs[slug as SafePredictWorkspaceSlug];
}
