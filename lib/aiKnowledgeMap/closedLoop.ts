import type { AiKnowledgeRiskLevel } from "@/lib/aiKnowledgeMap/types";
import type { LearningCandidateSourceKind } from "@/lib/aiKnowledgeMap/reviewGate";

export const AI_ENGINE_MAPPING_SYSTEM_NAME = "AI Engine Mapping System - Closed-Loop Safety Intelligence";

export const CLOSED_LOOP_MEMORY_CATEGORIES = [
  "platform",
  "company",
  "jobsite",
  "jobsite_zone",
  "personnel",
  "training",
  "task",
  "hazard",
  "permit",
  "observation",
  "inspection",
  "corrective_action",
  "recommendation",
  "outcome",
  "evidence",
  "audit_trail",
  "learning_source",
  "human_review",
] as const;

export type ClosedLoopMemoryCategory = (typeof CLOSED_LOOP_MEMORY_CATEGORIES)[number];

export type ClosedLoopReviewItemType =
  | "staged_memory_item"
  | "learning_source"
  | "risk_signal"
  | "recommendation"
  | "learning_event"
  | "scoring_rule_change"
  | "personnel_pattern"
  | "permit_rule"
  | "training_requirement"
  | "jobsite_rule"
  | "company_rule";

const HIGH_IMPACT_REVIEW_TYPES = new Set<ClosedLoopReviewItemType>([
  "scoring_rule_change",
  "personnel_pattern",
  "permit_rule",
  "training_requirement",
  "jobsite_rule",
  "company_rule",
  "learning_event",
]);

export const AI_KNOWLEDGE_MAP_SPEC_COMPARISON = {
  existingFoundation: [
    "ai_knowledge_nodes stores approved map memory.",
    "ai_knowledge_edges stores approved relationships.",
    "ai_knowledge_ingest_candidates stages learned/proposed memory before approval.",
    "ai_vector_memory stores semantic retrieval memory.",
    "ai_engine_events and ai_engine_validation_logs provide event and review audit history.",
  ],
  upgradedByThisModule: [
    "Standard closed-loop memory category names are shared by learning, review, and retrieval code.",
    "Learning metadata explicitly separates extracted, proposed, pending, approved, and official map states.",
    "Human-review rules are centralized for high-impact safety conclusions.",
    "Explainable risk scoring is deterministic and evidence-aware before future LLM enhancements.",
  ],
} as const;

export function closedLoopMemoryCategoryForSourceKind(sourceKind: LearningCandidateSourceKind): ClosedLoopMemoryCategory {
  if (sourceKind === "relationship") return "human_review";
  if (sourceKind === "failed_source") return "learning_source";
  return "learning_source";
}

export function buildClosedLoopSeparationMetadata(input: {
  sourceKind: LearningCandidateSourceKind;
  memoryCategory?: ClosedLoopMemoryCategory;
  riskLevel?: AiKnowledgeRiskLevel | string | null;
}) {
  return {
    aiEngineSystem: AI_ENGINE_MAPPING_SYSTEM_NAME,
    closedLoopMemoryCategory: input.memoryCategory ?? closedLoopMemoryCategoryForSourceKind(input.sourceKind),
    learningSeparation: {
      extractedByAi: true,
      proposedByAi: true,
      pendingHumanReview: true,
      approvedByHuman: false,
      officialMapMemory: false,
      rejectedItemsExcluded: true,
    },
    officialMapStatus: "pending_human_review",
    officialMapWriteAllowed: false,
    recommendationUseAllowed: false,
    riskScoringUseAllowed: false,
    requiresHumanReview: true,
    humanReviewRequired: true,
    trustedMemoryWrite: false,
    reviewGateReason: reviewGateReasonForRisk(input.riskLevel),
  };
}

