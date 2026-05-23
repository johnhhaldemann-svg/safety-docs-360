import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
  isAdminRole: vi.fn((role: string) => role === "admin" || role === "superadmin"),
}));

vi.mock("@/lib/companyScope", () => ({
  getCompanyScope: vi.fn(),
}));

vi.mock("@/lib/csepApiGuard", () => ({
  companyHasCsepPlanName: vi.fn(),
  csepWorkspaceForbiddenResponse: vi.fn(() => NextResponse.json({ error: "csep" }, { status: 403 })),
}));

vi.mock("@/lib/riskMemory/structuredContext", () => ({
  buildRiskMemoryStructuredContext: vi.fn(),
}));

vi.mock("@/lib/riskMemory/scoresRepo", () => ({
  loadCompanyRiskScoreTrend: vi.fn(),
  summarizeTrendDelta: vi.fn(() => ({ latest: null, earliest: null, deltaScore: null, direction: null })),
}));

import { GET } from "./route";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName } from "@/lib/csepApiGuard";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { loadCompanyRiskScoreTrend } from "@/lib/riskMemory/scoresRepo";

function queryBuilder<T>(result: { data?: T[]; singleData?: T | null; error?: { message?: string | null } | null }) {
  const resolved = { data: result.data ?? [], error: result.error ?? null };
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    gte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.neq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue({ data: result.singleData ?? null, error: result.error ?? null });
  builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(resolved).then(onFulfilled, onRejected)
  );
  return builder;
}

function supabaseFixture() {
  const builders = {
    companies: queryBuilder({ singleData: { industry_code: null, industry_injury_rate: null, trade_injury_rate: null, hours_worked: null } }),
    company_analytics_snapshots: queryBuilder({ data: [] }),
    company_corrective_actions: queryBuilder({ data: [] }),
    company_incidents: queryBuilder({ data: [] }),
    company_permits: queryBuilder({ data: [] }),
    company_jsas: queryBuilder({ data: [] }),
    company_jsa_activities: queryBuilder({ data: [] }),
    company_jobsites: queryBuilder({ data: [{ id: "j1", status: "active" }] }),
    company_sor_records: queryBuilder({ data: [] }),
    company_risk_ai_recommendations: queryBuilder({
      data: [
        {
          id: "rec-1",
          kind: "ai_safety_action",
          title: "Verify excavation review",
          body: "Review trench entry controls.",
          confidence: "high",
          status: "field_used",
          priority: "critical",
          created_at: "2026-05-22T12:00:00.000Z",
          due_at: "2026-05-23T12:00:00.000Z",
          field_used_at: "2026-05-22T14:00:00.000Z",
          target_module: "company_jobsite_schedule_items",
          target_href: "/analytics/predictive-model",
          jobsite_id: "j1",
          mitigation_state: "field_verified",
          risk_reduction_points: 7,
          evidence_summary: {
            aiSafetyAction: {
              category: "excavation",
              sourceWorkTitle: "Trench entry",
              recommendedControl: "Verify competent person inspection before trench entry.",
              jobsiteId: "j1",
              trade: "Civil",
            },
          },
        },
      ],
    }),
    company_risk_recommendation_events: queryBuilder({
      data: [{ id: "event-1", recommendation_id: "rec-1", event_type: "field_verified", created_at: "2026-05-22T14:00:00.000Z" }],
    }),
  };
  return {
    from: vi.fn((table: string) => builders[table as keyof typeof builders]),
    builders,
  };
}

function expectResponse(res: Response | undefined) {
  if (!res) throw new Error("missing response");
  return res;
}

describe("GET /api/company/analytics/summary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T12:00:00.000Z"));
    vi.clearAllMocks();
    vi.mocked(companyHasCsepPlanName).mockResolvedValue(false);
    vi.mocked(getCompanyScope).mockResolvedValue({ companyId: "co1", companyName: "Acme Safety" } as never);
    vi.mocked(buildRiskMemoryStructuredContext).mockResolvedValue(null as never);
    vi.mocked(loadCompanyRiskScoreTrend).mockResolvedValue([]);
  });

  it("includes AI Safety calibration and executive trend summary", async () => {
    const supabase = supabaseFixture();
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "safety_manager",
      team: "Acme",
      user: { id: "u1" },
      supabase,
    } as never);

    const res = expectResponse(await GET(new Request("http://localhost/api/company/analytics/summary?days=7")));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary.aiSafetyCalibration.summary.predictedHighRiskCount).toBe(1);
    expect(body.summary.aiSafetyCalibration.actionOutcomes.fieldUsedCount).toBe(1);
    expect(body.summary.aiSafetyCalibration.actionOutcomes.riskReductionPoints).toBe(7);
    expect(body.summary.aiExecutiveTrendSummary.headline).toContain("AI Engine calibration");
  });
});
