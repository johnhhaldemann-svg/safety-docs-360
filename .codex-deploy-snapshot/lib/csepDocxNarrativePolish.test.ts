import { describe, expect, it } from "vitest";
import { polishCsepDocxNarrativeText, splitCsepDocxBodyIntoSegments } from "@/lib/csepDocxNarrativePolish";

describe("csepDocxNarrativePolish", () => {
  it("fixes common misspellings without changing surrounding words", () => {
    expect(polishCsepDocxNarrativeText("Discplianry action may follow.")).toBe(
      "Disciplinary action may follow."
    );
  });

  it("adds a terminal period when the paragraph ends with a letter", () => {
    expect(polishCsepDocxNarrativeText("Maintain the exclusion zone")).toBe(
      "Maintain the exclusion zone."
    );
  });

  it("does not add a second period when one is already present", () => {
    expect(polishCsepDocxNarrativeText("Maintain the exclusion zone.")).toBe(
      "Maintain the exclusion zone."
    );
  });

  it("rewrites awkward checklist-style openings for critical components", () => {
    expect(polishCsepDocxNarrativeText("Are critical components inspected before use")).toBe(
      "Critical components inspected before use."
    );
  });

  it("leaves compact TOC-style numbered lines without a forced period", () => {
    expect(polishCsepDocxNarrativeText("13. HazCom")).toBe("13. HazCom");
  });

  it("collapses triple line breaks and excessive spaces in body segments", () => {
    const segments = splitCsepDocxBodyIntoSegments("First block.\n\n\n\nSecond block.");
    expect(segments).toEqual(["First block.", "Second block."]);
  });

  it("splits very long semicolon-separated clauses into separate polished segments", () => {
    const clause =
      "Verify access controls at the site gate and confirm that delivery drivers remain in their vehicles unless the site superintendent authorizes an exception";
    const body = `${clause}; ${clause}; ${clause}`;
    const segments = splitCsepDocxBodyIntoSegments(body);
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(segments.every((s) => s.endsWith("."))).toBe(true);
  });

  it("honors skipTerminalPunctuation for definition terms", () => {
    expect(polishCsepDocxNarrativeText("Discplianry Policy", { skipTerminalPunctuation: true })).toBe(
      "Disciplinary Policy"
    );
  });
});
