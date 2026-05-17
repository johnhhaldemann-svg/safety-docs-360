import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";
import { GET } from "./route";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(async () => ({
    role: "company_admin",
    permissionMap: {
      can_manage_company_users: true,
      can_view_all_company_data: false,
      can_view_analytics: true,
      can_access_training: true,
    },
  })),
}));

describe("/api/company/onboarding/import/template", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the employee CSV template", async () => {
    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/onboarding/import/template?type=employees"))
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(await response.text()).toContain("employee_id,full_name,email");
  });

  it("rejects unknown template types", async () => {
    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/onboarding/import/template?type=widgets"))
    );

    expect(response.status).toBe(400);
  });
});
