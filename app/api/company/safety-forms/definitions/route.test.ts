import { requireRouteResponse } from "@/lib/routeResponseTest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { authorizeRequest, isAdminRole, getCompanyScope, blockIfCsepOnlyCompany } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  isAdminRole: vi.fn(),
  getCompanyScope: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest, isAdminRole }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany }));

import { GET, POST } from "./route";

describe("/api/company/safety-forms/definitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 401 when unauthorized", async () => {
    authorizeRequest.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as never);

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/safety-forms/definitions"))
    );
    expect(response.status).toBe(401);
  });

  it("POST returns 403 when role cannot manage form definitions", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "field_supervisor",
      team: null,
      supabase: {},
    });

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/company/safety-forms/definitions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Near-miss" }),
        })
      )
    );
    expect(response.status).toBe(403);
  });

  it("POST returns 400 when title is missing", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "company_admin",
      team: null,
      supabase: {},
    });

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/company/safety-forms/definitions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "  " }),
        })
      )
    );
    expect(response.status).toBe(400);
  });
});
