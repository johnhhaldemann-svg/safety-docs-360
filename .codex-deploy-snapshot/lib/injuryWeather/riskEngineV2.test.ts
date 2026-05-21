import { describe, expect, it } from "vitest";
import {
  bandLabelToRiskLevel,
  recencyWeight,
  seasonalityWeight,
  scoreRowsForForecast,
} from "./riskEngineV2";
import type { NormalizedLiveSignalRow } from "./types";

describe("recencyWeight", () => {
  it("matches bucket thresholds", () => {
    expect(recencyWeight(3)).toBe(1.75);
    expect(recencyWeight(10)).toBe(1.45);
    expect(recencyWeight(60)).toBe(1.1);
    expect(recencyWeight(200)).toBe(0.65);
    expect(recencyWeight(400)).toBe(0.25);
  });
});

describe("seasonalityWeight", () => {
  it("weights same calendar month highest", () => {
    const forecast = new Date(2026, 3, 1);
    expect(seasonalityWeight(new Date(2025, 3, 15), forecast)).toBe(1.4);
    expect(seasonalityWeight(new Date(2025, 4, 1), forecast)).toBe(1.15);
    expect(seasonalityWeight(new Date(2025, 0, 1), forecast)).toBe(0.9);
  });
});

describe("scoreRowsForForecast", () => {
  const base = (overrides: Partial<NormalizedLiveSignalRow>): NormalizedLiveSignalRow => ({
    tradeId: "roofing",
    tradeLabel: "Roofing",
    categoryId: "fall",
    categoryLabel: "Fall",
    severity: "high",
    created_at: "2026-04-10T12:00:00.000Z",
    source: "sor",
    ...overrides,
  });

  it("produces higher mass for incidents than SOR at same severity", () => {
    const forecast = new Date(2026, 3, 1);
    const asOf = new Date("2026-04-15T12:00:00.000Z");
    const sor = scoreRowsForForecast([base({ source: "sor" })], forecast, asOf);
    const inc = scoreRowsForForecast([base({ source: "incident" })], forecast, asOf);
    expect(inc.explainability.weightedTotals.rowRiskScoreSum).toBeGreaterThan(
      sor.explainability.weightedTotals.rowRiskScoreSum
    );
  });

  it("maps final score into bands and risk levels", () => {
    const forecast = new Date(2026, 3, 1);
    const asOf = new Date("2026-04-15T12:00:00.000Z");
    const rows: NormalizedLiveSignalRow[] = [];
    const { explainability } = scoreRowsForForecast(rows, forecast, asOf);
    expect(explainability.bandLabel).toBe("Low");
    expect(bandLabelToRiskLevel(explainability.bandLabel)).toBe("LOW");
    expect(explainability.sourceRiskScoreShare.sor).toBe(0);
  });

  it("reduces medium-trust rows and excludes blocked rows", () => {
    const forecast = new Date(2026, 3, 1);
    const asOf = new Date("2026-04-15T12:00:00.000Z");
    const verified = scoreRowsForForecast(
      [
        base({
          forecastIntegrity: {
            bucket: "safety_observation",
            trustLevel: "verified",
            trustWeight: 1,
            eligibleForForecast: true,
            confidenceScore: 100,
            validationStatus: "approved",
            reviewRating: 5,
            missingRequiredFields: [],
            exclusionReasons: [],
            warnings: [],
            duplicateKey: "verified",
          },
        }),
      ],
      forecast,
      asOf
    );
    const mixed = scoreRowsForForecast(
      [
        base({
          forecastIntegrity: {
            bucket: "safety_observation",
            trustLevel: "medium_confidence",
            trustWeight: 0.65,
            eligibleForForecast: true,
            confidenceScore: 65,
            validationStatus: "approved",
            reviewRating: 3,
            missingRequiredFields: [],
            exclusionReasons: [],
            warnings: [],
            duplicateKey: "medium",
          },
        }),
        base({
          sourceId: "blocked",
          forecastIntegrity: {
            bucket: "safety_observation",
            trustLevel: "blocked",
            trustWeight: 0,
            eligibleForForecast: false,
            confidenceScore: 0,
            validationStatus: "rejected",
            reviewRating: 1,
            missingRequiredFields: [],
            exclusionReasons: ["review_rejected"],
            warnings: [],
            duplicateKey: "blocked",
          },
        }),
      ],
      forecast,
      asOf
    );

    expect(mixed.scored).toHaveLength(1);
    expect(mixed.explainability.excludedRowCount).toBe(1);
    expect(mixed.scored[0]?.rowRiskScore).toBeLessThan(verified.scored[0]?.rowRiskScore ?? 0);
    expect(mixed.explainability.meanTrustWeight).toBe(0.65);
    expect(mixed.explainability.trustMix.medium_confidence).toBe(1);
    expect(mixed.explainability.trustMix.blocked).toBe(1);
  });
});
