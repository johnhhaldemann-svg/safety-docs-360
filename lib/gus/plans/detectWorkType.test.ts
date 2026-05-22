import { describe, expect, it } from "vitest";
import { detectGusWorkTypes } from "@/lib/gus/plans/detectWorkType";

function idsFor(text: string) {
  return detectGusWorkTypes(text).matches.map((match) => match.id);
}

describe("detectGusWorkTypes", () => {
  it("detects hot work, fire prevention, PPE, and housekeeping for grinding near stored materials", () => {
    const result = detectGusWorkTypes("grinding steel near stored materials");
    const ids = result.matches.map((match) => match.id);

    expect(result.lowConfidence).toBe(false);
    expect(ids).toContain("hotWork");
    expect(ids).toContain("firePrevention");
    expect(ids).toContain("ppe");
    expect(ids).toContain("housekeeping");
  });

  it("detects MEWP, work at height, and falling object controls for lift overhead work", () => {
    const ids = idsFor("using a lift to install ductwork overhead");

    expect(ids).toContain("mewp");
    expect(ids).toContain("workAtHeight");
    expect(ids).toContain("fallingObjects");
  });

  it("detects LOTO and electrical for pump service with stored energy", () => {
    const ids = idsFor("service a pump with electrical and stored energy");

    expect(ids).toContain("loto");
    expect(ids).toContain("electrical");
  });

  it("detects concrete, weather, and heat stress for hot weather concrete work", () => {
    const ids = idsFor("pouring concrete in hot weather");

    expect(ids).toContain("concrete");
    expect(ids).toContain("weather");
    expect(ids).toContain("heatStress");
  });

  it("asks for clarification when confidence is low", () => {
    const result = detectGusWorkTypes("work later");

    expect(result.lowConfidence).toBe(true);
    expect(result.matches).toEqual([]);
    expect(result.clarificationQuestion).toBe(
      "I can help plan this. What type of work is the crew performing?",
    );
  });

  it("returns confidence scores for matched modules and signals", () => {
    const result = detectGusWorkTypes("hot work welding with fire watch");

    expect(result.confidence).toBeGreaterThan(0);
    expect(result.matches[0]?.confidence).toBeGreaterThan(0);
    expect(result.matches.every((match) => match.confidence >= 0 && match.confidence <= 1)).toBe(true);
  });
});

