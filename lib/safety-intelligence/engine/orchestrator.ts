import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { retrieveMemoryForQuery } from "@/lib/companyMemory/repository";
import { buildPreventionLogicResult } from "@/lib/safety-intelligence/engine/preventionLogic";
import { buildSafetyMemorySnapshot } from "@/lib/safety-intelligence/engine/memorySnapshot";
import { buildAiReviewContext } from "@/lib/safety-intelligence/service";
import type {
  AiReviewContext,
  BucketedWorkItem,
  ConflictEvaluation,
  JsonObject,
  RawTaskInput,
  RulesEvaluation,
  SafetyIntelligenceDocumentType,
} from "@/types/safety-intelligence";

export const SMART_SAFETY_ENGINE_VERSION = "1.0.0";

export function isSafetyIntelligenceRagEnabled(): boolean {
  return process.env.SAFETY_INTELLIGENCE_RAG?.trim() === "1";
}

function synthesizeRagQuery(input: RawTaskInput, bucket: BucketedWorkItem): string {
  const hazards = [...bucket.hazardFamilies, ...(input.hazardFamilies ?? [])].join(" ");
  return [bucket.taskTitle, input.description, hazards].filter(Boolean).join(" ").trim().slice(0, 500);
}

function truncateExcerpt(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 3)).trimEnd()}...`;
}

/**
 * Staged Smart Safety context: foundation -> buckets/rules/conflicts (via buildAiReviewContext)
 * -> memory snapshot -> prevention logic -> optional RAG excerpts.
 */
export async function buildSmartSafetyAiReviewContext(params: {
  input: RawTaskInput;
  bucket: BucketedWorkItem;
  peerBuckets?: BucketedWorkItem[];
  riskMemorySummary?: JsonObject | null;
  companyContext?: JsonObject | null;
  templateContext?: JsonObject | null;
  documentType?: SafetyIntelligenceDocumentType | null;
  bucketRunId?: string | null;
  supabase: SupabaseClient | null;
}): Promise<{
  reviewContext: AiReviewContext;
  bucket: BucketedWorkItem;
  rules: RulesEvaluation;
  conflicts: ConflictEvaluation;
  stages: string[];
}> {
  const stages = ["foundation", "buckets", "rules", "conflicts", "memory_snapshot", "prevention_logic"];
  const { bucket, rules, conflicts, context } = buildAiReviewContext({
    input: params.input,
    bucket: params.bucket,
    peerBuckets: params.peerBuckets,
    riskMemorySummary: params.riskMemorySummary ?? null,
    companyContext: params.companyContext ?? null,
    templateContext: params.templateContext ?? null,
  });

  const snapshot = buildSafetyMemorySnapshot({
    input: params.input,
    bucket,
    rules,
    conflicts,
    riskMemorySummary: params.riskMemorySummary ?? null,
  });

  const prevention = buildPreventionLogicResult({
    input: params.input,
    bucket,
    rules,
    conflicts,
    riskMemorySummary: params.riskMemorySummary ?? null,
  });

  let ragMemoryExcerpts: AiReviewContext["ragMemoryExcerpts"] = null;
  if (isSafetyIntelligenceRagEnabled() && params.supabase) {
    const q = synthesizeRagQuery(params.input, bucket);
    if (q.length >= 8) {
      stages.push("rag_memory");
      const { chunks } = await retrieveMemoryForQuery(params.supabase, params.input.companyId, q, { topK: 5 });
      ragMemoryExcerpts = chunks.map((c) => ({
        title: c.title?.trim() || "Memory",
        excerpt: truncateExcerpt(c.body ?? "", 480),
      }));
    }
  }

  const inputHash = createHash("sha256")
    .update(
      JSON.stringify({
        c: params.input.companyId,
        j: params.input.jobsiteId ?? null,
        t: params.bucket.taskTitle,
        k: params.bucket.bucketKey,
      })
    )
    .digest("hex")
    .slice(0, 20);

  const reviewContext: AiReviewContext = {
    ...context,
    bucketRunId: params.bucketRunId ?? context.bucketRunId,
    documentType: params.documentType ?? context.documentType,
    safetyMemorySnapshot: snapshot,
    preventionLogic: prevention,
    smartSafetyProvenance: {
      version: SMART_SAFETY_ENGINE_VERSION,
      stages,
      inputHash,
    },
    ragMemoryExcerpts,
  };

  return { reviewContext, bucket, rules, conflicts, stages };
}

/** Multi-operation safety plan: enrich an already-built AiReviewContext using the primary operation row. */
export async function attachSmartSafetyEngineLayers(params: {
  context: AiReviewContext;
  primaryInput: RawTaskInput;
  primaryBucket: BucketedWorkItem;
  primaryRules: RulesEvaluation;
  primaryConflicts: ConflictEvaluation;
  supabase: SupabaseClient | null;
}): Promise<AiReviewContext> {
  const stages = ["memory_snapshot", "prevention_logic"];
  const snapshot = buildSafetyMemorySnapshot({
    input: params.primaryInput,
    bucket: params.primaryBucket,
    rules: params.primaryRules,
    conflicts: params.primaryConflicts,
    riskMemorySummary: params.context.riskMemorySummary ?? null,
  });
  const prevention = buildPreventionLogicResult({
    input: params.primaryInput,
    bucket: params.primaryBucket,
    rules: params.primaryRules,
    conflicts: params.primaryConflicts,
    riskMemorySummary: params.context.riskMemorySummary ?? null,
  });

  let ragMemoryExcerpts = params.context.ragMemoryExcerpts ?? null;
  if (isSafetyIntelligenceRagEnabled() && params.supabase) {
    const q = synthesizeRagQuery(params.primaryInput, params.primaryBucket);
    if (q.length >= 8) {
      stages.push("rag_memory");
      const { chunks } = await retrieveMemoryForQuery(
        params.supabase,
        params.primaryInput.companyId,
        q,
        { topK: 5 }
      );
      ragMemoryExcerpts = chunks.map((c) => ({
        title: c.title?.trim() || "Memory",
        excerpt: truncateExcerpt(c.body ?? "", 480),
      }));
    }
  }

  const inputHash = createHash("sha256")
    .update(
      JSON.stringify({
        c: params.context.companyId,
        j: params.context.jobsiteId ?? null,
        t: params.primaryBucket.taskTitle,
        k: params.primaryBucket.bucketKey,
      })
    )
    .digest("hex")
    .slice(0, 20);

  return {
    ...params.context,
    safetyMemorySnapshot: snapshot,
    preventionLogic: prevention,
    smartSafetyProvenance: {
      version: SMART_SAFETY_ENGINE_VERSION,
      stages,
      inputHash,
    },
    ragMemoryExcerpts,
  };
}
