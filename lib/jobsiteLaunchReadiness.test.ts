import { describe, expect, it } from "vitest";
import { buildJobsiteLaunchReadiness } from "./jobsiteLaunchReadiness";
import type { JobsiteLaunchReadinessInput } from "./jobsiteLaunchReadiness";

function input(overrides: Partial<JobsiteLaunchReadinessInput> = {}): JobsiteLaunchReadinessInput {
  return {
    emergencyActionPlanReadiness: "complete",
    emergencyActionPlanReviewStale: false,
    emergencyActionPlanImmediateReviewNeeded: false,
    emergencyActionPlanMissingCount: 0,
    topJobsiteRisks: [],
    workPlannedToday: 2,
    highRiskScheduleCount: 0,
    permitCount: 1,
    activePermitCount: 1,
    permitBlockerCount: 0,
    expiredPermitCount: 0,
    workforceCount: 4,
    documentCount: 2,
    reportCount: 1,
    incidentCount: 0,
    recentIncidentCount: 0,
    openActionCount: 0,
    overdueActionCount: 0,
    highRiskItemCount: 0,
    sifExposureCount: 0,
    activityCount: 2,
    ...overrides,
  };
}

describe("jobsite launch readiness", () => {
  it("puts the launch on hold when the EAP is missing critical information", () => {
    const readiness = buildJobsiteLaunchReadiness(input({
      emergencyActionPlanReadiness: "missing_critical_info",
      emergencyActionPlanImmediateReviewNeeded: true,
      emergencyActionPlanMissingCount: 3,
    }));

    expect(readiness.status).toBe("hold");
    expect(readiness.primaryBlocker).toContain("Emergency");
    expect(readiness.stations.find((station) => station.id === "emergency")?.status).toBe("hold");
  });

  it("puts the launch on hold when a critical Top 10 risk has live evidence", () => {
    const readiness = buildJobsiteLaunchReadiness(input({
      topJobsiteRisks: [
        {
          id: "falls_from_elevation",
          rank: 1,
          title: "Falls from elevation",
          riskLevel: "critical",
          score: 120,
          evidenceCount: 2,
          topDrivers: ["Roof edge exposure"],
          nextAction: "Immediate review needed.",
          sources: [{ type: "incident", count: 1 }],
        },
      ],
    }));

    expect(readiness.status).toBe("hold");
    expect(readiness.stations.find((station) => station.id === "risk")?.status).toBe("hold");
  });

  it("requires review for high-risk scheduled work without critical blockers", () => {
    const readiness = buildJobsiteLaunchReadiness(input({
      highRiskScheduleCount: 2,
    }));

    expect(readiness.status).toBe("review");
    expect(readiness.stations.find((station) => station.id === "work_plan")?.status).toBe("review");
  });

  it("returns go when all stations have enough clean signals", () => {
    const readiness = buildJobsiteLaunchReadiness(input());

    expect(readiness.status).toBe("go");
    expect(readiness.criticalCount).toBe(0);
    expect(readiness.warningCount).toBe(0);
  });

  it("treats missing source data conservatively instead of false GO", () => {
    const readiness = buildJobsiteLaunchReadiness(input({
      workPlannedToday: 0,
      permitCount: 0,
      activePermitCount: 0,
      workforceCount: 0,
      documentCount: 0,
      reportCount: 0,
      activityCount: 0,
    }));

    expect(readiness.status).toBe("review");
    expect(readiness.stations.some((station) => station.status === "no_signal")).toBe(true);
  });
});
