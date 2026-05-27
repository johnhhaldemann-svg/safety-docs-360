import { randomUUID } from "node:crypto";
import { buildAiPromptHash, getAiApiBaseUrl, resolveAiModelId, resolveAiProvider } from "@/lib/ai/platform";
import {
  classifyAiCallError,
  extractResponsesApiUsage,
  recordAiCall,
  type AiCallErrorType,
  type AiCallUsage,
} from "@/lib/ai/callLog";
import { serverLog } from "@/lib/serverLog";

export type AiFallbackReason =
  | "no_openai_api_key"
  | "http_error"
  | "exception"
  | "empty_output_text"
  | "provider_model_access"
  | "invalid_json"
  | null;

export type AiExecutionMeta = {
  model: string | null;
  provider: string | null;
  promptHash: string | null;
  traceId?: string | null;
  promptVersion?: string | null;
  outputSchemaVersion?: string | null;
  fallbackUsed: boolean;
  fallbackReason: AiFallbackReason;
  errorType?: AiCallErrorType | null;
  attempts: number;
  retryCount?: number;
  latencyMs: number;
  usage: AiCallUsage | null;
  surface: string | null;
  cacheHit?: boolean;
  toolCallsUsed?: number;
  evalFixtureId?: string | null;
  primaryModel?: string | null;
  attemptedModels?: string[];
};

export function extractResponsesApiOutputText(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text.trim();
  }

  const output = record.output;
  if (!Array.isArray(output)) return null;

  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const parsed = part as Record<string, unknown>;
      if (parsed.type === "output_text" && typeof parsed.text === "string") {
        chunks.push(parsed.text);
      }
    }
  }

  const joined = chunks.join("").trim();
  return joined || null;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 250;
const modelAccessDenylist = new Set<string>();

function modelAccessDenylistKey(baseUrl: string, model: string): string {
  return `${resolveAiProvider(model)}|${baseUrl}|${model}`;
}

function isModelAccessDenied(baseUrl: string, model: string): boolean {
  return modelAccessDenylist.has(modelAccessDenylistKey(baseUrl, model));
}

function rememberModelAccessDenied(baseUrl: string, model: string): void {
  modelAccessDenylist.add(modelAccessDenylistKey(baseUrl, model));
}

export function resetAiModelAccessDenylistForTests(): void {
  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") return;
  modelAccessDenylist.clear();
}

function shouldRetry(httpStatus: number): boolean {
  return httpStatus === 408 || httpStatus === 425 || httpStatus === 429 || (httpStatus >= 500 && httpStatus < 600);
}

