import { describe, expect, it } from "vitest";
import { formatTitleCase } from "@/lib/formatTitleCase";

describe("formatTitleCase", () => {
  it("capitalizes lowercase names and headings", () => {
    expect(formatTitleCase("test")).toBe("Test");
    expect(formatTitleCase("priority action queue")).toBe("Priority Action Queue");
  });

  it("keeps small connector words lowercase inside titles", () => {
    expect(formatTitleCase("training and hazard signals")).toBe("Training and Hazard Signals");
    expect(formatTitleCase("what should this user do next")).toBe("What Should This User Do Next");
  });

  it("preserves known acronyms and initialisms", () => {
    expect(formatTitleCase("ai api csep jsa osha ppe sor dap gc hr")).toBe(
      "AI API CSEP JSA OSHA PPE SOR DAP GC HR"
    );
    expect(formatTitleCase("recent daps and sors")).toBe("Recent DAPs and SORs");
  });

  it("preserves numbers and punctuation", () => {
    expect(formatTitleCase("1. current safety health")).toBe("1. Current Safety Health");
    expect(formatTitleCase("open high-risk items need field verification")).toBe(
      "Open High-Risk Items Need Field Verification"
    );
  });

  it("leaves empty values empty", () => {
    expect(formatTitleCase("")).toBe("");
    expect(formatTitleCase("   ")).toBe("");
    expect(formatTitleCase(null)).toBe("");
    expect(formatTitleCase(undefined)).toBe("");
  });
});
