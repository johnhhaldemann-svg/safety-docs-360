import { requireRouteResponse } from "@/lib/routeResponseTest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeRequest, getCompanyScope, blockIfCsepOnlyCompany, getJobsiteAccessScope } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
}));

vi.mock("@/app/api/company/jsas/route", () => ({
  GET: vi.fn(() => Response.json({ jsas: [] })),
}));
vi.mock("@/lib/rbac", () => ({ authorizeRequest }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany }));
vi.mock("@/lib/jobsiteAccess", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobsiteAccess")>();
  return {
    ...actual,
    getJobsiteAccessScope,
  };
});

import { POST } from "./route";

function buildSupabase() {
  const jsaQuery = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: "jsa-1", status: "draft", jobsite_id: "jobsite-1" },
      error: null,
    }),
  };
  return {
    client: {
      from: vi.fn((table: string) => {
        if (table === "company_jsas") return jsaQuery;
        return {};
      }),
    },
    jsaQuery,
  };
}

describe("/api/mobile/jsa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
  });

  it("creates mobile JSAs as draft even when the client sends active", async () => {
    const { client, jsaQuery } = buildSupabase();
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "foreman",
      team: null,
      permissionMap: { can_create_documents: true, can_access_field_work: true },
      supabase: client,
    });

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/mobile/jsa", {
          method: "POST",
          body: JSON.stringify({
            title: "Hot work JSA",
            status: "active",
            severity: "high",
            jobsiteId: "jobsite-1",
          }),
        })
      )
    );

    expect(response.status).toBe(200);
    expect(jsaQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Hot work JSA",
        status: "draft",
        jobsite_id: "jobsite-1",
      })
    );
  });
});
