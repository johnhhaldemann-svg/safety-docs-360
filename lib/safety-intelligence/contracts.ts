import type {
  AiReviewContext,
  BucketedWorkItem,
  ConflictEvaluation,
  DocumentGenerationRequest,
  RawTaskInput,
  RiskIntelligenceRequest,
  RulesEvaluation,
} from "@/types/safety-intelligence";

export type SafetyIntelligencePipeline = {
  raw: RawTaskInput;
  bucketed: BucketedWorkItem;
  rules: RulesEvaluation;
  conflicts: ConflictEvaluation;
  aiReview: AiReviewContext;
  documentRequest: DocumentGenerationRequest;
  riskRequest: RiskIntelligenceRequest;
};

export type SafetyIntelligenceDashboardSummary = {
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
};

