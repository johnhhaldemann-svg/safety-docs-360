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

export type AiCallLogInput = {
  surface: string;
  model: string | null;
  promptHash: string | null;
  latencyMs: number;
  status: "ok" | "fallback" | "http_error" | "exception";
  httpStatus?: number | null;
  attempts: number;
  fallbackUsed: boolean;
  usage?: AiCallUsage | null;
  errorMessage?: string | null;
};

let warnedNoAdminClient = false;

/** Best-effort, non-blocking telemetry write. */
export function recordAiCall(input: AiCallLogInput): void {
  serverLog("info", "ai_call", {
    surface: input.surface,
    model: input.model ?? null,
    status: input.status,
    httpStatus: input.httpStatus ?? null,
    attempts: input.attempts,
    fallbackUsed: input.fallbackUsed,
    latencyMs: input.latencyMs,
    promptTokens: input.usage?.promptTokens ?? null,
    completionTokens: input.usage?.completionTokens ?? null,
    totalTokens: input.usage?.totalTokens ?? null,
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
    prompt_hash: input.promptHash?.slice(0, 64) ?? null,
    latency_ms: Math.max(0, Math.round(input.latencyMs)),
    status: input.status,
    http_status: input.httpStatus ?? null,
    attempts: Math.max(1, Math.round(input.attempts)),
    fallback_used: input.fallbackUsed,
    prompt_tokens: input.usage?.promptTokens ?? null,
    completion_tokens: input.usage?.completionTokens ?? null,
    total_tokens: input.usage?.totalTokens ?? null,
    error_message: input.errorMessage?.slice(0, 500) ?? null,
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
