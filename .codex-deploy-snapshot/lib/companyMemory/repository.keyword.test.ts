import { describe, expect, it } from "vitest";
import { memorySearchTokensFromQuery } from "@/lib/companyMemory/repository";

describe("memorySearchTokensFromQuery", () => {
  it("extracts site and entity tokens from a natural question", () => {
    const t = memorySearchTokensFromQuery("What PPE is required for Lilly Sites");
    expect(t).toContain("ppe");
    expect(t).toContain("lilly");
    expect(t).toContain("sites");
    expect(t).not.toContain("what");
    expect(t).not.toContain("for");
  });

  it("handles glove-related queries", () => {
    const t = memorySearchTokensFromQuery("glove requirements construction");
    expect(t).toContain("glove");
    expect(t).toContain("requirements");
    expect(t).toContain("construction");
  });
});
