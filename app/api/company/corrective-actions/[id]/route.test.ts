import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  authorizeRequest,
  blockIfCsepOnlyCompany,
  getCompanyScope,
  getJobsiteAccessScope,
  isJobsiteAllowed,
  validateCompanyAssignableUserId,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
  getCompanyScope: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn(),
  validateCompanyAssignableUserId: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest,
  isAdminRole: (role: string) => role === "admin" || role === "super_admin" || role === "platform_admin",
}));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/jobsiteAccess", () => ({ getJobsiteAccessScope, isJobsiteAllowed }));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany }));
vi.mock("@/lib/companyAssignableUsers", () => ({ validateCompanyAssignableUserId }));
vi.mock("@/lib/riskMemory/facets", () => ({
  buildCorrectiveActionFacetRow: vi.fn(() => ({})),
  upsertRiskMemoryFacetSafe: vi.fn(),
}));
vi.mock("@/lib/offlineDesktopSession", () => ({ OFFLINE_DEMO_EMAIL: "offline@example.com" }));

import { PATCH } from "./route";

function makeSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "action-1",
                status: "open",
                category: "corrective_action",
                severity: "medium",
                observation_type: "negative",
                sif_potential: false,
                sif_category: null,
                jobsite_id: "site-1",
              },
              error: null,
            }),
          })),
        })),
      })),
    })),
  };
}

describe("/api/company/corrective-actions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      user: { id: "admin-1", email: "admin@example.com" },
      team: "Builder Co",
      supabase: makeSupabase(),
    });
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    isJobsiteAllowed.mockReturnValue(true);
    validateCompanyAssignableUserId.mockResolvedValue({
      assignedUserId: null,
      error: "Assignee must be an active company user, not a tracked employee, invite, or free-text assignee.",
    });
  });

  it("rejects non-user assignees before updating a corrective action", async () => {
    const response = requireRouteResponse(
      await PATCH(
        new Request("https://example.com/api/company/corrective-actions/action-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Assign training follow-up",
            assignedUserId: "tracked:employee-1",
          }),
        }),
        { params: Promise.resolve({ id: "action-1" }) }
      )
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toMatch(/active company user/);
  });
});
