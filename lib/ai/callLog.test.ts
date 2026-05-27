import { describe, expect, it } from "vitest";
import { classifyAiCallError, extractResponsesApiUsage } from "@/lib/ai/callLog";

describe("extractResponsesApiUsage", () => {
  it("returns null when payload has no usage block", () => {
    expect(extractResponsesApiUsage(null)).toBeNull();
    expect(extractResponsesApiUsage({})).toBeNull();
    expect(extractResponsesApiUsage({ output_text: "hi" })).toBeNull();
  });

  it("reads OpenAI Responses API field names (input_tokens / output_tokens)", () => {
    expect(
      extractResponsesApiUsage({
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      })
    ).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it("reads Chat Completions style field names (prompt_tokens / completion_tokens)", () => {
    expect(
      extractResponsesApiUsage({
        usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
      })
    ).toEqual({ promptTokens: 8, completionTokens: 4, totalTokens: 12 });
  });

  it("derives total when only prompt + completion are present", () => {
    expect(
      extractResponsesApiUsage({
        usage: { input_tokens: 3, output_tokens: 2 },
      })
    ).toEqual({ promptTokens: 3, completionTokens: 2, totalTokens: 5 });
  });

  it("coerces string-encoded numbers", () => {
    expect(
      extractResponsesApiUsage({
        usage: { input_tokens: "11", output_tokens: "9" },
      })
    ).toEqual({ promptTokens: 11, completionTokens: 9, totalTokens: 20 });
  });

  it("returns null when all fields are missing or non-numeric", () => {
    expect(extractResponsesApiUsage({ usage: { foo: "bar" } })).toBeNull();
  });
});

describe("classifyAiCallError", () => {
  it("classifies inaccessible model errors for routing diagnostics", () => {
    expect(
      classifyAiCallError({
        httpStatus: 403,
        fallbackReason: "http_error",
        errorMessage: "Project does not have access to model `gpt-4.1`; code model_not_found",
      })
    ).toBe("provider_model_access");
  });

  it("classifies OpenAI JSON model access errors before generic 403 auth errors", () => {
    expect(
      classifyAiCallError({
        httpStatus: 403,
        fallbackReason: "http_error",
        errorMessage: JSON.stringify({
          error: {
            message: "The project does not have access to this model.",
            type: "invalid_request_error",
            param: "model",
            code: "model_not_found",
          },
        }),
      })
    ).toBe("provider_model_access");
  });

  it("classifies common provider and output failures", () => {
    expect(classifyAiCallError({ httpStatus: 429, fallbackReason: "http_error" })).toBe("provider_rate_limit");
    expect(classifyAiCallError({ httpStatus: 503, fallbackReason: "http_error" })).toBe("provider_server_error");
    expect(classifyAiCallError({ fallbackReason: "empty_output_text" })).toBe("empty_output");
    expect(classifyAiCallError({ fallbackReason: "invalid_json" })).toBe("invalid_json");
  });
});