function backoffDelay(attempt: number, baseMs: number): number {
  /** Exponential with jitter: base * 2^(attempt-1) +/- 25%. */
  const exp = baseMs * Math.pow(2, Math.max(0, attempt - 1));
  const jitter = exp * (Math.random() * 0.5 - 0.25);
  return Math.max(0, Math.round(exp + jitter));
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestAiResponsesText(params: {
  apiKey?: string | null;
  model: string;
  input: string | unknown[];
  body?: Record<string, unknown>;
  /** Logical AI surface (e.g. "risk-memory.llm", "permit.copilot") for telemetry. */
  surface?: string;
  traceId?: string | null;
  promptVersion?: string | null;
  outputSchemaVersion?: string | null;
  cacheHit?: boolean | null;
  evalFixtureId?: string | null;
  /** Deterministic server-side tools used before this model call. */
  toolCallsUsed?: number | null;
  /** Override retry attempts (default 3). Set to 1 to disable retries. */
  maxAttempts?: number;
  /** Fallback model to try when the primary model is denied by the provider. */
  accessFallbackModel?: string | null;
  /** Optional abort signal for caller-specific timeouts. */
  signal?: AbortSignal;
}): Promise<{
  text: string | null;
  json: unknown | null;
  meta: AiExecutionMeta;
}> {
  const surface = params.surface?.trim() || "ai.unspecified";
  const startedAt = Date.now();
  const apiKey = params.apiKey ?? process.env.OPENAI_API_KEY?.trim() ?? "";
  const traceId = params.traceId?.trim() || randomUUID();
  const promptVersion = params.promptVersion?.trim() || null;
  const outputSchemaVersion = params.outputSchemaVersion?.trim() || null;
  const evalFixtureId = params.evalFixtureId?.trim() || process.env.AI_EVAL_FIXTURE_ID?.trim() || null;
  const toolCallsUsed =
    params.toolCallsUsed == null
      ? Array.isArray(params.body?.tools)
        ? params.body.tools.length
        : 0
      : Math.max(0, Math.round(params.toolCallsUsed));
  const cacheHit = Boolean(params.cacheHit);

  if (!apiKey) {
    const meta: AiExecutionMeta = {
      model: null,
      provider: null,
      promptHash: null,
      traceId,
      promptVersion,
      outputSchemaVersion,
      fallbackUsed: true,
      fallbackReason: "no_openai_api_key",
      errorType: "provider_auth",
      attempts: 0,
      retryCount: 0,
      latencyMs: 0,
      usage: null,
      surface,
      cacheHit,
      toolCallsUsed,
      evalFixtureId,
    };
    recordAiCall({
      surface,
      model: null,
      provider: null,
      promptHash: null,
      traceId,
      promptVersion,
      outputSchemaVersion,
      latencyMs: 0,
      status: "fallback",
      attempts: 0,
      fallbackUsed: true,
      fallbackReason: "no_openai_api_key",
      errorType: "provider_auth",
      errorMessage: "no_openai_api_key",
      cacheHit,
      toolCallsUsed,
      evalFixtureId,
    });
    return { text: null, json: null, meta };
  }

  const apiBaseUrl = getAiApiBaseUrl();
  const primaryModel = resolveAiModelId(params.model);
  const accessFallbackModel = params.accessFallbackModel?.trim()
    ? resolveAiModelId(params.accessFallbackModel)
    : null;
  const promptHash = buildAiPromptHash(typeof params.input === "string" ? params.input : JSON.stringify(params.input));
  const maxAttempts = Math.max(1, params.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);

  const candidateModels =
    accessFallbackModel && accessFallbackModel !== primaryModel
      ? [primaryModel, accessFallbackModel]
      : [primaryModel];
  const attemptedModels: string[] = [];
  let accessFallbackUsed = false;
  let accessFallbackReason: "provider_model_access" | null = null;
  let attempt = 0;
  let lastHttpStatus: number | null = null;
  let lastErrorMessage: string | null = null;

  for (const model of candidateModels) {
    const provider = resolveAiProvider(model);
    if (model === primaryModel && accessFallbackModel && isModelAccessDenied(apiBaseUrl, model)) {
      accessFallbackUsed = true;
      accessFallbackReason = "provider_model_access";
      continue;
    }
    if (model !== primaryModel) {
      accessFallbackUsed = true;
      accessFallbackReason = "provider_model_access";
    }

    let modelAttempt = 0;
    while (modelAttempt < maxAttempts) {
      modelAttempt += 1;
      attempt += 1;
      if (!attemptedModels.includes(model)) attemptedModels.push(model);
      try {
        const response = await fetch(`${apiBaseUrl}/responses`, {
          method: "POST",
          signal: params.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            input: params.input,
            ...(params.body ?? {}),
          }),
        });

        lastHttpStatus = response.status;

        if (!response.ok) {
          if (modelAttempt < maxAttempts && shouldRetry(response.status)) {
            await sleep(backoffDelay(modelAttempt, DEFAULT_BACKOFF_MS));
            continue;
          }

          const errText =
            typeof response.text === "function" ? await response.text().catch(() => "") : "";
          const errorType = classifyAiCallError({
            httpStatus: response.status,
            fallbackReason: "http_error",
            errorMessage: errText,
          });

          if (errorType === "provider_model_access" && accessFallbackModel && model !== accessFallbackModel) {
            rememberModelAccessDenied(apiBaseUrl, model);
            accessFallbackUsed = true;
            accessFallbackReason = "provider_model_access";
            lastErrorMessage = errText || `http_${response.status}`;
            serverLog("warn", "ai_model_access_denied", {
              surface,
              provider,
              model,
              fallbackModel: accessFallbackModel,
              httpStatus: response.status,
              traceId,
            });
            break;
          }

          const meta: AiExecutionMeta = {
            model,
            provider,
            promptHash,
            traceId,
            promptVersion,
            outputSchemaVersion,
            fallbackUsed: true,
            fallbackReason: "http_error",
            errorType,
            attempts: attempt,
            retryCount: Math.max(0, attempt - 1),
            latencyMs: Date.now() - startedAt,
            usage: null,
            surface,
            cacheHit,
            toolCallsUsed,
            evalFixtureId,
            primaryModel,
            attemptedModels,
          };
          recordAiCall({
            surface,
            model,
            provider,
            promptHash,
            traceId,
            promptVersion,
            outputSchemaVersion,
            latencyMs: meta.latencyMs,
            status: "http_error",
            httpStatus: response.status,
            attempts: attempt,
            fallbackUsed: true,
            fallbackReason: "http_error",
            errorType: meta.errorType,
            errorMessage: errText.slice(0, 500) || `http_${response.status}`,
            cacheHit,
            toolCallsUsed,
            evalFixtureId,
          });
          return { text: null, json: null, meta };
        }

        const json = (await response.json().catch(() => null)) as unknown;
        const text = extractResponsesApiOutputText(json);
        const usage = extractResponsesApiUsage(json);
        const latencyMs = Date.now() - startedAt;
        const fallbackUsed = !text || accessFallbackUsed;
        const fallbackReason = !text ? "empty_output_text" : accessFallbackReason;
        const errorType = !text ? "empty_output" : accessFallbackReason;

        const meta: AiExecutionMeta = {
          model,
          provider,
          promptHash,
          traceId,
          promptVersion,
          outputSchemaVersion,
          fallbackUsed,
          fallbackReason,
          errorType,
          attempts: attempt,
          retryCount: Math.max(0, attempt - 1),
          latencyMs,
          usage,
          surface,
          cacheHit,
          toolCallsUsed,
          evalFixtureId,
          primaryModel,
          attemptedModels,
        };
        recordAiCall({
          surface,
          model,
          provider,
          promptHash,
          traceId,
          promptVersion,
          outputSchemaVersion,
          latencyMs,
          status: text ? "ok" : "fallback",
          httpStatus: response.status,
          attempts: attempt,
          fallbackUsed,
          fallbackReason,
          errorType,
          usage,
          errorMessage: !text ? "empty_output_text" : lastErrorMessage?.slice(0, 500) ?? null,
          cacheHit,
          toolCallsUsed,
          evalFixtureId,
        });

        return { text, json, meta };
      } catch (error) {
        lastErrorMessage = error instanceof Error ? error.message : String(error);
        if (modelAttempt < maxAttempts) {
          await sleep(backoffDelay(modelAttempt, DEFAULT_BACKOFF_MS));
          continue;
        }
        const meta: AiExecutionMeta = {
          model,
          provider,
          promptHash,
          traceId,
          promptVersion,
          outputSchemaVersion,
          fallbackUsed: true,
          fallbackReason: "exception",
          errorType: classifyAiCallError({
            httpStatus: lastHttpStatus,
            fallbackReason: "exception",
            errorMessage: lastErrorMessage,
          }),
          attempts: attempt,
          retryCount: Math.max(0, attempt - 1),
          latencyMs: Date.now() - startedAt,
          usage: null,
          surface,
          cacheHit,
          toolCallsUsed,
          evalFixtureId,
          primaryModel,
          attemptedModels,
        };
        recordAiCall({
          surface,
          model,
          provider,
          promptHash,
          traceId,
          promptVersion,
          outputSchemaVersion,
          latencyMs: meta.latencyMs,
          status: "exception",
          httpStatus: lastHttpStatus,
          attempts: attempt,
          fallbackUsed: true,
          fallbackReason: "exception",
          errorType: meta.errorType,
          errorMessage: lastErrorMessage?.slice(0, 240) ?? "unknown_exception",
          cacheHit,
          toolCallsUsed,
          evalFixtureId,
        });
        return { text: null, json: null, meta };
      }
    }
  }

  /** Unreachable; satisfies the type checker. */
  const meta: AiExecutionMeta = {
    model: primaryModel,
    provider: resolveAiProvider(primaryModel),
    promptHash,
    traceId,
    promptVersion,
    outputSchemaVersion,
    fallbackUsed: true,
    fallbackReason: "exception",
    errorType: "unknown",
    attempts: attempt,
    retryCount: Math.max(0, attempt - 1),
    latencyMs: Date.now() - startedAt,
    usage: null,
    surface,
    cacheHit,
    toolCallsUsed,
    evalFixtureId,
    primaryModel,
    attemptedModels,
  };
  return { text: null, json: null, meta };
}

