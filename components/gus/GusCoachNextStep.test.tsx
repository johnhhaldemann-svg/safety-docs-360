import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GusCoachNextStep field coach layout", () => {
  const source = readFileSync("components/gus/GusCoachNextStep.tsx", "utf8");

  it("renders the Field Coach teaching sections", () => {
    expect(source).toContain("Gus field coaching");
    expect(source).toContain("What I'm seeing");
    expect(source).toContain("Why it matters");
    expect(source).toContain("Question to ask on site");
    expect(source).toContain("Next safe step");
  });

  it("uses the teaching moment instead of dense directive copy", () => {
    expect(source).toContain("directive.teachingMoment.notice");
    expect(source).toContain("directive.teachingMoment.why");
    expect(source).toContain("directive.teachingMoment.fieldQuestion");
    expect(source).toContain("directive.teachingMoment.nextStep");
  });
});
