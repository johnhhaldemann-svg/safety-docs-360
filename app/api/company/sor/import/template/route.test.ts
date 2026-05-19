import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";
import { SOR_IMPORT_TEMPLATE_COLUMNS } from "@/lib/sor/importTemplate";
import { GET } from "./route";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(async () => ({
    role: "company_admin",
    permissionMap: {
      can_create_documents: true,
      can_submit_documents: true,
      can_view_all_company_data: false,
      can_view_reports: true,
    },
  })),
}));

describe("/api/company/sor/import/template", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the SOR CSV import template", async () => {
    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/sor/import/template"))
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("sor-import-template.csv");

    const text = await response.text();
    expect(text).toContain(SOR_IMPORT_TEMPLATE_COLUMNS.join(","));
    expect(text).toContain("falls_elevation");
    expect(text).toContain(",high,draft,");
  });
});
