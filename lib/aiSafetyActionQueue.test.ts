import { describe, expect, it } from "vitest";
import { buildAiSafetyClosedLoopPayload } from "@/lib/aiSafetyActionQueue";
import { buildPredictiveSafetyEngineBriefing } from "@/lib/predictiveSafetyEngine";
import { buildAiSafetyConflictMap } from "@/lib/aiSafetyConflictMap";

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
          decisionTriggers: expect.arrayContaining([
            expect.objectContaining({
              actionWord: "verify",
              intent: "request_field_verification",
              humanReviewRequired: true,
            }),
          ]),
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

  it("applies feedback signals to confidence, missing information, escalation, and suppression without hiding critical risk", () => {
    const sourceBriefing = briefing({
      scheduleItems: [
        {
          id: "s1",
          jobsite_id: "j1",
          title: "Roof edge layout",
          work_start_date: "2026-05-22",
          trade: "Roofing",
          risk_level: "high",
          is_high_risk: true,
        },
        {
          id: "s2",
          jobsite_id: "j1",
          title: "Temporary access review",
          work_start_date: "2026-05-22",
          trade: "General",
          risk_level: "high",
          is_high_risk: true,
        },
        {
          id: "s3",
          jobsite_id: "j1",
          title: "Critical lift over active access route",
          work_start_date: "2026-05-22",
          trade: "Steel",
          risk_level: "critical",
          is_high_risk: true,
        },
      ],
    });
    const dailyBriefing = {
      ...sourceBriefing,
      highRiskWork: sourceBriefing.highRiskWork.map((work) =>
        work.title === "Temporary access review"
          ? {
              ...work,
              blockers: [],
              riskLevel: "moderate" as const,
              riskScore: 52,
              humanApprovalRequired: false,
              humanApprovalReason: null,
            }
          : {
              ...work,
              blockers: [],
            },
      ),
      readinessBlockers: [],
    };

    const loop = buildAiSafetyClosedLoopPayload({
      dailyBriefing,
      feedbackSignals: [
        {
          id: "missing-info",
          kind: "missing_information",
          confidenceAdjustment: "neutral",
          reason: "Missing info",
          sourceId: "schedule-s1-fall_protection",
          sourceKey: null,
          jobsiteId: "j1",
          category: "fall_protection",
          hazardFamily: "fall_protection",
          sourceWorkTitle: "Roof edge layout",
          missingInformation: ["Reviewer feedback flagged missing rescue-plan status."],
          suppressNonCritical: false,
          forceHumanReview: false,
          createdAt: null,
        },
        {
          id: "escalate",
          kind: "escalate",
          confidenceAdjustment: "neutral",
          reason: "Escalate",
          sourceId: "schedule-s1-fall_protection",
          sourceKey: null,
          jobsiteId: "j1",
          category: "fall_protection",
          hazardFamily: "fall_protection",
          sourceWorkTitle: "Roof edge layout",
          missingInformation: [],
          suppressNonCritical: false,
          forceHumanReview: true,
          createdAt: null,
        },
        {
          id: "ignore",
          kind: "ignore_for_project",
          confidenceAdjustment: "decrease",
          reason: "Ignore",
          sourceId: "schedule-s2-access",
          sourceKey: null,
          jobsiteId: "j1",
          category: "access",
          hazardFamily: "access",
          sourceWorkTitle: "Temporary access review",
          missingInformation: [],
          suppressNonCritical: true,
          forceHumanReview: false,
          createdAt: null,
        },
        {
          id: "critical-ignore",
          kind: "ignore_for_project",
          confidenceAdjustment: "decrease",
          reason: "Ignore",
          sourceId: "schedule-s3-crane",
          sourceKey: null,
          jobsiteId: "j1",
          category: "crane",
          hazardFamily: "crane",
          sourceWorkTitle: "Critical lift over active access route",
          missingInformation: [],
          suppressNonCritical: true,
          forceHumanReview: false,
          createdAt: null,
        },
      ],
      now: NOW,
    });

    const roofAction = loop.aiSafetyActionQueue.items.find((item) => item.sourceWorkTitle === "Roof edge layout");
    expect(roofAction).toEqual(
      expect.objectContaining({
        approvalState: "review_required",
        humanApprovalRequired: true,
        feedbackConfidenceAdjustment: "neutral",
      }),
    );
    expect(roofAction?.missingInformation).toEqual(expect.arrayContaining(["Reviewer feedback flagged missing rescue-plan status."]));
    expect(loop.aiSafetyActionQueue.items.some((item) => item.sourceWorkTitle === "Temporary access review")).toBe(false);
    expect(loop.aiSafetyActionQueue.items.some((item) => item.sourceWorkTitle === "Critical lift over active access route")).toBe(true);
    expect(loop.feedbackInfluence.learningSignals.join(" ")).toContain("reviewer feedback");
  });

  it("turns high and critical conflict findings into reviewable action queue items", () => {
    const sourceBriefing = briefing({
      scheduleItems: [
        {
          id: "hot-work",
          jobsite_id: "j1",
          title: "Hot work grinding west stair",
          work_start_date: "2026-05-22",
          trade: "Steel",
          work_area: "Level 2",
          risk_level: "high",
          is_high_risk: true,
        },
        {
          id: "paint-storage",
          jobsite_id: "j1",
          title: "Paint and solvent material staging",
          work_start_date: "2026-05-22",
          trade: "Finishes",
          work_area: "Level 2",
          risk_level: "moderate",
          is_high_risk: true,
        },
      ],
    });
    const conflictMap = buildAiSafetyConflictMap({ dailyBriefing: sourceBriefing, now: NOW });

    const loop = buildAiSafetyClosedLoopPayload({
      dailyBriefing: sourceBriefing,
      conflictFindings: conflictMap.findings,
      now: NOW,
    });

    expect(conflictMap.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "adjacent_work_conflict",
          title: "Hot work overlaps combustible or flammable exposure",
        }),
      ]),
    );
    expect(loop.aiSafetyActionQueue.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "workface_conflict_review",
          approvalState: "review_required",
          targetModule: "command_center",
          humanApprovalRequired: true,
        }),
      ]),
    );
  });

  it("turns high and critical field evidence into reviewable action queue items", () => {
    const sourceBriefing = briefing({
      scheduleItems: [
        {
          id: "roof-edge",
          jobsite_id: "j1",
          title: "Roof edge layout",
          work_start_date: "2026-05-22",
          trade: "Roofing",
          work_area: "Roof edge",
          risk_level: "high",
          is_high_risk: true,
        },
      ],
    });

    const loop = buildAiSafetyClosedLoopPayload({
      dailyBriefing: sourceBriefing,
      fieldEvidenceSignals: [
        {
          id: "field-1",
          source: "gus_photo_review",
          sourceKey: "gus-photo-review:co1:j1:u1:1",
          jobsiteId: "j1",
          linkedWorkItemId: sourceBriefing.highRiskWork[0]?.id ?? null,
          linkedWorkTitle: "Roof edge layout",
          riskLevel: "critical",
          confidence: "medium",
          concerns: ["Roof edge fall exposure"],
          criticalFlags: ["Possible unprotected edge"],
          missingInformation: ["Exact location and crew exposure"],
          recommendedControls: ["Verify fall protection plan and edge protection"],
          nextActions: ["Have the supervisor verify the roof edge in the field."],
          limitations: ["Photo angle does not show full work area."],
          evidenceRefs: [],
          needsFieldVerification: true,
        },
      ],
      now: NOW,
    });

    expect(loop.aiSafetyActionQueue.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "field_evidence_review",
          riskLevel: "critical",
          approvalState: "review_required",
          humanApprovalRequired: true,
          targetModule: "command_center",
          humanApprovalReason: expect.stringContaining("possible stop-work evaluation"),
        }),
      ]),
    );
  });
});
