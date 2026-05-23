import { describe, expect, it } from "vitest";
import { buildAiSafetyCalibrationReport } from "@/lib/aiSafetyCalibration";

const now = new Date("2026-05-23T12:00:00.000Z");

function aiAction(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-1",
    kind: "ai_safety_action",
    title: "Verify fall protection plan",
    status: "active",
    priority: "high",
    created_at: "2026-05-20T12:00:00.000Z",
    due_at: "2026-05-23T14:00:00.000Z",
    risk_reduction_points: 0,
    evidence_summary: {
      aiSafetyAction: {
        category: "fall_protection",
        sourceWorkTitle: "Elevated deck work",
        recommendedControl: "Review fall protection plan before elevated work.",
        jobsiteId: "j1",
        trade: "Steel",
      },
      evidenceRefs: [{ id: "schedule-s1", label: "Elevated deck work", sourceModule: "company_jobsite_schedule_items" }],
    },
    ...overrides,
  };
}

describe("buildAiSafetyCalibrationReport", () => {
  it("counts field-used and resolved AI actions as positive follow-through with mitigation credit", () => {
    const report = buildAiSafetyCalibrationReport({
      windowDays: 7,
      now,
      recommendations: [
        aiAction({ id: "rec-field", status: "field_used", risk_reduction_points: 8 }),
        aiAction({ id: "rec-resolved", status: "resolved", risk_reduction_points: 5 }),
      ],
      events: [{ id: "event-1", recommendation_id: "rec-field", event_type: "field_verified", created_at: "2026-05-22T12:00:00.000Z" }],
      outcomes: [{ id: "obs-1", sourceType: "observation", title: "Elevated work observation", severity: "low", jobsiteId: "j1", createdAt: "2026-05-22T12:00:00.000Z" }],
    });

    expect(report.actionOutcomes.fieldUsedCount).toBe(1);
    expect(report.actionOutcomes.resolvedCount).toBe(1);
    expect(report.actionOutcomes.riskReductionPoints).toBe(13);
    expect(report.summary.likelyTruePositiveCount).toBe(2);
  });

  it("lowers acceptance for dismissed actions and gives no mitigation credit", () => {
    const report = buildAiSafetyCalibrationReport({
      windowDays: 7,
      now,
      recommendations: [
        aiAction({ id: "rec-accepted", status: "accepted" }),
        aiAction({ id: "rec-dismissed", status: "dismissed", risk_reduction_points: 10 }),
      ],
      events: [{ id: "event-1", recommendation_id: "rec-dismissed", event_type: "dismissed", created_at: "2026-05-22T12:00:00.000Z" }],
      outcomes: [{ id: "obs-1", sourceType: "observation", title: "General observation", severity: "low", jobsiteId: "j1", createdAt: "2026-05-22T12:00:00.000Z" }],
    });

    expect(report.actionOutcomes.dismissedCount).toBe(1);
    expect(report.actionOutcomes.recommendationAcceptanceRate).toBe(50);
    expect(report.actionOutcomes.riskReductionPoints).toBe(0);
    expect(report.summary.falsePositiveCount).toBe(1);
  });

  it("marks later matching incidents or near misses as follow-up needed", () => {
    const report = buildAiSafetyCalibrationReport({
      windowDays: 7,
      now,
      recommendations: [aiAction({ id: "rec-fall", status: "assigned", created_at: "2026-05-20T12:00:00.000Z" })],
      events: [{ id: "event-1", recommendation_id: "rec-fall", event_type: "assigned", created_at: "2026-05-20T13:00:00.000Z" }],
      outcomes: [
        {
          id: "near-1",
          sourceType: "near_miss",
          title: "Near miss involving elevated deck work",
          hazardCategory: "fall_protection",
          severity: "high",
          jobsiteId: "j1",
          createdAt: "2026-05-21T12:00:00.000Z",
        },
      ],
    });

    expect(report.predictionOutcomes.followUpNeeded).toHaveLength(1);
    expect(report.summary.missedHighRiskEventCount).toBe(0);
  });

  it("returns insufficient data instead of false success when outcome history is absent", () => {
    const report = buildAiSafetyCalibrationReport({
      windowDays: 7,
      now,
      recommendations: [aiAction({ id: "rec-active" })],
      events: [],
      outcomes: [],
    });

    expect(report.summary.status).toBe("insufficient_data");
    expect(report.summary.insufficientDataCount).toBeGreaterThan(0);
    expect(report.missingData.join(" ")).toContain("outcomes were available");
  });

  it("does not hide dismissed critical work behind false-positive logic", () => {
    const report = buildAiSafetyCalibrationReport({
      windowDays: 7,
      now,
      recommendations: [aiAction({ id: "rec-critical", status: "dismissed", priority: "critical" })],
      events: [{ id: "event-1", recommendation_id: "rec-critical", event_type: "dismissed", created_at: "2026-05-22T12:00:00.000Z" }],
      outcomes: [{ id: "obs-1", sourceType: "observation", title: "General observation", severity: "low", jobsiteId: "j1", createdAt: "2026-05-22T12:00:00.000Z" }],
    });

    expect(report.summary.falsePositiveCount).toBe(0);
    expect(report.predictionOutcomes.insufficientData[0]?.reason).toContain("dismissed critical AI action");
  });
});
