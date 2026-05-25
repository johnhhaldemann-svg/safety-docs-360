import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
  isAdminRole: vi.fn((role: string) => role === "superadmin" || role === "admin"),
}));

vi.mock("@/lib/companyScope", () => ({
  getCompanyScope: vi.fn(),
}));

vi.mock("@/lib/csepApiGuard", () => ({
  companyHasCsepPlanName: vi.fn(),
  csepWorkspaceForbiddenResponse: vi.fn(() => NextResponse.json({ error: "csep" }, { status: 403 })),
}));

vi.mock("@/lib/jobsiteAccess", () => ({
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn((jobsiteId: string | null, scope: { restricted: boolean; jobsiteIds: string[] }) => {
    if (!scope.restricted) return true;
    return Boolean(jobsiteId && scope.jobsiteIds.includes(jobsiteId));
  }),
}));

vi.mock("@/lib/injuryWeather/service", () => ({
  getInjuryWeatherDashboardData: vi.fn(),
}));

import { POST } from "./route";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope } from "@/lib/jobsiteAccess";
import { getInjuryWeatherDashboardData } from "@/lib/injuryWeather/service";
import type { InjuryWeatherDashboardData } from "@/lib/injuryWeather/types";

function forecastFixture(): InjuryWeatherDashboardData {
  return {
    summary: {
      month: "May 2026",
      riskSignalCount: 4,
      highSeveritySignalCount: 2,
      predictedInjuriesNextMonth: 2,
      increasedIncidentRiskPercent: 64,
      overallRiskLevel: "HIGH",
      structuralRiskScore: 64,
      riskModelVersion: "test-model",
      predictedRisk: 64,
      predictedRiskFactors: {
        historicalBaseline: 1,
        seasonalFactor: 1,
        realTimeBehaviorFactor: 1,
        scheduleExposureFactor: 1,
        siteConditionFactor: 1,
        weatherFactor: 1,
      },
      dataConfidence: "HIGH",
      forecastMode: "live_adjusted",
      forecastConfidenceScore: 0.75,
      lastUpdatedAt: "2026-05-23T12:00:00.000Z",
      likelyInjuryInsight: { headline: "Risk", secondaryLine: null, detailNote: "Fixture", hasData: true },
    },
    tradeForecasts: [{ trade: "General", categories: [{ name: "Fall protection", predictedCount: 3, riskLevel: "HIGH" }] }],
    alerts: [],
    trend: [{ month: "May 23", value: 64 }],
    recommendedControls: ["Verify controls."],
    monthlyTrainingRecommendations: [],
    availableMonths: ["May 2026"],
    availableTrades: ["General"],
    location: { stateCode: "TX", displayName: "Texas", weatherRiskMultiplier: 1, impactNote: "Fixture" },
    signalProvenance: {
      mode: "live",
      sorRecords: 0,
      correctiveActions: 1,
      incidents: 1,
      recordWindowLabel: "Fixture",
      alertsAreIllustrative: true,
    },
    behaviorSignals: { fatigueIndicators: 0, rushingIndicators: 0, newWorkerRatio: 0, overtimeHours: 0 },
    workSchedule: { workSevenDaysPerWeek: false, hoursPerDay: null },
    industryBenchmarkContext: {
      injuryFactsIndustryProfilesUrl: "",
      injuryFactsIncidentTrendsUrl: "",
      dominantNaicsPrefix: null,
      exampleIndustryCode: null,
      recordableCasesPer200kHours: null,
      benchmarkSummary: "Fixture",
      oshaNationalConstruction: undefined as never,
    },
    monthlyFocus: [],
    engineDiagnostics: { seedOnlyMode: false, liveSignalRowCount: 2 },
  };
}

