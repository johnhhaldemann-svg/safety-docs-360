import { describe, expect, it } from "vitest";
import { buildCsepTradeSelection } from "@/lib/csepTradeSelection";
import {
  deriveEligibleCsepPricedItems,
  resolveSelectedCsepPricedItems,
} from "@/lib/csepEnrichmentPricing";

describe("csepEnrichmentPricing", () => {
  it("derives permit-priced items from trade-driven permit selections", () => {
    const selection = buildCsepTradeSelection(
      "Electrical",
      "Power distribution / feeders / branch power",
      ["Conduit install", "Megger testing"]
    );

    const pricedItems = deriveEligibleCsepPricedItems({
      trade: selection?.tradeLabel,
      subTrade: selection?.subTradeLabel,
      tasks: ["Conduit install", "Megger testing"],
      derivedHazards: selection?.derivedHazards,
      selectedPermits: selection?.derivedPermits,
    });

    expect(pricedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "loto_permit",
          label: "LOTO Permit",
          category: "permit",
        }),
      ])
    );
  });

  it("adds a fall protection rescue plan as a priced add-on for fall exposure", () => {
    const pricedItems = deriveEligibleCsepPricedItems({
      trade: "Roofing",
      tasks: ["Roof access setup"],
      selectedHazards: ["Falls from height"],
      selectedPermits: ["Ladder Permit"],
    });

    expect(pricedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "fall_protection_rescue_plan",
          label: "Fall Protection Rescue Plan",
          category: "add_on",
          price: 450,
        }),
      ])
    );
  });

  it("dedupes repeated triggers when resolving selected priced items", () => {
    const pricedItems = deriveEligibleCsepPricedItems({
      trade: "Electrical",
      tasks: ["Conduit install", "Megger testing", "Roof access setup"],
      selectedHazards: ["Falls from height", "Falls from height"],
      derivedHazards: ["Falls from height"],
      selectedPermits: ["LOTO Permit", "LOTO Permit", "Ladder Permit"],
    });

    const resolvedItems = resolveSelectedCsepPricedItems({
      selectedKeys: ["loto_permit", "loto_permit", "fall_protection_rescue_plan"],
      eligibleItems: pricedItems,
    });

    expect(resolvedItems).toEqual([
      expect.objectContaining({ key: "loto_permit" }),
      expect.objectContaining({ key: "fall_protection_rescue_plan" }),
    ]);
  });

  it("returns no priced items when the current selection has no matching triggers", () => {
    const pricedItems = deriveEligibleCsepPricedItems({
      trade: "Final Cleaning / Turnover",
      tasks: ["Final touch-up cleaning"],
      selectedHazards: ["Slip / trip"],
      selectedPermits: [],
    });

    expect(pricedItems).toEqual([]);
  });
});
