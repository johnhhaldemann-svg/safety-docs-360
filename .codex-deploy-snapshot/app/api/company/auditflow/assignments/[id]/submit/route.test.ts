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

function builder(result: unknown) {
  const api = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  api.select.mockReturnValue(api);
  api.eq.mockReturnValue(api);
  api.maybeSingle.mockResolvedValue(result);
  return api;
}

describe("/api/company/auditflow/assignments/[id]/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    isJobsiteAllowed.mockReturnValue(true);
  });

  it("returns validation errors for an incomplete submission", async () => {
    const assignment = builder({
      data: {
        id: "assignment-1",
        template_id: "template-1",
        template_version_id: "version-1",
        assigned_user_id: "user-1",
        jobsite_id: null,
        status: "assigned",
      },
      error: null,
    });
    const version = builder({
      data: {
        id: "version-1",
        schema: { sections: [{ id: "s", title: "S", items: [{ id: "i", label: "I" }] }] },
      },
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "company_auditflow_assignments") return assignment;
      if (table === "company_auditflow_template_versions") return version;
      return builder({ data: null, error: null });
    });
    authorizeRequest.mockResolvedValue({
      role: "field_user",
      user: { id: "user-1" },
      supabase: { from },
    });

    const response = requireRouteResponse(await POST(new Request("https://example.com/api/company/auditflow/assignments/assignment-1/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: {}, signatureText: "" }),
    }), { params: Promise.resolve({ id: "assignment-1" }) }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.errors).toContain("Signature is required.");
    expect(json.errors.some((error: string) => error.includes("must be scored"))).toBe(true);
  });
});
