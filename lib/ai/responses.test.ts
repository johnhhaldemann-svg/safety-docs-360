import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractResponsesApiOutputText,
  requestAiResponsesText,
  resetAiModelAccessDenylistForTests,
  runStructuredAiJsonTask,
} from "@/lib/ai/responses";

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
    resetAiModelAccessDenylistForTests();
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

  it("routes provider model access errors to the configured fallback model", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            error: {
              message: "Project does not have access to model gpt-4.1-mini",
              code: "model_not_found",
            },
          })
        ),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ output_text: "fallback ok" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAiResponsesText({
      model: "gpt-4.1-mini",
      accessFallbackModel: "gpt-4o-mini",
      input: "hello",
      surface: "gus.photo-review",
      maxAttempts: 3,
    });

    expect(result.text).toBe("fallback ok");
    expect(result.meta).toMatchObject({
      model: "gpt-4o-mini",
      provider: "openai",
      fallbackUsed: true,
      fallbackReason: "provider_model_access",
      errorType: "provider_model_access",
      attempts: 2,
      primaryModel: "gpt-4.1-mini",
      attemptedModels: ["gpt-4.1-mini", "gpt-4o-mini"],
    });
    const firstBody = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)) as { model: string };
    const secondBody = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)) as { model: string };
    expect(firstBody.model).toBe("gpt-4.1-mini");
    expect(secondBody.model).toBe("gpt-4o-mini");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("skips a primary model after the provider denies access in the same process", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            error: {
              message: "Project does not have access to model gpt-4.1-mini",
              code: "model_not_found",
            },
          })
        ),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ output_text: "first fallback" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ output_text: "second fallback" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await requestAiResponsesText({
      model: "gpt-4.1-mini",
      accessFallbackModel: "gpt-4o-mini",
      input: "first",
      surface: "gus.photo-review",
    });
    const second = await requestAiResponsesText({
      model: "gpt-4.1-mini",
      accessFallbackModel: "gpt-4o-mini",
      input: "second",
      surface: "gus.photo-review",
    });

    expect(second.text).toBe("second fallback");
    const thirdBody = JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body)) as { model: string };
    expect(thirdBody.model).toBe("gpt-4o-mini");
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
