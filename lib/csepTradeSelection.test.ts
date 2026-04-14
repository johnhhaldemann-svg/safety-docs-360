import { describe, expect, it } from "vitest";
import {
  buildCsepTradeSelection,
  getCsepSubTradeOptions,
  getCsepTaskOptions,
  getCsepTradeOptions,
} from "./csepTradeSelection";

describe("csepTradeSelection", () => {
  it("returns the canonical trade list", () => {
    expect(getCsepTradeOptions()).toContain("Electrical");
    expect(getCsepTradeOptions()).toContain("Final Cleaning / Turnover");
  });

  it("filters sub-trades and tasks within the selected trade hierarchy", () => {
    const electricalSubTrades = getCsepSubTradeOptions("Electrical");
    expect(electricalSubTrades).toContain(
      "Power distribution / feeders / branch power"
    );
    expect(electricalSubTrades).not.toContain(
      "Domestic water / sanitary / vent / storm"
    );

    const electricalTasks = getCsepTaskOptions(
      "Electrical",
      "Power distribution / feeders / branch power"
    );
    expect(electricalTasks.selectable).toContain("Conduit install");
    expect(electricalTasks.selectable).not.toContain("Pipe install");
  });

  it("derives hazards, permits, and matrix rows from selected tasks", () => {
    const selection = buildCsepTradeSelection(
      "Electrical",
      "Power distribution / feeders / branch power",
      ["Conduit install", "Megger testing"]
    );

    expect(selection).not.toBeNull();
    expect(selection?.tradeCode).toBe("electrical");
    expect(selection?.subTradeCode).toBe(
      "power_distribution_feeders_branch_power"
    );
    expect(selection?.items.map((item) => item.activity)).toEqual([
      "Conduit install",
      "Megger testing",
    ]);
    expect(selection?.derivedHazards).toEqual(["Electrical shock"]);
    expect(selection?.derivedPermits).toEqual(["LOTO Permit"]);
  });

  it("does not auto-add trench permit language for heavy equipment tasks without excavation scope", () => {
    const selection = buildCsepTradeSelection(
      "Equipment / Heavy Civil Operations",
      "Excavator / dozer / loader / skid steer / roller",
      ["Grading", "Hauling", "Material movement"]
    );

    expect(selection).not.toBeNull();
    expect(selection?.derivedHazards).toEqual(["Struck by equipment"]);
    expect(selection?.derivedPermits).toEqual(["Motion Permit"]);
    expect(selection?.summary).toContain("equipment movement and haul-route exposure");
    expect(selection?.summary).not.toContain("Underground utility coordination is required");
    expect(selection?.oshaRefs).not.toContain("OSHA 1926 Subpart P – Excavations");
  });

  it("adds excavation references only when trenching or utility work is selected", () => {
    const selection = buildCsepTradeSelection(
      "Equipment / Heavy Civil Operations",
      "Excavator / dozer / loader / skid steer / roller",
      ["Excavating", "Trench support placement"]
    );

    expect(selection).not.toBeNull();
    expect(selection?.derivedHazards).toContain("Excavation collapse");
    expect(selection?.derivedPermits).toContain("Ground Disturbance Permit");
    expect(selection?.derivedPermits).toContain("Trench Inspection Permit");
    expect(selection?.summary).toContain("Excavation controls should stay tied");
    expect(selection?.oshaRefs).toContain("OSHA 1926 Subpart P – Excavations");
  });

  it("derives ground disturbance permit for earth disturbance without trench-entry scope", () => {
    const selection = buildCsepTradeSelection(
      "Equipment / Heavy Civil Operations",
      "Excavator / dozer / loader / skid steer / roller",
      ["Excavating", "Backfill"]
    );

    expect(selection).not.toBeNull();
    expect(selection?.derivedHazards).toContain("Excavation collapse");
    expect(selection?.derivedPermits).toContain("Ground Disturbance Permit");
    expect(selection?.derivedPermits).not.toContain("Trench Inspection Permit");
  });

  it("infers overlapping trades and permit hints for high-risk shared-area scopes", () => {
    const selection = buildCsepTradeSelection(
      "Welding / Hot Work",
      "Structural / pipe / stainless welding / brazing / cutting",
      ["Welding", "Grinding"]
    );

    expect(selection).not.toBeNull();
    expect(selection?.commonOverlappingTrades).toContain("Painting / Coatings");
    expect(selection?.overlapPermitHints).toContain("Hot Work Permit");
  });
});
