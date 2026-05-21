import { afterEach, describe, expect, it, vi } from "vitest";
import { runStructuredAiJson } from "@/lib/safety-intelligence/ai/utils";

describe("runStructuredAiJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("surfaces fallback metadata from the shared AI helper", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const result = await runStructuredAiJson({
      fallbackModel: "gpt-4o-mini",
      system: "system",
      user: "user",
      fallback: { ok: false },
    });

    expect(result.parsed).toEqual({ ok: false });
    expect(result.model).toBeNull();
    expect(result.fallbackUsed).toBe(true);
  });
});
