import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
}));

vi.mock("@/lib/companyScope", () => ({
  getCompanyScope: vi.fn(),
}));

vi.mock("@/lib/csepApiGuard", () => ({
  companyHasCsepPlanName: vi.fn(),
  csepWorkspaceForbiddenResponse: vi.fn(),
}));

vi.mock("@/lib/jobsiteAccess", () => ({
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn(),
}));

import { POST } from "./route";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/predictive/behavior-risk", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function supabaseWithTables(tables: Record<string, unknown[]>) {
  return {
    from: vi.fn((table: string) => {
      const terminal = { data: tables[table] ?? [], error: null };
      const builder = {
        select: vi.fn(),
        eq: vi.fn(),
        in: vi.fn(),
        neq: vi.fn(),
        gte: vi.fn(),
        then: vi.fn(),
      };
      builder.select.mockReturnValue(builder);
      builder.eq.mockReturnValue(builder);
      builder.in.mockReturnValue(builder);
      builder.neq.mockReturnValue(builder);
      builder.gte.mockReturnValue(builder);
      builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown) => Promise.resolve(terminal).then(onFulfilled));
      return builder;
    }),
  };
}

function mockAuthorized(tables: Record<string, unknown[]> = {}) {
  vi.mocked(authorizeRequest).mockResolvedValue({
    role: "company_admin",
    team: "Ops",
    user: { id: "user-1" },
    supabase: supabaseWithTables(tables),
  } as never);
  vi.mocked(getCompanyScope).mockResolvedValue({ companyId: "co1" } as never);
  vi.mocked(companyHasCsepPlanName).mockResolvedValue(false);
  vi.mocked(getJobsiteAccessScope).mockResolvedValue({ restricted: false, jobsiteIds: [] } as never);
  vi.mocked(isJobsiteAllowed).mockReturnValue(true);
}

describe("/api/predictive/behavior-risk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthorized requests", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as never);

    const response = await POST(request({ projectId: "co1" }));
    if (!response) throw new Error("Missing response");
    expect(response.status).toBe(401);
  });

  it("rejects projectId values outside the authenticated company", async () => {
    mockAuthorized();

    const response = await POST(request({ projectId: "other-company" }));
    if (!response) throw new Error("Missing response");
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("projectId");
  });

  it("returns low behavior risk for empty company data", async () => {
    mockAuthorized();

    const response = await POST(request({ projectId: "co1", lookAheadDays: 7 }));
    if (!response) throw new Error("Missing response");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.behaviorRiskScore).toBe(0);
    expect(body.riskLevel).toBe("Low");
    expect(body.sourceEvents).toEqual([]);
  });

  it("returns high-risk driver evidence for weak planned work controls", async () => {
    mockAuthorized({
      company_jsa_activities: [
        {
          id: "jsa-1",
          jobsite_id: "site-1",
          work_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          trade: "Steel",
          activity_name: "Leading edge steel erection",
          area: "Level 5",
          crew_size: 9,
          hazard_category: "fall_protection",
          mitigation: "Use PPE and be careful.",
          permit_required: true,
          permit_type: "Hot Work Permit",
          planned_risk_level: "high",
          status: "planned",
          created_at: new Date().toISOString(),
        },
      ],
      company_permits: [],
      company_corrective_actions: [
        {
          id: "ca-1",
          category: "fall_protection",
          status: "open",
          due_at: new Date(Date.now() - 86400000).toISOString(),
          created_at: new Date().toISOString(),
        },
      ],
      company_incidents: [
        {
          id: "inc-1",
          jobsite_id: "site-1",
          category: "fall_protection",
          title: "Near miss fall protection",
          created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        },
      ],
    });

    const response = await POST(request({ projectId: "co1", lookAheadDays: 7 }));
    if (!response) throw new Error("Missing response");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.behaviorRiskScore).toBeGreaterThanOrEqual(61);
    expect(body.topDrivers.map((driver: { driver: string }) => driver.driver)).toContain("weak_jsa_language");
    expect(body.topDrivers.map((driver: { driver: string }) => driver.driver)).toContain("permit_mismatch");
    expect(body.recommendedActions).toContain("Field verification required before risky work begins.");
  });
});
