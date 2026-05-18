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

export type SafePredictDataMode = "demo" | "live";

export type SafePredictJobsiteStatus = "planned" | "active" | "action-needed" | "completed" | "archived";

export type SafePredictJobsiteRecord = SafePredictDemoJobsite & {
  status: SafePredictJobsiteStatus;
  projectManager: string;
  customerName: string;
  customerReportEmail: string;
  startDate: string;
  endDate: string;
  inspectionGaps: number;
  incidentCount: number;
  observationCount: number;
};

export type SafePredictActionRecord = SafePredictCorrectiveAction & {
  siteId: string;
  createdFrom: "Predictive Alert" | "Observation" | "Inspection" | "Hazard" | "Manual";
  sourceHref: string;
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
  status: "Active" | "Expiring Soon" | "Expired";
  owner: string;
  expiresAt: string;
  riskLevel: SafePredictRiskLevel;
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

export type SafePredictDataset = {
  mode: SafePredictDataMode;
  company: SafePredictDemoCompany;
  jobsites: SafePredictJobsiteRecord[];
  employees: SafePredictDemoEmployee[];
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
};

export type SafePredictLiveJobsiteRow = Record<string, unknown> & {
  id?: string;
  name?: string;
  project_number?: string | null;
  projectNumber?: string | null;
  location?: string | null;
  status?: string | null;
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

function fallbackSite(index: number) {
  return safePredictDemoJobsites[index % safePredictDemoJobsites.length];
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

function liveTextValue(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function normalizeLiveCompany(input?: SafePredictLiveCompanyInput | null): SafePredictDemoCompany {
  if (!input?.name?.trim()) return safePredictDemoCompany;
  return {
    ...safePredictDemoCompany,
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

function riskScoreFromRows(site: SafePredictDemoJobsite, related: SafePredictLiveRecordRow[]) {
  const score = site.riskScore + related.reduce((total, row) => {
    const severity = normalizeRiskLevel(textValue(row, ["severity", "priority", "risk_level", "riskLevel"]), "medium");
    const status = textValue(row, ["status"]).toLowerCase();
    const severityPoints = severity === "critical" ? 8 : severity === "high" ? 5 : severity === "medium" ? 2 : 0;
    const statusPoints = status.includes("closed") || status.includes("verified") ? -2 : 1;
    return total + severityPoints + statusPoints;
  }, 0);
  return Math.max(18, Math.min(96, score));
}

function liveSiteId(row: SafePredictLiveRecordRow, jobsites: SafePredictJobsiteRecord[], index: number) {
  const jobsiteId = textValue(row, ["jobsite_id", "jobsiteId", "site_id", "siteId"]);
  if (jobsiteId && jobsites.some((site) => site.id === jobsiteId)) return jobsiteId;
  const jobsiteName = textValue(row, ["jobsite_name", "jobsiteName", "site", "project", "location"]);
  if (jobsiteName) {
    const byName = jobsites.find((site) => site.name.toLowerCase() === jobsiteName.toLowerCase() || jobsiteName.toLowerCase().includes(site.name.toLowerCase()));
    if (byName) return byName.id;
  }
  return jobsites[index % Math.max(jobsites.length, 1)]?.id ?? "riverside";
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
    customerName: ["Riverside Development Group", "Northline Manufacturing", "MetroLogix", "Arlington Utilities", "Mesquite Realty"][index] ?? "Apex Client",
    customerReportEmail: `client-${site.id}@apex-demo.local`,
    startDate: `2025-0${(index % 5) + 1}-0${(index % 8) + 1}`,
    endDate: `2025-${String((index % 5) + 7).padStart(2, "0")}-2${index}`,
    inspectionGaps: Math.max(1, Math.round(site.openActions / 4)),
    incidentCount: Math.max(1, index + (site.riskLevel === "high" ? 3 : 1)),
    observationCount: Math.max(2, site.openActions + index),
  };
}

export function normalizeLiveJobsites(rows: SafePredictLiveJobsiteRow[]) {
  return rows
    .filter((row) => typeof row.id === "string" && typeof row.name === "string" && row.name.trim())
    .map((row, index): SafePredictJobsiteRecord => {
      const fallback = fallbackSite(index);
      const rawStatus = String(row.status ?? "active");
      const status = normalizeStatus(rawStatus);
      const riskScore = status === "action-needed" ? 76 : status === "completed" ? 32 : fallback.riskScore;
      return {
        ...fallback,
        id: String(row.id),
        code: String(row.project_number ?? row.projectNumber ?? fallback.code),
        name: String(row.name),
        address: String(row.location ?? fallback.address),
        cityState: fallback.cityState,
        phase: status === "planned" ? "Planning" : status === "completed" ? "Closeout" : fallback.phase,
        siteLead: String(row.safety_lead ?? row.safetyLead ?? fallback.siteLead),
        projectManager: String(row.project_manager ?? row.projectManager ?? "Not assigned"),
        customerName: String(row.customer_company_name ?? row.customerCompanyName ?? fallback.name),
        customerReportEmail: String(row.customer_report_email ?? row.customerReportEmail ?? "Not set"),
        startDate: String(row.start_date ?? row.startDate ?? ""),
        endDate: String(row.end_date ?? row.endDate ?? ""),
        riskScore,
        riskLevel: riskLevelForScore(riskScore),
        status,
        inspectionGaps: Math.max(1, Math.round(fallback.openActions / 4)),
        incidentCount: Math.max(1, index + 2),
        observationCount: Math.max(2, fallback.openActions + index),
      };
    });
}

export function normalizeLiveActions(rows: SafePredictLiveRecordRow[], jobsites: SafePredictJobsiteRecord[]) {
  return rows
    .filter((row) => textValue(row, ["id"]) && textValue(row, ["title", "description"]))
    .map((row, index): SafePredictActionRecord => {
      const siteId = liveSiteId(row, jobsites, index);
      const status = normalizeActionStatus(textValue(row, ["status"]));
      const priority = normalizeRiskLevel(textValue(row, ["priority", "severity", "risk_level", "riskLevel"]), "medium");
      const linkedRisk = textValue(row, ["category", "observation_type", "source_type"], "Corrective Action");
      return {
        id: textValue(row, ["id"], `live-action-${index}`),
        title: textValue(row, ["title"], "Untitled corrective action"),
        linkedRiskId: textValue(row, ["observation_id", "source_record_id", "category"], linkedRisk).toLowerCase().replace(/\s+/g, "-"),
        linkedRisk,
        assignee: textValue(row, ["assigned_user_name", "assignedUserName", "assignee", "assigned_user_id", "assignedUserId"], "Unassigned"),
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
      return {
        id: textValue(row, ["id"], `live-permit-${index}`),
        siteId: liveSiteId(row, jobsites, index),
        type: textValue(row, ["permit_type", "permitType", "type", "title"], "Work Permit"),
        status,
        owner: textValue(row, ["owner_name", "ownerUserName", "owner_user_id", "owner"], "Site Team"),
        expiresAt: dateLabel(row.expires_at ?? row.expiration_date ?? row.due_at ?? row.updated_at, "No expiration"),
        riskLevel: status === "Expired" ? "critical" : normalizeRiskLevel(textValue(row, ["severity", "risk_level", "riskLevel"]), status === "Expiring Soon" ? "medium" : "low"),
      };
    });
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
      const assignedSite = jobsites[index % Math.max(jobsites.length, 1)]?.id ?? "riverside";
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
      inspector: "Alex Morgan",
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
      return {
        id: `permit-${site.id}-${permitIndex}`,
        siteId: site.id,
        type: permit.type,
        status,
        owner: site.siteLead,
        expiresAt: `May ${21 + siteIndex + permitIndex}`,
        riskLevel: status === "Expired" ? "critical" : status === "Expiring Soon" ? "medium" : "low",
      };
    })
  );
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
} = {}): SafePredictDataset {
  const normalizedLiveJobsites = normalizeLiveJobsites(liveJobsites);
  const demoJobsites = safePredictDemoJobsites.map(withSiteMetrics);
  const jobsites = normalizedLiveJobsites.length > 0 ? normalizedLiveJobsites : demoJobsites;
  const liveRecordRows = [...liveActions, ...liveIncidents, ...liveObservations, ...livePermits, ...liveInspections];
  const jobsitesWithLiveMetrics = normalizedLiveJobsites.length > 0
    ? jobsites.map((site) => {
        const relatedRows = liveRecordRows.filter((row) => liveSiteId(row, jobsites, 0) === site.id);
        const riskScore = riskScoreFromRows(site, relatedRows);
        return {
          ...site,
          riskScore,
          riskLevel: riskLevelForScore(riskScore),
          openActions: Math.max(site.openActions, liveActions.filter((row) => liveSiteId(row, jobsites, 0) === site.id && normalizeActionStatus(textValue(row, ["status"])) !== "Closed").length),
          activePermits: Math.max(site.activePermits, livePermits.filter((row) => liveSiteId(row, jobsites, 0) === site.id).length),
          incidentCount: Math.max(site.incidentCount, liveIncidents.filter((row) => liveSiteId(row, jobsites, 0) === site.id).length),
          observationCount: Math.max(site.observationCount, liveObservations.filter((row) => liveSiteId(row, jobsites, 0) === site.id).length),
          inspectionGaps: Math.max(site.inspectionGaps, liveInspections.filter((row) => liveSiteId(row, jobsites, 0) === site.id && textValue(row, ["status"]).toLowerCase().includes("fail")).length),
        };
      })
    : jobsites;
  const actions = normalizeLiveActions(liveActions, jobsitesWithLiveMetrics);
  const incidents = normalizeLiveIncidents(liveIncidents, jobsitesWithLiveMetrics);
  const observations = normalizeLiveObservations(liveObservations, jobsitesWithLiveMetrics);
  const permits = normalizeLivePermits(livePermits, jobsitesWithLiveMetrics);
  const trainingEmployees = normalizeLiveEmployees(liveEmployees, jobsitesWithLiveMetrics);
  const userEmployees = normalizeLiveUsers(liveUsers, jobsitesWithLiveMetrics);
  const employees = mergeEmployees(trainingEmployees, userEmployees);
  const inspections = normalizeLiveInspections(liveInspections, jobsitesWithLiveMetrics);
  const reports = normalizeLiveReports(liveReports, jobsitesWithLiveMetrics);
  const documents = normalizeLiveDocuments(liveDocuments, jobsitesWithLiveMetrics);
  const isLiveDataset =
    normalizedLiveJobsites.length > 0 ||
    actions.length > 0 ||
    incidents.length > 0 ||
    observations.length > 0 ||
    permits.length > 0 ||
    employees.length > 0 ||
    inspections.length > 0 ||
    reports.length > 0 ||
    documents.length > 0;
  return {
    mode: isLiveDataset ? mode : "demo",
    company: isLiveDataset ? normalizeLiveCompany(liveCompany) : safePredictDemoCompany,
    jobsites: jobsitesWithLiveMetrics,
    employees: employees.length > 0 ? employees : safePredictDemoEmployees,
    alerts: buildAlerts(),
    actions: actions.length > 0 ? actions : buildActions(),
    inspections: inspections.length > 0 ? inspections : buildInspectionRecords(),
    incidents: incidents.length > 0 ? incidents : buildIncidentRecords(),
    observations: observations.length > 0 ? observations : buildObservationRecords(),
    hazards: buildHazardRecords(),
    permitSummaries: safePredictPermits,
    permits: permits.length > 0 ? permits : buildPermitRecords(),
    tradeReadiness: safePredictTradeReadiness,
    riskDrivers: safePredictRiskDrivers,
    forecasts: safePredictForecast,
    events: safePredictEvents,
    documents: documents.length > 0 ? documents : buildDocumentRecords(),
    reports: reports.length > 0 ? reports : buildReportRecords(),
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

export function riskForecastForSite(dataset: SafePredictDataset, siteId: string) {
  const site = jobsiteById(dataset, siteId);
  const delta = site ? site.riskScore - 68 : 0;
  return dataset.forecasts.map((point) => ({
    ...point,
    predictedRisk: Math.max(0, Math.min(100, point.predictedRisk + Math.round(delta / 3))),
    historicalRisk: point.historicalRisk == null ? undefined : Math.max(0, Math.min(100, point.historicalRisk + Math.round(delta / 4))),
  }));
}

export function summarizeSafePredictDataset(dataset: SafePredictDataset) {
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
