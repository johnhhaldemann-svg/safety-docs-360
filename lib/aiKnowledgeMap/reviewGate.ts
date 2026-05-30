import type { AiKnowledgeEvidence, AiKnowledgeNode, AiKnowledgeRiskLevel } from "@/lib/aiKnowledgeMap/types";

export const LEARNING_REVIEW_REQUIRED_BANNER = "AI learned new information. Human Review required before it enters the map.";

export type LearningCandidateSourceKind = "document" | "internet_source" | "relationship" | "failed_source";

export function learningCandidateReviewMetadata(input: {
  sourceKind: LearningCandidateSourceKind;
  learnedSummary?: string | null;
  sourceEvidence?: AiKnowledgeEvidence[];
  confidenceScore?: number | null;
  riskLevel?: AiKnowledgeRiskLevel | string | null;
  sourceUrl?: string | null;
  sourceDocument?: string | null;
  extra?: Record<string, unknown>;
}) {
  return {
    ...(input.extra ?? {}),
    sourceKind: input.sourceKind,
    learnedSummary: input.learnedSummary ?? null,
    sourceEvidence: input.sourceEvidence ?? [],
    confidenceScore: input.confidenceScore ?? null,
    riskLevel: input.riskLevel ?? null,
    sourceUrl: input.sourceUrl ?? null,
    sourceDocument: input.sourceDocument ?? null,
    requiresHumanReview: true,
    humanReviewRequired: true,
    trustedMemoryWrite: false,
  };
}

export function isLearningCandidateReviewGated(metadata: Record<string, unknown>) {
  return metadata.requiresHumanReview === true && metadata.trustedMemoryWrite === false;
}

export function isLearningNode(node: AiKnowledgeNode) {
  return (
    node.metadata.requiresHumanReview === true
    || node.metadata.humanReviewRequired === true
    || (node.metadata.trustedMemoryWrite === false && (node.metadata.sourceKind === "document" || node.metadata.sourceKind === "internet_source"))
  );
}

export function isLearningNodeVisibleOnMap(node: AiKnowledgeNode) {
  return !isLearningNode(node) || node.validationStatus === "approved";
}
