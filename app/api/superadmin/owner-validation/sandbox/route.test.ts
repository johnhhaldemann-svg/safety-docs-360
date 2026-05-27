import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  mockedAuthorize,
  mockedCreateAdmin,
  mockedLoadSandbox,
  mockedSeedSandbox,
} = vi.hoisted(() => ({
  mockedAuthorize: vi.fn(),
  mockedCreateAdmin: vi.fn(),
  mockedLoadSandbox: vi.fn(),
  mockedSeedSandbox: vi.fn(),
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
  seedSafety360TestCompany: mockedSeedSandbox,
}));

import { GET, POST } from "./route";

function authForRole(role: string) {
  return {
    role,
    supabase: { from: vi.fn() },
    user: { id: "user-1" },
  } as never;
}

describe("/api/superadmin/owner-validation/sandbox", () => {
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
    mockedSeedSandbox.mockResolvedValue({
      companyId: "company-1",
      companyName: "Safety360 Test Company",
      sandboxKey: "safety360-test-company",
      counts: { employees: 6 },
    });
  });

  it("rejects non-superadmin users", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("admin"));

    const response = requireRouteResponse(
      await POST(new Request("https://example.com/api/superadmin/owner-validation/sandbox", { method: "POST" }))
    );

    expect(response.status).toBe(403);
    expect(mockedSeedSandbox).not.toHaveBeenCalled();
  });

  it("loads the sandbox summary for super admins", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/owner-validation/sandbox"))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.companyName).toBe("Safety360 Test Company");
    expect(mockedLoadSandbox).toHaveBeenCalledWith(expect.any(Object));
  });

  it("seeds the sandbox company for super admins", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = requireRouteResponse(
      await POST(new Request("https://example.com/api/superadmin/owner-validation/sandbox", { method: "POST" }))
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.companyName).toBe("Safety360 Test Company");
    expect(mockedSeedSandbox).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      actorUserId: "user-1",
    });
  });
});
