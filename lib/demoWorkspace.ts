import type {
  DashboardAnalyticsSummary,
  DashboardCompanyProfile,
  DashboardCompanyUser,
  DashboardDataState,
  DashboardDocument,
  DashboardWorkspaceSummary,
} from "@/components/dashboard/types";
import { getPermissionMap } from "@/lib/rbac";
import { emptyOnboardingState } from "@/lib/onboardingState";

const now = new Date();
const isoDaysAgo = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
const isoDaysFromNow = (days: number) => new Date(now.getTime() + days * 86400000).toISOString();

export const demoCompanyProfile: DashboardCompanyProfile = {
  id: "demo-company",
  name: "Summit Ridge Constructors",
  team_key: "summit-ridge",
  industry: "Commercial construction",
  phone: "555-0140",
  website: "https://example.com",
  address_line_1: "4100 Industrial Way",
  city: "Austin",
  state_region: "TX",
  postal_code: "78701",
  country: "USA",
  primary_contact_name: "Jordan Lee",
  primary_contact_email: "demo@safety360docs.com",
  status: "active",
  pilot_trial_ends_at: isoDaysFromNow(21),
  pilot_converted_at: null,
};

export const demoCompanyUsers: DashboardCompanyUser[] = [
  {
    id: "demo-user-1",
    email: "jordan@summitridge.example",
    name: "Jordan Lee",
    role: "company_admin",
    team: "Operations",
    status: "Active",
  },
  {
    id: "demo-user-2",
    email: "maria@summitridge.example",
    name: "Maria Chen",
    role: "safety_manager",
    team: "Safety",
    status: "Active",
  },
  {
    id: "demo-user-3",
    email: "eli@summitridge.example",
    name: "Eli Brooks",
    role: "field_supervisor",
    team: "Field",
    status: "Pending",
  },
];

export const demoDocuments: DashboardDocument[] = [
  {
    id: "demo-doc-1",
    created_at: isoDaysAgo(1),
    project_name: "North Tower",
    document_title: "Site-specific safety plan",
    document_type: "PESHEP",
    category: "Safety plan",
    status: "approved",
    final_file_path: "demo/final/site-specific-safety-plan.docx",
  },
  {
    id: "demo-doc-2",
    created_at: isoDaysAgo(2),
    project_name: "North Tower",
    document_title: "Steel erection CSEP",
    document_type: "CSEP",
    category: "Contractor safety",
    status: "submitted",
    draft_file_path: "demo/draft/steel-erection-csep.docx",
  },
];

export const demoWorkspaceSummary: DashboardWorkspaceSummary = {
  jobsites: [
    {
      id: "demo-jobsite-1",
      name: "North Tower",
      project_number: "SR-1042",
      location: "Austin, TX",
      status: "active",
      updated_at: isoDaysAgo(1),
    },
    {
      id: "demo-jobsite-2",
      name: "Warehouse Retrofit",
      project_number: "SR-2210",
      location: "Round Rock, TX",
      status: "active",
      updated_at: isoDaysAgo(3),
    },
  ],
  observations: [
    {
      id: "demo-action-1",
      jobsite_id: "demo-jobsite-1",
      category: "fall_protection",
      status: "open",
      due_at: isoDaysAgo(1),
      title: "Guardrail gap at level 4 stairwell",
    },
    {
      id: "demo-action-2",
      jobsite_id: "demo-jobsite-2",
      category: "housekeeping",
      status: "in_progress",
      due_at: isoDaysFromNow(2),
      title: "Clear material staging aisle",
    },
  ],
  daps: [
    { id: "demo-jsa-1", jobsite_id: "demo-jobsite-1", status: "open", title: "Crane pick JSA" },
    { id: "demo-jsa-2", jobsite_id: "demo-jobsite-2", status: "completed", title: "MEP rough-in JSA" },
  ],
  permits: [
    {
      id: "demo-permit-1",
      jobsite_id: "demo-jobsite-1",
      title: "Hot work permit",
      status: "active",
      severity: "high",
      sif_flag: true,
      stop_work_status: "stop_work_requested",
    },
  ],
  incidents: [
    {
      id: "demo-incident-1",
      jobsite_id: "demo-jobsite-2",
      title: "Near miss: forklift aisle conflict",
      status: "open",
      severity: "medium",
      sif_flag: false,
    },
  ],
  reports: [
    { id: "demo-report-1", jobsite_id: "demo-jobsite-1", status: "draft", title: "Daily safety summary" },
  ],
};

export const demoAnalyticsSummary: DashboardAnalyticsSummary = {
  topHazardCategories: [
    { category: "fall_protection", count: 4 },
    { category: "material_handling", count: 3 },
    { category: "housekeeping", count: 2 },
  ],
  jobsiteRiskScore: [
    {
      jobsiteId: "demo-jobsite-1",
      score: 11,
      incidents: 0,
      sif: 1,
      stopWork: 1,
      overdue: 1,
    },
    {
      jobsiteId: "demo-jobsite-2",
      score: 6,
      incidents: 1,
      sif: 0,
      stopWork: 0,
      overdue: 0,
    },
  ],
  recentReports: [
    { id: "demo-report-1", title: "Daily safety summary", tag: "HAZARD" },
    { id: "demo-report-2", title: "Forklift aisle near miss", tag: "NEAR MISS" },
  ],
  observationBreakdown: {
    nearMiss: 1,
    hazard: 5,
    positive: 2,
    other: 0,
    inspections: 4,
    daps: 2,
  },
};

export function buildSalesDemoDashboardData(base: Pick<DashboardDataState, "reload" | "refreshCompanyWorkspace">): DashboardDataState {
  return {
    loading: false,
    userRole: "sales_demo",
    userTeam: "Demo Workspace",
    permissionMap: getPermissionMap("company_admin"),
    companyProfile: demoCompanyProfile,
    workspaceProduct: "full",
    documents: demoDocuments,
    creditBalance: 25,
    companyUsers: demoCompanyUsers,
    companyInvites: [
      {
        id: "demo-invite-1",
        email: "foreman@summitridge.example",
        role: "field_supervisor",
        status: "pending",
        created_at: isoDaysAgo(1),
      },
    ],
    workspaceSummary: demoWorkspaceSummary,
    analyticsSummary: demoAnalyticsSummary,
    companyWorkspaceLoaded: true,
    companyWorkspaceLoading: false,
    companyWorkspaceError: null,
    analyticsSummaryIssue: null,
    onboardingState: {
      ...emptyOnboardingState(),
      completedSteps: ["company_profile", "team_invites", "first_jobsite", "first_document"],
      lastSeenCommandCenterAt: null,
    },
    refreshCompanyWorkspace: base.refreshCompanyWorkspace,
    reload: base.reload,
  };
}
