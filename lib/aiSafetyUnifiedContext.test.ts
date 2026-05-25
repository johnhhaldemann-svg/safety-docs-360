import { describe, expect, it } from "vitest";
import { buildAiSafetyUnifiedContext } from "@/lib/aiSafetyUnifiedContext";
import type { AiSafetyActionQueue } from "@/lib/aiSafetyActionQueue";
import type { AiSafetyConflictMap } from "@/lib/aiSafetyConflictMap";
import type { AiSafetyReasoningFrame } from "@/lib/aiSafetyReasoningFrame";
import type { DailyRiskBriefing, PredictiveSafetyWorkItem } from "@/lib/predictiveSafetyEngine";
import type { SafetyAiAssessment } from "@/lib/safety-ai/types";

const NOW = new Date("2026-05-25T12:00:00.000Z");

const assessment: SafetyAiAssessment = {
  score: 78,
  level: "high",
  confidence: "medium",
  scoreExplanation: {
    score: 78,
    level: "high",
    confidence: "medium",
    reason: "High-risk scheduled work has readiness gaps.",
    dataInputs: ["Schedule: Roof layout"],
    missingInformation: ["permit status"],
    recommendedAction: "Verify controls before work proceeds.",
    humanApprovalRequired: true,
    humanApprovalReason: "High-risk work requires human review.",
    driverSummary: ["fall exposure"],
  },
  topDrivers: [{ label: "Fall exposure", category: "severity", impact: "high", explanation: "Elevated work is planned." }],
  recommendations: [],
  controlRecommendations: [],
  escalationRequired: true,
  stopWorkReviewRecommended: false,
  humanApprovalRequired: true,
  humanApprovalReason: "High-risk work requires human review.",
  explanation: "Based on available data.",
  missingData: ["permit status"],
  criticalControlGaps: ["edge protection"],
  reviewTriggers: ["missing permit"],
  actionTimeframe: "before_work_continues",
};

function work(): PredictiveSafetyWorkItem {
  return {
    id: "work-1",
    title: "Roof edge layout",
    timing: "today",
    jobsiteId: "job-1",
    jobsiteName: "North",
    date: "2026-05-25",
    trade: "roofing",
    area: "Level 4",
    crewSize: 4,
    riskLevel: "high",
    riskScore: 78,
    actionTimeframe: "before_work_continues",
    blockers: [],
    controlsToVerify: ["fall protection plan"],
    recommendedControls: [],
    drivers: ["fall exposure"],
    whyItMatters: "Falls can cause serious injury.",
    scoreExplanation: assessment.scoreExplanation,
    humanApprovalRequired: true,
    humanApprovalReason: "High-risk work requires human review.",
    evidenceRefs: [{ id: "schedule-1", sourceModule: "company_jobsite_schedule_items", sourceId: "work-1", label: "Roof edge layout", href: "/jobsites/job-1/schedule", detail: null }],
    assessment,
  };
}

function briefing(): DailyRiskBriefing {
  return {
    generatedAt: NOW.toISOString(),
    engineVersion: "test",
    window: { today: "2026-05-25", tomorrow: "2026-05-26", days: 30 },
    headline: "Review high-risk work.",
    highRiskWork: [work()],
    attentionTargets: [],
    readinessBlockers: [],
    controlsToVerify: [],
    whyThisMatters: ["Falls can cause serious injury."],
    missingData: ["permit status"],
    confidence: "medium",
    escalationRequired: true,
    stopWorkReviewRecommended: false,
    evidenceRefs: [],
  };
}

function queue(): AiSafetyActionQueue {
  return {
    generatedAt: NOW.toISOString(),
    headline: "1 action needs review.",
    items: [],
    approvalRequiredCount: 0,
    urgentCount: 0,
    suppressedDuplicateCount: 0,
    suppressedFeedbackCount: 0,
    missingData: [],
    recommendedSupervisorActions: [],
    morningBriefing: [],
  };
}

function conflictMap(): AiSafetyConflictMap {
  return {
    generatedAt: NOW.toISOString(),
    summary: "One predictive conflict.",
    findings: [
      {
        id: "conflict-1",
        type: "adjacent_work_conflict",
        riskLevel: "high",
        confidence: "medium",
        title: "Elevated work overlaps active access below",
        reason: "Elevated work and access below are in the same work window.",
        dataUsed: ["Roof edge layout"],
        missingInformation: [],
        recommendedAction: "Separate the exposure.",
        requiredVerification: "Verify exclusion zone before work proceeds.",
        humanApprovalRequired: true,
        humanApprovalReason: "High-risk workface conflict requires review.",
        evidenceRefs: [],
        affectedWorkItemIds: ["work-1"],
        jobsiteId: "job-1",
        jobsiteName: "North",
        trade: "roofing",
        area: "Level 4",
        sourceKey: "predictive-conflict:job-1:level-4:elevated-access",
      },
    ],
    highConflictCount: 1,
    criticalConflictCount: 0,
    missingData: [],
    confidence: "medium",
  };
}

