import { describe, expect, it } from "vitest";
import {
  CONSTRUCTION_TRADE_LABELS,
  SHARED_TRADE_DEFINITIONS,
  getSharedSubTradeDefinition,
  getSharedTradeDefinitionByCode,
  resolveSharedSubTradeCode,
  resolveSharedTaskCode,
  resolveSharedTradeCode,
} from "./sharedTradeTaxonomy";

describe("sharedTradeTaxonomy", () => {
  it("exposes the 35 canonical top-level trade groups with stable metadata", () => {
    expect(SHARED_TRADE_DEFINITIONS).toHaveLength(35);
    expect(CONSTRUCTION_TRADE_LABELS).toHaveLength(35);

    const codes = new Set<string>();
    const labels = new Set<string>();
    for (const trade of SHARED_TRADE_DEFINITIONS) {
      expect(trade.code).toBeTruthy();
      expect(trade.slug).toBe(trade.code);
      expect(trade.label).toBeTruthy();
      expect(trade.subTrades.length).toBeGreaterThan(0);
      expect(codes.has(trade.code)).toBe(false);
      expect(labels.has(trade.label)).toBe(false);
      codes.add(trade.code);
      labels.add(trade.label);
    }
  });

  it("resolves sub-trades only under their parent trade", () => {
    const electrical = getSharedTradeDefinitionByCode("electrical");
    expect(electrical?.label).toBe("Electrical");

    const powerDistributionCode = resolveSharedSubTradeCode(
      "electrical",
      "Power distribution / feeders / branch power"
    );

    expect(powerDistributionCode).toBe(
      "power_distribution_feeders_branch_power"
    );
    expect(
      getSharedSubTradeDefinition("electrical", powerDistributionCode)?.label
    ).toBe("Power distribution / feeders / branch power");
    expect(
      getSharedSubTradeDefinition("electrical", powerDistributionCode)?.description
    ).toContain("Power distribution / feeders / branch power work typically includes");
    expect(
      resolveSharedSubTradeCode(
        "plumbing",
        "Power distribution / feeders / branch power"
      )
    ).toBeNull();
  });

  it("resolves selectable tasks only under the correct sub-trade", () => {
    const taskCode = resolveSharedTaskCode(
      "electrical",
      "power_distribution_feeders_branch_power",
      "Conduit install"
    );

    expect(taskCode).toBe("conduit_install");
    expect(
      resolveSharedTaskCode(
        "electrical",
        "lighting_grounding_temporary_power_substations",
        "Conduit install"
      )
    ).toBeNull();
  });

  it("preserves legacy trade labels for compatibility lookups", () => {
    expect(resolveSharedTradeCode("General / Multi-trade")).toBe(
      "general_conditions_site_management"
    );
    expect(resolveSharedTradeCode("Mechanical / HVAC")).toBe(
      "hvac_mechanical"
    );
    expect(resolveSharedTradeCode("Fire Protection / Sprinklers")).toBe(
      "fire_protection"
    );
  });
});
