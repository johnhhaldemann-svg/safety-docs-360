import { describe, expect, it } from "vitest";
import {
  buildAiSafetyReasoningFrame,
  fieldEvidenceSignalsFromGusPhotoReviews,
} from "@/lib/aiSafetyReasoningFrame";
import type {
  AiSafetyActionQueue,
  AiSafetyCalibrationSummary,
  AiSafetyFeedbackInfluence,
  AiSafetyMemoryInfluence,
} from "@/lib/aiSafetyActionQueue";
import type { AiSafetyConflictMap } from "@/lib/aiSafetyConflictMap";
import type { DailyRiskBriefing, PredictiveSafetyWorkItem } from "@/lib/predictiveSafetyEngine";
import { assessSafetyRisk } from "@/lib/safety-ai/riskEngine";

const assessment = assessSafetyRisk({
  jobsiteId: "j1",
  jobsiteName: "North Tower",
  taskType: "Excavation",
  highRiskWorkCategories: ["excavation", "trenching"],
  controlEffectiveness: "missing",
  missingRequiredPermit: true,
  missingRequiredTraining: true,
  missingCompetentPersonReview: true,
  fatalityOrCatastrophicPotential: true,
  missingData: ["competent-person inspection", "utility locate"],
  signals: [
    {
      id: "schedule-1",
      type: "high_risk_work",
      label: "Trench entry",
      hazard: "excavation",
      highRisk: true,
      missingRequiredPermit: true,
      missingCompetentPersonReview: true,
      jobsiteId: "j1",
    },
  ],
});

const work: PredictiveSafetyWorkItem = {
  id: "work-1",
  title: "Trench entry at north utility run",
  timing: "today",
  jobsiteId: "j1",
  jobsiteName: "North Tower",
  date: "2026-05-24",
  trade: "Civil",
  area: "North utility run",
  crewSize: 5,
  riskLevel: "critical",
  riskScore: assessment.score,
  actionTimeframe: assessment.actionTimeframe,
  blockers: [
    {
      id: "permit-1",
      type: "permit",
      severity: "critical",
      label: "Missing excavation permit",
      detail: "Verify excavation permit before trench entry.",
      evidenceRefs: [],
    },
  ],
  controlsToVerify: ["Protective system and access/egress"],
  recommendedControls: assessment.controlRecommendations,
  drivers: assessment.topDrivers.map((driver) => driver.label),
  whyItMatters: "Cave-in exposure can become fatal without protective systems and competent-person review.",
  scoreExplanation: assessment.scoreExplanation,
  humanApprovalRequired: true,
  humanApprovalReason: assessment.humanApprovalReason,
  evidenceRefs: [
    {
      id: "e-schedule-1",
      sourceModule: "company_jobsite_schedule_items",
      sourceId: "schedule-1",
      label: "Trench entry",
      href: "/jobsites/j1/schedule",
      detail: "Scheduled high-risk excavation work.",
    },
  ],
  assessment,
};

function briefing(overrides: Partial<DailyRiskBriefing> = {}): DailyRiskBriefing {
  return {
    generatedAt: "2026-05-24T12:00:00.000Z",
    engineVersion: "test",
    window: { today: "2026-05-24", tomorrow: "2026-05-25", days: 7 },
    headline: "Critical excavation work needs pre-start review.",
    highRiskWork: [work],
    attentionTargets: [],
    readinessBlockers: work.blockers,
    controlsToVerify: [],
    whyThisMatters: [work.whyItMatters],
    missingData: ["weather threshold", "utility locate"],
    confidence: "medium",
    escalationRequired: true,
    stopWorkReviewRecommended: true,
    evidenceRefs: work.evidenceRefs,
    ...overrides,
  };
}

