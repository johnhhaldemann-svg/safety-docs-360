import { DYNAMIC_INJURY_FORECAST } from "./constants";
import type { FatigueScheduleInput, LayerOutput } from "./types";

const F = DYNAMIC_INJURY_FORECAST.FATIGUE;

/**
 * Fatigue / schedule multiplier: long shifts, heavy weeks, night work, and long streaks add incremental risk.
 */
export function computeFatigueMultiplier(input: FatigueScheduleInput): LayerOutput<Record<string, boolean>> {
  let m = 1;
  const flags: Record<string, boolean> = {};
  if (input.avgShiftHours > F.LONG_SHIFT_THRESHOLD) {
    m += F.LONG_SHIFT_BUMP;
    flags.longShift = true;
  }
  if (input.avgWeeklyHours > F.HIGH_WEEKLY_THRESHOLD) {
    m += F.HIGH_WEEKLY_BUMP;
    flags.heavyWeek = true;
  }
  if (input.nightShift) {
    m += F.NIGHT_BUMP;
    flags.night = true;
  }
  if (input.consecutiveDaysWorked >= F.CONSEC_DAYS_THRESHOLD) {
    m += F.CONSEC_BUMP;
    flags.longStreak = true;
  }
  if (input.overtimeHeavy) {
    m += F.HIGH_WEEKLY_BUMP * 0.5;
    flags.overtime = true;
  }
  const value = Math.min(F.MAX_MULT, m);
  return {
    value,
    detail: `Schedule stress bumps → fatigue multiplier ${value.toFixed(3)}.`,
    raw: flags,
  };
}
