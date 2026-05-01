type ForecastSignalSource = "sor" | "corrective_action" | "incident";

type ForecastIntegritySignalRow = {
  source: ForecastSignalSource;
  sourceId?: string | null;
  tradeLabel: string;
  categoryLabel: string;
  created_at: string;
  severity: "low" | "medium" | "high" | "critical";
  status?: "open" | "closed";
  forecastIntegrity?: ForecastIntegrityMetadata;
};

export const FORECAST_DATA_BUCKETS = [
  "safety_observation",
  "near_miss",
  "incident",
  "first_aid",
  "recordable_injury",
  "property_damage",
  "corrective_action",
  "audit_finding",
  "jsa_quality",
  "permit_issue",
  "training_gap",
  "expired_credential",
  "trade_manpower",
  "high_risk_activity",
  "weather",
  "schedule_pressure",
  "repeated_hazard",
  "external_baseline",
] as const;

export type ForecastDataBucket = (typeof FORECAST_DATA_BUCKETS)[number];

export const FORECAST_TRUST_LEVELS = [
  "verified",
  "high_confidence",
  "medium_confidence",
  "low_confidence",
  "blocked",
] as const;

export type ForecastTrustLevel = (typeof FORECAST_TRUST_LEVELS)[number];

export type ForecastIntegrityStatus = "green" | "yellow" | "red" | "gray";

export type ForecastIntegrityMetadata = {
  bucket: ForecastDataBucket;
  trustLevel: ForecastTrustLevel;
  trustWeight: number;
  eligibleForForecast: boolean;
  confidenceScore: number;
  validationStatus: "pending" | "approved" | "rejected" | "unknown";
  reviewRating: number | null;
  missingRequiredFields: string[];
  exclusionReasons: string[];
  warnings: string[];
  duplicateKey: string;
};

export type ForecastIntegritySourceRecord = {
  source: ForecastSignalSource;
  bucket?: ForecastDataBucket;
  sourceId?: string | null;
  createdAt?: string | null;
  validationStatus?: string | null;
  reviewRating?: number | null;
  reviewedAt?: string | null;
  reviewTags?: string[] | null;
  status?: string | null;
  fields: Record<string, unknown>;
};

export type ForecastIntegritySummary = {
  status: ForecastIntegrityStatus;
  statusLabel: string;
  totalRecordsReviewed: number;
  includedForForecast: number;
  excludedFromForecast: number;
  verifiedRecords: number;
  highConfidenceRecords: number;
  mediumConfidenceRecords: number;
  lowConfidenceRecords: number;
  blockedRecords: number;
  verifiedPct: number;
  missingFieldRate: number;
  duplicateRate: number;
  oldUnverifiedRecords: number;
  openCorrectiveActions: number;
  forecastConfidencePct: number;
  trustLevelCounts: Record<ForecastTrustLevel, number>;
  bucketCounts: Partial<Record<ForecastDataBucket, number>>;
  exclusionReasonCounts: Record<string, number>;
  dataGapsByTrade: Array<{ label: string; missing: number }>;
  dataGapsByHazard: Array<{ label: string; missing: number }>;
};

const TRUST_WEIGHT: Record<ForecastTrustLevel, number> = {
  verified: 1,
  high_confidence: 1,
  medium_confidence: 0.65,
  low_confidence: 0,
  blocked: 0,
};

const BLOCKING_TAGS = new Set([
  "duplicate",
  "fake",
  "opinion_only",
  "rumor",
  "wrong_project",
  "wrong_region",
  "outdated",
  "medical_pii",
]);

function normalizedValidationStatus(value: unknown): ForecastIntegrityMetadata["validationStatus"] {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "pending" || s === "approved" || s === "rejected") return s;
  return "unknown";
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function hasValue(value: unknown): boolean {
  return clean(value).length > 0;
}

function ageDays(createdAt: string | null | undefined, asOf: Date): number | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((asOf.getTime() - d.getTime()) / 86400000));
}

function defaultBucketForSource(source: ForecastSignalSource): ForecastDataBucket {
  if (source === "corrective_action") return "corrective_action";
  if (source === "incident") return "incident";
  return "safety_observation";
}

function requiredFieldsFor(source: ForecastSignalSource): string[] {
  if (source === "incident") {
    return ["date", "category", "severity"];
  }
  if (source === "corrective_action") {
    return ["date", "category", "severity", "status"];
  }
  return ["date", "trade", "location", "category", "severity"];
}

