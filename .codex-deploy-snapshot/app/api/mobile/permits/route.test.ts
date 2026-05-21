import { requireRouteResponse } from "@/lib/routeResponseTest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authorizeRequest,
  isAdminRole,
  getCompanyScope,
  blockIfCsepOnlyCompany,
  getJobsiteAccessScope,
  requireMobileFeature,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  isAdminRole: vi.fn(),
  getCompanyScope: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  requireMobileFeature: vi.fn(),
}));

vi.mock("@/app/api/company/permits/route", () => ({
  GET: vi.fn(() => Response.json({ permits: [] })),
}));
vi.mock("@/lib/rbac", () => ({ authorizeRequest, isAdminRole }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany }));
vi.mock("@/lib/mobileFeatureGate", () => ({ requireMobileFeature }));
vi.mock("@/lib/jobsiteAccess", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobsiteAccess")>();
  return {
    ...actual,
    getJobsiteAccessScope,
  };
});

import { POST } from "./route";

function buildSupabase() {
  const jobsiteQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "jobsite-1", status: "active" }, error: null }),
  };
  const permitQuery = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: "permit-1", status: "draft", jobsite_id: "jobsite-1" },
      error: null,
    }),
  };
  const eventsQuery = {
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    client: {
      from: vi.fn((table: string) => {
        if (table === "company_jobsites") return jobsiteQuery;
        if (table === "company_permits") return permitQuery;
        if (table === "company_risk_events") return eventsQuery;
        return {};
      }),
    },
    permitQuery,
  };
}

describe("/api/mobile/permits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    requireMobileFeature.mockResolvedValue(null);
  });

  it("rejects roles that cannot submit mobile permit requests", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: {},
    });

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/mobile/permits", {
          method: "POST",
          body: JSON.stringify({ title: "Hot work", permitType: "hot_work", jobsiteId: "jobsite-1" }),
        })
      )
    );

    expect(response.status).toBe(403);
  });

  it("returns 403 when the mobile permit feature is disabled", async () => {
    const { client } = buildSupabase();
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "foreman",
      team: null,
      permissionMap: { can_create_documents: true, can_access_field_work: true },
      supabase: client,
    });
    requireMobileFeature.mockResolvedValue(Response.json({ error: "Mobile feature is not enabled for this account." }, { status: 403 }));

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/mobile/permits", {
          method: "POST",
          body: JSON.stringify({ title: "Hot work", permitType: "hot_work", jobsiteId: "jobsite-1" }),
        })
      )
    );

    expect(response.status).toBe(403);
  });

  it("rejects permit requests outside restricted jobsite scope", async () => {
    const { client } = buildSupabase();
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "foreman",
      team: null,
      permissionMap: { can_create_documents: true, can_access_field_work: true },
      supabase: client,
    });
    getJobsiteAccessScope.mockResolvedValue({ restricted: true, jobsiteIds: ["jobsite-allowed"] });

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/mobile/permits", {
          method: "POST",
          body: JSON.stringify({ title: "Hot work", permitType: "hot_work", jobsiteId: "jobsite-other" }),
        })
      )
    );

    expect(response.status).toBe(403);
  });

  it("creates a draft permit request for field supervisors", async () => {
    const { client, permitQuery } = buildSupabase();
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "field_supervisor",
      team: null,
      permissionMap: { can_create_documents: true, can_access_field_work: true },
      supabase: client,
    });

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/mobile/permits", {
          method: "POST",
          body: JSON.stringify({ title: "Hot work", permitType: "hot_work", jobsiteId: "jobsite-1", severity: "high" }),
        })
      )
    );

    expect(response.status).toBe(200);
    expect(permitQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        title: "Hot work",
        permit_type: "hot_work",
        jobsite_id: "jobsite-1",
      })
    );
  });
});
