import {
  demoCompanyTotals,
  permitTotals,
  riskLevelForScore,
  safePredictActions,
  safePredictAlerts,
  safePredictDemoCompany,
  safePredictDemoEmployees,
  safePredictDemoJobsites,
  safePredictEvents,
  safePredictForecast,
  safePredictPermits,
  safePredictRiskDrivers,
  safePredictSites,
  safePredictTradeReadiness,
  summarizeActions,
  workforceTotals,
  type SafePredictActionStatus,
  type SafePredictAlert,
  type SafePredictCorrectiveAction,
  type SafePredictDemoCompany,
  type SafePredictDemoEmployee,
  type SafePredictDemoJobsite,
  type SafePredictEvent,
  type SafePredictForecastPoint,
  type SafePredictRiskLevel,
} from "@/lib/safePredictMockData";
import { demoCompanyUsers } from "@/lib/demoWorkspace";
import {
  SAFE_PREDICT_PERMIT_ACK_STATEMENT,
  defaultPermitChecklistItems,
  permitFormFromMetadata,
  permitReadinessLabel,
  type SafePredictPermitForm,
} from "@/lib/safePredictPermitForms";

export type SafePredictDataMode = "demo" | "live";

export type SafePredictJobsiteStatus = "planned" | "active" | "action-needed" | "completed" | "archived";

export type SafePredictJobsiteRecord = SafePredictDemoJobsite & {
  status: SafePredictJobsiteStatus;
  jobsiteNumber?: string | null;
  projectNumber?: string | null;
  projectManager: string;
  customerName: string;
  customerReportEmail: string;
  startDate: string;
  endDate: string;
  inspectionGaps: number;
  incidentCount: number;
  observationCount: number;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  notes?: string | null;
  zipCode?: string | null;
  weatherEnabled?: boolean | null;
  weatherLocationSource?: string | null;
  weatherLocationConfidence?: string | null;
  weatherLastCheckedAt?: string | null;
  weatherForecastUrl?: string | null;
  weatherForecastHourlyUrl?: string | null;
  weatherLatitude?: number | null;
  weatherLongitude?: number | null;
};

export type SafePredictActionRecord = SafePredictCorrectiveAction & {
  siteId: string;
  createdFrom: "Predictive Alert" | "Observation" | "Inspection" | "Hazard" | "Manual";
  sourceHref: string;
};

export type SafePredictAssignableUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

export type SafePredictAlertRecord = SafePredictAlert & {
  siteId: string;
};

export type SafePredictInspectionRecord = {
  id: string;
  siteId: string;
  title: string;
  checklist: string;
  inspector: string;
  dueDate: string;
  status: "Scheduled" | "In Progress" | "Failed Check" | "Completed" | "Overdue";
  failedItems: number;
  riskLevel: SafePredictRiskLevel;
};

export type SafePredictIncidentRecord = {
  id: string;
  siteId: string;
  title: string;
  type: "Incident" | "Near Miss" | "First Aid" | "Property Damage";
  severity: Exclude<SafePredictRiskLevel, "low"> | "low";
  status: "Open Review" | "Investigation" | "Corrective Action" | "Closed";
  reportedBy: string;
  reportedAt: string;
  detail: string;
};

export type SafePredictObservationRecord = {
  id: string;
  siteId: string;
  title: string;
  category: string;
  status: "Open" | "Converted" | "Closed";
  submittedBy: string;
  submittedAt: string;
  riskLevel: SafePredictRiskLevel;
  detail: string;
};

export type SafePredictHazardRecord = {
  id: string;
  siteId: string;
  title: string;
  driverId: string;
  controlStatus: "Needs Control" | "Control Planned" | "Controlled";
  riskLevel: SafePredictRiskLevel;
  owner: string;
  dueDate: string;
};

export type SafePredictPermitRecord = {
  id: string;
  siteId: string;
  type: string;
  title: string;
  status: "Active" | "Expiring Soon" | "Expired";
  owner: string;
  expiresAt: string;
  riskLevel: SafePredictRiskLevel;
  permitForm: SafePredictPermitForm;
  readiness: "Ready" | "Needs acknowledgement" | "Checklist incomplete";
};

export type SafePredictDocumentRecord = {
  id: string;
  siteId: string;
  title: string;
  type: "Report" | "JSA" | "Inspection" | "Permit" | "Training";
  status: "Draft" | "Ready" | "Sent" | "Approved";
  updatedAt: string;
};

export type SafePredictReportRecord = {
  id: string;
  siteId: string;
  title: string;
  audience: "Leadership" | "Site Team" | "Client" | "Regulatory";
  status: "Ready" | "Draft" | "Scheduled";
  updatedAt: string;
};

export type SafePredictTrainingRequirement = {
  id: string;
  title: string;
  sortOrder?: number;
  matchKeywords?: string[];
  matchFields?: string[];
  applyTrades?: string[];
  applyPositions?: string[];
  applySubTrades?: string[];
  applyTaskCodes?: string[];
  renewalMonths?: number | null;
  isGenerated?: boolean;
};

export type SafePredictTrainingCellState = "match" | "gap" | "na";

export type SafePredictTrainingCellDetail = {
  state?: SafePredictTrainingCellState | string;
  matchSource?: string;
  matchedLabel?: string | null;
  expiresOn?: string | null;
  daysUntilExpiry?: number | null;
  expiryStatus?: "none" | "ok" | "soon" | "expired" | string | null;
  gapKeywords?: string[];
};

export type SafePredictTrainingMatrixRow = SafePredictLiveRecordRow & {
  userId?: string;
  trackedEmployeeId?: string;
  personType?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  cells?: Record<string, SafePredictTrainingCellState | string>;
  cellDetails?: Record<string, SafePredictTrainingCellDetail>;
  profileFields?: {
    tradeSpecialty?: string | null;
    jobTitle?: string | null;
    readinessStatus?: string | null;
    yearsExperience?: number | null;
  };
  certificationInventory?: Array<{
    name?: string;
    expiresOn?: string | null;
    expiryStatus?: string | null;
  }>;
};

export type SafePredictTrainingMatrix = {
  requirements: SafePredictTrainingRequirement[];
  rows: SafePredictTrainingMatrixRow[];
  schemaWarning?: string | null;
};

export type SafePredictDataset = {
  mode: SafePredictDataMode;
  company: SafePredictDemoCompany;
  jobsites: SafePredictJobsiteRecord[];
  employees: SafePredictDemoEmployee[];
  assignableUsers: SafePredictAssignableUser[];
  alerts: SafePredictAlertRecord[];
  actions: SafePredictActionRecord[];
  inspections: SafePredictInspectionRecord[];
  incidents: SafePredictIncidentRecord[];
  observations: SafePredictObservationRecord[];
  hazards: SafePredictHazardRecord[];
  permitSummaries: typeof safePredictPermits;
  permits: SafePredictPermitRecord[];
  tradeReadiness: typeof safePredictTradeReadiness;
  riskDrivers: typeof safePredictRiskDrivers;
  forecasts: SafePredictForecastPoint[];
  events: SafePredictEvent[];
  documents: SafePredictDocumentRecord[];
  reports: SafePredictReportRecord[];
  trainingMatrix: SafePredictTrainingMatrix;
};

export type SafePredictForecastConfidence = {
  percent: number;
  label: "High" | "Medium" | "Low";
  sourceCount: number;
  signalCount: number;
  detail: string;
};

export type SafePredictLiveJobsiteRow = Record<string, unknown> & {
  id?: string;
  name?: string;
  jobsite_number?: string | null;
  jobsiteNumber?: string | null;
  project_number?: string | null;
  projectNumber?: string | null;
  location?: string | null;
  status?: string | null;
  weather_address_line_1?: string | null;
  weatherAddressLine1?: string | null;
  weather_address_line_2?: string | null;
  weatherAddressLine2?: string | null;
  weather_city?: string | null;
  weatherCity?: string | null;
  weather_state?: string | null;
  weatherState?: string | null;
  weather_country?: string | null;
  weatherCountry?: string | null;
  project_manager?: string | null;
  projectManager?: string | null;
  safety_lead?: string | null;
  safetyLead?: string | null;
  customer_company_name?: string | null;
  customerCompanyName?: string | null;
  customer_report_email?: string | null;
  customerReportEmail?: string | null;
  start_date?: string | null;
  startDate?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  zip_code?: string | null;
  zipCode?: string | null;
  weather_enabled?: boolean | null;
  weatherEnabled?: boolean | null;
  weather_location_source?: string | null;
  weatherLocationSource?: string | null;
  weather_location_confidence?: string | null;
  weatherLocationConfidence?: string | null;
  weather_last_checked_at?: string | null;
  weatherLastCheckedAt?: string | null;
  nws_forecast_url?: string | null;
  nwsForecastUrl?: string | null;
  nws_forecast_hourly_url?: string | null;
  nwsForecastHourlyUrl?: string | null;
  weather_latitude?: number | string | null;
  weatherLatitude?: number | string | null;
  weather_longitude?: number | string | null;
  weatherLongitude?: number | string | null;
  notes?: string | null;
};

