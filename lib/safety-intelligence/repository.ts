import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AiReviewContext,
  BucketedWorkItem,
  ConflictMatrix,
  ConflictEvaluation,
  GeneratedSafetyPlanDraft,
  GeneratedDocumentRecord,
  RawTaskInput,
  RiskOutputRecord,
  RulesEvaluation,
} from "@/types/safety-intelligence";

type LiteClient = SupabaseClient<any, "public", any>;

function isMissingRelation(message?: string | null) {
  return (message ?? "").toLowerCase().includes("does not exist");
}

function isUuid(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function resolveConflictPairOperationIds(operationIds: string[]) {
  const distinctOperationIds = [...new Set(operationIds.filter(isUuid))];
  if (distinctOperationIds.length === 0) {
    return null;
  }

  if (distinctOperationIds.length === 1) {
    return { leftOperationId: distinctOperationIds[0] ?? null, rightOperationId: null };
  }

  return {
    leftOperationId: distinctOperationIds[0] ?? null,
    rightOperationId: distinctOperationIds[1] ?? null,
  };
}

export async function persistBucketRun(
  supabase: LiteClient,
  input: RawTaskInput,
  bucket: BucketedWorkItem,
  rules: RulesEvaluation,
  conflicts: ConflictEvaluation,
  actorUserId: string
) {
  const runInsert = await supabase
    .from("company_bucket_runs")
    .insert({
      company_id: input.companyId,
      jobsite_id: input.jobsiteId ?? null,
      source_module: input.sourceModule,
      source_id: input.sourceId ?? null,
      run_status: "conflicts_complete",
      intake_payload: input,
      bucket_summary: bucket,
      rules_summary: rules,
      conflict_summary: conflicts,
      created_by: actorUserId,
      updated_by: actorUserId,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (runInsert.error) {
    throw new Error(runInsert.error.message || "Failed to persist bucket run.");
  }

  const runId = String(runInsert.data.id);
  const itemInsert = await supabase.from("company_bucket_items").insert({
    company_id: input.companyId,
    jobsite_id: input.jobsiteId ?? null,
    bucket_run_id: runId,
    source_module: input.sourceModule,
    source_id: input.sourceId ?? null,
    bucket_key: bucket.bucketKey,
    bucket_type: bucket.bucketType,
    starts_at: bucket.startsAt ?? null,
    ends_at: bucket.endsAt ?? null,
    raw_payload: bucket.payload,
    bucket_payload: bucket,
    rule_results: rules,
    conflict_results: conflicts,
    ai_ready: true,
    created_by: actorUserId,
    updated_by: actorUserId,
  });

  if (itemInsert.error) {
    throw new Error(itemInsert.error.message || "Failed to persist bucket item.");
  }

  return runId;
}

export async function persistAiReview(
  supabase: LiteClient,
  context: AiReviewContext,
  reviewType: "document_generation" | "risk_intelligence" | "combined",
  aiSummary: Record<string, unknown>,
  actorUserId: string,
  model?: string | null,
  promptHash?: string | null
) {
  const result = await supabase
    .from("company_ai_reviews")
    .insert({
      company_id: context.companyId,
      jobsite_id: context.jobsiteId ?? null,
      bucket_run_id: context.bucketRunId,
      review_type: reviewType,
      status: "reviewed",
      input_snapshot: context.buckets,
      rules_snapshot: context.rulesEvaluations,
      conflicts_snapshot: context.conflictEvaluations,
      ai_summary: aiSummary,
      model: model ?? null,
      prompt_hash: promptHash ?? null,
      reviewed_at: new Date().toISOString(),
      created_by: actorUserId,
      updated_by: actorUserId,
    })
    .select("id")
    .single();

  if (result.error) {
    throw new Error(result.error.message || "Failed to persist AI review.");
  }

  return String(result.data.id);
}

export async function persistGeneratedDocument(
  supabase: LiteClient,
  params: {
    companyId: string;
    jobsiteId?: string | null;
    bucketRunId?: string | null;
    aiReviewId?: string | null;
    record: GeneratedDocumentRecord;
    riskOutputs: RiskOutputRecord;
    actorUserId: string;
    sourceDocumentId?: string | null;
  }
) {
  const result = await supabase
    .from("company_generated_documents")
    .insert({
      company_id: params.companyId,
      jobsite_id: params.jobsiteId ?? null,
      bucket_run_id: params.bucketRunId ?? null,
      ai_review_id: params.aiReviewId ?? null,
      document_type: params.record.documentType,
      source_document_id: params.sourceDocumentId ?? null,
      title: params.record.title,
      status: "in_review",
      html_preview: params.record.htmlPreview,
      draft_json: params.record.draftJson,
      risk_outputs: params.riskOutputs,
      provenance: params.record.provenance,
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
    })
    .select("id")
    .single();

  if (result.error) {
    throw new Error(result.error.message || "Failed to persist generated document.");
  }

  return String(result.data.id);
}

export async function persistSafetyPlanRun(params: {
  supabase: LiteClient;
  companyId: string;
  jobsiteId?: string | null;
  sourceDocumentId?: string | null;
  generationContext: GeneratedSafetyPlanDraft["provenance"];
  intakePayload: Record<string, unknown>;
  rawInputs: RawTaskInput[];
  buckets: BucketedWorkItem[];
  rules: RulesEvaluation[];
  conflictMatrix: ConflictMatrix;
  actorUserId: string;
}) {
  const runInsert = await params.supabase
    .from("company_bucket_runs")
    .insert({
      company_id: params.companyId,
      jobsite_id: params.jobsiteId ?? null,
      source_module: "manual",
      source_id: params.sourceDocumentId ?? null,
      run_status: "conflicts_complete",
      intake_payload: params.intakePayload,
      bucket_summary: {
        buckets: params.buckets,
        rawInputs: params.rawInputs,
      },
      rules_summary: params.rules,
      conflict_summary: params.conflictMatrix,
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (runInsert.error) {
    throw new Error(runInsert.error.message || "Failed to persist safety plan run.");
  }

  const bucketRunId = String(runInsert.data.id);
  const itemRows = params.buckets.map((bucket) => {
    const ruleResults =
      params.rules.find((row) => row.bucketKey === bucket.bucketKey) ?? null;
    const relatedConflicts = params.conflictMatrix.items.filter((item) =>
      item.relatedBucketKeys.includes(bucket.bucketKey)
    );

    return {
      company_id: params.companyId,
      jobsite_id: params.jobsiteId ?? null,
      bucket_run_id: bucketRunId,
      source_module: "manual",
      source_id: params.sourceDocumentId ?? null,
      bucket_key: bucket.bucketKey,
      bucket_type: bucket.bucketType,
      starts_at: bucket.startsAt ?? null,
      ends_at: bucket.endsAt ?? null,
      raw_payload: bucket.payload,
      bucket_payload: bucket,
      rule_results: ruleResults,
      conflict_results: relatedConflicts,
      ai_ready: true,
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
    };
  });

  const itemInsert = await params.supabase.from("company_bucket_items").insert(itemRows);
  if (itemInsert.error) {
    throw new Error(itemInsert.error.message || "Failed to persist safety plan bucket items.");
  }

  if (params.conflictMatrix.items.length > 0) {
    const conflictRows = params.conflictMatrix.items.flatMap((item) => {
      const operationPair = resolveConflictPairOperationIds(item.operationIds);
      if (!operationPair) return [];

      return {
        company_id: params.companyId,
        jobsite_id: params.jobsiteId ?? null,
        bucket_run_id: bucketRunId,
        left_operation_id: operationPair.leftOperationId,
        right_operation_id: operationPair.rightOperationId,
        conflict_code: item.code,
        conflict_type: item.type,
        severity: item.severity,
        status: "open",
        overlap_scope: {
          sourceScope: item.sourceScope,
          operationIds: item.operationIds,
          relatedBucketKeys: item.relatedBucketKeys,
          resequencingSuggestion: item.resequencingSuggestion ?? null,
        },
        rationale: item.rationale,
        recommended_controls: item.requiredMitigations,
        weather_condition: null,
        created_by: params.actorUserId,
        updated_by: params.actorUserId,
      };
    });

    if (conflictRows.length > 0) {
      const conflictInsert = await params.supabase
        .from("company_conflict_pairs")
        .insert(conflictRows);
      if (conflictInsert.error && !isMissingRelation(conflictInsert.error.message)) {
        throw new Error(conflictInsert.error.message || "Failed to persist safety plan conflicts.");
      }
    }
  }

  return bucketRunId;
}

export async function loadGeneratedDocumentDraft(
  supabase: LiteClient,
  generatedDocumentId: string
) {
  const result = await supabase
    .from("company_generated_documents")
    .select("id, document_type, title, draft_json")
    .eq("id", generatedDocumentId)
    .single();

  if (result.error || !result.data) {
    throw new Error(result.error?.message || "Generated document not found.");
  }

  return result.data.draft_json as GeneratedSafetyPlanDraft;
}
