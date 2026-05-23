import { describe, expect, it } from "vitest";
import { buildAiSafetyFeedbackSignals, feedbackSignalsForAction } from "@/lib/aiSafetyFeedbackInfluence";

describe("AI safety feedback influence adapter", () => {
  it("normalizes recommendation events and AI-output feedback into deterministic signals", () => {
    const signals = buildAiSafetyFeedbackSignals({
      recommendations: [
        {
          id: "rec-1",
          title: "Review trench entry",
          status: "field_used",
          priority: "high",
          jobsite_id: "j1",
          evidence_summary: {
            aiSafetyAction: {
              sourceKey: "ai-safety-action:competent_person_review:j1:work-1:blocker-1:2026-05-23",
              category: "competent_person_review",
              sourceWorkTitle: "Trench entry",
              jobsiteId: "j1",
            },
          },
        },
      ],
      events: [{ id: "event-1", recommendation_id: "rec-1", event_type: "field_used", to_status: "field_used", created_at: "2026-05-23T12:00:00.000Z" }],
      aiOutputFeedback: [
        {
          id: 2,
          surface: "ai-engine.daily-briefing",
          source_id: "work-1-excavation",
          outcome: "edited",
          reason: "missing_information",
          signal_metadata: { recommendationFeedback: "missing_information", jobsiteId: "j1", hazardFamily: "excavation" },
          created_at: "2026-05-23T13:00:00.000Z",
        },
      ],
    });

    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "already_resolved",
          sourceKey: "ai-safety-action:competent_person_review:j1:work-1:blocker-1:2026-05-23",
          suppressNonCritical: true,
        }),
        expect.objectContaining({
          kind: "missing_information",
          sourceId: "work-1-excavation",
          missingInformation: expect.arrayContaining([expect.stringContaining("missing context")]),
        }),
      ]),
    );
  });

  it("matches feedback to action queue items by source id, jobsite, and hazard text", () => {
    const signals = buildAiSafetyFeedbackSignals({
      aiOutputFeedback: [
        {
          id: 1,
          surface: "ai-engine.daily-briefing",
          source_id: "work-7-fall_protection",
          outcome: "rejected",
          reason: "not_correct",
          signal_metadata: { jobsiteId: "j1", hazardFamily: "fall_protection" },
        },
      ],
    });

    expect(
      feedbackSignalsForAction(
        {
          sourceKey: "ai-safety-action:high_risk_work:j1:work-7:blocker:2026-05-23",
          sourceWorkItemId: "work-7",
          jobsiteId: "j1",
          category: "high_risk_work",
          sourceWorkTitle: "Roof edge layout",
          title: "Review high-risk work - Roof edge layout",
          recommendedControl: "Review fall protection plan before elevated work.",
        },
        signals,
      ),
    ).toHaveLength(1);
  });
});
