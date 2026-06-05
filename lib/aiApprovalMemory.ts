import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePredictionReviewRating } from "@/lib/predictionValidation";

/**
 * AI Approval Memory Bank.
 *
 * Captures every human approve/reject decision as a permanent, labeled example so the
 * AI can later learn what is approvable and what is not. This is intentionally
 * surface-agnostic: Prediction Validation writes here today, and the AI Knowledge Map
 * candidate/relationship reviews can write here next with no schema change.
 *
 * Writes are best-effort — `recordApprovalDecisions` never throws, so a logging failure
 * (or an un-migrated environment) can never block the underlying approval action.
 */

export const APPROVAL_MEMORY_SURFACES = [
  "prediction_validation",
  "knowledge_map_candidate",
  "knowledge_map_relationship",
] as const;
export type ApprovalMemorySurface = (typeof APPROVAL_MEMORY_SURFACES)[number];

export const APPROVAL_MEMORY_DECISIONS = ["approved", "rejected"] as const;
export type ApprovalMemoryDecision = (typeof APPROVAL_MEMORY_DECISIONS)[number];

export type ApprovalMemoryInput = {
  decision: ApprovalMemoryDecision;
  surface: ApprovalMemorySurface;
  sourceType?: string | null;
  sourceTable?: string | null;
  sourceRecordId?: string | null;
  companyId?: string | null;
  title?: string | null;
  content?: string | null;
  category?: string | null;
  severity?: string | null;
  riskLevel?: string | null;
  rating?: number | null;
  tags?: string[] | null;
  reason?: string | null;
  features?: Record<string, unknown> | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
};

type DbClient = Pick<SupabaseClient, "from">;

function text(value: unknown): string | null {
  const next = String(value ?? "").replace(/\s+/g, " ").trim();
  return next || null;
}

/** Maps an `ApprovalMemoryInput` into the snake_case row shape for `ai_approval_memory`. */
export function buildApprovalMemoryRow(input: ApprovalMemoryInput) {
  return {
    decision: input.decision,
    surface: input.surface,
    source_type: input.sourceType ?? null,
    source_table: input.sourceTable ?? null,
    source_record_id: input.sourceRecordId ?? null,
    company_id: input.companyId ?? null,
    title: input.title ?? null,
    content: input.content ?? null,
    category: input.category ?? null,
    severity: input.severity ?? null,
    risk_level: input.riskLevel ?? null,
    rating: input.rating ?? null,
    tags: input.tags ?? [],
    reason: input.reason ?? null,
    features:
      input.features && typeof input.features === "object" && !Array.isArray(input.features)
        ? input.features
        : {},
    reviewed_by: input.reviewedBy ?? null,
    reviewed_at: input.reviewedAt ?? null,
  };
}

export type PredictionApprovalMemoryParams = {
  decision: ApprovalMemoryDecision;
  sourceType: "sor" | "incident" | "injury" | "corrective_action";
  row: Record<string, unknown>;
  rating: number | null;
  notes: string | null;
  tags: string[];
  reviewedBy: string | null;
  reviewedAt: string | null;
};

/** Builds an approval-memory example from a Prediction Validation source record + decision. */
export function buildPredictionApprovalMemory(params: PredictionApprovalMemoryParams): ApprovalMemoryInput {
  const { decision, sourceType, row, rating, notes, tags, reviewedBy, reviewedAt } = params;
  const sourceTable =
    sourceType === "sor"
      ? "company_sor_records"
      : sourceType === "corrective_action"
        ? "company_corrective_actions"
        : "company_incidents";

  const title = sourceType === "sor" ? text(row.description)?.slice(0, 140) ?? null : text(row.title);
  const content = [text(row.title), text(row.description)].filter(Boolean).join(" — ") || null;

  const features: Record<string, unknown> = {};
  for (const [key, value] of Object.entries({
    project: row.project,
    trade: row.trade,
    exposureEventType: row.exposure_event_type,
    injuryType: row.injury_type,
    bodyPart: row.body_part,
    hazardCategoryCode: row.hazard_category_code,
    status: row.status,
  })) {
    const cleaned = text(value);
    if (cleaned) features[key] = cleaned;
  }

  return {
    decision,
    surface: "prediction_validation",
    sourceType,
    sourceTable,
    sourceRecordId: text(row.id),
    companyId: text(row.company_id),
    title,
    content,
    category: text(row.category),
    severity: text(row.severity),
    riskLevel: null,
    rating: normalizePredictionReviewRating(rating),
    tags,
    reason: notes,
    features,
    reviewedBy,
    reviewedAt,
  };
}

