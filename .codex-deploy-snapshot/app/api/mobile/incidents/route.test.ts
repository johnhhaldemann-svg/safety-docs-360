import { requireRouteResponse } from "@/lib/routeResponseTest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeRequest, getCompanyScope, blockIfCsepOnlyCompany, getJobsiteAccessScope, requireMobileFeature } =
  vi.hoisted(() => ({
    authorizeRequest: vi.fn(),
    getCompanyScope: vi.fn(),
    blockIfCsepOnlyCompany: vi.fn(),
    getJobsiteAccessScope: vi.fn(),
    requireMobileFeature: vi.fn(),
  }));

vi.mock("@/lib/rbac", () => ({ authorizeRequest }));
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

describe("/api/mobile/incidents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    requireMobileFeature.mockResolvedValue(null);
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "foreman",
      team: null,
      permissionMap: { can_create_documents: true, can_access_field_work: true },
      supabase: {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects incident reports outside restricted jobsite scope", async () => {
    getJobsiteAccessScope.mockResolvedValue({ restricted: true, jobsiteIds: ["jobsite-allowed"] });

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/mobile/incidents", {
          method: "POST",
          body: JSON.stringify({ title: "Near miss", category: "near_miss", jobsiteId: "other-jobsite" }),
        })
      )
    );

    expect(response.status).toBe(403);
  });

  it("forwards incident reports to safety submissions for review", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        submissionId: "submission-1",
        actionId: "action-1",
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/mobile/incidents", {
          method: "POST",
          headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Near miss", category: "near_miss", jobsiteId: "jobsite-1" }),
        })
      )
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("/api/company/safety-submissions", "https://example.com/api/mobile/incidents"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"category":"near_miss"'),
      })
    );
    const payload = (await response.json()) as { message?: string };
    expect(payload.message).toContain("manager or safety admin");
  });
});
