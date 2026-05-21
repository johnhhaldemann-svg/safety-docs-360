import { describe, expect, it } from "vitest";
import environmentalRows from "./environmental-audit-rows.json";
import healthSafetyRows from "./health-safety-audit-rows.json";
import {
  deriveExcelSectionLabel,
  getEnvironmentalSections,
  getHealthSafetySections,
  isChecklistColumnHeaderRow,
  splitIntoSections,
  type AuditExcelRow,
} from "./auditRows";

describe("jobsite audit rows (Excel JSON fidelity)", () => {
  it("environmental: keeps every non-header row from the export (no filtering)", () => {
    const rows = environmentalRows as AuditExcelRow[];
    const headerCount = rows.filter((r) => isChecklistColumnHeaderRow(r)).length;
    const sections = getEnvironmentalSections();
    const flat = sections.flat();
    expect(flat.length).toBe(rows.length - headerCount);
  });

  it("health & safety: splits full Sheet1 export", () => {
    const rows = healthSafetyRows as AuditExcelRow[];
    const headerCount = rows.filter((r) => isChecklistColumnHeaderRow(r)).length;
    const sections = getHealthSafetySections();
    const flat = sections.flat();
    expect(flat.length).toBe(rows.length - headerCount);
  });

  it("deriveExcelSectionLabel uses first row category text", () => {
    const rows: AuditExcelRow[] = [
      {
        "Category/Requirement": "Cal OSHA IIPP                           N/A  ",
        "Category/Requirement_1": "Cal OSHA RMI (Ergo)           N/A  ",
      },
    ];
    expect(deriveExcelSectionLabel(rows, 0, "hs")).toContain("Cal OSHA IIPP");
  });

  it("splitIntoSections separates on repeated column-header rows", () => {
    const rows: AuditExcelRow[] = [
      { "Category/Requirement": "Topic A", "Category/Requirement_1": "Topic B" },
      { "Category/Requirement": "Category/Requirement", Date: "Date", "Y/N": "Y/N" },
      { "Category/Requirement": "After header" },
    ];
    const sections = splitIntoSections(rows);
    expect(sections.length).toBe(2);
    expect(sections[0].map((r) => r["Category/Requirement"])).toContain("Topic A");
    expect(sections[1].map((r) => r["Category/Requirement"])).toContain("After header");
  });
});
