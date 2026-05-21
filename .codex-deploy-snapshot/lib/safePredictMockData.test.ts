import { describe, expect, it } from "vitest";
import {
  actionsForRisk,
  demoCompanyTotals,
  employeesForSite,
  filterAlertsByRisk,
  jobsiteForId,
  permitTotals,
  riskLevelForScore,
  safePredictActions,
  safePredictAlerts,
  safePredictDemoCompany,
  safePredictDemoEmployees,
  safePredictDemoJobsites,
  safePredictForecast,
  safePredictPermits,
  safePredictTradeReadiness,
  summarizeActions,
  workforceTotals,
} from "@/lib/safePredictMockData";

describe("safePredictMockData", () => {
  it("keeps the deterministic MVP data populated for all four SafePredict screens", () => {
    expect(safePredictForecast.length).toBeGreaterThanOrEqual(20);
    expect(safePredictAlerts.length).toBeGreaterThanOrEqual(5);
    expect(safePredictActions.length).toBeGreaterThanOrEqual(12);
    expect(safePredictTradeReadiness.length).toBeGreaterThanOrEqual(6);
    expect(safePredictPermits.length).toBeGreaterThanOrEqual(5);
    expect(safePredictDemoJobsites.length).toBe(5);
    expect(safePredictDemoEmployees.length).toBeGreaterThanOrEqual(12);
  });

  it("classifies score bands into safety risk levels", () => {
    expect(riskLevelForScore(95)).toBe("critical");
    expect(riskLevelForScore(78)).toBe("high");
    expect(riskLevelForScore(62)).toBe("medium");
    expect(riskLevelForScore(34)).toBe("low");
  });

  it("filters alerts and related corrective actions for the mitigation workspace", () => {
    expect(filterAlertsByRisk(safePredictAlerts, "high").every((alert) => alert.riskLevel === "high")).toBe(true);
    expect(filterAlertsByRisk(safePredictAlerts, "all")).toHaveLength(safePredictAlerts.length);
    expect(actionsForRisk(safePredictActions, "machine-guarding").map((action) => action.linkedRiskId)).toEqual([
      "machine-guarding",
      "machine-guarding",
      "machine-guarding",
    ]);
  });

  it("summarizes action, workforce, and permit totals used by KPI cards", () => {
    expect(summarizeActions(safePredictActions)).toMatchObject({
      open: 9,
      overdue: 5,
      closed: 3,
      riskScore: 68,
    });
    expect(workforceTotals(safePredictTradeReadiness)).toMatchObject({
      workers: 220,
      compliantPercent: 78,
      expiringSoonPercent: 15,
      overduePercent: 7,
    });
    expect(permitTotals(safePredictPermits)).toEqual({
      active: 42,
      expiringSoon: 11,
      expired: 2,
    });
  });

  it("keeps shell company jobsites and employees connected for demos", () => {
    expect(safePredictDemoCompany.name).toBe("Apex Industrial Constructors");
    expect(jobsiteForId(safePredictDemoJobsites, "plant-1")?.siteLead).toBe("Mark Rivera");
    expect(employeesForSite(safePredictDemoEmployees, "riverside").map((employee) => employee.assignedSiteId)).toEqual([
      "riverside",
      "riverside",
      "riverside",
      "riverside",
    ]);
    expect(demoCompanyTotals(safePredictDemoJobsites, safePredictDemoEmployees)).toMatchObject({
      jobsites: 5,
      employees: 12,
      activePermits: 42,
      overdueEmployees: 3,
    });
  });
});
