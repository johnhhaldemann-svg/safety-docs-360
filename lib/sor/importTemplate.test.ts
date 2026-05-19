import { describe, expect, it } from "vitest";
import { SOR_IMPORT_TEMPLATE_COLUMNS, sorImportTemplateCsv } from "./importTemplate";

describe("sorImportTemplateCsv", () => {
  it("keeps the SOR import header order stable", () => {
    const csv = sorImportTemplateCsv();
    expect(csv.split("\n")[0]).toBe(SOR_IMPORT_TEMPLATE_COLUMNS.join(","));
  });

  it("includes a valid sample hazard code and escapes comma-bearing text", () => {
    const csv = sorImportTemplateCsv();
    expect(csv).toContain("falls_elevation");
    expect(csv).toContain(",high,draft,");
    expect(csv).toContain('"North deck, leading edge missing temporary guardrail"');
  });
});
