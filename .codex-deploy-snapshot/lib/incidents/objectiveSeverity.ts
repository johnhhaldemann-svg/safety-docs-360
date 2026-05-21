/**
 * Objective incident classification (OSHA / recordkeeping), separate from subjective `severity` (low–critical).
 * API: recordable, lostTime, fatality → DB: recordable, lost_time, fatality.
 */

export function readObjectiveFlag(input: unknown, defaultValue = false): boolean {
  if (typeof input === "boolean") return input;
  return defaultValue;
}
