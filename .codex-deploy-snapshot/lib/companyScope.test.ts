import { describe, expect, it } from "vitest";
import { getCompanyScope } from "@/lib/companyScope";

function createCompanyScopeClient(params: {
  roleRow?: { company_id?: string | null; team?: string | null } | null;
  membershipRow?: {
    company_id?: string | null;
    companies?: { id?: string | null; name?: string | null } | null;
  } | null;
  companyNameById?: Record<string, string>;
}) {
  return {
    from(table: string) {
      if (table === "user_roles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: params.roleRow ?? null,
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }

      if (table === "company_memberships") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: params.membershipRow ?? null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          upsert: async () => ({ error: null }),
        };
      }

      if (table === "companies") {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data: params.companyNameById?.[value]
                  ? { id: value, name: params.companyNameById[value] }
                  : null,
                error: null,
              }),
            }),
          }),
          upsert: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("getCompanyScope canonical cutover", () => {
  it("prefers user_roles company scope", async () => {
    const scope = await getCompanyScope({
      supabase: createCompanyScopeClient({
        roleRow: { company_id: "COMPANY-1", team: "Role Team" },
        companyNameById: { "COMPANY-1": "Canonical Co" },
      }),
      userId: "user-1",
      fallbackTeam: "Fallback",
    });

    expect(scope).toEqual({
      companyId: "company-1",
      companyName: "Canonical Co",
      source: "role_row",
    });
  });

  it("falls back to active company membership when user_roles has no company", async () => {
    const scope = await getCompanyScope({
      supabase: createCompanyScopeClient({
        roleRow: { company_id: null, team: "Role Team" },
        membershipRow: {
          company_id: "company-2",
          companies: { id: "company-2", name: "Membership Co" },
        },
      }),
      userId: "user-2",
      fallbackTeam: "Fallback",
    });

    expect(scope).toEqual({
      companyId: "company-2",
      companyName: "Membership Co",
      source: "membership",
    });
  });

  it("does not grant company scope from auth metadata alone", async () => {
    const scope = await getCompanyScope({
      supabase: createCompanyScopeClient({
        roleRow: null,
        membershipRow: null,
        companyNameById: { "company-from-metadata": "Metadata Co" },
      }),
      userId: "user-3",
      fallbackTeam: "Fallback",
      authUser: {
        app_metadata: { company_id: "company-from-metadata" },
        user_metadata: { company_id: "company-from-metadata" },
      },
    });

    expect(scope).toEqual({
      companyId: null,
      companyName: "Fallback",
      source: "team_fallback",
    });
  });
});
