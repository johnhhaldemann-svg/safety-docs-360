import { describe, expect, it } from "vitest";
import { buildSteelErectionPlan } from "@/lib/steelErectionPlan";

describe("steelErectionPlan", () => {
  it("uses a final-export-safe fallback for emergency access instructions when the project address is blank", () => {
    const plan = buildSteelErectionPlan({
      generationContext: {
        project: {
          projectAddress: "",
        },
        legacyFormData: {},
        siteContext: {
          metadata: {},
        },
        scope: {
          trades: ["Structural Steel"],
          subTrades: ["Metals"],
          tasks: ["Column erection"],
        },
      } as any,
      operations: [
        {
          tradeLabel: "Structural Steel",
          subTradeLabel: "Metals",
          taskTitle: "Column erection",
        },
      ] as any,
      ruleSummary: {
        selectedHazards: [],
        hazardCategories: [],
        permitTriggers: [],
        ppeRequirements: [],
        requiredControls: [],
      } as any,
    });

    expect(plan?.fallRescue?.siteAccessInstructions).toBe(
      "Emergency access route: Coordinate responders through the designated project gate and active work area."
    );
    expect(plan?.fallRescue?.siteAccessInstructions).not.toContain("TBD by contractor before issue");
  });
});
