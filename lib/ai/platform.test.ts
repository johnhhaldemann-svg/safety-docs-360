import { describe, expect, it } from "vitest";
import { buildAiPromptHash, resolveAiProvider } from "@/lib/ai/platform";

describe("AI platform helpers", () => {
  it("builds a deterministic non-reversible prompt hash", () => {
    const prompt = "secret company hazard context";
    const hash = buildAiPromptHash(prompt);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(buildAiPromptHash(prompt));
    expect(hash).not.toContain("secret");
    expect(hash).not.toBe(Buffer.from(prompt).toString("base64").slice(0, 32));
  });

  it("detects provider from routed model ids", () => {
    expect(resolveAiProvider("openai/gpt-4.1")).toBe("openai");
    expect(resolveAiProvider("anthropic/claude-3-7-sonnet")).toBe("anthropic");
    expect(resolveAiProvider("gpt-4.1")).toBe("openai");
    expect(resolveAiProvider("")).toBe("unknown");
  });
});
