/**
 * DART-related incident fields (days away, restricted duty, job transfer).
 * API: daysAwayFromWork, daysRestricted, jobTransfer → DB: snake_case columns.
 */

export function coerceNonNegativeInt(input: unknown): { ok: true; value: number } | { ok: false; message: string } {
  if (input === null || input === undefined || input === "") {
    return { ok: true, value: 0 };
  }
  const n = typeof input === "number" ? input : Number(String(input).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    return { ok: false, message: "Must be a non-negative whole number." };
  }
  return { ok: true, value: n };
}

export function readJobTransfer(input: unknown, defaultValue: boolean): boolean {
  if (input === undefined) return defaultValue;
  if (typeof input === "boolean") return input;
  return defaultValue;
}
