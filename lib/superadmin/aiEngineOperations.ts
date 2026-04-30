import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const AI_ENGINE_SURFACES = [
  "safety-intelligence",
  "company-memory",
  "permit-copilot",
  "csep-review",
  "gc-review",
  "injury-weather",
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
  latency_ms: number | null;
  status: string;
  http_status: number | null;
  attempts: number | null;
  fallback_used: boolean | null;
  fallback_reason: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  error_message: string | null;
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
};

export type AiEngineReadableClient = {
  from(table: string): AiEngineTableBuilder;
};

type AiEngineQueryResult = {
  data: unknown[] | null;
  error: { message?: string | null } | null;
  count?: number | null;
};

type AiEngineTableBuilder = {
  select(columns: string, options?: { count?: "exact" }): AiEngineQueryBuilder;
  insert(row: Record<string, unknown>): AiEngineInsertBuilder;
};

type AiEngineQueryBuilder = PromiseLike<AiEngineQueryResult> & {
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

function normalizeCallRow(row: Record<string, unknown>): AiEngineCallRow {
  return {
    id: typeof row.id === "number" || typeof row.id === "string" ? row.id : "",
    created_at: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
    surface: sanitizeNullableText(row.surface, 120) ?? "unknown",
    model: sanitizeNullableText(row.model, 120),
    provider: sanitizeNullableText(row.provider, 80),
    latency_ms: normalizeNumber(row.latency_ms),
    status: sanitizeNullableText(row.status, 40) ?? "unknown",
    http_status: normalizeNumber(row.http_status),
    attempts: normalizeNumber(row.attempts),
    fallback_used: typeof row.fallback_used === "boolean" ? row.fallback_used : null,
    fallback_reason: sanitizeNullableText(row.fallback_reason, 120),
    prompt_tokens: normalizeNumber(row.prompt_tokens),
    completion_tokens: normalizeNumber(row.completion_tokens),
    total_tokens: normalizeNumber(row.total_tokens),
    error_message: sanitizeNullableText(row.error_message, 240),
  };
}

function incrementGroup(
  groups: Record<string, { key: string; calls: number; fallbacks: number; failures: number; tokens: number }>,
  key: string | null,
  row: AiEngineCallRow
) {
  const groupKey = key || "unknown";
  const existing =
    groups[groupKey] ??
    (groups[groupKey] = { key: groupKey, calls: 0, fallbacks: 0, failures: 0, tokens: 0 });
  existing.calls += 1;
  if (row.fallback_used || row.status === "fallback") existing.fallbacks += 1;
  if (row.status === "http_error" || row.status === "exception") existing.failures += 1;
  existing.tokens += row.total_tokens ?? 0;
}

function sortedGroups(
  groups: Record<string, { key: string; calls: number; fallbacks: number; failures: number; tokens: number }>
) {
  return Object.values(groups).sort((a, b) => b.calls - a.calls || a.key.localeCompare(b.key));
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
      "id,created_at,surface,model,provider,latency_ms,status,http_status,attempts,fallback_used,fallback_reason,prompt_tokens,completion_tokens,total_tokens,error_message",
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
  const latencies = rows.map((row) => row.latency_ms).filter((n): n is number => n != null);
  const averageLatencyMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((sum, n) => sum + n, 0) / latencies.length)
      : null;

  const bySurface: Record<string, { key: string; calls: number; fallbacks: number; failures: number; tokens: number }> =
    {};
  const byModel: Record<string, { key: string; calls: number; fallbacks: number; failures: number; tokens: number }> =
    {};
  const byProvider: Record<string, { key: string; calls: number; fallbacks: number; failures: number; tokens: number }> =
    {};

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
    };
  }

  const limit = toSafeLimit(filters.limit);
  const since = toSinceIso(filters.since);
  let query = client
    .from("ai_output_feedback")
    .select(
      "id,created_at,surface,source_id,ai_review_id,rating,outcome,reason,created_by",
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

  return {
    rows: Array.isArray(data) ? data : [],
    count: count ?? (Array.isArray(data) ? data.length : 0),
    unavailable: false,
    reason: null,
  };
}

export async function recordAiEngineFeedback(
  client: AiEngineReadableClient | null,
  input: AiEngineFeedbackInput
) {
  if (!client) {
    return { ok: false, error: "Supabase service role is not configured.", status: 503 };
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
    created_by: input.createdBy ?? null,
  };

  const { data, error } = await client
    .from("ai_output_feedback")
    .insert(row)
    .select("id,created_at,surface,source_id,ai_review_id,rating,outcome,reason,created_by")
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
