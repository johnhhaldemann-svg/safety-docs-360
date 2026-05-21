import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * Contract: Injury Weather "Predicted likely injury" must use the same prediction-source
 * row bag as the main dashboard (company rows, aggregate rows, or OSHA baseline after
 * source resolution), not full-history allRows; otherwise the headline can disagree with
 * trade cards when month fallback or source fallback is active.
 */
describe("injuryWeather likely-injury scope (source contract)", () => {
  it("getInjuryWeatherDashboardData feeds likelyInjury from predictionRows via rowsMatchingTradeSelection", () => {
    const servicePath = path.join(__dirname, "service.ts");
    const src = readFileSync(servicePath, "utf8");
    expect(src).toContain("filterForecastEligibleRows(rowsMatchingTradeSelection(predictionRows");
    expect(src).toContain("likelyInjuryInsightFromSignals(likelyRowsForInsight)");
    expect(src).not.toMatch(
      /likelyInjuryInsightFromSignals\(\s*rowsMatchingTradeSelection\(\s*allRows/
    );
  });
});
