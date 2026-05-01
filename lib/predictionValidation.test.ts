import { describe, expect, it } from "vitest";
import {
  isIncidentInjurySubtype,
  normalizePredictionReviewRating,
  normalizePredictionReviewTags,
  normalizePredictionValidationStatus,
} from "./predictionValidation";

describe("predictionValidation", () => {
  it("normalizes review status and ratings", () => {
    expect(normalizePredictionValidationStatus("APPROVED")).toBe("approved");
    expect(normalizePredictionValidationStatus("unknown")).toBe("pending");
    expect(normalizePredictionReviewRating(5)).toBe(5);
    expect(normalizePredictionReviewRating("3")).toBe(3);
    expect(normalizePredictionReviewRating("6")).toBeNull();
    expect(normalizePredictionReviewRating("bad")).toBeNull();
  });

  it("normalizes review tags into compact tokens", () => {
    expect(normalizePredictionReviewTags(["Needs Cleanup", "bad data!", "Needs Cleanup"])).toEqual([
      "needs_cleanup",
      "bad_data",
    ]);
  });

  it("identifies injuries as incident subtypes", () => {
    expect(isIncidentInjurySubtype({ category: "incident" })).toBe(true);
    expect(isIncidentInjurySubtype({ injury_type: "sprain" })).toBe(true);
    expect(isIncidentInjurySubtype({ days_away_from_work: 1 })).toBe(true);
    expect(isIncidentInjurySubtype({ category: "near_miss" })).toBe(false);
  });
});
