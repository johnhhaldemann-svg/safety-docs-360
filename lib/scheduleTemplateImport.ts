import { readExcelRows } from "@/lib/excelRows";

export type ScheduleTemplateRiskLevel = "critical" | "high" | "medium" | "low";

export type ScheduleTemplateTask = {
  title: string;
  dueDate: string;
  workEndDate: string;
  trade: string;
  taskType: string;
  workArea: string;
  shiftStartTime: string;
  shiftEndTime: string;
  crewSize: string;
  riskLevel: ScheduleTemplateRiskLevel;
  owner: string;
  hazards: string;
  permits: string;
  controls: string;
  notes: string;
  sourceMetadata?: {
    importKey?: string;
    importSource?: string;
    sourceTaskId?: string;
    percentComplete?: string;
    projectStatus?: string;
    priority?: string;
    outlineLevel?: string;
  };
};

export type ScheduleTemplateParseResult = {
  tasks: ScheduleTemplateTask[];
  errors: string[];
};

export const scheduleTemplateColumns = [
  { key: "title", label: "Task title", aliases: ["task", "task title", "title", "activity", "task name", "name"] },
  { key: "dueDate", label: "Date", aliases: ["date", "due date", "work start date", "start date", "start"] },
  { key: "trade", label: "Trade", aliases: ["trade", "crew trade", "bucket", "bucket name"] },
  { key: "taskType", label: "Task type", aliases: ["task type", "type", "work type", "mode", "task mode"] },
  { key: "workArea", label: "Work area", aliases: ["work area", "area", "location", "phase", "project phase"] },
  { key: "shiftStartTime", label: "Shift start", aliases: ["shift start", "start time", "shift start time"] },
  { key: "shiftEndTime", label: "Shift end", aliases: ["shift end", "end time", "shift end time"] },
  { key: "crewSize", label: "Crew size", aliases: ["crew size", "crew", "headcount"] },
  { key: "riskLevel", label: "Risk level", aliases: ["risk", "risk level", "priority"] },
  { key: "owner", label: "Owner / supervisor", aliases: ["owner", "supervisor", "owner / supervisor", "resource names", "resources", "assigned to", "assigned"] },
  { key: "hazards", label: "Hazards", aliases: ["hazards", "hazard categories"] },
  { key: "permits", label: "Permit triggers", aliases: ["permit triggers", "permits", "permit"] },
  { key: "controls", label: "Required controls", aliases: ["required controls", "controls"] },
  { key: "notes", label: "Notes", aliases: ["notes", "context"] },
] as const;

export const scheduleTemplateHeader = scheduleTemplateColumns.map((column) => column.label).join(",");
export const scheduleTemplateAccept = ".csv,text/csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeImportKeyPart(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function compactImportKey(value: string) {
  return normalizeImportKeyPart(value).slice(0, 180);
}

