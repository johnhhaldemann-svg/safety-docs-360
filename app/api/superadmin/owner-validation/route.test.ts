import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { mockedAuthorize, mockedCreateAdmin, mockedLoadOverview } = vi.hoisted(() => ({
  mockedAuthorize: vi.fn(),
  mockedCreateAdmin: vi.fn(),
  mockedLoadOverview: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: mockedAuthorize,
  normalizeAppRole: (role: string) => role,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: mockedCreateAdmin,
}));

vi.mock("@/lib/superadmin/ownerValidation", () => ({
  loadOwnerValidationOverview: mockedLoadOverview,
}));

import { GET } from "./route";

function authForRole(role: string) {
  return {
    role,
    supabase: { from: vi.fn() },
    user: { id: "user-1" },
  } as never;
}

describe("/api/superadmin/owner-validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateAdmin.mockReturnValue({ from: vi.fn() });
    mockedLoadOverview.mockResolvedValue({
      modules: [],
      recentRuns: [],
      manualReviewItems: [],
      customerReadyGates: [],
    });
  });

  it("returns auth errors from the RBAC layer", async () => {
    mockedAuthorize.mockResolvedValue({
      error: Response.json({ error: "Missing auth token." }, { status: 401 }),
    });

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/owner-validation"))
    );

    expect(response.status).toBe(401);
    expect(mockedLoadOverview).not.toHaveBeenCalled();
  });

  it("rejects non-superadmin users", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("admin"));

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/owner-validation"))
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("Super admin access required");
    expect(mockedLoadOverview).not.toHaveBeenCalled();
  });

  it("loads the owner validation overview for super admins", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/owner-validation"))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.modules).toEqual([]);
    expect(mockedAuthorize).toHaveBeenCalledWith(expect.any(Request), {
      requirePermission: "can_access_internal_admin",
      allowPending: true,
      allowSuspended: true,
    });
    expect(mockedLoadOverview).toHaveBeenCalledWith(expect.any(Object));
  });
});
