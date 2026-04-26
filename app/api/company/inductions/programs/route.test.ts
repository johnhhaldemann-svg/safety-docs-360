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

import { GET, POST } from "./route";

type QueryResult = { data: unknown; error: { message: string } | null };

function makeSupabaseMock(tables: Record<string, QueryResult>) {
  return {
    from(table: string) {
      const base = tables[table] ?? { data: [], error: null };
      const query = {
        ...base,
        eq() {
          return query;
        },
        order() {
          return query;
        },
        select() {
          return query;
        },
        single() {
          return query;
        },
        insert() {
          return {
            select() {
              return {
                single() {
                  return query;
                },
              };
            },
          };
        },
      };
      return query;
    },
  };
}

describe("inductions programs route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns empty list when workspace has no company", async () => {
    getCompanyScope.mockResolvedValue({ companyId: null });
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: makeSupabaseMock({}),
    });

    const response = await GET(new Request("https://example.com/api/company/inductions/programs"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { programs: unknown[] };
    expect(body.programs).toEqual([]);
  });

  it("GET returns warning when induction tables are missing", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: makeSupabaseMock({
        company_induction_programs: {
          data: null,
          error: { message: 'relation "company_induction_programs" does not exist' },
        },
      }),
    });

    const response = await GET(new Request("https://example.com/api/company/inductions/programs"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { programs: unknown[]; warning?: string };
    expect(body.programs).toEqual([]);
    expect(body.warning).toContain("not migrated");
  });

  it("POST rejects non-admin-like role", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: makeSupabaseMock({}),
    });

    const response = await POST(
      new Request("https://example.com/api/company/inductions/programs", {
        method: "POST",
        body: JSON.stringify({ name: "Orientation" }),
      })
    );
    expect(response.status).toBe(403);
  });

  it("POST validates required name", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "admin-1" },
      role: "company_admin",
      team: null,
      supabase: makeSupabaseMock({}),
    });

    const response = await POST(
      new Request("https://example.com/api/company/inductions/programs", {
        method: "POST",
        body: JSON.stringify({ name: "  " }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("POST creates a program for admin role", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "admin-1" },
      role: "company_admin",
      team: null,
      supabase: makeSupabaseMock({
        company_induction_programs: {
          data: { id: "program-1", name: "Site Orientation", audience: "worker", active: true },
          error: null,
        },
      }),
    });

    const response = await POST(
      new Request("https://example.com/api/company/inductions/programs", {
        method: "POST",
        body: JSON.stringify({ name: "Site Orientation", audience: "worker" }),
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { program: { id: string } };
    expect(body.program.id).toBe("program-1");
  });
});
