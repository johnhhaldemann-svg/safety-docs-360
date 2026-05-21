import { describe, expect, it } from "vitest";
import {
  buildTaskModuleAiContext,
  getSiteManagementTaskModules,
  getTaskModulesForCsepSelection,
  getTaskModulesForTask,
  SITE_MANAGEMENT_TRADE_LABEL,
} from "@/lib/siteManagementTaskModules";

describe("siteManagementTaskModules", () => {
  it("loads normalized task module records from the imported DOCX source set", () => {
    const modules = getSiteManagementTaskModules();

    expect(modules).toHaveLength(19);
    expect(modules.every((module) => module.plainText.length > 200)).toBe(true);
    expect(modules.some((module) => module.title === "Site Setup")).toBe(true);
  });

  it("returns the full site management reference pack for Site setup", () => {
    const modules = getTaskModulesForCsepSelection({
      tradeLabel: SITE_MANAGEMENT_TRADE_LABEL,
      taskNames: ["Site setup"],
    });

    expect(modules).toHaveLength(19);
    expect(modules.map((module) => module.title)).toContain("Traffic Control");
    expect(modules.map((module) => module.title)).toContain("Permit Review");
  });

  it("returns only matched modules for non-site-setup tasks and trims AI context text", () => {
    const matched = getTaskModulesForTask("Access control");
    const aiContext = buildTaskModuleAiContext(matched, { plainTextMaxLength: 320 });

    expect(matched).toHaveLength(1);
    expect(matched[0]?.title).toBe("Access Control");
    expect(aiContext[0]?.plainText.length).toBeLessThanOrEqual(320);
    expect(aiContext[0]?.sectionHeadings.length).toBeGreaterThan(0);
  });
});
