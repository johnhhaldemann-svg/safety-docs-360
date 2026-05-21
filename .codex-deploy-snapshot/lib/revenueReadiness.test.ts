import { describe, expect, it } from "vitest";
import { buildRevenueReadinessSummary } from "@/lib/revenueReadiness";

const now = new Date("2026-04-25T12:00:00.000Z");

describe("buildRevenueReadinessSummary", () => {
  it("scores a launched active workspace as ready to sell", () => {
    const summary = buildRevenueReadinessSummary({
      now,
      companyProfile: {
        name: "Acme Safety",
        industry: "Construction",
        phone: "555-0100",
        address_line_1: "100 Main",
        city: "Austin",
        state_region: "TX",
        country: "US",
        pilot_converted_at: "2026-04-20T00:00:00.000Z",
      },
      companyUsers: [
        { status: "active", last_sign_in_at: "2026-04-24T12:00:00.000Z" },
        { status: "active", last_sign_in_at: "2026-04-23T12:00:00.000Z" },
      ],
      jobsites: [{ status: "active" }],
      documents: [{ status: "approved", final_file_path: "docs/acme.docx" }],
      onboarding: { commandCenterViewed: true, completedSteps: ["command_center"] },
      subscription: {
        status: "active",
        planName: "Pro",
        maxUserSeats: 5,
        seatsUsed: 2,
        subscriptionPriceCents: 49900,
      },
      work: {
        correctiveActions: [{ status: "verified_closed", closed_at: "2026-04-22T00:00:00.000Z" }],
        incidents: [{ status: "closed" }],
        permits: [{ status: "completed" }],
      },
      riskMemory: { recommendationCount: 2 },
    });

    expect(summary.band).toBe("Ready to sell");
    expect(summary.score).toBeGreaterThanOrEqual(82);
    expect(summary.adoption.completedCount).toBe(summary.adoption.totalCount);
    expect(summary.nextActions.find((action) => action.id === "activate-subscription")).toBeUndefined();
  });

  it("flags missing billing and overdue work as high-value next actions", () => {
    const summary = buildRevenueReadinessSummary({
      now,
      companyProfile: {
        name: "Beta Builders",
        industry: "Construction",
      },
      companyUsers: [{ status: "active" }],
      jobsites: [{ status: "active" }],
      documents: [],
      onboarding: { commandCenterViewed: false, completedSteps: [] },
      subscription: {
        status: "inactive",
        maxUserSeats: 1,
        seatsUsed: 2,
      },
      work: {
        correctiveActions: [
          { status: "open", due_at: "2026-04-20T00:00:00.000Z" },
        ],
      },
    });

    expect(summary.band).toMatch(/Needs attention|At risk/);
    expect(summary.counts.overdueWork).toBe(1);
    expect(summary.nextActions.map((action) => action.id)).toContain("activate-subscription");
    expect(summary.nextActions.map((action) => action.id)).toContain("raise-seat-cap");
    expect(summary.nextActions.map((action) => action.id)).toContain("clear-overdue-work");
  });
});
