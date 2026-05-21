/**
 * Single numeric severity score from DART-style outcomes (separate from subjective `severity` band).
 * Higher = worse. Fatality dominates.
 */
export function injurySeverityScore(input: {
  daysAwayFromWork: number;
  daysRestricted: number;
  lostTime: boolean;
  fatality: boolean;
}): number {
  if (input.fatality) return 100_000 + input.daysAwayFromWork * 10 + input.daysRestricted;
  let s = 0;
  s += Math.min(5_000, input.daysAwayFromWork * 12);
  s += Math.min(2_000, input.daysRestricted * 6);
  if (input.lostTime) s += 80;
  return s;
}
