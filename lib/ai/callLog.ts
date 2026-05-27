/**
 * AI call log: append-only telemetry for every OpenAI Responses API call.
 *
 * Writes are best-effort and non-blocking — a failure to log MUST NEVER fail
 * the caller. Persistence goes to `public.ai_call_log` (service-role only RLS).
 * If the Supabase admin client is not configured, we still emit a structured
 * `serverLog` line so operators can grep for AI activity.
 */

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { serverLog } from "@/lib/serverLog";

export type AiCallUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type AiCallErrorType =
  | "provider_model_access"
  | "provider_auth"
  | "provider_rate_limit"
  | "provider_timeout"
  | "provider_server_error"
  | "network_error"
  | "empty_output"
  | "invalid_json"
  | "unknown";

export type AiCallLogInput = {
  surface: string;
  model: string | null;
  provider?: string | null;
  promptHash: string | null;
  traceId?: string | null;
  promptVersion?: string | null;
  outputSchemaVersion?: string | null;
  latencyMs: number;
  status: "ok" | "fallback" | "http_error" | "exception";
  httpStatus?: number | null;
  attempts: number;
  fallbackUsed: boolean;
  fallbackReason?: string | null;
  errorType?: AiCallErrorType | string | null;
  usage?: AiCallUsage | null;
  errorMessage?: string | null;
  cacheHit?: boolean | null;
  toolCallsUsed?: number | null;
  evalFixtureId?: string | null;
};

let warnedNoAdminClient = false;

/** Best-effort, non-blocking telemetry write. */
export function recordAiCall(input: AiCallLogInput): void {
  serverLog("info", "ai_call", {
    surface: input.surface,
    model: input.model ?? null,
    provider: input.provider ?? null,
    status: input.status,
    httpStatus: input.httpStatus ?? null,
    attempts: input.attempts,
    retryCount: Math.max(0, input.attempts - 1),
    fallbackUsed: input.fallbackUsed,
    fallbackReason: input.fallbackReason ?? null,
    errorType: input.errorType ?? null,
    latencyMs: input.latencyMs,
    inputTokens: input.usage?.promptTokens ?? null,
    outputTokens: input.usage?.completionTokens ?? null,
    totalTokens: input.usage?.totalTokens ?? null,
    cacheHit: Boolean(input.cacheHit),
    toolCallsUsed: input.toolCallsUsed ?? null,
  });

  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!warnedNoAdminClient) {
      warnedNoAdminClient = true;
      serverLog("warn", "ai_call_log_no_admin_client", {
        reason: "supabase_admin_unavailable",
      });
    }
    return;
  }

  const row = {
    surface: input.surface.slice(0, 120),
    model: input.model?.slice(0, 120) ?? null,
    provider: input.provider?.slice(0, 80) ?? null,
    prompt_hash: input.promptHash?.slice(0, 64) ?? null,
    trace_id: input.traceId ?? null,
    prompt_version: input.promptVersion?.slice(0, 80) ?? null,
    output_schema_version: input.outputSchemaVersion?.slice(0, 80) ?? null,
    latency_ms: Math.max(0, Math.round(input.latencyMs)),
    status: input.status,
    http_status: input.httpStatus ?? null,
    attempts: Math.max(1, Math.round(input.attempts)),
    retry_count: Math.max(0, Math.round(input.attempts) - 1),
    fallback_used: input.fallbackUsed,
    fallback_reason: input.fallbackReason?.slice(0, 120) ?? null,
    error_type: input.errorType?.slice(0, 80) ?? null,
    prompt_tokens: input.usage?.promptTokens ?? null,
    completion_tokens: input.usage?.completionTokens ?? null,
    input_tokens: input.usage?.promptTokens ?? null,
    output_tokens: input.usage?.completionTokens ?? null,
    total_tokens: input.usage?.totalTokens ?? null,
    error_message: input.errorMessage?.slice(0, 500) ?? null,
    cache_hit: Boolean(input.cacheHit),
    tool_calls_used: Math.max(0, Math.round(input.toolCallsUsed ?? 0)),
    eval_fixture_id: input.evalFixtureId?.slice(0, 160) ?? null,
  };

  void admin
    .from("ai_call_log")
    .insert(row)
    .then(({ error }) => {
      if (error) {
        serverLog("warn", "ai_call_log_insert_failed", {
          surface: input.surface,
          message: error.message?.slice(0, 240) ?? "unknown",
        });
      }
    });
}

export function classifyAiCallError(input: {
  httpStatus?: number | null;
  fallbackReason?: string | null;
  errorMessage?: string | null;
}): AiCallErrorType | null {
  const message = normalizeProviderErrorText(input.errorMessage).toLowerCase();
  const status = input.httpStatus ?? null;

  if (
    message.includes("model_not_found") ||
    message.includes("does not have access to model") ||
    (status === 403 && message.includes("model") && message.includes("access"))
  ) {
    return "provider_model_access";
  }
  if (status === 401 || status === 403 || message.includes("invalid api key")) {
    return "provider_auth";
  }
  if (status === 408 || message.includes("timeout") || message.includes("aborted")) {
    return "provider_timeout";
  }
  if (status === 429) return "provider_rate_limit";
  if (status != null && status >= 500) return "provider_server_error";
  if (input.fallbackReason === "empty_output_text") return "empty_output";
  if (input.fallbackReason === "invalid_json") return "invalid_json";
  if (input.fallbackReason === "exception") return "network_error";
  if (input.fallbackReason || status != null || message) return "unknown";
  return null;
}

function normalizeProviderErrorText(errorMessage?: string | null): string {
  const raw = errorMessage ?? "";
  if (!raw.trim()) return raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return raw;
    const record = parsed as Record<string, unknown>;
    const error = record.error && typeof record.error === "object" ? (record.error as Record<string, unknown>) : record;
    return [
      raw,
      error.message,
      error.type,
      error.param,
      error.code,
    ]
      .filter((part): part is string => typeof part === "string")
      .join(" ");
  } catch {
    return raw;
  }
}

/** Read OpenAI Responses API `usage` payload defensively. */
export function extractResponsesApiUsage(json: unknown): AiCallUsage | null {
  if (!json || typeof json !== "object") return null;
  const usage = (json as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, unknown>;

  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const parsed = Number(v);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  /** Responses API uses input_tokens/output_tokens; some compatible gateways use prompt_tokens/completion_tokens. */
  const promptTokens = num(u.input_tokens) ?? num(u.prompt_tokens);
  const completionTokens = num(u.output_tokens) ?? num(u.completion_tokens);
  const totalTokens =
    num(u.total_tokens) ??
    (promptTokens != null && completionTokens != null ? promptTokens + completionTokens : null);

  if (promptTokens == null && completionTokens == null && totalTokens == null) {
    return null;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}
