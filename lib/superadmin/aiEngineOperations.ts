import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { requestAiResponsesText, type AiExecutionMeta } from "@/lib/ai/responses";

export const AI_ENGINE_SURFACES = [
  "safety-intelligence",
  "ai-engine",
  "company-memory",
  "permit-copilot",
  "csep-review",
  "gc-review",
  "injury-weather",
  "training-records.photo-extract",
  "field-audits.ai-review",
  "embeddings",
] as const;

export type AiEngineSurfaceFilter = (typeof AI_ENGINE_SURFACES)[number] | "all";

export type AiEngineMetricsFilters = {
  surface?: string | null;
  since?: string | null;
  limit?: number | null;
};

export type AiEngineCallRow = {
  id: number | string;
  created_at: string;
  surface: string;
  model: string | null;
  provider: string | null;
  trace_id: string | null;
  prompt_version: string | null;
  output_schema_version: string | null;
  latency_ms: number | null;
  status: string;
  error_type: string | null;
  http_status: number | null;
  attempts: number | null;
  retry_count: number | null;
  fallback_used: boolean | null;
  fallback_reason: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  error_message: string | null;
  cache_hit: boolean | null;
  tool_calls_used: number | null;
  eval_fixture_id: string | null;
};

export type AiEngineFeedbackOutcome =
  | "accepted"
  | "edited"
  | "rejected"
  | "regenerated"
  | "field-used";

export type AiEngineFeedbackInput = {
  surface: string;
  sourceId?: string | null;
  aiReviewId?: string | null;
  rating?: number | null;
  outcome: AiEngineFeedbackOutcome;
  editedText?: string | null;
  reason?: string | null;
  createdBy?: string | null;
  signalMetadata?: Record<string, unknown> | null;
};

export type AiEngineFeedbackSignalMetadata = {
  editDistanceRatio?: number;
  regeneratedCount?: number;
  usedInField?: boolean;
  workflowStep?: string;
  documentType?: string;
  reasonCode?: string;
  fallbackUsed?: boolean;
  userRole?: string;
  model?: string;
  promptVersion?: string;
  outputSchemaVersion?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  errorType?: string;
  changedFieldIds?: string[];
};

export type AiEngineFeedbackSummarySurface = {
  surface: string;
  count: number;
  accepted: number;
  edited: number;
  rejected: number;
  regenerated: number;
  fieldUsed: number;
  negativeRate: number;
  fieldUsedRate: number;
  current7DayCount: number;
  previous7DayCount: number;
  delta7DayCount: number;
};

export type AiEngineFeedbackSummary = {
  total: number;
  outcomeCounts: Record<AiEngineFeedbackOutcome, number>;
  bySurface: AiEngineFeedbackSummarySurface[];
  needsReview: AiEngineFeedbackSummarySurface[];
};

export type AiEngineRecommendationSeverity = "critical" | "warning" | "info";
export type AiEngineRecommendationCategory =
  | "reliability"
  | "fallback"
  | "latency"
  | "telemetry"
  | "feedback"
  | "evals"
  | "cost";

export type AiEngineRecommendation = {
  id: string;
  severity: AiEngineRecommendationSeverity;
  surface: string;
  category: AiEngineRecommendationCategory;
  title: string;
  evidence: string;
  suggestedAction: string;
  source: "deterministic";
};

export type AiEngineRecommendationSummaryMeta = {
  model: string | null;
  provider: string | null;
  promptHash: string | null;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  toolCallsUsed?: number;
  toolResults?: AiEngineToolResultSummary[];
};

export type AiEngineToolName =
  | "get_ai_metrics"
  | "get_ai_calls"
  | "get_eval_coverage"
  | "get_feedback_signals"
  | "get_visual_job_health"
  | "get_release_gate_snapshot";

export const AI_ENGINE_READ_ONLY_TOOLS: readonly AiEngineToolName[] = [
  "get_ai_metrics",
  "get_ai_calls",
  "get_eval_coverage",
  "get_feedback_signals",
  "get_visual_job_health",
  "get_release_gate_snapshot",
] as const;

export type AiEngineToolFilters = {
  surface?: string | null;
  since?: string | null;
  windowDays?: number | null;
  limit?: number | null;
  status?: string | null;
  errorType?: string | null;
  traceId?: string | null;
};

export type AiEngineToolResult = {
  toolName: AiEngineToolName;
  generatedAt: string;
  filters: {
    surface: string;
    since: string;
    windowDays: number;
    limit: number;
    status: string | null;
    errorType: string | null;
    traceId: string | null;
  };
  summary: Record<string, unknown>;
  rows: unknown[];
  evidenceIds: string[];
  unavailable?: boolean;
  reason?: string | null;
};

export type AiEngineToolResultSummary = {
  toolName: AiEngineToolName;
  generatedAt: string;
  filters: AiEngineToolResult["filters"];
  rowCount: number;
  evidenceIds: string[];
  summary: Record<string, unknown>;
};

export type AiEngineRecommendationSnapshot = {
  id: number | string | null;
  generatedAt: string | null;
  snapshotDate: string | null;
  surface: string;
  windowDays: number;
  summary: string;
  summaryMeta: AiEngineRecommendationSummaryMeta;
  recommendations: AiEngineRecommendation[];
  aggregateSnapshot: Record<string, unknown>;
  toolResultsSummary?: AiEngineToolResultSummary[];
};

export type AiEngineReadableClient = {
  from(table: string): AiEngineTableBuilder;
};

type AiEngineQueryResult = {
  data: unknown[] | Record<string, unknown> | null;
  error: { message?: string | null } | null;
  count?: number | null;
};

type AiEngineTableBuilder = {
  select(columns: string, options?: { count?: "exact" }): AiEngineQueryBuilder;
  insert(row: Record<string, unknown>): AiEngineInsertBuilder;
  upsert(row: Record<string, unknown>, options?: { onConflict?: string }): AiEngineInsertBuilder;
};

type AiEngineQueryBuilder = PromiseLike<AiEngineQueryResult> & {
  eq(column: string, value: string | number): AiEngineQueryBuilder;
  gte(column: string, value: string): AiEngineQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): AiEngineQueryBuilder;
  limit(count: number): AiEngineQueryBuilder;
  ilike(column: string, pattern: string): AiEngineQueryBuilder;
};

type AiEngineInsertBuilder = {
  select(columns: string): AiEngineInsertBuilder;
  single(): PromiseLike<AiEngineQueryResult>;
};

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;
const TOOL_RESULT_LIMIT = 50;
const DEFAULT_RECOMMENDATION_MODEL = "gpt-4o-mini";
const RELEASE_GATE_THRESHOLDS = {
  criticalEvalPassRate: 0.95,
  failureRate: 0.02,
  fallbackRate: 0.05,
  tokenCostRegression: 0.15,
  p95LatencyRegression: 0.2,
};

function toSafeLimit(limit: number | null | undefined) {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.round(limit)));
}

function defaultSinceIso() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString();
}

function toSinceIso(since: string | null | undefined) {
  if (!since) return defaultSinceIso();
  const date = new Date(since);
  if (Number.isNaN(date.getTime())) return defaultSinceIso();
  return date.toISOString();
}

function toSafeWindowDays(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return 7;
  return Math.min(30, Math.max(1, Math.round(value)));
}

function toSafeToolLimit(value: number | null | undefined) {
  return Math.min(TOOL_RESULT_LIMIT, toSafeLimit(value));
}

function todaySnapshotDate() {
  return new Date().toISOString().slice(0, 10);
}

