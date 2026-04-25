import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import {
  getCompanyAdminDashboardModel,
  getDefaultDashboardModel,
  getFieldSupervisorDashboardModel,
  getSafetyManagerDashboardModel,
} from "@/components/dashboard/dashboard-mappers";
import type { DashboardBlockId, DashboardDataState } from "@/components/dashboard/types";
import { getAvailableDashboardBlocks, getDashboardRoleDefaultLayout } from "@/lib/dashboardLayout";
import { emptyOnboardingState } from "@/lib/onboardingState";

vi.mock("@/components/dashboard/use-dashboard-layout", () => ({
  useDashboardLayout: vi.fn(),
}));

import { useDashboardLayout } from "@/components/dashboard/use-dashboard-layout";

const baseData: DashboardDataState = {
  loading: false,
  userRole: "company_admin",
  userTeam: "Operations",
  permissionMap: {
    can_manage_company_users: true,
    can_manage_users: true,
    can_view_analytics: true,
    can_view_reports: true,
    can_view_all_company_data: true,
    can_view_dashboards: true,
  } as never,
  companyProfile: {
    id: "company-1",
    name: "Acme Safety",
    team_key: "acme",
    industry: "Construction",
    phone: null,
    website: null,
    address_line_1: null,
    city: null,
    state_region: null,
    postal_code: null,
    country: null,
    primary_contact_name: null,
    primary_contact_email: null,
    status: "active",
  },
  workspaceProduct: "full",
  documents: [
    {
      id: "doc-1",
      created_at: new Date().toISOString(),
      project_name: "Alpha",
      document_title: "Permit package",
      document_type: "permit",
      status: "submitted",
      final_file_path: null,
    },
  ],
  creditBalance: 12,
  companyUsers: [
    {
      id: "user-2",
      email: "worker@example.com",
      name: "Worker",
      role: "field_supervisor",
      team: "Operations",
      status: "Pending",
    },
  ],
  companyInvites: [
    {
      id: "invite-1",
      email: "invite@example.com",
      role: "field_supervisor",
      status: "pending",
    },
  ],
  workspaceSummary: {
    jobsites: [
      {
        id: "job-1",
        name: "North Yard",
        status: "active",
      },
    ],
    observations: [
      {
        id: "obs-1",
        jobsite_id: "job-1",
        status: "open",
        title: "Guardrail fix",
        due_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    daps: [
      {
        id: "dap-1",
        status: "open",
        title: "DAP review",
      },
    ],
    permits: [
      {
        id: "permit-1",
        jobsite_id: "job-1",
        title: "Hot work permit",
        status: "active",
        sif_flag: true,
      },
    ],
    incidents: [
      {
        id: "incident-1",
        jobsite_id: "job-1",
        title: "Near miss",
        status: "open",
      },
    ],
    reports: [
      {
        id: "report-1",
        status: "open",
        title: "Daily report",
      },
    ],
  },
  analyticsSummary: {
    topHazardCategories: [{ category: "fall_protection", count: 3 }],
    jobsiteRiskScore: [
      {
        jobsiteId: "job-1",
        score: 7,
        incidents: 1,
        sif: 0,
        stopWork: 0,
        overdue: 1,
      },
    ],
    recentReports: [
      {
        id: "recent-report-1",
        title: "Near miss report",
        tag: "NEAR MISS",
      },
    ],
  },
  companyWorkspaceLoaded: true,
  companyWorkspaceLoading: false,
  companyWorkspaceError: null,
  analyticsSummaryIssue: null,
  onboardingState: emptyOnboardingState(),
  refreshCompanyWorkspace: async () => {},
  reload: async () => {},
};

function mockLayout(
  role: "company_admin" | "safety_manager" | "field_supervisor" | "default",
  layoutOverride?: DashboardBlockId[]
) {
  const defaultLayout = getDashboardRoleDefaultLayout(role);
  const effectiveLayout = layoutOverride ?? defaultLayout;
  vi.mocked(useDashboardLayout).mockReturnValue({
    loading: false,
    saving: false,
    editing: false,
    savedLayout: null,
    defaultLayout,
    effectiveLayout,
    draftLayout: effectiveLayout,
    availableBlocks: getAvailableDashboardBlocks({ role }),
    message: null,
    hasUnsavedChanges: false,
    startEditing: vi.fn(),
    cancelEditing: vi.fn(),
    updateSlot: vi.fn(),
    save: vi.fn(),
    reset: vi.fn(),
    refresh: vi.fn(),
  } as never);
}

describe("DashboardView", () => {
  it("renders 10 blocks for company admins", () => {
    mockLayout("company_admin");
    const html = renderToStaticMarkup(
      <DashboardView model={getCompanyAdminDashboardModel(baseData)} />
    );

    expect((html.match(/data-dashboard-block=/g) ?? []).length).toBe(10);
  });

  it("renders 10 blocks for safety managers", () => {
    mockLayout("safety_manager");
    const html = renderToStaticMarkup(
      <DashboardView
        model={getSafetyManagerDashboardModel({
          ...baseData,
          userRole: "safety_manager",
        })}
      />
    );

    expect((html.match(/data-dashboard-block=/g) ?? []).length).toBe(10);
  });

  it("renders 10 blocks for field supervisors", () => {
    mockLayout("field_supervisor");
    const html = renderToStaticMarkup(
      <DashboardView
        model={getFieldSupervisorDashboardModel({
          ...baseData,
          userRole: "field_supervisor",
        })}
      />
    );

    expect((html.match(/data-dashboard-block=/g) ?? []).length).toBe(10);
  });

  it("renders 10 blocks for default dashboards", () => {
    mockLayout("default");
    const html = renderToStaticMarkup(
      <DashboardView
        model={getDefaultDashboardModel({
          ...baseData,
          userRole: "viewer",
        })}
      />
    );

    expect((html.match(/data-dashboard-block=/g) ?? []).length).toBe(10);
  });

  it("renders graph blocks from customized layouts", () => {
    mockLayout("company_admin", [
      "metric_primary",
      "metric_secondary",
      "metric_tertiary",
      "metric_quaternary",
      "graph_hazard_trends",
      "graph_jobsite_risk",
      "graph_observation_mix",
      "priority_queue",
      "next_actions",
      "recent_activity",
    ]);
    const html = renderToStaticMarkup(
      <DashboardView
        model={getCompanyAdminDashboardModel({
          ...baseData,
          analyticsSummary: {
            ...baseData.analyticsSummary,
            observationBreakdown: {
              nearMiss: 2,
              hazard: 4,
              positive: 1,
              other: 0,
              inspections: 3,
              daps: 2,
            },
          },
        })}
      />
    );

    expect(html).toContain("Hazard trend graph");
    expect(html).toContain("Jobsite risk graph");
    expect(html).toContain("Observation mix graph");
  });
});
