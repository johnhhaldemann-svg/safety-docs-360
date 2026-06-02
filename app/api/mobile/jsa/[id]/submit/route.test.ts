import { requireRouteResponse } from "@/lib/routeResponseTest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeRequest, getCompanyScope, blockIfCsepOnlyCompany, getJobsiteAccessScope } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
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

function queryBuilder(singleResult: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(singleResult),
    single: vi.fn().mockResolvedValue(singleResult),
  };
}

function buildSupabase(updateResults: unknown[]) {
  const existingQuery = queryBuilder({ data: { id: "jsa-1", jobsite_id: "jobsite-1" }, error: null });
  const updateQueries = updateResults.map(queryBuilder);
  let jsaCallCount = 0;
  return {
    client: {
      from: vi.fn((table: string) => {
        if (table !== "company_jsas") return {};
        jsaCallCount += 1;
        return jsaCallCount === 1 ? existingQuery : updateQueries.shift() ?? existingQuery;
      }),
    },
  };
}

describe("/api/mobile/jsa/[id]/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
  });

  it("submits a mobile JSA for admin review", async () => {
    const { client } = buildSupabase([
      { data: { id: "jsa-1", status: "pending_review" }, error: null },
    ]);
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "foreman",
      team: null,
      permissionMap: { can_create_documents: true, can_access_field_work: true },
      supabase: client,
    });

    const response = requireRouteResponse(
      await POST(new Request("https://example.com/api/mobile/jsa/jsa-1/submit", { method: "POST" }), {
        params: Promise.resolve({ id: "jsa-1" }),
      })
    );
    const payload = (await response.json()) as { reviewStatus?: string };

    expect(response.status).toBe(200);
    expect(payload.reviewStatus).toBe("pending_review");
  });

  it("falls back to active when the workspace has the legacy JSA status constraint", async () => {
    const { client } = buildSupabase([
      {
        data: null,
        error: {
          message:
            'new row for relation "company_jsas" violates check constraint "company_jsas_status_check" for pending_review',
        },
      },
      { data: { id: "jsa-1", status: "active" }, error: null },
    ]);
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "foreman",
      team: null,
      permissionMap: { can_create_documents: true, can_access_field_work: true },
      supabase: client,
    });

    const response = requireRouteResponse(
      await POST(new Request("https://example.com/api/mobile/jsa/jsa-1/submit", { method: "POST" }), {
        params: Promise.resolve({ id: "jsa-1" }),
      })
    );
    const payload = (await response.json()) as { reviewStatus?: string; message?: string };

    expect(response.status).toBe(200);
    expect(payload.reviewStatus).toBe("active");
    expect(payload.message).toContain("legacy active status");
  });
});
