import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  authorizeRequest,
  getCompanyScope,
  canManageCompanyPermits,
  blockIfCsepOnlyCompany,
  getJobsiteAccessScope,
  isJobsiteAllowed,
  autoAssignSchedulePermits,
  createSupabaseAdminClient,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  canManageCompanyPermits: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn(),
  autoAssignSchedulePermits: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/companyFeatureAccess", () => ({ canManageCompanyPermits }));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany }));
vi.mock("@/lib/jobsiteAccess", () => ({ getJobsiteAccessScope, isJobsiteAllowed }));
vi.mock("@/lib/schedulePermitAutoAssignment", () => ({ autoAssignSchedulePermits }));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient }));
vi.mock("@/lib/companyWorkspaceDirectory", () => ({ loadCompanyWorkspaceUsers: vi.fn(async () => ({ users: [] })) }));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return new Request("https://example.com/api/company/jobsites/jobsite-1/schedule/permits/auto-assign", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/company/jobsites/[jobsiteId]/schedule/permits/auto-assign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeRequest.mockResolvedValue({
      role: "project_manager",
      permissionMap: {},
      team: null,
      user: { id: "user-1", email: "pm@example.com" },
      supabase: { from: vi.fn() },
    });
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "TJ Contracting" });
    canManageCompanyPermits.mockReturnValue(true);
    blockIfCsepOnlyCompany.mockResolvedValue(null);
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    isJobsiteAllowed.mockReturnValue(true);
    createSupabaseAdminClient.mockReturnValue(null);
    autoAssignSchedulePermits.mockResolvedValue({
      success: true,
      dryRun: true,
      scope: "daily",
      window: { startDate: "2026-05-19", endDate: "2026-05-19", days: 0 },
      createdPermits: [{ permitId: null }],
      skippedPermits: [],
      unassignedPermits: [],
      tasks: [],
    });
  });

  it("passes scope and dryRun through to the shared service", async () => {
    const response = requireRouteResponse(await POST(request({ scope: "daily", dryRun: true }), {
      params: Promise.resolve({ jobsiteId: "jobsite-1" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.createdPermits).toHaveLength(1);
    expect(autoAssignSchedulePermits).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        jobsiteId: "jobsite-1",
        scope: "daily",
        dryRun: true,
        actorUserId: "user-1",
      })
    );
  });

  it("rejects users who cannot manage permits", async () => {
    canManageCompanyPermits.mockReturnValue(false);

    const response = requireRouteResponse(await POST(request({ scope: "weekly" }), {
      params: Promise.resolve({ jobsiteId: "jobsite-1" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("field leaders");
    expect(autoAssignSchedulePermits).not.toHaveBeenCalled();
  });

  it("rejects invalid assignment scopes", async () => {
    const response = requireRouteResponse(await POST(request({ scope: "monthly" }), {
      params: Promise.resolve({ jobsiteId: "jobsite-1" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("scope must be daily or weekly.");
  });
});
