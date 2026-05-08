import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { authorizeRequest, getCompanyScope, blockIfCsepOnlyCompany, isAdminRole } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
  isAdminRole: vi.fn(),
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorizeRequest, isAdminRole };
});
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany }));

import { POST } from "./route";

function chain(result: unknown) {
  const api = {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };
  api.insert.mockReturnValue(api);
  api.update.mockReturnValue(api);
  api.select.mockReturnValue(api);
  api.eq.mockReturnValue(api);
  api.single.mockResolvedValue(result);
  return api;
}

describe("/api/company/auditflow/templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
  });

  it("blocks non-manager template creation", async () => {
    authorizeRequest.mockResolvedValue({
      role: "field_user",
      user: { id: "user-1" },
      supabase: {},
    });

    const response = requireRouteResponse(await POST(new Request("https://example.com/api/company/auditflow/templates", {
      method: "POST",
      body: JSON.stringify({ title: "Daily" }),
    })));

    expect(response.status).toBe(403);
  });

  it("creates a template and initial version", async () => {
    const templateInsert = chain({ data: { id: "template-1", title: "Daily" }, error: null });
    const versionInsert = chain({ data: { id: "version-1", version: 1 }, error: null });
    const templateUpdate = chain({ data: { id: "template-1", current_version_id: "version-1" }, error: null });
    let templateCalls = 0;
    const from = vi.fn((table: string) => {
      if (table === "company_auditflow_templates") {
        templateCalls += 1;
        return templateCalls === 1 ? templateInsert : templateUpdate;
      }
      if (table === "company_auditflow_template_versions") return versionInsert;
      return chain({ data: null, error: null });
    });
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      user: { id: "user-1" },
      supabase: { from },
    });

    const response = requireRouteResponse(await POST(new Request("https://example.com/api/company/auditflow/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Daily",
        schema: { sections: [{ title: "A", items: [{ label: "Item" }] }] },
      }),
    })));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(versionInsert.insert).toHaveBeenCalledWith(expect.objectContaining({ version: 1 }));
    expect(templateUpdate.update).toHaveBeenCalledWith(expect.objectContaining({ current_version_id: "version-1" }));
  });
});
