export type SafePredictRiskLevel = "critical" | "high" | "medium" | "low";

export type SafePredictSite = {
  id: string;
  name: string;
  location: string;
  score: number;
  riskLevel: SafePredictRiskLevel;
};

export type SafePredictDemoCompany = {
  id: string;
  name: string;
  industry: string;
  headquarters: string;
  accountType: string;
  safetyLead: string;
  operationsLead: string;
  primaryContactEmail: string;
};

export type SafePredictDemoJobsite = {
  id: string;
  code: string;
  name: string;
  address: string;
  cityState: string;
  projectType: string;
  phase: string;
  siteLead: string;
  workforceCount: number;
  activePermits: number;
  openActions: number;
  riskScore: number;
  riskLevel: SafePredictRiskLevel;
};

export type SafePredictDemoEmployeeStatus = "compliant" | "expiring" | "overdue";

export type SafePredictDemoEmployee = {
  id: string;
  name: string;
  role: string;
  trade: string;
  assignedSiteId: string;
  supervisor: string;
  shift: "Day" | "Swing" | "Night";
  readinessScore: number;
  status: SafePredictDemoEmployeeStatus;
  credentials: string[];
  lastActivity: string;
};

export type SafePredictForecastPoint = {
  date: string;
  historicalRisk?: number;
  predictedRisk: number;
};

export type SafePredictAlert = {
  id: string;
  title: string;
  detail: string;
  riskLevel: SafePredictRiskLevel;
  source: "Predictive Alert" | "Observation" | "Inspection";
  site: string;
  area: string;
  timeAgo: string;
  score: number;
};

export type SafePredictMitigation = {
  id: string;
  priority: Exclude<SafePredictRiskLevel, "low">;
  recommendation: string;
  detail: string;
  drivers: string[];
  impact: "High" | "Medium";
  timeline: string;
};

export type SafePredictActionStatus = "New" | "In Progress" | "Awaiting Verification" | "Closed";

export type SafePredictCorrectiveAction = {
  id: string;
  title: string;
  linkedRiskId: string;
  linkedRisk: string;
  assignee: string;
  dueDate: string;
  status: SafePredictActionStatus;
  priority: Exclude<SafePredictRiskLevel, "low">;
  progress: number;
  aiRecommended?: boolean;
  effectiveness?: number;
};

export type SafePredictRiskDriver = {
  id: string;
  name: string;
  detail: string;
  impact: "High Impact" | "Moderate Impact";
  score: number;
  riskLevel: Exclude<SafePredictRiskLevel, "low">;
};

export type SafePredictTradeReadiness = {
  trade: string;
  workers: number;
  fallProtection: "compliant" | "expiring" | "overdue";
  confinedSpace: "compliant" | "expiring" | "overdue";
  loto: "compliant" | "expiring" | "overdue";
  hazcom: "compliant" | "expiring" | "overdue";
  firstAid: "compliant" | "expiring" | "overdue";
  overallStatus: "Compliant" | "Expiring" | "Overdue";
};

export type SafePredictPermitSummary = {
  type: string;
  active: number;
  expiringSoon: number;
  expired: number;
};

export type SafePredictEvent = {
  id: string;
  time: string;
  title: string;
  detail: string;
  tone: SafePredictRiskLevel | "action";
};

export const safePredictDemoCompany: SafePredictDemoCompany = {
  id: "apex-industrial",
  name: "Apex Industrial Constructors",
  industry: "Commercial construction and light industrial",
  headquarters: "Dallas, TX",
  accountType: "Local demo tenant",
  safetyLead: "Alex Morgan",
  operationsLead: "Jordan Blake",
  primaryContactEmail: "safety@apex-demo.local",
};

export const safePredictSites: SafePredictSite[] = [
  { id: "riverside", name: "Riverside Commercial Tower", location: "Building A", score: 72, riskLevel: "high" },
  { id: "plant-1", name: "Plant 1", location: "Manufacturing", score: 68, riskLevel: "high" },
  { id: "warehouse-a", name: "Warehouse A", location: "Forklift operating zone", score: 78, riskLevel: "high" },
  { id: "plant-2", name: "Plant 2", location: "Concrete pour area", score: 62, riskLevel: "medium" },
  { id: "warehouse-b", name: "Warehouse B", location: "Shipping", score: 34, riskLevel: "low" },
];