function surfaceMatches(rowSurface: string, filter: string | null | undefined) {
  if (!filter || filter === "all") return true;
  const normalizedFilter = filter.toLowerCase();
  return rowSurface.toLowerCase().includes(normalizedFilter);
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function sanitizeNullableText(value: unknown, max = 240) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

const SAFE_SIGNAL_METADATA_KEYS = new Set([
  "editDistanceRatio",
  "regeneratedCount",
  "usedInField",
  "workflowStep",
  "documentType",
  "reasonCode",
  "fallbackUsed",
  "userRole",
  "model",
  "promptVersion",
  "outputSchemaVersion",
  "latencyMs",
  "inputTokens",
  "outputTokens",
  "errorType",
  "changedFieldIds",
]);

export function sanitizeAiFeedbackSignalMetadata(input: unknown): AiEngineFeedbackSignalMetadata {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const sanitized: AiEngineFeedbackSignalMetadata = {};

  for (const [key, value] of Object.entries(source)) {
    if (!SAFE_SIGNAL_METADATA_KEYS.has(key)) continue;

    if (key === "editDistanceRatio") {
      const normalized = normalizeNumber(value);
      if (normalized != null) {
        sanitized.editDistanceRatio = Math.min(1, Math.max(0, normalized));
      }
      continue;
    }

    if (key === "regeneratedCount") {
      const normalized = normalizeNumber(value);
      if (normalized != null) {
        sanitized.regeneratedCount = Math.min(50, Math.max(0, Math.round(normalized)));
      }
      continue;
    }

    if (key === "usedInField") {
      if (typeof value === "boolean") sanitized.usedInField = value;
      continue;
    }

    if (key === "fallbackUsed") {
      if (typeof value === "boolean") sanitized.fallbackUsed = value;
      continue;
    }

    if (key === "latencyMs" || key === "inputTokens" || key === "outputTokens") {
      const normalized = normalizeNumber(value);
      if (normalized != null) {
        const bounded = Math.min(10_000_000, Math.max(0, Math.round(normalized)));
        if (key === "latencyMs") sanitized.latencyMs = bounded;
        if (key === "inputTokens") sanitized.inputTokens = bounded;
        if (key === "outputTokens") sanitized.outputTokens = bounded;
      }
      continue;
    }

    if (key === "changedFieldIds") {
      if (Array.isArray(value)) {
        sanitized.changedFieldIds = value
          .map((item) => sanitizeNullableText(item, 80))
          .filter((item): item is string => Boolean(item))
          .slice(0, 20);
      }
      continue;
    }

    const text = sanitizeNullableText(value, 80);
    if (!text) continue;
    if (key === "workflowStep") sanitized.workflowStep = text;
    if (key === "documentType") sanitized.documentType = text;
    if (key === "reasonCode") sanitized.reasonCode = text;
    if (key === "userRole") sanitized.userRole = text;
    if (key === "model") sanitized.model = text;
    if (key === "promptVersion") sanitized.promptVersion = text;
    if (key === "outputSchemaVersion") sanitized.outputSchemaVersion = text;
    if (key === "errorType") sanitized.errorType = text;
  }

  return sanitized;
}

function normalizeCallRow(row: Record<string, unknown>): AiEngineCallRow {
  return {
    id: typeof row.id === "number" || typeof row.id === "string" ? row.id : "",
    created_at: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
    surface: sanitizeNullableText(row.surface, 120) ?? "unknown",
    model: sanitizeNullableText(row.model, 120),
    provider: sanitizeNullableText(row.provider, 80),
    trace_id: sanitizeNullableText(row.trace_id, 80),
    prompt_version: sanitizeNullableText(row.prompt_version, 80),
    output_schema_version: sanitizeNullableText(row.output_schema_version, 80),
    latency_ms: normalizeNumber(row.latency_ms),
    status: sanitizeNullableText(row.status, 40) ?? "unknown",
    error_type: sanitizeNullableText(row.error_type, 80),
    http_status: normalizeNumber(row.http_status),
    attempts: normalizeNumber(row.attempts),
    retry_count: normalizeNumber(row.retry_count),
    fallback_used: typeof row.fallback_used === "boolean" ? row.fallback_used : null,
    fallback_reason: sanitizeNullableText(row.fallback_reason, 120),
    prompt_tokens: normalizeNumber(row.prompt_tokens),
    completion_tokens: normalizeNumber(row.completion_tokens),
    input_tokens: normalizeNumber(row.input_tokens) ?? normalizeNumber(row.prompt_tokens),
    output_tokens: normalizeNumber(row.output_tokens) ?? normalizeNumber(row.completion_tokens),
    total_tokens: normalizeNumber(row.total_tokens),
    error_message: sanitizeNullableText(row.error_message, 240),
    cache_hit: typeof row.cache_hit === "boolean" ? row.cache_hit : null,
    tool_calls_used: normalizeNumber(row.tool_calls_used),
    eval_fixture_id: sanitizeNullableText(row.eval_fixture_id, 160),
  };
}

function sanitizeToolName(value: unknown): AiEngineToolName | null {
  if (typeof value !== "string") return null;
  return (AI_ENGINE_READ_ONLY_TOOLS as readonly string[]).includes(value)
    ? (value as AiEngineToolName)
    : null;
}

function normalizeToolNames(input?: string[] | null): AiEngineToolName[] {
  if (!input || input.length === 0) return [...AI_ENGINE_READ_ONLY_TOOLS];
  const seen = new Set<AiEngineToolName>();
  for (const item of input) {
    const name = sanitizeToolName(item);
    if (name) seen.add(name);
  }
  return Array.from(seen);
}

export function validateAiEngineToolNames(input?: string[] | null): { ok: true; tools: AiEngineToolName[] } | { ok: false; invalid: string[] } {
  if (!input || input.length === 0) return { ok: true, tools: [...AI_ENGINE_READ_ONLY_TOOLS] };
  const invalid = input.filter((item) => !sanitizeToolName(item));
  if (invalid.length > 0) return { ok: false, invalid };
  return { ok: true, tools: normalizeToolNames(input) };
}

function normalizeToolFilters(filters: AiEngineToolFilters = {}): AiEngineToolResult["filters"] {
  const windowDays = toSafeWindowDays(filters.windowDays);
  const since =
    filters.since && !Number.isNaN(new Date(filters.since).getTime())
      ? new Date(filters.since).toISOString()
      : (() => {
          const date = new Date();
          date.setDate(date.getDate() - windowDays);
          return date.toISOString();
        })();
  return {
    surface: filters.surface?.trim() || "all",
    since,
    windowDays,
    limit: toSafeToolLimit(filters.limit),
    status: sanitizeNullableText(filters.status, 80),
    errorType: sanitizeNullableText(filters.errorType, 80),
    traceId: sanitizeNullableText(filters.traceId, 120),
  };
}

function summarizeToolResult(result: AiEngineToolResult): AiEngineToolResultSummary {
  return {
    toolName: result.toolName,
    generatedAt: result.generatedAt,
    filters: result.filters,
    rowCount: result.rows.length,
    evidenceIds: result.evidenceIds,
    summary: result.summary,
  };
}

function summarizeToolResults(results: AiEngineToolResult[]): AiEngineToolResultSummary[] {
  return results.map(summarizeToolResult);
}

type AiEngineMetricGroup = {
  key: string;
  calls: number;
  fallbacks: number;
  failures: number;
  tokens: number;
  p50LatencyMs?: number | null;
  p90LatencyMs?: number | null;
  p95LatencyMs?: number | null;
  latencies?: number[];
};

function incrementGroup(
  groups: Record<string, AiEngineMetricGroup>,
  key: string | null,
  row: AiEngineCallRow
) {
  const groupKey = key || "unknown";
  const existing =
    groups[groupKey] ??
    (groups[groupKey] = { key: groupKey, calls: 0, fallbacks: 0, failures: 0, tokens: 0, latencies: [] });
  existing.calls += 1;
  if (row.fallback_used || row.status === "fallback") existing.fallbacks += 1;
  if (row.status === "http_error" || row.status === "exception") existing.failures += 1;
  existing.tokens += row.total_tokens ?? 0;
  if (row.latency_ms != null) existing.latencies?.push(row.latency_ms);
}

function percentile(sortedValues: number[], p: number): number | null {
  if (sortedValues.length === 0) return null;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return Math.round(sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight);
}

function sortedGroups(groups: Record<string, AiEngineMetricGroup>) {
  return Object.values(groups)
    .map((group) => {
      const latencies = [...(group.latencies ?? [])].sort((a, b) => a - b);
      const { latencies: _omit, ...rest } = group;
      return {
        ...rest,
        p50LatencyMs: percentile(latencies, 0.5),
        p90LatencyMs: percentile(latencies, 0.9),
        p95LatencyMs: percentile(latencies, 0.95),
      };
    })
    .sort((a, b) => b.calls - a.calls || a.key.localeCompare(b.key));
}

function emptyOutcomeCounts(): Record<AiEngineFeedbackOutcome, number> {
  return {
    accepted: 0,
    edited: 0,
    rejected: 0,
    regenerated: 0,
    "field-used": 0,
  };
}

function buildFeedbackSummary(rows: unknown[]): AiEngineFeedbackSummary {
  const outcomeCounts = emptyOutcomeCounts();
  const bySurface = new Map<string, AiEngineFeedbackSummarySurface>();
  const now = Date.now();
  const currentWindowStart = now - 7 * 24 * 60 * 60 * 1000;
  const previousWindowStart = now - 14 * 24 * 60 * 60 * 1000;

  for (const rawRow of rows) {
    const row = rawRow as Record<string, unknown>;
    const outcome = sanitizeNullableText(row.outcome, 40) as AiEngineFeedbackOutcome | null;
    if (!outcome || !(outcome in outcomeCounts)) continue;

    const surface = sanitizeNullableText(row.surface, 120) ?? "unknown";
    const surfaceRow =
      bySurface.get(surface) ??
      {
        surface,
        count: 0,
        accepted: 0,
        edited: 0,
        rejected: 0,
        regenerated: 0,
        fieldUsed: 0,
        negativeRate: 0,
        fieldUsedRate: 0,
        current7DayCount: 0,
        previous7DayCount: 0,
        delta7DayCount: 0,
      };

    outcomeCounts[outcome] += 1;
    surfaceRow.count += 1;
    if (outcome === "accepted") surfaceRow.accepted += 1;
    if (outcome === "edited") surfaceRow.edited += 1;
    if (outcome === "rejected") surfaceRow.rejected += 1;
    if (outcome === "regenerated") surfaceRow.regenerated += 1;
    if (outcome === "field-used") surfaceRow.fieldUsed += 1;

    const createdAt = typeof row.created_at === "string" ? new Date(row.created_at).getTime() : Number.NaN;
    if (Number.isFinite(createdAt) && createdAt >= currentWindowStart) {
      surfaceRow.current7DayCount += 1;
    } else if (Number.isFinite(createdAt) && createdAt >= previousWindowStart) {
      surfaceRow.previous7DayCount += 1;
    }

    bySurface.set(surface, surfaceRow);
  }

  const surfaceRows = Array.from(bySurface.values()).map((row) => {
    const negative = row.edited + row.rejected + row.regenerated;
    return {
      ...row,
      negativeRate: row.count > 0 ? negative / row.count : 0,
      fieldUsedRate: row.count > 0 ? row.fieldUsed / row.count : 0,
      delta7DayCount: row.current7DayCount - row.previous7DayCount,
    };
  });

  return {
    total: rows.length,
    outcomeCounts,
    bySurface: surfaceRows.sort((a, b) => b.count - a.count || a.surface.localeCompare(b.surface)),
    needsReview: surfaceRows
      .filter((row) => row.count >= 3 && row.negativeRate >= 0.3)
      .sort((a, b) => b.negativeRate - a.negativeRate || b.count - a.count),
  };
}

function severityRank(severity: AiEngineRecommendationSeverity) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function recommendationId(category: AiEngineRecommendationCategory, surface: string, title: string) {
  return `${category}:${surface}:${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export async function getAiEngineCalls(
  client: AiEngineReadableClient | null,
  filters: AiEngineMetricsFilters = {}
) {
  if (!client) {
    return {
      rows: [] as AiEngineCallRow[],
      count: 0,
      unavailable: true,
      reason: "supabase_service_role_unavailable",
    };
  }

  const limit = toSafeLimit(filters.limit);
  const since = toSinceIso(filters.since);
  let query = client
    .from("ai_call_log")
    .select(
      "id,created_at,surface,model,provider,trace_id,prompt_version,output_schema_version,latency_ms,status,error_type,http_status,attempts,retry_count,fallback_used,fallback_reason,prompt_tokens,completion_tokens,input_tokens,output_tokens,total_tokens,error_message,cache_hit,tool_calls_used,eval_fixture_id",
      { count: "exact" }
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.surface && filters.surface !== "all") {
    query = query.ilike("surface", `%${filters.surface}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(error.message ?? "Unable to read AI call log.");
  }

  const rows = Array.isArray(data)
    ? data.map((row) => normalizeCallRow(row as Record<string, unknown>))
    : [];

  return { rows, count: count ?? rows.length, unavailable: false, reason: null };
}

