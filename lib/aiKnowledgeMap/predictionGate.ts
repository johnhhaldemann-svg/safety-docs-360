import {
  normalizePredictionReviewRating,
  normalizePredictionValidationStatus,
} from "@/lib/predictionValidation";
import type { AiKnowledgeSourceRow } from "@/lib/aiKnowledgeMap/types";

/**
 * Source tables whose raw records are human-reviewed in the Superadmin
 * Prediction Validation queue (`/superadmin/prediction-validation`).
 *
 * The two surfaces sit on top of the same records: Prediction Validation rates
 * them for the prediction models, and the AI Knowledge Map turns them into graph
 * nodes. This module is the single point where one feeds the other — a
 * Prediction-Validation approval is what lets the record into the trusted map,
 * and its 1–5 quality rating weights the resulting node's confidence.
 */
export const PREDICTION_GATED_TABLES = new Set<string>([
  "company_incidents",
  "company_sor_records",
  "company_corrective_actions",
]);

export function isPredictionGatedTable(table: string): boolean {
  return PREDICTION_GATED_TABLES.has(table);
}

/**
 * Strict gate: rows from gated tables must be `prediction_validation_status === "approved"`
 * before they may enter the Knowledge Map. Rows from non-gated tables always pass.
 */
export function passesPredictionGate(table: string, row: AiKnowledgeSourceRow): boolean {
  if (!isPredictionGatedTable(table)) return true;
  return normalizePredictionValidationStatus(row.prediction_validation_status) === "approved";
}

/**
 * Confidence delta derived from the Prediction Validation 1–5 quality rating:
 * 5★ → +0.15, 4★ → +0.075, 3★ → 0, 2★ → −0.075, 1★ → −0.15. No rating → 0.
 * Only gated tables carry a rating; callers should apply this for those tables.
 */
export function predictionConfidenceDelta(row: AiKnowledgeSourceRow): number {
  const rating = normalizePredictionReviewRating(row.prediction_review_rating);
  if (rating == null) return 0;
  return Number(((rating - 3) * 0.075).toFixed(3));
}
