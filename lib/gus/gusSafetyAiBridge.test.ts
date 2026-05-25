import { describe, expect, it } from "vitest";
import {
  buildGusContextFromAiSafetyUnifiedContext,
  buildGusContextFromSafetyDomainUnderstanding,
  buildGusContextFromAiSafetyReasoningFrame,
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

  it("maps reasoning frames into Gus evidence and uncertainty context", () => {
    const context = buildGusContextFromAiSafetyReasoningFrame({
      goal: "Prioritize pre-start safety review.",
      hypotheses: [],
      supportingEvidence: [
        { label: "Missing permit", detail: "Permit status is not active.", source: "daily_briefing", evidenceRefs: [] },
      ],
      conflictingEvidence: [
        { label: "Calibration needs outcome data", detail: "Later outcomes are not linked yet.", source: "calibration", evidenceRefs: [] },
      ],
      missingInformation: ["training status"],
      uncertainty: { level: "medium", summary: "Training status should be verified first.", drivers: ["training status"] },
      decisionBasis: ["High-risk work has missing readiness items."],
      nextBestActions: [
        {
          id: "next-1",
          priority: "before_work",
          title: "Verify permit",
          detail: "Verify permit and training before work proceeds.",
          ownerRole: "safety_manager",
          targetHref: "/permits",
          humanReviewRequired: true,
          reason: "Missing readiness items require review.",
        },
      ],
      humanReviewRequired: true,
      doNotClaim: ["Do not approve permits."],
      decisionQuality: {
        score: 64,
        level: "medium",
        evidenceCoverage: 70,
        missingDataBurden: 24,
        conflictingSignalCount: 1,
        feedbackDirection: "neutral",
        calibrationSupport: "insufficient_data",
        humanReviewSeverity: "high",
      },
      operatingPlan: {
        generatedAt: "2026-05-24T12:00:00.000Z",
        headline: "Review one action.",
        priorities: ["Verify permit"],
        followUps: ["Follow up on permit review."],
        morningBriefing: ["Verify permit"],
        noExternalNotifications: true,
      },
      fieldEvidenceSignals: [],
    });

    expect(context.aiEngineReasoningFrame?.goal).toContain("Prioritize");
    expect(context.aiEngineDecisionQuality?.score).toBe(64);
    expect(context.aiEngineUncertaintySummary?.summary).toContain("Training status");
    expect(context.aiEngineRecommendedNextAction).toContain("Verify permit");
    expect(context.aiEngineApprovalState).toBe("review_required");
  });

  it("maps unified AI Safety context into Gus source-aware coaching context", () => {
    const context = buildGusContextFromAiSafetyUnifiedContext({
      generatedAt: "2026-05-25T12:00:00.000Z",
      sourceCoverage: [
        { sourceSystem: "predictive_risk", label: "Predictive Risk", evidenceCount: 2, conflictCount: 1, status: "available" },
        { sourceSystem: "safety_intelligence", label: "Safety Intelligence", evidenceCount: 1, conflictCount: 1, status: "available" },
      ],
      evidence: [
        {
          id: "ev-1",
          sourceSystem: "safety_intelligence",
          sourceModule: "company_bucket_items",
          sourceId: "bucket-1",
          label: "Roof edge layout",
          detail: "Fall exposure",
          riskLevel: "high",
          confidence: "medium",
          jobsiteId: "j1",
          trade: "roofing",
          area: "Level 4",
          date: "2026-05-25",
          evidenceRefs: [],
        },
      ],
      conflicts: [
        {
          id: "conflict-1",
          sourceSystem: "safety_intelligence",
          sourceKey: "si-conflict",
          type: "hazard_propagation",
          riskLevel: "high",
          confidence: "medium",
          title: "overhead hazard propagation",
          reason: "Overhead work creates downstream exposure.",
          recommendedAction: "Verify drop zone control.",
          requiredVerification: "Verify drop zone control before work proceeds.",
          humanApprovalRequired: true,
          evidenceRefs: [],
          jobsiteId: "j1",
          trade: null,
          area: "Level 4",
          duplicateOf: null,
        },
      ],
      missingInformation: ["work area"],
      conflictingSignals: ["Reviewer feedback lowered confidence for a similar pattern."],
      nextBestActions: [
        {
          id: "next-1",
          title: "Review overhead conflict",
          detail: "Verify drop zone control before work proceeds.",
          sourceSystem: "safety_intelligence",
          humanReviewRequired: true,
        },
      ],
      confidence: "medium",
      doNotClaim: ["Do not approve permits or release work."],
    });

    expect(context.aiEngineUnifiedContext?.sourceCoverage.length).toBe(2);
    expect(context.aiEngineWorkfaceConflicts).toEqual(expect.arrayContaining([expect.stringContaining("safety intelligence")]));
    expect(context.aiEngineRecommendedNextAction).toContain("Verify drop zone control");
    expect(context.aiEngineApprovalState).toBe("review_required");
    expect([...(context.aiEngineWorkfaceConflicts ?? []), ...(context.aiEngineRecommendations ?? [])].join(" ")).not.toMatch(
      /\bapproved\b|\bsafe\b|\bcompliant\b|\bcleared\b|\bguaranteed\b/i,
    );
  });

  it("maps safety-domain understanding into Gus verification coaching context", () => {
    const context = buildGusContextFromSafetyDomainUnderstanding({
      generatedAt: "2026-05-25T12:00:00.000Z",
      headline: "Recognized 1 safety discipline needing field understanding.",
      concepts: [
        {
          id: "fall_protection",
          label: "Fall protection and elevated work",
          discipline: "fall_protection",
          riskLevel: "high",
          confidence: "medium",
          whyItMatters: "Falls are high-consequence exposures.",
          permitOrPlanTriggers: ["fall protection plan"],
          competencySignals: ["competent person for scaffold/working surface review"],
          criticalControls: ["guardrails or verified tie-off"],
          hierarchyCoverage: ["engineering", "administrative", "ppe"],
          verificationQuestions: ["What prevents a worker from reaching the fall edge?"],
          basis: ["platform_rule", "predictive_evidence"],
          evidenceIds: ["ev-1"],
          missingInformation: ["anchor verification"],
        },
      ],
      recognizedDisciplines: ["fall_protection"],
      controlHierarchyGaps: ["Consider whether exposure can be removed or work resequenced before relying on administrative controls or PPE."],
      permitAndPlanFocus: ["fall protection plan"],
      competencyFocus: ["competent person for scaffold/working surface review"],
      fieldVerificationQuestions: ["What prevents a worker from reaching the fall edge?"],
      missingInformation: ["anchor verification"],
      confidence: "medium",
      doNotClaim: ["Do not approve work."],
    });

    expect(context.aiEngineSafetyDisciplines).toEqual(["fall_protection"]);
    expect(context.aiEngineFieldVerificationQuestions).toEqual(expect.arrayContaining([expect.stringContaining("fall edge")]));
    expect(context.aiEngineRecommendedNextAction).toContain("fall edge");
    expect(context.aiEngineRecommendations?.join(" ")).not.toMatch(/\bapproved\b|\bsafe\b|\bcompliant\b|\bcleared\b|\bguaranteed\b/i);
  });
});