export async function getAiEngineMetrics(
  client: AiEngineReadableClient | null,
  filters: AiEngineMetricsFilters = {}
) {
  const since = toSinceIso(filters.since);
  const calls = await getAiEngineCalls(client, { ...filters, since, limit: filters.limit ?? MAX_LIMIT });
  const rows = calls.rows.filter((row) => surfaceMatches(row.surface, filters.surface));
  const totalCalls = rows.length;
  const fallbackCalls = rows.filter((row) => row.fallback_used || row.status === "fallback").length;
  const failedCalls = rows.filter((row) => row.status === "http_error" || row.status === "exception").length;
  const totalTokens = rows.reduce((sum, row) => sum + (row.total_tokens ?? 0), 0);
  const latencies = rows
    .map((row) => row.latency_ms)
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b);
  const averageLatencyMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((sum, n) => sum + n, 0) / latencies.length)
      : null;
  const p50LatencyMs = percentile(latencies, 0.5);
  const p90LatencyMs = percentile(latencies, 0.9);
  const p95LatencyMs = percentile(latencies, 0.95);

  const bySurface: Record<string, AiEngineMetricGroup> = {};
  const byModel: Record<string, AiEngineMetricGroup> = {};
  const byProvider: Record<string, AiEngineMetricGroup> = {};

  for (const row of rows) {
    incrementGroup(bySurface, row.surface, row);
    incrementGroup(byModel, row.model, row);
    incrementGroup(byProvider, row.provider, row);
  }

  return {
    generatedAt: new Date().toISOString(),
    since,
    unavailable: calls.unavailable,
    unavailableReason: calls.reason,
    summary: {
      totalCalls,
      fallbackCalls,
      fallbackRate: totalCalls > 0 ? fallbackCalls / totalCalls : 0,
      failedCalls,
      failureRate: totalCalls > 0 ? failedCalls / totalCalls : 0,
      totalTokens,
      averageLatencyMs,
      p50LatencyMs,
      p90LatencyMs,
      p95LatencyMs,
    },
    bySurface: sortedGroups(bySurface),
    byModel: sortedGroups(byModel),
    byProvider: sortedGroups(byProvider),
    recentFailures: rows
      .filter((row) => row.status === "http_error" || row.status === "exception")
      .slice(0, 10),
  };
}