export function requireClosedLoopHumanReview(input: {
  itemType: ClosedLoopReviewItemType;
  riskLevel?: AiKnowledgeRiskLevel | string | null;
  confidenceScore?: number | null;
  affectsPersonnel?: boolean;
  affectsCompliance?: boolean;
  affectsWorkerAssignment?: boolean;
  conflictingSource?: boolean;
}) {
  const reasons: string[] = [];
  const riskLevel = String(input.riskLevel ?? "unknown").toLowerCase();
  if (HIGH_IMPACT_REVIEW_TYPES.has(input.itemType)) reasons.push(`${input.itemType} changes official safety memory or rules.`);
  if (riskLevel === "high" || riskLevel === "critical") reasons.push("High/critical safety risk requires human approval.");
  if ((input.confidenceScore ?? 1) < 0.7) reasons.push("Low-confidence AI conclusion requires review.");
  if (input.affectsPersonnel) reasons.push("Personnel-level conclusions must be reviewed to prevent bias.");
  if (input.affectsCompliance) reasons.push("Compliance interpretations must be approved before use.");
  if (input.affectsWorkerAssignment) reasons.push("Worker-assignment impacts require human authorization.");
  if (input.conflictingSource) reasons.push("Conflicting source information requires human judgment.");
  return {
    required: reasons.length > 0 || input.itemType === "staged_memory_item" || input.itemType === "learning_source",
    reasons: reasons.length > 0 ? reasons : ["All staged AI learning must be reviewed before entering official map memory."],
  };
}

export function calculateExplainableRiskScore(input: {
  severityScore: number;
  frequencyScore: number;
  exposureScore: number;
  trainingGap?: boolean;
  permitQualityIssue?: boolean;
  repeatObservationCount?: number;
  openCorrectiveActionCount?: number;
  jobsiteZoneRiskScore?: number;
  taskRiskScore?: number;
  weatherOrEnvironmentRisk?: number;
  pastOutcomeEffective?: boolean | null;
  confidenceScore?: number | null;
}) {
  const severity = clamp(input.severityScore, 0, 100);
  const frequency = clamp(input.frequencyScore, 0, 100);
  const exposure = clamp(input.exposureScore, 0, 100);
  const drivers: string[] = [
    `Severity ${severity}`,
    `Frequency ${frequency}`,
    `Exposure ${exposure}`,
  ];

  let score = severity * 0.42 + frequency * 0.24 + exposure * 0.24;
  if (input.trainingGap) {
    score += 8;
    drivers.push("Training gap");
  }
  if (input.permitQualityIssue) {
    score += 6;
    drivers.push("Permit quality issue");
  }
  if ((input.repeatObservationCount ?? 0) > 0) {
    const lift = Math.min(10, (input.repeatObservationCount ?? 0) * 2);
    score += lift;
    drivers.push(`${input.repeatObservationCount} repeat observation${input.repeatObservationCount === 1 ? "" : "s"}`);
  }
  if ((input.openCorrectiveActionCount ?? 0) > 0) {
    const lift = Math.min(10, (input.openCorrectiveActionCount ?? 0) * 3);
    score += lift;
    drivers.push(`${input.openCorrectiveActionCount} open corrective action${input.openCorrectiveActionCount === 1 ? "" : "s"}`);
  }
  score += clamp(input.jobsiteZoneRiskScore ?? 0, 0, 100) * 0.05;
  score += clamp(input.taskRiskScore ?? 0, 0, 100) * 0.05;
  score += clamp(input.weatherOrEnvironmentRisk ?? 0, 0, 100) * 0.04;
  if (input.pastOutcomeEffective === true) {
    score -= 5;
    drivers.push("Previously verified effective control");
  }
  if (input.pastOutcomeEffective === false) {
    score += 8;
    drivers.push("Past control did not reduce risk");
  }

  const confidenceScore = clamp(input.confidenceScore ?? 0.65, 0, 1);
  if (confidenceScore < 0.7) drivers.push("Lower confidence requires conservative review");
  const riskScore = Math.round(clamp(score, 0, 100));
  const riskLevel = riskScore >= 80 ? "critical" : riskScore >= 60 ? "high" : riskScore >= 30 ? "moderate" : "low";
  return {
    riskScore,
    riskLevel,
    confidenceScore,
    explanation: drivers.join("; "),
    evidenceUsed: drivers,
    recommendedAction: riskLevel === "critical"
      ? "Immediate Super Admin/safety review and possible stop-work evaluation."
      : riskLevel === "high"
        ? "Escalate for safety review and verify controls before work proceeds."
        : "Review during normal safety planning and monitor for repeat signals.",
  };
}

function reviewGateReasonForRisk(riskLevel: AiKnowledgeRiskLevel | string | null | undefined) {
  const normalized = String(riskLevel ?? "unknown").toLowerCase();
  if (normalized === "critical" || normalized === "high") {
    return "High-impact learned memory requires Human Review before official map, AI answer, recommendation, or risk-scoring use.";
  }
  return "Learned memory remains staged until Human Review approves it for official map use.";
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
