import { buildAiPromptHash, getAiApiBaseUrl, resolveAiModelId, resolveAiProvider } from "@/lib/ai/platform";
import { extractResponsesApiUsage, recordAiCall, type AiCallUsage } from "@/lib/ai/callLog";

export type AiFallbackReason =
  | "no_openai_api_key"
  | "http_error"
  | "exception"
  | "empty_output_text"
  | "invalid_json"
  | null;

export type AiExecutionMeta = {
  model: string | null;
  provider: string | null;
  promptHash: string | null;
  fallbackUsed: boolean;
  fallbackReason: AiFallbackReason;
  attempts: number;
  latencyMs: number;
  usage: AiCallUsage | null;
  surface: string | null;
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
  input: string;
  body?: Record<string, unknown>;
  /** Logical AI surface (e.g. "risk-memory.llm", "permit.copilot") for telemetry. */
  surface?: string;
  /** Override retry attempts (default 3). Set to 1 to disable retries. */
  maxAttempts?: number;
}): Promise<{
  text: string | null;
  json: unknown | null;
  meta: AiExecutionMeta;
}> {
  const surface = params.surface?.trim() || "ai.unspecified";
  const startedAt = Date.now();
  const apiKey = params.apiKey ?? process.env.OPENAI_API_KEY?.trim() ?? "";

  if (!apiKey) {
    const meta: AiExecutionMeta = {
      model: null,
      provider: null,
      promptHash: null,
      fallbackUsed: true,
      fallbackReason: "no_openai_api_key",
      attempts: 0,
      latencyMs: 0,
      usage: null,
      surface,
    };
    recordAiCall({
      surface,
      model: null,
      provider: null,
      promptHash: null,
      latencyMs: 0,
      status: "fallback",
      attempts: 0,
      fallbackUsed: true,
      fallbackReason: "no_openai_api_key",
      errorMessage: "no_openai_api_key",
    });
    return { text: null, json: null, meta };
  }

  const model = resolveAiModelId(params.model);
  const provider = resolveAiProvider(model);
  const promptHash = buildAiPromptHash(params.input);
  const maxAttempts = Math.max(1, params.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);

  let attempt = 0;
  let lastHttpStatus: number | null = null;
  let lastErrorMessage: string | null = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await fetch(`${getAiApiBaseUrl()}/responses`, {
        method: "POST",
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
        if (attempt < maxAttempts && shouldRetry(response.status)) {
          await sleep(backoffDelay(attempt, DEFAULT_BACKOFF_MS));
          continue;
        }

        const meta: AiExecutionMeta = {
          model,
          provider,
          promptHash,
          fallbackUsed: true,
          fallbackReason: "http_error",
          attempts: attempt,
          latencyMs: Date.now() - startedAt,
          usage: null,
          surface,
        };
        recordAiCall({
          surface,
          model,
          provider,
          promptHash,
          latencyMs: meta.latencyMs,
          status: "http_error",
          httpStatus: response.status,
          attempts: attempt,
          fallbackUsed: true,
          fallbackReason: "http_error",
          errorMessage: `http_${response.status}`,
        });
        return { text: null, json: null, meta };
      }

      const json = (await response.json().catch(() => null)) as unknown;
      const text = extractResponsesApiOutputText(json);
      const usage = extractResponsesApiUsage(json);
      const latencyMs = Date.now() - startedAt;
      const fallbackUsed = !text;

      const meta: AiExecutionMeta = {
        model,
        provider,
        promptHash,
        fallbackUsed,
        fallbackReason: fallbackUsed ? "empty_output_text" : null,
        attempts: attempt,
        latencyMs,
        usage,
        surface,
      };
      recordAiCall({
        surface,
        model,
        provider,
        promptHash,
        latencyMs,
        status: fallbackUsed ? "fallback" : "ok",
        httpStatus: response.status,
        attempts: attempt,
        fallbackUsed,
        fallbackReason: fallbackUsed ? "empty_output_text" : null,
        usage,
        errorMessage: fallbackUsed ? "empty_output_text" : null,
      });

      return { text, json, meta };
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : String(error);
      if (attempt < maxAttempts) {
        await sleep(backoffDelay(attempt, DEFAULT_BACKOFF_MS));
        continue;
      }
      const meta: AiExecutionMeta = {
        model,
        provider,
        promptHash,
        fallbackUsed: true,
        fallbackReason: "exception",
        attempts: attempt,
        latencyMs: Date.now() - startedAt,
        usage: null,
        surface,
      };
      recordAiCall({
        surface,
        model,
        provider,
        promptHash,
        latencyMs: meta.latencyMs,
        status: "exception",
        httpStatus: lastHttpStatus,
        attempts: attempt,
        fallbackUsed: true,
        fallbackReason: "exception",
        errorMessage: lastErrorMessage?.slice(0, 240) ?? "unknown_exception",
      });
      return { text: null, json: null, meta };
    }
  }

  /** Unreachable; satisfies the type checker. */
  const meta: AiExecutionMeta = {
    model,
    provider,
    promptHash,
    fallbackUsed: true,
    fallbackReason: "exception",
    attempts: attempt,
    latencyMs: Date.now() - startedAt,
    usage: null,
    surface,
  };
  return { text: null, json: null, meta };
}

export async function runStructuredAiJsonTask<T>(params: {
  apiKey?: string | null;
  modelEnv?: string | null;
  fallbackModel: string;
  system: string;
  user: string;
  fallback: T;
  body?: Record<string, unknown>;
  /** Logical AI surface (e.g. "safety-intelligence.review") for telemetry. */
  surface?: string;
  maxAttempts?: number;
}): Promise<{
  parsed: T;
  text: string | null;
  json: unknown | null;
  meta: AiExecutionMeta;
}> {
  const input = `${params.system}\n\n---\n\n${params.user}`;
  const response = await requestAiResponsesText({
    apiKey: params.apiKey,
    model: params.modelEnv?.trim() || params.fallbackModel,
    input,
    body: params.body,
    surface: params.surface,
    maxAttempts: params.maxAttempts,
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
      },
    };
  }
}
