import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  FIELD_ISSUE_IMPORT_TEMPLATE_HEADERS,
  buildFieldIssueImportTemplateXlsx,
  excelSerialToDate,
  parseFieldIssueExcelBuffer,
} from "./excelImport";

function writeXlsxToArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const copy = new ArrayBuffer(buf.byteLength);
  new Uint8Array(copy).set(buf);
  return copy;
}

function workbookBuffer(rows: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return writeXlsxToArrayBuffer(wb);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

describe("excelImport", () => {
  it("builds a non-empty xlsx template", () => {
    const bytes = buildFieldIssueImportTemplateXlsx();
    expect(bytes.byteLength).toBeGreaterThan(64);
    const workbook = XLSX.read(bytes, { type: "array" });
    expect(workbook.SheetNames).toContain("Issues");
    const sheet = workbook.Sheets.Issues;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
    expect(rows[0]).toEqual([...FIELD_ISSUE_IMPORT_TEMPLATE_HEADERS]);
    const ab = toArrayBuffer(bytes);
    const parsed = parseFieldIssueExcelBuffer(ab, [], null);
    expect(parsed.ok.length).toBeGreaterThanOrEqual(1);
    expect(parsed.ok[0]?.payload.title).toContain("Example");
  });

  it("maps a valid row with jobsite_name", () => {
    const headers = [
      "title",
      "jobsite_name",
      "severity",
      "category",
      "observation_type",
      "sif_potential",
    ];
    const buffer = workbookBuffer([
      headers,
      ["Loose guardrail", "North Yard", "high", "fall_hazard", "negative", "no"],
    ]);
    const { ok, errors } = parseFieldIssueExcelBuffer(buffer, [{ id: "js-1", name: "North Yard" }], null);
    expect(errors).toEqual([]);
    expect(ok).toHaveLength(1);
    expect(ok[0]?.sheetRow).toBe(2);
    expect(ok[0]?.payload).toMatchObject({
      title: "Loose guardrail",
      jobsiteId: "js-1",
      severity: "high",
      category: "fall_hazard",
      observationType: "negative",
      sifPotential: false,
    });
  });

  it("errors when title is missing on a non-empty row", () => {
    const buffer = workbookBuffer([
      ["title", "description"],
      ["", "Only description"],
    ]);
    const { ok, errors } = parseFieldIssueExcelBuffer(buffer, [], null);
    expect(ok).toEqual([]);
    expect(errors.some((e) => e.sheetRow === 2 && e.message.includes("title"))).toBe(true);
  });

  it("errors on unmatched jobsite_name", () => {
    const buffer = workbookBuffer([
      ["title", "jobsite_name"],
      ["Issue", "Unknown Site"],
    ]);
    const { ok, errors } = parseFieldIssueExcelBuffer(buffer, [{ id: "a", name: "Known" }], null);
    expect(ok).toEqual([]);
    expect(errors[0]?.message).toContain("jobsite_name not matched");
  });

  it("parses Excel serial dates for due_at", () => {
    const serial = 44927; // 2023-01-15 in Excel 1900 system
    const buffer = workbookBuffer([
      ["title", "due_at"],
      ["Due soon", serial],
    ]);
    const { ok, errors } = parseFieldIssueExcelBuffer(buffer, [], null);
    expect(errors).toEqual([]);
    expect(ok[0]?.payload.dueAt).toBe(excelSerialToDate(serial).toISOString().slice(0, 10));
  });

  it("errors on invalid severity", () => {
    const buffer = workbookBuffer([
      ["title", "severity"],
      ["Bad sev", "extreme"],
    ]);
    const { ok, errors } = parseFieldIssueExcelBuffer(buffer, [], null);
    expect(ok).toEqual([]);
    expect(errors[0]?.message).toContain("Invalid severity");
  });

  it("resolves assigned_user_email via lookup", () => {
    const buffer = workbookBuffer([
      ["title", "observation_type", "sif_potential", "assigned_user_email"],
      ["T", "positive", "", "Pat@Example.com"],
    ]);
    const lookup = {
      emailToUserId: new Map([["pat@example.com", "user-99"]]),
    };
    const { ok, errors } = parseFieldIssueExcelBuffer(buffer, [], lookup);
    expect(errors).toEqual([]);
    expect(ok[0]?.payload.assignedUserId).toBe("user-99");
  });
});