export const safePredictDemoJobsites: SafePredictDemoJobsite[] = [
  {
    id: "riverside",
    code: "APX-RIV-014",
    name: "Riverside Commercial Tower",
    address: "1400 Trinity River Pkwy",
    cityState: "Dallas, TX",
    projectType: "18-story commercial tower",
    phase: "Structure and exterior envelope",
    siteLead: "Jessica Taylor",
    workforceCount: 96,
    activePermits: 13,
    openActions: 11,
    riskScore: 72,
    riskLevel: "high",
  },
  {
    id: "plant-1",
    code: "APX-MFG-021",
    name: "Plant 1 Modernization",
    address: "775 Foundry Loop",
    cityState: "Garland, TX",
    projectType: "Manufacturing retrofit",
    phase: "Press area commissioning",
    siteLead: "Mark Rivera",
    workforceCount: 74,
    activePermits: 9,
    openActions: 14,
    riskScore: 68,
    riskLevel: "high",
  },
  {
    id: "warehouse-a",
    code: "APX-WHA-006",
    name: "Warehouse A Expansion",
    address: "2300 Logistics Way",
    cityState: "Fort Worth, TX",
    projectType: "Distribution expansion",
    phase: "Racking and traffic controls",
    siteLead: "Alicia Moore",
    workforceCount: 52,
    activePermits: 7,
    openActions: 7,
    riskScore: 78,
    riskLevel: "high",
  },
  {
    id: "plant-2",
    code: "APX-PLT-018",
    name: "Plant 2 Concrete Package",
    address: "810 Mill Creek Rd",
    cityState: "Arlington, TX",
    projectType: "Industrial slab and utilities",
    phase: "Concrete pours and trenching",
    siteLead: "Maria Gomez",
    workforceCount: 43,
    activePermits: 8,
    openActions: 6,
    riskScore: 62,
    riskLevel: "medium",
  },
  {
    id: "warehouse-b",
    code: "APX-WHB-003",
    name: "Warehouse B Punch List",
    address: "4200 Rail Spur Dr",
    cityState: "Mesquite, TX",
    projectType: "Tenant improvement",
    phase: "Closeout and final inspections",
    siteLead: "Luis Hernandez",
    workforceCount: 31,
    activePermits: 5,
    openActions: 2,
    riskScore: 34,
    riskLevel: "low",
  },
];

export const safePredictDemoEmployees: SafePredictDemoEmployee[] = [
  { id: "emp-001", name: "Mark Rivera", role: "Site Supervisor", trade: "Manufacturing", assignedSiteId: "plant-1", supervisor: "Jordan Blake", shift: "Day", readinessScore: 91, status: "compliant", credentials: ["OSHA 30", "LOTO", "First Aid"], lastActivity: "Verified press guarding" },
  { id: "emp-002", name: "Sarah Johnson", role: "Equipment Trainer", trade: "Equipment Ops", assignedSiteId: "plant-1", supervisor: "Mark Rivera", shift: "Day", readinessScore: 84, status: "compliant", credentials: ["OSHA 10", "Machine Guarding", "Forklift"], lastActivity: "Assigned operator retraining" },
  { id: "emp-003", name: "Kevin White", role: "Safety Coordinator", trade: "Mechanical", assignedSiteId: "plant-1", supervisor: "Alex Morgan", shift: "Swing", readinessScore: 76, status: "expiring", credentials: ["OSHA 30", "Confined Space"], lastActivity: "Queued verification review" },
  { id: "emp-004", name: "Alicia Moore", role: "Logistics Lead", trade: "Equipment Ops", assignedSiteId: "warehouse-a", supervisor: "Jessica Taylor", shift: "Day", readinessScore: 79, status: "expiring", credentials: ["Forklift", "Traffic Control"], lastActivity: "Updated forklift route plan" },
  { id: "emp-005", name: "David Patel", role: "Field Engineer", trade: "Civil / Concrete", assignedSiteId: "warehouse-a", supervisor: "Alicia Moore", shift: "Day", readinessScore: 88, status: "compliant", credentials: ["OSHA 10", "Traffic Control"], lastActivity: "Re-striped pedestrian lane" },
  { id: "emp-006", name: "James Chen", role: "Carpenter", trade: "Civil / Concrete", assignedSiteId: "plant-2", supervisor: "Maria Gomez", shift: "Day", readinessScore: 72, status: "expiring", credentials: ["Fall Protection", "First Aid"], lastActivity: "Submitted break room observation" },
  { id: "emp-007", name: "Maria Gomez", role: "Site Lead", trade: "Civil / Concrete", assignedSiteId: "plant-2", supervisor: "Jordan Blake", shift: "Day", readinessScore: 94, status: "compliant", credentials: ["OSHA 30", "Excavation", "First Aid"], lastActivity: "Closed floor drain cover action" },
  { id: "emp-008", name: "Emily Davis", role: "Safety Trainer", trade: "Electrical", assignedSiteId: "riverside", supervisor: "Alex Morgan", shift: "Day", readinessScore: 69, status: "overdue", credentials: ["OSHA 30", "HazCom"], lastActivity: "Scheduled PPE refresher" },
  { id: "emp-009", name: "Tom Baker", role: "Instrumentation Tech", trade: "Electrical", assignedSiteId: "riverside", supervisor: "Jessica Taylor", shift: "Night", readinessScore: 81, status: "compliant", credentials: ["Electrical Safety", "Gas Detection"], lastActivity: "Calibrated gas detector #12" },
  { id: "emp-010", name: "Luis Hernandez", role: "Finish Lead", trade: "Scaffolding", assignedSiteId: "warehouse-b", supervisor: "Jessica Taylor", shift: "Day", readinessScore: 86, status: "compliant", credentials: ["Scaffold User", "Fall Protection"], lastActivity: "Reorganized storage area B" },
  { id: "emp-011", name: "Nina Brooks", role: "Welder", trade: "Welding", assignedSiteId: "riverside", supervisor: "Emily Davis", shift: "Swing", readinessScore: 63, status: "overdue", credentials: ["Hot Work", "Fire Watch"], lastActivity: "Hot work permit expiring soon" },
  { id: "emp-012", name: "Owen Carter", role: "Apprentice Electrician", trade: "Electrical", assignedSiteId: "riverside", supervisor: "Tom Baker", shift: "Day", readinessScore: 58, status: "overdue", credentials: ["Electrical Safety"], lastActivity: "Missing LOTO renewal" },
];

