import { describe, expect, it } from "vitest";
import { buildJobsiteDailyTodos, getDailyTodoWorkDate } from "./jobsiteDailyTodos";

describe("jobsite daily todos", () => {
  it("uses the previous work date before the 5am local refresh", () => {
    expect(getDailyTodoWorkDate(new Date("2026-05-22T09:30:00.000Z"))).toBe("2026-05-21");
    expect(getDailyTodoWorkDate(new Date("2026-05-22T10:01:00.000Z"))).toBe("2026-05-22");
  });

  it("builds clickable PM and SL tasks from risk signals", () => {
    const todos = buildJobsiteDailyTodos({
      jobsiteId: "site-1",
      jobsiteName: "Hillcrest Office Fit-Out",
      workDate: "2026-05-22",
      riskLevel: "critical",
      firstScheduleRiskTitle: "Drop Hazard 3rd Floor",
      highRiskScheduleCount: 4,
      openActionsCount: 7,
      overdueActionsCount: 2,
      permitBlockerCount: 1,
      inspectionGapCount: 3,
      readyReportCount: 1,
      workforceGapCount: 0,
    });

    expect(todos).toHaveLength(5);
    expect(todos.some((todo) => todo.role === "pm")).toBe(true);
    expect(todos.some((todo) => todo.role === "sl")).toBe(true);
    expect(todos.every((todo) => todo.targetTab && todo.targetHref)).toBe(true);
    expect(todos.find((todo) => todo.sourceKey === "pm-action-closeout")?.priority).toBe("critical");
  });

  it("elevates pre-work readiness when the Emergency Action Plan is missing critical information", () => {
    const todos = buildJobsiteDailyTodos({
      jobsiteId: "site-1",
      jobsiteName: "Hillcrest Office Fit-Out",
      workDate: "2026-05-22",
      riskLevel: "medium",
      emergencyActionPlanReadiness: "missing_critical_info",
      emergencyActionPlanMissingCount: 3,
      firstScheduleRiskTitle: null,
      highRiskScheduleCount: 0,
      openActionsCount: 0,
      overdueActionsCount: 0,
      permitBlockerCount: 0,
      inspectionGapCount: 0,
      readyReportCount: 0,
      workforceGapCount: 0,
    });

    const readinessTodo = todos.find((todo) => todo.sourceKey === "sl-prework-readiness");
    expect(readinessTodo).toMatchObject({
      priority: "critical",
      targetHref: "/jobsites/site-1/emergency-action-plan",
    });
    expect(readinessTodo?.detail).toContain("Emergency Action Plan");
  });

  it("creates PM and SL review actions for critical Top 10 jobsite risk signals", () => {
    const todos = buildJobsiteDailyTodos({
      jobsiteId: "site-1",
      jobsiteName: "Hillcrest Office Fit-Out",
      workDate: "2026-05-22",
      riskLevel: "medium",
      emergencyActionPlanReadiness: "complete",
      emergencyActionPlanMissingCount: 0,
      topJobsiteRiskLevel: "critical",
      topJobsiteRiskTitle: "Falls from elevation",
      topJobsiteRiskEvidenceCount: 2,
      firstScheduleRiskTitle: null,
      highRiskScheduleCount: 0,
      openActionsCount: 0,
      overdueActionsCount: 0,
      permitBlockerCount: 0,
      inspectionGapCount: 0,
      readyReportCount: 0,
      workforceGapCount: 0,
    });

    const pmReview = todos.find((todo) => todo.sourceKey === "pm-risk-review");
    const slReadiness = todos.find((todo) => todo.sourceKey === "sl-prework-readiness");

    expect(pmReview).toMatchObject({
      priority: "critical",
      targetHref: "/jobsites/site-1/overview",
    });
    expect(pmReview?.detail).toContain("Immediate review needed for Falls from elevation");
    expect(slReadiness).toMatchObject({
      priority: "critical",
      targetHref: "/jobsites/site-1/overview",
    });
    expect(slReadiness?.detail).toContain("Verify controls for Falls from elevation");
  });
});
