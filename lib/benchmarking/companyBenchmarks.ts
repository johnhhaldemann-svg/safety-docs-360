/**
 * Company benchmarking fields (NAICS + reference injury rates for industry/trade comparisons).
 * Rates are typically expressed as injuries per 100 FTE per year (BLS-style); callers may use other units if consistent.
 */

/** NAICS: 2–6 digits, digits only in storage. */
export function normalizeIndustryCode(input: unknown): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 2 || digits.length > 6) return null;
  return digits;
}

/** Non-negative finite rate, or null to clear. */
export function parseBenchmarkRate(input: unknown): number | null {
  if (input === null || input === "") return null;
  const n = typeof input === "number" ? input : Number(String(input).trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Non-negative finite exposure hours, or null to clear. */
export function parseHoursWorked(input: unknown): number | null {
  if (input === null || input === "") return null;
  const n = typeof input === "number" ? input : Number(String(input).trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
