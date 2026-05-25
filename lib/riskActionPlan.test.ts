import { describe, expect, it } from "vitest";
import {
  buildRiskActionEvidencePack,
  buildRuleBasedRiskActionDrafts,
  calculateRiskReductionPoints,
  inferRiskActionType,
  parseRiskActionDraftsFromModelText,
} from "@/lib/riskActionPlan";
import type { PredictiveRiskPayload } from "@/lib/predictiveRisk";
import type { RiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";

function predictive(overrides?: Partial<PredictiveRiskPayload>): PredictiveRiskPayload {
  return {
    filters: { days: 30, jobsiteId: null, month: null },
    summary: {
      highRiskLocationCount: 0,
      predictedIncidents: 0,
      averageRiskScore: 0,
      averageResidualRiskScore: 0,
      confidencePercent: 0,
      riskSignalCount: 0,
      aiRiskReductionPoints: 0,
      mitigationSummary: "No mitigation in fixture.",
    },
    locations: [],
    drivers: [],
    trend: [],
    actions: [],
    model: {
      version: "test",
      generatedAt: "2026-05-20T00:00:00.000Z",
      confidenceLabel: "Low",
      provenanceNote: "test",
      source: "company",
      predictionSource: "company",
      fallbackUsed: false,
      fallbackReason: null,
      confidenceLevel: "low",
      dataScope: "company_specific",
    },
    behaviorRisk: {
      behaviorRiskScore: 0,
      riskLevel: "Low",
      topDrivers: [],
      recommendedActions: [],
      sourceEvents: [],
      byTrade: [],
      bySupervisor: [],
    },
    safetyAiAssessment: {
      score: 0,
      level: "low",
      confidence: "low",
      scoreExplanation: {
        score: 0,
        level: "low",
        confidence: "low",
        reason: "low risk was assigned from the available AI Engine inputs and source coverage.",
        dataInputs: [],
        missingInformation: [],
        recommendedAction: "Continue monitoring and documenting field conditions.",
        humanApprovalRequired: false,
        humanApprovalReason: null,
        driverSummary: [],
      },
      topDrivers: [],
      recommendations: [],
      controlRecommendations: [],
      escalationRequired: false,
      stopWorkReviewRecommended: false,
      humanApprovalRequired: false,
      humanApprovalReason: null,
      explanation: "No safety AI signals in test fixture.",
      missingData: [],
      criticalControlGaps: [],
      reviewTriggers: [],
      actionTimeframe: "routine",
    },
    dailyBriefing: {
      generatedAt: "2026-05-20T00:00:00.000Z",
      engineVersion: "test",
      window: { today: "2026-05-20", tomorrow: "2026-05-21", days: 30 },
      headline: "No high-risk work in fixture.",
      highRiskWork: [],
      attentionTargets: [],
      readinessBlockers: [],
      controlsToVerify: [],
      whyThisMatters: [],
      missingData: [],
      confidence: "low",
      escalationRequired: false,
      stopWorkReviewRecommended: false,
      evidenceRefs: [],
    },
    aiSafetyConflictMap: {
      generatedAt: "2026-05-20T00:00:00.000Z",
      summary: "No workface conflicts in fixture.",
      findings: [],
      highConflictCount: 0,
      criticalConflictCount: 0,
      missingData: [],
      confidence: "low",
    },
    aiSafetyActionQueue: {
      generatedAt: "2026-05-20T00:00:00.000Z",
      headline: "No AI safety actions in fixture.",
      items: [],
      approvalRequiredCount: 0,
      urgentCount: 0,
      suppressedDuplicateCount: 0,
      suppressedFeedbackCount: 0,
      missingData: [],
      recommendedSupervisorActions: [],
      morningBriefing: [],
    },
    approvalState: {
      overallState: "resolved",
      reviewRequiredCount: 0,
      assignedCount: 0,
      reviewedCount: 0,
      verifiedInFieldCount: 0,
      resolvedCount: 0,
      dismissedWithReasonCount: 0,
      humanReviewRequired: false,
      humanReviewReason: null,
    },
    feedbackInfluence: {
      summary: "No recommendation feedback in fixture.",
      confidenceAdjustment: "neutral",
      fieldUsedCount: 0,
      resolvedCount: 0,
      dismissedCount: 0,
      suppressedDuplicateCount: 0,
      feedbackSignalCount: 0,
      learningSignals: [],
      missingFeedbackData: [],
    },
    memoryInfluence: {
      summary: "No memory influence in fixture.",
      memoryItemCount: 0,
      basisCounts: {
        company_policy: 0,
        jobsite_rule: 0,
        uploaded_document: 0,
        platform_rule: 0,
        general_best_practice: 0,
        unknown: 0,
      },
      influencedRecommendations: [],
      missingMemoryData: [],
    },
    calibrationSummary: {
      status: "needs_outcome_data",
      summary: "No calibration outcomes in fixture.",
      predictedHighRiskCount: 0,
      predictedCriticalCount: 0,
      fieldUsedControlCount: 0,
      resolvedActionCount: 0,
      riskReductionPoints: 0,
      trackedMetrics: [],
      missingOutcomeData: [],
    },
    aiSafetyReasoningFrame: {
      goal: "Prioritize pre-start safety work in the test fixture.",
      hypotheses: [],
      supportingEvidence: [],
      conflictingEvidence: [],
      missingInformation: [],
      uncertainty: { level: "low", summary: "No uncertainty in fixture.", drivers: [] },
      decisionBasis: [],
      nextBestActions: [],
      humanReviewRequired: false,
      doNotClaim: ["Do not approve permits."],
      decisionQuality: {
        score: 80,
        level: "high",
        evidenceCoverage: 80,
        missingDataBurden: 0,
        conflictingSignalCount: 0,
        feedbackDirection: "neutral",
        calibrationSupport: "insufficient_data",
        humanReviewSeverity: "low",
      },
      operatingPlan: {
        generatedAt: "2026-05-20T00:00:00.000Z",
        headline: "No AI safety operating actions in fixture.",
        priorities: [],
        followUps: [],
        morningBriefing: [],
        noExternalNotifications: true,
      },
      fieldEvidenceSignals: [],
    },
    decisionQuality: {
      score: 80,
      level: "high",
      evidenceCoverage: 80,
      missingDataBurden: 0,
      conflictingSignalCount: 0,
      feedbackDirection: "neutral",
      calibrationSupport: "insufficient_data",
      humanReviewSeverity: "low",
    },
    uncertaintySummary: { level: "low", summary: "No uncertainty in fixture.", drivers: [] },
    nextBestActions: [],
    leadershipTrust: {
      lastUpdatedAt: "2026-05-20T00:00:00.000Z",
      dateWindowLabel: "Last 30 days",
      confidenceLabel: "Low",
      confidencePercent: 0,
      sourceCoverage: [],
      missingSignals: [],
      evidenceRefs: [],
      nextActions: [],
      executiveSummary: "test",
      provenanceNote: "test",
    },
    ...overrides,
  };
}

function riskMemory(overrides?: Partial<RiskMemoryStructuredContext>): RiskMemoryStructuredContext {
  return {
    engine: "Safety360 Risk Memory Engine",
    windowDays: 30,
    facetCount: 12,
    topScopes: [{ code: "steel", count: 5 }],
    topHazards: [{ code: "fall", count: 4 }],
    topLocationGrids: [],
    topLocationAreas: [],
    openCorrectiveFacetHints: { openStyleStatuses: 2 },
    aggregated: { score: 10, band: "moderate", sampleSize: 12, baselineContribution: 2 },
    baselineHints: [],
    aggregatedWithBaseline: { score: 18, band: "high" },
    derivedRollupConfidence: 0.72,
    ...overrides,
  };
}

describe("riskActionPlan", () => {
  it("builds an empty evidence pack without inventing signals", () => {
    const pack = buildRiskActionEvidencePack({
      days: 30,
      predictiveRisk: predictive(),
      riskMemory: null,
      memoryItems: [],
    });

    expect(pack.topDrivers).toEqual([]);
    expect(pack.topLocations).toEqual([]);
    expect(pack.riskMemory.facetCount).toBe(0);
    expect(pack.sourceCoverage.find((source) => source.key === "companyMemory")?.status).toBe("missing");
  });

  it("creates high-priority rule actions from high-signal evidence", () => {
    const pack = buildRiskActionEvidencePack({
      days: 30,
      predictiveRisk: predictive({
        locations: [
          {
            id: "site-1",
            label: "North Tower",
            subtitle: null,
            riskScore: 82,
            trendDelta: 9,
            topDriver: "Fall protection",
            sourceCounts: { correctiveActions: 1, incidents: 1, permits: 0, jsaActivities: 0, scheduleItems: 1 },
          },
        ],
        drivers: [{ id: "fall", label: "Fall protection", percent: 56, count: 7 }],
      }),
      riskMemory: riskMemory(),
      memoryItems: [],
    });
    const drafts = buildRuleBasedRiskActionDrafts(pack);

    expect(drafts.length).toBeGreaterThanOrEqual(3);
    expect(drafts[0]?.priority).toBe("critical");
    expect(drafts[0]?.actionType).toBe("stop_work_review");
    expect(drafts.some((draft) => draft.targetModule === "risk_memory")).toBe(true);
  });

  it("rejects malformed LLM output", () => {
    const pack = buildRiskActionEvidencePack({
      days: 30,
      predictiveRisk: predictive(),
      riskMemory: null,
    });

    expect(parseRiskActionDraftsFromModelText("not json", pack)).toEqual([]);
  });

  it("normalizes LLM drafts to supported targets and priorities", () => {
    const pack = buildRiskActionEvidencePack({
      days: 30,
      predictiveRisk: predictive(),
      riskMemory: null,
    });
    const drafts = parseRiskActionDraftsFromModelText(
      JSON.stringify([
        {
          kind: "bad_target",
          title: "Check controls",
          body: "Verify controls before release.",
          confidence: 2,
          priority: "urgent",
          targetModule: "unsupported",
        },
      ]),
      pack
    );

    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.confidence).toBe(0.95);
    expect(drafts[0]?.priority).toBe("medium");
    expect(drafts[0]?.targetModule).toBe("predictive_risk");
    expect(drafts[0]?.actionType).toBe("assign");
  });

  it("infers accountability and permit actions from recommendation text", () => {
    expect(inferRiskActionType({ title: "Disciplinary review required for repeated unsafe acts" })).toBe("accountability_review");
    expect(inferRiskActionType({ title: "Hot work permit verification", targetModule: "permit" })).toBe("request_permit");
  });

  it("only applies risk reduction after verified field use or resolution", () => {
    expect(calculateRiskReductionPoints({ priority: "critical", status: "assigned", mitigationState: "field_verified" })).toBe(0);
    expect(calculateRiskReductionPoints({ priority: "critical", status: "field_used", mitigationState: "assigned" })).toBe(0);
    expect(calculateRiskReductionPoints({ priority: "critical", status: "field_used", mitigationState: "field_verified" })).toBe(18);
  });
});
