import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildOshaLogImportResponseSummary, parseOshaLogBuffer } from "@/lib/oshaLogs/parser";

function csvBuffer(text: string) {
  return Buffer.from(text, "utf8");
}

describe("OSHA log parser", () => {
  it("parses CSV OSHA rows into deidentified prevention signals", async () => {
    const result = await parseOshaLogBuffer(
      csvBuffer([
        "Case No,Employee Name,Date of Injury,Where event occurred,Describe injury or illness,Days away from work,Days restricted",
        "1,John Smith,2026-02-03,North deck,Worker strained back while lifting pipe,3,0",
        "2,Ana Lopez,2026-03-04,North deck,Worker strained back while lifting pipe bundle,1,2",
      ].join("\n")),
      "osha-300.csv",
      "text/csv"
    );

    expect(result.method).toBe("csv");
    expect(result.parsedCount).toBe(2);
    expect(result.cases[0]).toMatchObject({
      bodyPart: "back",
      injuryType: "strain",
      exposureEventType: "overexertion",
      injurySource: "material_handling",
      recordable: true,
    });
    expect(JSON.stringify(result.cases)).not.toMatch(/John Smith|Ana Lopez/);
  });

  it("parses XLSX rows and ignores repeated header rows", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Case No", "Date of Injury", "Describe injury or illness", "Days away from work"],
      ["1", "2026-01-10", "Employee fractured hand using grinder", 12],
      ["Case No", "Date of Injury", "Describe injury or illness", "Days away from work"],
      ["2", "2026-02-11", "Employee fractured hand using grinder wheel", 4],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "OSHA 300");
    const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);

    const result = await parseOshaLogBuffer(buffer, "osha-log.xlsx");

    expect(result.method).toBe("xlsx");
    expect(result.parsedCount).toBe(2);
    expect(result.cases.map((row) => row.injuryType)).toEqual(["fracture", "fracture"]);
  });

  it("parses selectable-text PDF best effort and flags review", async () => {
    const result = await parseOshaLogBuffer(Buffer.from("pdf"), "osha-log.pdf", "application/pdf", {
      extractText: async () => ({
        ok: true,
        text: "1 01/10/2026 worker laceration hand from saw\n2 02/11/2026 worker laceration hand from saw",
        truncated: false,
        method: "test",
      }),
    });

    expect(result.method).toBe("pdf_text");
    expect(result.status).toBe("needs_review");
    expect(result.parsedCount).toBe(2);
    expect(result.warnings[0]?.code).toBe("pdf_best_effort");
  });

  it("returns needs_review for scanned or unextractable PDFs", async () => {
    const result = await parseOshaLogBuffer(Buffer.from("pdf"), "scan.pdf", "application/pdf", {
      extractText: async () => ({ ok: false, error: "No selectable text found." }),
    });

    expect(result.status).toBe("needs_review");
    expect(result.parsedCount).toBe(0);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "no_extractable_text" }));
  });

  it("reports unsupported files and missing columns", async () => {
    const unsupported = await parseOshaLogBuffer(Buffer.from("hello"), "osha.txt", "application/octet-stream");
    expect(unsupported.status).toBe("failed");
    expect(unsupported.warnings[0]?.code).toBe("unsupported_file_type");

    const missing = await parseOshaLogBuffer(csvBuffer("Name,Trade\nJohn,Carpenter"), "osha.csv", "text/csv");
    expect(missing.status).toBe("needs_review");
    expect(missing.warnings).toContainEqual(expect.objectContaining({ code: "missing_columns" }));
  });

  it("scores repeat patterns with high escalation language", async () => {
    const result = await parseOshaLogBuffer(
      csvBuffer([
        "Case No,Date of Injury,Describe injury or illness,Days away from work",
        "1,2026-01-01,Worker fractured hand using grinder,20",
        "2,2026-02-01,Worker fractured hand using grinder,15",
        "3,2026-03-01,Worker fractured hand using grinder,4",
      ].join("\n")),
      "osha.csv",
      "text/csv"
    );

    const [driver] = buildOshaLogImportResponseSummary(result.cases);
    expect(driver?.riskLevel).toMatch(/high|critical/);
    expect(driver?.nextAction).toMatch(/review|pause|controls/i);
  });
});