export const safePredictForecast: SafePredictForecastPoint[] = [
  { date: "May 11", historicalRisk: 50, predictedRisk: 50 },
  { date: "May 12", historicalRisk: 47, predictedRisk: 52 },
  { date: "May 13", historicalRisk: 55, predictedRisk: 57 },
  { date: "May 14", historicalRisk: 58, predictedRisk: 61 },
  { date: "May 15", historicalRisk: 64, predictedRisk: 66 },
  { date: "May 16", historicalRisk: 70, predictedRisk: 72 },
  { date: "May 17", historicalRisk: 67, predictedRisk: 76 },
  { date: "May 18", predictedRisk: 84 },
  { date: "May 19", predictedRisk: 91 },
  { date: "May 20", predictedRisk: 95 },
  { date: "May 21", predictedRisk: 92 },
  { date: "May 22", predictedRisk: 96 },
  { date: "May 23", predictedRisk: 90 },
  { date: "May 24", predictedRisk: 85 },
  { date: "May 25", predictedRisk: 76 },
  { date: "May 26", predictedRisk: 70 },
  { date: "May 27", predictedRisk: 64 },
  { date: "May 28", predictedRisk: 54 },
  { date: "May 29", predictedRisk: 48 },
  { date: "May 30", predictedRisk: 42 },
  { date: "Jun 2", predictedRisk: 36 },
  { date: "Jun 4", predictedRisk: 27 },
  { date: "Jun 6", predictedRisk: 35 },
  { date: "Jun 9", predictedRisk: 56 },
];

