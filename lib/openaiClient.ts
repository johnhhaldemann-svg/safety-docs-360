/**
 * OpenAI-compatible HTTP base URL. Default hits OpenAI directly; set
 * OPENAI_BASE_URL=https://ai-gateway.vercel.sh/v1 to use Vercel AI Gateway with OPENAI_API_KEY (e.g. vck_…).
 */
import { getAiApiBaseUrl, resolveAiModelId } from "@/lib/ai/platform";

export function getOpenAiApiBaseUrl(): string {
  return getAiApiBaseUrl();
}

/**
 * Vercel AI Gateway model ids are typically `provider/model` (e.g. `openai/gpt-4.1`). Bare ids are prefixed when using the gateway.
 */
export function resolveOpenAiCompatibleModelId(model: string): string {
  return resolveAiModelId(model);
}
