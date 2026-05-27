import * as XLSX from "xlsx";
import { normalizeBodyPart, type BodyPart } from "@/lib/incidents/bodyPart";
import { normalizeExposureEventType, type ExposureEventType } from "@/lib/incidents/exposureEventType";
import { normalizeIncidentSource, type IncidentSource } from "@/lib/incidents/incidentSource";
import { normalizeInjuryType, type InjuryType } from "@/lib/incidents/injuryType";
import { extractGcProgramDocumentText } from "@/lib/gcProgramAiReview";
import type { SafePredictRiskLevel } from "@/lib/safePredictMockData";
import { summarizeOshaLogCases } from "@/lib/oshaLogs/summary";
import type { OshaLogParseMethod, OshaLogParseResult, OshaLogParsedCase, OshaLogParserWarning } from "@/lib/oshaLogs/types";

export const OSHA_LOG_PARSER_VERSION = "osha-log-parser-v1";

type RawRow = Record<string, unknown>;

type ParseOptions = {
  extractText?: (buffer: Buffer, fileName: string) => Promise<{ ok: true; text: string; truncated: boolean; method: string } | { ok: false; error: string }>;
};

const MAX_CASES = 2500;

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function headerKey(value: string) {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rowValue(row: RawRow, candidates: string[]) {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [headerKey(key), value]));
  for (const candidate of candidates) {
    const direct = normalized.get(headerKey(candidate));
    if (direct != null && clean(direct)) return clean(direct);
  }
  for (const [key, value] of normalized.entries()) {
    if (candidates.some((candidate) => key.includes(headerKey(candidate)))) {
      const text = clean(value);
      if (text) return text;
    }
  }
  return "";
}

function parseInteger(value: unknown) {
  const match = clean(value).match(/-?\d+/);
  if (!match) return 0;
  return Math.max(0, Number.parseInt(match[0] ?? "0", 10) || 0);
}

function parseBool(value: unknown) {
  const text = clean(value).toLowerCase();
  if (!text) return false;
  return /^(true|yes|y|1|x|death|fatal|fatality|recordable)$/i.test(text);
}

