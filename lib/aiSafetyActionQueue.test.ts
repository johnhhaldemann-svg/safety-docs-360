import { describe, expect, it } from "vitest";
import { buildAiSafetyClosedLoopPayload } from "@/lib/aiSafetyActionQueue";
import { buildPredictiveSafetyEngineBriefing } from "@/lib/predictiveSafetyEngine";

const NOW = new Date("2026-05-22T12:00:00.000Z");

function briefing(overrides: Partial<Parameters<typeof buildPredictiveSafetyEngineBriefing>[0]> = {}) {
  return buildPredictiveSafetyEngineBriefing({
    days: 7,
    now: NOW,
    jobsites: [{ id: "j1", name: "North Tower", location: "Austin", status: "active" }],
    correctiveActions: [],
    incidents: [],
    permits: [],
    jsaActivities: [],
    scheduleItems: [],
    observations: [],
    trainingGaps: [],
    weatherAlerts: [],
    memoryItems: [],
    ...overrides,
  });
}

describe("buildAiSafetyClosedLoopPayload", () => {
  it("turns daily briefing blockers into human-reviewed safety actions", () => {
    const sourceBriefing = briefing({
      scheduleItems: [
        {
          id: "s1",
          jobsite_id: "j1",
          title: "Critical lift over active access route",
          work_start_date: "2026-05-22",
          trade: "Steel",
          work_area: "Level 4",
          risk_level: "critical",
          is_high_risk: true,
          permit_triggers: ["lift plan"],
        },
      ],
    });

    const loop = buildAiSafetyClosedLoopPayload({ dailyBriefing: sourceBriefing, now: NOW });

    expect(loop.aiSafetyActionQueue.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "missing_permit",
          approvalState: "review_required",
          humanApprovalRequired: true,
          ownerRole: "safety_manager",
          targetModule: "permit",
        }),
      ]),
    );
    expect(loop.approvalState).toEqual(
      expect.objectContaining({
        overallState: "review_required",
        humanReviewRequired: true,
      }),
    );
  });

  it("uses resolved recommendation outcomes to suppress duplicate non-critical actions without hiding critical risk", () => {
    const sourceBriefing = briefing({
      scheduleItems: [
        {
          id: "s1",
          jobsite_id: "j1",
          title: "Telehandler backing through shared access route",
          work_start_date: "2026-05-22",
          trade: "Logistics",
          risk_level: "high",
          is_high_risk: true,
        },
        {
          id: "s2",
          jobsite_id: "j1",
          title: "Critical lift over active access route",
          work_start_date: "2026-05-22",
          trade: "Steel",
          risk_level: "critical",
          is_high_risk: true,
          permit_triggers: ["lift plan"],
        },
      ],
    });
    const telehandlerWork = sourceBriefing.highRiskWork.find((work) => work.title === "Telehandler backing through shared access route");
    const dailyBriefing = {
      ...sourceBriefing,
      highRiskWork: sourceBriefing.highRiskWork.map((work) =>
        work.id === telehandlerWork?.id
          ? {
              ...work,
              blockers: [],
              riskLevel: "high" as const,
              riskScore: 72,
              humanApprovalRequired: true,
              humanApprovalReason: "High-risk mobile equipment work requires review.",
            }
          : work,
      ),
      readinessBlockers: sourceBriefing.readinessBlockers.filter((blocker) => blocker.id.includes("s2")),
    };

    const loop = buildAiSafetyClosedLoopPayload({
      dailyBriefing,
      riskMitigations: [
        {
          title: "Review high-risk work - Telehandler backing through shared access route",
          status: "resolved",
          risk_reduction_points: 4,
        },
      ],
      now: NOW,
    });

    expect(loop.aiSafetyActionQueue.suppressedDuplicateCount).toBeGreaterThan(0);
    expect(loop.aiSafetyActionQueue.items.some((item) => item.sourceWorkTitle === "Critical lift over active access route")).toBe(true);
    expect(loop.feedbackInfluence.learningSignals.some((signal) => signal.includes("suppress duplicate"))).toBe(true);
  });

  it("surfaces memory basis and calibration status from existing rows", () => {
    const dailyBriefing = briefing({
      scheduleItems: [
        {
          id: "s1",
          jobsite_id: "j1",
          title: "Roof edge layout",
          work_start_date: "2026-05-22",
          risk_level: "high",
          is_high_risk: true,
        },
      ],
      memoryItems: [
        {
          id: "m1",
          title: "Site fall protection rule",
          source_type: "uploaded_document",
          summary: "Rescue plan required for elevated work.",
        },
      ],
    });

    const loop = buildAiSafetyClosedLoopPayload({
      dailyBriefing,
      memoryItems: [
        {
          id: "m1",
          title: "Site fall protection rule",
          source_type: "uploaded_document",
          summary: "Rescue plan required for elevated work.",
        },
      ],
      riskMitigations: [{ title: "Verify fall plan", status: "field_used", risk_reduction_points: 5 }],
      now: NOW,
    });

    expect(loop.memoryInfluence.influencedRecommendations).toEqual(
      expect.arrayContaining([expect.objectContaining({ basis: "uploaded_document" })]),
    );
    expect(loop.calibrationSummary).toEqual(
      expect.objectContaining({
        status: "active",
        fieldUsedControlCount: 1,
        riskReductionPoints: 5,
      }),
    );
  });
});
