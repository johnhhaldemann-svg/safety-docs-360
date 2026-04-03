import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * Contract: superadmin Injury Weather "Predicted likely injury" must use the same scoped
 * row bag as the main dashboard (liveSourceRows after month fallback logic), not full-history
 * allRows — otherwise the headline disagrees with trade cards when a month is selected.
 */
describe("injuryWeather likely-injury scope (source contract)", () => {
  it("getInjuryWeatherDashboardData feeds likelyInjury from liveSourceRows via rowsMatchingTradeSelection", () => {
    const servicePath = path.join(__dirname, "service.ts");
    const src = readFileSync(servicePath, "utf8");
    expect(src).toContain("const likelyRowsForInsight = rowsMatchingTradeSelection(liveSourceRows");
    expect(src).toContain("likelyInjuryInsightFromSignals(likelyRowsForInsight)");
    expect(src).not.toMatch(
      /likelyInjuryInsightFromSignals\(\s*rowsMatchingTradeSelection\(\s*allRows/
    );
  });
});
