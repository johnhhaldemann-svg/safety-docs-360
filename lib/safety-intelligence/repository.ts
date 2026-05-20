import type { SupabaseClient } from "@supabase/supabase-js";
import {
  downloadDocumentsBucketObject,
  uploadDocumentsBucketObject,
} from "@/lib/supabaseStorageServer";
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

const HOT_PAYLOAD_RETENTION_DAYS = 30;
const STORAGE_PAYLOAD_THRESHOLD_BYTES = 32 * 1024;

function payloadHotUntil() {
  return new Date(
    Date.now() + HOT_PAYLOAD_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
}

function safePathPart(value: string | null | undefined) {
  return (value ?? "unknown").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

async function storeLargePayload(params: {
  companyId: string;
  entity: string;
  entityId: string;
  name: string;
  value: unknown;
  contentType?: string;
}) {
  const serialized =
    typeof params.value === "string"
      ? params.value
      : JSON.stringify(params.value);
  if (!serialized || Buffer.byteLength(serialized, "utf8") < STORAGE_PAYLOAD_THRESHOLD_BYTES) {
    return null;
  }

  const key = [
    "system",
    "safety-intelligence",
    safePathPart(params.companyId),
    params.entity,
    safePathPart(params.entityId),
    `${safePathPart(params.name)}.${params.contentType === "text/html" ? "html" : "json"}`,
  ].join("/");

  const upload = await uploadDocumentsBucketObject(
    key,
    Buffer.from(serialized, "utf8"),
    params.contentType ?? "application/json",
    { upsert: true }
  );

  return upload.ok ? upload.key : null;
}

function hasUsefulDraftPayload(value: unknown): value is GeneratedSafetyPlanDraft {
  if (!value || typeof value !== "object") return false;
  return Object.keys(value as Record<string, unknown>).length > 0;
}

async function loadDraftPayloadFromStorage(path: string) {
  const download = await downloadDocumentsBucketObject(path);
  if (!download.ok) {
    throw new Error(download.error || "Generated document not found.");
  }

  try {
    return JSON.parse(download.buffer.toString("utf8")) as GeneratedSafetyPlanDraft;
  } catch {
    throw new Error("Generated document payload could not be read.");
  }
}

function isMissingRelation(message?: string | null) {
  return (message ?? "").toLowerCase().includes("does not exist");
}

function isMissingPerformancePayloadColumn(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return (
    (normalized.includes("storage_path") || normalized.includes("payload_hot_until")) &&
    (normalized.includes("column") ||
      normalized.includes("schema cache") ||
      normalized.includes("could not find"))
  );
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
  const storageId = `${context.bucketRunId}-${reviewType}-${Date.now()}`;
  const [inputSnapshotStoragePath, aiSummaryStoragePath] = await Promise.all([
    storeLargePayload({
      companyId: context.companyId,
      entity: "ai-reviews",
      entityId: storageId,
      name: "input-snapshot",
      value: context.buckets,
    }),
    storeLargePayload({
      companyId: context.companyId,
      entity: "ai-reviews",
      entityId: storageId,
      name: "ai-summary",
      value: aiSummary,
    }),
  ]);

  const row = {
    company_id: context.companyId,
    jobsite_id: context.jobsiteId ?? null,
    bucket_run_id: context.bucketRunId,
    review_type: reviewType,
    status: "reviewed",
    input_snapshot: context.buckets,
    input_snapshot_storage_path: inputSnapshotStoragePath,
    rules_snapshot: context.rulesEvaluations,
    conflicts_snapshot: context.conflictEvaluations,
    ai_summary: aiSummary,
    ai_summary_storage_path: aiSummaryStoragePath,
    model: model ?? null,
    prompt_hash: promptHash ?? null,
    reviewed_at: new Date().toISOString(),
    created_by: actorUserId,
    updated_by: actorUserId,
  };

  let result = await supabase
    .from("company_ai_reviews")
    .insert(row)
    .select("id")
    .single();

  if (result.error && isMissingPerformancePayloadColumn(result.error.message)) {
    const {
      input_snapshot_storage_path: _inputSnapshotStoragePath,
      ai_summary_storage_path: _aiSummaryStoragePath,
      ...legacyRow
    } = row;
    result = await supabase
      .from("company_ai_reviews")
      .insert(legacyRow)
      .select("id")
      .single();
  }

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
  const storageId = `${params.bucketRunId ?? "manual"}-${Date.now()}`;
  const [htmlPreviewStoragePath, draftJsonStoragePath] = await Promise.all([
    storeLargePayload({
      companyId: params.companyId,
      entity: "generated-documents",
      entityId: storageId,
      name: "html-preview",
      value: params.record.htmlPreview,
      contentType: "text/html",
    }),
    storeLargePayload({
      companyId: params.companyId,
      entity: "generated-documents",
      entityId: storageId,
      name: "draft-json",
      value: params.record.draftJson,
    }),
  ]);

  const row = {
    company_id: params.companyId,
    jobsite_id: params.jobsiteId ?? null,
    bucket_run_id: params.bucketRunId ?? null,
    ai_review_id: params.aiReviewId ?? null,
    document_type: params.record.documentType,
    source_document_id: params.sourceDocumentId ?? null,
    title: params.record.title,
    status: "in_review",
    html_preview: params.record.htmlPreview,
    html_preview_storage_path: htmlPreviewStoragePath,
    draft_json: params.record.draftJson,
    draft_json_storage_path: draftJsonStoragePath,
    payload_hot_until: payloadHotUntil(),
    risk_outputs: params.riskOutputs,
    provenance: params.record.provenance,
    created_by: params.actorUserId,
    updated_by: params.actorUserId,
  };

  let result = await supabase
    .from("company_generated_documents")
    .insert(row)
    .select("id")
    .single();

  if (result.error && isMissingPerformancePayloadColumn(result.error.message)) {
    const {
      html_preview_storage_path: _htmlPreviewStoragePath,
      draft_json_storage_path: _draftJsonStoragePath,
      payload_hot_until: _payloadHotUntil,
      ...legacyRow
    } = row;
    result = await supabase
      .from("company_generated_documents")
      .insert(legacyRow)
      .select("id")
      .single();
  }

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

/**
 * Load the `draft_json` for a generated document row, scoped to the caller's
 * company. `companyId` is REQUIRED: this function runs through a service-role
 * client in most routes, which bypasses RLS, so the tenant filter is the only
 * thing preventing a cross-tenant draft leak when a caller guesses another
 * tenant's `generatedDocumentId`.
 *
 * The returned error is intentionally generic ("Generated document not found.")
 * for both "row does not exist" and "row belongs to another tenant" cases so we
 * do not leak row existence across tenants.
 */
export async function loadGeneratedDocumentDraft(
  supabase: LiteClient,
  generatedDocumentId: string,
  companyId: string
) {
  if (!companyId) {
    throw new Error("Generated document not found.");
  }

  let result = await supabase
    .from("company_generated_documents")
    .select("id, document_type, title, draft_json, draft_json_storage_path, company_id")
    .eq("id", generatedDocumentId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (result.error && isMissingPerformancePayloadColumn(result.error.message)) {
    result = await supabase
      .from("company_generated_documents")
      .select("id, document_type, title, draft_json, company_id")
      .eq("id", generatedDocumentId)
      .eq("company_id", companyId)
      .maybeSingle();
  }

  if (result.error) {
    throw new Error(result.error.message || "Generated document not found.");
  }

  if (!result.data) {
    throw new Error("Generated document not found.");
  }

  if (hasUsefulDraftPayload(result.data.draft_json)) {
    return result.data.draft_json;
  }

  const storagePath =
    typeof result.data.draft_json_storage_path === "string"
      ? result.data.draft_json_storage_path.trim()
      : "";
  if (!storagePath) {
    throw new Error("Generated document not found.");
  }

  return loadDraftPayloadFromStorage(storagePath);
}
