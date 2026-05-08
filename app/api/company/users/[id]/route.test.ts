import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  authorizeRequest,
  createSupabaseAdminClient,
  getCompanyScope,
  getUserRoleContext,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getCompanyScope: vi.fn(),
  getUserRoleContext: vi.fn(),
}));

vi.mock("@/lib/companyScope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/companyScope")>("@/lib/companyScope");
  return { ...actual, getCompanyScope };
});

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient,
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorizeRequest, getUserRoleContext };
});

import { PATCH } from "./route";

describe("/api/company/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
    getUserRoleContext.mockResolvedValue({ role: "company_user" });
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      team: "Builder Co",
      user: { id: "admin-1", email: "admin@example.com" },
      supabase: {},
    });
  });

  it("preserves suspended status in company memberships when access is suspended", async () => {
    const userRoleUpsert = vi.fn().mockResolvedValue({ error: null });
    const membershipUpsert = vi.fn().mockResolvedValue({ error: null });
    const targetRoleLookup = vi.fn().mockResolvedValue({
      data: {
        user_id: "target-1",
        role: "field_user",
        team: "Builder Co",
        company_id: "company-1",
        account_status: "active",
      },
      error: null,
    });

    const adminClient = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { id: "target-1", email: "worker@example.com" } },
            error: null,
          }),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "user_roles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: targetRoleLookup,
              })),
            })),
            upsert: userRoleUpsert,
          };
        }

        if (table === "company_memberships") {
          return {
            upsert: membershipUpsert,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };
    createSupabaseAdminClient.mockReturnValue(adminClient);

    const response = requireRouteResponse(
      await PATCH(
        new Request("https://example.com/api/company/users/target-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "Field User", accountStatus: "Suspended" }),
        }),
        { params: Promise.resolve({ id: "target-1" }) }
      )
    );

    expect(response.status).toBe(200);
    expect(userRoleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "target-1",
        account_status: "suspended",
      }),
      { onConflict: "user_id" }
    );
    expect(membershipUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "target-1",
        company_id: "company-1",
        status: "suspended",
      }),
      { onConflict: "user_id,company_id" }
    );
  });
});