function duplicateKeyFor(record: ForecastIntegritySourceRecord): string {
  const f = record.fields;
  const day = clean(f.date ?? record.createdAt).slice(0, 10);
  return [
    record.source,
    day,
    clean(f.project).toLowerCase(),
    clean(f.trade).toLowerCase(),
    clean(f.location).toLowerCase(),
    clean(f.category).toLowerCase(),
    clean(f.severity).toLowerCase(),
    clean(f.description ?? f.title).toLowerCase().slice(0, 80),
  ].join("|");
}

function trustLevelFromRecord(args: {
  validationStatus: ForecastIntegrityMetadata["validationStatus"];
  rating: number | null;
  reviewedAt?: string | null;
  missingRequiredFields: string[];
  warnings: string[];
  exclusionReasons: string[];
}): ForecastTrustLevel {
  if (args.exclusionReasons.length > 0) return "blocked";
  if (args.validationStatus !== "approved") return "low_confidence";
  if (args.missingRequiredFields.length >= 2) return "low_confidence";
  if (args.warnings.includes("historical_baseline_only")) return "low_confidence";
  if (args.rating != null && args.rating >= 5 && hasValue(args.reviewedAt)) return "verified";
  if (args.rating != null && args.rating >= 4) return "high_confidence";
  return "medium_confidence";
}

export function classifyForecastRecord(
  record: ForecastIntegritySourceRecord,
  options?: { asOf?: Date }
): ForecastIntegrityMetadata {
  const asOf = options?.asOf ?? new Date();
  const validationStatus = normalizedValidationStatus(record.validationStatus);
  const required = requiredFieldsFor(record.source);
  const fields: Record<string, unknown> = { ...record.fields, date: record.fields.date ?? record.createdAt };
  const missingRequiredFields = required.filter((field) => !hasValue(fields[field]));
  const warnings: string[] = [];
  const exclusionReasons: string[] = [];
  const tags = (record.reviewTags ?? []).map((tag) => clean(tag).toLowerCase());
  const rating =
    typeof record.reviewRating === "number" && Number.isFinite(record.reviewRating)
      ? record.reviewRating
      : null;
  const age = ageDays(record.createdAt, asOf);

  if (validationStatus === "rejected") exclusionReasons.push("review_rejected");
  for (const tag of tags) {
    if (BLOCKING_TAGS.has(tag)) exclusionReasons.push(`tag_${tag}`);
  }
  if (!hasValue(fields.date)) exclusionReasons.push("missing_date");
  if (!hasValue(fields.category)) exclusionReasons.push("missing_hazard_category");
  if (record.source === "sor" && !hasValue(fields.trade)) exclusionReasons.push("missing_trade");
  if (age != null && age > 365) warnings.push("historical_baseline_only");
  if (missingRequiredFields.length > 0) warnings.push("missing_required_fields");
  if (record.source === "corrective_action" && clean(record.status).toLowerCase() !== "closed") {
    warnings.push("open_corrective_action");
  }

  const trustLevel = trustLevelFromRecord({
    validationStatus,
    rating,
    reviewedAt: record.reviewedAt,
    missingRequiredFields,
    warnings,
    exclusionReasons,
  });
  const trustWeight = TRUST_WEIGHT[trustLevel];
  const eligibleForForecast =
    trustLevel === "verified" || trustLevel === "high_confidence" || trustLevel === "medium_confidence";
  const missingPenalty = Math.min(30, missingRequiredFields.length * 10);
  const warningPenalty = Math.min(20, warnings.length * 5);
  const confidenceScore = Math.max(0, Math.round(trustWeight * 100 - missingPenalty - warningPenalty));

  return {
    bucket: record.bucket ?? defaultBucketForSource(record.source),
    trustLevel,
    trustWeight,
    eligibleForForecast,
    confidenceScore,
    validationStatus,
    reviewRating: rating,
    missingRequiredFields,
    exclusionReasons,
    warnings,
    duplicateKey: duplicateKeyFor(record),
  };
}

export function applyDuplicateIntegrityRules<T extends ForecastIntegritySignalRow>(rows: T[]): T[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const meta = row.forecastIntegrity;
    if (!meta) return row;
    const seenCount = seen.get(meta.duplicateKey) ?? 0;
    seen.set(meta.duplicateKey, seenCount + 1);
    if (seenCount === 0) return row;
    const next: ForecastIntegrityMetadata = {
      ...meta,
      trustLevel: "blocked",
      trustWeight: 0,
      eligibleForForecast: false,
      confidenceScore: 0,
      exclusionReasons: [...new Set([...meta.exclusionReasons, "duplicate_record"])],
      warnings: [...new Set([...meta.warnings, "duplicate_record"])],
    };
    return { ...row, forecastIntegrity: next };
  });
}

