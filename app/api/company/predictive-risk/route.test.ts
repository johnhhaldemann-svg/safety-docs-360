import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
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

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: vi.fn(() => null),
}));

import { GET } from "./route";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope } from "@/lib/jobsiteAccess";
import { getInjuryWeatherDashboardData } from "@/lib/injuryWeather/service";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
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
      lastUpdatedAt: "2026-05-01T12:00:00.000Z",
      likelyInjuryInsight: { headline: "Risk", secondaryLine: null, detailNote: "Fixture", hasData: true },
    },
    tradeForecasts: [{ trade: "General", categories: [{ name: "Fall protection", predictedCount: 3, riskLevel: "HIGH" }] }],
    alerts: [],
    trend: [{ month: "May 1", value: 64 }],
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
    then: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.neq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.gte.mockResolvedValue(resolved);
  builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(resolved).then(onFulfilled, onRejected)
  );
  return builder;
}

function supabaseFixture(overrides?: Record<string, ReturnType<typeof queryBuilder>>) {
  const builders = {
    company_jobsites: queryBuilder({
      data: [{ id: "j1", name: "North Building", location: "Austin", status: "active" }],
    }),
    company_corrective_actions: queryBuilder({
      data: [
        {
          id: "a1",
          title: "Guardrail gap",
          category: "fall_protection",
          severity: "high",
          status: "open",
          due_at: new Date(Date.now() - 86400000).toISOString(),
          created_at: new Date().toISOString(),
          jobsite_id: "j1",
          sif_potential: true,
        },
      ],
    }),
    company_incidents: queryBuilder({
      data: [
        {
          id: "i1",
          title: "Near miss",
          category: "struck_by",
          severity: "medium",
          status: "open",
          created_at: new Date().toISOString(),
          jobsite_id: "j1",
          sif_flag: false,
        },
      ],
    }),
    company_permits: queryBuilder({ data: [] }),
    company_jsa_activities: queryBuilder({ data: [] }),
    company_jobsite_schedule_items: queryBuilder({ data: [] }),
    company_sor_records: queryBuilder({ data: [] }),
    company_jobsite_audit_observations: queryBuilder({ data: [] }),
    company_risk_ai_recommendations: queryBuilder({ data: [] }),
    company_risk_recommendation_events: queryBuilder({ data: [] }),
    company_employee_training_records: queryBuilder({ data: [] }),
    weather_alert_events: queryBuilder({ data: [] }),
    company_memory_items: queryBuilder({ data: [] }),
    ...overrides,
  };
  return {
    from: vi.fn((table: string) => builders[table as keyof typeof builders]),
    builders,
  };
}

function adminFeedbackFixture(rows: Array<Record<string, unknown>>) {
  const result = { data: rows, error: null };
  const limit = vi.fn().mockResolvedValue(result);
  const order = vi.fn(() => ({ limit }));
  const gte = vi.fn(() => ({ order }));
  const eq = vi.fn(() => ({ gte }));
  const select = vi.fn(() => ({ eq }));
  return {
    from: vi.fn(() => ({ select })),
  };
}

function expectResponse(res: Response | undefined) {
  if (!res) throw new Error("missing response");
  return res;
}