export type SafePredictLiveRecordRow = Record<string, unknown>;

export type SafePredictLiveCompanyInput = Partial<SafePredictDemoCompany> & {
  name?: string | null;
  industry?: string | null;
  headquarters?: string | null;
  accountType?: string | null;
  safetyLead?: string | null;
  operationsLead?: string | null;
  primaryContactEmail?: string | null;
  logoDataUrl?: string | null;
  logoFileName?: string | null;
};

const UNASSIGNED_LIVE_SITE_ID = "unassigned-live-site";

const emptyLiveCompany: SafePredictDemoCompany = {
  ...safePredictDemoCompany,
  id: "live-company",
  name: "Company Workspace",
  industry: "Live company workspace",
  headquarters: "Company workspace",
  accountType: "Live workspace",
  safetyLead: "Not set",
  operationsLead: "Not set",
  primaryContactEmail: "Not set",
  logoDataUrl: null,
  logoFileName: null,
};

const alertSiteIds: Record<string, string> = {
  "machine-guarding": "plant-1",
  "forklift-proximity": "warehouse-a",
  "slips-trips": "plant-2",
  "ppe-compliance": "plant-1",
  housekeeping: "warehouse-b",
};

const siteAliases: Record<string, string> = {
  "plant 1": "plant-1",
  "warehouse a": "warehouse-a",
  "plant 2": "plant-2",
  "warehouse b": "warehouse-b",
  riverside: "riverside",
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/modernization|expansion|concrete package|punch list|commercial tower/g, "").replace(/\s+/g, " ").trim();
}

export function siteIdFromLabel(value: string) {
  const normalized = normalizeKey(value);
  return siteAliases[normalized] ?? safePredictDemoJobsites.find((site) => normalizeKey(site.name) === normalized)?.id ?? "riverside";
}

