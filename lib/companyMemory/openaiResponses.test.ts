import { describe, expect, it } from "vitest";
import { extractResponsesApiOutputText } from "@/lib/companyMemory/openaiResponses";

describe("extractResponsesApiOutputText", () => {
  it("reads output_text", () => {
    expect(extractResponsesApiOutputText({ output_text: "  hello  " })).toBe("hello");
  });

  it("reads nested output_text chunks", () => {
    expect(
      extractResponsesApiOutputText({
        output: [{ content: [{ type: "output_text", text: "a" }] }],
      })
    ).toBe("a");
  });
});