export function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function normalizeScheduleDate(value: string) {
  const trimmed = value.trim().replace(/^(mon|tue|wed|thu|fri|sat|sun)\w*,?\s+/i, "");
  if (!trimmed) return "";
  const dateTimePrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})[t\s]/i);
  if (dateTimePrefix) return dateTimePrefix[1];
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)?$/i);
  if (!usMatch) return null;
  const month = Number(usMatch[1]);
  const day = Number(usMatch[2]);
  const year = usMatch[3].length === 2 ? 2000 + Number(usMatch[3]) : Number(usMatch[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeScheduleTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const twentyFourHour = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return null;
  }

  const amPm = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!amPm) return null;
  let hour = Number(amPm[1]);
  const minute = Number(amPm[2] ?? "0");
  const period = amPm[3].toLowerCase();
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  if (period === "pm" && hour !== 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeScheduleRisk(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "high";
  const numericPriority = Number(normalized);
  if (Number.isFinite(numericPriority)) {
    if (numericPriority >= 900) return "critical";
    if (numericPriority >= 700) return "high";
    if (numericPriority >= 300) return "medium";
    return "low";
  }
  if (["critical priority", "highest"].includes(normalized)) return "critical";
  if (["high priority"].includes(normalized)) return "high";
  if (["medium priority", "normal", "normal priority"].includes(normalized)) return "medium";
  if (["low priority"].includes(normalized)) return "low";
  if (["critical", "high", "medium", "low"].includes(normalized)) return normalized as ScheduleTemplateRiskLevel;
  return null;
}

export function parseScheduleTemplateRows(rows: string[][]): ScheduleTemplateParseResult {
  const tasks: ScheduleTemplateTask[] = [];
  const errors: string[] = [];
  const titleAliases = scheduleTemplateColumns[0].aliases.map(normalizeCsvHeader);
  const dateAliases = ["date", "due date", "work start date", "start date", "start", "finish", "finish date", "end", "end date"].map(normalizeCsvHeader);
  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map((cell) => normalizeCsvHeader(String(cell ?? "")));
    return normalized.some((cell) => titleAliases.includes(cell)) && normalized.some((cell) => dateAliases.includes(cell));
  });
  const headerRow = headerIndex >= 0 ? rows[headerIndex] : rows[0];
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows.slice(1);
  if (!headerRow) return { tasks, errors: ["No schedule header row found."] };

  const headerMap = new Map<string, number>();
  headerRow.forEach((header, index) => headerMap.set(normalizeCsvHeader(header), index));

  function cellIndexFor(aliases: readonly string[]) {
    const match = aliases.find((alias) => headerMap.has(normalizeCsvHeader(alias)));
    return typeof match === "string" ? headerMap.get(normalizeCsvHeader(match)) : undefined;
  }

  for (const [rowOffset, row] of dataRows.entries()) {
    const rowNumber = rowOffset + 2;
    const valueForAliases = (aliases: readonly string[]) => {
      const index = cellIndexFor(aliases);
      return typeof index === "number" ? String(row[index] ?? "").trim() : "";
    };
    const valueFor = (column: (typeof scheduleTemplateColumns)[number]) => valueForAliases(column.aliases);

    const title = valueFor(scheduleTemplateColumns[0]);
    if (!title && row.every((value) => !String(value ?? "").trim())) continue;
    if (!title) {
      errors.push(`Row ${rowNumber}: task title is required.`);
      continue;
    }

    const dueDate = normalizeScheduleDate(valueFor(scheduleTemplateColumns[1]));
    const workEndDate = normalizeScheduleDate(valueForAliases(["finish", "finish date", "end", "end date", "work end date"]) || valueFor(scheduleTemplateColumns[1]));
    const shiftStartTime = normalizeScheduleTime(valueFor(scheduleTemplateColumns[5]));
    const shiftEndTime = normalizeScheduleTime(valueFor(scheduleTemplateColumns[6]));
    const riskSeed = valueFor(scheduleTemplateColumns[8]) || valueForAliases(["priority", "task priority"]);
    const riskLevel = normalizeScheduleRisk(riskSeed);
    const crewSize = valueFor(scheduleTemplateColumns[7]);
    const crewSizeNumber = crewSize ? Number(crewSize) : null;
    const invalidCrewSize = crewSizeNumber !== null && (!Number.isFinite(crewSizeNumber) || crewSizeNumber < 0);
    const sourceTaskId = valueForAliases(["unique id", "task id", "id", "guid", "source task id"]);
    const percentComplete = valueForAliases(["% complete", "percent complete", "complete", "progress"]);
    const projectStatus = valueForAliases(["status", "task status"]);
    const priority = valueForAliases(["priority", "task priority"]);
    const outlineLevel = valueForAliases(["outline level", "outline"]);
    const importKey = sourceTaskId.trim()
      ? compactImportKey(`microsoft-project-${sourceTaskId}`)
      : compactImportKey(`microsoft-project-${title}-${dueDate || "no-start"}-${workEndDate || dueDate || "no-end"}`);

    if (dueDate === null) errors.push(`Row ${rowNumber}: date must be YYYY-MM-DD or MM/DD/YYYY.`);
    if (workEndDate === null) errors.push(`Row ${rowNumber}: finish date must be YYYY-MM-DD or MM/DD/YYYY.`);
    if (shiftStartTime === null) errors.push(`Row ${rowNumber}: shift start must be HH:MM or h:mm AM/PM.`);
    if (shiftEndTime === null) errors.push(`Row ${rowNumber}: shift end must be HH:MM or h:mm AM/PM.`);
    if (riskLevel === null) errors.push(`Row ${rowNumber}: risk level must be critical, high, medium, or low.`);
    if (invalidCrewSize) errors.push(`Row ${rowNumber}: crew size must be a positive number.`);
    if (dueDate === null || workEndDate === null || shiftStartTime === null || shiftEndTime === null || riskLevel === null || invalidCrewSize) continue;

    tasks.push({
      title,
      dueDate,
      workEndDate,
      shiftStartTime,
      shiftEndTime,
      trade: valueFor(scheduleTemplateColumns[2]),
      taskType: valueFor(scheduleTemplateColumns[3]) || projectStatus || "Microsoft Project task",
      workArea: valueFor(scheduleTemplateColumns[4]),
      crewSize,
      riskLevel,
      owner: valueFor(scheduleTemplateColumns[9]),
      hazards: valueFor(scheduleTemplateColumns[10]),
      permits: valueFor(scheduleTemplateColumns[11]),
      controls: valueFor(scheduleTemplateColumns[12]),
      notes: valueFor(scheduleTemplateColumns[13]),
      sourceMetadata: {
        importKey,
        importSource: "microsoft_project_file",
        sourceTaskId: sourceTaskId || undefined,
        percentComplete: percentComplete || undefined,
        projectStatus: projectStatus || undefined,
        priority: priority || undefined,
        outlineLevel: outlineLevel || undefined,
      },
    });
  }

  return { tasks, errors };
}

export function parseScheduleTemplateCsv(text: string) {
  return parseScheduleTemplateRows(parseCsvRows(text.replace(/^\uFEFF/, "")));
}

async function parseScheduleWorkbookRows(buffer: ArrayBuffer) {
  const rows = await readExcelRows(buffer);
  return rows.map((row) => row.map((cell) => String(cell ?? "")));
}

export async function parseScheduleTemplateFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  const isWorkbook =
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    mime.includes("spreadsheet") ||
    mime === "application/vnd.ms-excel";

  if (isWorkbook) {
    const rows = await parseScheduleWorkbookRows(await file.arrayBuffer());
    return parseScheduleTemplateRows(rows);
  }

  if (lowerName.endsWith(".csv") || mime.includes("csv") || mime.startsWith("text/") || !mime) {
    return parseScheduleTemplateCsv(await file.text());
  }

  return {
    tasks: [],
    errors: ["Upload a CSV or Excel schedule template (.csv, .xlsx, or .xls)."],
  };
}
