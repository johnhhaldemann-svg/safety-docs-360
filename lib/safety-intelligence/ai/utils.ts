import { runStructuredAiJsonTask } from "@/lib/ai/responses";

export async function runStructuredAiJson<T>(params: {
  modelEnv?: string | null;
  fallbackModel: string;
  system: string;
  user: string;
  fallback: T;
}): Promise<{ parsed: T; model: string | null; promptHash: string | null; fallbackUsed: boolean }> {
  const result = await runStructuredAiJsonTask<T>(params);
  return {
    parsed: result.parsed,
    model: result.meta.model,
    promptHash: result.meta.promptHash,
    fallbackUsed: result.meta.fallbackUsed,
  };
}
