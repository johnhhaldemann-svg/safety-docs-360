import { describe, expect, it } from "vitest";
import {
  getTaskLabel,
  getTaskOptionsForTradeAndSubTrade,
  normalizeSubTradeCode,
  normalizeTaskCode,
  normalizeTradeCode,
} from "./taxonomy";

describe("riskMemory taxonomy", () => {
  it("normalizes shared trade codes from current and legacy labels", () => {
    expect(normalizeTradeCode("Electrical")).toBe("electrical");
    expect(normalizeTradeCode("Mechanical / HVAC")).toBe("hvac_mechanical");
  });

  it("normalizes sub-trades and tasks only within the selected hierarchy", () => {
    const subTradeCode = normalizeSubTradeCode(
      "electrical",
      "Power distribution / feeders / branch power"
    );

    expect(subTradeCode).toBe("power_distribution_feeders_branch_power");
    expect(
      normalizeTaskCode("electrical", subTradeCode, "Conduit install")
    ).toBe("conduit_install");
    expect(
      getTaskLabel("electrical", subTradeCode, "conduit_install")
    ).toBe("Conduit install");
  });

  it("rejects cross-trade and cross-sub-trade mismatches", () => {
    expect(
      normalizeSubTradeCode(
        "plumbing",
        "Power distribution / feeders / branch power"
      )
    ).toBeNull();
    expect(
      normalizeTaskCode(
        "electrical",
        "lighting_grounding_temporary_power_substations",
        "Conduit install"
      )
    ).toBeNull();
  });

  it("returns selectable task options for a valid trade and sub-trade", () => {
    const tasks = getTaskOptionsForTradeAndSubTrade(
      "electrical",
      "power_distribution_feeders_branch_power"
    );

    expect(tasks.map((task) => task.label)).toContain("Conduit install");
    expect(tasks.map((task) => task.label)).not.toContain("Pipe install");
  });
});
