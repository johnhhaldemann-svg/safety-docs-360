export const BEHAVIOR_CATEGORY_CODES = [
  "procedure_not_followed",
  "communication_gap",
  "time_pressure",
  "inadequate_planning",
  "hazard_recognition",
  "housekeeping",
  "other",
] as const;

export type BehaviorCategoryCode = (typeof BEHAVIOR_CATEGORY_CODES)[number];

export const TRAINING_STATUS_CODES = ["current", "expired", "unknown", "not_required"] as const;
export type TrainingStatusCode = (typeof TRAINING_STATUS_CODES)[number];

export const SUPERVISION_STATUS_CODES = ["adequate", "inadequate", "absent", "unknown"] as const;
export type SupervisionStatusCode = (typeof SUPERVISION_STATUS_CODES)[number];

export const COST_IMPACT_BAND_CODES = ["none", "low", "medium", "high", "critical"] as const;
export type CostImpactBandCode = (typeof COST_IMPACT_BAND_CODES)[number];

const BEHAVIOR_SET = new Set<string>(BEHAVIOR_CATEGORY_CODES);
const TRAINING_SET = new Set<string>(TRAINING_STATUS_CODES);
const SUPERVISION_SET = new Set<string>(SUPERVISION_STATUS_CODES);
const COST_SET = new Set<string>(COST_IMPACT_BAND_CODES);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeBehaviorCategory(input: unknown): string | null {
  const v = String(input ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  return BEHAVIOR_SET.has(v) ? v : null;
}

export function normalizeTrainingStatus(input: unknown): string | null {
  const v = String(input ?? "").trim().toLowerCase();
  return TRAINING_SET.has(v) ? v : null;
}

export function normalizeSupervisionStatus(input: unknown): string | null {
  const v = String(input ?? "").trim().toLowerCase();
  return SUPERVISION_SET.has(v) ? v : null;
}

export function normalizeCostImpactBand(input: unknown): string | null {
  const v = String(input ?? "").trim().toLowerCase();
  return COST_SET.has(v) ? v : null;
}

export function parseForecastConfidence(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.min(1, Math.max(0, n));
  return clamped;
}

export function parseOptionalUuid(input: unknown): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  return UUID_RE.test(s) ? s.toLowerCase() : null;
}

export function parseContractorUuid(input: unknown): string | null {
  return parseOptionalUuid(input);
}

export function parseCrewUuid(input: unknown): string | null {
  return parseOptionalUuid(input);
}
