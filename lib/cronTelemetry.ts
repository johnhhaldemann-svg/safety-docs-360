import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { serverLog } from "@/lib/serverLog";

type CronTelemetryResult = {
  response: NextResponse;
  processedCount?: number | null;
  metadata?: Record<string, unknown>;
};

type PlatformJobStatus = "succeeded" | "failed" | "partial";

function statusFromResponse(response: NextResponse): PlatformJobStatus {
  if (response.status >= 500) return "failed";
  if (response.status >= 400) return "partial";
  return "succeeded";
}

function errorCodeFromStatus(status: number) {
  if (status < 400) return null;
  return `http_${status}`;
}

function normalizeMetadata(value?: Record<string, unknown>) {
  return value && typeof value === "object" ? value : {};
}

export async function withCronTelemetry(
  jobName: string,
  handler: () => Promise<CronTelemetryResult>
) {
  const startedAt = Date.now();
  const startedIso = new Date(startedAt).toISOString();
  const admin = createSupabaseAdminClient();
  let jobRunId: string | null = null;

  if (admin) {
    const jobRuns = admin.from("platform_job_runs") as unknown as {
      insert?: (values: Record<string, unknown>) => {
        select?: (columns: string) => {
          maybeSingle?: () => Promise<{ data?: { id?: unknown } | null; error?: { message?: string } | null }>;
        };
      };
    };
    const insertQuery = jobRuns.insert?.({
      job_name: jobName,
      status: "running",
      started_at: startedIso,
    });
    const singleQuery = insertQuery?.select?.("id").maybeSingle?.();

    if (singleQuery) {
      const { data, error } = await singleQuery;
      if (error) {
        serverLog("warn", "cron_telemetry_start_failed", {
          jobName,
          message: error.message?.slice(0, 200) ?? "unknown",
        });
      } else {
        jobRunId = typeof data?.id === "string" ? data.id : null;
      }
    }
  }

  async function finish(params: {
    status: PlatformJobStatus;
    responseStatus?: number;
    processedCount?: number | null;
    metadata?: Record<string, unknown>;
    error?: unknown;
  }) {
    const completedAt = Date.now();
    const durationMs = Math.max(0, completedAt - startedAt);
    const message =
      params.error instanceof Error
        ? params.error.message
        : params.error
          ? String(params.error)
          : null;

    serverLog(params.status === "failed" ? "error" : "info", "cron_job_completed", {
      jobName,
      status: params.status,
      durationMs,
      processedCount: params.processedCount ?? null,
      responseStatus: params.responseStatus ?? null,
      errorMessage: message?.slice(0, 240) ?? null,
    });

    if (!admin || !jobRunId) return;

    const jobRuns = admin.from("platform_job_runs") as unknown as {
      update?: (values: Record<string, unknown>) => {
        eq?: (column: string, value: string) => Promise<{ error?: { message?: string } | null }>;
      };
    };
    const updateQuery = jobRuns.update?.({
      status: params.status,
      completed_at: new Date(completedAt).toISOString(),
      duration_ms: durationMs,
      processed_count: params.processedCount ?? null,
      error_code:
        message ? "exception" : errorCodeFromStatus(params.responseStatus ?? 200),
      error_message: message?.slice(0, 1000) ?? null,
      metadata: normalizeMetadata(params.metadata),
    });
    const result = await updateQuery?.eq?.("id", jobRunId);

    if (result?.error) {
      serverLog("warn", "cron_telemetry_finish_failed", {
        jobName,
        jobRunId,
        message: result.error.message?.slice(0, 200) ?? "unknown",
      });
    }
  }

  try {
    const result = await handler();
    const status = statusFromResponse(result.response);
    await finish({
      status,
      responseStatus: result.response.status,
      processedCount: result.processedCount ?? null,
      metadata: result.metadata,
    });
    return result.response;
  } catch (error) {
    await finish({ status: "failed", error });
    throw error;
  }
}
