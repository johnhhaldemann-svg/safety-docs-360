import type { PermissionMap } from "@/lib/rbac";
import type { WorkspaceProduct } from "@/lib/workspaceProduct";
import type { DashboardRole } from "@/lib/dashboardRole";

export type DashboardDocument = {
  id: string;
  created_at: string;
  project_name: string | null;
  document_title?: string | null;
  document_type: string | null;
  category?: string | null;
  status: string | null;
  draft_file_path?: string | null;
  final_file_path?: string | null;
  file_name?: string | null;
};

export type DashboardCompanyUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  team: string;
  status: string;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

export type DashboardCompanyInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at?: string | null;
};

export type DashboardCompanyProfile = {
  id: string;
  name: string | null;
  team_key: string | null;
  industry: string | null;
  phone: string | null;
  website: string | null;
  address_line_1: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  status: string | null;
  pilot_trial_ends_at?: string | null;
  pilot_converted_at?: string | null;
};

export type DashboardJobsite = {
  id?: string;
  company_id?: string;
  name: string;
  project_number?: string | null;
  location?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DashboardCorrectiveAction = {
  id?: string;
  jobsite_id?: string | null;
  category?: string | null;
  status?: string | null;
  due_at?: string | null;
  title?: string | null;
};

export type DashboardStatusRow = {
  id?: string;
  jobsite_id?: string | null;
  status?: string | null;
  title?: string | null;
};

export type DashboardRiskRow = {
  id?: string;
  jobsite_id?: string | null;
  title?: string | null;
  status?: string | null;
  severity?: string | null;
  sif_flag?: boolean | null;
  escalation_level?: string | null;
  stop_work_status?: string | null;
};

export type CompanyDashboardMetrics = {
  totalActiveJobsites: number;
  totalOpenObservations: number;
  totalHighRiskObservations: number;
  sifCount: number;
  averageClosureTimeHours: number;
  topHazardCategories: Array<{ category: string; count: number }>;
  openIncidents: number;
  observationPriorityBands?: {
    high: number;
    medium: number;
    low: number;
  };
  dapCompletionToday: { completed: number; total: number; percent: number };
};

export type DashboardAnalyticsSummary = {
  topHazardCategories?: Array<{ category: string; count: number }>;
  jobsiteRiskScore?: Array<{
    jobsiteId: string;
    score: number;
    incidents: number;
    sif: number;
    stopWork: number;
    overdue: number;
  }>;
  recentReports?: Array<{
    id: string;
    title: string;
    tag: string;
  }>;
  observationBreakdown?: {
    nearMiss: number;
    hazard: number;
    positive: number;
    other: number;
    inspections: number;
    daps: number;
  };
  companyDashboard?: CompanyDashboardMetrics;
  safetyLeadership?: {
    closurePerformanceByJobsite?: Array<{
      jobsiteId: string;
      averageHours: number;
      sampleSize: number;
    }>;
  };
} | null;

export type DashboardWorkspaceSummary = {
  jobsites: DashboardJobsite[];
  observations: DashboardCorrectiveAction[];
  daps: DashboardStatusRow[];
  permits: DashboardRiskRow[];
  incidents: DashboardRiskRow[];
  reports: DashboardStatusRow[];
};

export type DashboardBanner = {
  message: string;
  tone: "warning" | "error";
} | null;

export type DashboardHeroAction = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export type DashboardHero = {
  eyebrow: string;
  title: string;
  description: string;
  actions: DashboardHeroAction[];
};

export type DashboardMetric = {
  title: string;
  value: string;
  detail: string;
  tone?: "panel" | "elevated" | "attention";
};

export type DashboardFeedItem = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  tone?: "neutral" | "success" | "warning" | "error" | "info";
};

export type DashboardAction = {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  tone?: "panel" | "elevated" | "attention";
};

export type DashboardSummaryItem = {
  id: string;
  label: string;
  value: string;
  note: string;
  href?: string;
  tone?: "neutral" | "success" | "warning" | "error" | "info";
};

export type DashboardSectionEmpty = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export type DashboardFeedSection = {
  title: string;
  description: string;
  items: DashboardFeedItem[];
  empty: DashboardSectionEmpty;
};

export type DashboardActionSection = {
  title: string;
  description: string;
  items: DashboardAction[];
  empty: DashboardSectionEmpty;
};

export type DashboardSummarySection = {
  title: string;
  description: string;
  items: DashboardSummaryItem[];
  empty: DashboardSectionEmpty;
};

export type DashboardGraphItem = {
  id: string;
  label: string;
  value: number;
  detail?: string;
  tone?: "neutral" | "success" | "warning" | "error" | "info";
};

export type DashboardGraphSection = {
  title: string;
  description: string;
  items: DashboardGraphItem[];
  empty: DashboardSectionEmpty;
  valueLabel?: string;
};

export type DashboardBlockId =
  | "metric_primary"
  | "metric_secondary"
  | "metric_tertiary"
  | "metric_quaternary"
  | "priority_queue"
  | "next_actions"
  | "recent_activity"
  | "recent_documents"
  | "recent_reports"
  | "risk_ranking"
  | "hazard_trends"
  | "support_signals"
  | "company_access"
  | "training_signal"
  | "permit_followups"
  | "incident_followups"
  | "graph_hazard_trends"
  | "graph_jobsite_risk"
  | "graph_observation_mix";

export type DashboardAvailableBlock = {
  id: DashboardBlockId;
  title: string;
  description: string;
};

export type DashboardMetricBlock = {
  kind: "metric";
  title: string;
  value: string;
  detail: string;
  tone?: "panel" | "elevated" | "attention";
};

export type DashboardFeedBlock = {
  kind: "feed";
  section: DashboardFeedSection;
  eyebrow?: string;
};

export type DashboardActionBlock = {
  kind: "action";
  section: DashboardActionSection;
};

export type DashboardSummaryBlock = {
  kind: "summary";
  section: DashboardSummarySection;
  eyebrow?: string;
};

export type DashboardGraphBlock = {
  kind: "graph";
  section: DashboardGraphSection;
  eyebrow?: string;
};

export type DashboardBlockModel =
  | DashboardMetricBlock
  | DashboardFeedBlock
  | DashboardActionBlock
  | DashboardSummaryBlock
  | DashboardGraphBlock;

export type DashboardViewModel = {
  role: DashboardRole;
  hero: DashboardHero;
  banner?: DashboardBanner;
  blocks: Record<DashboardBlockId, DashboardBlockModel>;
};

export type DashboardDataState = {
  loading: boolean;
  userRole: string;
  userTeam: string;
  permissionMap: PermissionMap | null;
  companyProfile: DashboardCompanyProfile | null;
  workspaceProduct: WorkspaceProduct;
  documents: DashboardDocument[];
  creditBalance: number | null;
  companyUsers: DashboardCompanyUser[];
  companyInvites: DashboardCompanyInvite[];
  workspaceSummary: DashboardWorkspaceSummary;
  analyticsSummary: DashboardAnalyticsSummary;
  companyWorkspaceLoaded: boolean;
  companyWorkspaceLoading: boolean;
  companyWorkspaceError: string | null;
  analyticsSummaryIssue: DashboardBanner;
  refreshCompanyWorkspace: () => Promise<void>;
  reload: () => Promise<void>;
};
