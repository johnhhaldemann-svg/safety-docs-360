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

export const demoCompanyInvites = [
  {
    id: "demo-invite-1",
    email: "foreman@summitridge.example",
    role: "Field Supervisor",
    status: "pending",
    created_at: isoDaysAgo(1),
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

export const demoCompanyJobsiteRows = [
  {
    id: "demo-jobsite-1",
    company_id: "demo-company",
    name: "North Tower",
    project_number: "SR-1042",
    location: "Austin, TX",
    status: "active",
    project_manager: "Avery Patel",
    safety_lead: "Maria Chen",
    start_date: isoDaysAgo(45).slice(0, 10),
    end_date: isoDaysFromNow(120).slice(0, 10),
    notes: "Core and shell phase with crane picks, steel erection, and active street logistics.",
    created_at: isoDaysAgo(60),
    updated_at: isoDaysAgo(1),
  },
  {
    id: "demo-jobsite-2",
    company_id: "demo-company",
    name: "Warehouse Retrofit",
    project_number: "SR-2210",
    location: "Round Rock, TX",
    status: "active",
    project_manager: "Eli Brooks",
    safety_lead: "Jordan Lee",
    start_date: isoDaysAgo(18).slice(0, 10),
    end_date: isoDaysFromNow(65).slice(0, 10),
    notes: "Tenant improvement work with phased material handling and night-shift controls.",
    created_at: isoDaysAgo(25),
    updated_at: isoDaysAgo(3),
  },
  {
    id: "demo-jobsite-3",
    company_id: "demo-company",
    name: "South Clinic Buildout",
    project_number: "SR-3097",
    location: "San Marcos, TX",
    status: "planned",
    project_manager: "Nora Williams",
    safety_lead: "Maria Chen",
    start_date: isoDaysFromNow(14).slice(0, 10),
    end_date: isoDaysFromNow(180).slice(0, 10),
    notes: "Preconstruction walkthroughs and baseline training assignments are underway.",
    created_at: isoDaysAgo(4),
    updated_at: isoDaysAgo(2),
  },
];

export const demoJsaActivities = [
  {
    id: "demo-activity-1",
    jsa_id: "demo-jsa-1",
    jobsite_id: "demo-jobsite-1",
    activity_name: "Level 5 steel welding",
    trade: "Ironworkers",
    area: "North Tower - Level 5",
    permit_required: true,
    permit_type: "hot_work",
    planned_risk_level: "high",
  },
  {
    id: "demo-activity-2",
    jsa_id: "demo-jsa-3",
    jobsite_id: "demo-jobsite-2",
    activity_name: "Panel replacement inside energized room",
    trade: "Electrical",
    area: "Warehouse electrical room",
    permit_required: true,
    permit_type: "electrical",
    planned_risk_level: "critical",
  },
];

export const demoPermitRows = [
  {
    id: "demo-permit-1",
    title: "Hot work permit - Level 5 steel welding",
    permit_type: "hot_work",
    status: "active",
    severity: "high",
    category: "safety",
    jobsite_id: "demo-jobsite-1",
    owner_user_id: "demo-user-2",
    due_at: isoDaysFromNow(1),
    sif_flag: true,
    escalation_level: "urgent",
    escalation_reason: "Welding near temporary decking requires fire watch verification.",
    stop_work_status: "stop_work_requested",
    stop_work_reason: "Fire blanket gap noted during morning inspection.",
    dap_activity_id: "demo-activity-1",
    observation_id: "demo-action-1",
    created_at: isoDaysAgo(1),
    updated_at: isoDaysAgo(0),
  },
  {
    id: "demo-permit-2",
    title: "Electrical permit - panel replacement",
    permit_type: "electrical",
    status: "draft",
    severity: "critical",
    category: "operations",
    jobsite_id: "demo-jobsite-2",
    owner_user_id: "demo-user-3",
    due_at: isoDaysFromNow(3),
    sif_flag: true,
    escalation_level: "monitor",
    escalation_reason: "Lockout plan awaiting second-person verification.",
    stop_work_status: "normal",
    stop_work_reason: null,
    dap_activity_id: "demo-activity-2",
    observation_id: null,
    created_at: isoDaysAgo(2),
    updated_at: isoDaysAgo(1),
  },
];

export const demoIncidentRows = [
  {
    id: "demo-incident-1",
    title: "Near miss: forklift aisle conflict",
    status: "open",
    category: "near_miss",
    severity: "medium",
    injury_type: null,
    body_part: null,
    injury_source: "heavy_equipment",
    exposure_event_type: "struck_by_vehicle",
    days_away_from_work: 0,
    days_restricted: 0,
    job_transfer: false,
    recordable: false,
    lost_time: false,
    fatality: false,
    sif_flag: false,
    escalation_level: "monitor",
    stop_work_status: "normal",
    created_at: isoDaysAgo(2),
    occurred_at: isoDaysAgo(2),
    injury_month: now.getUTCMonth() + 1,
    injury_season: "spring",
    injury_day_of_week: "tuesday",
    injury_time_of_day: "afternoon",
  },
  {
    id: "demo-incident-2",
    title: "Recordable hand laceration during material staging",
    status: "in_progress",
    category: "incident",
    severity: "high",
    injury_type: "laceration",
    body_part: "hand",
    injury_source: "hand_tools",
    exposure_event_type: "contact_with_equipment",
    days_away_from_work: 0,
    days_restricted: 2,
    job_transfer: true,
    recordable: true,
    lost_time: false,
    fatality: false,
    sif_flag: true,
    escalation_level: "urgent",
    stop_work_status: "cleared",
    created_at: isoDaysAgo(5),
    occurred_at: isoDaysAgo(5),
    injury_month: now.getUTCMonth() + 1,
    injury_season: "spring",
    injury_day_of_week: "friday",
    injury_time_of_day: "morning",
  },
];

export const demoContractors = [
  { id: "demo-contractor-1", name: "Lone Star Steel" },
  { id: "demo-contractor-2", name: "Brightline Electrical" },
];

export const demoCrews = [
  { id: "demo-crew-1", name: "Steel erection crew A" },
  { id: "demo-crew-2", name: "Night shift MEP crew" },
];

export const demoJobsiteAssignments = [
  { user_id: "demo-user-2", jobsite_id: "demo-jobsite-1" },
  { user_id: "demo-user-2", jobsite_id: "demo-jobsite-2" },
  { user_id: "demo-user-3", jobsite_id: "demo-jobsite-2" },
];

export const demoWorkspaceSummary: DashboardWorkspaceSummary = {
  jobsites: demoCompanyJobsiteRows.map((jobsite) => ({
    id: jobsite.id,
    name: jobsite.name,
    project_number: jobsite.project_number,
    location: jobsite.location,
    status: jobsite.status,
    updated_at: jobsite.updated_at,
  })),
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
  permits: demoPermitRows,
  incidents: demoIncidentRows.map((incident) => ({
    ...incident,
    jobsite_id: "demo-jobsite-2",
  })),
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
    companyInvites: demoCompanyInvites,
    workspaceSummary: demoWorkspaceSummary,
    analyticsSummary: demoAnalyticsSummary,
    revenueReadiness: {
      score: 88,
      band: "Ready to sell",
      activationPercent: 92,
      operationsPercent: 84,
      billingPercent: 86,
      retentionPercent: 89,
      nextActions: [
        {
          id: "demo-revenue-action-1",
          label: "Open live company workspace",
          detail: "Use the demo data to walk through jobsite, permit, incident, and team workflows.",
          href: "/jobsites",
          priority: "high",
        },
      ],
      counts: {
        openWork: 7,
        overdueWork: 1,
        activeJobsites: 2,
        documentsStarted: demoDocuments.length,
      },
    },
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

type DemoRiskRecommendation = {
  id: string;
  kind: string;
  title: string;
  body: string;
  confidence: number;
  created_at: string;
};

export function buildSalesDemoAnalyticsSummaryResponse(days: number) {
  const normalizedDays = Math.max(1, Number.isFinite(days) ? Math.floor(days) : 30);
  const today = new Date();
  const toDayIso = (offsetDays: number) =>
    new Date(today.getTime() - offsetDays * 86400000).toISOString().slice(0, 10);
  const toIso = (offsetDays: number) =>
    new Date(today.getTime() - offsetDays * 86400000).toISOString();
  const observationTrends = [
    { date: toDayIso(6), count: 1 },
    { date: toDayIso(5), count: 2 },
    { date: toDayIso(4), count: 3 },
    { date: toDayIso(3), count: 3 },
    { date: toDayIso(2), count: 2 },
    { date: toDayIso(1), count: 4 },
    { date: toDayIso(0), count: 3 },
  ];
  const sifTrends = [
    { date: toDayIso(6), count: 0 },
    { date: toDayIso(5), count: 1 },
    { date: toDayIso(4), count: 1 },
    { date: toDayIso(3), count: 0 },
    { date: toDayIso(2), count: 2 },
    { date: toDayIso(1), count: 1 },
    { date: toDayIso(0), count: 1 },
  ];
  const riskMemoryRecommendations: DemoRiskRecommendation[] = [
    {
      id: "demo-risk-rec-1",
      kind: "control_focus",
      title: "Re-verify hot-work watch coverage at North Tower",
      body: "Two high-risk observations and one permit escalation overlap this week. Confirm fire watch handoff and close open corrective actions before next crane pick.",
      confidence: 0.91,
      created_at: toIso(1),
    },
    {
      id: "demo-risk-rec-2",
      kind: "coaching",
      title: "Coach night shift on panel lockout verification",
      body: "Electrical work shows recurring near-miss patterns. Add a 10-minute lockout verification drill to pre-task plans.",
      confidence: 0.84,
      created_at: toIso(2),
    },
  ];

  return {
    snapshots: [
      {
        id: "demo-analytics-snapshot-1",
        company_id: "demo-company",
        jobsite_id: null,
        snapshot_date: toDayIso(0),
        metrics: {
          openObservations: 4,
          incidents: 2,
          permits: 2,
        },
        created_by: "demo-user-1",
      },
    ],
    summary: {
      totals: {
        correctiveActions: 7,
        incidents: 2,
        permits: 2,
        daps: 2,
        dapActivities: 2,
      },
      closureTimes: {
        averageHours: 18.5,
        sampleSize: 3,
      },
      topHazardCategories: [
        { category: "fall_protection", count: 4 },
        { category: "material_handling", count: 3 },
        { category: "housekeeping", count: 2 },
      ],
      observationTrends,
      sifTrends,
      sifDashboard: {
        potentialCount: 2,
        byCategory: [
          { category: "fall_protection", count: 1 },
          { category: "electrical", count: 1 },
        ],
      },
      jobsiteRiskScore: [
        { jobsiteId: "demo-jobsite-1", score: 11, incidents: 0, sif: 1, stopWork: 1, overdue: 1 },
        { jobsiteId: "demo-jobsite-2", score: 6, incidents: 1, sif: 1, stopWork: 0, overdue: 0 },
      ],
      companyDashboard: {
        totalActiveJobsites: 2,
        totalOpenObservations: 4,
        totalHighRiskObservations: 2,
        sifCount: 2,
        averageClosureTimeHours: 18.5,
        topHazardCategories: [
          { category: "fall_protection", count: 4 },
          { category: "material_handling", count: 3 },
          { category: "housekeeping", count: 2 },
        ],
        openIncidents: 2,
        observationPriorityBands: { high: 2, medium: 3, low: 2 },
        dapCompletionToday: { completed: 1, total: 2, percent: 50 },
      },
      recentReports: [
        { id: "demo-report-1", title: "Daily safety summary", tag: "HAZARD" },
        { id: "demo-report-2", title: "Forklift aisle near miss", tag: "NEAR MISS" },
        { id: "demo-report-3", title: "PPE compliance walkthrough", tag: "POSITIVE" },
      ],
      observationBreakdown: {
        nearMiss: 1,
        hazard: 5,
        positive: 2,
        other: 0,
        inspections: 4,
        daps: 2,
      },
      riskHeatmap: {
        rowLabels: ["Critical", "High", "Moderate", "Low"],
        colLabels: ["High", "Moderate", "Low", "—"],
        cells: [
          [1, 0, 0, 0],
          [1, 1, 0, 0],
          [0, 2, 1, 0],
          [0, 0, 1, 0],
        ],
        max: 2,
      },
      benchmarking: {
        industryCode: "236220",
        industryInjuryRate: 2.4,
        tradeInjuryRate: 2.1,
        hoursWorked: 240000,
        incidentsForRate: 1,
        incidentRate: 0.83,
      },
      injuryAnalytics: {
        averageSeverityScore: 2.5,
        severitySampleSize: 1,
        sorToInjuryRatio: 0.5,
        sorCount: 2,
        injuryIncidentCount: 1,
        observationToInjuryConversionRate: 14.29,
        injuryPredictionModelUrl: `/api/company/injury-analytics/model?days=${normalizedDays}`,
      },
      riskMemory: {
        engine: "Safety360 Risk Memory Engine",
        windowDays: normalizedDays,
        facetCount: 9,
        topScopes: [
          { code: "steel_erection", count: 4 },
          { code: "electrical", count: 3 },
        ],
        topHazards: [
          { code: "fall_protection", count: 4 },
          { code: "lockout_tagout", count: 2 },
        ],
        openCorrectiveFacetHints: { openStyleStatuses: 3 },
        aggregated: {
          score: 74,
          band: "elevated",
          sampleSize: 9,
          baselineContribution: 6,
        },
        baselineHints: [
          {
            scope_code: "steel_erection",
            hazard_code: "fall_protection",
            signals: { repeat: true },
          },
        ],
        aggregatedWithBaseline: { score: 80, band: "high" },
        topLocationGrids: [
          { label: "N-05", count: 3 },
          { label: "E-12", count: 2 },
        ],
        topLocationAreas: [
          { label: "North Tower - Level 5", count: 4 },
          { label: "Warehouse electrical room", count: 2 },
        ],
        derivedRollupConfidence: 0.82,
      },
      riskMemoryRecommendations,
      safetyLeadership: {
        trendOfObservationsByWeek: [
          { week: "2026-W15", count: 5 },
          { week: "2026-W16", count: 6 },
          { week: "2026-W17", count: 7 },
        ],
        repeatHazardCategories: [
          { category: "fall_protection", count: 4 },
          { category: "material_handling", count: 3 },
        ],
        highRiskLocations: [
          { jobsiteId: "demo-jobsite-1", count: 2 },
          { jobsiteId: "demo-jobsite-2", count: 1 },
        ],
        sifByCategory: [
          { category: "fall_protection", count: 1 },
          { category: "electrical", count: 1 },
        ],
        closurePerformanceByJobsite: [
          { jobsiteId: "demo-jobsite-1", averageHours: 16.2, sampleSize: 2 },
          { jobsiteId: "demo-jobsite-2", averageHours: 23.1, sampleSize: 1 },
        ],
        positiveNegativeObservationRatio: {
          positive: 2,
          negative: 6,
          ratio: 0.33,
        },
      },
    },
  };
}

export function buildSalesDemoInjuryAnalyticsModel(days: number) {
  const normalizedDays = Math.max(1, Number.isFinite(days) ? Math.floor(days) : 365);
  const since = new Date(Date.now() - normalizedDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return {
    windowDays: normalizedDays,
    since,
    sorToExposureMap: [
      {
        sorHazardCategoryCode: "fall_protection",
        label: "Fall protection",
        impliedExposureEventTypes: ["fall_to_lower_level", "slip_trip_fall"],
      },
      {
        sorHazardCategoryCode: "electrical",
        label: "Electrical",
        impliedExposureEventTypes: ["contact_with_energy", "electrical_shock"],
      },
    ],
    eventToInjuryModel: [
      { eventType: "fall_to_lower_level", injuryLikelihood: 0.42, sampleSize: 8 },
      { eventType: "contact_with_energy", injuryLikelihood: 0.31, sampleSize: 6 },
      { eventType: "struck_by_vehicle", injuryLikelihood: 0.22, sampleSize: 5 },
    ],
    likelyInjuryInsight: {
      headline: "Laceration / hand injury risk is elevated this week.",
      secondaryLine: "Primary drivers: material handling + electrical panel work.",
      detailNote:
        "Demo model combines incidents, SOR observations, and corrective actions for storyboard purposes only.",
      hasData: true,
    },
    industryBenchmarkRates: {
      naicsPrefix: "236",
      recordableCasesPer200kHours: 2.4,
      dartCasesPer200kHours: 1.3,
      fatalityPer200kHours: 0.03,
      sourceNote: "Reference values from curated demo benchmark data.",
      injuryFactsIndustryProfilesUrl: "https://injuryfacts.nsc.org/work/work-overview/work-safety-introduction/",
      injuryFactsIncidentTrendsUrl: "https://injuryfacts.nsc.org/work/work-overview/work-safety-introduction/",
      historicalTrendSummary: "Construction rates trend down with stronger controls and planning maturity.",
      referenceDataNote: "Demo benchmark values are illustrative and are not customer data.",
      unitEquivalenceNote: "Rates shown per 200,000 work hours.",
    },
    industryCode: "236220",
    hoursWorked: 240000,
    incidentsForRate: 1,
    incidentRate: 0.83,
    severity: {
      averageScore: 2.5,
      sampleSize: 1,
    },
    conversion: {
      sorToInjuryRatio: 0.5,
      sorCount: 2,
      injuryIncidentCount: 1,
    },
  };
}

export function buildSalesDemoRiskRecommendations(mode: string) {
  const createdAt = new Date().toISOString();
  return {
    created: 2,
    recommendations: [
      {
        id: "demo-risk-rec-1",
        kind: "control_focus",
        title: "Re-verify hot-work watch coverage at North Tower",
        body: "Confirm fire watch handoff and close open corrective actions before next crane pick.",
        confidence: 0.91,
        created_at: createdAt,
      },
      {
        id: "demo-risk-rec-2",
        kind: "coaching",
        title: "Coach night shift on panel lockout verification",
        body: "Add a 10-minute lockout verification drill to pre-task plans this week.",
        confidence: 0.84,
        created_at: createdAt,
      },
    ],
    mode,
  };
}

export function buildSalesDemoRiskSnapshotResponse(snapshotDate: string, jobsiteId: string | null) {
  return {
    success: true,
    snapshot: {
      id: "demo-risk-snapshot-1",
      snapshot_date: snapshotDate,
      jobsite_id: jobsiteId,
    },
  };
}

export function buildSalesDemoRecommendationDismissResponse(id: string) {
  return {
    success: true,
    recommendation: {
      id,
      dismissed: true,
    },
  };
}
