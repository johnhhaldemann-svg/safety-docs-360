import type { BucketedWorkItem, ConflictEvaluation, GeneratedDocumentRecord, RulesEvaluation } from "@/types/safety-intelligence";

export type SafetyDashboardPayload = {
  summary: {
    totals: {
      bucketRuns: number;
      aiReviews: number;
      openConflicts: number;
      generatedDocuments: number;
    };
    topTrades: Array<{ code: string; count: number }>;
    topHazards: Array<{ code: string; count: number }>;
    openConflictItems: Array<{
      id: string;
      title: string;
      severity: string;
      rationale: string;
    }>;
  } | null;
  trades: Array<{ code: string; name: string }>;
  liveConflicts: Array<{
    id: string;
    conflict_code: string;
    severity: string;
    rationale: string;
  }>;
};

export type IntakePayload = {
  bucketRunId: string;
  bucket: BucketedWorkItem;
  rules: RulesEvaluation;
  conflicts: ConflictEvaluation;
};

export type GeneratedDocumentPayload = {
  generatedDocumentId: string;
  bucketRunId: string;
  aiReviewId: string;
  bucket: BucketedWorkItem;
  rules: RulesEvaluation;
  conflicts: ConflictEvaluation;
  document: GeneratedDocumentRecord;
  risk: {
    summary: string;
    exposures: string[];
    missingControls: string[];
    trendPatterns: string[];
    riskScores: Array<{ scope: string; score: number; band: string }>;
    forecastConflicts: string[];
    correctiveActions: string[];
  };
};

