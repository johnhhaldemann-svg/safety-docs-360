import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeRequest = vi.fn();

vi.mock("@/lib/rbac", () => ({
  authorizeRequest,
  normalizeAppRole: (role: string) => role,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: () => null,
}));

describe("/api/superadmin/health/score", () => {
  beforeEach(() => {
    authorizeRequest.mockReset();
  });

  it("rejects non-superadmin users", async () => {
    authorizeRequest.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      role: "admin",
      team: "General",
      accountStatus: "active",
      permissions: ["can_access_internal_admin"],
      permissionMap: { can_access_internal_admin: true },
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com/api/superadmin/health/score"));
    expect(response).toBeDefined();
    if (!response) throw new Error("Expected a response.");
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Super admin access required." });
  });
});
