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
});
