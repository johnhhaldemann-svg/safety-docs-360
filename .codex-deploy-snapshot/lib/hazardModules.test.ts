import { describe, expect, it } from "vitest";
import {
  buildHazardModuleAiContext,
  getHazardModules,
  getHazardModulesForCsepSelection,
} from "@/lib/hazardModules";

describe("hazardModules", () => {
  it("loads all generated hazard module records with extracted text and headings", () => {
    const modules = getHazardModules();

    expect(modules).toHaveLength(24);
    expect(modules.every((module) => module.plainText.length > 200)).toBe(true);
    expect(modules.every((module) => module.summary.length > 20)).toBe(true);
    expect(modules.some((module) => module.title === "Fall Protection")).toBe(true);
    expect(modules.some((module) => module.sectionHeadings.length > 5)).toBe(true);
  });

  it("matches a subset of hazard modules for current CSEP selections without duplicates", () => {
    const matched = getHazardModulesForCsepSelection({
      selectedHazards: ["Electrical shock"],
      selectedPermits: ["LOTO Permit"],
      taskNames: ["Temporary power panel setup"],
      tradeLabel: "Electrical",
      subTradeLabel: "Power distribution / feeders / branch power",
    });

    expect(matched.map((module) => module.moduleKey)).toEqual([
      "electrical_safety_and_temporary_power",
      "lockout_tagout_and_hazardous_energy_control",
      "tools_equipment_and_temporary_power",
    ]);
    expect(matched[0]?.matchedReasons).toEqual(
      expect.arrayContaining(["Hazard: Electrical shock", "Permit: LOTO Permit"])
    );
  });

  it("builds trimmed AI context rows that preserve matched reasons", () => {
    const matched = getHazardModulesForCsepSelection({
      selectedHazards: ["Falls from height"],
      selectedPermits: ["Ladder Permit"],
      taskNames: ["Extension ladder access"],
      tradeLabel: "",
      subTradeLabel: "",
    });

    const aiContext = buildHazardModuleAiContext(matched, { plainTextMaxLength: 320 });

    expect(aiContext[0]?.plainText.length).toBeLessThanOrEqual(320);
    expect(aiContext[0]?.matchedReasons.length).toBeGreaterThan(0);
    expect(aiContext[0]?.sectionHeadings.length).toBeGreaterThan(0);
  });
});
