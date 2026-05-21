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
      surface: "test.surface",
    });

    expect(result.text).toBeNull();
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.model).toBeNull();
    expect(result.meta.provider).toBeNull();
    expect(result.meta.fallbackReason).toBe("no_openai_api_key");
    expect(result.meta.attempts).toBe(0);
    expect(result.meta.surface).toBe("test.surface");
  });

  it("falls back on persistent non-ok HTTP responses (non-retryable)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, json: vi.fn() });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAiResponsesText({
      model: "gpt-4.1",
      input: "hello",
      surface: "test.surface",
    });

    expect(result.text).toBeNull();
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.model).toBe("gpt-4.1");
    expect(result.meta.provider).toBe("openai");
    expect(result.meta.fallbackReason).toBe("http_error");
    expect(result.meta.promptHash).toBeTruthy();
    expect(result.meta.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx and succeeds when the second attempt is ok", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: vi.fn() })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          output_text: "hi",
          usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAiResponsesText({
      model: "gpt-4.1",
      input: "hello",
      surface: "test.surface",
      maxAttempts: 2,
    });

    expect(result.text).toBe("hi");
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.fallbackReason).toBeNull();
    expect(result.meta.attempts).toBe(2);
    expect(result.meta.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on 429 then falls back when retries are exhausted", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429, json: vi.fn() });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAiResponsesText({
      model: "gpt-4.1",
      input: "hello",
      surface: "test.surface",
      maxAttempts: 3,
    });

    expect(result.text).toBeNull();
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.fallbackReason).toBe("http_error");
    expect(result.meta.attempts).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry on 4xx other than retryable codes", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, json: vi.fn() });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAiResponsesText({
      model: "gpt-4.1",
      input: "hello",
      surface: "test.surface",
      maxAttempts: 3,
    });

    expect(result.text).toBeNull();
    expect(result.meta.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on thrown network errors", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ output_text: "ok" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAiResponsesText({
      model: "gpt-4.1",
      input: "hello",
      surface: "test.surface",
      maxAttempts: 2,
    });

    expect(result.text).toBe("ok");
    expect(result.meta.attempts).toBe(2);
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.fallbackReason).toBeNull();
  });

  it("captures usage in meta", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          output_text: "hello",
          usage: { input_tokens: 12, output_tokens: 7 },
        }),
      })
    );

    const result = await requestAiResponsesText({
      model: "gpt-4.1",
      input: "hello",
      surface: "test.surface",
    });

    expect(result.meta.usage).toEqual({ promptTokens: 12, completionTokens: 7, totalTokens: 19 });
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
        status: 200,
        json: vi.fn().mockResolvedValue({ output_text: "{not-json" }),
      })
    );

    const result = await runStructuredAiJsonTask({
      fallbackModel: "gpt-4.1",
      system: "system",
      user: "user",
      fallback: { ok: false },
      surface: "test.json",
    });

    expect(result.parsed).toEqual({ ok: false });
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.fallbackReason).toBe("invalid_json");
  });

  it("returns parsed JSON and metadata on success", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ output_text: '{"ok":true,"count":2}' }),
      })
    );

    const result = await runStructuredAiJsonTask({
      fallbackModel: "gpt-4.1",
      system: "system",
      user: "user",
      fallback: { ok: false, count: 0 },
      surface: "test.json",
    });

    expect(result.parsed).toEqual({ ok: true, count: 2 });
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.fallbackReason).toBeNull();
    expect(result.meta.model).toBe("gpt-4.1");
    expect(result.meta.promptHash).toBeTruthy();
    expect(result.meta.surface).toBe("test.json");
  });
});
