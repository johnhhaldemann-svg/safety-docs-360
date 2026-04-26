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

describe("inductions requirements route", () => {
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

  it("GET filters out non-allowed jobsite", async () => {
    isJobsiteAllowed.mockReturnValue(false);
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: makeSupabaseMock({
        company_induction_requirements: {
          data: [{ id: "r1", jobsite_id: "jobsite-1" }],
          error: null,
        },
      }),
    });

    const response = await GET(
      new Request("https://example.com/api/company/inductions/requirements?jobsiteId=jobsite-1")
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { requirements: unknown[] };
    expect(body.requirements).toEqual([]);
  });

  it("GET returns requirements when query is allowed", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: makeSupabaseMock({
        company_induction_requirements: {
          data: [
            { id: "r-global", jobsite_id: null },
            { id: "r-site", jobsite_id: "jobsite-1" },
            { id: "r-other", jobsite_id: "jobsite-2" },
          ],
          error: null,
        },
      }),
    });

    const response = await GET(
      new Request("https://example.com/api/company/inductions/requirements?jobsiteId=jobsite-1")
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { requirements: Array<{ id: string }> };
    expect(body.requirements.map((row) => row.id)).toEqual(["r-global", "r-site"]);
  });

  it("POST rejects non-admin-like role", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: makeSupabaseMock({}),
    });

    const response = await POST(
      new Request("https://example.com/api/company/inductions/requirements", {
        method: "POST",
        body: JSON.stringify({ programId: "p1" }),
      })
    );
    expect(response.status).toBe(403);
  });

  it("POST validates programId", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "admin-1" },
      role: "company_admin",
      team: null,
      supabase: makeSupabaseMock({}),
    });

    const response = await POST(
      new Request("https://example.com/api/company/inductions/requirements", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    expect(response.status).toBe(400);
  });

  it("POST rejects disallowed jobsite", async () => {
    isJobsiteAllowed.mockReturnValue(false);
    authorizeRequest.mockResolvedValue({
      user: { id: "admin-1" },
      role: "company_admin",
      team: null,
      supabase: makeSupabaseMock({}),
    });

    const response = await POST(
      new Request("https://example.com/api/company/inductions/requirements", {
        method: "POST",
        body: JSON.stringify({ programId: "p1", jobsiteId: "jobsite-1" }),
      })
    );
    expect(response.status).toBe(403);
  });

  it("POST creates requirement when program exists", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "admin-1" },
      role: "company_admin",
      team: null,
      supabase: makeSupabaseMock({
        company_induction_programs: { data: { id: "p1" }, error: null },
        company_induction_requirements: {
          data: { id: "r1", program_id: "p1", jobsite_id: "jobsite-1" },
          error: null,
        },
      }),
    });

    const response = await POST(
      new Request("https://example.com/api/company/inductions/requirements", {
        method: "POST",
        body: JSON.stringify({ programId: "p1", jobsiteId: "jobsite-1" }),
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { requirement: { id: string } };
    expect(body.requirement.id).toBe("r1");
  });
});