function normalizeStatus(value?: string | null): SafePredictJobsiteStatus {
  const normalized = (value ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  if (normalized === "planned" || normalized === "active" || normalized === "completed" || normalized === "archived") return normalized;
  if (normalized === "action-needed") return "action-needed";
  return "active";
}

function textValue(row: SafePredictLiveRecordRow, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function liveTextValue(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function normalizeLiveCompany(input?: SafePredictLiveCompanyInput | null): SafePredictDemoCompany {
  if (!input?.name?.trim()) return emptyLiveCompany;
  return {
    ...emptyLiveCompany,
    id: liveTextValue(input.id, "live-company"),
    name: input.name.trim(),
    industry: liveTextValue(input.industry, "Live company workspace"),
    headquarters: liveTextValue(input.headquarters, "Company workspace"),
    accountType: liveTextValue(input.accountType, "Live workspace"),
    safetyLead: liveTextValue(input.safetyLead, "Company safety team"),
    operationsLead: liveTextValue(input.operationsLead, "Operations team"),
    primaryContactEmail: liveTextValue(input.primaryContactEmail, "Not set"),
    logoDataUrl: input.logoDataUrl?.trim() || null,
    logoFileName: input.logoFileName?.trim() || null,
  };
}

function boolValue(row: SafePredictLiveRecordRow, keys: string[]) {
  return keys.some((key) => row[key] === true || row[key] === "true" || row[key] === 1);
}

function dateLabel(value: unknown, fallback = "Not set") {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function relativeDateLabel(value: unknown, fallback = "Recently") {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function normalizeRiskLevel(value?: string | null, fallback: SafePredictRiskLevel = "medium") {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "critical" || normalized === "high" || normalized === "medium" || normalized === "low") return normalized;
  return fallback;
}

function liveSiteId(row: SafePredictLiveRecordRow, jobsites: SafePredictJobsiteRecord[], index: number) {
  const jobsiteId = textValue(row, ["jobsite_id", "jobsiteId", "site_id", "siteId"]);
  if (jobsiteId && jobsites.some((site) => site.id === jobsiteId)) return jobsiteId;
  const jobsiteName = textValue(row, ["jobsite_name", "jobsiteName", "site", "project", "location"]);
  if (jobsiteName) {
    const byName = jobsites.find((site) => site.name.toLowerCase() === jobsiteName.toLowerCase() || jobsiteName.toLowerCase().includes(site.name.toLowerCase()));
    if (byName) return byName.id;
  }
  return jobsites[index % Math.max(jobsites.length, 1)]?.id ?? UNASSIGNED_LIVE_SITE_ID;
}

function normalizeActionStatus(value?: string | null): SafePredictActionStatus {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "in_progress" || normalized === "in progress" || normalized === "assigned" || normalized === "escalated" || normalized === "stop_work") return "In Progress";
  if (normalized === "corrected" || normalized === "awaiting_verification" || normalized === "awaiting verification") return "Awaiting Verification";
  if (normalized === "verified_closed" || normalized === "closed" || normalized === "complete" || normalized === "completed") return "Closed";
  return "New";
}

export function safePredictStatusToApi(status: SafePredictActionStatus) {
  if (status === "In Progress") return "in_progress";
  if (status === "Awaiting Verification") return "corrected";
  if (status === "Closed") return "verified_closed";
  return "open";
}

function withSiteMetrics(site: SafePredictDemoJobsite, index: number): SafePredictJobsiteRecord {
  return {
    ...site,
    status: site.riskLevel === "high" ? "action-needed" : site.riskLevel === "low" ? "completed" : "active",
    projectManager: ["Jordan Blake", "Priya Shah", "Marcus Lee", "Dana Scott", "Victor Chen"][index] ?? "Jordan Blake",
    customerName: ["Riverside Development Group", "Northline Manufacturing", "MetroLogix", "Arlington Utilities", "Mesquite Realty"][index] ?? "Workspace Client",
    customerReportEmail: `client-${site.id}@example.invalid`,
    startDate: `2025-0${(index % 5) + 1}-0${(index % 8) + 1}`,
    endDate: `2025-${String((index % 5) + 7).padStart(2, "0")}-2${index}`,
    inspectionGaps: Math.max(1, Math.round(site.openActions / 4)),
    incidentCount: Math.max(1, index + (site.riskLevel === "high" ? 3 : 1)),
    observationCount: Math.max(2, site.openActions + index),
  };
}

function coordinateValue(value: unknown) {
  const coordinate = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(coordinate) ? coordinate : null;
}

function severityPressure(
  level: SafePredictRiskLevel,
  weights: Record<SafePredictRiskLevel, number>
) {
  return weights[level];
}

function saturatedRiskScore(rawPressure: number) {
  if (rawPressure <= 0) return 0;
  return clampRiskScore(100 * (1 - Math.exp(-rawPressure / 90)));
}

function failedItemsFromRow(row: SafePredictLiveRecordRow) {
  return Math.max(0, Number(row.failed_items ?? row.failedItems ?? row.deficiency_count ?? 0) || 0);
}

function liveRowsForSite(rows: SafePredictLiveRecordRow[], jobsites: SafePredictJobsiteRecord[], siteId: string) {
  return rows.filter((row, index) => liveSiteId(row, jobsites, index) === siteId);
}

function liveActionPressure(row: SafePredictLiveRecordRow) {
  const status = normalizeActionStatus(textValue(row, ["status"]));
  if (status === "Closed") return 0;

  const priority = normalizeRiskLevel(textValue(row, ["priority", "severity", "risk_level", "riskLevel"]), "medium");
  const base = severityPressure(priority, { critical: 30, high: 22, medium: 12, low: 4 });
  const statusMultiplier = status === "Awaiting Verification" ? 0.45 : 1;
  const escalation = boolValue(row, ["ai_recommended", "aiRecommended", "sif_potential", "immediate_action_required"]) ? 4 : 0;
  return base * statusMultiplier + escalation;
}

function liveIncidentPressure(row: SafePredictLiveRecordRow) {
  const severity = normalizeRiskLevel(textValue(row, ["severity", "risk_level", "riskLevel"]), "medium");
  const status = textValue(row, ["status"], "open").toLowerCase();
  const base = severityPressure(severity, { critical: 35, high: 28, medium: 14, low: 5 });
  if (status.includes("closed") || status.includes("verified")) return Math.max(1, base * 0.2);
  if (status.includes("correct") || status.includes("progress") || status.includes("investigat")) return base * 0.65;
  return base;
}

function liveObservationPressure(row: SafePredictLiveRecordRow) {
  const riskLevel = normalizeRiskLevel(textValue(row, ["severity", "priority", "risk_level", "riskLevel"]), "medium");
  const status = textValue(row, ["status"], "open").toLowerCase();
  if (status.includes("closed") || status.includes("verified")) return 0;

  const base = severityPressure(riskLevel, { critical: 18, high: 12, medium: 6, low: 2 });
  if (status.includes("corrected") || status.includes("converted") || status.includes("progress")) return base * 0.35;
  return base;
}

function livePermitPressure(row: SafePredictLiveRecordRow) {
  const status = textValue(row, ["status"], "active").toLowerCase();
  const permitType = textValue(row, ["permit_type", "permitType", "type", "title"], "Work Permit");
  const readiness = permitReadinessLabel(permitFormFromMetadata(row.source_metadata ?? row.sourceMetadata, permitType));
  const riskLevel = normalizeRiskLevel(textValue(row, ["severity", "risk_level", "riskLevel"]), status.includes("expired") ? "critical" : "low");
  const exposure = severityPressure(riskLevel, { critical: 8, high: 6, medium: 4, low: 1 });

  if (status.includes("expired")) return 22 + exposure;
  if (status.includes("draft") || status.includes("pending") || status.includes("expiring")) return 12 + exposure;
  if (readiness !== "Ready") return 7 + exposure;
  return 1;
}

function liveInspectionPressure(row: SafePredictLiveRecordRow) {
  const failedItems = failedItemsFromRow(row);
  const status = textValue(row, ["status"], failedItems > 0 ? "failed" : "completed").toLowerCase();
  const failed = status.includes("fail") || failedItems > 0;
  if (!failed) return 0;

  const fallbackSeverity: SafePredictRiskLevel = failedItems > 0 ? "high" : "medium";
  const riskLevel = normalizeRiskLevel(textValue(row, ["severity", "priority", "risk_level", "riskLevel"]), fallbackSeverity);
  const base = severityPressure(riskLevel, { critical: 30, high: 22, medium: 12, low: 4 });
  return base + Math.min(18, failedItems * 4);
}

function riskScoreFromLiveSignals({
  actions,
  incidents,
  observations,
  permits,
  inspections,
}: {
  actions: SafePredictLiveRecordRow[];
  incidents: SafePredictLiveRecordRow[];
  observations: SafePredictLiveRecordRow[];
  permits: SafePredictLiveRecordRow[];
  inspections: SafePredictLiveRecordRow[];
}) {
  const rawPressure =
    actions.reduce((total, row) => total + liveActionPressure(row), 0) +
    incidents.reduce((total, row) => total + liveIncidentPressure(row), 0) +
    observations.reduce((total, row) => total + liveObservationPressure(row), 0) +
    permits.reduce((total, row) => total + livePermitPressure(row), 0) +
    inspections.reduce((total, row) => total + liveInspectionPressure(row), 0);

  return saturatedRiskScore(rawPressure);
}

function emptyPermitForm(permitType: string): SafePredictPermitForm {
  return {
    checklistItems: defaultPermitChecklistItems(permitType),
    acknowledgement: {
      acknowledged: false,
      name: "",
      acknowledgedAt: null,
      statement: SAFE_PREDICT_PERMIT_ACK_STATEMENT,
    },
    notes: "",
  };
}

export function clampRiskScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeLiveJobsites(rows: SafePredictLiveJobsiteRow[]) {
  return rows
    .filter((row) => typeof row.id === "string" && typeof row.name === "string" && row.name.trim())
    .map((row): SafePredictJobsiteRecord => {
      const rawStatus = String(row.status ?? "active");
      const status = normalizeStatus(rawStatus);
      const location = String(row.location ?? "").trim();
      const jobsiteNumber = String(row.jobsite_number ?? row.jobsiteNumber ?? "").trim();
      const projectNumber = String(row.project_number ?? row.projectNumber ?? "").trim();
      const addressLine1 = textValue(row, ["weather_address_line_1", "weatherAddressLine1"]);
      const addressLine2 = textValue(row, ["weather_address_line_2", "weatherAddressLine2"]);
      const city = textValue(row, ["weather_city", "weatherCity"]);
      const state = textValue(row, ["weather_state", "weatherState"]);
      const country = textValue(row, ["weather_country", "weatherCountry"]);
      const cityState = [city, state].filter(Boolean).join(", ");
      return {
        id: String(row.id),
        code: jobsiteNumber || projectNumber || "Not set",
        jobsiteNumber: jobsiteNumber || null,
        projectNumber: projectNumber || null,
        name: String(row.name),
        address: addressLine1 || location || "Not set",
        cityState: cityState || location || "Not set",
        projectType: "Construction",
        phase: status === "planned" ? "Planning" : status === "completed" ? "Closeout" : "Not set",
        riskScore: 0,
        riskLevel: "low",
        workforceCount: 0,
        openActions: 0,
        activePermits: 0,
        siteLead: String(row.safety_lead ?? row.safetyLead ?? "Not set"),
        projectManager: String(row.project_manager ?? row.projectManager ?? "Not assigned"),
        customerName: String(row.customer_company_name ?? row.customerCompanyName ?? "Not set"),
        customerReportEmail: String(row.customer_report_email ?? row.customerReportEmail ?? "Not set"),
        startDate: String(row.start_date ?? row.startDate ?? ""),
        endDate: String(row.end_date ?? row.endDate ?? ""),
        status,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        state: state || null,
        country: country || null,
        notes: textValue(row, ["notes"]) || null,
        zipCode: String(row.zip_code ?? row.zipCode ?? "").trim() || null,
        weatherEnabled: Boolean(row.weather_enabled ?? row.weatherEnabled),
        weatherLocationSource: String(row.weather_location_source ?? row.weatherLocationSource ?? "").trim() || null,
        weatherLocationConfidence: String(row.weather_location_confidence ?? row.weatherLocationConfidence ?? "").trim() || null,
        weatherLastCheckedAt: String(row.weather_last_checked_at ?? row.weatherLastCheckedAt ?? "").trim() || null,
        weatherForecastUrl: String(row.nws_forecast_url ?? row.nwsForecastUrl ?? "").trim() || null,
        weatherForecastHourlyUrl: String(row.nws_forecast_hourly_url ?? row.nwsForecastHourlyUrl ?? "").trim() || null,
        inspectionGaps: 0,
        incidentCount: 0,
        observationCount: 0,
        weatherLatitude: coordinateValue(row.weather_latitude ?? row.weatherLatitude),
        weatherLongitude: coordinateValue(row.weather_longitude ?? row.weatherLongitude),
      };
    });
}

export function normalizeLiveActions(
  rows: SafePredictLiveRecordRow[],
  jobsites: SafePredictJobsiteRecord[],
  assignableUsers: SafePredictAssignableUser[] = []
) {
  const assignableById = new Map(assignableUsers.map((user) => [user.id, user] as const));
  return rows
    .filter((row) => textValue(row, ["id"]) && textValue(row, ["title", "description"]))
    .map((row, index): SafePredictActionRecord => {
      const siteId = liveSiteId(row, jobsites, index);
      const status = normalizeActionStatus(textValue(row, ["status"]));
      const priority = normalizeRiskLevel(textValue(row, ["priority", "severity", "risk_level", "riskLevel"]), "medium");
      const linkedRisk = textValue(row, ["category", "observation_type", "source_type"], "Corrective Action");
      const assignedUserId = textValue(row, ["assigned_user_id", "assignedUserId"]);
      const assignedUser = assignedUserId ? assignableById.get(assignedUserId) : null;
      return {
        id: textValue(row, ["id"], `live-action-${index}`),
        title: textValue(row, ["title"], "Untitled corrective action"),
        linkedRiskId: textValue(row, ["observation_id", "source_record_id", "category"], linkedRisk).toLowerCase().replace(/\s+/g, "-"),
        linkedRisk,
        assignee: assignedUser?.name ?? textValue(row, ["assigned_user_name", "assignedUserName", "assignee"], assignedUserId || "Unassigned"),
        dueDate: dateLabel(row.due_at ?? row.dueAt ?? row.due_date ?? row.dueDate, "No due date"),
        status,
        priority: priority === "low" ? "medium" : priority,
        progress: status === "Closed" ? 100 : status === "Awaiting Verification" ? 85 : status === "In Progress" ? 45 : 0,
        aiRecommended: boolValue(row, ["ai_recommended", "aiRecommended", "sif_potential", "immediate_action_required"]),
        siteId,
        createdFrom: textValue(row, ["observation_type", "category"]).includes("inspection") ? "Inspection" : textValue(row, ["category"]).includes("hazard") ? "Hazard" : "Observation",
        sourceHref: `/field-id-exchange?jobsiteId=${encodeURIComponent(siteId)}`,
      };
    });
}

export function normalizeLiveIncidents(rows: SafePredictLiveRecordRow[], jobsites: SafePredictJobsiteRecord[]) {
  return rows
    .filter((row) => textValue(row, ["id"]) && textValue(row, ["title", "description", "summary"]))
    .map((row, index): SafePredictIncidentRecord => {
      const severity = normalizeRiskLevel(textValue(row, ["severity", "risk_level", "riskLevel"]), "medium");
      const category = textValue(row, ["incident_type", "incidentType", "category", "type"], "Incident");
      const normalizedStatus = textValue(row, ["status"], "open").toLowerCase();
      const status: SafePredictIncidentRecord["status"] = normalizedStatus.includes("closed") ? "Closed" : normalizedStatus.includes("progress") ? "Investigation" : normalizedStatus.includes("correct") ? "Corrective Action" : "Open Review";
      return {
        id: textValue(row, ["id"], `live-incident-${index}`),
        siteId: liveSiteId(row, jobsites, index),
        title: textValue(row, ["title", "summary"], "Untitled incident"),
        type: category.toLowerCase().includes("near") ? "Near Miss" : category.toLowerCase().includes("aid") ? "First Aid" : category.toLowerCase().includes("property") ? "Property Damage" : "Incident",
        severity,
        status,
        reportedBy: textValue(row, ["reported_by_name", "reportedBy", "created_by", "createdBy"], "Field Team"),
        reportedAt: relativeDateLabel(row.occurred_at ?? row.created_at ?? row.reported_at),
        detail: textValue(row, ["description", "detail", "narrative"], "Live incident record from SafetyDocs360."),
      };
    });
}

export function normalizeLiveObservations(rows: SafePredictLiveRecordRow[], jobsites: SafePredictJobsiteRecord[]) {
  return rows
    .filter((row) => textValue(row, ["id"]) && textValue(row, ["title", "description"]))
    .map((row, index): SafePredictObservationRecord => {
      const statusText = textValue(row, ["status"], "open").toLowerCase();
      const status: SafePredictObservationRecord["status"] = statusText.includes("closed") || statusText.includes("verified") ? "Closed" : statusText.includes("corrected") || statusText.includes("progress") ? "Converted" : "Open";
      return {
        id: textValue(row, ["id"], `live-observation-${index}`),
        siteId: liveSiteId(row, jobsites, index),
        title: textValue(row, ["title"], "Untitled observation"),
        category: textValue(row, ["category", "observation_type", "type"], "Field Observation"),
        status,
        submittedBy: textValue(row, ["created_by_name", "submittedBy", "created_by", "createdBy"], "Field Team"),
        submittedAt: relativeDateLabel(row.created_at ?? row.updated_at),
        riskLevel: normalizeRiskLevel(textValue(row, ["severity", "priority", "risk_level", "riskLevel"]), "medium"),
        detail: textValue(row, ["description", "detail"], "Live observation from SafetyDocs360."),
      };
    });
}

export function normalizeLivePermits(rows: SafePredictLiveRecordRow[], jobsites: SafePredictJobsiteRecord[]) {
  return rows
    .filter((row) => textValue(row, ["id"]) && textValue(row, ["permit_type", "permitType", "type", "title"]))
    .map((row, index): SafePredictPermitRecord => {
      const statusText = textValue(row, ["status"], "active").toLowerCase();
      const status: SafePredictPermitRecord["status"] = statusText.includes("expired") ? "Expired" : statusText.includes("active") || statusText.includes("closed") ? "Active" : "Expiring Soon";
      const type = textValue(row, ["permit_type", "permitType", "type", "title"], "Work Permit");
      const permitForm = permitFormFromMetadata(row.source_metadata ?? row.sourceMetadata, type);
      return {
        id: textValue(row, ["id"], `live-permit-${index}`),
        siteId: liveSiteId(row, jobsites, index),
        type,
        title: textValue(row, ["title"], type),
        status,
        owner: textValue(row, ["owner_name", "ownerUserName", "owner_user_id", "owner"], "Site Team"),
        expiresAt: dateLabel(row.expires_at ?? row.expiration_date ?? row.due_at ?? row.updated_at, "No expiration"),
        riskLevel: status === "Expired" ? "critical" : normalizeRiskLevel(textValue(row, ["severity", "risk_level", "riskLevel"]), status === "Expiring Soon" ? "medium" : "low"),
        permitForm,
        readiness: permitReadinessLabel(permitForm),
      };
    });
}

function normalizeTrainingRequirement(row: SafePredictLiveRecordRow, index: number): SafePredictTrainingRequirement {
  return {
    id: textValue(row, ["id"], `training-req-${index}`),
    title: textValue(row, ["title"], "Untitled training requirement"),
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? index),
    matchKeywords: stringArrayValue(row.matchKeywords ?? row.match_keywords),
    matchFields: stringArrayValue(row.matchFields ?? row.match_fields),
    applyTrades: stringArrayValue(row.applyTrades ?? row.apply_trades),
    applyPositions: stringArrayValue(row.applyPositions ?? row.apply_positions),
    applySubTrades: stringArrayValue(row.applySubTrades ?? row.apply_sub_trades),
    applyTaskCodes: stringArrayValue(row.applyTaskCodes ?? row.apply_task_codes),
    renewalMonths:
      typeof row.renewalMonths === "number"
        ? row.renewalMonths
        : typeof row.renewal_months === "number"
          ? row.renewal_months
          : null,
    isGenerated: Boolean(row.isGenerated ?? row.is_generated),
  };
}

function normalizeTrainingProfileFields(value: unknown): SafePredictTrainingMatrixRow["profileFields"] {
  if (!value || typeof value !== "object") return {};
  const record = value as SafePredictLiveRecordRow;
  return {
    tradeSpecialty: textValue(record, ["tradeSpecialty", "trade_specialty"]) || null,
    jobTitle: textValue(record, ["jobTitle", "job_title"]) || null,
    readinessStatus: textValue(record, ["readinessStatus", "readiness_status"]) || null,
    yearsExperience:
      typeof record.yearsExperience === "number"
        ? record.yearsExperience
        : typeof record.years_experience === "number"
          ? record.years_experience
          : null,
  };
}

function normalizeTrainingMatrixRow(row: SafePredictLiveRecordRow, index: number): SafePredictTrainingMatrixRow {
  const cells =
    row.cells && typeof row.cells === "object" && !Array.isArray(row.cells)
      ? (row.cells as Record<string, SafePredictTrainingCellState | string>)
      : {};
  const cellDetails =
    row.cellDetails && typeof row.cellDetails === "object" && !Array.isArray(row.cellDetails)
      ? (row.cellDetails as Record<string, SafePredictTrainingCellDetail>)
      : {};

  return {
    ...row,
    userId: textValue(row, ["userId", "user_id", "id"], `training-row-${index}`),
    trackedEmployeeId: textValue(row, ["trackedEmployeeId", "tracked_employee_id"]) || undefined,
    personType: textValue(row, ["personType", "person_type"]) || undefined,
    name: textValue(row, ["name", "email"], "Unnamed worker"),
    email: textValue(row, ["email"]),
    role: textValue(row, ["role"], "Worker"),
    status: textValue(row, ["status"], "Active"),
    cells,
    cellDetails,
    profileFields: normalizeTrainingProfileFields(row.profileFields ?? row.profile_fields),
    certificationInventory: Array.isArray(row.certificationInventory)
      ? (row.certificationInventory as SafePredictTrainingMatrixRow["certificationInventory"])
      : [],
  };
}

function normalizeLiveTrainingMatrix(payload?: SafePredictLiveRecordRow | null): SafePredictTrainingMatrix {
  const requirements = Array.isArray(payload?.requirements)
    ? payload.requirements
        .filter((row): row is SafePredictLiveRecordRow => Boolean(row) && typeof row === "object")
        .map(normalizeTrainingRequirement)
    : [];
  const rows = Array.isArray(payload?.rows)
    ? payload.rows
        .filter((row): row is SafePredictLiveRecordRow => Boolean(row) && typeof row === "object")
        .map(normalizeTrainingMatrixRow)
    : [];
  const schemaWarning =
    typeof payload?.schemaWarning === "string"
      ? payload.schemaWarning
      : typeof payload?.warning === "string"
        ? payload.warning
        : null;

  return { requirements, rows, schemaWarning };
}

export function normalizeLiveEmployees(rows: SafePredictLiveRecordRow[], jobsites: SafePredictJobsiteRecord[]) {
  return rows
    .filter((row) => textValue(row, ["userId", "user_id", "id"]) && textValue(row, ["name", "email"]))
    .map((row, index): SafePredictDemoEmployee => {
      const profile = (row.profileFields && typeof row.profileFields === "object" ? row.profileFields : {}) as SafePredictLiveRecordRow;
      const cellValues = Array.isArray(row.cells)
        ? row.cells
        : row.cells && typeof row.cells === "object"
          ? Object.values(row.cells)
          : [];
      const cellDetails =
        row.cellDetails && typeof row.cellDetails === "object"
          ? Object.values(row.cellDetails as Record<string, unknown>)
          : [];
      const overdue =
        cellValues.filter((cell) => {
          const value = String(cell).toLowerCase();
          return value.includes("gap") || value.includes("overdue") || value.includes("missing");
        }).length +
        cellDetails.filter((detail) => {
          if (!detail || typeof detail !== "object") return false;
          const record = detail as Record<string, unknown>;
          return String(record.expiryStatus ?? "").toLowerCase() === "expired";
        }).length;
      const expiring =
        cellValues.filter((cell) => String(cell).toLowerCase().includes("expiring")).length +
        cellDetails.filter((detail) => {
          if (!detail || typeof detail !== "object") return false;
          const record = detail as Record<string, unknown>;
          return String(record.expiryStatus ?? "").toLowerCase() === "soon";
        }).length;
      const status: SafePredictDemoEmployee["status"] = overdue > 0 ? "overdue" : expiring > 0 ? "expiring" : "compliant";
      const assignedSite = liveSiteId(row, jobsites, index);
      return {
        id: textValue(row, ["userId", "user_id", "id"], `live-employee-${index}`),
        name: textValue(row, ["name", "email"], "Unnamed worker"),
        email: textValue(row, ["email"]),
        role: textValue(profile, ["jobTitle"], textValue(row, ["role"], "Worker")),
        trade: textValue(profile, ["tradeSpecialty"], "General Construction"),
        assignedSiteId: assignedSite,
        supervisor: "Site Supervisor",
        shift: "Day",
        readinessScore: Math.max(45, 96 - overdue * 18 - expiring * 8),
        status,
        credentials: Array.isArray(row.certificationInventory)
          ? row.certificationInventory
              .map((item) =>
                item && typeof item === "object" && "name" in item
                  ? String((item as { name?: unknown }).name ?? "")
                  : String(item)
              )
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, 4)
          : [],
        lastActivity: textValue(row, ["status"], "Training matrix synced"),
      };
    });
}

export function normalizeLiveUsers(rows: SafePredictLiveRecordRow[], jobsites: SafePredictJobsiteRecord[]) {
  return rows
    .filter((row) => textValue(row, ["id", "user_id", "userId"]) && textValue(row, ["name", "email"]))
    .map((row, index): SafePredictDemoEmployee => {
      const statusText = textValue(row, ["status", "account_status"], "Active").toLowerCase();
      const status: SafePredictDemoEmployee["status"] =
        statusText.includes("pending") || statusText.includes("inactive")
          ? "expiring"
          : statusText.includes("suspend")
            ? "overdue"
            : "compliant";
      const role = textValue(row, ["role"], "Worker");
      const assignedSite = liveSiteId(row, jobsites, index);
      return {
        id: textValue(row, ["id", "user_id", "userId"], `live-user-${index}`),
        name: textValue(row, ["name", "email"], "Unnamed worker"),
        email: textValue(row, ["email"]),
        role,
        trade: textValue(row, ["trade", "team"], role.includes("manager") ? "Safety Leadership" : "General Construction"),
        assignedSiteId: assignedSite,
        supervisor: textValue(row, ["manager", "supervisor"], "Operations Team"),
        shift: "Day",
        readinessScore: status === "compliant" ? 88 : status === "expiring" ? 72 : 48,
        status,
        credentials: [],
        lastActivity: textValue(row, ["last_sign_in_at", "created_at"], "User directory synced"),
      };
    });
}

export function normalizeLiveInspections(rows: SafePredictLiveRecordRow[], jobsites: SafePredictJobsiteRecord[]) {
  return rows
    .filter((row) => textValue(row, ["id"]) && textValue(row, ["title", "audit_date", "auditDate"]))
    .map((row, index): SafePredictInspectionRecord => {
      const failedItems = Number(row.failed_items ?? row.failedItems ?? row.deficiency_count ?? 0) || 0;
      const statusText = textValue(row, ["status"], failedItems > 0 ? "failed" : "completed").toLowerCase();
      const status: SafePredictInspectionRecord["status"] = statusText.includes("fail") ? "Failed Check" : statusText.includes("progress") ? "In Progress" : statusText.includes("overdue") ? "Overdue" : statusText.includes("scheduled") ? "Scheduled" : "Completed";
      return {
        id: textValue(row, ["id"], `live-inspection-${index}`),
        siteId: liveSiteId(row, jobsites, index),
        title: textValue(row, ["title"], "Jobsite safety audit"),
        checklist: textValue(row, ["template_name", "templateSource", "selected_trade", "selectedTrade"], "Field Audit"),
        inspector: textValue(row, ["auditors", "inspector", "created_by"], "Safety Team"),
        dueDate: dateLabel(row.audit_date ?? row.auditDate ?? row.created_at),
        status,
        failedItems,
        riskLevel: failedItems > 3 ? "high" : failedItems > 0 ? "medium" : "low",
      };
    });
}

export function normalizeLiveReports(rows: SafePredictLiveRecordRow[], jobsites: SafePredictJobsiteRecord[]) {
  return rows
    .filter((row) => textValue(row, ["id"]) && textValue(row, ["title"]))
    .map((row, index): SafePredictReportRecord => ({
      id: textValue(row, ["id"], `live-report-${index}`),
      siteId: liveSiteId(row, jobsites, index),
      title: textValue(row, ["title"], "Safety report"),
      audience: textValue(row, ["audience", "report_type", "reportType"], "Leadership").toLowerCase().includes("client") ? "Client" : "Leadership",
      status: textValue(row, ["status"], "draft").toLowerCase().includes("publish") || textValue(row, ["status"], "draft").toLowerCase().includes("ready") ? "Ready" : "Draft",
      updatedAt: dateLabel(row.updated_at ?? row.generated_at ?? row.created_at),
    }));
}

export function normalizeLiveDocuments(rows: SafePredictLiveRecordRow[], jobsites: SafePredictJobsiteRecord[]) {
  return rows
    .filter((row) => textValue(row, ["id"]) && textValue(row, ["title", "name", "file_name", "fileName"]))
    .map((row, index): SafePredictDocumentRecord => {
      const title = textValue(row, ["title", "name", "file_name", "fileName"], "Safety document");
      const kind = textValue(row, ["document_type", "documentType", "type", "category"], title).toLowerCase();
      const statusText = textValue(row, ["status"], "Draft").toLowerCase();
      const status: SafePredictDocumentRecord["status"] =
        statusText.includes("approved") || statusText.includes("final")
          ? "Approved"
          : statusText.includes("sent") || statusText.includes("published")
            ? "Sent"
            : statusText.includes("ready")
              ? "Ready"
              : "Draft";
      return {
        id: textValue(row, ["id"], `live-document-${index}`),
        siteId: liveSiteId(row, jobsites, index),
        title,
        type: kind.includes("jsa")
          ? "JSA"
          : kind.includes("permit")
            ? "Permit"
            : kind.includes("train")
              ? "Training"
              : kind.includes("inspect") || kind.includes("audit")
                ? "Inspection"
                : "Report",
        status,
        updatedAt: dateLabel(row.updated_at ?? row.created_at ?? row.submitted_at),
      };
    });
}

function mergeEmployees(primary: SafePredictDemoEmployee[], secondary: SafePredictDemoEmployee[]) {
  const seen = new Set<string>();
  const merged: SafePredictDemoEmployee[] = [];
  for (const employee of [...primary, ...secondary]) {
    if (seen.has(employee.id)) continue;
    seen.add(employee.id);
    merged.push(employee);
  }
  return merged;
}

function buildAlerts(): SafePredictAlertRecord[] {
  return safePredictAlerts.map((alert) => ({
    ...alert,
    siteId: alertSiteIds[alert.id] ?? siteIdFromLabel(alert.site),
  }));
}

function buildActions(): SafePredictActionRecord[] {
  return safePredictActions.map((action) => ({
    ...action,
    siteId: alertSiteIds[action.linkedRiskId] ?? "riverside",
    createdFrom: action.aiRecommended ? "Predictive Alert" : action.linkedRiskId === "slips-trips" || action.linkedRiskId === "housekeeping" ? "Observation" : "Manual",
    sourceHref: `/safe-predict/risk-mitigation#${action.linkedRiskId}`,
  }));
}

function buildInspectionRecords(): SafePredictInspectionRecord[] {
  return safePredictDemoJobsites.flatMap((site, index) => [
    {
      id: `insp-${site.id}-daily`,
      siteId: site.id,
      title: `${site.name} daily safety walk`,
      checklist: "Daily Site Inspection",
      inspector: site.siteLead,
      dueDate: `May ${20 + index}`,
      status: site.riskLevel === "high" ? "Failed Check" : "Completed",
      failedItems: site.riskLevel === "high" ? index + 2 : 0,
      riskLevel: site.riskLevel,
    },
    {
      id: `insp-${site.id}-weekly`,
      siteId: site.id,
      title: `${site.name} weekly supervisor audit`,
      checklist: "Supervisor Audit",
      inspector: site.siteLead,
      dueDate: `May ${24 + index}`,
      status: index % 2 === 0 ? "Scheduled" : "In Progress",
      failedItems: index % 2,
      riskLevel: index % 2 === 0 ? "medium" : site.riskLevel,
    },
  ]);
}

function buildIncidentRecords(): SafePredictIncidentRecord[] {
  return [
    ["inc-1", "plant-1", "Guard bypass caught before startup", "Near Miss", "high", "Investigation", "Sarah Johnson", "Today 8:14 AM", "Operator attempted restart with temporary guard removed on Press #4."],
    ["inc-2", "warehouse-a", "Forklift near miss at north aisle", "Near Miss", "high", "Corrective Action", "Alicia Moore", "Yesterday", "Pedestrian crossed through forklift operating zone during material staging."],
    ["inc-3", "plant-2", "Slip at break room entrance", "First Aid", "medium", "Open Review", "James Chen", "May 18", "Water migrated from floor drain area into pedestrian path."],
    ["inc-4", "riverside", "Dropped object caught by toe board", "Near Miss", "high", "Investigation", "Emily Davis", "May 17", "Work at height controls prevented object from reaching lower deck."],
    ["inc-5", "warehouse-b", "Storage rack corner damage", "Property Damage", "low", "Closed", "Luis Hernandez", "May 14", "Material handling impact found during closeout walkthrough."],
  ].map(([id, siteId, title, type, severity, status, reportedBy, reportedAt, detail]) => ({
    id,
    siteId,
    title,
    type: type as SafePredictIncidentRecord["type"],
    severity: severity as SafePredictIncidentRecord["severity"],
    status: status as SafePredictIncidentRecord["status"],
    reportedBy,
    reportedAt,
    detail,
  }));
}

function buildObservationRecords(): SafePredictObservationRecord[] {
  return buildAlerts()
    .filter((alert) => alert.source === "Observation")
    .map((alert, index) => ({
      id: `obs-${alert.id}`,
      siteId: alert.siteId,
      title: alert.title,
      category: alert.area,
      status: (index % 2 === 0 ? "Converted" : "Open") as SafePredictObservationRecord["status"],
      submittedBy: safePredictDemoEmployees[index + 5]?.name ?? "Field Team",
      submittedAt: alert.timeAgo,
      riskLevel: alert.riskLevel,
      detail: alert.detail,
    }))
    .concat([
      {
        id: "obs-riverside-fall",
        siteId: "riverside",
        title: "Unprotected edge noted during decking work",
        category: "Fall Protection",
        status: "Open",
        submittedBy: "Nina Brooks",
        submittedAt: "45m ago",
        riskLevel: "critical",
        detail: "Temporary guardrail removed before replacement protection was installed.",
      },
    ]);
}

function buildHazardRecords(): SafePredictHazardRecord[] {
  return [
    ["haz-1", "riverside", "Work at height exposure", "fall-protection", "Needs Control", "critical", "Emily Davis", "May 20"],
    ["haz-2", "plant-1", "Press guarding bypass", "fall-protection", "Control Planned", "critical", "Mark Rivera", "May 21"],
    ["haz-3", "warehouse-a", "Pedestrian/forklift overlap", "housekeeping-driver", "Control Planned", "high", "Alicia Moore", "May 22"],
    ["haz-4", "plant-2", "Wet walkway by break room", "housekeeping-driver", "Controlled", "medium", "Maria Gomez", "May 19"],
    ["haz-5", "riverside", "Electrical LOTO gap", "electrical-exposure", "Needs Control", "medium", "Tom Baker", "May 25"],
  ].map(([id, siteId, title, driverId, controlStatus, riskLevel, owner, dueDate]) => ({
    id,
    siteId,
    title,
    driverId,
    controlStatus: controlStatus as SafePredictHazardRecord["controlStatus"],
    riskLevel: riskLevel as SafePredictRiskLevel,
    owner,
    dueDate,
  }));
}

function buildPermitRecords(): SafePredictPermitRecord[] {
  return safePredictDemoJobsites.flatMap((site, siteIndex) =>
    safePredictPermits.slice(0, 3).map((permit, permitIndex) => {
      const status: SafePredictPermitRecord["status"] =
        permitIndex === 0 && site.riskLevel === "high" ? "Expiring Soon" : permit.expired > 0 && siteIndex % 2 === 0 ? "Expired" : "Active";
      const permitForm = emptyPermitForm(permit.type);
      return {
        id: `permit-${site.id}-${permitIndex}`,
        siteId: site.id,
        type: permit.type,
        title: `${permit.type} permit`,
        status,
        owner: site.siteLead,
        expiresAt: `May ${21 + siteIndex + permitIndex}`,
        riskLevel: status === "Expired" ? "critical" : status === "Expiring Soon" ? "medium" : "low",
        permitForm,
        readiness: permitReadinessLabel(permitForm),
      };
    })
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export function normalizeAssignableUsers(rows: SafePredictLiveRecordRow[]): SafePredictAssignableUser[] {
  return rows
    .map((row) => ({
      id: textValue(row, ["id", "user_id", "userId"]),
      name: textValue(row, ["name", "email"], "Unnamed user"),
      email: textValue(row, ["email"]),
      role: textValue(row, ["role"], "Company User"),
      status: textValue(row, ["status", "account_status"], "Active"),
    }))
    .filter((user) => user.id && isUuid(user.id) && user.status.trim().toLowerCase() === "active")
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildDocumentRecords(): SafePredictDocumentRecord[] {
  return safePredictDemoJobsites.flatMap((site, index) => [
    { id: `doc-${site.id}-jsa`, siteId: site.id, title: `${site.name} JSA package`, type: "JSA", status: "Ready", updatedAt: `May ${18 + index}` },
    { id: `doc-${site.id}-insp`, siteId: site.id, title: `${site.name} inspection packet`, type: "Inspection", status: index % 2 === 0 ? "Draft" : "Approved", updatedAt: `May ${19 + index}` },
  ] as SafePredictDocumentRecord[]);
}

function buildReportRecords(): SafePredictReportRecord[] {
  return safePredictDemoJobsites.map((site, index) => ({
    id: `report-${site.id}`,
    siteId: site.id,
    title: `${site.name} weekly risk summary`,
    audience: index % 3 === 0 ? "Leadership" : index % 3 === 1 ? "Site Team" : "Client",
    status: site.riskLevel === "high" ? "Ready" : "Draft",
    updatedAt: `May ${20 + index}`,
  }));
}

export function buildSafePredictDataset({
  mode = "demo",
  liveCompany,
  liveJobsites = [],
  liveActions = [],
  liveIncidents = [],
  liveObservations = [],
  livePermits = [],
  liveEmployees = [],
  liveInspections = [],
  liveReports = [],
  liveDocuments = [],
  liveUsers = [],
  liveTrainingMatrix = null,
}: {
  mode?: SafePredictDataMode;
  liveCompany?: SafePredictLiveCompanyInput | null;
  liveJobsites?: SafePredictLiveJobsiteRow[];
  liveActions?: SafePredictLiveRecordRow[];
  liveIncidents?: SafePredictLiveRecordRow[];
  liveObservations?: SafePredictLiveRecordRow[];
  livePermits?: SafePredictLiveRecordRow[];
  liveEmployees?: SafePredictLiveRecordRow[];
  liveInspections?: SafePredictLiveRecordRow[];
  liveReports?: SafePredictLiveRecordRow[];
  liveDocuments?: SafePredictLiveRecordRow[];
  liveUsers?: SafePredictLiveRecordRow[];
  liveTrainingMatrix?: SafePredictLiveRecordRow | null;
} = {}): SafePredictDataset {
  if (mode !== "live") {
    const demoJobsites = safePredictDemoJobsites.map(withSiteMetrics);
    return {
      mode: "demo",
      company: safePredictDemoCompany,
      jobsites: demoJobsites,
      employees: safePredictDemoEmployees,
      assignableUsers: demoCompanyUsers
        .filter((user) => user.status.toLowerCase() === "active")
        .map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        })),
      alerts: buildAlerts(),
      actions: buildActions(),
      inspections: buildInspectionRecords(),
      incidents: buildIncidentRecords(),
      observations: buildObservationRecords(),
      hazards: buildHazardRecords(),
      permitSummaries: safePredictPermits,
      permits: buildPermitRecords(),
      tradeReadiness: safePredictTradeReadiness,
      riskDrivers: safePredictRiskDrivers,
      forecasts: safePredictForecast,
      events: safePredictEvents,
      documents: buildDocumentRecords(),
      reports: buildReportRecords(),
      trainingMatrix: { requirements: [], rows: [], schemaWarning: null },
    };
  }

  const normalizedLiveJobsites = normalizeLiveJobsites(liveJobsites);
  const jobsites = normalizedLiveJobsites;
  const jobsitesWithLiveMetrics =
    jobsites.map((site) => {
        const siteActions = liveRowsForSite(liveActions, jobsites, site.id);
        const siteIncidents = liveRowsForSite(liveIncidents, jobsites, site.id);
        const siteObservations = liveRowsForSite(liveObservations, jobsites, site.id);
        const sitePermits = liveRowsForSite(livePermits, jobsites, site.id);
        const siteInspections = liveRowsForSite(liveInspections, jobsites, site.id);
        const openActions = siteActions.filter((row) => normalizeActionStatus(textValue(row, ["status"])) !== "Closed").length;
        const activePermits = sitePermits.filter((row) => textValue(row, ["status"], "active").toLowerCase().includes("active")).length;
        const incidentCount = siteIncidents.length;
        const observationCount = siteObservations.length;
        const inspectionGaps = siteInspections.filter((row) => textValue(row, ["status"], failedItemsFromRow(row) > 0 ? "failed" : "").toLowerCase().includes("fail") || failedItemsFromRow(row) > 0).length;
        const riskScore = riskScoreFromLiveSignals({
          actions: siteActions,
          incidents: siteIncidents,
          observations: siteObservations,
          permits: sitePermits,
          inspections: siteInspections,
        });
        return {
          ...site,
          riskScore,
          riskLevel: riskLevelForScore(riskScore),
          openActions,
          activePermits,
          incidentCount,
          observationCount,
          inspectionGaps,
        };
      });
  const assignableUsers = normalizeAssignableUsers(liveUsers);
  const actions = normalizeLiveActions(liveActions, jobsitesWithLiveMetrics, assignableUsers);
  const incidents = normalizeLiveIncidents(liveIncidents, jobsitesWithLiveMetrics);
  const observations = normalizeLiveObservations(liveObservations, jobsitesWithLiveMetrics);
  const permits = normalizeLivePermits(livePermits, jobsitesWithLiveMetrics);
  const trainingMatrix =
    liveTrainingMatrix && (Array.isArray(liveTrainingMatrix.requirements) || Array.isArray(liveTrainingMatrix.rows))
      ? normalizeLiveTrainingMatrix(liveTrainingMatrix)
      : normalizeLiveTrainingMatrix({ requirements: [], rows: liveEmployees });
  const trainingEmployees = normalizeLiveEmployees(trainingMatrix.rows, jobsitesWithLiveMetrics);
  const userEmployees = normalizeLiveUsers(liveUsers, jobsitesWithLiveMetrics);
  const employees = mergeEmployees(trainingEmployees, userEmployees);
  const inspections = normalizeLiveInspections(liveInspections, jobsitesWithLiveMetrics);
  const reports = normalizeLiveReports(liveReports, jobsitesWithLiveMetrics);
  const documents = normalizeLiveDocuments(liveDocuments, jobsitesWithLiveMetrics);
  return {
    mode: "live",
    company: normalizeLiveCompany(liveCompany),
    jobsites: jobsitesWithLiveMetrics,
    employees,
    assignableUsers,
    alerts: [],
    actions,
    inspections,
    incidents,
    observations,
    hazards: [],
    permitSummaries: [],
    permits,
    tradeReadiness: [],
    riskDrivers: [],
    forecasts: [],
    events: [],
    documents,
    reports,
    trainingMatrix,
  };
}

export const demoSafePredictDataset = buildSafePredictDataset();

export function siteScoped<T extends { siteId: string }>(rows: T[], siteId: string) {
  if (!siteId || siteId === "all") return rows;
  return rows.filter((row) => row.siteId === siteId);
}

export function jobsiteById(dataset: SafePredictDataset, siteId: string) {
  return dataset.jobsites.find((site) => site.id === siteId) ?? dataset.jobsites[0];
}

function safePredictScopeSiteIds(dataset: SafePredictDataset, siteId: string) {
  if (!siteId || siteId === "all") return new Set(dataset.jobsites.map((site) => site.id));
  return new Set(dataset.jobsites.some((site) => site.id === siteId) ? [siteId] : []);
}

export function safePredictVisibleSiteIds(dataset: SafePredictDataset, siteIds: Iterable<string>) {
  const requested = new Set(siteIds);
  if (requested.size === 0) return new Set<string>();
  return new Set(dataset.jobsites.filter((site) => requested.has(site.id)).map((site) => site.id));
}

export function summarizeSafePredictScope(dataset: SafePredictDataset, siteIds: Iterable<string>) {
  const scope = safePredictVisibleSiteIds(dataset, siteIds);
  const jobsites = dataset.jobsites.filter((site) => scope.has(site.id));
  const actions = dataset.actions.filter((action) => scope.has(action.siteId));
  const permits = dataset.permits.filter((permit) => scope.has(permit.siteId));
  const employees = dataset.employees.filter((employee) => scope.has(employee.assignedSiteId));
  const inspections = dataset.inspections.filter((inspection) => scope.has(inspection.siteId));
  const incidents = dataset.incidents.filter((incident) => scope.has(incident.siteId));
  const observations = dataset.observations.filter((observation) => scope.has(observation.siteId));
  const hazards = dataset.hazards.filter((hazard) => scope.has(hazard.siteId));
  const overdueEmployees = employees.filter((employee) => employee.status === "overdue").length;
  const expiringEmployees = employees.filter((employee) => employee.status === "expiring").length;
  const compliantEmployees = employees.length - overdueEmployees - expiringEmployees;
  const overdueActions = actions.filter((action) => {
    if (action.status === "Closed") return false;
    const parsed = Date.parse(action.dueDate);
    return Number.isFinite(parsed) && parsed < Date.now();
  }).length;

  return {
    jobsites: jobsites.length,
    employees: employees.length,
    openActions: actions.filter((action) => action.status !== "Closed").length,
    activePermits: permits.filter((permit) => permit.status === "Active").length,
    riskScore: jobsites.length ? Math.round(jobsites.reduce((sum, jobsite) => sum + jobsite.riskScore, 0) / jobsites.length) : 0,
    overdueEmployees,
    expiringEmployees,
    overdueActions,
    closedActions: actions.filter((action) => action.status === "Closed").length,
    workforce: {
      workers: employees.length,
      compliant: compliantEmployees,
      expiringSoon: expiringEmployees,
      overdue: overdueEmployees,
      compliantPercent: employees.length ? Math.round((compliantEmployees / employees.length) * 100) : 0,
      expiringSoonPercent: employees.length ? Math.round((expiringEmployees / employees.length) * 100) : 0,
      overduePercent: employees.length ? Math.round((overdueEmployees / employees.length) * 100) : 0,
    },
    permits: {
      active: permits.filter((permit) => permit.status === "Active").length,
      expiringSoon: permits.filter((permit) => permit.status === "Expiring Soon").length,
      expired: permits.filter((permit) => permit.status === "Expired").length,
    },
    inspectionGaps: inspections.reduce((sum, inspection) => sum + inspection.failedItems, 0),
    incidents: incidents.length,
    observations: observations.length,
    hazards: hazards.length,
  };
}

export function hasSafePredictForecastInputs(dataset: SafePredictDataset, siteId = "all") {
  if (dataset.mode !== "live") return dataset.forecasts.length > 0;

  const siteIds = safePredictScopeSiteIds(dataset, siteId);
  if (siteIds.size === 0) return false;

  const inScope = <T extends { siteId: string }>(rows: T[]) => rows.some((row) => siteIds.has(row.siteId));
  return (
    inScope(dataset.actions) ||
    inScope(dataset.incidents) ||
    inScope(dataset.observations) ||
    inScope(dataset.inspections) ||
    inScope(dataset.permits) ||
    inScope(dataset.hazards) ||
    dataset.employees.some((employee) => siteIds.has(employee.assignedSiteId))
  );
}

function scoreForForecastScope(dataset: SafePredictDataset, siteId: string) {
  const siteIds = safePredictScopeSiteIds(dataset, siteId);
  const sites = dataset.jobsites.filter((site) => siteIds.has(site.id));
  if (sites.length === 0) return 0;
  return Math.round(sites.reduce((sum, site) => sum + site.riskScore, 0) / sites.length);
}

function generatedLiveForecast(dataset: SafePredictDataset, siteId: string) {
  const siteIds = safePredictScopeSiteIds(dataset, siteId);
  const score = scoreForForecastScope(dataset, siteId);
  const openActions = dataset.actions.filter((action) => siteIds.has(action.siteId) && action.status !== "Closed").length;
  const closedActions = dataset.actions.filter((action) => siteIds.has(action.siteId) && action.status === "Closed").length;
  const unresolvedSignals =
    dataset.incidents.filter((row) => siteIds.has(row.siteId) && row.status !== "Closed").length +
    dataset.observations.filter((row) => siteIds.has(row.siteId) && row.status !== "Closed").length +
    dataset.inspections.filter((row) => siteIds.has(row.siteId) && row.status !== "Completed").length +
    dataset.permits.filter((row) => siteIds.has(row.siteId) && row.status !== "Active").length +
    dataset.hazards.filter((row) => siteIds.has(row.siteId) && row.controlStatus !== "Controlled").length;
  const pressure = Math.min(10, openActions * 1.2 + unresolvedSignals * 1.4);
  const mitigation = Math.min(8, closedActions * 1.5);
  const anchors = [-6, -3, 0, 3, 5, 7, 5, 2, -1, -4];
  const forecastBase = score > 90 ? 90 + (score - 90) * 0.45 : score;

  return anchors.map((offset, index): SafePredictForecastPoint => {
    const projected = clampRiskScore(forecastBase + pressure - mitigation + offset);
    return {
      date: index === 0 ? "Now" : `+${index * 3}d`,
      historicalRisk: index < 4 ? clampRiskScore(forecastBase + offset - 4) : undefined,
      predictedRisk: projected,
    };
  });
}

export function riskForecastForSite(dataset: SafePredictDataset, siteId: string) {
  if (!hasSafePredictForecastInputs(dataset, siteId)) return [];

  if (dataset.mode === "live" && dataset.forecasts.length === 0) {
    return generatedLiveForecast(dataset, siteId);
  }

  const delta = scoreForForecastScope(dataset, siteId) - 68;
  return dataset.forecasts.map((point) => ({
    ...point,
    predictedRisk: Math.max(0, Math.min(100, point.predictedRisk + Math.round(delta / 3))),
    historicalRisk: point.historicalRisk == null ? undefined : Math.max(0, Math.min(100, point.historicalRisk + Math.round(delta / 4))),
  }));
}

function forecastConfidenceLabel(percent: number): SafePredictForecastConfidence["label"] {
  if (percent >= 75) return "High";
  if (percent >= 45) return "Medium";
  return "Low";
}

export function forecastConfidenceForSite(dataset: SafePredictDataset, siteId: string): SafePredictForecastConfidence {
  const siteIds = safePredictScopeSiteIds(dataset, siteId);
  const scopedJobsites = dataset.jobsites.filter((site) => siteIds.has(site.id));
  const countScoped = <T extends { siteId: string }>(rows: T[]) => rows.filter((row) => siteIds.has(row.siteId)).length;
  const counts = {
    actions: countScoped(dataset.actions),
    incidents: countScoped(dataset.incidents),
    observations: countScoped(dataset.observations),
    inspections: countScoped(dataset.inspections),
    permits: countScoped(dataset.permits),
    hazards: countScoped(dataset.hazards),
    employees: dataset.employees.filter((employee) => siteIds.has(employee.assignedSiteId)).length,
    forecastPoints: riskForecastForSite(dataset, siteId).length,
  };
  const signalCount =
    counts.actions +
    counts.incidents +
    counts.observations +
    counts.inspections +
    counts.permits +
    counts.hazards +
    counts.employees;
  const sourceCount = Object.entries(counts).filter(([key, count]) => key !== "forecastPoints" && count > 0).length;

  if (siteIds.size === 0 || scopedJobsites.length === 0 || !hasSafePredictForecastInputs(dataset, siteId)) {
    return {
      percent: 0,
      label: "Low",
      sourceCount: 0,
      signalCount: 0,
      detail: "No connected jobsite signals are available for this forecast yet.",
    };
  }

  const percent = clampRiskScore(
    18 +
      (scopedJobsites.length > 0 ? 12 : 0) +
      Math.min(32, sourceCount * 5) +
      Math.min(24, signalCount * 2) +
      Math.min(14, counts.forecastPoints)
  );
  const label = forecastConfidenceLabel(percent);

  return {
    percent,
    label,
    sourceCount,
    signalCount,
    detail: `${sourceCount} source type${sourceCount === 1 ? "" : "s"} and ${signalCount} scoped signal${signalCount === 1 ? "" : "s"} support this forecast.`,
  };
}

export function summarizeSafePredictDataset(dataset: SafePredictDataset) {
  if (dataset.mode === "live") {
    const activePermits = dataset.permits.filter((permit) => permit.status === "Active").length;
    const expiringSoonPermits = dataset.permits.filter((permit) => permit.status === "Expiring Soon").length;
    const expiredPermits = dataset.permits.filter((permit) => permit.status === "Expired").length;
    const overdueEmployees = dataset.employees.filter((employee) => employee.status === "overdue").length;
    const expiringEmployees = dataset.employees.filter((employee) => employee.status === "expiring").length;
    const compliantEmployees = dataset.employees.length - overdueEmployees - expiringEmployees;
    const riskScore =
      dataset.jobsites.length > 0
        ? Math.round(dataset.jobsites.reduce((sum, jobsite) => sum + jobsite.riskScore, 0) / dataset.jobsites.length)
        : 0;
    const openActions = dataset.actions.filter((action) => action.status !== "Closed").length;
    const closedActions = dataset.actions.filter((action) => action.status === "Closed").length;
    const jobsiteOpenActions = dataset.jobsites.reduce((sum, jobsite) => sum + jobsite.openActions, 0);
    const overdueActions = dataset.actions.filter((action) => {
      if (action.status === "Closed") return false;
      const parsed = Date.parse(action.dueDate);
      return Number.isFinite(parsed) && parsed < Date.now();
    }).length;

    return {
      jobsites: dataset.jobsites.length,
      employees: dataset.employees.length,
      openActions: jobsiteOpenActions || openActions,
      activePermits,
      riskScore,
      overdueEmployees,
      expiringEmployees,
      overdueActions,
      closedActions,
      workforce: {
        workers: dataset.employees.length,
        compliant: compliantEmployees,
        expiringSoon: expiringEmployees,
        overdue: overdueEmployees,
        compliantPercent: dataset.employees.length ? Math.round((compliantEmployees / dataset.employees.length) * 100) : 0,
        expiringSoonPercent: dataset.employees.length ? Math.round((expiringEmployees / dataset.employees.length) * 100) : 0,
        overduePercent: dataset.employees.length ? Math.round((overdueEmployees / dataset.employees.length) * 100) : 0,
      },
      permits: {
        active: activePermits,
        expiringSoon: expiringSoonPermits,
        expired: expiredPermits,
      },
      inspectionGaps: dataset.jobsites.reduce((sum, site) => sum + site.inspectionGaps, 0),
      incidents: dataset.incidents.length,
      observations: dataset.observations.length,
      hazards: dataset.hazards.length,
    };
  }

  const totals = demoCompanyTotals(dataset.jobsites, dataset.employees);
  const actions = summarizeActions(dataset.actions);
  const workforce = workforceTotals(dataset.tradeReadiness);
  const permits = permitTotals(dataset.permitSummaries);
  return {
    ...totals,
    openActions: actions.open,
    overdueActions: actions.overdue,
    closedActions: actions.closed,
    workforce,
    permits,
    inspectionGaps: dataset.jobsites.reduce((sum, site) => sum + site.inspectionGaps, 0),
    incidents: dataset.incidents.length,
    observations: dataset.observations.length,
    hazards: dataset.hazards.length,
  };
}

export function nextActionStatus(status: SafePredictActionStatus) {
  if (status === "New") return "In Progress";
  if (status === "In Progress") return "Awaiting Verification";
  if (status === "Awaiting Verification") return "Closed";
  return "Closed";
}

export { safePredictSites };
