import { buildAiPromptHash, getAiApiBaseUrl, resolveAiModelId } from "@/lib/ai/platform";

export type AiExecutionMeta = {
  model: string | null;
  promptHash: string | null;
  fallbackUsed: boolean;
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

export async function requestAiResponsesText(params: {
  apiKey?: string | null;
  model: string;
  input: string;
  body?: Record<string, unknown>;
}): Promise<{
  text: string | null;
  json: unknown | null;
  meta: AiExecutionMeta;
}> {
  const apiKey = params.apiKey ?? process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return {
      text: null,
      json: null,
      meta: {
        model: null,
        promptHash: null,
        fallbackUsed: true,
      },
    };
  }

  const model = resolveAiModelId(params.model);
  const promptHash = buildAiPromptHash(params.input);

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

    if (!response.ok) {
      return {
        text: null,
        json: null,
        meta: {
          model,
          promptHash,
          fallbackUsed: true,
        },
      };
    }

    const json = (await response.json().catch(() => null)) as unknown;
    const text = extractResponsesApiOutputText(json);
    return {
      text,
      json,
      meta: {
        model,
        promptHash,
        fallbackUsed: !text,
      },
    };
  } catch {
    return {
      text: null,
      json: null,
      meta: {
        model,
        promptHash,
        fallbackUsed: true,
      },
    };
  }
}

export async function runStructuredAiJsonTask<T>(params: {
  apiKey?: string | null;
  modelEnv?: string | null;
  fallbackModel: string;
  system: string;
  user: string;
  fallback: T;
  body?: Record<string, unknown>;
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
      },
    };
  }
}