function dateOnly(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = clean(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  const match = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (!match) return null;
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  const month = Number(match[1]);
  const day = Number(match[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

function includes(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function inferInjuryType(text: string): InjuryType {
  const canonical = normalizeInjuryType(text);
  if (canonical) return canonical;
  if (includes(text, ["amputation"])) return "amputation";
  if (includes(text, ["chemical burn", "caustic"])) return "chemical_burn";
  if (includes(text, ["burn"])) return "burn";
  if (includes(text, ["heat", "dehydration"])) return "heat_illness";
  if (includes(text, ["cold", "frost"])) return "cold_injury";
  if (includes(text, ["concussion", "head injury"])) return "concussion";
  if (includes(text, ["bruise", "contusion"])) return "contusion";
  if (includes(text, ["crush", "caught"])) return "crush_injury";
  if (includes(text, ["fracture", "broken"])) return "fracture";
  if (includes(text, ["hearing", "noise"])) return "hearing_loss";
  if (includes(text, ["cut", "laceration"])) return "laceration";
  if (includes(text, ["puncture"])) return "puncture";
  if (includes(text, ["respiratory", "inhalation", "breathing"])) return "respiratory";
  if (includes(text, ["sprain"])) return "sprain";
  if (includes(text, ["strain", "overexert"])) return "strain";
  if (includes(text, ["eye", "vision"])) return "vision_loss";
  if (includes(text, ["multiple"])) return "multiple_injuries";
  return "other";
}

function inferBodyPart(text: string): BodyPart {
  const canonical = normalizeBodyPart(text);
  if (canonical) return canonical;
  if (includes(text, ["back", "spine"])) return "back";
  if (includes(text, ["finger", "thumb"])) return "fingers";
  if (includes(text, ["hand", "wrist"])) return "hand";
  if (includes(text, ["knee"])) return "knee";
  if (includes(text, ["shoulder"])) return "shoulder";
  if (includes(text, ["eye", "vision"])) return "eye";
  if (includes(text, ["foot", "ankle", "toe"])) return "foot";
  return "other";
}

function inferExposureEvent(text: string): ExposureEventType {
  const canonical = normalizeExposureEventType(text);
  if (canonical) return canonical;
  if (includes(text, ["fall from", "fell from", "fall to lower", "ladder", "scaffold"])) return "fall_to_lower_level";
  if (includes(text, ["slip", "trip", "same level"])) return "fall_same_level";
  if (includes(text, ["struck by", "falling object"])) return "struck_by_object";
  if (includes(text, ["struck against"])) return "struck_against_object";
  if (includes(text, ["forklift", "vehicle", "truck"])) return "struck_by_vehicle";
  if (includes(text, ["caught", "pinch", "compressed"])) return "caught_in_between";
  if (includes(text, ["overexert", "lifting", "pulling", "pushing"])) return "overexertion";
  if (includes(text, ["repetitive", "ergonomic"])) return "repetitive_motion";
  if (includes(text, ["machine", "equipment", "saw", "press"])) return "contact_with_equipment";
  if (includes(text, ["chemical", "fume", "dust", "inhalation"])) return "exposure_harmful_substance";
  if (includes(text, ["electric", "arc flash", "shock"])) return "electrical";
  if (includes(text, ["fire", "flame"])) return "fire";
  if (includes(text, ["heat", "cold"])) return "temperature_extreme";
  if (includes(text, ["confined space"])) return "confined_space";
  return "other";
}

function inferIncidentSource(text: string): IncidentSource {
  const canonical = normalizeIncidentSource(text);
  if (canonical) return canonical;
  if (includes(text, ["ladder"])) return "ladder";
  if (includes(text, ["scaffold"])) return "scaffold";
  if (includes(text, ["tool", "knife", "saw", "grinder", "hammer"])) return "hand_tools";
  if (includes(text, ["material", "lifting", "box", "pipe", "load"])) return "material_handling";
  if (includes(text, ["forklift", "excavator", "aerial lift", "loader", "crane", "machine"])) return "heavy_equipment";
  if (includes(text, ["electric", "panel", "wire"])) return "electrical_system";
  return "other";
}

function severityFor(input: {
  fatality: boolean;
  daysAwayFromWork: number;
  daysRestricted: number;
  injuryType: InjuryType;
  exposureEventType: ExposureEventType;
}): SafePredictRiskLevel {
  if (input.fatality || input.injuryType === "amputation" || input.daysAwayFromWork >= 30) return "critical";
  if (
    input.daysAwayFromWork > 0 ||
    input.daysRestricted >= 7 ||
    input.injuryType === "fracture" ||
    input.injuryType === "crush_injury" ||
    input.exposureEventType === "fall_to_lower_level" ||
    input.exposureEventType === "electrical"
  ) {
    return "high";
  }
  if (input.daysRestricted > 0 || input.injuryType !== "other") return "medium";
  return "low";
}

function confidenceFor(row: OshaLogParsedCase) {
  let points = 0;
  if (row.occurredOn) points += 1;
  if (row.bodyPart !== "other") points += 1;
  if (row.injuryType !== "other") points += 1;
  if (row.exposureEventType !== "other") points += 1;
  if (row.deidentifiedSummary.length > 20) points += 1;
  if (points >= 4) return "high";
  if (points >= 2) return "medium";
  return "low";
}

function normalizeCase(row: RawRow, rowNumber: number): OshaLogParsedCase | null {
  const description = rowValue(row, [
    "describe injury or illness",
    "description",
    "injury description",
    "what happened",
    "narrative",
  ]);
  const bodyText = rowValue(row, ["body part", "part of body"]);
  const injuryText = rowValue(row, ["injury type", "nature of injury", "type of injury", "illness type"]);
  const eventText = rowValue(row, ["event type", "exposure event", "event", "cause"]);
  const sourceText = rowValue(row, ["source", "object", "equipment"]);
  const occurredOn = dateOnly(rowValue(row, ["date of injury", "date of onset", "injury date", "occurred on", "date"]));
  const caseNumber = rowValue(row, ["case no", "case number", "case", "log number"]) || null;
  const department = rowValue(row, ["department", "job title", "trade", "crew"]) || null;
  const location = rowValue(row, ["where event occurred", "location", "work area", "site"]) || null;

  if (!description && !occurredOn && !caseNumber) return null;
  if (/case\s*no|employee|describe\s+injury/i.test(description) && !occurredOn) return null;

  const daysAwayFromWork = parseInteger(rowValue(row, ["days away from work", "days away", "away days"]));
  const daysRestricted = parseInteger(rowValue(row, ["days restricted", "restricted days", "job transfer or restriction"]));
  const jobTransfer = parseBool(rowValue(row, ["job transfer", "transfer"]));
  const fatality = parseBool(rowValue(row, ["death", "fatality", "fatal"]));
  const recordableRaw = rowValue(row, ["recordable", "osha recordable"]);
  const injuryType = inferInjuryType([injuryText, description].join(" "));
  const bodyPart = inferBodyPart([bodyText, description].join(" "));
  const exposureEventType = inferExposureEvent([eventText, description, sourceText].join(" "));
  const injurySource = inferIncidentSource([sourceText, description].join(" "));
  const severity = severityFor({ fatality, daysAwayFromWork, daysRestricted, injuryType, exposureEventType });
  const repeatPatternKey = [bodyPart, injuryType, exposureEventType, injurySource].join("|");
  const deidentifiedSummary = [
    occurredOn ? `Case date ${occurredOn}` : "Case date missing",
    `${bodyPart}/${injuryType}`,
    `${exposureEventType} via ${injurySource}`,
    daysAwayFromWork > 0 ? `${daysAwayFromWork} days away` : null,
    daysRestricted > 0 ? `${daysRestricted} restricted days` : null,
    fatality ? "fatality" : null,
  ]
    .filter(Boolean)
    .join("; ");
  const parsed: OshaLogParsedCase = {
    caseNumber,
    occurredOn,
    department,
    location,
    injuryType,
    bodyPart,
    exposureEventType,
    injurySource,
    daysAwayFromWork,
    daysRestricted,
    jobTransfer,
    recordable: recordableRaw ? parseBool(recordableRaw) : true,
    fatality,
    severity,
    repeatPatternKey,
    deidentifiedSummary,
    sourceRowNumber: rowNumber,
    parserConfidence: "low",
  };
  parsed.parserConfidence = confidenceFor(parsed);
  return parsed;
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === "\"" && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function objectsFromMatrix(matrix: unknown[][]): RawRow[] {
  const headerIndex = matrix.findIndex((row) =>
    row.map(clean).some((cell) => /case|date|injury|illness|description/i.test(cell))
  );
  if (headerIndex < 0) return [];
  const headers = matrix[headerIndex].map((cell, index) => clean(cell) || `Column ${index + 1}`);
  return matrix.slice(headerIndex + 1).map((row) => {
    const out: RawRow = {};
    headers.forEach((header, index) => {
      out[header] = row[index] ?? "";
    });
    return out;
  });
}

function parseStructuredRows(rows: RawRow[], method: OshaLogParseMethod): OshaLogParseResult {
  const warnings: OshaLogParserWarning[] = [];
  const cases: OshaLogParsedCase[] = [];
  let skippedCount = 0;
  if (rows.length === 0) {
    warnings.push({ code: "missing_columns", message: "Required OSHA log columns were not found. Include a case/date and injury description column." });
  }
  rows.slice(0, MAX_CASES).forEach((row, index) => {
    const parsed = normalizeCase(row, index + 2);
    if (!parsed) {
      skippedCount += 1;
      if (index < 10) {
        warnings.push({ code: "row_skipped", message: "A row did not contain enough case information to import.", rowNumber: index + 2 });
      }
      return;
    }
    cases.push(parsed);
  });
  if (cases.length === 0) {
    warnings.push({ code: "no_cases_found", message: "No OSHA log cases could be parsed from this file." });
  }
  if (cases.some((row) => row.parserConfidence === "low")) {
    warnings.push({ code: "low_confidence", message: "Some rows were parsed with low confidence and should be reviewed." });
  }
  return {
    status: cases.length > 0 && !cases.some((row) => row.parserConfidence === "low") ? "processed" : "needs_review",
    method,
    cases,
    warnings,
    parsedCount: cases.length,
    skippedCount,
  };
}

async function parsePdf(buffer: Buffer, fileName: string, options?: ParseOptions): Promise<OshaLogParseResult> {
  const extractor = options?.extractText ?? extractGcProgramDocumentText;
  const extracted = await extractor(buffer, fileName);
  if (!extracted.ok) {
    return {
      status: "needs_review",
      method: "pdf_text",
      cases: [],
      warnings: [{ code: "no_extractable_text", message: extracted.error }],
      parsedCount: 0,
      skippedCount: 0,
    };
  }
  const text = extracted.text.trim();
  if (text.length < 40) {
    return {
      status: "needs_review",
      method: "pdf_text",
      cases: [],
      warnings: [{ code: "no_extractable_text", message: "No extractable OSHA log text was found. Upload CSV/XLSX or a selectable-text PDF." }],
      parsedCount: 0,
      skippedCount: 0,
    };
  }
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const rows = lines
    .filter((line) => /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(line))
    .map((line, index): RawRow => ({
      "Case No": String(index + 1),
      "Date of Injury": line.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/)?.[0] ?? "",
      Description: line,
    }));
  const result = parseStructuredRows(rows, "pdf_text");
  result.status = "needs_review";
  result.warnings.unshift({
    code: "pdf_best_effort",
    message: "PDF OSHA logs are parsed from selectable text only. Review imported cases before relying on the patterns.",
  });
  return result;
}

export async function parseOshaLogBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType?: string | null,
  options?: ParseOptions
): Promise<OshaLogParseResult> {
  const lower = fileName.toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();
  if (lower.endsWith(".pdf") || mime.includes("pdf")) {
    return parsePdf(buffer, fileName, options);
  }

  if (lower.endsWith(".csv") || mime.includes("csv") || mime.includes("text/plain")) {
    const matrix = csvRows(buffer.toString("utf8"));
    return parseStructuredRows(objectsFromMatrix(matrix), "csv");
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm") || mime.includes("spreadsheet") || mime.includes("excel")) {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : null;
    const matrix = sheet ? (XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][]) : [];
    return parseStructuredRows(objectsFromMatrix(matrix), "xlsx");
  }

  return {
    status: "failed",
    method: null,
    cases: [],
    warnings: [{ code: "unsupported_file_type", message: "Unsupported OSHA log file type. Upload CSV, XLSX, XLS, XLSM, or selectable-text PDF." }],
    parsedCount: 0,
    skippedCount: 0,
  };
}

export function buildOshaLogImportResponseSummary(cases: OshaLogParsedCase[]) {
  return summarizeOshaLogCases(cases).topDrivers;
}
