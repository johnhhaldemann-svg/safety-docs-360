import type {
  AiKnowledgeEvidence,
  AiKnowledgeIngestCandidate,
  AiKnowledgeNode,
  AiKnowledgePromotionPreview,
  AiKnowledgeProvenanceCertificate,
  AiKnowledgeRiskLevel,
} from "@/lib/aiKnowledgeMap/types";

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

function cleanText(value: unknown, max = 420) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function daysFrom(isoDate: string, days: number) {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function candidateReviewRiskLevel(candidate: AiKnowledgeIngestCandidate) {
  const payloadRisk = text(candidate.proposedPayload.riskLevel);
  const payloadNodeRisk = text((candidate.proposedPayload.node as Record<string, unknown> | undefined)?.riskLevel);
  const metadataRisk = text(candidate.metadata.riskLevel);
  return String(payloadRisk ?? payloadNodeRisk ?? metadataRisk ?? "unknown").toLowerCase() as AiKnowledgeRiskLevel | string;
}

export function candidateRequiresSecondApproval(candidate: AiKnowledgeIngestCandidate) {
  const risk = candidateReviewRiskLevel(candidate);
  return risk === "high" || risk === "critical";
}

export function candidateFirstApproval(candidate: AiKnowledgeIngestCandidate) {
  const first = candidate.metadata.firstApproval;
  if (first && typeof first === "object" && !Array.isArray(first)) {
    const row = first as Record<string, unknown>;
    return {
      reviewedBy: text(row.reviewedBy),
      reviewedAt: text(row.reviewedAt),
      reason: text(row.reason),
    };
  }
  if (candidate.validationStatus === "pending_second_approval") {
    return {
      reviewedBy: candidate.reviewedBy,
      reviewedAt: candidate.reviewedAt,
      reason: candidate.reviewNote,
    };
  }
  return { reviewedBy: null, reviewedAt: null, reason: null };
}

export function candidateHasFirstApproval(candidate: AiKnowledgeIngestCandidate) {
  return candidate.validationStatus === "pending_second_approval" || Boolean(candidateFirstApproval(candidate).reviewedBy);
}

export function candidateSourceKind(candidate: AiKnowledgeIngestCandidate): LearningCandidateSourceKind {
  const sourceKind = text(candidate.metadata.sourceKind);
  if (sourceKind === "internet_source" || sourceKind === "relationship" || sourceKind === "failed_source" || sourceKind === "document") return sourceKind;
  if (candidate.candidateType === "edge") return "relationship";
  if (candidate.candidateType === "failed_source") return "failed_source";
  return "document";
}

export function reviewDueAtForCandidate(candidate: AiKnowledgeIngestCandidate, approvedAt: string) {
  const risk = candidateReviewRiskLevel(candidate);
  if (risk === "high" || risk === "critical") return daysFrom(approvedAt, 60);
  if (candidateSourceKind(candidate) === "internet_source") return daysFrom(approvedAt, 90);
  return daysFrom(approvedAt, 180);
}

function evidenceSummary(candidate: AiKnowledgeIngestCandidate) {
  const evidence = Array.isArray(candidate.metadata.sourceEvidence) && candidate.metadata.sourceEvidence.length > 0
    ? candidate.metadata.sourceEvidence as AiKnowledgeEvidence[]
    : candidate.sourceEvidence;
  return evidence
    .map((entry) => cleanText(`${entry.label}: ${entry.detail}`, 260))
    .filter(Boolean)
    .slice(0, 5);
}

function sourceHash(candidate: AiKnowledgeIngestCandidate) {
  return text(candidate.metadata.source_content_hash)
    ?? text(candidate.metadata.sourceContentHash)
    ?? text(candidate.metadata.contentHash)
    ?? text(candidate.metadata.hash)
    ?? null;
}

export function buildKnowledgeProvenanceCertificate(
  candidate: AiKnowledgeIngestCandidate,
  input: {
    approvedBy: string | null;
    approvedAt: string;
    secondApprovedBy?: string | null;
    secondApprovedAt?: string | null;
    promotedAt?: string;
  },
): AiKnowledgeProvenanceCertificate {
  const first = candidateFirstApproval(candidate);
  const promotedAt = input.promotedAt ?? input.approvedAt;
  const firstApprovedBy = first.reviewedBy ?? input.approvedBy;
  const firstApprovedAt = first.reviewedAt ?? input.approvedAt;
  const secondApprovedBy = input.secondApprovedBy ?? null;
  const secondApprovedAt = input.secondApprovedAt ?? null;
  const reviewerIds = Array.from(new Set([firstApprovedBy, secondApprovedBy ?? input.approvedBy].filter((id): id is string => Boolean(id))));
  return {
    certificateVersion: 1,
    sourceTable: candidate.sourceTable ?? text(candidate.proposedPayload.sourceTable),
    sourceId: candidate.sourceId ?? text(candidate.proposedPayload.sourceId),
    sourceRecordId: candidate.sourceRecordId ?? text(candidate.proposedPayload.sourceRecordId),
    candidateId: candidate.id,
    batchId: candidate.batchId,
    candidateType: candidate.candidateType,
    relationshipType: candidate.relationshipType,
    reviewerIds,
    firstApprovedBy,
    firstApprovedAt,
    secondApprovedBy,
    secondApprovedAt,
    promotedAt,
    evidenceSummary: evidenceSummary(candidate),
    confidenceScore: candidate.confidenceScore,
    riskLevel: candidateReviewRiskLevel(candidate),
    sourceHash: sourceHash(candidate),
    documentHash: text(candidate.metadata.document_hash) ?? text(candidate.metadata.documentHash),
    reviewDueAt: reviewDueAtForCandidate(candidate, promotedAt),
    safetyUse: candidateSourceKind(candidate) === "internet_source" || candidate.metadata.sharedLibrary === true
      ? "Approved general guidance for safety context only"
      : "Approved company-scoped safety graph memory",
    complianceProof: false,
  };
}

export function buildCandidatePromotionPreview(
  candidate: AiKnowledgeIngestCandidate,
  input?: {
    sourceNodeReady?: boolean;
    targetNodeReady?: boolean;
    previewedAt?: string;
    actorUserId?: string | null;
  },
): AiKnowledgePromotionPreview {
  const previewedAt = input?.previewedAt ?? new Date().toISOString();
  const requiresSecondApproval = candidateRequiresSecondApproval(candidate);
  const firstApprovalComplete = candidateHasFirstApproval(candidate);
  const dependencyWarnings: string[] = [];
  if (candidate.candidateType === "edge") {
    if (input?.sourceNodeReady === false) dependencyWarnings.push("Source node must be approved/promoted before this relationship can be trusted.");
    if (input?.targetNodeReady === false) dependencyWarnings.push("Target node must be approved/promoted before this relationship can be trusted.");
  }
  if (requiresSecondApproval && !firstApprovalComplete) dependencyWarnings.push("High/critical memory needs two different Super Admin approvals before promotion.");
  if (requiresSecondApproval && firstApprovalComplete) dependencyWarnings.push("Second approval must come from a different Super Admin.");

  const sourceKind = candidateSourceKind(candidate);
  const affectedSurfaces = [
    "AI Knowledge Map",
    "Gus verified answers",
    "Smart Safety",
    "Risk recommendations",
    candidate.candidateType === "edge" ? "Relationship scoring" : null,
    sourceKind === "document" ? "Document AI Assist" : null,
    candidate.relationshipType?.includes("permit") ? "Permit Copilot" : null,
  ].filter((item): item is string => Boolean(item));

  const provenancePreview = buildKnowledgeProvenanceCertificate(candidate, {
    approvedBy: input?.actorUserId ?? candidate.reviewedBy,
    approvedAt: candidate.reviewedAt ?? previewedAt,
    secondApprovedBy: requiresSecondApproval && firstApprovalComplete ? input?.actorUserId ?? null : null,
    secondApprovedAt: requiresSecondApproval && firstApprovalComplete ? previewedAt : null,
    promotedAt: previewedAt,
  });

  return {
    candidateId: candidate.id,
    candidateType: candidate.candidateType,
    willCreateNode: candidate.candidateType === "node",
    willCreateEdge: candidate.candidateType === "edge",
    willCreateVectorMemory: candidate.candidateType === "node",
    affectedSurfaces,
    relationshipImpact: candidate.candidateType === "edge"
      ? `Approved ${candidate.relationshipType ?? "relationship"} memory can influence graph paths, confidence, and risk recalculation.`
      : null,
    dependencyWarnings,
    confidenceScore: candidate.confidenceScore,
    riskLevel: candidateReviewRiskLevel(candidate),
    requiresSecondApproval,
    firstApprovalComplete,
    reviewDueAt: provenancePreview.reviewDueAt,
    provenancePreview,
  };
}

export function isTrustedMemoryStale(metadata: Record<string, unknown>, referenceDate = new Date()) {
  const certificate = metadata.provenanceCertificate;
  const reviewDueAt = text(metadata.reviewDueAt)
    ?? (certificate && typeof certificate === "object" && !Array.isArray(certificate) ? text((certificate as Record<string, unknown>).reviewDueAt) : null);
  return Boolean(reviewDueAt && Date.parse(reviewDueAt) < referenceDate.getTime());
}
