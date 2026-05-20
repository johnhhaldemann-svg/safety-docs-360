import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  authorizeRequest,
  blockIfCsepOnlyCompany,
  getCompanyScope,
  getJobsiteAccessScope,
  isJobsiteAllowed,
  validateCompanyAssignableUserId,
  upsertRiskMemoryFacetSafe,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
  getCompanyScope: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn(),
  validateCompanyAssignableUserId: vi.fn(),
  upsertRiskMemoryFacetSafe: vi.fn(),
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
  upsertRiskMemoryFacetSafe,
}));
vi.mock("@/lib/demoWorkspace", () => ({ demoWorkspaceSummary: { observations: [] } }));
vi.mock("@/lib/offlineDesktopSession", () => ({ OFFLINE_DEMO_EMAIL: "offline@example.com" }));

import { POST } from "./route";

describe("/api/company/corrective-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      user: { id: "admin-1", email: "admin@example.com" },
      team: "Builder Co",
      supabase: { from: vi.fn() },
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

  it("rejects non-user assignees before creating a corrective action", async () => {
    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/company/corrective-actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Assign training follow-up",
            jobsiteId: "site-1",
            severity: "medium",
            category: "corrective_action",
            observationType: "negative",
            sifPotential: false,
            assignedUserId: "tracked:employee-1",
          }),
        })
      )
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toMatch(/active company user/);
    expect(upsertRiskMemoryFacetSafe).not.toHaveBeenCalled();
  });
});