export async function getAiEngineFeedback(
  client: AiEngineReadableClient | null,
  filters: AiEngineMetricsFilters = {}
) {
  if (!client) {
    return {
      rows: [],
      count: 0,
      unavailable: true,
      reason: "supabase_service_role_unavailable",
      summary: buildFeedbackSummary([]),
    };
  }

  const limit = toSafeLimit(filters.limit);
  const since = toSinceIso(filters.since);
  let query = client
    .from("ai_output_feedback")
    .select(
      "id,created_at,surface,source_id,ai_review_id,rating,outcome,reason,created_by,signal_metadata",
      { count: "exact" }
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.surface && filters.surface !== "all") {
    query = query.ilike("surface", `%${filters.surface}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(error.message ?? "Unable to read AI feedback.");
  }

  const rows = Array.isArray(data) ? data : [];

  return {
    rows,
    count: count ?? rows.length,
    unavailable: false,
    reason: null,
    summary: buildFeedbackSummary(rows),
  };
}

export async function recordAiEngineFeedback(
  client: AiEngineReadableClient | null,
  input: AiEngineFeedbackInput
) {
  if (!client) {
    return { ok: false, error: "Runtime telemetry storage is not configured.", status: 503 };
  }

  const rating =
    input.rating == null
      ? null
      : Math.min(5, Math.max(1, Math.round(input.rating)));

  const row = {
    surface: input.surface.trim().slice(0, 120),
    source_id: input.sourceId?.trim().slice(0, 120) || null,
    ai_review_id: input.aiReviewId?.trim().slice(0, 120) || null,
    rating,
    outcome: input.outcome,
    edited_text: input.editedText?.trim().slice(0, 5000) || null,
    reason: input.reason?.trim().slice(0, 500) || null,
    signal_metadata: sanitizeAiFeedbackSignalMetadata(input.signalMetadata),
    created_by: input.createdBy ?? null,
  };

  const { data, error } = await client
    .from("ai_output_feedback")
    .insert(row)
    .select("id,created_at,surface,source_id,ai_review_id,rating,outcome,reason,created_by,signal_metadata")
    .single();

  if (error) {
    return { ok: false, error: error.message ?? "Unable to record AI feedback.", status: 500 };
  }

  return { ok: true, feedback: data };
}

export function getAiEngineEvalSummary() {
  const root = join(process.cwd(), "tests", "ai", "golden");
  const surfaces = AI_ENGINE_SURFACES.map((surface) => ({
    surface,
    fixtures: 0,
    status: "not_configured" as const,
  }));

  if (!existsSync(root)) {
    return {
      generatedAt: new Date().toISOString(),
      rootAvailable: false,
      surfaces,
      totalFixtures: 0,
    };
  }

  const directories = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const fixtureCounts = new Map<string, number>();
  let totalFixtures = 0;

  for (const directory of directories) {
    const dirPath = join(root, directory.name);
    const count = readdirSync(dirPath).filter((file) => file.endsWith(".json")).length;
    fixtureCounts.set(directory.name, count);
    totalFixtures += count;
  }

  return {
    generatedAt: new Date().toISOString(),
    rootAvailable: true,
    surfaces: surfaces.map((surface) => {
      const count = Array.from(fixtureCounts.entries())
        .filter(([key]) => key.includes(surface.surface) || surface.surface.includes(key.split(".")[0]))
        .reduce((sum, [, count]) => sum + count, 0);
      return {
        ...surface,
        fixtures: count,
        status: count > 0 ? ("covered" as const) : ("missing" as const),
      };
    }),
    registeredFixtureDirectories: Array.from(fixtureCounts.entries()).map(([surface, fixtures]) => ({
      surface,
      fixtures,
    })),
    totalFixtures,
  };
}

function getStructuredAssertionCoverage() {
  const root = join(process.cwd(), "tests", "ai", "golden");
  const totals = {
    fixtures: 0,
    expectedFields: 0,
    requiredEvidence: 0,
    severity: 0,
    confidenceRange: 0,
    mustNotSay: 0,
  };
  if (!existsSync(root)) return totals;
  for (const directory of readdirSync(root, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const dirPath = join(root, directory.name);
    for (const file of readdirSync(dirPath).filter((name) => name.endsWith(".json"))) {
      try {
        const json = JSON.parse(readFileSync(join(dirPath, file), "utf8")) as {
          assertions?: Record<string, unknown>;
        };
        const assertions = json.assertions ?? {};
        totals.fixtures += 1;
        if (Array.isArray(assertions.expectedFields) && assertions.expectedFields.length > 0) totals.expectedFields += 1;
        if (Array.isArray(assertions.requiredEvidence) && assertions.requiredEvidence.length > 0) totals.requiredEvidence += 1;
        if (assertions.severity) totals.severity += 1;
        if (assertions.confidenceRange) totals.confidenceRange += 1;
        if (Array.isArray(assertions.mustNotSay) && assertions.mustNotSay.length > 0) totals.mustNotSay += 1;
      } catch {
        totals.fixtures += 1;
      }
    }
  }
  return totals;
}

function unavailableToolResult(toolName: AiEngineToolName, filters: AiEngineToolResult["filters"], reason: string): AiEngineToolResult {
  return {
    toolName,
    generatedAt: new Date().toISOString(),
    filters,
    summary: { unavailable: true, reason },
    rows: [],
    evidenceIds: [`${toolName}:unavailable`],
    unavailable: true,
    reason,
  };
}

async function runAiMetricsTool(client: AiEngineReadableClient | null, filters: AiEngineToolResult["filters"]): Promise<AiEngineToolResult> {
  const metrics = await getAiEngineMetrics(client, { surface: filters.surface, since: filters.since, limit: MAX_LIMIT });
  return {
    toolName: "get_ai_metrics",
    generatedAt: metrics.generatedAt,
    filters,
    summary: {
      totalCalls: metrics.summary.totalCalls,
      fallbackRate: metrics.summary.fallbackRate,
      failureRate: metrics.summary.failureRate,
      totalTokens: metrics.summary.totalTokens,
      averageLatencyMs: metrics.summary.averageLatencyMs,
      p50LatencyMs: metrics.summary.p50LatencyMs,
      p90LatencyMs: metrics.summary.p90LatencyMs,
      p95LatencyMs: metrics.summary.p95LatencyMs,
    },
    rows: [
      ...metrics.bySurface.slice(0, 8).map((row) => ({ group: "surface", ...row })),
      ...metrics.byModel.slice(0, 4).map((row) => ({ group: "model", ...row })),
      ...metrics.byProvider.slice(0, 4).map((row) => ({ group: "provider", ...row })),
    ],
    evidenceIds: [
      "metrics:summary",
      ...metrics.bySurface.slice(0, 5).map((row) => `metrics:surface:${row.key}`),
    ],
    unavailable: metrics.unavailable,
    reason: metrics.unavailableReason,
  };
}

async function runAiCallsTool(client: AiEngineReadableClient | null, filters: AiEngineToolResult["filters"]): Promise<AiEngineToolResult> {
  const calls = await getAiEngineCalls(client, { surface: filters.surface, since: filters.since, limit: filters.limit });
  const rows = calls.rows
    .filter((row) => !filters.status || row.status === filters.status)
    .filter((row) => !filters.errorType || row.error_type === filters.errorType)
    .filter((row) => !filters.traceId || row.trace_id === filters.traceId)
    .slice(0, filters.limit)
    .map((row) => ({
      id: row.id,
      created_at: row.created_at,
      surface: row.surface,
      status: row.status,
      error_type: row.error_type,
      trace_id: row.trace_id,
      model: row.model,
      provider: row.provider,
      latency_ms: row.latency_ms,
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      total_tokens: row.total_tokens,
      fallback_used: row.fallback_used,
      fallback_reason: row.fallback_reason,
    }));
  const failures = rows.filter((row) => row.status === "http_error" || row.status === "exception").length;
  return {
    toolName: "get_ai_calls",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      count: calls.count,
      returnedRows: rows.length,
      failures,
      filteredByStatus: filters.status,
      filteredByErrorType: filters.errorType,
      filteredByTraceId: filters.traceId,
    },
    rows,
    evidenceIds: rows.map((row) => `call:${row.id}`).slice(0, 20),
    unavailable: calls.unavailable,
    reason: calls.reason,
  };
}

function runEvalCoverageTool(filters: AiEngineToolResult["filters"]): AiEngineToolResult {
  const evals = getAiEngineEvalSummary();
  const structured = getStructuredAssertionCoverage();
  const missing = evals.surfaces.filter((row) => row.status !== "covered");
  const rows = evals.surfaces
    .filter((row) => filters.surface === "all" || surfaceMatches(row.surface, filters.surface))
    .map((row) => ({
      surface: row.surface,
      fixtures: row.fixtures,
      status: row.status,
    }));
  return {
    toolName: "get_eval_coverage",
    generatedAt: evals.generatedAt,
    filters,
    summary: {
      totalFixtures: evals.totalFixtures,
      rootAvailable: evals.rootAvailable,
      coveredSurfaces: evals.surfaces.filter((row) => row.status === "covered").length,
      missingSurfaces: missing.length,
      structuredAssertions: structured,
    },
    rows,
    evidenceIds: rows.map((row) => `eval:${row.surface}`),
    unavailable: !evals.rootAvailable,
    reason: evals.rootAvailable ? null : "golden_fixture_root_unavailable",
  };
}

async function runFeedbackSignalsTool(client: AiEngineReadableClient | null, filters: AiEngineToolResult["filters"]): Promise<AiEngineToolResult> {
  const feedback = await getAiEngineFeedback(client, { surface: filters.surface, since: filters.since, limit: filters.limit });
  const rows = feedback.summary.bySurface.slice(0, filters.limit).map((row) => ({
    surface: row.surface,
    count: row.count,
    accepted: row.accepted,
    edited: row.edited,
    rejected: row.rejected,
    regenerated: row.regenerated,
    fieldUsed: row.fieldUsed,
    negativeRate: row.negativeRate,
    fieldUsedRate: row.fieldUsedRate,
  }));
  return {
    toolName: "get_feedback_signals",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      count: feedback.count,
      outcomeCounts: feedback.summary.outcomeCounts,
      needsReview: feedback.summary.needsReview.slice(0, 8),
    },
    rows,
    evidenceIds: rows.map((row) => `feedback:${row.surface}`),
    unavailable: feedback.unavailable,
    reason: feedback.reason,
  };
}

async function runVisualJobHealthTool(client: AiEngineReadableClient | null, filters: AiEngineToolResult["filters"]): Promise<AiEngineToolResult> {
  if (!client) return unavailableToolResult("get_visual_job_health", filters, "supabase_service_role_unavailable");
  let query = client
    .from("ai_visual_generation_jobs")
    .select("id,created_at,updated_at,company_id,jobsite_id,surface,status,progress,stage,error_type,error_message,render_id,site_map_id")
    .gte("created_at", filters.since)
    .order("created_at", { ascending: false })
    .limit(filters.limit);
  if (filters.surface !== "all") query = query.ilike("surface", `%${filters.surface}%`);
  const { data, error } = await query;
  if (error) return unavailableToolResult("get_visual_job_health", filters, error.message ?? "visual_job_table_unavailable");
  const rows = (Array.isArray(data) ? data : [])
    .map((raw) => raw as Record<string, unknown>)
    .filter((row) => !filters.status || sanitizeNullableText(row.status, 80) === filters.status)
    .slice(0, filters.limit)
    .map((row) => ({
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      surface: sanitizeNullableText(row.surface, 120),
      status: sanitizeNullableText(row.status, 80),
      progress: normalizeNumber(row.progress),
      stage: sanitizeNullableText(row.stage, 120),
      error_type: sanitizeNullableText(row.error_type, 120),
      error_message: sanitizeNullableText(row.error_message, 180),
      hasResult: Boolean(row.render_id || row.site_map_id),
    }));
  const statusCounts = rows.reduce<Record<string, number>>((acc, row) => {
    const status = row.status ?? "unknown";
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  return {
    toolName: "get_visual_job_health",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalJobs: rows.length,
      statusCounts,
      activeJobs: (statusCounts.queued ?? 0) + (statusCounts.running ?? 0),
      failedJobs: statusCounts.failed ?? 0,
      fallbackReadyJobs: statusCounts.fallback_ready ?? 0,
    },
    rows,
    evidenceIds: rows.map((row) => `visual-job:${row.id}`).slice(0, 20),
  };
}

async function runReleaseGateSnapshotTool(client: AiEngineReadableClient | null, filters: AiEngineToolResult["filters"]): Promise<AiEngineToolResult> {
  const metrics = await getAiEngineMetrics(client, { surface: filters.surface, since: filters.since, limit: MAX_LIMIT });
  const evals = getAiEngineEvalSummary();
  const activeSurfaces = evals.surfaces;
  const covered = activeSurfaces.filter((row) => row.status === "covered").length;
  const criticalEvalPassRate = activeSurfaces.length > 0 ? covered / activeSurfaces.length : 0;
  const checks = [
    {
      id: "critical_eval_pass_rate",
      ok: criticalEvalPassRate >= RELEASE_GATE_THRESHOLDS.criticalEvalPassRate,
      value: criticalEvalPassRate,
      threshold: RELEASE_GATE_THRESHOLDS.criticalEvalPassRate,
    },
    {
      id: "failure_rate",
      ok: metrics.summary.failureRate <= RELEASE_GATE_THRESHOLDS.failureRate,
      value: metrics.summary.failureRate,
      threshold: RELEASE_GATE_THRESHOLDS.failureRate,
    },
    {
      id: "fallback_rate",
      ok: metrics.summary.fallbackRate <= RELEASE_GATE_THRESHOLDS.fallbackRate,
      value: metrics.summary.fallbackRate,
      threshold: RELEASE_GATE_THRESHOLDS.fallbackRate,
    },
    {
      id: "token_cost_regression",
      ok: null,
      value: null,
      threshold: RELEASE_GATE_THRESHOLDS.tokenCostRegression,
      reason: "baseline_required",
    },
    {
      id: "p95_latency_regression",
      ok: null,
      value: null,
      threshold: RELEASE_GATE_THRESHOLDS.p95LatencyRegression,
      reason: "baseline_required",
    },
  ];
  const failed = checks.filter((check) => check.ok === false);
  const unknown = checks.filter((check) => check.ok === null);
  const status = failed.length > 0 ? "fail" : unknown.length > 0 ? "needs_baseline" : "pass";
  return {
    toolName: "get_release_gate_snapshot",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      status,
      thresholds: RELEASE_GATE_THRESHOLDS,
      checks,
      totalCalls: metrics.summary.totalCalls,
      activeSurfaceCount: activeSurfaces.length,
      coveredSurfaceCount: covered,
    },
    rows: checks,
    evidenceIds: checks.map((check) => `release-gate:${check.id}`),
    unavailable: metrics.unavailable,
    reason: metrics.unavailableReason,
  };
}

export async function runAiEngineReadOnlyTool(
  client: AiEngineReadableClient | null,
  toolName: AiEngineToolName,
  filters: AiEngineToolFilters = {}
): Promise<AiEngineToolResult> {
  const normalized = normalizeToolFilters(filters);
  if (toolName === "get_ai_metrics") return runAiMetricsTool(client, normalized);
  if (toolName === "get_ai_calls") return runAiCallsTool(client, normalized);
  if (toolName === "get_eval_coverage") return runEvalCoverageTool(normalized);
  if (toolName === "get_feedback_signals") return runFeedbackSignalsTool(client, normalized);
  if (toolName === "get_visual_job_health") return runVisualJobHealthTool(client, normalized);
  return runReleaseGateSnapshotTool(client, normalized);
}

export async function runAiEngineReadOnlyTools(
  client: AiEngineReadableClient | null,
  filters: AiEngineToolFilters & { tools?: string[] | null } = {}
) {
  const validation = validateAiEngineToolNames(filters.tools);
  if (!validation.ok) {
    return { ok: false as const, status: 400, error: `Invalid AI Engine tool(s): ${validation.invalid.join(", ")}` };
  }
  const toolResults = await Promise.all(
    validation.tools.map((toolName) => runAiEngineReadOnlyTool(client, toolName, filters))
  );
  return {
    ok: true as const,
    toolResults,
    toolResultsSummary: summarizeToolResults(toolResults),
  };
}

function fallbackRecommendationSummary(recommendations: AiEngineRecommendation[]) {
  if (recommendations.length === 0) {
    return "No AI Engine recommendations are open for this snapshot. Continue watching fallback rate, failures, latency, feedback, and eval coverage.";
  }

  const critical = recommendations.filter((item) => item.severity === "critical").length;
  const warning = recommendations.filter((item) => item.severity === "warning").length;
  const lead = critical
    ? `${critical} critical recommendation${critical === 1 ? "" : "s"} need attention.`
    : `${warning} warning recommendation${warning === 1 ? "" : "s"} should be reviewed.`;
  return `${lead} Start with ${recommendations[0]?.title ?? "the highest severity recommendation"} before tuning lower-risk surfaces.`;
}

function summaryMetaFromAi(
  meta: AiExecutionMeta | null,
  fallbackReason: string | null,
  toolResultsSummary: AiEngineToolResultSummary[] = []
): AiEngineRecommendationSummaryMeta {
  return {
    model: meta?.model ?? null,
    provider: meta?.provider ?? null,
    promptHash: meta?.promptHash ?? null,
    fallbackUsed: meta?.fallbackUsed ?? true,
    fallbackReason: meta?.fallbackReason ?? fallbackReason,
    toolCallsUsed: toolResultsSummary.length,
    toolResults: toolResultsSummary,
  };
}

export function buildAiEngineRecommendationCandidates(input: {
  metrics: Awaited<ReturnType<typeof getAiEngineMetrics>>;
  calls: Awaited<ReturnType<typeof getAiEngineCalls>>;
  feedback: Awaited<ReturnType<typeof getAiEngineFeedback>>;
  evals: ReturnType<typeof getAiEngineEvalSummary>;
  surface: string;
}): AiEngineRecommendation[] {
  const recommendations: AiEngineRecommendation[] = [];
  const metrics = input.metrics;
  const summary = metrics.summary;
  const surface = input.surface || "all";

  const add = (item: Omit<AiEngineRecommendation, "id" | "source">) => {
    recommendations.push({
      id: recommendationId(item.category, item.surface, item.title),
      source: "deterministic",
      ...item,
    });
  };

  if (metrics.unavailable || input.calls.unavailable || input.feedback.unavailable) {
    add({
      severity: "critical",
      surface,
      category: "telemetry",
      title: "AI telemetry storage is unavailable",
      evidence: metrics.unavailableReason ?? input.calls.reason ?? input.feedback.reason ?? "Service-role telemetry query failed.",
      suggestedAction: "Verify Supabase service-role configuration and ai_call_log table access before reviewing AI health.",
    });
    return recommendations;
  }

  if (summary.totalCalls === 0) {
    add({
      severity: "info",
      surface,
      category: "telemetry",
      title: "No AI calls recorded in this window",
      evidence: `0 calls were found for ${surface} in the selected window.`,
      suggestedAction: "Confirm the surface is expected to be quiet; otherwise connect missing call sites to the shared AI gateway.",
    });
  }

  if (summary.fallbackRate >= 0.35) {
    add({
      severity: "critical",
      surface,
      category: "fallback",
      title: "Fallback rate is critically high",
      evidence: `${Math.round(summary.fallbackRate * 100)}% fallback rate across ${summary.totalCalls} call(s).`,
      suggestedAction: "Check provider credentials, model availability, and recent http_error or exception rows before changing prompts.",
    });
  } else if (summary.fallbackRate >= 0.15) {
    add({
      severity: "warning",
      surface,
      category: "fallback",
      title: "Fallback rate is elevated",
      evidence: `${Math.round(summary.fallbackRate * 100)}% fallback rate across ${summary.totalCalls} call(s).`,
      suggestedAction: "Review fallback reasons and verify deterministic copy still gives users enough guidance.",
    });
  }

  if (summary.failureRate >= 0.1) {
    add({
      severity: "critical",
      surface,
      category: "reliability",
      title: "AI provider failures are above release threshold",
      evidence: `${Math.round(summary.failureRate * 100)}% failure rate across ${summary.totalCalls} call(s).`,
      suggestedAction: "Pause model or prompt changes until provider failures and retry behavior are understood.",
    });
  } else if (summary.failureRate >= 0.03) {
    add({
      severity: "warning",
      surface,
      category: "reliability",
      title: "AI provider failures need review",
      evidence: `${Math.round(summary.failureRate * 100)}% failure rate across ${summary.totalCalls} call(s).`,
      suggestedAction: "Inspect recent failure rows and compare by provider/model before rollout decisions.",
    });
  }

  const slowLatency = summary.averageLatencyMs != null && summary.averageLatencyMs >= 8000;
  if (slowLatency) {
    add({
      severity: "warning",
      surface,
      category: "latency",
      title: "Average AI latency is slow",
      evidence: `Average latency is ${summary.averageLatencyMs} ms.`,
      suggestedAction: "Review slow surfaces and consider smaller prompts, narrower retrieval, or lower-latency models.",
    });
  }

  const missingProvider = input.calls.rows.filter((row) => !row.provider || !row.model).length;
  if (missingProvider > 0) {
    add({
      severity: "warning",
      surface,
      category: "telemetry",
      title: "Some AI calls are missing model or provider metadata",
      evidence: `${missingProvider} call(s) are missing provider or model metadata.`,
      suggestedAction: "Route remaining direct callers through the shared AI gateway so operations metrics are complete.",
    });
  }

  const providerWithFailures = metrics.byProvider.find((row) => row.failures >= 2);
  if (providerWithFailures) {
    add({
      severity: "warning",
      surface,
      category: "reliability",
      title: "Repeated provider failures detected",
      evidence: `${providerWithFailures.key} has ${providerWithFailures.failures} failure(s) in this snapshot.`,
      suggestedAction: "Check provider status and model policy before broadening AI usage on affected surfaces.",
    });
  }

  if (summary.totalTokens >= 100000) {
    add({
      severity: "warning",
      surface,
      category: "cost",
      title: "Token usage is high",
      evidence: `${summary.totalTokens} tokens were recorded in this snapshot.`,
      suggestedAction: "Review prompt sizes and retrieval scope for the highest-volume surfaces.",
    });
  } else if (summary.totalTokens >= 50000) {
    add({
      severity: "info",
      surface,
      category: "cost",
      title: "Token usage is trending up",
      evidence: `${summary.totalTokens} tokens were recorded in this snapshot.`,
      suggestedAction: "Watch this surface for prompt bloat before it becomes a cost or latency problem.",
    });
  }

  const feedbackRows = Array.isArray(input.feedback.rows) ? input.feedback.rows : [];
  const feedbackCount = feedbackRows.length;
  const feedbackSummary =
    "summary" in input.feedback && input.feedback.summary
      ? input.feedback.summary
      : buildFeedbackSummary(feedbackRows);
  const totalNegativeFeedback =
    feedbackSummary.outcomeCounts.edited +
    feedbackSummary.outcomeCounts.rejected +
    feedbackSummary.outcomeCounts.regenerated;
  if (feedbackCount >= 3 && totalNegativeFeedback / feedbackCount >= 0.3) {
    const reasonCounts = new Map<string, number>();
    for (const row of feedbackRows) {
      const metadata = (row as Record<string, unknown>).signal_metadata;
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) continue;
      const reasonCode = sanitizeNullableText((metadata as Record<string, unknown>).reasonCode, 80);
      if (reasonCode) reasonCounts.set(reasonCode, (reasonCounts.get(reasonCode) ?? 0) + 1);
    }
    const topReason = Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    add({
      severity: "warning",
      surface,
      category: "feedback",
      title: "User feedback shows elevated revision pressure",
      evidence: `${totalNegativeFeedback} of ${feedbackCount} feedback signal(s) were edited, rejected, or regenerated${topReason ? `; top reason: ${topReason}` : ""}.`,
      suggestedAction: "Turn the most common revision reason into a golden eval before adjusting prompt language.",
    });
  }

  for (const feedbackSurface of feedbackSummary.needsReview.slice(0, 4)) {
    if (surface !== "all" && !surfaceMatches(feedbackSurface.surface, surface)) continue;
    add({
      severity: "warning",
      surface: feedbackSurface.surface,
      category: "feedback",
      title: "Surface needs learning-loop review",
      evidence: `${Math.round(feedbackSurface.negativeRate * 100)}% negative outcome rate across ${feedbackSurface.count} feedback signal(s).`,
      suggestedAction: "Review accepted versus edited/rejected examples and add an eval fixture before prompt or retrieval tuning.",
    });
  }

  const activeSurfaceNames = new Set<string>();
  for (const row of metrics.bySurface) {
    for (const knownSurface of AI_ENGINE_SURFACES) {
      if (row.key.includes(knownSurface) && row.calls > 0) {
        activeSurfaceNames.add(knownSurface);
      }
    }
  }
  if (surface !== "all") activeSurfaceNames.add(surface);
  const evalRows = input.evals.surfaces ?? [];
  const missingEvalSurfaces = evalRows
    .filter((row) => activeSurfaceNames.has(row.surface) && row.status !== "covered")
    .map((row) => row.surface);
  if (missingEvalSurfaces.length > 0) {
    add({
      severity: "warning",
      surface,
      category: "evals",
      title: "Active AI surface is missing eval coverage",
      evidence: `${missingEvalSurfaces.join(", ")} need golden fixtures.`,
      suggestedAction: "Add a minimal golden eval for each active missing surface before prompt or model changes.",
    });
  }

  return recommendations.sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity) || a.category.localeCompare(b.category)
  );
}

async function summarizeAiEngineRecommendationsWithTools(input: {
  aggregateSnapshot: Record<string, unknown>;
  recommendations: AiEngineRecommendation[];
  deterministicSummary: string;
  toolResultsSummary: AiEngineToolResultSummary[];
}) {
  const aiInput = [
    "Summarize these deterministic AI Engine recommendations for a Superadmin.",
    "You are using read-only diagnostic tool outputs only; do not imply that you changed production state.",
    "Do not add, remove, reprioritize, or invent recommendations.",
    "Use one concise paragraph, mention critical items first, and cite tool names in brackets when describing evidence.",
    JSON.stringify({
      aggregateSnapshot: input.aggregateSnapshot,
      toolResults: input.toolResultsSummary.map((tool) => ({
        toolName: tool.toolName,
        rowCount: tool.rowCount,
        evidenceIds: tool.evidenceIds.slice(0, 8),
        summary: tool.summary,
      })),
      recommendations: input.recommendations.slice(0, 8),
    }),
  ].join("\n\n");

  const ai = await requestAiResponsesText({
    model: process.env.COMPANY_AI_DEFAULT_MODEL?.trim() || process.env.COMPANY_AI_MODEL?.trim() || DEFAULT_RECOMMENDATION_MODEL,
    input: aiInput,
    surface: "superadmin.ai-engine.recommendations",
    promptVersion: "superadmin-ai-engine-toolbelt-v1",
    maxAttempts: 1,
    toolCallsUsed: input.toolResultsSummary.length,
  });

  return {
    summary: ai.text?.trim() || input.deterministicSummary,
    summaryMeta: summaryMetaFromAi(ai.meta, ai.meta.fallbackReason ?? null, input.toolResultsSummary),
  };
}

function normalizeRecommendationSnapshot(row: Record<string, unknown> | null, surface: string, windowDays: number): AiEngineRecommendationSnapshot | null {
  if (!row) return null;
  const recommendations = Array.isArray(row.recommendations)
    ? (row.recommendations as AiEngineRecommendation[])
    : [];
  const summaryMeta =
    row.summary_meta && typeof row.summary_meta === "object"
      ? (row.summary_meta as AiEngineRecommendationSummaryMeta)
      : summaryMetaFromAi(null, "missing_summary_meta");
  const aggregateSnapshot =
    row.aggregate_snapshot && typeof row.aggregate_snapshot === "object"
      ? (row.aggregate_snapshot as Record<string, unknown>)
      : {};
  const toolResultsSummary = Array.isArray(aggregateSnapshot.toolResultsSummary)
    ? (aggregateSnapshot.toolResultsSummary as AiEngineToolResultSummary[])
    : Array.isArray(summaryMeta.toolResults)
      ? summaryMeta.toolResults
      : [];
  return {
    id: typeof row.id === "number" || typeof row.id === "string" ? row.id : null,
    generatedAt: typeof row.generated_at === "string" ? row.generated_at : null,
    snapshotDate: typeof row.snapshot_date === "string" ? row.snapshot_date : null,
    surface: typeof row.surface === "string" ? row.surface : surface,
    windowDays: normalizeNumber(row.window_days) ?? windowDays,
    summary: typeof row.summary === "string" ? row.summary : fallbackRecommendationSummary(recommendations),
    summaryMeta,
    recommendations,
    aggregateSnapshot,
    toolResultsSummary,
  };
}

export async function getAiEngineRecommendationSnapshot(
  client: AiEngineReadableClient | null,
  filters: { surface?: string | null; windowDays?: number | null } = {}
) {
  const surface = filters.surface?.trim() || "all";
  const windowDays = toSafeWindowDays(filters.windowDays);
  const snapshotDate = todaySnapshotDate();

  if (!client) {
    return {
      snapshot: null,
      stale: true,
      generatedAt: null,
      snapshotDate: null,
      surface,
      windowDays,
      summary: "Recommendation snapshots are unavailable because runtime telemetry storage is not configured.",
      summaryMeta: summaryMetaFromAi(null, "storage_unavailable"),
      recommendations: [] as AiEngineRecommendation[],
      toolResultsSummary: [] as AiEngineToolResultSummary[],
      unavailable: true,
      reason: "supabase_service_role_unavailable",
    };
  }

  const { data, error } = await client
    .from("ai_engine_recommendation_snapshots")
    .select("id,generated_at,snapshot_date,surface,window_days,aggregate_snapshot,recommendations,summary,summary_meta")
    .eq("surface", surface)
    .eq("window_days", windowDays)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message ?? "Unable to read AI Engine recommendation snapshot.");
  }

  const first = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : null;
  const snapshot = normalizeRecommendationSnapshot(first ?? null, surface, windowDays);
  const stale = !snapshot || snapshot.snapshotDate !== snapshotDate;

  return {
    snapshot,
    stale,
    generatedAt: snapshot?.generatedAt ?? null,
    snapshotDate: snapshot?.snapshotDate ?? null,
    surface,
    windowDays,
    summary: snapshot?.summary ?? "No AI Engine recommendation snapshot has been generated for this filter yet.",
    summaryMeta: snapshot?.summaryMeta ?? summaryMetaFromAi(null, "snapshot_missing"),
    recommendations: snapshot?.recommendations ?? [],
    toolResultsSummary: snapshot?.toolResultsSummary ?? [],
    unavailable: false,
    reason: null,
  };
}

export async function refreshAiEngineRecommendationSnapshot(
  client: AiEngineReadableClient | null,
  filters: { surface?: string | null; windowDays?: number | null; generatedBy?: string | null } = {}
) {
  const surface = filters.surface?.trim() || "all";
  const windowDays = toSafeWindowDays(filters.windowDays);
  const snapshotDate = todaySnapshotDate();
  if (!client) {
    return {
      ok: false,
      status: 503,
      error: "Runtime telemetry storage is not configured.",
    };
  }

  const since = (() => {
    const date = new Date();
    date.setDate(date.getDate() - windowDays);
    return date.toISOString();
  })();

  const [metrics, calls, feedback] = await Promise.all([
    getAiEngineMetrics(client, { surface, since, limit: MAX_LIMIT }),
    getAiEngineCalls(client, { surface, since, limit: MAX_LIMIT }),
    getAiEngineFeedback(client, { surface, since, limit: MAX_LIMIT }),
  ]);
  const toolbelt = await runAiEngineReadOnlyTools(client, {
    surface,
    windowDays,
    since,
    limit: TOOL_RESULT_LIMIT,
  });
  const toolResultsSummary = toolbelt.ok ? toolbelt.toolResultsSummary : [];
  const evals = getAiEngineEvalSummary();
  const recommendations = buildAiEngineRecommendationCandidates({
    metrics,
    calls,
    feedback,
    evals,
    surface,
  });

  const deterministicSummary = fallbackRecommendationSummary(recommendations);
  const feedbackSummary =
    "summary" in feedback && feedback.summary
      ? feedback.summary
      : buildFeedbackSummary(feedback.rows);
  const aggregateSnapshot = {
    generatedFrom: {
      surface,
      windowDays,
      since,
      totalCalls: metrics.summary.totalCalls,
      fallbackRate: metrics.summary.fallbackRate,
      failureRate: metrics.summary.failureRate,
      averageLatencyMs: metrics.summary.averageLatencyMs,
      totalTokens: metrics.summary.totalTokens,
      feedbackCount: feedback.count,
      evalFixtures: evals.totalFixtures,
    },
    feedback: {
      outcomeCounts: feedbackSummary.outcomeCounts,
      bySurface: feedbackSummary.bySurface.slice(0, 12),
      needsReview: feedbackSummary.needsReview.slice(0, 12),
    },
    severityCounts: {
      critical: recommendations.filter((item) => item.severity === "critical").length,
      warning: recommendations.filter((item) => item.severity === "warning").length,
      info: recommendations.filter((item) => item.severity === "info").length,
    },
    toolResultsSummary,
  };

  const summaryResult = await summarizeAiEngineRecommendationsWithTools({
    aggregateSnapshot,
    recommendations,
    deterministicSummary,
    toolResultsSummary,
  });

  const summary = summaryResult.summary;
  const summaryMeta = summaryResult.summaryMeta;
  const generatedAt = new Date().toISOString();
  const row = {
    snapshot_date: snapshotDate,
    surface,
    window_days: windowDays,
    aggregate_snapshot: aggregateSnapshot,
    recommendations,
    summary,
    summary_meta: summaryMeta,
    generated_at: generatedAt,
    generated_by: filters.generatedBy ?? null,
    updated_at: generatedAt,
  };

  const { data, error } = await client
    .from("ai_engine_recommendation_snapshots")
    .upsert(row, { onConflict: "surface,window_days,snapshot_date" })
    .select("id,generated_at,snapshot_date,surface,window_days,aggregate_snapshot,recommendations,summary,summary_meta")
    .single();

  if (error) {
    return { ok: false, status: 500, error: error.message ?? "Unable to store recommendation snapshot." };
  }

  const snapshot = normalizeRecommendationSnapshot((data as Record<string, unknown>) ?? row, surface, windowDays);
  return {
    ok: true,
    snapshot,
    stale: false,
    generatedAt,
    snapshotDate,
    surface,
    windowDays,
    summary,
    summaryMeta,
    recommendations,
    toolResultsSummary,
  };
}

export async function runAiEngineDiagnostics(
  client: AiEngineReadableClient | null,
  filters: AiEngineToolFilters & { tools?: string[] | null; generatedBy?: string | null } = {}
) {
  const surface = filters.surface?.trim() || "all";
  const windowDays = toSafeWindowDays(filters.windowDays);
  if (!client) {
    return {
      ok: false,
      status: 503,
      error: "Runtime telemetry storage is not configured.",
    };
  }

  const since = (() => {
    const date = new Date();
    date.setDate(date.getDate() - windowDays);
    return date.toISOString();
  })();

  const toolbelt = await runAiEngineReadOnlyTools(client, {
    ...filters,
    surface,
    windowDays,
    since: filters.since ?? since,
    limit: filters.limit ?? TOOL_RESULT_LIMIT,
  });
  if (!toolbelt.ok) return toolbelt;

  const [metrics, calls, feedback] = await Promise.all([
    getAiEngineMetrics(client, { surface, since: filters.since ?? since, limit: MAX_LIMIT }),
    getAiEngineCalls(client, { surface, since: filters.since ?? since, limit: MAX_LIMIT }),
    getAiEngineFeedback(client, { surface, since: filters.since ?? since, limit: MAX_LIMIT }),
  ]);
  const evals = getAiEngineEvalSummary();
  const recommendations = buildAiEngineRecommendationCandidates({ metrics, calls, feedback, evals, surface });
  const deterministicSummary = fallbackRecommendationSummary(recommendations);
  const feedbackSummary =
    "summary" in feedback && feedback.summary
      ? feedback.summary
      : buildFeedbackSummary(feedback.rows);
  const aggregateSnapshot = {
    generatedFrom: {
      surface,
      windowDays,
      since: filters.since ?? since,
      totalCalls: metrics.summary.totalCalls,
      fallbackRate: metrics.summary.fallbackRate,
      failureRate: metrics.summary.failureRate,
      averageLatencyMs: metrics.summary.averageLatencyMs,
      totalTokens: metrics.summary.totalTokens,
      feedbackCount: feedback.count,
      evalFixtures: evals.totalFixtures,
    },
    feedback: {
      outcomeCounts: feedbackSummary.outcomeCounts,
      bySurface: feedbackSummary.bySurface.slice(0, 12),
      needsReview: feedbackSummary.needsReview.slice(0, 12),
    },
    severityCounts: {
      critical: recommendations.filter((item) => item.severity === "critical").length,
      warning: recommendations.filter((item) => item.severity === "warning").length,
      info: recommendations.filter((item) => item.severity === "info").length,
    },
    toolResultsSummary: toolbelt.toolResultsSummary,
  };
  const summaryResult = await summarizeAiEngineRecommendationsWithTools({
    aggregateSnapshot,
    recommendations,
    deterministicSummary,
    toolResultsSummary: toolbelt.toolResultsSummary,
  });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    surface,
    windowDays,
    toolResults: toolbelt.toolResults,
    toolResultsSummary: toolbelt.toolResultsSummary,
    recommendations,
    summary: summaryResult.summary,
    summaryMeta: summaryResult.summaryMeta,
    aggregateSnapshot,
  };
}
