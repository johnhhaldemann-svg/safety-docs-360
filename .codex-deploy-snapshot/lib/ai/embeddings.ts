import { buildAiPromptHash, getAiApiBaseUrl, resolveAiModelId, resolveAiProvider } from "@/lib/ai/platform";
import { recordAiCall } from "@/lib/ai/callLog";

export type AiEmbeddingResult = {
  embedding: number[];
  model: string;
  provider: string;
  promptHash: string;
};

/**
 * Shared OpenAI-compatible embeddings gateway. Keep embedding calls beside the
 * Responses gateway so model/base-url/provider telemetry stays consistent.
 */
export async function requestAiEmbedding(params: {
  apiKey?: string | null;
  model?: string | null;
  input: string;
  surface?: string;
}): Promise<AiEmbeddingResult> {
  const startedAt = Date.now();
  const surface = params.surface?.trim() || "ai.embedding.unspecified";
  const apiKey = params.apiKey ?? process.env.OPENAI_API_KEY?.trim() ?? "";
  const input = params.input.trim().slice(0, 8000);

  if (!apiKey) {
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
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  if (!input) {
    throw new Error("Text to embed is empty.");
  }

  const model = resolveAiModelId(params.model?.trim() || "text-embedding-3-small");
  const provider = resolveAiProvider(model);
  const promptHash = buildAiPromptHash(input);

  try {
    const res = await fetch(`${getAiApiBaseUrl()}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      recordAiCall({
        surface,
        model,
        provider,
        promptHash,
        latencyMs: Date.now() - startedAt,
        status: "http_error",
        httpStatus: res.status,
        attempts: 1,
        fallbackUsed: true,
        fallbackReason: "http_error",
        errorMessage: errText.slice(0, 500) || `http_${res.status}`,
      });
      throw new Error(`OpenAI embeddings failed (${res.status}): ${errText.slice(0, 400)}`);
    }

    const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    const embedding = json.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length < 100) {
      recordAiCall({
        surface,
        model,
        provider,
        promptHash,
        latencyMs: Date.now() - startedAt,
        status: "fallback",
        httpStatus: res.status,
        attempts: 1,
        fallbackUsed: true,
        fallbackReason: "empty_output_text",
        errorMessage: "invalid_embedding_response",
      });
      throw new Error("Invalid embedding response.");
    }

    recordAiCall({
      surface,
      model,
      provider,
      promptHash,
      latencyMs: Date.now() - startedAt,
      status: "ok",
      httpStatus: res.status,
      attempts: 1,
      fallbackUsed: false,
      fallbackReason: null,
    });

    return { embedding, model, provider, promptHash };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("OpenAI embeddings failed")) {
      throw error;
    }
    if (error instanceof Error && error.message === "Invalid embedding response.") {
      throw error;
    }
    recordAiCall({
      surface,
      model,
      provider,
      promptHash,
      latencyMs: Date.now() - startedAt,
      status: "exception",
      attempts: 1,
      fallbackUsed: true,
      fallbackReason: "exception",
      errorMessage: error instanceof Error ? error.message.slice(0, 500) : "unknown_exception",
    });
    throw error;
  }
}
