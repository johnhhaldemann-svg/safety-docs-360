import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  authorizeRequest,
  getCompanyScope,
  blockIfCsepOnlyCompany,
  getJobsiteAccessScope,
  isJobsiteAllowed,
  isAdminRole,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn(),
  isAdminRole: vi.fn(),
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorizeRequest, isAdminRole };
});
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany }));
vi.mock("@/lib/jobsiteAccess", () => ({ getJobsiteAccessScope, isJobsiteAllowed }));

import { POST } from "./route";

describe("/api/company/auditflow/assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    isJobsiteAllowed.mockReturnValue(true);
  });

  it("returns 403 when a field user attempts to create an assignment", async () => {
    authorizeRequest.mockResolvedValue({
      role: "field_user",
      user: { id: "user-1" },
      supabase: {},
    });

    const response = requireRouteResponse(await POST(new Request("https://example.com/api/company/auditflow/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: "template-1" }),
    })));

    expect(response.status).toBe(403);
  });
});
