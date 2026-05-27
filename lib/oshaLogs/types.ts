import type { BodyPart } from "@/lib/incidents/bodyPart";
import type { ExposureEventType } from "@/lib/incidents/exposureEventType";
import type { IncidentSource } from "@/lib/incidents/incidentSource";
import type { InjuryType } from "@/lib/incidents/injuryType";
import type { SafePredictRiskLevel } from "@/lib/safePredictMockData";

export type OshaLogImportStatus = "processed" | "needs_review" | "failed";
export type OshaLogParseMethod = "csv" | "xlsx" | "pdf_text";

export type OshaLogParserWarning = {
  code:
    | "unsupported_file_type"
    | "missing_columns"
    | "no_extractable_text"
    | "low_confidence"
    | "row_skipped"
    | "pdf_best_effort"
    | "no_cases_found";
  message: string;
  rowNumber?: number;
};

export type OshaLogParsedCase = {
  caseNumber: string | null;
  occurredOn: string | null;
  department: string | null;
  location: string | null;
  injuryType: InjuryType;
  bodyPart: BodyPart;
  exposureEventType: ExposureEventType;
  injurySource: IncidentSource;
  daysAwayFromWork: number;
  daysRestricted: number;
  jobTransfer: boolean;
  recordable: boolean;
  fatality: boolean;
  severity: SafePredictRiskLevel;
  repeatPatternKey: string;
  deidentifiedSummary: string;
  sourceRowNumber: number;
  parserConfidence: "high" | "medium" | "low";
};

export type OshaLogParseResult = {
  status: OshaLogImportStatus;
  method: OshaLogParseMethod | null;
  cases: OshaLogParsedCase[];
  warnings: OshaLogParserWarning[];
  parsedCount: number;
  skippedCount: number;
};

export type OshaLogImportRow = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  original_file_name: string;
  storage_path: string;
  file_mime_type: string | null;
  file_size_bytes: number;
  import_year: number | null;
  status: OshaLogImportStatus;
  parser_version: string;
  parse_method: OshaLogParseMethod | null;
  parsed_count: number;
  skipped_count: number;
  warnings: OshaLogParserWarning[];
  created_by: string | null;
  created_at: string;
};

export type OshaLogCaseRow = {
  id?: string;
  company_id: string;
  import_id: string;
  jobsite_id: string | null;
  case_number: string | null;
  occurred_on: string | null;
  department: string | null;
  location: string | null;
  injury_type: InjuryType;
  body_part: BodyPart;
  exposure_event_type: ExposureEventType;
  injury_source: IncidentSource;
  days_away_from_work: number;
  days_restricted: number;
  job_transfer: boolean;
  recordable: boolean;
  fatality: boolean;
  severity: SafePredictRiskLevel;
  repeat_pattern_key: string;
  deidentified_summary: string;
  source_row_number: number;
  parser_confidence: "high" | "medium" | "low";
  created_at?: string;
};

export type OshaRepeatInjuryDriver = {
  key: string;
  label: string;
  detail: string;
  nextAction: string;
  riskLevel: SafePredictRiskLevel;
  score: number;
  count: number;
  recordableCount: number;
  severeCount: number;
  daysAwayTotal: number;
  daysRestrictedTotal: number;
  bodyPart: BodyPart;
  injuryType: InjuryType;
  exposureEventType: ExposureEventType;
  injurySource: IncidentSource;
  latestOccurredOn: string | null;
};

export type OshaLogSummary = {
  imports: number;
  cases: number;
  recordableCases: number;
  topDrivers: OshaRepeatInjuryDriver[];
  missingData: string[];
};
