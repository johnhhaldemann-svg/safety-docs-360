import { describe, expect, it } from "vitest";
import {
  effectiveTradeWeatherWeightFromByTradeWithBls,
  resolveBlsYearForState,
  type BlsConstructionRatesDataset,
} from "@/lib/injuryWeather/blsStateConstructionRates";
import { effectiveTradeWeatherWeightFromByTrade } from "@/lib/injuryWeather/locationWeather";
import { INJURY_WEATHER_MODEL } from "@/lib/injuryWeather/riskModel";

const fixtureDataset: BlsConstructionRatesDataset = {
  meta: {
    source: "test",
    sourceWorkbook: "test.xlsx",
    sheet: "Construction_Quick_View",
    generatedAt: "",
    coveredStates: ["AA", "BB"],
    rowCount: 4,
  },
  rows: [
    {
      y: 2024,
      sc: "AA",
      ind: "Electrical contractors and other wiring installation contractors",
      naics: "23821",
      trc: 2.0,
    },
    {
      y: 2024,
      sc: "BB",
      ind: "Electrical contractors and other wiring installation contractors",
      naics: "23821",
      trc: 1.0,
    },
    {
      y: 2024,
      sc: "AA",
      ind: "Construction",
      naics: "23",
      trc: 1.5,
    },
    {
      y: 2024,
      sc: "BB",
      ind: "Construction",
      naics: "23",
      trc: 1.5,
    },
  ],
};

describe("resolveBlsYearForState", () => {
  it("returns forecast year when present for state", () => {
    expect(resolveBlsYearForState("April 2024", "AA", fixtureDataset.rows)).toBe(2024);
  });

  it("falls back to latest year in dataset for state", () => {
    const rows = [
      ...fixtureDataset.rows,
      { y: 2023, sc: "AA", ind: "Construction", naics: "23", trc: 1.0 },
    ];
    expect(resolveBlsYearForState("April 2025", "AA", rows)).toBe(2024);
  });
});

describe("effectiveTradeWeatherWeightFromByTradeWithBls", () => {
  it("matches heuristic path when state not in dataset", () => {
    const byTrade = new Map<string, Map<string, number>>([
      ["Electrical", new Map([["x", 5]])],
    ]);
    const out = effectiveTradeWeatherWeightFromByTradeWithBls("CA", byTrade, "April 2024", fixtureDataset);
    expect(out.blsTradeRateNote).toBeUndefined();
    expect(out.weight).toBe(effectiveTradeWeatherWeightFromByTrade(byTrade));
  });

  it("returns disclosure and blended weight when state is covered", () => {
    const byTrade = new Map<string, Map<string, number>>([
      ["Electrical", new Map([["SOR", 10]])],
    ]);
    const out = effectiveTradeWeatherWeightFromByTradeWithBls("AA", byTrade, "April 2024", fixtureDataset);
    expect(out.blsTradeRateNote).toContain("AA, BB");
    expect(out.weight).toBeGreaterThanOrEqual(INJURY_WEATHER_MODEL.BASELINE_TRADE_WEIGHT_MIN);
    expect(out.weight).toBeLessThanOrEqual(INJURY_WEATHER_MODEL.BASELINE_TRADE_WEIGHT_MAX);
  });

  it("clamps weight to model band for extreme TRC ratios", () => {
    const highTrc: BlsConstructionRatesDataset = {
      ...fixtureDataset,
      rows: [
        { y: 2024, sc: "AA", ind: "Electrical contractors and other wiring installation contractors", trc: 50 },
        { y: 2024, sc: "BB", ind: "Electrical contractors and other wiring installation contractors", trc: 0.1 },
        { y: 2024, sc: "AA", ind: "Construction", naics: "23", trc: 1 },
        { y: 2024, sc: "BB", ind: "Construction", naics: "23", trc: 1 },
      ],
    };
    const byTrade = new Map<string, Map<string, number>>([
      ["Electrical", new Map([["x", 1]])],
    ]);
    const out = effectiveTradeWeatherWeightFromByTradeWithBls("AA", byTrade, "April 2024", highTrc);
    expect(out.weight).toBeLessThanOrEqual(INJURY_WEATHER_MODEL.BASELINE_TRADE_WEIGHT_MAX);
  });
});
