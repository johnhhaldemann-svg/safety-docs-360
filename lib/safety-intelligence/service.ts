import type { AiReviewContext, BucketedWorkItem, JsonObject, RawTaskInput } from "@/types/safety-intelligence";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import { detectConflicts } from "@/lib/safety-intelligence/conflicts";
import { evaluateRules } from "@/lib/safety-intelligence/rules";

export function buildAiReviewContext(params: {
  input: RawTaskInput;
  bucket: BucketedWorkItem;
  peerBuckets?: BucketedWorkItem[];
  riskMemorySummary?: JsonObject | null;
  companyContext?: JsonObject | null;
  templateContext?: JsonObject | null;
}) {
  const bucket = params.bucket ?? buildBucketedWorkItem(params.input);
  const peerBuckets = params.peerBuckets ?? [bucket];
  const rules = evaluateRules(params.input, bucket);
  const peerRules = peerBuckets.map((candidate) =>
    candidate.bucketKey === bucket.bucketKey ? rules : evaluateRules(params.input, candidate)
  );
  const conflicts = detectConflicts(bucket, rules, peerBuckets, peerRules);
  const context: AiReviewContext = {
    companyId: params.input.companyId,
    jobsiteId: params.input.jobsiteId ?? null,
    buckets: [bucket, ...peerBuckets.filter((candidate) => candidate.bucketKey !== bucket.bucketKey)],
    rulesEvaluations: [rules],
    conflictEvaluations: [conflicts],
    riskMemorySummary: params.riskMemorySummary ?? null,
    companyContext: params.companyContext ?? null,
    templateContext: params.templateContext ?? null,
  };
  return { bucket, rules, conflicts, context };
}