function queryBuilder<T>(result: { data?: T[]; error?: { message?: string | null } | null }) {
  const resolved = { data: result.data ?? [], error: result.error ?? null };
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    insert: vi.fn(),
    then: vi.fn(),
    insertedRows: [] as Array<Record<string, unknown>>,
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.neq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.gte.mockResolvedValue(resolved);
  builder.insert.mockImplementation((rows: Array<Record<string, unknown>> | Record<string, unknown>) => {
    const list = Array.isArray(rows) ? rows : [rows];
    builder.insertedRows.push(...list);
    return {
      select: vi.fn().mockResolvedValue({
        data: list.map((row, index) => ({
          id: `rec-${builder.insertedRows.length - list.length + index + 1}`,
          title: row.title,
          status: row.status,
          priority: row.priority,
          action_type: row.action_type,
          due_at: row.due_at,
          target_module: row.target_module,
          target_href: row.target_href,
          verification_required: row.verification_required,
          mitigation_state: row.mitigation_state,
          risk_reduction_points: row.risk_reduction_points,
          evidence_summary: row.evidence_summary,
        })),
        error: null,
      }),
    };
  });
  builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(resolved).then(onFulfilled, onRejected)
  );
  return builder;
}

function supabaseFixture(overrides?: Record<string, ReturnType<typeof queryBuilder>>) {
  const builders = {
    company_jobsites: queryBuilder({ data: [{ id: "j1", name: "North Tower", location: "Austin", status: "active" }] }),
    company_corrective_actions: queryBuilder({ data: [] }),
    company_incidents: queryBuilder({ data: [] }),
    company_permits: queryBuilder({ data: [] }),
    company_jsa_activities: queryBuilder({ data: [] }),
    company_jobsite_schedule_items: queryBuilder({
      data: [
        {
          id: "s1",
          jobsite_id: "j1",
          title: "Critical lift over active access route",
          work_start_date: "2026-05-23",
          work_end_date: "2026-05-23",
          trade: "Steel",
          risk_level: "critical",
          is_high_risk: true,
          permit_triggers: ["lift plan"],
          status: "planned",
        },
      ],
    }),
    company_sor_records: queryBuilder({ data: [] }),
    company_jobsite_audit_observations: queryBuilder({ data: [] }),
    company_risk_ai_recommendations: queryBuilder({ data: [] }),
    company_employee_training_records: queryBuilder({ data: [] }),
    weather_alert_events: queryBuilder({ data: [] }),
    company_memory_items: queryBuilder({ data: [] }),
    company_risk_recommendation_events: queryBuilder({ data: [] }),
    ...overrides,
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

describe("POST /api/company/ai/safety-action-queue/sync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T12:00:00.000Z"));
    vi.clearAllMocks();
    vi.mocked(companyHasCsepPlanName).mockResolvedValue(false);
    vi.mocked(getJobsiteAccessScope).mockResolvedValue({ restricted: false, jobsiteIds: [] });
    vi.mocked(getInjuryWeatherDashboardData).mockResolvedValue(forecastFixture());
    vi.mocked(getCompanyScope).mockResolvedValue({ companyId: "co1", companyName: "Ops" } as never);
  });

  it("inserts non-duplicate queue actions and writes created events", async () => {
    const supabase = supabaseFixture();
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "safety_manager",
      team: "Ops",
      user: { id: "u1" },
      supabase,
    } as never);

    const res = expectResponse(await POST(new Request("http://localhost/api/company/ai/safety-action-queue/sync", {
      method: "POST",
      body: JSON.stringify({ days: 7, jobsiteId: "j1" }),
    })));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.insertedCount).toBeGreaterThan(0);
    expect(supabase.builders.company_risk_ai_recommendations.insertedRows[0]).toEqual(
      expect.objectContaining({
        kind: "ai_safety_action",
        priority: "critical",
        action_type: expect.stringMatching(/request_permit|stop_work_review/),
        verification_required: true,
        mitigation_state: "unverified",
      }),
    );
    expect(supabase.builders.company_risk_ai_recommendations.insertedRows[0]?.evidence_summary).toEqual(
      expect.objectContaining({
        aiSafetyAction: expect.objectContaining({
          sourceKey: expect.stringContaining("ai-safety-action:"),
          approvalState: "review_required",
        }),
      }),
    );
    expect(supabase.builders.company_risk_recommendation_events.insertedRows[0]).toEqual(
      expect.objectContaining({
        event_type: "created",
        to_status: expect.any(String),
        metadata: expect.objectContaining({ workflowStep: "ai_safety_action_queue_sync" }),
      }),
    );
  });

  it("skips duplicate active queue actions by source key", async () => {
    const existingKey = "ai-safety-action:missing_permit:j1:schedule-s1:permit-missing-active-permit-or-authorization-s1:2026-05-23";
    const recommendations = queryBuilder({
      data: [
        {
          id: "rec-existing",
          status: "active",
          evidence_summary: { aiSafetyAction: { sourceKey: existingKey } },
        },
      ],
    });
    const supabase = supabaseFixture({ company_risk_ai_recommendations: recommendations });
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "safety_manager",
      team: "Ops",
      user: { id: "u1" },
      supabase,
    } as never);

    const res = expectResponse(await POST(new Request("http://localhost/api/company/ai/safety-action-queue/sync", {
      method: "POST",
      body: JSON.stringify({ days: 7, jobsiteId: "j1" }),
    })));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.existingActionCount).toBe(1);
    expect(body.skippedDuplicateCount).toBeGreaterThan(0);
    const insertedSourceKeys = recommendations.insertedRows.map((row) => {
      const summary = row.evidence_summary as { aiSafetyAction?: { sourceKey?: string } } | undefined;
      return summary?.aiSafetyAction?.sourceKey;
    });
    expect(insertedSourceKeys).not.toContain(existingKey);
  });

  it("persists field-evidence review actions without hiding critical evidence", async () => {
    const recommendations = queryBuilder({
      data: [
        {
          id: "field-1",
          jobsite_id: "j1",
          title: "Field evidence review - critical roof edge",
          body: "Photo review needs field verification.",
          confidence: 0.86,
          status: "active",
          priority: "critical",
          mitigation_state: "unverified",
          risk_reduction_points: 0,
          created_at: "2026-05-23T12:00:00.000Z",
          evidence_summary: {
            gusPhotoReview: {
              source: "gus_photo_review",
              sourceKey: "gus-photo-review:co1:j1:u1:critical",
              riskLevel: "critical",
              concerns: ["Roof edge fall exposure"],
              criticalFlags: ["Possible unprotected edge"],
              missingInformation: ["Exact location"],
              recommendedControls: ["Verify fall protection plan and edge protection"],
              nextActions: ["Have the supervisor verify the roof edge in the field."],
              limitations: ["Photo angle does not show full work area."],
              jobsiteId: "j1",
              userNote: "Check roof edge.",
              needsFieldVerification: true,
            },
          },
        },
      ],
    });
    const supabase = supabaseFixture({
      company_risk_ai_recommendations: recommendations,
      company_jobsite_schedule_items: queryBuilder({
        data: [
          {
            id: "roof-edge",
            jobsite_id: "j1",
            title: "Roof edge layout",
            work_start_date: "2026-05-23",
            work_end_date: "2026-05-23",
            trade: "Roofing",
            work_area: "Roof edge",
            risk_level: "high",
            is_high_risk: true,
            status: "planned",
          },
        ],
      }),
    });
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "safety_manager",
      team: "Ops",
      user: { id: "u1" },
      supabase,
    } as never);

    const res = expectResponse(await POST(new Request("http://localhost/api/company/ai/safety-action-queue/sync", {
      method: "POST",
      body: JSON.stringify({ days: 7, jobsiteId: "j1" }),
    })));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actionQueue.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "field_evidence_review",
          riskLevel: "critical",
          humanApprovalRequired: true,
        }),
      ]),
    );
    expect(recommendations.insertedRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ai_safety_action",
          action_type: "stop_work_review",
          evidence_summary: expect.objectContaining({
            aiSafetyAction: expect.objectContaining({ category: "field_evidence_review" }),
          }),
        }),
      ]),
    );
  });
});
