import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  mockedAuthorize,
  mockedCreateAdmin,
  mockedLoadSandbox,
  mockedBuildPreviewRoles,
} = vi.hoisted(() => ({
  mockedAuthorize: vi.fn(),
  mockedCreateAdmin: vi.fn(),
  mockedLoadSandbox: vi.fn(),
  mockedBuildPreviewRoles: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: mockedAuthorize,
  normalizeAppRole: (role: string) => role,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: mockedCreateAdmin,
}));

vi.mock("@/lib/superadmin/ownerValidation", () => ({
  loadOwnerValidationOverview: vi.fn(),
}));

vi.mock("@/lib/superadmin/ownerValidationSandbox", () => ({
  loadSafety360TestCompanySummary: mockedLoadSandbox,
}));

vi.mock("@/lib/superadmin/ownerValidationPreview", () => ({
  buildOwnerValidationPreviewRoles: mockedBuildPreviewRoles,
}));

import { GET } from "./route";

function authForRole(role: string) {
  return {
    role,
    supabase: { from: vi.fn() },
    user: { id: "user-1" },
  } as never;
}

describe("/api/superadmin/owner-validation/preview-roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateAdmin.mockReturnValue({ from: vi.fn() });
    mockedLoadSandbox.mockResolvedValue({
      exists: true,
      companyId: "company-1",
      companyName: "Safety360 Test Company",
      sandboxKey: "safety360-test-company",
      records: [],
    });
    mockedBuildPreviewRoles.mockReturnValue([
      {
        id: "company_admin",
        label: "Company Admin",
        permissions: [],
      },
    ]);
  });

  it("rejects non-superadmin users", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("admin"));

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/owner-validation/preview-roles"))
    );

    expect(response.status).toBe(403);
    expect(mockedBuildPreviewRoles).not.toHaveBeenCalled();
  });

  it("returns sandbox preview roles for super admins", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/owner-validation/preview-roles"))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sandbox.companyName).toBe("Safety360 Test Company");
    expect(body.roles[0].label).toBe("Company Admin");
    expect(body.note).toContain("read-only");
    expect(mockedLoadSandbox).toHaveBeenCalledWith(expect.any(Object));
  });
});
