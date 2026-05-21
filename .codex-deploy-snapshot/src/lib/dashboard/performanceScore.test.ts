import { describe, expect, it } from "vitest";
import {
  buildDashboardImprovementDrivers,
  buildDashboardPerformanceScore,
} from "@/src/lib/dashboard/performanceScore";
import type { DashboardOverview } from "@/src/lib/dashboard/types";

function overview(partial: Partial<DashboardOverview> = {}): DashboardOverview {
  return {
    summary: {
      safetyHealthScore: 92,
      openHighRiskItems: 0,
      overdueCorrectiveActions: 0,
      incidentCount: 0,
      nearMissCount: 0,
      permitComplianceRate: 95,
      jsaCompletionRate: 94,
      trainingReadinessRate: 96,
      documentReadinessRate: 93,
    },
    incidentTrend: [
      { date: "2026-04-01", value: 3 },
      { date: "2026-04-08", value: 2 },
      { date: "2026-04-15", value: 1 },
      { date: "2026-04-22", value: 1 },
    ],
    observationTrend: [],
    correctiveActionStatus: { open: 0, overdue: 0, closed: 10, averageDaysToClose: 2 },
    topRisks: [],
    contractorRiskScores: [],
    permitCompliance: [{ permitType: "hot_work", required: 10, completed: 10, missing: 0, complianceRate: 100 }],
    documentReadiness: {
      draft: 0,
      submitted: 0,
      underReview: 1,
      approved: 12,
      rejected: 0,
      missingRequired: 0,
      expiringSoon: 0,
    },
    engineHealth: [
      { moduleName: "Dashboard data service", status: "green", lastChecked: "2026-04-28T00:00:00.000Z", message: "ok" },
    ],
    aiInsights: [],
    overdueCorrectiveSamples: [],
    observationCategoryTop: [],
    credentialGaps: { expiredCredentials: 0, expiringSoonCredentials: 0 },
    ...partial,
  };
}

describe("buildDashboardPerformanceScore", () => {
  it("returns a green score when safety, readiness, closure, trend, and engine health are strong", () => {
    const score = buildDashboardPerformanceScore(overview());

    expect(score.value).toBeGreaterThanOrEqual(90);
    expect(score.band).toBe("green");
    expect(score.contributors.map((item) => item.key)).toEqual([
      "safety",
      "readiness",
      "closure",
      "trend",
      "executive",
    ]);
  });

  it("forces red when open high-risk items exist", () => {
    const score = buildDashboardPerformanceScore(
      overview({
        summary: {
          ...overview().summary,
          safetyHealthScore: 91,
          openHighRiskItems: 2,
        },
      })
    );

    expect(score.value).toBeLessThan(70);
    expect(score.band).toBe("red");
    expect(score.contributors.find((item) => item.key === "safety")?.band).toBe("red");
  });

  it("treats empty readiness as measured cautiously instead of false success", () => {
    const score = buildDashboardPerformanceScore(
      overview({
        summary: {
          ...overview().summary,
          permitComplianceRate: 0,
          jsaCompletionRate: 0,
          trainingReadinessRate: 0,
          documentReadinessRate: 0,
        },
        permitCompliance: [],
        documentReadiness: {
          draft: 0,
          submitted: 0,
          underReview: 0,
          approved: 0,
          rejected: 0,
          missingRequired: 0,
          expiringSoon: 0,
        },
      })
    );

    expect(score.contributors.find((item) => item.key === "readiness")?.score).toBe(65);
    expect(score.contributors.find((item) => item.key === "readiness")?.band).toBe("red");
  });
});

describe("buildDashboardImprovementDrivers", () => {
  it("generates drivers for high risk, overdue work, permit gaps, credentials, documents, and engine warnings", () => {
    const drivers = buildDashboardImprovementDrivers(
      overview({
        summary: {
          ...overview().summary,
          openHighRiskItems: 1,
          overdueCorrectiveActions: 3,
          documentReadinessRate: 45,
        },
        permitCompliance: [{ permitType: "hot_work", required: 3, completed: 1, missing: 2, complianceRate: 33 }],
        documentReadiness: {
          draft: 4,
          submitted: 0,
          underReview: 2,
          approved: 2,
          rejected: 0,
          missingRequired: 0,
          expiringSoon: 0,
        },
        engineHealth: [
          { moduleName: "Permits", status: "yellow", lastChecked: "2026-04-28T00:00:00.000Z", message: "missing table" },
        ],
        credentialGaps: { expiredCredentials: 1, expiringSoonCredentials: 0 },
      })
    );

    expect(drivers.map((driver) => driver.id)).toContain("open-high-risk");
    expect(drivers.map((driver) => driver.id)).toContain("overdue-correctives");
    expect(drivers.map((driver) => driver.id)).toContain("missing-permits");
    expect(drivers.map((driver) => driver.id)).toContain("expired-credentials");
    expect(drivers.map((driver) => driver.id)).toContain("document-readiness");
    expect(drivers.map((driver) => driver.id)).toContain("engine-health");
  });
});
