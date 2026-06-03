import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  authorizeRequest,
  createSupabaseAdminClient,
  getUserRoleContext,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getUserRoleContext: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient,
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorizeRequest, getUserRoleContext };
});

import { PATCH, POST } from "./route";

describe("/api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeRequest.mockResolvedValue({
      role: "super_admin",
      team: "General",
      user: { id: "admin-1", email: "admin@example.com" },
      supabase: {},
    });
    getUserRoleContext.mockResolvedValue({
      role: "safety_manager",
      team: "TJ Contracting",
      companyId: "company-1",
      accountStatus: "pending",
    });
  });

  it("syncs expanded company roles into company memberships", async () => {
    const userRoleUpsert = vi.fn().mockResolvedValue({ error: null });
    const membershipDelete = vi.fn().mockResolvedValue({ error: null });
    const membershipUpsert = vi.fn().mockResolvedValue({ error: null });

    const adminClient = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: {
              user: { id: "target-1", email: "worker@example.com" },
            },
            error: null,
          }),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "user_roles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    company_id: "company-1",
                    permission_overrides: null,
                  },
                  error: null,
                }),
              })),
            })),
            upsert: userRoleUpsert,
          };
        }

        if (table === "companies") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "company-1", name: "TJ Contracting" },
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "company_memberships") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { company_id: "company-1" },
                  error: null,
                }),
              })),
            })),
            delete: vi.fn(() => ({
              eq: membershipDelete,
            })),
            upsert: membershipUpsert,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };
    createSupabaseAdminClient.mockReturnValue(adminClient);

    const response = requireRouteResponse(
      await PATCH(
        new Request("https://example.com/api/admin/users/target-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "Safety Manager",
            team: "TJ Contracting",
            accountStatus: "Active",
          }),
        }),
        { params: Promise.resolve({ id: "target-1" }) }
      )
    );

    expect(response.status).toBe(200);
    expect(userRoleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "target-1",
        role: "safety_manager",
        company_id: "company-1",
        account_status: "active",
      }),
      { onConflict: "user_id" }
    );
    expect(membershipUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "target-1",
        company_id: "company-1",
        role: "safety_manager",
        status: "active",
      }),
      { onConflict: "user_id,company_id" }
    );
  });

  it("returns a friendly message when the membership role constraint is stale", async () => {
    const adminClient = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: {
              user: { id: "target-1", email: "worker@example.com" },
            },
            error: null,
          }),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "user_roles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    company_id: "company-1",
                    permission_overrides: null,
                  },
                  error: null,
                }),
              })),
            })),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }

        if (table === "companies") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "company-1", name: "TJ Contracting" },
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "company_memberships") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { company_id: "company-1" },
                  error: null,
                }),
              })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            })),
            upsert: vi.fn().mockResolvedValue({
              error: {
                message:
                  'new row for relation "company_memberships" violates check constraint "company_memberships_role_check"',
              },
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };
    createSupabaseAdminClient.mockReturnValue(adminClient);

    const response = requireRouteResponse(
      await PATCH(
        new Request("https://example.com/api/admin/users/target-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "Safety Manager",
            team: "TJ Contracting",
            accountStatus: "Active",
          }),
        }),
        { params: Promise.resolve({ id: "target-1" }) }
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toContain("membership role constraint");
    expect(payload.error).not.toContain("new row for relation");
  });

  it("sets a company user's password without writing the password to the audit event", async () => {
    const updateUserById = vi.fn().mockResolvedValue({ data: { user: { id: "target-1" } }, error: null });
    const securityInsert = vi.fn().mockResolvedValue({ error: null });

    const adminClient = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: {
              user: { id: "target-1", email: "worker@example.com" },
            },
            error: null,
          }),
          updateUserById,
        },
      },
      from: vi.fn((table: string) => {
        if (table === "user_roles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { company_id: "company-1" },
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "company_security_events") {
          return {
            insert: securityInsert,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };
    createSupabaseAdminClient.mockReturnValue(adminClient);

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/admin/users/target-1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "set_password",
            password: "Temporary123!",
          }),
        }),
        { params: Promise.resolve({ id: "target-1" }) }
      )
    );

    expect(response.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith("target-1", {
      password: "Temporary123!",
      email_confirm: true,
    });
    expect(securityInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "company-1",
        event_type: "user_access_updated",
        resource_type: "company_user",
        resource_id: "target-1",
        metadata: {
          action: "set_password",
          targetEmail: "worker@example.com",
        },
      })
    );
    expect(JSON.stringify(securityInsert.mock.calls)).not.toContain("Temporary123!");
  });

  it("rejects short admin-set passwords", async () => {
    const updateUserById = vi.fn();
    const adminClient = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: {
              user: { id: "target-1", email: "worker@example.com" },
            },
            error: null,
          }),
          updateUserById,
        },
      },
    };
    createSupabaseAdminClient.mockReturnValue(adminClient);

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/admin/users/target-1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "set_password",
            password: "short",
          }),
        }),
        { params: Promise.resolve({ id: "target-1" }) }
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("at least 12 characters");
    expect(updateUserById).not.toHaveBeenCalled();
  });
});
