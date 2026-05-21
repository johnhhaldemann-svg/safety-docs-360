import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PerformanceHubPanel } from "@/src/components/dashboard/PerformanceHubPanel";
import type { DashboardOverview } from "@/src/lib/dashboard/types";

function overview(): DashboardOverview {
  return {
    summary: {
      safetyHealthScore: 68,
      openHighRiskItems: 1,
      overdueCorrectiveActions: 2,
      incidentCount: 1,
      nearMissCount: 3,
      permitComplianceRate: 72,
      jsaCompletionRate: 81,
      trainingReadinessRate: 88,
      documentReadinessRate: 58,
    },
    incidentTrend: [
      { date: "2026-04-01", value: 1 },
      { date: "2026-04-08", value: 2 },
    ],
    observationTrend: [
      { date: "2026-04-01", value: 1, label: "Positive" },
      { date: "2026-04-01", value: 4, label: "Negative / other" },
    ],
    correctiveActionStatus: { open: 5, overdue: 2, closed: 8, averageDaysToClose: 4 },
    topRisks: [
      {
        name: "fall protection",
        count: 4,
        severity: "high",
        trend: "up",
        recommendation: "Verify fall protection controls before elevated work.",
      },
    ],
    contractorRiskScores: [],
    permitCompliance: [{ permitType: "hot_work", required: 4, completed: 2, missing: 1, complianceRate: 50 }],
    documentReadiness: {
      draft: 3,
      submitted: 0,
      underReview: 2,
      approved: 2,
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
    credentialGaps: { expiredCredentials: 1, expiringSoonCredentials: 0 },
  };
}

describe("PerformanceHubPanel", () => {
  it("renders the main score, contributors, current operations, and drivers in title case", () => {
    const html = renderToStaticMarkup(<PerformanceHubPanel overview={overview()} activeJobsites={3} />);

    expect(html).toContain("Safety Performance Score");
    expect(html).toContain("Score Contributors");
    expect(html).toContain("Safety Performance");
    expect(html).toContain("Operational Command Strip");
    expect(html).toContain("Active Jobsites");
    expect(html).toContain("Priority Action Queue");
    expect(html).toContain("Open High-Risk Items Need Field Verification");
  });
});