function queue(overrides: Partial<AiSafetyActionQueue> = {}): AiSafetyActionQueue {
  return {
    generatedAt: "2026-05-24T12:00:00.000Z",
    headline: "One AI safety action needs review.",
    items: [
      {
        id: "action-1",
        sourceKey: "ai-safety-action:missing_permit:j1:work-1:permit-1:2026-05-24",
        title: "Missing excavation permit - Trench entry",
        detail: "Verify excavation permit before trench entry.",
        category: "missing_permit",
        riskLevel: "critical",
        priority: "critical",
        ownerRole: "safety_manager",
        dueAt: "2026-05-24T07:00:00.000Z",
        approvalState: "review_required",
        recommendedControl: "Verify excavation permit and competent-person inspection before work proceeds.",
        evidenceRefs: work.evidenceRefs,
        missingInformation: ["competent-person inspection"],
        humanApprovalRequired: true,
        humanApprovalReason: "Critical risk requires safety-manager or competent-person review before work proceeds.",
        sourceWorkItemId: "work-1",
        sourceWorkTitle: work.title,
        jobsiteId: "j1",
        jobsiteName: "North Tower",
        trade: "Civil",
        area: "North utility run",
        targetModule: "permit",
        targetHref: "/permits",
        feedbackInfluence: [],
        feedbackConfidenceAdjustment: "neutral",
        memoryInfluence: [],
      },
    ],
    approvalRequiredCount: 1,
    urgentCount: 1,
    suppressedDuplicateCount: 0,
    suppressedFeedbackCount: 0,
    missingData: ["competent-person inspection"],
    recommendedSupervisorActions: ["Verify excavation permit and competent-person inspection before work proceeds."],
    morningBriefing: ["Critical excavation work needs pre-start review."],
    ...overrides,
  };
}

function conflictMap(overrides: Partial<AiSafetyConflictMap> = {}): AiSafetyConflictMap {
  return {
    generatedAt: "2026-05-24T12:00:00.000Z",
    summary: "Critical readiness conflict detected.",
    findings: [
      {
        id: "conflict-1",
        type: "readiness_conflict",
        riskLevel: "critical",
        confidence: "medium",
        title: "Readiness conflict before trench entry",
        reason: "Critical excavation work is missing readiness verification.",
        dataUsed: ["Trench entry", "Missing excavation permit"],
        missingInformation: ["utility locate"],
        recommendedAction: "Assign review and verify excavation readiness before work proceeds.",
        requiredVerification: "Verify permit, utility locate, protective system, and competent-person review.",
        humanApprovalRequired: true,
        humanApprovalReason: "Critical readiness conflict requires review before work proceeds.",
        evidenceRefs: work.evidenceRefs,
        affectedWorkItemIds: ["work-1"],
        jobsiteId: "j1",
        jobsiteName: "North Tower",
        trade: "Civil",
        area: "North utility run",
        sourceKey: "readiness:j1:work-1",
      },
    ],
    highConflictCount: 1,
    criticalConflictCount: 1,
    missingData: ["area sequencing"],
    confidence: "medium",
    ...overrides,
  };
}

const memoryInfluence: AiSafetyMemoryInfluence = {
  summary: "One jobsite rule influenced recommendations.",
  memoryItemCount: 1,
  basisCounts: {
    company_policy: 0,
    jobsite_rule: 1,
    uploaded_document: 0,
    platform_rule: 0,
    general_best_practice: 0,
    unknown: 0,
  },
  influencedRecommendations: [],
  missingMemoryData: [],
};

const feedbackInfluence: AiSafetyFeedbackInfluence = {
  summary: "No feedback lowered confidence.",
  confidenceAdjustment: "neutral",
  fieldUsedCount: 0,
  resolvedCount: 0,
  dismissedCount: 0,
  suppressedDuplicateCount: 0,
  feedbackSignalCount: 0,
  learningSignals: [],
  missingFeedbackData: [],
};

const calibrationSummary: AiSafetyCalibrationSummary = {
  status: "needs_outcome_data",
  summary: "Calibration needs later outcome data.",
  predictedHighRiskCount: 1,
  predictedCriticalCount: 1,
  fieldUsedControlCount: 0,
  resolvedActionCount: 0,
  riskReductionPoints: 0,
  trackedMetrics: ["field-used controls"],
  missingOutcomeData: ["No later incident or field-used control outcome was available."],
};

