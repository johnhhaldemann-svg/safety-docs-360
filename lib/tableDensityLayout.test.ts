import { describe, expect, it } from "vitest";
import {
  fieldIdMatrixTableLayout,
  listSectionDensity,
  liveObservationMatrixLayout,
  simpleDataTableLayout,
  submissionHistoryTableLayout,
  uploadCenterTableLayout,
  wideInvoiceTableLayout,
} from "./tableDensityLayout";

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

  it("submission history table tightens cells when compact", () => {
    expect(submissionHistoryTableLayout(true).td).toContain("py-1");
    expect(submissionHistoryTableLayout(false).td).toContain("py-2");
  });

  it("live matrix and upload table respond to compact", () => {
    expect(liveObservationMatrixLayout(true).table).toContain("text-[10px]");
    expect(uploadCenterTableLayout(true).table).toContain("border-spacing-y-2");
    expect(uploadCenterTableLayout(false).table).toContain("border-spacing-y-3");
  });

  it("field ID matrix tightens border spacing when compact", () => {
    expect(fieldIdMatrixTableLayout(true).table).toContain("border-spacing-y-1.5");
    expect(fieldIdMatrixTableLayout(false).table).toContain("border-spacing-y-2");
  });
});
