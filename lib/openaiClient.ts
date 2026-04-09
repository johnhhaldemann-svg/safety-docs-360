/**
 * OpenAI-compatible HTTP base URL. Default hits OpenAI directly; set
 * OPENAI_BASE_URL=https://ai-gateway.vercel.sh/v1 to use Vercel AI Gateway with OPENAI_API_KEY (e.g. vck_…).
 */
export function getOpenAiApiBaseUrl(): string {
  const raw = process.env.OPENAI_BASE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "https://api.openai.com/v1";
}

/**
 * Vercel AI Gateway model ids are typically `provider/model` (e.g. `openai/gpt-4.1`). Bare ids are prefixed when using the gateway.
 */
export function resolveOpenAiCompatibleModelId(model: string): string {
  const m = model.trim();
  if (!m || m.includes("/")) return m;
  const base = process.env.OPENAI_BASE_URL?.trim() || "";
  if (base.includes("ai-gateway.vercel.sh")) {
    return `openai/${m}`;
  }
  return m;
}