describe("AI safety reasoning frame", () => {
  it("generates evidence-grounded reasoning with human review for critical risk", () => {
    const frame = buildAiSafetyReasoningFrame({
      safetyAiAssessment: assessment,
      dailyBriefing: briefing(),
      conflictMap: conflictMap(),
      actionQueue: queue(),
      memoryInfluence,
      feedbackInfluence,
      calibrationSummary,
    });

    expect(frame.goal).toContain("rules-first reasoning");
    expect(frame.hypotheses.length).toBeGreaterThan(0);
    expect(frame.supportingEvidence.length).toBeGreaterThan(0);
    expect(frame.missingInformation).toEqual(expect.arrayContaining(["utility locate"]));
    expect(frame.humanReviewRequired).toBe(true);
    expect(frame.nextBestActions[0]).toEqual(expect.objectContaining({ humanReviewRequired: true }));
    expect(frame.doNotClaim.join(" ")).toMatch(/Do not approve permits/);
  });

  it("lowers decision quality when missing and conflicting signals increase", () => {
    const strong = buildAiSafetyReasoningFrame({
      safetyAiAssessment: assessment,
      dailyBriefing: briefing({ missingData: [] }),
      conflictMap: conflictMap({ findings: [], missingData: [], highConflictCount: 0, criticalConflictCount: 0 }),
      actionQueue: queue({ missingData: [] }),
      memoryInfluence,
      feedbackInfluence: { ...feedbackInfluence, confidenceAdjustment: "increase", feedbackSignalCount: 1 },
      calibrationSummary: { ...calibrationSummary, status: "active", fieldUsedControlCount: 1, missingOutcomeData: [] },
    });
    const weak = buildAiSafetyReasoningFrame({
      safetyAiAssessment: assessment,
      dailyBriefing: briefing({ missingData: ["permit status", "training matrix", "weather threshold", "area", "crew"] }),
      conflictMap: conflictMap({ missingData: ["area sequencing"] }),
      actionQueue: queue({ missingData: ["permit status"] }),
      memoryInfluence,
      feedbackInfluence: {
        ...feedbackInfluence,
        confidenceAdjustment: "decrease",
        learningSignals: ["Reviewer marked a similar recommendation not correct."],
      },
      calibrationSummary,
    });

    expect(strong.decisionQuality.score).toBeGreaterThan(weak.decisionQuality.score);
    expect(weak.uncertainty.level).not.toBe("low");
    expect(weak.conflictingEvidence.map((item) => item.label)).toEqual(expect.arrayContaining(["Reviewer feedback lowered confidence"]));
  });

  it("treats Gus photo review as field evidence that needs verification", () => {
    const [fieldSignal] = fieldEvidenceSignalsFromGusPhotoReviews([
      {
        answer: "Possible missing guardrail visible.",
        riskLevel: "high",
        whatLooksRight: [],
        concerns: ["Open edge appears unprotected"],
        criticalFlags: [],
        missingInformation: ["Exact work location"],
        recommendedControls: ["Verify fall protection plan"],
        nextActions: ["Have a supervisor verify edge protection in the field."],
        limitations: ["Photo angle does not show the full work area."],
        confidence: 0.66,
        draftOnly: true,
        humanReviewRequired: true,
      },
    ]);
    const frame = buildAiSafetyReasoningFrame({
      safetyAiAssessment: assessment,
      dailyBriefing: briefing(),
      conflictMap: conflictMap(),
      actionQueue: queue(),
      memoryInfluence,
      feedbackInfluence,
      calibrationSummary,
      fieldEvidenceSignals: [fieldSignal],
    });

    expect(frame.fieldEvidenceSignals[0]).toEqual(expect.objectContaining({ needsFieldVerification: true }));
    expect(frame.missingInformation.join(" ")).toMatch(/Field verification is required/);
    expect(frame.nextBestActions.map((item) => item.reason)).toEqual(expect.arrayContaining([expect.stringContaining("Photo review is evidence input only")]));
  });
});
