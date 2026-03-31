import { describe, expect, it } from "vitest";
import {
  meaningfulTemplateCategory,
  sanitizeEnvironmentalRow,
  shouldIncludeEnvironmentalRow,
} from "./auditRows";

describe("jobsite environmental audit rows", () => {
  it("detects meaningful category text after N/A padding", () => {
    expect(meaningfulTemplateCategory("Air Emissions                                                       N/A  ")).toBe(
      true
    );
    expect(meaningfulTemplateCategory("                                                                                      N/A")).toBe(
      false
    );
    expect(meaningfulTemplateCategory(undefined)).toBe(false);
  });

  it("includes rows with at least one real program column", () => {
    expect(
      shouldIncludeEnvironmentalRow({
        "Category/Requirement": "NESHAP                                                                  N/A",
        "Category/Requirement_1": "Store Haz Matial or Haz Waste          N/A",
      })
    ).toBe(true);
    expect(
      shouldIncludeEnvironmentalRow({
        "Permit Type/Condition": "Type of Feed Gases",
        Comments_2: "Daily Records",
      })
    ).toBe(false);
  });

  it("strips example permit numbers and tagged equipment conditions", () => {
    const row = sanitizeEnvironmentalRow({
      "Category/Requirement": "Air Emissions  N/A",
      "Permit Type/Condition": "Furnace #44",
      "Permit #": "G71192",
      "Permit Type/Condition_1": "Thermal Oxidizer",
      "Permit #_1": "F58509",
      Comments_3: "THM-1, S/N 0438",
    });
    expect(row["Permit #"]).toBeUndefined();
    expect(row["Permit #_1"]).toBeUndefined();
    expect(row["Permit Type/Condition"]).toBeUndefined();
    expect(row["Permit Type/Condition_1"]).toBe("Thermal Oxidizer");
    expect(row.Comments_3).toBeUndefined();
  });
});
