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
    expect(recencyWeight(10)).toBe(1.5);
    expect(recencyWeight(60)).toBe(1.2);
    expect(recencyWeight(120)).toBe(1.0);
    expect(recencyWeight(200)).toBe(0.8);
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
});
