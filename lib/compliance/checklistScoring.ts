import type { ChecklistEvaluationSummary, ChecklistMatrixRow } from "@/lib/compliance/types";
import type { ChecklistMappingEvidence } from "@/lib/compliance/checklistMapping";

function decideConfidence(row: ChecklistMappingEvidence): "high" | "medium" | "low" {
  if (!row.applies) return "low";
  if (row.missingFields.length > 0) return "low";
  if (!row.evidencePresent) return "low";
  if (row.currentFields.length >= 2) return "high";
  return "medium";
}

function decideCoverage(
  row: ChecklistMappingEvidence
): "covered" | "partial" | "missing" | "needs_user_input" | "not_applicable" {
  if (!row.applies) return "not_applicable";
  if (row.missingFields.length > 0) return "needs_user_input";
  if (row.evidencePresent && row.currentFields.length >= 2) return "covered";
  if (row.evidencePresent) return "partial";
  return row.item.requirementType === "always" ? "needs_user_input" : "missing";
}

function guardrailedAction(
  row: ChecklistMappingEvidence,
  coverage: ChecklistMatrixRow["coverage"],
  confidence: ChecklistMatrixRow["confidence"]
): ChecklistMatrixRow["aiAction"] {
  if (coverage === "not_applicable") return "validate";
  if (coverage === "needs_user_input") return "validate";
  if (confidence === "low") {
    return row.item.aiAction === "manual_review" ? "manual_review" : "validate";
  }
  if (confidence === "medium" && row.item.aiAction === "draft") {
    return "recommend";
  }
  return row.item.aiAction;
}

export function buildChecklistMatrixRows(evidenceRows: ChecklistMappingEvidence[]): ChecklistMatrixRow[] {
  return evidenceRows.map((evidence) => {
    const confidence = decideConfidence(evidence);
    const coverage = decideCoverage(evidence);
    const aiAction = guardrailedAction(evidence, coverage, confidence);
    const manualReviewNeeded =
      evidence.item.manualReviewDefault || aiAction === "manual_review" || confidence === "low";

    return {
      id: evidence.item.id,
      category: evidence.item.category,
      item: evidence.item.item,
      appliesTo: evidence.item.appliesTo,
      requirementType: evidence.item.requirementType,
      outputSection: evidence.item.outputSection,
      aiAction,
      requiredUserConfirmation: evidence.item.requiredUserConfirmation,
      manualReviewNeeded,
      confidence,
      coverage,
      currentFields: evidence.currentFields,
      missingFields: evidence.missingFields,
      notes: evidence.notes,
    };
  });
}

export function summarizeChecklistRows(rows: ChecklistMatrixRow[]): ChecklistEvaluationSummary {
  return rows.reduce<ChecklistEvaluationSummary>(
    (summary, row) => {
      summary.total += 1;
      if (row.coverage === "covered") summary.covered += 1;
      if (row.coverage === "partial") summary.partial += 1;
      if (row.coverage === "missing") summary.missing += 1;
      if (row.coverage === "needs_user_input") summary.needsUserInput += 1;
      if (row.manualReviewNeeded) summary.manualReview += 1;
      return summary;
    },
    {
      total: 0,
      covered: 0,
      partial: 0,
      missing: 0,
      needsUserInput: 0,
      manualReview: 0,
    }
  );
}
