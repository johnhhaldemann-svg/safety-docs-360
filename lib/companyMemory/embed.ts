import { getOpenAiApiBaseUrl, resolveOpenAiCompatibleModelId } from "@/lib/openaiClient";

/**
 * OpenAI text embeddings for company memory semantic search (1536-dim).
 */
export async function createEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const input = text.trim().slice(0, 8000);
  if (!input) {
    throw new Error("Text to embed is empty.");
  }

  const res = await fetch(`${getOpenAiApiBaseUrl()}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveOpenAiCompatibleModelId("text-embedding-3-small"),
      input,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings failed (${res.status}): ${errText.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const emb = json.data?.[0]?.embedding;
  if (!Array.isArray(emb) || emb.length < 100) {
    throw new Error("Invalid embedding response.");
  }
  return emb;
}