export async function runStructuredAiJsonTask<T>(params: {
  apiKey?: string | null;
  modelEnv?: string | null;
  fallbackModel: string;
  system: string;
  user: string;
  inputOverride?: string | unknown[];
  fallback: T;
  body?: Record<string, unknown>;
  /** Logical AI surface (e.g. "safety-intelligence.review") for telemetry. */
  surface?: string;
  maxAttempts?: number;
  promptVersion?: string | null;
  outputSchemaVersion?: string | null;
  traceId?: string | null;
  cacheHit?: boolean | null;
  evalFixtureId?: string | null;
  toolCallsUsed?: number | null;
}): Promise<{
  parsed: T;
  text: string | null;
  json: unknown | null;
  meta: AiExecutionMeta;
}> {
  const input = params.inputOverride ?? `${params.system}\n\n---\n\n${params.user}`;
  const response = await requestAiResponsesText({
    apiKey: params.apiKey,
    model: params.modelEnv?.trim() || params.fallbackModel,
    input,
    body: params.body,
    surface: params.surface,
    maxAttempts: params.maxAttempts,
    accessFallbackModel: params.fallbackModel,
    promptVersion: params.promptVersion,
    outputSchemaVersion: params.outputSchemaVersion,
    traceId: params.traceId,
    cacheHit: params.cacheHit,
    evalFixtureId: params.evalFixtureId,
    toolCallsUsed: params.toolCallsUsed,
  });

  if (!response.text) {
    return {
      parsed: params.fallback,
      text: null,
      json: response.json,
      meta: response.meta,
    };
  }

  try {
    return {
      parsed: JSON.parse(response.text) as T,
      text: response.text,
      json: response.json,
      meta: {
        ...response.meta,
        fallbackUsed: false,
        fallbackReason: null,
        errorType: null,
      },
    };
  } catch {
    return {
      parsed: params.fallback,
      text: response.text,
      json: response.json,
      meta: {
        ...response.meta,
        fallbackUsed: true,
        fallbackReason: "invalid_json",
        errorType: "invalid_json",
      },
    };
  }
}
