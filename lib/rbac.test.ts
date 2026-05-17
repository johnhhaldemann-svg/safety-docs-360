import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: () => null,
  getSupabaseAnonKey: () => "anon-key",
  getSupabaseServerUrl: () => "https://example.supabase.co",
  getSupabaseServiceRoleKey: () => "service-role-key",
}));

import {
  formatAppRole,
  getUserRoleContext,
  getPermissionMap,
  isCompanyRole,
  normalizeAppRole,
} from "@/lib/rbac";

type RoleRow = {
  user_id: string;
  role: string;
  team: string | null;
  company_id: string | null;
  account_status: string | null;
  permission_overrides?: unknown;
} | null;

function createRbacClient(params: {
  roleRow?: RoleRow;
  roleError?: { message?: string | null } | null;
  companyPermissionOverrides?: unknown;
}) {
  const upsert = vi.fn(async () => ({ error: null }));

  return {
    upsert,
    client: {
      from(table: string) {
        if (table === "user_roles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: params.roleRow ?? null,
                  error: params.roleError ?? null,
                }),
              }),
            }),
            upsert,
          };
        }

        if (table === "companies") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { permission_overrides: params.companyPermissionOverrides ?? null },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "company_subscriptions") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: null,
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    },
  };
}

describe("sales_demo role", () => {
  it("normalizes and formats the role label", () => {
    expect(normalizeAppRole("sales_demo")).toBe("sales_demo");
    expect(normalizeAppRole("Sales Demo")).toBe("sales_demo");
    expect(formatAppRole("sales_demo")).toBe("Sales Demo");
  });

  it("keeps sales demo as an internal role", () => {
    expect(isCompanyRole("sales_demo")).toBe(false);
  });

  it("grants company showcase permissions without internal admin powers", () => {
    const permissionMap = getPermissionMap("sales_demo");

    expect(permissionMap.can_view_dashboards).toBe(true);
    expect(permissionMap.can_view_reports).toBe(true);
    expect(permissionMap.can_access_internal_admin).toBe(false);
    expect(permissionMap.can_manage_users).toBe(false);
    expect(permissionMap.can_manage_global_templates).toBe(false);
    expect(permissionMap.can_override_system_controls).toBe(false);
    expect(permissionMap.can_manage_company_users).toBe(true);
    expect(permissionMap.can_manage_billing).toBe(true);
    expect(permissionMap.can_create_documents).toBe(true);
    expect(permissionMap.can_edit_documents).toBe(true);
    expect(permissionMap.can_submit_documents).toBe(true);
    expect(permissionMap.can_manage_daps).toBe(true);
    expect(permissionMap.can_manage_observations).toBe(true);
    expect(permissionMap.can_access_document_library).toBe(true);
    expect(permissionMap.can_access_jobsites).toBe(true);
    expect(permissionMap.can_access_field_work).toBe(true);
    expect(permissionMap.can_access_training).toBe(true);
    expect(permissionMap.can_access_safety_intelligence).toBe(true);
    expect(permissionMap.can_access_billing).toBe(true);
  });
});

describe("getUserRoleContext canonical cutover", () => {
  it("uses canonical user_roles even when auth metadata disagrees", async () => {
    const { client } = createRbacClient({
      roleRow: {
        user_id: "user-1",
        role: "company_user",
        team: "Field Team",
        company_id: "company-1",
        account_status: "active",
        permission_overrides: null,
      },
    });

    const context = await getUserRoleContext({
      supabase: client,
      user: {
        id: "user-1",
        email: "person@example.com",
        app_metadata: { role: "super_admin", company_id: "wrong-company" },
        user_metadata: { role: "super_admin" },
      },
    });

    expect(context.role).toBe("company_user");
    expect(context.companyId).toBe("company-1");
    expect(context.team).toBe("Field Team");
    expect(context.permissionMap.can_access_internal_admin).toBe(false);
    expect(context.source).toBe("table");
  });

  it("does not grant access from legacy auth metadata when no canonical row exists", async () => {
    const { client } = createRbacClient({ roleRow: null });

    const context = await getUserRoleContext({
      supabase: client,
      user: {
        id: "user-2",
        email: "metadata-admin@example.com",
        app_metadata: {
          role: "super_admin",
          team: "Internal",
          company_id: "company-1",
          account_status: "active",
        },
      },
    });

    expect(context.role).toBe("viewer");
    expect(context.companyId).toBeNull();
    expect(context.team).toBe("General");
    expect(context.permissionMap.can_access_internal_admin).toBe(false);
    expect(context.source).toBe("canonical_missing");
  });

  it("keeps the bootstrap admin override as emergency access", async () => {
    const { client, upsert } = createRbacClient({ roleRow: null });

    const context = await getUserRoleContext({
      supabase: client,
      user: {
        id: "bootstrap-user",
        email: "john.h.haldemann@gmail.com",
      },
    });

    expect(context.role).toBe("super_admin");
    expect(context.companyId).toBeNull();
    expect(context.permissionMap.can_access_internal_admin).toBe(true);
    expect(context.source).toBe("bootstrap_admin_override");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "bootstrap-user",
        role: "super_admin",
        company_id: null,
      }),
      { onConflict: "user_id" }
    );
  });
});
