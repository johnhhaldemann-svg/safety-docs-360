import { requireRouteResponse } from "@/lib/routeResponseTest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  authorizeRequest,
  isCompanyWorkspaceOversightRole,
  getCompanyScope,
  uuidMatches,
  blockIfCsepOnlyCompany,
  getJobsiteAccessScope,
  isJobsiteAllowed,
  listMarketplaceDocumentPurchases,
  purchasedMarketplaceDocumentIds,
  formatSafetyBlueprintDocumentType,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  isCompanyWorkspaceOversightRole: vi.fn(),
  getCompanyScope: vi.fn(),
  uuidMatches: vi.fn((left: string | null | undefined, right: string | null | undefined) => left === right),
  blockIfCsepOnlyCompany: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn(),
  listMarketplaceDocumentPurchases: vi.fn(),
  purchasedMarketplaceDocumentIds: vi.fn(),
  formatSafetyBlueprintDocumentType: vi.fn((value: string) => value),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest, isCompanyWorkspaceOversightRole }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope, uuidMatches }));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany }));
vi.mock("@/lib/jobsiteAccess", () => ({ getJobsiteAccessScope, isJobsiteAllowed }));
vi.mock("@/lib/marketplaceDocumentPurchases", () => ({
  listMarketplaceDocumentPurchases,
  purchasedMarketplaceDocumentIds,
}));
vi.mock("@/lib/safetyBlueprintLabels", () => ({ formatSafetyBlueprintDocumentType }));

import { GET } from "./route";

describe("/api/company/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCompanyWorkspaceOversightRole.mockReturnValue(true);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    isJobsiteAllowed.mockReturnValue(true);
    listMarketplaceDocumentPurchases.mockResolvedValue({ data: [], error: null });
    purchasedMarketplaceDocumentIds.mockReturnValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    authorizeRequest.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as never);

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/search?q=permit"))
    );
    expect(response.status).toBe(401);
  });

  it("blocks CSEP-only companies", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "company_admin",
      team: null,
      supabase: {},
    });
    blockIfCsepOnlyCompany.mockResolvedValue(
      NextResponse.json({ error: "CSEP-only workspace." }, { status: 403 })
    );

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/search?q=permit"))
    );
    expect(response.status).toBe(403);
  });

  it("rejects a jobsite filter outside the user's scope", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: {},
    });
    getJobsiteAccessScope.mockResolvedValue({ restricted: true, jobsiteIds: ["jobsite-1"] });
    isJobsiteAllowed.mockReturnValue(false);

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/search?q=permit&jobsiteId=jobsite-2"))
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "You can only search assigned jobsites." });
  });

  it("returns normalized sales demo results without hitting Supabase", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "demo-user" },
      role: "sales_demo",
      team: null,
      supabase: {},
    });

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/search?q=guardrail"))
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      results: Array<{ type: string; title: string; sourceTable: string; matchedFields: string[] }>;
      facets: { total: number; typeCounts: Record<string, number>; query: string };
    };
    expect(body.facets).toMatchObject({
      total: 1,
      typeCounts: { field_issue: 1 },
      query: "guardrail",
    });
    expect(body.results[0]).toMatchObject({
      type: "field_issue",
      title: "Open leading-edge observation",
      sourceTable: "company_sor_records",
      matchedFields: ["Description"],
    });
  });
});
