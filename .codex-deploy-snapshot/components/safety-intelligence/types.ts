import type {
  BucketedWorkItem,
  ConflictEvaluation,
  GeneratedDocumentRecord,
  RulesEvaluation,
  SafetyReviewPayload,
} from "@/types/safety-intelligence";

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
  auditLogId?: string | null;
  bucketId?: string | null;
  bucketRunId: string;
  bucket: BucketedWorkItem;
  rules: RulesEvaluation;
  conflicts: ConflictEvaluation;
  smartSafetyProvenance?: {
    version: string;
    stages: string[];
    inputHash: string;
    bucketRunId?: string | null;
    auditLogId?: string | null;
    bucketId?: string | null;
  } | null;
  validationStatus?: string;
  removedCompanyTokens?: string[];
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

export type { SafetyReviewPayload };

export type EngineBriefingPayload = {
  briefing?: {
    headline: string;
    lines: Array<{ label: string; detail: string; severity?: string }>;
    preventionScore?: { value: number; band: string } | null;
  };
  smartSafetyProvenance?: IntakePayload["smartSafetyProvenance"];
  error?: string;
};

export type PreTaskChecklistPayload = {
  checklist?: {
    items?: Array<{ id: string; text: string; source: string; required: boolean }>;
  } | Array<{ id: string; text: string; source: string; required: boolean }>;
  smartSafetyProvenance?: IntakePayload["smartSafetyProvenance"];
  error?: string;
};

export type LiveConflictPayload = {
  conflicts: Array<{
    id: string;
    conflict_code: string;
    conflict_type?: string | null;
    severity: string;
    status?: string;
    rationale: string;
    recommended_controls?: string[] | null;
  }>;
  error?: string;
};