export const safePredictAlerts: SafePredictAlert[] = [
  {
    id: "machine-guarding",
    title: "Machine Guarding Bypass",
    detail: "AI model detected recurring bypass behavior on Press #4.",
    riskLevel: "critical",
    source: "Predictive Alert",
    site: "Plant 1",
    area: "Manufacturing",
    timeAgo: "15m ago",
    score: 92,
  },
  {
    id: "forklift-proximity",
    title: "Forklift-Pedestrian Proximity",
    detail: "High pedestrian traffic in forklift operating zone.",
    riskLevel: "high",
    source: "Predictive Alert",
    site: "Warehouse A",
    area: "Forklift operating zone",
    timeAgo: "1h ago",
    score: 78,
  },
  {
    id: "slips-trips",
    title: "Slips, Trips & Falls",
    detail: "Water on floor near Break Room.",
    riskLevel: "medium",
    source: "Observation",
    site: "Plant 2",
    area: "Break Room",
    timeAgo: "2h ago",
    score: 62,
  },
  {
    id: "ppe-compliance",
    title: "PPE Compliance",
    detail: "Missing eye protection observed in Area 3.",
    riskLevel: "medium",
    source: "Observation",
    site: "Plant 1",
    area: "Assembly",
    timeAgo: "3h ago",
    score: 58,
  },
  {
    id: "housekeeping",
    title: "Housekeeping",
    detail: "Material stored outside designated area.",
    riskLevel: "low",
    source: "Observation",
    site: "Warehouse B",
    area: "Shipping",
    timeAgo: "5h ago",
    score: 34,
  },
];

export const safePredictRiskDrivers: SafePredictRiskDriver[] = [
  {
    id: "fall-protection",
    name: "Fall Protection Issues",
    detail: "Recent increase in fall protection observations and near misses.",
    impact: "High Impact",
    score: 5,
    riskLevel: "critical",
  },
  {
    id: "housekeeping-driver",
    name: "Housekeeping",
    detail: "Frequent housekeeping issues in work areas.",
    impact: "High Impact",
    score: 4,
    riskLevel: "high",
  },
  {
    id: "electrical-exposure",
    name: "Electrical Exposure",
    detail: "More exposed electrical tasks planned and in progress.",
    impact: "Moderate Impact",
    score: 3,
    riskLevel: "medium",
  },
  {
    id: "missed-training",
    name: "Missed Training",
    detail: "Increase in overdue training for critical topics.",
    impact: "Moderate Impact",
    score: 3,
    riskLevel: "medium",
  },
];

export const safePredictMitigations: SafePredictMitigation[] = [
  {
    id: "fall-compliance",
    priority: "high",
    recommendation: "Strengthen Fall Protection Compliance",
    detail: "Multiple locations with insufficient fall protection.",
    drivers: ["Fall Hazards", "Working at Height"],
    impact: "High",
    timeline: "Start within 24h",
  },
  {
    id: "housekeeping-control",
    priority: "high",
    recommendation: "Improve Housekeeping in Work Areas",
    detail: "Increased trip hazards and clutter in 3 areas.",
    drivers: ["Housekeeping", "Walkways"],
    impact: "High",
    timeline: "Start within 48h",
  },
  {
    id: "electrical-loto",
    priority: "medium",
    recommendation: "Verify Electrical Lockout/Tagout Procedures",
    detail: "LOTO procedures not followed consistently.",
    drivers: ["Electrical Safety"],
    impact: "Medium",
    timeline: "Start within 7 days",
  },
];

