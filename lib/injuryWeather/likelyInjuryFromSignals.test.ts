import { describe, expect, it } from "vitest";
import { likelyInjuryInsightFromSignals } from "@/lib/injuryWeather/likelyInjuryFromSignals";
import type { NormalizedLiveSignalRow } from "@/lib/injuryWeather/types";

function base(overrides: Partial<NormalizedLiveSignalRow>): NormalizedLiveSignalRow {
  return {
    tradeId: "gc",
    tradeLabel: "General Contractor",
    categoryId: null,
    categoryLabel: "General Observation",
    severity: "medium",
    created_at: "2026-04-01T12:00:00.000Z",
    source: "sor",
    ...overrides,
  };
}

describe("likelyInjuryInsightFromSignals", () => {
  it("returns no data for empty rows", () => {
    const out = likelyInjuryInsightFromSignals([]);
    expect(out.hasData).toBe(false);
    expect(out.headline).toBe("Not enough data");
  });

  it("uses SOR hazard class when no incidents", () => {
    const rows: NormalizedLiveSignalRow[] = [
      base({
        source: "sor",
        categoryLabel: "Slip on debris",
        sorHazardCategoryCode: "falls_same_level",
      }),
    ];
    const out = likelyInjuryInsightFromSignals(rows);
    expect(out.hasData).toBe(true);
    expect(out.headline.length).toBeGreaterThan(0);
    expect(out.detailNote).toMatch(/SOR\/CAPA/);
  });

  it("weights typed incidents with SOR signals", () => {
    const rows: NormalizedLiveSignalRow[] = [
      base({
        source: "incident",
        categoryLabel: "Incident",
        injuryType: "laceration",
        severity: "high",
      }),
      base({
        source: "sor",
        categoryLabel: "Electrical hazard",
        sorHazardCategoryCode: "electrical",
        severity: "high",
      }),
    ];
    const out = likelyInjuryInsightFromSignals(rows);
    expect(out.hasData).toBe(true);
    expect(out.detailNote).toMatch(/typed incident/);
  });
});
