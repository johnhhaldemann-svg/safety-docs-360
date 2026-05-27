import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GusCoachingTutor", () => {
  const source = readFileSync("components/gus/GusCoachingTutor.tsx", "utf8");

  it("renders the required coaching training sections", () => {
    expect(source).toContain("20-minute lesson plan");
    expect(source).toContain("Step-by-step coaching techniques");
    expect(source).toContain("Practice with Gus");
    expect(source).toContain("One-page cheat sheet");
    expect(source).toContain("Five role-play scenarios");
    expect(source).toContain("Ten practice questions");
    expect(source).toContain("Short quiz");
    expect(source).toContain("Conversation script");
  });

  it("keeps the safety authority guardrail visible", () => {
    expect(source).toContain("Safety authority guardrail");
    expect(source).toContain("Gus cannot approve work");
    expect(source).toContain("safety lead check");
  });
});
