import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  authorizeRequest,
  isAdminRole,
  getCompanyScope,
  blockIfCsepOnlyCompany,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  isAdminRole: vi.fn(),
  getCompanyScope: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest, isAdminRole }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany }));

import { PATCH } from "./route";

type QueryResult = { data: unknown; error: { message: string } | null };

function makeSupabaseMock(tables: Record<string, QueryResult>) {
  return {
    from(table: string) {
      const base = tables[table] ?? { data: null, error: null };
      const query = {
        ...base,
        eq() {
          return query;
        },
        select() {
          return query;
        },
        maybeSingle() {
          return query;
        },
      };
      return {
        update() {
          return query;
        },
      };
    },
  };
}

describe("inductions programs [id] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("PATCH rejects non-admin-like role", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: makeSupabaseMock({}),
    });

    const response = await PATCH(
      new Request("https://example.com/api/company/inductions/programs/program-1", {
        method: "PATCH",
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ id: "program-1" }) }
    );
    expect(response.status).toBe(403);
  });

  it("PATCH returns 404 when program is missing", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "admin-1" },
      role: "company_admin",
      team: null,
      supabase: makeSupabaseMock({
        company_induction_programs: { data: null, error: null },
      }),
    });

    const response = await PATCH(
      new Request("https://example.com/api/company/inductions/programs/program-1", {
        method: "PATCH",
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ id: "program-1" }) }
    );
    expect(response.status).toBe(404);
  });

  it("PATCH updates program for admin role", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "admin-1" },
      role: "company_admin",
      team: null,
      supabase: makeSupabaseMock({
        company_induction_programs: {
          data: { id: "program-1", active: false, name: "Site Safety" },
          error: null,
        },
      }),
    });

    const response = await PATCH(
      new Request("https://example.com/api/company/inductions/programs/program-1", {
        method: "PATCH",
        body: JSON.stringify({ active: false, name: "Site Safety" }),
      }),
      { params: Promise.resolve({ id: "program-1" }) }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { program: { id: string; active: boolean } };
    expect(body.program.id).toBe("program-1");
    expect(body.program.active).toBe(false);
  });
});
