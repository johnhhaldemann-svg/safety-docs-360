import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
  isAdminRole: () => false,
}));

vi.mock("@/lib/companyScope", () => ({
  getCompanyScope: vi.fn(),
}));

vi.mock("@/lib/csepApiGuard", () => ({
  companyHasCsepPlanName: vi.fn(),
  csepWorkspaceForbiddenResponse: vi.fn(),
}));

vi.mock("@/lib/riskMemory/structuredContext", () => ({
  buildRiskMemoryStructuredContext: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/riskMemory/scoresRepo", () => ({
  loadCompanyRiskScoreTrend: vi.fn().mockResolvedValue([]),
  summarizeTrendDelta: vi.fn(() => ({
    latest: null,
    earliest: null,
    deltaScore: null,
    direction: null,
  })),
}));

import { GET } from "./route";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName } from "@/lib/csepApiGuard";

describe("/api/company/analytics/summary health issues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "sales_demo",
      team: "Demo",
      user: { id: "demo-user-1" },
      supabase: {},
    } as never);
  });

  it("returns rollup and no focus without injuryType", async () => {
    const res = await GET(new Request("http://localhost/api/company/analytics/summary?days=30"));
    expect(res).toBeDefined();
    if (!res) throw new Error("Missing response");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary.healthIssueRollup.length).toBeGreaterThan(0);
    expect(body.summary.healthIssueFocus).toBeNull();
  });

  it("returns focused health issue when injuryType is provided", async () => {
    const res = await GET(
      new Request("http://localhost/api/company/analytics/summary?days=30&injuryType=contusion")
    );
    expect(res).toBeDefined();
    if (!res) throw new Error("Missing response");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary.healthIssueFocus).toBeTruthy();
    expect(body.summary.healthIssueFocus.injuryType).toBe("contusion");
  });

  it("folds company SOR records into observation analytics", async () => {
    const ok = { data: [], error: null };
    const sorRows = [
      {
        id: "sor-1",
        date: new Date().toISOString().slice(0, 10),
        project: "Tower",
        location: "Level 2",
        category: "Electrical",
        hazard_category_code: "electrical",
        subcategory: null,
        description: "Open junction box at corridor",
        severity: "high",
        created_at: new Date().toISOString(),
        status: "submitted",
      },
      {
        id: "sor-2",
        date: new Date().toISOString().slice(0, 10),
        project: "Tower",
        location: "Level 4",
        category: "Near miss",
        hazard_category_code: null,
        subcategory: null,
        description: "Dropped material nearly struck worker",
        severity: "medium",
        created_at: new Date(Date.now() - 1000).toISOString(),
        status: "draft",
      },
    ];

    function builder(table: string) {
      const terminal =
        table === "companies"
          ? { data: { industry_code: null, industry_injury_rate: null, trade_injury_rate: null, hours_worked: null }, error: null }
          : table === "company_sor_records"
            ? { data: sorRows, error: null }
            : ok;
      const b = {
        select: vi.fn(),
        eq: vi.fn(),
        neq: vi.fn(),
        gte: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        maybeSingle: vi.fn(),
        then: vi.fn(),
      };
      b.select.mockReturnValue(b);
      b.eq.mockReturnValue(b);
      b.neq.mockReturnValue(b);
      b.gte.mockReturnValue(b);
      b.order.mockReturnValue(b);
      b.limit.mockReturnValue(b);
      b.maybeSingle.mockResolvedValue(terminal);
      b.then.mockImplementation((onFulfilled: (value: unknown) => unknown) => Promise.resolve(terminal).then(onFulfilled));
      return b;
    }

    const from = vi.fn((table: string) => builder(table));
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "company_admin",
      team: "Ops",
      user: { id: "u1" },
      supabase: { from },
    } as never);
    vi.mocked(getCompanyScope).mockResolvedValue({ companyId: "co1" } as never);
    vi.mocked(companyHasCsepPlanName).mockResolvedValue(false);

    const res = (await GET(new Request("http://localhost/api/company/analytics/summary?days=30")))!;
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.summary.totals.correctiveActions).toBe(2);
    expect(body.summary.injuryAnalytics.sorCount).toBe(2);
    expect(body.summary.companyDashboard.totalOpenObservations).toBe(2);
    expect(body.summary.companyDashboard.totalHighRiskObservations).toBe(1);
    expect(body.summary.observationBreakdown.hazard).toBe(1);
    expect(body.summary.observationBreakdown.nearMiss).toBe(1);
    expect(body.summary.riskHeatmap.cells[1][3]).toBe(1);
    expect(body.summary.riskHeatmap.cells[2][3]).toBe(1);
    expect(body.summary.recentReports.map((r: { id: string }) => r.id)).toContain("sor-1");
  });
});
