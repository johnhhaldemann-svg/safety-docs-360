import ExcelJS from "exceljs";

function cellToValue(value) {
  if (value == null) return "";
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;
  if (typeof value.text === "string") return value.text;
  if (typeof value.hyperlink === "string") return value.hyperlink;
  if ("result" in value) return cellToValue(value.result);
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text ?? "").join("");
  return String(value);
}

function header(value) {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "").trim();
}

export async function readWorkbookMatrix(filePath, sheetName) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
  if (!worksheet) return null;
  const rows = [];
  const columnCount = worksheet.columnCount;
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values = [];
    for (let column = 1; column <= columnCount; column += 1) {
      values.push(cellToValue(row.getCell(column).value));
    }
    if (values.some((value) => header(value))) rows.push(values);
  });
  return rows;
}

export async function readWorkbookObjects(filePath, sheetName) {
  const matrix = await readWorkbookMatrix(filePath, sheetName);
  if (!matrix) return null;
  const headers = (matrix[0] ?? []).map(header);
  return matrix.slice(1).map((row) => {
    const record = {};
    headers.forEach((key, index) => {
      if (key) record[key] = row[index] ?? "";
    });
    return record;
  });
}

export async function firstWorksheetName(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook.worksheets[0]?.name ?? null;
}
