import { createHash } from "node:crypto";

/**
 * OpenAI-compatible HTTP base URL. Default hits OpenAI directly; set
 * OPENAI_BASE_URL=https://ai-gateway.vercel.sh/v1 to use Vercel AI Gateway.
 */
export function getAiApiBaseUrl(): string {
  const raw = process.env.OPENAI_BASE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "https://api.openai.com/v1";
}

/**
 * Vercel AI Gateway model ids are typically `provider/model` (for example,
 * `openai/gpt-4.1`). Bare ids are prefixed when using the gateway.
 */
export function resolveAiModelId(model: string): string {
  const trimmed = model.trim();
  if (!trimmed || trimmed.includes("/")) return trimmed;
  const base = process.env.OPENAI_BASE_URL?.trim() || "";
  if (base.includes("ai-gateway.vercel.sh")) {
    return `openai/${trimmed}`;
  }
  return trimmed;
}

export function resolveAiProvider(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) return "unknown";
  const provider = trimmed.split("/")[0]?.trim();
  return trimmed.includes("/") && provider ? provider : "openai";
}

export function buildAiPromptHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
