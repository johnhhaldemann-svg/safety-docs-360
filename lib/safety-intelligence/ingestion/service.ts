import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreparedSafetyIntake } from "@/types/safety-intelligence";
import {
  fetchCompanyRedactionContext,
  insertSafetyDataBucket,
  logIngestionAttempt,
  updateIngestionAttempt,
} from "@/lib/safety-intelligence/ingestion/repository";
import { prepareSafetyIntake } from "@/lib/safety-intelligence/ingestion/validate";

type LiteClient = SupabaseClient<any, "public", any>;

export async function runSafetyIntakePipeline(params: {
  supabase: LiteClient;
  body: unknown;
  companyId: string;
  defaultCompanyName?: string | null;
  defaultJobsiteId?: string | null;
  actorUserId?: string | null;
}) {
  const companyContext =
    params.defaultCompanyName?.trim()
      ? { companyName: params.defaultCompanyName.trim() }
      : await fetchCompanyRedactionContext(params.supabase, params.companyId);

  const prepared = prepareSafetyIntake({
    body: params.body,
    companyId: params.companyId,
    companyName: companyContext.companyName,
    defaultJobsiteId: params.defaultJobsiteId ?? null,
  });

  const auditLogId = await logIngestionAttempt(params.supabase, {
    prepared,
    actorUserId: params.actorUserId ?? null,
  });

  if (prepared.validationStatus === "rejected") {
    return {
      auditLogId,
      bucketId: null,
      prepared,
    };
  }

  try {
    const bucketRecord = await insertSafetyDataBucket(params.supabase, {
      auditLogId,
      prepared,
      actorUserId: params.actorUserId ?? null,
    });

    await updateIngestionAttempt(params.supabase, {
      auditLogId,
      insertStatus: "inserted",
      bucketId: bucketRecord.id,
    });

    return {
      auditLogId,
      bucketId: bucketRecord.id,
      prepared,
      bucketRecord,
    };
  } catch (error) {
    await updateIngestionAttempt(params.supabase, {
      auditLogId,
      insertStatus: "failed",
      insertError: error instanceof Error ? error.message : "Bucket insert failed.",
    });

    throw error;
  }
}

export function isAcceptedIntake(prepared: PreparedSafetyIntake) {
  return prepared.validationStatus === "accepted" && Boolean(prepared.normalizedRecord);
}
