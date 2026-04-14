import type { JsonObject, JsonValue, SafetyIngestionSourceType, StandardSeverity } from "@/types/safety-intelligence";
import {
  CATEGORY_ALIASES,
  CREATED_AT_ALIASES,
  DUE_AT_ALIASES,
  EVENT_AT_ALIASES,
  JOBSITE_ID_ALIASES,
  SEVERITY_ALIASES,
  SEVERITY_FIELD_ALIASES,
  SOURCE_ID_ALIASES,
  SOURCE_TYPE_ALIASES,
  SOURCE_TYPE_ALIASES_FIELDS,
  SUMMARY_ALIASES,
  TITLE_ALIASES,
  TRADE_ALIASES,
  VALID_FROM_ALIASES,
  VALID_TO_ALIASES,
  DESCRIPTION_ALIASES,
} from "@/lib/safety-intelligence/ingestion/constants";
import { isRecord } from "@/lib/safety-intelligence/validation/common";

type DateNormalizationResult = {
  iso: string | null;
  error: string | null;
};

function toSnakeCase(input: string) {
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function slugifyValue(value: string | null | undefined) {
  const next = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return next || null;
}

export function normalizeSourceType(value: unknown): SafetyIngestionSourceType {
  const slug = slugifyValue(typeof value === "string" ? value : null);
  return (slug && SOURCE_TYPE_ALIASES[slug]) || "other";
}

export function normalizeSeverity(value: unknown): StandardSeverity | null {
  if (value == null || String(value).trim() === "") {
    return "medium";
  }

  const slug = slugifyValue(String(value));
  return (slug && SEVERITY_ALIASES[slug]) || null;
}

export function normalizeDate(value: unknown): DateNormalizationResult {
  if (value == null || String(value).trim() === "") {
    return { iso: null, error: null };
  }

  const raw = String(value).trim();
  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw;
  const parsed = new Date(candidate);

  if (Number.isNaN(parsed.getTime())) {
    return { iso: null, error: `Invalid date value: ${raw}` };
  }

  return { iso: parsed.toISOString(), error: null };
}

export function normalizeObjectKeys(value: unknown): JsonObject {
  if (!isRecord(value)) {
    return {};
  }

  const next: JsonObject = {};
  for (const [key, currentValue] of Object.entries(value)) {
    const normalizedKey = toSnakeCase(key);
    next[normalizedKey] = normalizeJsonValue(currentValue);
  }
  return next;
}

function normalizeJsonValue(value: unknown): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }
  if (isRecord(value)) {
    return normalizeObjectKeys(value);
  }
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value as JsonValue;
  }
  return String(value);
}

export function getStringByAliases(record: JsonObject, aliases: string[]) {
  for (const alias of aliases) {
    const value = record[alias];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }
  return null;
}

export function getJsonObjectFromEnvelope(value: unknown) {
  const normalized = normalizeObjectKeys(value);
  const withoutPayload = { ...normalized };
  delete withoutPayload.payload;
  return withoutPayload;
}

export function getPayloadObject(value: unknown) {
  const normalized = normalizeObjectKeys(value);
  const payload = normalized.payload;
  if (isRecord(payload)) {
    return normalizeObjectKeys(payload);
  }
  return normalized;
}

export function extractCanonicalFields(record: JsonObject) {
  return {
    title: getStringByAliases(record, TITLE_ALIASES),
    summary: getStringByAliases(record, SUMMARY_ALIASES),
    description: getStringByAliases(record, DESCRIPTION_ALIASES),
    trade: slugifyValue(getStringByAliases(record, TRADE_ALIASES)),
    category: slugifyValue(getStringByAliases(record, CATEGORY_ALIASES)),
    sourceRecordId: getStringByAliases(record, SOURCE_ID_ALIASES),
    jobsiteId: getStringByAliases(record, JOBSITE_ID_ALIASES),
    sourceType: normalizeSourceType(getStringByAliases(record, SOURCE_TYPE_ALIASES_FIELDS) ?? record.source_type),
    severity: normalizeSeverity(getStringByAliases(record, SEVERITY_FIELD_ALIASES)),
  };
}

export function extractNormalizedDates(record: JsonObject) {
  const createdAt = normalizeDate(getStringByAliases(record, CREATED_AT_ALIASES));
  const eventAt = normalizeDate(getStringByAliases(record, EVENT_AT_ALIASES));
  const dueAt = normalizeDate(getStringByAliases(record, DUE_AT_ALIASES));
  const validFrom = normalizeDate(getStringByAliases(record, VALID_FROM_ALIASES));
  const validTo = normalizeDate(getStringByAliases(record, VALID_TO_ALIASES));

  return {
    createdAt,
    eventAt,
    dueAt,
    validFrom,
    validTo,
  };
}