export function filterForecastEligibleRows<T extends ForecastIntegritySignalRow>(rows: T[]): T[] {
  return rows.filter((row) => row.forecastIntegrity?.eligibleForForecast !== false);
}

function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 100);
}

function topMissingBy(
  rows: ForecastIntegritySignalRow[],
  selector: (row: ForecastIntegritySignalRow) => string
): Array<{ label: string; missing: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const missing = row.forecastIntegrity?.missingRequiredFields.length ?? 0;
    if (missing <= 0) continue;
    const label = selector(row).trim() || "Unknown";
    counts.set(label, (counts.get(label) ?? 0) + missing);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, missing]) => ({ label, missing }));
}

export function buildForecastIntegritySummary(rows: ForecastIntegritySignalRow[]): ForecastIntegritySummary {
  const total = rows.length;
  const trustLevelCounts: Record<ForecastTrustLevel, number> = {
    verified: 0,
    high_confidence: 0,
    medium_confidence: 0,
    low_confidence: 0,
    blocked: 0,
  };
  const bucketCounts: Partial<Record<ForecastDataBucket, number>> = {};
  const exclusionReasonCounts: Record<string, number> = {};
  let included = 0;
  let duplicateRecords = 0;
  let oldUnverifiedRecords = 0;
  let openCorrectiveActions = 0;
  let confidenceSum = 0;

  for (const row of rows) {
    const meta = row.forecastIntegrity;
    if (!meta) continue;
    trustLevelCounts[meta.trustLevel] += 1;
    bucketCounts[meta.bucket] = (bucketCounts[meta.bucket] ?? 0) + 1;
    if (meta.eligibleForForecast) included += 1;
    confidenceSum += meta.confidenceScore;
    if (meta.exclusionReasons.includes("duplicate_record")) duplicateRecords += 1;
    if (meta.warnings.includes("historical_baseline_only") && meta.trustLevel !== "verified") {
      oldUnverifiedRecords += 1;
    }
    if (row.source === "corrective_action" && row.status !== "closed") {
      openCorrectiveActions += 1;
    }
    for (const reason of meta.exclusionReasons) {
      exclusionReasonCounts[reason] = (exclusionReasonCounts[reason] ?? 0) + 1;
    }
  }

  const blocked = trustLevelCounts.blocked;
  const low = trustLevelCounts.low_confidence;
  const verified = trustLevelCounts.verified;
  const forecastConfidencePct = total > 0 ? Math.round(confidenceSum / total) : 0;
  const missingFieldRate = pct(rows.filter((row) => (row.forecastIntegrity?.missingRequiredFields.length ?? 0) > 0).length, total);
  const duplicateRate = pct(duplicateRecords, total);
  const verifiedPct = pct(verified + trustLevelCounts.high_confidence, total);

  let status: ForecastIntegrityStatus = "gray";
  if (total > 0) {
    if (included === 0 || blocked / total >= 0.45 || forecastConfidencePct < 50) status = "red";
    else if (forecastConfidencePct >= 78 && verifiedPct >= 45 && missingFieldRate <= 15) status = "green";
    else status = "yellow";
  }

  const statusLabel =
    status === "green"
      ? "Enough verified data to forecast"
      : status === "yellow"
        ? "Forecast available but limited"
        : status === "red"
          ? "Not enough reliable data"
          : "No active data source";

  return {
    status,
    statusLabel,
    totalRecordsReviewed: total,
    includedForForecast: included,
    excludedFromForecast: Math.max(0, total - included),
    verifiedRecords: verified,
    highConfidenceRecords: trustLevelCounts.high_confidence,
    mediumConfidenceRecords: trustLevelCounts.medium_confidence,
    lowConfidenceRecords: low,
    blockedRecords: blocked,
    verifiedPct,
    missingFieldRate,
    duplicateRate,
    oldUnverifiedRecords,
    openCorrectiveActions,
    forecastConfidencePct,
    trustLevelCounts,
    bucketCounts,
    exclusionReasonCounts,
    dataGapsByTrade: topMissingBy(rows, (row) => row.tradeLabel),
    dataGapsByHazard: topMissingBy(rows, (row) => row.categoryLabel),
  };
}

export function dataConfidenceFromIntegrity(
  summary: ForecastIntegritySummary,
  fallback: "LOW" | "MEDIUM" | "HIGH"
): "LOW" | "MEDIUM" | "HIGH" {
  if (summary.status === "gray" || summary.status === "red") return "LOW";
  if (summary.status === "green") return fallback === "LOW" ? "MEDIUM" : "HIGH";
  return fallback === "HIGH" ? "MEDIUM" : fallback;
}
