import { describe, expect, it } from "vitest";
import { extractResponsesApiOutputText as extractResponsesFromAi } from "@/lib/ai/responses";
import { extractResponsesApiOutputText as extractResponsesFromCompanyMemory } from "@/lib/companyMemory/openaiResponses";

describe("companyMemory/openaiResponses", () => {
  it("re-exports the shared Responses API parser", () => {
    expect(extractResponsesFromCompanyMemory).toBe(extractResponsesFromAi);
    expect(extractResponsesFromCompanyMemory({ output_text: "  hello  " })).toBe("hello");
    expect(
      extractResponsesFromCompanyMemory({
        output: [{ content: [{ type: "output_text", text: "a" }] }],
      })
    ).toBe("a");
  });
});