describe("/api/company/predictive-risk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(companyHasCsepPlanName).mockResolvedValue(false);
    vi.mocked(getJobsiteAccessScope).mockResolvedValue({ restricted: false, jobsiteIds: [] });
    vi.mocked(getInjuryWeatherDashboardData).mockResolvedValue(forecastFixture());
    vi.mocked(createSupabaseAdminClient).mockReturnValue(null);
  });

  it("returns auth errors", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      error: NextResponse.json({ error: "no" }, { status: 401 }),
    } as never);

    const res = expectResponse(await GET(new Request("http://localhost/api/company/predictive-risk")));
    expect(res.status).toBe(401);
  });

  it("returns sales demo data", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "sales_demo",
      team: "Demo",
      user: { id: "demo-user" },
      supabase: {},
    } as never);

    const res = expectResponse(await GET(new Request("http://localhost/api/company/predictive-risk?days=30")));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.locations.length).toBeGreaterThan(0);
    expect(body.summary.confidencePercent).toBe(85);
  });

  it("returns an empty payload when no company is linked", async () => {
    const { from } = supabaseFixture();
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "company_admin",
      team: "Ops",
      user: { id: "u1" },
      supabase: { from },
    } as never);
    vi.mocked(getCompanyScope).mockResolvedValue({ companyId: null, companyName: "Ops" } as never);

    const res = expectResponse(await GET(new Request("http://localhost/api/company/predictive-risk")));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.warning).toContain("no company workspace");
    expect(body.locations).toEqual([]);
  });

  it("blocks CSEP-only workspaces", async () => {
    const { from } = supabaseFixture();
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "company_admin",
      team: "Ops",
      user: { id: "u1" },
      supabase: { from },
    } as never);
    vi.mocked(getCompanyScope).mockResolvedValue({ companyId: "co1", companyName: "Ops" } as never);
    vi.mocked(companyHasCsepPlanName).mockResolvedValue(true);

    const res = expectResponse(await GET(new Request("http://localhost/api/company/predictive-risk")));
    expect(res.status).toBe(403);
  });

  it("returns company predictive risk data", async () => {
    const { from, builders } = supabaseFixture();
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "company_admin",
      team: "Ops",
      user: { id: "u1" },
      supabase: { from },
    } as never);
    vi.mocked(getCompanyScope).mockResolvedValue({ companyId: "co1", companyName: "Ops" } as never);

    const res = expectResponse(await GET(new Request("http://localhost/api/company/predictive-risk?days=30&jobsiteId=j1")));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.locations[0].label).toBe("North Building");
    expect(body.summary.predictedIncidents).toBe(2);
    expect(body.safetyAiAssessment.score).toBeGreaterThan(0);
    expect(body.safetyAiAssessment.explanation).toContain("Based on available data");
    expect(body.safetyAiAssessment.scoreExplanation).toEqual(expect.objectContaining({ recommendedAction: expect.any(String) }));
    expect(body.dailyBriefing).toEqual(expect.objectContaining({ engineVersion: "predictive-safety-engine-mvp-rules-v1" }));
    expect(getInjuryWeatherDashboardData).toHaveBeenCalledWith(expect.objectContaining({ companyId: "co1", jobsiteId: "j1" }));
    expect(builders.company_corrective_actions.eq).toHaveBeenCalledWith("jobsite_id", "j1");
  });

  it("includes upcoming work schedule rows in predictive behavior risk", async () => {
    const workDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const { from } = supabaseFixture({
      company_jobsite_schedule_items: queryBuilder({
        data: [
          {
            id: "schedule-1",
            jobsite_id: "j1",
            title: "Critical lift over active access route",
            work_start_date: workDate,
            work_end_date: workDate,
            shift_start_time: "07:00",
            shift_end_time: "17:00",
            trade: "Steel",
            work_area: "Level 4 east",
            crew_size: 10,
            supervisor_name: null,
            risk_level: "critical",
            is_high_risk: true,
            hazard_categories: ["crane_rigging", "line_of_fire"],
            permit_triggers: ["lift_plan"],
            required_controls: [],
            status: "planned",
            created_at: new Date().toISOString(),
          },
        ],
      }),
    });
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "company_admin",
      team: "Ops",
      user: { id: "u1" },
      supabase: { from },
    } as never);
    vi.mocked(getCompanyScope).mockResolvedValue({ companyId: "co1", companyName: "Ops" } as never);

    const res = expectResponse(await GET(new Request("http://localhost/api/company/predictive-risk?days=30&jobsiteId=j1")));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.behaviorRisk.topDrivers.map((driver: { driver: string }) => driver.driver)).toContain("schedule_pressure");
    expect(body.dailyBriefing.highRiskWork[0]).toEqual(expect.objectContaining({ title: "Critical lift over active access route" }));
    expect(body.dailyBriefing.highRiskWork[0].scoreExplanation).toEqual(
      expect.objectContaining({
        humanApprovalRequired: true,
        recommendedAction: expect.any(String),
      })
    );
    expect(body.dailyBriefing.highRiskWork[0].recommendedControls[0]).toEqual(
      expect.objectContaining({
        recommendedAction: expect.any(String),
        verificationRequired: expect.any(String),
        humanApprovalRequired: true,
      })
    );
    expect(body.aiSafetyActionQueue.items[0]).toEqual(
      expect.objectContaining({
        approvalState: "review_required",
        humanApprovalRequired: true,
        recommendedControl: expect.any(String),
      })
    );
    expect(body.approvalState).toEqual(expect.objectContaining({ humanReviewRequired: true }));
    expect(body.feedbackInfluence).toEqual(expect.objectContaining({ confidenceAdjustment: expect.any(String) }));
    expect(body.memoryInfluence).toEqual(expect.objectContaining({ memoryItemCount: expect.any(Number) }));
    expect(body.calibrationSummary).toEqual(expect.objectContaining({ trackedMetrics: expect.arrayContaining(["field-used controls"]) }));
    expect(body.dailyBriefing.readinessBlockers.map((blocker: { type: string }) => blocker.type)).toContain("permit");
    expect(body.leadershipTrust.sourceCoverage).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "scheduleItems", label: "Work schedule", count: 1 })])
    );
    expect(getInjuryWeatherDashboardData).toHaveBeenCalledWith(expect.objectContaining({
      companyId: "co1",
      jobsiteId: "j1",
      workSchedule: expect.objectContaining({ hoursPerDay: 10 }),
    }));
  });

  it("includes feedback-influenced queue metadata from AI output feedback", async () => {
    const workDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const { from } = supabaseFixture({
      company_jobsite_schedule_items: queryBuilder({
        data: [
          {
            id: "feedback",
            jobsite_id: "j1",
            title: "Roof edge layout",
            work_start_date: workDate,
            work_end_date: workDate,
            trade: "Roofing",
            work_area: "Level 3",
            crew_size: 4,
            supervisor_name: null,
            risk_level: "high",
            is_high_risk: true,
            hazard_categories: ["fall_protection"],
            permit_triggers: [],
            required_controls: [],
            status: "planned",
            created_at: new Date().toISOString(),
          },
        ],
      }),
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      adminFeedbackFixture([
        {
          id: 1,
          surface: "ai-engine.daily-briefing",
          source_id: "schedule-feedback-fall_protection",
          outcome: "edited",
          reason: "missing_information",
          signal_metadata: { recommendationFeedback: "missing_information", jobsiteId: "j1", hazardFamily: "fall_protection" },
          created_at: new Date().toISOString(),
        },
      ]) as never,
    );
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "company_admin",
      team: "Ops",
      user: { id: "u1" },
      supabase: { from },
    } as never);
    vi.mocked(getCompanyScope).mockResolvedValue({ companyId: "co1", companyName: "Ops" } as never);

    const res = expectResponse(await GET(new Request("http://localhost/api/company/predictive-risk?days=30&jobsiteId=j1")));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.aiSafetyActionQueue.items[0]).toEqual(
      expect.objectContaining({
        feedbackInfluence: expect.arrayContaining([expect.stringContaining("missing information")]),
        feedbackConfidenceAdjustment: "neutral",
        missingInformation: expect.arrayContaining([expect.stringContaining("missing context")]),
      }),
    );
    expect(body.feedbackInfluence).toEqual(expect.objectContaining({ feedbackSignalCount: expect.any(Number) }));
  });

  it("rejects a restricted user requesting an unassigned jobsite", async () => {
    const { from } = supabaseFixture();
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "field_supervisor",
      team: "Ops",
      user: { id: "u1" },
      supabase: { from },
    } as never);
    vi.mocked(getCompanyScope).mockResolvedValue({ companyId: "co1", companyName: "Ops" } as never);
    vi.mocked(getJobsiteAccessScope).mockResolvedValue({ restricted: true, jobsiteIds: ["j1"] });

    const res = expectResponse(await GET(new Request("http://localhost/api/company/predictive-risk?jobsiteId=j2")));
    expect(res.status).toBe(403);
  });
});
