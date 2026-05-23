import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
  isAdminRole: vi.fn((role: string) => role === "admin" || role === "superadmin"),
}));

vi.mock("@/lib/companyScope", () => ({
  getCompanyScope: vi.fn(),
}));

vi.mock("@/lib/csepApiGuard", () => ({
  blockIfCsepOnlyCompany: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: vi.fn(() => null),
}));

import { POST } from "./route";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

function queryBuilder<T>(result: { data?: T[]; error?: { message?: string | null } | null }) {
  const resolved = { data: result.data ?? [], error: result.error ?? null };
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(),
    then: vi.fn(),
    insertedRows: [] as Array<Record<string, unknown>>,
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.neq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.single.mockResolvedValue({ data: resolved.data[0] ?? null, error: resolved.error });
  builder.insert.mockImplementation((row: Record<string, unknown>) => {
    builder.insertedRows.push(row);
    return {
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "report-1",
            ...row,
            generated_at: row.generated_at ?? "2026-05-23T12:00:00.000Z",
          },
          error: null,
        }),
      })),
    };
  });
  builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(resolved).then(onFulfilled, onRejected)
  );
  return builder;
}

function supabaseFixture() {
  const builders = {
    company_corrective_actions: queryBuilder({
      data: [{ id: "ca-1", status: "open", category: "fall_protection", due_at: "2026-05-22T12:00:00.000Z", created_at: "2026-05-20T12:00:00.000Z", jobsite_id: "j1" }],
    }),
    company_incidents: queryBuilder({ data: [{ id: "inc-1", status: "open", category: "near_miss", severity: "high", created_at: "2026-05-22T12:00:00.000Z", jobsite_id: "j1" }] }),
    company_safety_submissions: queryBuilder({ data: [] }),
    company_permits: queryBuilder({ data: [] }),
    company_jsas: queryBuilder({ data: [] }),
    company_jsa_activities: queryBuilder({ data: [] }),
    company_sor_records: queryBuilder({ data: [] }),
    company_risk_ai_recommendations: queryBuilder({
      data: [
        {
          id: "rec-1",
          kind: "ai_safety_action",
          title: "Review fall protection plan",
          status: "field_used",
          priority: "high",
          created_at: "2026-05-20T12:00:00.000Z",
          due_at: "2026-05-23T12:00:00.000Z",
          field_used_at: "2026-05-21T12:00:00.000Z",
          target_module: "company_jobsite_schedule_items",
          target_href: "/analytics/predictive-model",
          jobsite_id: "j1",
          mitigation_state: "field_verified",
          risk_reduction_points: 6,
          evidence_summary: {
            aiSafetyAction: {
              category: "fall_protection",
              sourceWorkTitle: "Elevated deck work",
              recommendedControl: "Review fall protection plan before elevated work.",
              jobsiteId: "j1",
              trade: "Steel",
            },
          },
        },
      ],
    }),
    company_risk_recommendation_events: queryBuilder({
      data: [{ id: "event-1", recommendation_id: "rec-1", event_type: "field_verified", created_at: "2026-05-21T12:00:00.000Z" }],
    }),
    company_reports: queryBuilder({ data: [] }),
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

describe("POST /api/company/reports AI Engine summaries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T12:00:00.000Z"));
    vi.clearAllMocks();
    vi.mocked(getCompanyScope).mockResolvedValue({ companyId: "co1", companyName: "Acme Safety" } as never);
    vi.mocked(blockIfCsepOnlyCompany).mockResolvedValue(null as never);
  });

  it("generates and stores an AI Engine weekly executive summary", async () => {
    const supabase = supabaseFixture();
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "safety_manager",
      team: "Acme",
      user: { id: "u1" },
      supabase,
    } as never);

    const res = expectResponse(await POST(
      new Request("http://localhost/api/company/reports", {
        method: "POST",
        body: JSON.stringify({ reportType: "ai_engine_weekly_summary" }),
      })
    ));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(supabase.builders.company_reports.insertedRows[0]).toEqual(
      expect.objectContaining({
        report_type: "ai_engine_weekly_summary",
        source_module: "ai_engine_calibration",
        title: "AI Engine Weekly Executive Summary",
      })
    );
    expect(body.generatedReport.metrics.aiSafetyCalibration.summary.predictedHighRiskCount).toBe(1);
    expect(body.generatedReport.metrics.aiSafetyCalibration.actionOutcomes.fieldUsedCount).toBe(1);
    expect(body.generatedReport.metrics.aiExecutiveTrendSummary.headline).toContain("AI Engine calibration");
  });
});
