import type { CellValue } from "exceljs";

function excelCellToValue(value: CellValue): unknown {
  if (value == null) return "";
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;
  if ("text" in value && typeof value.text === "string") return value.text;
  if ("hyperlink" in value && typeof value.hyperlink === "string") return value.hyperlink;
  if ("result" in value) return excelCellToValue(value.result as CellValue);
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text ?? "").join("");
  }
  return String(value);
}

function cellToHeader(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "").trim();
}

export async function readExcelRows(buffer: ArrayBuffer): Promise<unknown[][]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: unknown[][] = [];
  const columnCount = worksheet.columnCount;
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values: unknown[] = [];
    for (let column = 1; column <= columnCount; column += 1) {
      values.push(excelCellToValue(row.getCell(column).value));
    }
    if (values.some((value) => cellToHeader(value))) {
      rows.push(values);
    }
  });
  return rows;
}

export async function readExcelObjects(buffer: ArrayBuffer): Promise<Record<string, unknown>[]> {
  const rows = await readExcelRows(buffer);
  const headers = (rows[0] ?? []).map(cellToHeader);
  return rows.slice(1).map((row) => {
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = row[index] ?? "";
    });
    return record;
  });
}

export async function buildSimpleWorkbookBuffer(sheetName: string, rows: readonly unknown[][]): Promise<Uint8Array> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  rows.forEach((row) => worksheet.addRow([...row]));
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
