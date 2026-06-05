import { describe, expect, it } from "vitest";
import {
  isPredictionGatedTable,
  passesPredictionGate,
  predictionConfidenceDelta,
} from "@/lib/aiKnowledgeMap/predictionGate";

describe("AI Knowledge Map prediction gate", () => {
  it("flags only the Prediction-Validation-reviewed tables as gated", () => {
    expect(isPredictionGatedTable("company_incidents")).toBe(true);
    expect(isPredictionGatedTable("company_sor_records")).toBe(true);
    expect(isPredictionGatedTable("company_corrective_actions")).toBe(true);
    expect(isPredictionGatedTable("company_permits")).toBe(false);
    expect(isPredictionGatedTable("documents")).toBe(false);
  });

  it("lets non-gated tables through regardless of prediction status", () => {
    expect(passesPredictionGate("company_permits", {})).toBe(true);
    expect(passesPredictionGate("documents", { prediction_validation_status: "rejected" })).toBe(true);
  });

  it("admits gated rows only when prediction validation is approved", () => {
    expect(passesPredictionGate("company_incidents", { prediction_validation_status: "approved" })).toBe(true);
    expect(passesPredictionGate("company_incidents", { prediction_validation_status: "pending" })).toBe(false);
    expect(passesPredictionGate("company_incidents", { prediction_validation_status: "rejected" })).toBe(false);
    // Missing/unknown status is treated as pending → not admitted.
    expect(passesPredictionGate("company_sor_records", {})).toBe(false);
  });

  it("translates the 1–5 quality rating into a confidence delta", () => {
    expect(predictionConfidenceDelta({ prediction_review_rating: 5 })).toBeCloseTo(0.15);
    expect(predictionConfidenceDelta({ prediction_review_rating: 4 })).toBeCloseTo(0.075);
    expect(predictionConfidenceDelta({ prediction_review_rating: 3 })).toBe(0);
    expect(predictionConfidenceDelta({ prediction_review_rating: 1 })).toBeCloseTo(-0.15);
    // No rating, or out-of-range, contributes nothing.
    expect(predictionConfidenceDelta({})).toBe(0);
    expect(predictionConfidenceDelta({ prediction_review_rating: 9 })).toBe(0);
  });
});
