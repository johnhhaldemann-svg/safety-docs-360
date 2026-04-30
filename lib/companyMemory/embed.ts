import { requestAiEmbedding } from "@/lib/ai/embeddings";

/**
 * OpenAI text embeddings for company memory semantic search (1536-dim).
 */
export async function createEmbedding(text: string): Promise<number[]> {
  const result = await requestAiEmbedding({
    input: text,
    surface: "company-memory.embedding",
  });
  return result.embedding;
}