export const safePredictActions: SafePredictCorrectiveAction[] = [
  {
    id: "ca-1",
    title: "Install fixed guarding on Press #4",
    linkedRiskId: "machine-guarding",
    linkedRisk: "Machine Guarding Bypass",
    assignee: "Mark Rivera",
    dueDate: "May 24",
    status: "New",
    priority: "high",
    progress: 0,
  },
  {
    id: "ca-2",
    title: "Retrain operators on guarding procedures",
    linkedRiskId: "machine-guarding",
    linkedRisk: "Machine Guarding Bypass",
    assignee: "Sarah Johnson",
    dueDate: "May 20",
    status: "In Progress",
    priority: "high",
    progress: 60,
  },
  {
    id: "ca-3",
    title: "Verify guarding installation on Press #4",
    linkedRiskId: "machine-guarding",
    linkedRisk: "Machine Guarding Bypass",
    assignee: "Kevin White",
    dueDate: "May 27",
    status: "Awaiting Verification",
    priority: "high",
    progress: 90,
    aiRecommended: true,
  },
  {
    id: "ca-4",
    title: "Reorganized storage area B",
    linkedRiskId: "housekeeping",
    linkedRisk: "Housekeeping",
    assignee: "Luis Hernandez",
    dueDate: "May 18",
    status: "Closed",
    priority: "medium",
    progress: 100,
    effectiveness: 5,
  },
  {
    id: "ca-5",
    title: "Update forklift traffic management plan",
    linkedRiskId: "forklift-proximity",
    linkedRisk: "Forklift-Pedestrian Proximity",
    assignee: "Alicia Moore",
    dueDate: "May 25",
    status: "New",
    priority: "high",
    progress: 0,
  },
  {
    id: "ca-6",
    title: "Re-stripe pedestrian walkways",
    linkedRiskId: "forklift-proximity",
    linkedRisk: "Forklift-Pedestrian Proximity",
    assignee: "David Patel",
    dueDate: "May 22",
    status: "In Progress",
    priority: "high",
    progress: 40,
  },
  {
    id: "ca-7",
    title: "Verify updated forklift traffic plan",
    linkedRiskId: "forklift-proximity",
    linkedRisk: "Forklift-Pedestrian Proximity",
    assignee: "Alicia Moore",
    dueDate: "May 28",
    status: "Awaiting Verification",
    priority: "high",
    progress: 85,
    aiRecommended: true,
  },
  {
    id: "ca-8",
    title: "Repair floor drain cover",
    linkedRiskId: "slips-trips",
    linkedRisk: "Slips, Trips & Falls",
    assignee: "Maria Gomez",
    dueDate: "May 17",
    status: "Closed",
    priority: "medium",
    progress: 100,
    effectiveness: 5,
  },
  {
    id: "ca-9",
    title: "Add anti-slip mats near Break Room",
    linkedRiskId: "slips-trips",
    linkedRisk: "Slips, Trips & Falls",
    assignee: "James Chen",
    dueDate: "May 26",
    status: "New",
    priority: "medium",
    progress: 0,
  },
  {
    id: "ca-10",
    title: "Conduct PPE refresher training",
    linkedRiskId: "ppe-compliance",
    linkedRisk: "PPE Compliance",
    assignee: "Emily Davis",
    dueDate: "May 25",
    status: "In Progress",
    priority: "medium",
    progress: 30,
  },
  {
    id: "ca-11",
    title: "Verify anti-slip mats installation",
    linkedRiskId: "slips-trips",
    linkedRisk: "Slips, Trips & Falls",
    assignee: "James Chen",
    dueDate: "May 29",
    status: "Awaiting Verification",
    priority: "medium",
    progress: 70,
  },
  {
    id: "ca-12",
    title: "Calibrated gas detector #12",
    linkedRiskId: "electrical-exposure",
    linkedRisk: "Gas Detection",
    assignee: "Tom Baker",
    dueDate: "May 16",
    status: "Closed",
    priority: "medium",
    progress: 100,
    effectiveness: 5,
  },
];

export const safePredictEvents: SafePredictEvent[] = [
  {
    id: "event-1",
    time: "10:24 AM",
    title: "New Predictive Alert",
    detail: "Machine Guarding Bypass on Press #4, Plant 1 - Press Area.",
    tone: "critical",
  },
  {
    id: "event-2",
    time: "09:58 AM",
    title: "Corrective Action Created",
    detail: "Install fixed guarding on Press #4 assigned to Mark Rivera.",
    tone: "action",
  },
  {
    id: "event-3",
    time: "09:42 AM",
    title: "Observation Submitted",
    detail: "Water on floor near Break Room submitted by James Chen.",
    tone: "medium",
  },
  {
    id: "event-4",
    time: "09:15 AM",
    title: "Action Closed",
    detail: "Repaired floor drain cover closed by Maria Gomez.",
    tone: "low",
  },
  {
    id: "event-5",
    time: "08:47 AM",
    title: "Verification Complete",
    detail: "Guarding installation verified effective by Kevin White.",
    tone: "low",
  },
];

export const safePredictTradeReadiness: SafePredictTradeReadiness[] = [
  {
    trade: "Electrical",
    workers: 48,
    fallProtection: "compliant",
    confinedSpace: "expiring",
    loto: "compliant",
    hazcom: "compliant",
    firstAid: "expiring",
    overallStatus: "Expiring",
  },
  {
    trade: "Mechanical",
    workers: 52,
    fallProtection: "compliant",
    confinedSpace: "compliant",
    loto: "overdue",
    hazcom: "compliant",
    firstAid: "compliant",
    overallStatus: "Overdue",
  },
  {
    trade: "Civil / Concrete",
    workers: 38,
    fallProtection: "expiring",
    confinedSpace: "compliant",
    loto: "compliant",
    hazcom: "expiring",
    firstAid: "compliant",
    overallStatus: "Expiring",
  },
  {
    trade: "Welding",
    workers: 26,
    fallProtection: "overdue",
    confinedSpace: "expiring",
    loto: "compliant",
    hazcom: "compliant",
    firstAid: "expiring",
    overallStatus: "Overdue",
  },
  {
    trade: "Equipment Ops",
    workers: 34,
    fallProtection: "compliant",
    confinedSpace: "compliant",
    loto: "expiring",
    hazcom: "compliant",
    firstAid: "compliant",
    overallStatus: "Expiring",
  },
  {
    trade: "Scaffolding",
    workers: 22,
    fallProtection: "expiring",
    confinedSpace: "compliant",
    loto: "expiring",
    hazcom: "compliant",
    firstAid: "compliant",
    overallStatus: "Expiring",
  },
];

