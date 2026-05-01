export const PREDICTION_VALIDATION_STATUSES = ["pending", "approved", "rejected"] as const;

export type PredictionValidationStatus = (typeof PREDICTION_VALIDATION_STATUSES)[number];

export const PREDICTION_REVIEW_RATING_MIN = 1;
export const PREDICTION_REVIEW_RATING_MAX = 5;
export const PREDICTION_REVIEW_BACKFILL_RATING = 3;

export function isPredictionValidationStatus(value: unknown): value is PredictionValidationStatus {
  return (
    typeof value === "string" &&
    (PREDICTION_VALIDATION_STATUSES as readonly string[]).includes(value.trim().toLowerCase())
  );
}

export function normalizePredictionValidationStatus(
  value: unknown,
  fallback: PredictionValidationStatus = "pending"
): PredictionValidationStatus {
  if (!isPredictionValidationStatus(value)) return fallback;
  return value.trim().toLowerCase() as PredictionValidationStatus;
}

export function normalizePredictionReviewRating(value: unknown): number | null {
  if (value == null || value === "") return null;
  const next = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(next)) return null;
  if (next < PREDICTION_REVIEW_RATING_MIN || next > PREDICTION_REVIEW_RATING_MAX) {
    return null;
  }
  return next;
}

export function normalizePredictionReviewTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    const tag = String(item ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (tag) seen.add(tag);
  }
  return [...seen].slice(0, 12);
}

export function isIncidentInjurySubtype(row: {
  category?: unknown;
  injury_type?: unknown;
  body_part?: unknown;
  days_away_from_work?: unknown;
  days_restricted?: unknown;
  lost_time?: unknown;
  fatality?: unknown;
}) {
  const category = String(row.category ?? "").trim().toLowerCase();
  return (
    category === "incident" ||
    Boolean(row.injury_type) ||
    Boolean(row.body_part) ||
    Number(row.days_away_from_work ?? 0) > 0 ||
    Number(row.days_restricted ?? 0) > 0 ||
    row.lost_time === true ||
    row.fatality === true
  );
}