/** Knowledge Map reviews use a three-way status; the memory bank label is binary. */
export type KnowledgeApprovalStatus = "approved" | "rejected" | "incorrect";

function decisionFromKnowledgeStatus(status: KnowledgeApprovalStatus): ApprovalMemoryDecision {
  return status === "approved" ? "approved" : "rejected";
}

export type KnowledgeCandidateLike = {
  id: string;
  companyId: string | null;
  candidateType: string;
  relationshipType?: string | null;
  sourceTable?: string | null;
  sourceRecordId?: string | null;
  title?: string | null;
  semanticSummary?: string | null;
  confidenceScore?: number | null;
};

/** Builds an approval-memory example from an AI Knowledge Map ingest candidate review. */
export function buildKnowledgeCandidateApprovalMemory(
  candidate: KnowledgeCandidateLike,
  params: { status: KnowledgeApprovalStatus; reason: string | null; reviewedBy: string | null; reviewedAt: string | null }
): ApprovalMemoryInput {
  const features: Record<string, unknown> = { candidateType: candidate.candidateType, reviewStatus: params.status };
  if (candidate.relationshipType) features.relationshipType = candidate.relationshipType;
  if (typeof candidate.confidenceScore === "number") features.confidenceScore = candidate.confidenceScore;
  return {
    decision: decisionFromKnowledgeStatus(params.status),
    surface: "knowledge_map_candidate",
    sourceType: candidate.candidateType,
    sourceTable: candidate.sourceTable ?? null,
    sourceRecordId: candidate.sourceRecordId ?? candidate.id,
    companyId: candidate.companyId,
    title: text(candidate.title),
    content: [text(candidate.title), text(candidate.semanticSummary)].filter(Boolean).join(" — ") || null,
    reason: text(params.reason),
    features,
    reviewedBy: params.reviewedBy,
    reviewedAt: params.reviewedAt,
  };
}

export type KnowledgeRelationshipLike = {
  id?: string;
  companyId: string | null;
  relationshipType: string;
  reason?: string | null;
  evidenceText?: string | null;
  confidenceScore?: number | null;
};

/** Builds an approval-memory example from an AI Knowledge Map relationship (edge) review. */
export function buildKnowledgeRelationshipApprovalMemory(
  edge: KnowledgeRelationshipLike,
  params: { edgeId: string; status: KnowledgeApprovalStatus; reason: string | null; reviewedBy: string | null; reviewedAt: string | null }
): ApprovalMemoryInput {
  const features: Record<string, unknown> = { relationshipType: edge.relationshipType, reviewStatus: params.status };
  if (typeof edge.confidenceScore === "number") features.confidenceScore = edge.confidenceScore;
  return {
    decision: decisionFromKnowledgeStatus(params.status),
    surface: "knowledge_map_relationship",
    sourceType: edge.relationshipType,
    sourceTable: "ai_knowledge_edges",
    sourceRecordId: edge.id ?? params.edgeId,
    companyId: edge.companyId,
    title: text(edge.relationshipType),
    content: [text(edge.reason), text(edge.evidenceText)].filter(Boolean).join(" — ") || null,
    reason: text(params.reason),
    features,
    reviewedBy: params.reviewedBy,
    reviewedAt: params.reviewedAt,
  };
}

/**
 * Appends approval/rejection examples to the memory bank. Best-effort: returns the count
 * recorded and any error string, but never throws — callers should not await this on a path
 * where a failure should surface to the user.
 */
export async function recordApprovalDecisions(
  admin: DbClient,
  inputs: ApprovalMemoryInput[]
): Promise<{ recorded: number; error: string | null }> {
  if (inputs.length === 0) return { recorded: 0, error: null };
  const rows = inputs.map(buildApprovalMemoryRow);
  try {
    const { error } = await admin.from("ai_approval_memory").insert(rows);
    if (error) return { recorded: 0, error: error.message ?? "Failed to record approval memory." };
    return { recorded: rows.length, error: null };
  } catch (error) {
    return { recorded: 0, error: error instanceof Error ? error.message : "Failed to record approval memory." };
  }
}