export const safePredictPermits: SafePredictPermitSummary[] = [
  { type: "Hot Work", active: 12, expiringSoon: 3, expired: 1 },
  { type: "Confined Space Entry", active: 8, expiringSoon: 2, expired: 0 },
  { type: "Excavation", active: 6, expiringSoon: 1, expired: 1 },
  { type: "Electrical Work", active: 7, expiringSoon: 2, expired: 0 },
  { type: "Work at Height", active: 9, expiringSoon: 3, expired: 0 },
];

export function riskLevelForScore(score: number): SafePredictRiskLevel {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function riskLabel(level: SafePredictRiskLevel) {
  if (level === "critical") return "Critical";
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}

export function riskToneClasses(level: SafePredictRiskLevel) {
  if (level === "critical") return "border-red-200 bg-red-50 text-red-700";
  if (level === "high") return "border-orange-200 bg-orange-50 text-orange-700";
  if (level === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function filterAlertsByRisk(alerts: SafePredictAlert[], riskLevel: string) {
  if (!riskLevel || riskLevel === "all") return alerts;
  return alerts.filter((alert) => alert.riskLevel === riskLevel);
}

export function actionsForRisk(actions: SafePredictCorrectiveAction[], riskId: string) {
  return actions.filter((action) => action.linkedRiskId === riskId);
}

export function summarizeActions(actions: SafePredictCorrectiveAction[]) {
  const open = actions.filter((action) => action.status !== "Closed").length;
  const overdue = actions.filter((action) => {
    if (action.status === "Closed") return false;
    const day = Number(action.dueDate.replace(/^\D+/, ""));
    return Number.isFinite(day) && day <= 25;
  }).length;
  const closed = actions.filter((action) => action.status === "Closed").length;
  return {
    open,
    overdue,
    closed,
    averageDaysToClose: 6.4,
    riskScore: 68,
  };
}

export function workforceTotals(rows: SafePredictTradeReadiness[]) {
  const workers = rows.reduce((sum, row) => sum + row.workers, 0);
  return {
    workers,
    compliant: 312,
    expiringSoon: 60,
    overdue: 28,
    compliantPercent: 78,
    expiringSoonPercent: 15,
    overduePercent: 7,
  };
}

export function permitTotals(rows: SafePredictPermitSummary[]) {
  return rows.reduce(
    (total, row) => ({
      active: total.active + row.active,
      expiringSoon: total.expiringSoon + row.expiringSoon,
      expired: total.expired + row.expired,
    }),
    { active: 0, expiringSoon: 0, expired: 0 }
  );
}

export function employeesForSite(employees: SafePredictDemoEmployee[], siteId: string) {
  return employees.filter((employee) => employee.assignedSiteId === siteId);
}

export function jobsiteForId(jobsites: SafePredictDemoJobsite[], siteId: string) {
  return jobsites.find((jobsite) => jobsite.id === siteId);
}

export function demoCompanyTotals(jobsites: SafePredictDemoJobsite[], employees: SafePredictDemoEmployee[]) {
  const riskScore = Math.round(jobsites.reduce((sum, jobsite) => sum + jobsite.riskScore, 0) / jobsites.length);
  const openActions = jobsites.reduce((sum, jobsite) => sum + jobsite.openActions, 0);
  const activePermits = jobsites.reduce((sum, jobsite) => sum + jobsite.activePermits, 0);
  const overdueEmployees = employees.filter((employee) => employee.status === "overdue").length;
  const expiringEmployees = employees.filter((employee) => employee.status === "expiring").length;

  return {
    jobsites: jobsites.length,
    employees: employees.length,
    openActions,
    activePermits,
    riskScore,
    overdueEmployees,
    expiringEmployees,
  };
}
