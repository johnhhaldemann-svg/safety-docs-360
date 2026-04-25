import { describe, expect, it } from "vitest";
import { listSectionDensity, simpleDataTableLayout, wideInvoiceTableLayout } from "./tableDensityLayout";

describe("tableDensityLayout", () => {
  it("switches table text size with compact", () => {
    expect(simpleDataTableLayout(false).table).toContain("text-sm");
    expect(simpleDataTableLayout(true).table).toContain("text-xs");
  });

  it("wide invoice table changes min width when compact", () => {
    expect(wideInvoiceTableLayout(true).table).toContain("min-w-[900px]");
    expect(wideInvoiceTableLayout(false).table).toContain("min-w-[980px]");
  });

  it("list section uses tighter card padding when compact", () => {
    expect(listSectionDensity(true).card).toContain("p-3");
    expect(listSectionDensity(false).card).toContain("p-4");
  });
});
