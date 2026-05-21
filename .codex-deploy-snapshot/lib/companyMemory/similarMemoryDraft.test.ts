import { describe, expect, it } from "vitest";
import {
  jaccardTokenSets,
  memoryContentTokenSet,
  SIMILAR_MEMORY_JACCARD_MIN,
  SIMILAR_MEMORY_SHOW_THRESHOLD,
  titlesAreMutuallyContained,
} from "@/lib/companyMemory/similarMemoryDraft";

describe("similarMemoryDraft", () => {
  it("computes Jaccard on token sets", () => {
    const a = new Set(["glove", "lilly", "sites"]);
    const b = new Set(["glove", "lilly", "construction"]);
    expect(jaccardTokenSets(a, b)).toBeCloseTo(2 / 4, 5);
  });

  it("builds content token sets without stopwords", () => {
    const s = memoryContentTokenSet("What PPE is required for Lilly Sites");
    expect(s.has("ppe")).toBe(true);
    expect(s.has("lilly")).toBe(true);
    expect(s.has("what")).toBe(false);
  });

  it("detects mutual title containment when long enough", () => {
    expect(titlesAreMutuallyContained("Glove requirements", "Glove requirements for Lilly")).toBe(true);
    expect(titlesAreMutuallyContained("Hi", "Hello there")).toBe(false);
  });

  it("keeps threshold ordering consistent", () => {
    expect(SIMILAR_MEMORY_JACCARD_MIN).toBeLessThan(1);
    expect(SIMILAR_MEMORY_SHOW_THRESHOLD).toBeGreaterThan(0.7);
    expect(SIMILAR_MEMORY_SHOW_THRESHOLD).toBeLessThan(1);
  });
});
