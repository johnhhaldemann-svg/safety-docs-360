import { afterEach, describe, expect, it } from "vitest";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";

const ORIGINAL = process.env.COMPANY_AI_DEFAULT_MODEL;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.COMPANY_AI_DEFAULT_MODEL;
  } else {
    process.env.COMPANY_AI_DEFAULT_MODEL = ORIGINAL;
  }
});

describe("resolveCompanyAiDefaultModel", () => {
  it("returns the built-in default when COMPANY_AI_DEFAULT_MODEL is unset", () => {
    delete process.env.COMPANY_AI_DEFAULT_MODEL;
    expect(resolveCompanyAiDefaultModel("gpt-4o-mini")).toBe("gpt-4o-mini");
    expect(resolveCompanyAiDefaultModel("gpt-4.1")).toBe("gpt-4.1");
  });

  it("returns the env override when COMPANY_AI_DEFAULT_MODEL is set", () => {
    process.env.COMPANY_AI_DEFAULT_MODEL = "gpt-4.1-mini";
    expect(resolveCompanyAiDefaultModel("gpt-4o-mini")).toBe("gpt-4.1-mini");
    expect(resolveCompanyAiDefaultModel("gpt-4.1")).toBe("gpt-4.1-mini");
  });

  it("ignores whitespace-only overrides and falls back to the built-in", () => {
    process.env.COMPANY_AI_DEFAULT_MODEL = "   ";
    expect(resolveCompanyAiDefaultModel("gpt-4o-mini")).toBe("gpt-4o-mini");
  });

  it("trims whitespace around a real override value", () => {
    process.env.COMPANY_AI_DEFAULT_MODEL = "  gpt-5  ";
    expect(resolveCompanyAiDefaultModel("gpt-4o-mini")).toBe("gpt-5");
  });
});
