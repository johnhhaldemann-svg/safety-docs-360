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

import { GET } from "./route";

type QueryResult = { data: unknown; error: { message: string } | null };

function makeSupabaseMock(tables: Record<string, QueryResult>) {
  return {
    from(table: string) {
      const base = tables[table] ?? { data: [], error: null };
      const result = {
        ...base,
        eq() {
          return result;
        },
      };
      return {
        select() {
          return {
            eq() {
              return result;
            },
          };
        },
      };
    },
  };
}

describe("GET /api/company/inductions/evaluate", () => {
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

  it("returns 400 when jobsiteId is missing", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: makeSupabaseMock({}),
      permissionMap: {},
    });

    const response = await GET(new Request("https://example.com/api/company/inductions/evaluate"));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("jobsiteId");
  });

  it("returns 403 when jobsite is not allowed", async () => {
    isJobsiteAllowed.mockReturnValue(false);
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: makeSupabaseMock({}),
      permissionMap: {},
    });

    const response = await GET(
      new Request("https://example.com/api/company/inductions/evaluate?jobsiteId=jobsite-1")
    );
    expect(response.status).toBe(403);
  });

  it("returns blocked when required induction is missing", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: makeSupabaseMock({
        company_induction_programs: {
          data: [{ id: "p1", name: "Site Safety", audience: "worker", active: true }],
          error: null,
        },
        company_induction_requirements: {
          data: [
            {
              id: "r1",
              program_id: "p1",
              jobsite_id: "jobsite-1",
              active: true,
              effective_from: "2026-01-01",
              effective_to: null,
            },
          ],
          error: null,
        },
        company_induction_completions: { data: [], error: null },
      }),
      permissionMap: {},
    });

    const response = await GET(
      new Request("https://example.com/api/company/inductions/evaluate?jobsiteId=jobsite-1")
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; reasons: string[] };
    expect(body.status).toBe("blocked");
    expect(body.reasons[0]).toContain("Induction not completed");
  });

  it("returns eligible when completion is valid", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "user-1" },
      role: "worker",
      team: null,
      supabase: makeSupabaseMock({
        company_induction_programs: {
          data: [{ id: "p1", name: "Site Safety", audience: "worker", active: true }],
          error: null,
        },
        company_induction_requirements: {
          data: [
            {
              id: "r1",
              program_id: "p1",
              jobsite_id: "jobsite-1",
              active: true,
              effective_from: "2026-01-01",
              effective_to: null,
            },
          ],
          error: null,
        },
        company_induction_completions: {
          data: [
            {
              program_id: "p1",
              jobsite_id: "jobsite-1",
              user_id: "user-1",
              visitor_display_name: null,
              expires_at: "2099-01-01T00:00:00.000Z",
              completed_at: "2026-01-12T00:00:00.000Z",
            },
          ],
          error: null,
        },
      }),
      permissionMap: {},
    });

    const response = await GET(
      new Request("https://example.com/api/company/inductions/evaluate?jobsiteId=jobsite-1")
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; reasons: string[] };
    expect(body.status).toBe("eligible");
    expect(body.reasons).toHaveLength(0);
  });

  it("adds contractor expiry reason when evaluating with contractorId", async () => {
    authorizeRequest.mockResolvedValue({
      user: { id: "admin-user" },
      role: "company_admin",
      team: null,
      supabase: makeSupabaseMock({
        company_induction_programs: { data: [], error: null },
        company_induction_requirements: { data: [], error: null },
        company_induction_completions: { data: [], error: null },
        company_contractor_documents: {
          data: [
            {
              id: "d1",
              title: "COI",
              doc_type: "coi",
              expires_on: "2020-01-01",
            },
          ],
          error: null,
        },
      }),
      permissionMap: { can_view_all_company_data: true },
    });
    isAdminRole.mockReturnValue(true);

    const response = await GET(
      new Request(
        "https://example.com/api/company/inductions/evaluate?jobsiteId=jobsite-1&contractorId=contractor-1"
      )
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; reasons: string[] };
    expect(body.status).toBe("blocked");
    expect(body.reasons.some((reason) => reason.includes("Contractor document expired"))).toBe(true);
  });
});
