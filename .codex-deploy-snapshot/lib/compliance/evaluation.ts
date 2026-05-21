import type { ChecklistEvaluationSummary, ChecklistMatrixRow } from "@/lib/compliance/types";

export type ChecklistEvaluationResponse = {
  surface: "csep" | "peshep";
  sourcePolicy: string;
  rows: ChecklistMatrixRow[];
  summary: ChecklistEvaluationSummary;
};
