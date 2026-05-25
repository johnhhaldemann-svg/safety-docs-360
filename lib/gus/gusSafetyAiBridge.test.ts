import { describe, expect, it } from "vitest";
import {
  buildGusContextFromDailyRiskBriefing,
  buildGusContextFromSafetyAiAssessment,
  buildSafetyAiAssessmentForSafePredict,
} from "@/lib/gus/gusSafetyAiBridge";
import { demoSafePredictDataset } from "@/lib/safePredictData";
import type { DailyRiskBriefing } from "@/lib/predictiveSafetyEngine";

describe("Gus Safety AI Engine bridge", () => {
  it("builds a Safety AI assessment from SafePredict context", () => {
    const assessment = buildSafetyAiAssessmentForSafePredict(demoSafePredictDataset, "all");

    expect(assessment.score).toBeGreaterThanOrEqual(0);
    expect(assessment.topDrivers.length + assessment.reviewTriggers.length + assessment.criticalControlGaps.length).toBeGreaterThan(0);
    expect(assessment.actionTimeframe).toMatch(/routine|same_shift|before_work_continues|immediate/);
  });

  it("maps Safety AI assessment fields into Gus context", () => {
    const assessment = buildSafetyAiAssessmentForSafePredict(demoSafePredictDataset, "all");
    const context = buildGusContextFromSafetyAiAssessment(assessment);

    expect(context.aiEngineLinked).toBe(true);
    expect(context.safetyAiAssessment).toBe(assessment);
    expect(context.riskLevel).toMatch(/low|moderate|high|severe/);
    expect(context.aiEngineActionTimeframe).toBe(assessment.actionTimeframe);
    expect(context.aiEngineCriticalControlGaps).toEqual(assessment.criticalControlGaps);
    expect(context.aiEngineReviewTriggers).toEqual(assessment.reviewTriggers);
  });

  it("keeps Safety AI Engine context draft-only and review-oriented for Gus", () => {
    const assessment = buildSafetyAiAssessmentForSafePredict(demoSafePredictDataset, "all");
    const context = buildGusContextFromSafetyAiAssessment(assessment);
    const combined = [
      ...(context.riskDrivers ?? []),
      ...(context.aiEngineRecommendations ?? []),
      ...(context.aiEngineCriticalControlGaps ?? []),
      ...(context.aiEngineReviewTriggers ?? []),
    ].join(" ");

    expect(combined).not.toMatch(/approved|safe to start|released for work|osha compliant/i);
  });

  it("maps daily briefing fields into Gus warning context", () => {
    const assessment = buildSafetyAiAssessmentForSafePredict(demoSafePredictDataset, "all");
    const briefing: DailyRiskBriefing = {
      generatedAt: "2026-05-22T12:00:00.000Z",
      engineVersion: "test",
      window: { today: "2026-05-22", tomorrow: "2026-05-23", days: 7 },
      headline: "Critical risk: excavation.",
      highRiskWork: [
        {
          id: "work-1",
          title: "Excavation at north trench",
          timing: "today",
          jobsiteId: "j1",
          jobsiteName: "North Tower",
          date: "2026-05-22",
          trade: "Civil",
          area: "North trench",
          crewSize: 6,
          riskLevel: "critical",
          riskScore: 91,
          actionTimeframe: "immediate",
          blockers: [],
          controlsToVerify: ["Protective system review"],
          recommendedControls: [],
          drivers: ["Excavation controls"],
          whyItMatters: "Cave-in exposure requires review.",
          scoreExplanation: assessment.scoreExplanation,
          humanApprovalRequired: true,
          humanApprovalReason: "Critical AI Engine risk requires review.",
          evidenceRefs: [],
          assessment,
        },
      ],
      attentionTargets: [],
      readinessBlockers: [
        {
          id: "permit-1",
          type: "permit",
          severity: "critical",
          label: "Missing active permit or authorization",
          detail: "Verify excavation permit.",
          evidenceRefs: [],
        },
        {
          id: "training-1",
          type: "training",
          severity: "high",
          label: "Training readiness gap",
          detail: "Verify required training.",
          evidenceRefs: [],
        },
        {
          id: "conflict-1",
          type: "conflict",
          severity: "high",
          label: "Elevated work overlaps active access below",
          detail: "Verify exclusion zone and dropped-object controls before work proceeds.",
          evidenceRefs: [],
        },
      ],
      controlsToVerify: [
        {
          id: "control-1",
          controlType: "engineering",
          priority: "urgent",
          text: "Protective system review",
          whyItMatters: "Linked to excavation.",
          ownerRole: "competent_person",
          sourceWorkItemIds: ["work-1"],
          evidenceRefs: [],
        },
      ],
      whyThisMatters: ["Cave-in exposure requires review."],
      missingData: [],
      confidence: "high",
      escalationRequired: true,
      stopWorkReviewRecommended: true,
      evidenceRefs: [],
    };

    const context = buildGusContextFromDailyRiskBriefing(briefing);

    expect(context.aiEngineLinked).toBe(true);
    expect(context.aiEngineTopHighRiskWork).toBe("Excavation at north trench at North Tower");
    expect(context.aiEngineRecommendedNextAction).toBe("Protective system review");
    expect(context.aiEngineApprovalState).toBe("review_required");
    expect(context.aiEngineActionQueue).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Missing active permit or authorization"),
        expect.stringContaining("Elevated work overlaps active access below"),
        expect.stringContaining("Review Excavation at north trench"),
      ]),
    );
    expect(context.aiEngineWorkfaceConflicts).toEqual(
      expect.arrayContaining([expect.stringContaining("Elevated work overlaps active access below")]),
    );
    expect(context.aiEngineCalibrationSummary).toContain("Compare AI Engine predictions");
    expect(context.missingPermitTypes).toEqual(["Verify excavation permit."]);
    expect(context.expiredTrainingCount).toBe(1);
    expect(context.riskLevel).toBe("severe");
  });
});
