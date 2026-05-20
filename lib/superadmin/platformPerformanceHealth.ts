import type { SupabaseClient } from "@supabase/supabase-js";
import type { SystemHealthStatus } from "@/lib/superadmin/systemHealthTypes";

export type PlatformPerformanceSnapshot = {
  capturedAt: string | null;
  advisorSummary: {
    duplicatePolicyGroups: number;
    missingForeignKeyIndexes: number;
    rlsEnabledNoPolicyTables: number;
  };
  topTables: Array<{
    tableName: string;
    liveRows: number;
    deadRows: number;
    seqScan: number;
    idxScan: number;
    totalBytes: number;
  }>;
  slowQueries: Array<{
    calls: number;
    totalExecMs: number;
    meanExecMs: number;
    rows: number;
    querySample: string;
  }>;
  status: SystemHealthStatus;
  message: string;
};

export type PlatformCronRunSummary = {
  lastRunAt: string | null;
  jobs: Array<{
    jobName: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    processedCount: number | null;
    errorMessage: string | null;
  }>;
  status: SystemHealthStatus;
  message: string;
};

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSnapshot(raw: unknown): Omit<PlatformPerformanceSnapshot, "status" | "message"> {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const advisorRaw =
    record.advisorSummary && typeof record.advisorSummary === "object"
      ? (record.advisorSummary as Record<string, unknown>)
      : {};

  return {
    capturedAt: typeof record.capturedAt === "string" ? record.capturedAt : null,
    advisorSummary: {
      duplicatePolicyGroups: numeric(advisorRaw.duplicatePolicyGroups),
      missingForeignKeyIndexes: numeric(advisorRaw.missingForeignKeyIndexes),
      rlsEnabledNoPolicyTables: numeric(advisorRaw.rlsEnabledNoPolicyTables),
    },
    topTables: Array.isArray(record.topTables)
      ? record.topTables.map((item) => {
          const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          return {
            tableName: String(row.table_name ?? row.tableName ?? ""),
            liveRows: numeric(row.live_rows ?? row.liveRows),
            deadRows: numeric(row.dead_rows ?? row.deadRows),
            seqScan: numeric(row.seq_scan ?? row.seqScan),
            idxScan: numeric(row.idx_scan ?? row.idxScan),
            totalBytes: numeric(row.total_bytes ?? row.totalBytes),
          };
        })
      : [],
    slowQueries: Array.isArray(record.slowQueries)
      ? record.slowQueries.map((item) => {
          const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          return {
            calls: numeric(row.calls),
            totalExecMs: numeric(row.total_exec_ms ?? row.totalExecMs),
            meanExecMs: numeric(row.mean_exec_ms ?? row.meanExecMs),
            rows: numeric(row.rows),
            querySample: String(row.query_sample ?? row.querySample ?? ""),
          };
        })
      : [],
  };
}

function statusFromAdvisorCounts(summary: PlatformPerformanceSnapshot["advisorSummary"]) {
  if (summary.missingForeignKeyIndexes > 25 || summary.duplicatePolicyGroups > 10) {
    return "warning" satisfies SystemHealthStatus;
  }
  if (
    summary.missingForeignKeyIndexes > 0 ||
    summary.duplicatePolicyGroups > 0 ||
    summary.rlsEnabledNoPolicyTables > 0
  ) {
    return "warning" satisfies SystemHealthStatus;
  }
  return "healthy" satisfies SystemHealthStatus;
}

export async function buildPlatformPerformanceSnapshot(
  admin: SupabaseClient | null
): Promise<PlatformPerformanceSnapshot> {
  if (!admin) {
    return {
      capturedAt: null,
      advisorSummary: {
        duplicatePolicyGroups: 0,
        missingForeignKeyIndexes: 0,
        rlsEnabledNoPolicyTables: 0,
      },
      topTables: [],
      slowQueries: [],
      status: "unknown",
      message: "Performance snapshot skipped because the Supabase admin client is unavailable.",
    };
  }

  const { data, error } = await admin.rpc("platform_performance_snapshot");
  if (error) {
    return {
      capturedAt: null,
      advisorSummary: {
        duplicatePolicyGroups: 0,
        missingForeignKeyIndexes: 0,
        rlsEnabledNoPolicyTables: 0,
      },
      topTables: [],
      slowQueries: [],
      status: "unknown",
      message: `Performance snapshot unavailable: ${error.message}`,
    };
  }

  const normalized = normalizeSnapshot(data);
  const status = statusFromAdvisorCounts(normalized.advisorSummary);
  return {
    ...normalized,
    status,
    message:
      status === "healthy"
        ? "No database advisor-style performance issues were detected by the runtime snapshot."
        : "Database tuning opportunities remain: missing FK indexes, duplicate permissive policies, or RLS tables without policies.",
  };
}

export async function buildPlatformCronRunSummary(
  admin: SupabaseClient | null
): Promise<PlatformCronRunSummary> {
  if (!admin) {
    return {
      lastRunAt: null,
      jobs: [],
      status: "unknown",
      message: "Cron run summary skipped because the Supabase admin client is unavailable.",
    };
  }

  const { data, error } = await admin
    .from("platform_job_runs")
    .select("job_name, status, started_at, completed_at, duration_ms, processed_count, error_message")
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) {
    return {
      lastRunAt: null,
      jobs: [],
      status: "unknown",
      message: `Cron run summary unavailable: ${error.message}`,
    };
  }

  const jobs = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    jobName: String(row.job_name ?? ""),
    status: String(row.status ?? "unknown"),
    startedAt: String(row.started_at ?? ""),
    completedAt: typeof row.completed_at === "string" ? row.completed_at : null,
    durationMs: row.duration_ms == null ? null : numeric(row.duration_ms),
    processedCount: row.processed_count == null ? null : numeric(row.processed_count),
    errorMessage: typeof row.error_message === "string" ? row.error_message : null,
  }));

  const failedRecent = jobs.some((job) => job.status === "failed");
  return {
    lastRunAt: jobs[0]?.startedAt ?? null,
    jobs,
    status: failedRecent ? "warning" : "healthy",
    message: failedRecent
      ? "At least one recent cron run failed."
      : jobs.length > 0
        ? "Recent cron telemetry is being recorded."
        : "No cron telemetry has been recorded yet.",
  };
}
