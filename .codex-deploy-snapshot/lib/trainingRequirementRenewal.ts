const MAX_RENEWAL_MONTHS = 600;

/**
 * Normalize API `renewalMonths` for DB.
 * - create: undefined / invalid → null
 * - patch: undefined → leave column unchanged; null / "" → clear
 */
export function normalizeRenewalMonths(
  value: unknown,
  mode: "create" | "patch"
): number | null | undefined {
  if (mode === "patch" && value === undefined) {
    return undefined;
  }
  if (value === null || value === "") {
    return null;
  }
  if (value === undefined) {
    return null;
  }
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 1 || n > MAX_RENEWAL_MONTHS) {
    return null;
  }
  return Math.round(n);
}
