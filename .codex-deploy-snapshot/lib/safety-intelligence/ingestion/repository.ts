import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PreparedSafetyIntake,
  SafetyDataBucketRecord,
  SafetyIngestionInsertStatus,
} from "@/types/safety-intelligence";

type LiteClient = SupabaseClient<any, "public", any>;

export async function fetchCompanyRedactionContext(supabase: LiteClient, companyId: string) {
  const result = await supabase
    .from("companies")
    .select("name, team_key")
    .eq("id", companyId)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message || "Failed to load company redaction context.");
  }

  return {
    companyName: result.data?.name?.trim() || result.data?.team_key?.trim() || null,
  };
}

export async function logIngestionAttempt(
  supabase: LiteClient,
  params: {
    prepared: PreparedSafetyIntake;
    actorUserId?: string | null;
  }
) {
  const result = await supabase
    .from("ingestion_audit_log")
    .insert({
      company_id: params.prepared.companyId,
      jobsite_id: params.prepared.jobsiteId ?? null,
      source_type: params.prepared.sourceType,
      source_record_id: params.prepared.sourceRecordId ?? null,
      validation_status: params.prepared.validationStatus,
      insert_status: params.prepared.validationStatus === "accepted" ? "pending" : "skipped",
      validation_errors: params.prepared.validationErrors,
      raw_payload_hash: params.prepared.rawPayloadHash,
      sanitized_payload: params.prepared.sanitizedPayload,
      removed_company_tokens: params.prepared.removedCompanyTokens,
      actor_user_id: params.actorUserId ?? null,
      processed_at: params.prepared.validationStatus === "accepted" ? null : new Date().toISOString(),
    })
    .select("id")
    .single();

  if (result.error) {
    throw new Error(result.error.message || "Failed to write ingestion audit log.");
  }

  return String(result.data.id);
}

export async function updateIngestionAttempt(
  supabase: LiteClient,
  params: {
    auditLogId: string;
    insertStatus: SafetyIngestionInsertStatus;
    bucketId?: string | null;
    insertError?: string | null;
  }
) {
  const result = await supabase
    .from("ingestion_audit_log")
    .update({
      insert_status: params.insertStatus,
      bucket_id: params.bucketId ?? null,
      insert_error: params.insertError ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", params.auditLogId);

  if (result.error) {
    throw new Error(result.error.message || "Failed to update ingestion audit log.");
  }
}

export async function insertSafetyDataBucket(
  supabase: LiteClient,
  params: {
    auditLogId: string;
    prepared: PreparedSafetyIntake;
    actorUserId?: string | null;
  }
) {
  if (!params.prepared.normalizedRecord) {
    throw new Error("Cannot insert bucket record without a validated normalized record.");
  }

  const record = params.prepared.normalizedRecord;
  const normalizedPayload = {
    sourceType: record.sourceType,
    sourceRecordId: record.sourceRecordId ?? null,
    title: record.title,
    summary: record.summary ?? null,
    description: record.description ?? null,
    severity: record.severity,
    trade: record.trade ?? null,
    category: record.category ?? null,
    sourceCreatedAt: record.sourceCreatedAt,
    eventAt: record.eventAt ?? null,
    reportedAt: record.reportedAt ?? null,
    dueAt: record.dueAt ?? null,
    validFrom: record.validFrom ?? null,
    validTo: record.validTo ?? null,
  };

  const result = await supabase
    .from("safety_data_bucket")
    .insert({
      company_id: record.companyId,
      jobsite_id: record.jobsiteId ?? null,
      ingestion_audit_log_id: params.auditLogId,
      source_type: record.sourceType,
      source_record_id: record.sourceRecordId ?? null,
      title: record.title,
      summary: record.summary ?? null,
      description: record.description ?? null,
      severity: record.severity,
      trade_code: record.trade ?? null,
      category_code: record.category ?? null,
      source_created_at: record.sourceCreatedAt,
      event_at: record.eventAt ?? null,
      reported_at: record.reportedAt ?? null,
      due_at: record.dueAt ?? null,
      valid_from: record.validFrom ?? null,
      valid_to: record.validTo ?? null,
      raw_payload_hash: params.prepared.rawPayloadHash,
      removed_company_tokens: params.prepared.removedCompanyTokens,
      sanitized_payload: params.prepared.sanitizedPayload,
      normalized_payload: normalizedPayload,
      created_by: params.actorUserId ?? null,
      updated_by: params.actorUserId ?? null,
    })
    .select("*")
    .single();

  if (result.error) {
    throw new Error(result.error.message || "Failed to write sanitized record to safety bucket.");
  }

  return {
    id: String(result.data.id),
    companyId: String(result.data.company_id),
    jobsiteId: (result.data.jobsite_id as string | null) ?? null,
    ingestionAuditLogId: String(result.data.ingestion_audit_log_id),
    sourceType: result.data.source_type,
    sourceRecordId: (result.data.source_record_id as string | null) ?? null,
    title: String(result.data.title),
    summary: (result.data.summary as string | null) ?? null,
    description: (result.data.description as string | null) ?? null,
    severity: result.data.severity,
    trade: (result.data.trade_code as string | null) ?? null,
    category: (result.data.category_code as string | null) ?? null,
    sourceCreatedAt: String(result.data.source_created_at),
    eventAt: (result.data.event_at as string | null) ?? null,
    reportedAt: (result.data.reported_at as string | null) ?? null,
    dueAt: (result.data.due_at as string | null) ?? null,
    validFrom: (result.data.valid_from as string | null) ?? null,
    validTo: (result.data.valid_to as string | null) ?? null,
    rawPayloadHash: String(result.data.raw_payload_hash),
    removedCompanyTokens: (result.data.removed_company_tokens as string[]) ?? [],
    sanitizedPayload: (result.data.sanitized_payload as SafetyDataBucketRecord["sanitizedPayload"]) ?? {},
    normalizedPayload: (result.data.normalized_payload as SafetyDataBucketRecord["normalizedPayload"]) ?? {},
    aiReady: Boolean(result.data.ai_ready),
  } satisfies SafetyDataBucketRecord;
}
