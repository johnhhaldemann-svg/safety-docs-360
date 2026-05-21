import { describe, expect, it } from "vitest";
import {
  buildFieldIssueAnalytics,
  buildAnalyticsRange,
  isOverdue,
  type FieldIssueAnalyticsItem,
} from "./fieldIssueAnalytics";

function makeItem(overrides: Partial<FieldIssueAnalyticsItem>): FieldIssueAnalyticsItem {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    company_id: overrides.company_id ?? "company-1",
    jobsite_id: overrides.jobsite_id ?? null,
    category: overrides.category ?? "hazard",
    status: overrides.status ?? "open",
    severity: overrides.severity ?? "medium",
    due_at: overrides.due_at ?? null,
    created_at: overrides.created_at ?? "2026-04-01T12:00:00.000Z",
    closed_at: overrides.closed_at ?? null,
  };
}

describe("fieldIssueAnalytics", () => {
  const referenceTime = new Date("2026-04-24T12:00:00.000Z").getTime();
  const jobsiteNameById = new Map([
    ["jobsite-a", "North Plant"],
    ["jobsite-b", "South Yard"],
  ]);

  it("builds the requested KPI values and derived counts", () => {
    const analytics = buildFieldIssueAnalytics({
      items: [
        makeItem({
          id: "open-1",
          category: "hazard",
          status: "open",
          severity: "high",
          due_at: "2026-04-20T12:00:00.000Z",
          created_at: "2026-04-05T12:00:00.000Z",
          jobsite_id: "jobsite-a",
        }),
        makeItem({
          id: "assigned-1",
          category: "hazard",
          status: "assigned",
          severity: "critical",
          created_at: "2026-04-06T12:00:00.000Z",
          jobsite_id: "jobsite-a",
        }),
        makeItem({
          id: "corrected-1",
          category: "ppe_violation",
          status: "corrected",
          severity: "medium",
          created_at: "2026-04-07T12:00:00.000Z",
          jobsite_id: "jobsite-b",
        }),
        makeItem({
          id: "closed-1",
          category: "incident",
          status: "verified_closed",
          severity: "low",
          created_at: "2026-04-08T12:00:00.000Z",
          closed_at: "2026-04-10T12:00:00.000Z",
          jobsite_id: "jobsite-b",
        }),
      ],
      jobsiteNameById,
      companyLabel: "Safety 360 Docs",
      referenceTime,
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      trendGranularity: "week",
    });

    expect(analytics.totalIssues).toBe(4);
    expect(analytics.openBacklogCount).toBe(3);
    expect(analytics.overdueCount).toBe(1);
    expect(analytics.highCriticalCount).toBe(2);
    expect(analytics.verifiedClosedCount).toBe(1);
    expect(analytics.closureRate).toBe(0.25);
    expect(analytics.averageDaysToClose).toBe(2);
    expect(analytics.repeatIssueCount).toBe(2);
  });

  it("does not count verified closed items as overdue even when the due date is in the past", () => {
    expect(
      isOverdue(
        makeItem({
          status: "verified_closed",
          due_at: "2026-04-01T12:00:00.000Z",
        }),
        referenceTime
      )
    ).toBe(false);
  });

  it("places overdue items into the correct aging buckets", () => {
    const analytics = buildFieldIssueAnalytics({
      items: [
        makeItem({
          id: "age-1",
          due_at: "2026-04-23T12:00:00.000Z",
          created_at: "2026-04-02T12:00:00.000Z",
        }),
        makeItem({
          id: "age-2",
          due_at: "2026-04-19T12:00:00.000Z",
          created_at: "2026-04-03T12:00:00.000Z",
        }),
        makeItem({
          id: "age-3",
          due_at: "2026-04-12T12:00:00.000Z",
          created_at: "2026-04-04T12:00:00.000Z",
        }),
        makeItem({
          id: "age-4",
          due_at: "2026-03-20T12:00:00.000Z",
          created_at: "2026-04-05T12:00:00.000Z",
        }),
      ],
      jobsiteNameById,
      companyLabel: "Safety 360 Docs",
      referenceTime,
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      trendGranularity: "week",
    });

    expect(analytics.overdueAgingCounts).toEqual([
      { key: "1_3", count: 1 },
      { key: "4_7", count: 1 },
      { key: "8_14", count: 1 },
      { key: "15_plus", count: 1 },
    ]);
  });

  it("builds week and month trend buckets", () => {
    const items = [
      makeItem({
        id: "trend-1",
        created_at: "2026-04-02T12:00:00.000Z",
      }),
      makeItem({
        id: "trend-2",
        status: "verified_closed",
        created_at: "2026-04-14T12:00:00.000Z",
        closed_at: "2026-04-22T12:00:00.000Z",
      }),
    ];

    const weekly = buildFieldIssueAnalytics({
      items,
      jobsiteNameById,
      companyLabel: "Safety 360 Docs",
      referenceTime,
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      trendGranularity: "week",
    });
    const monthly = buildFieldIssueAnalytics({
      items,
      jobsiteNameById,
      companyLabel: "Safety 360 Docs",
      referenceTime,
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      trendGranularity: "month",
    });

    expect(weekly.trendPoints.length).toBeGreaterThan(1);
    expect(monthly.trendPoints).toHaveLength(1);
    expect(monthly.trendPoints[0]?.created).toBe(2);
    expect(monthly.trendPoints[0]?.closed).toBe(1);
  });

  it("fills every matrix status column including derived overdue totals", () => {
    const analytics = buildFieldIssueAnalytics({
      items: [
        makeItem({
          id: "matrix-open",
          category: "hazard",
          status: "open",
          due_at: "2026-04-20T12:00:00.000Z",
        }),
        makeItem({
          id: "matrix-assigned",
          category: "hazard",
          status: "assigned",
        }),
        makeItem({
          id: "matrix-progress",
          category: "hazard",
          status: "in_progress",
        }),
        makeItem({
          id: "matrix-corrected",
          category: "hazard",
          status: "corrected",
        }),
        makeItem({
          id: "matrix-closed",
          category: "hazard",
          status: "verified_closed",
          closed_at: "2026-04-21T12:00:00.000Z",
        }),
        makeItem({
          id: "matrix-escalated",
          category: "hazard",
          status: "escalated",
        }),
        makeItem({
          id: "matrix-stop",
          category: "hazard",
          status: "stop_work",
        }),
      ],
      jobsiteNameById,
      companyLabel: "Safety 360 Docs",
      referenceTime,
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      trendGranularity: "week",
    });

    const hazardRow = analytics.matrixRows.find((row) => row.category === "hazard");
    expect(hazardRow).toEqual({
      category: "hazard",
      open: 1,
      assigned: 1,
      inProgress: 1,
      corrected: 1,
      verifiedClosed: 1,
      overdue: 1,
      escalated: 1,
      stopWork: 1,
      total: 7,
    });
  });

  it("marks repeat issues when category matches and location or company repeats in range", () => {
    const analytics = buildFieldIssueAnalytics({
      items: [
        makeItem({
          id: "repeat-1",
          category: "hazard",
          jobsite_id: "jobsite-a",
          created_at: "2026-04-02T12:00:00.000Z",
        }),
        makeItem({
          id: "repeat-2",
          category: "hazard",
          jobsite_id: "jobsite-a",
          created_at: "2026-04-03T12:00:00.000Z",
        }),
        makeItem({
          id: "repeat-3",
          category: "incident",
          jobsite_id: "jobsite-b",
          created_at: "2026-04-04T12:00:00.000Z",
        }),
      ],
      jobsiteNameById,
      companyLabel: "Safety 360 Docs",
      referenceTime,
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      trendGranularity: "week",
    });

    expect(analytics.repeatIssueCount).toBe(2);
    expect(analytics.repeatSummary.repeatedCategories).toEqual([{ key: "hazard", count: 2 }]);
    expect(analytics.repeatSummary.repeatedLocations).toEqual([{ label: "North Plant", count: 2 }]);
    expect(analytics.repeatSummary.repeatedCompanies).toEqual([{ label: "Safety 360 Docs", count: 2 }]);
  });

  it("builds a stable analytics range even when the inputs are reversed", () => {
    const range = buildAnalyticsRange({
      startDate: "2026-04-30",
      endDate: "2026-04-01",
      referenceTime,
    });

    expect(range.startMs).toBeLessThan(range.endMs);
  });
});
