import { afterEach, describe, expect, it, vi } from "vitest";
import { extractResponsesApiOutputText, requestAiResponsesText, runStructuredAiJsonTask } from "@/lib/ai/responses";

describe("extractResponsesApiOutputText", () => {
  it("reads top-level output_text", () => {
    expect(extractResponsesApiOutputText({ output_text: "  hello  " })).toBe("hello");
  });

  it("joins nested output_text chunks", () => {
    expect(
      extractResponsesApiOutputText({
        output: [{ content: [{ type: "output_text", text: "hello " }, { type: "output_text", text: "world" }] }],
      })
    ).toBe("hello world");
  });
});

describe("requestAiResponsesText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("falls back when the API key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const result = await requestAiResponsesText({
      model: "gpt-4.1",
      input: "hello",
    });

    expect(result.text).toBeNull();
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.model).toBeNull();
  });

  it("falls back on non-ok HTTP responses", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
      })
    );

    const result = await requestAiResponsesText({
      model: "gpt-4.1",
      input: "hello",
    });

    expect(result.text).toBeNull();
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.model).toBe("gpt-4.1");
    expect(result.meta.promptHash).toBeTruthy();
  });
});

describe("runStructuredAiJsonTask", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("falls back when model output is malformed JSON", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ output_text: "{not-json" }),
      })
    );

    const result = await runStructuredAiJsonTask({
      fallbackModel: "gpt-4.1",
      system: "system",
      user: "user",
      fallback: { ok: false },
    });

    expect(result.parsed).toEqual({ ok: false });
    expect(result.meta.fallbackUsed).toBe(true);
  });

  it("returns parsed JSON and metadata on success", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ output_text: '{"ok":true,"count":2}' }),
      })
    );

    const result = await runStructuredAiJsonTask({
      fallbackModel: "gpt-4.1",
      system: "system",
      user: "user",
      fallback: { ok: false, count: 0 },
    });

    expect(result.parsed).toEqual({ ok: true, count: 2 });
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.model).toBe("gpt-4.1");
    expect(result.meta.promptHash).toBeTruthy();
  });
});
