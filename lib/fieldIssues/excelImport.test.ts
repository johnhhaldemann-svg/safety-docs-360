import { describe, expect, it } from "vitest";
import { buildSimpleWorkbookBuffer, readExcelRows } from "@/lib/excelRows";
import {
  FIELD_ISSUE_IMPORT_TEMPLATE_HEADERS,
  buildFieldIssueImportTemplateXlsx,
  excelSerialToDate,
  parseFieldIssueExcelBuffer,
} from "./excelImport";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

describe("excelImport", () => {
  it("builds a non-empty xlsx template", async () => {
    const bytes = await buildFieldIssueImportTemplateXlsx();
    expect(bytes.byteLength).toBeGreaterThan(64);
    const rows = await readExcelRows(toArrayBuffer(bytes));
    expect(rows[0]).toEqual([...FIELD_ISSUE_IMPORT_TEMPLATE_HEADERS]);
    const ab = toArrayBuffer(bytes);
    const parsed = await parseFieldIssueExcelBuffer(ab, [], null);
    expect(parsed.ok.length).toBeGreaterThanOrEqual(1);
    expect(parsed.ok[0]?.payload.title).toContain("Example");
  });

  it("maps a valid row with jobsite_name", async () => {
    const headers = [
      "title",
      "jobsite_name",
      "severity",
      "category",
      "observation_type",
      "sif_potential",
    ];
    const bytes = await buildSimpleWorkbookBuffer("Sheet1", [
      headers,
      ["Loose guardrail", "North Yard", "high", "fall_hazard", "negative", "no"],
    ]);
    const { ok, errors } = await parseFieldIssueExcelBuffer(toArrayBuffer(bytes), [{ id: "js-1", name: "North Yard" }], null);
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

  it("errors when title is missing on a non-empty row", async () => {
    const bytes = await buildSimpleWorkbookBuffer("Sheet1", [
      ["title", "description"],
      ["", "Only description"],
    ]);
    const { ok, errors } = await parseFieldIssueExcelBuffer(toArrayBuffer(bytes), [], null);
    expect(ok).toEqual([]);
    expect(errors.some((e) => e.sheetRow === 2 && e.message.includes("title"))).toBe(true);
  });

  it("errors on unmatched jobsite_name", async () => {
    const bytes = await buildSimpleWorkbookBuffer("Sheet1", [
      ["title", "jobsite_name"],
      ["Issue", "Unknown Site"],
    ]);
    const { ok, errors } = await parseFieldIssueExcelBuffer(toArrayBuffer(bytes), [{ id: "a", name: "Known" }], null);
    expect(ok).toEqual([]);
    expect(errors[0]?.message).toContain("jobsite_name not matched");
  });

  it("parses Excel serial dates for due_at", async () => {
    const serial = 44927; // 2023-01-15 in Excel 1900 system
    const bytes = await buildSimpleWorkbookBuffer("Sheet1", [
      ["title", "due_at"],
      ["Due soon", serial],
    ]);
    const { ok, errors } = await parseFieldIssueExcelBuffer(toArrayBuffer(bytes), [], null);
    expect(errors).toEqual([]);
    expect(ok[0]?.payload.dueAt).toBe(excelSerialToDate(serial).toISOString().slice(0, 10));
  });

  it("errors on invalid severity", async () => {
    const bytes = await buildSimpleWorkbookBuffer("Sheet1", [
      ["title", "severity"],
      ["Bad sev", "extreme"],
    ]);
    const { ok, errors } = await parseFieldIssueExcelBuffer(toArrayBuffer(bytes), [], null);
    expect(ok).toEqual([]);
    expect(errors[0]?.message).toContain("Invalid severity");
  });

  it("resolves assigned_user_email via lookup", async () => {
    const bytes = await buildSimpleWorkbookBuffer("Sheet1", [
      ["title", "observation_type", "sif_potential", "assigned_user_email"],
      ["T", "positive", "", "Pat@Example.com"],
    ]);
    const lookup = {
      emailToUserId: new Map([["pat@example.com", "user-99"]]),
    };
    const { ok, errors } = await parseFieldIssueExcelBuffer(toArrayBuffer(bytes), [], lookup);
    expect(errors).toEqual([]);
    expect(ok[0]?.payload.assignedUserId).toBe("user-99");
  });
});
