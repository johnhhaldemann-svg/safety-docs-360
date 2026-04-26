import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  authorizeRequest,
  isAdminRole,
  getCompanyScope,
  blockIfCsepOnlyCompany,
  getJobsiteAccessScope,
  isJobsiteAllowed,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  isAdminRole: vi.fn(),
  getCompanyScope: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest, isAdminRole }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany }));
vi.mock("@/lib/jobsiteAccess", () => ({ getJobsiteAccessScope, isJobsiteAllowed }));

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
        or() {
          return query;
        },
        order() {
          return query;
        },
        maybeSingle() {
          return query;
        },
        select() {
          return query;
        },
        single() {
          return query;
        },
        insert(payload?: unknown) {
          if (table === "company_induction_completions" && payload) {
            return {
              select() {
                return {
                  single() {
                    return query;
                  },
                };
              },
            };
          }
          return query;
        },
      };
      return query;
    },
  };
}

describe("inductions completions route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    isJobsiteAllowed.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GET blocks viewing other users without elevated permissions", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: makeSupabaseMock({}),
      permissionMap: {},
    });

    const response = await GET(
      new Request("https://example.com/api/company/inductions/completions?userId=user-2")
    );
    expect(response.status).toBe(403);
  });

  it("GET returns completions for self", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: makeSupabaseMock({
        company_induction_completions: {
          data: [{ id: "c1", user_id: "user-1", program_id: "p1" }],
          error: null,
        },
      }),
      permissionMap: {},
    });

    const response = await GET(new Request("https://example.com/api/company/inductions/completions"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { completions: Array<{ id: string }> };
    expect(body.completions).toHaveLength(1);
    expect(body.completions[0].id).toBe("c1");
  });

  it("POST rejects non-allowed roles", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: makeSupabaseMock({}),
      permissionMap: { can_create_documents: true },
    });

    const response = await POST(
      new Request("https://example.com/api/company/inductions/completions", {
        method: "POST",
        body: JSON.stringify({ programId: "p1", userId: "user-1" }),
      })
    );
    expect(response.status).toBe(403);
  });

  it("POST rejects assigning completion to another user without permission", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "field_supervisor",
      team: null,
      supabase: makeSupabaseMock({}),
      permissionMap: { can_create_documents: true },
    });

    const response = await POST(
      new Request("https://example.com/api/company/inductions/completions", {
        method: "POST",
        body: JSON.stringify({ programId: "p1", userId: "user-2" }),
      })
    );
    expect(response.status).toBe(403);
  });

  it("POST rejects disallowed jobsite", async () => {
    isJobsiteAllowed.mockReturnValue(false);
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "field_supervisor",
      team: null,
      supabase: makeSupabaseMock({}),
      permissionMap: { can_create_documents: true },
    });

    const response = await POST(
      new Request("https://example.com/api/company/inductions/completions", {
        method: "POST",
        body: JSON.stringify({ programId: "p1", userId: "user-1", jobsiteId: "jobsite-1" }),
      })
    );
    expect(response.status).toBe(403);
  });

  it("POST records completion and returns created row", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "field_supervisor",
      team: null,
      supabase: makeSupabaseMock({
        company_induction_programs: { data: { id: "p1" }, error: null },
        company_induction_completions: {
          data: { id: "completion-1", user_id: "user-1", program_id: "p1" },
          error: null,
        },
        company_risk_events: { data: null, error: null },
      }),
      permissionMap: { can_create_documents: true },
    });

    const response = await POST(
      new Request("https://example.com/api/company/inductions/completions", {
        method: "POST",
        body: JSON.stringify({ programId: "p1", userId: "user-1", jobsiteId: "jobsite-1" }),
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { completion: { id: string } };
    expect(body.completion.id).toBe("completion-1");
  });
});