function reasoningFrame(): AiSafetyReasoningFrame {
  return {
    goal: "Explain AI Safety Engine decision quality.",
    hypotheses: [],
    supportingEvidence: [{ label: "Roof edge layout", detail: "Elevated work is planned.", source: "daily_briefing.high_risk_work", evidenceRefs: [] }],
    conflictingEvidence: [],
    missingInformation: ["permit status"],
    uncertainty: { level: "medium", summary: "Permit status is missing.", drivers: ["permit status"] },
    decisionBasis: ["rules-first"],
    nextBestActions: [],
    humanReviewRequired: true,
    doNotClaim: [],
    decisionQuality: {
      score: 70,
      level: "medium",
      evidenceCoverage: 70,
      missingDataBurden: 20,
      conflictingSignalCount: 0,
      feedbackDirection: "neutral",
      calibrationSupport: "limited",
      humanReviewSeverity: "high",
    },
    operatingPlan: { generatedAt: NOW.toISOString(), headline: "Review work.", priorities: [], followUps: [], morningBriefing: [], noExternalNotifications: true },
    fieldEvidenceSignals: [],
  };
}

describe("buildAiSafetyUnifiedContext", () => {
  it("normalizes predictive and Safety Intelligence evidence into one context", () => {
    const context = buildAiSafetyUnifiedContext({
      safetyAiAssessment: assessment,
      dailyBriefing: briefing(),
      conflictMap: conflictMap(),
      actionQueue: queue(),
      reasoningFrame: reasoningFrame(),
      safetyIntelligenceBucketItems: [
        {
          id: "bucket-1",
          jobsite_id: "job-1",
          bucket_key: "bucket-roof",
          starts_at: "2026-05-25T08:00:00.000Z",
          bucket_payload: {
            bucketKey: "bucket-roof",
            taskTitle: "Roof edge layout",
            tradeCode: "roofing",
            workAreaLabel: "Level 4",
            startsAt: "2026-05-25T08:00:00.000Z",
            hazardFamilies: ["fall"],
            permitTriggers: ["elevated_work_notice"],
            requiredControls: ["fall protection plan"],
          },
          rule_results: {
            bucketKey: "bucket-roof",
            findings: [],
            permitTriggers: ["elevated_work_notice"],
            hazardFamilies: ["fall"],
            hazardCategories: [],
            ppeRequirements: [],
            equipmentChecks: [],
            weatherRestrictions: [],
            requiredControls: ["fall protection plan"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            trainingRequirements: [],
            score: 12,
            band: "high",
            evaluationVersion: "test",
          },
          conflict_results: [
            {
              code: "overhead_hazard_propagation",
              type: "hazard_propagation",
              severity: "high",
              sourceScope: "external_jobsite",
              rationale: "Overhead work creates downstream exposure.",
              operationIds: ["op-1", "op-2"],
              relatedBucketKeys: ["bucket-roof", "bucket-access"],
              requiredMitigations: ["drop_zone_control"],
              permitDependencies: [],
              resequencingSuggestion: "Create an isolated work window.",
              metadata: { workAreaLabel: "Level 4" },
            },
          ],
        },
      ],
      safetyIntelligenceConflictPairs: [
        {
          id: "pair-1",
          jobsite_id: "job-1",
          left_operation_id: "op-1",
          right_operation_id: "op-2",
          conflict_code: "overhead_hazard_propagation",
          conflict_type: "hazard_propagation",
          severity: "high",
          status: "open",
          rationale: "Open conflict from Safety Intelligence.",
          recommended_controls: ["drop_zone_control"],
          overlap_scope: { workAreaLabel: "Level 4", resequencingSuggestion: "Create an isolated work window." },
        },
      ],
      now: NOW,
    });

    expect(context.sourceCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceSystem: "predictive_risk", status: "available" }),
        expect.objectContaining({ sourceSystem: "safety_intelligence", status: "available" }),
      ]),
    );
    expect(context.evidence).toEqual(expect.arrayContaining([expect.objectContaining({ sourceSystem: "safety_intelligence", label: "Roof edge layout" })]));
    expect(context.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ sourceSystem: "safety_intelligence", riskLevel: "high" })]));
    expect(context.nextBestActions.map((item) => item.detail).join(" ")).toContain("before work proceeds");
  });

  it("keeps sparse Safety Intelligence rows with lower confidence and missing-data notes", () => {
    const context = buildAiSafetyUnifiedContext({
      safetyAiAssessment: assessment,
      dailyBriefing: briefing(),
      conflictMap: { ...conflictMap(), findings: [] },
      actionQueue: queue(),
      reasoningFrame: reasoningFrame(),
      safetyIntelligenceConflictPairs: [
        {
          id: "pair-2",
          conflict_code: "schedule_overlap",
          severity: "high",
          status: "open",
          rationale: "Operations overlap in time.",
          recommended_controls: ["daily_coordination_meeting"],
        },
      ],
      now: NOW,
    });

    expect(context.conflicts[0]).toEqual(expect.objectContaining({ confidence: "low" }));
    expect(context.missingInformation).toEqual(expect.arrayContaining(["conflict jobsite"]));
  });
});
