import { describe, expect, it } from "vitest";
import {
  computeTrainingMatrixRow,
  keywordMatchesHaystack,
  normalizeForMatch,
} from "./trainingMatrix";

describe("normalizeForMatch", () => {
  it("trims and lowercases", () => {
    expect(normalizeForMatch("  OSHA 30  ")).toBe("osha 30");
  });
});

describe("keywordMatchesHaystack", () => {
  it("matches substring keyword in haystack", () => {
    expect(keywordMatchesHaystack("osha", "osha 30 hour")).toBe(true);
  });
  it("matches when haystack is substring of keyword", () => {
    expect(keywordMatchesHaystack("osha 30 hour certification", "osha 30")).toBe(true);
  });
  it("rejects empty", () => {
    expect(keywordMatchesHaystack("", "x")).toBe(false);
    expect(keywordMatchesHaystack("x", "")).toBe(false);
  });
});

describe("computeTrainingMatrixRow", () => {
  it("marks requirement satisfied when cert contains keyword", () => {
    const { cells, unmatchedCertifications } = computeTrainingMatrixRow(
      { certifications: ["OSHA 30 Hour", "First Aid"] },
      [{ id: "r1", match_keywords: ["osha 30"] }]
    );
    expect(cells.r1).toBe(true);
    expect(unmatchedCertifications).toEqual(["First Aid"]);
  });

  it("treats cert as matched for multiple requirements without duplicating unmatched", () => {
    const { cells, unmatchedCertifications } = computeTrainingMatrixRow(
      { certifications: ["OSHA 30"] },
      [
        { id: "a", match_keywords: ["osha"] },
        { id: "b", match_keywords: ["30"] },
      ]
    );
    expect(cells.a).toBe(true);
    expect(cells.b).toBe(true);
    expect(unmatchedCertifications).toEqual([]);
  });

  it("matches job_title when match_fields includes job_title", () => {
    const { cells, unmatchedCertifications } = computeTrainingMatrixRow(
      {
        certifications: ["CPR"],
        job_title: "Site Safety Supervisor",
      },
      [
        {
          id: "safety",
          match_keywords: ["supervisor"],
          match_fields: ["job_title"],
        },
      ]
    );
    expect(cells.safety).toBe(true);
    expect(unmatchedCertifications).toEqual(["CPR"]);
  });

  it("returns false when nothing matches", () => {
    const { cells, unmatchedCertifications } = computeTrainingMatrixRow(
      { certifications: ["Forklift"] },
      [{ id: "r1", match_keywords: ["crane"] }]
    );
    expect(cells.r1).toBe(false);
    expect(unmatchedCertifications).toEqual(["Forklift"]);
  });
});
