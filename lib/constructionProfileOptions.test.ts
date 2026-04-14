import { describe, expect, it } from "vitest";
import {
  CONSTRUCTION_TRADES,
  filterAllowedTrades,
  isAllowedConstructionTrade,
} from "./constructionProfileOptions";

describe("constructionProfileOptions", () => {
  it("exposes the canonical trade labels for profile consumers", () => {
    expect(CONSTRUCTION_TRADES).toContain("Electrical");
    expect(CONSTRUCTION_TRADES).toContain("General Conditions / Site Management");
  });

  it("accepts canonical and legacy labels when filtering", () => {
    expect(isAllowedConstructionTrade("Electrical")).toBe(true);
    expect(
      filterAllowedTrades(["Electrical", "Mechanical / HVAC", "not-a-trade"])
    ).toEqual(["Electrical", "Mechanical / HVAC"]);
  });
});
