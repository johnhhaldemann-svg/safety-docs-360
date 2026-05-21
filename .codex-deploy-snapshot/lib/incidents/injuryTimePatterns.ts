/**
 * Time-based injury pattern dimensions derived from `occurred_at` (timestamptz).
 * Uses UTC for month, season, day-of-week, and time-of-day band so behavior is stable across servers.
 * Feeds year/seasonal analytics and injury-weather style models.
 */

export const INJURY_SEASONS = ["winter", "spring", "summer", "fall"] as const;
export type InjurySeason = (typeof INJURY_SEASONS)[number];

export const INJURY_DAYS_OF_WEEK = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
export type InjuryDayOfWeek = (typeof INJURY_DAYS_OF_WEEK)[number];

/** UTC hour buckets for pattern mining. */
export const INJURY_TIME_OF_DAY_BANDS = [
  "night",
  "early_morning",
  "morning",
  "afternoon",
  "evening",
] as const;
export type InjuryTimeOfDay = (typeof INJURY_TIME_OF_DAY_BANDS)[number];

export type InjuryTimePatternColumns = {
  injury_month: number | null;
  injury_season: InjurySeason | null;
  injury_day_of_week: InjuryDayOfWeek | null;
  injury_time_of_day: InjuryTimeOfDay | null;
};

function utcSeason(month1to12: number): InjurySeason {
  if (month1to12 === 12 || month1to12 <= 2) return "winter";
  if (month1to12 <= 5) return "spring";
  if (month1to12 <= 8) return "summer";
  return "fall";
}

function utcTimeOfDay(hour: number): InjuryTimeOfDay {
  if (hour >= 22 || hour < 5) return "night";
  if (hour < 8) return "early_morning";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/** Returns all-null pattern when `occurredAtIso` is empty or not parseable. */
export function injuryTimePatternFromOccurredAt(occurredAtIso: string | null): InjuryTimePatternColumns {
  if (!occurredAtIso?.trim()) {
    return {
      injury_month: null,
      injury_season: null,
      injury_day_of_week: null,
      injury_time_of_day: null,
    };
  }
  const d = new Date(occurredAtIso);
  if (Number.isNaN(d.getTime())) {
    return {
      injury_month: null,
      injury_season: null,
      injury_day_of_week: null,
      injury_time_of_day: null,
    };
  }
  const month = d.getUTCMonth() + 1;
  const dow = d.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const hour = d.getUTCHours();
  return {
    injury_month: month,
    injury_season: utcSeason(month),
    injury_day_of_week: INJURY_DAYS_OF_WEEK[dow],
    injury_time_of_day: utcTimeOfDay(hour),
  };
}

export const INJURY_SEASON_LABELS: Record<InjurySeason, string> = {
  winter: "Winter",
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
};

export const INJURY_TIME_OF_DAY_LABELS: Record<InjuryTimeOfDay, string> = {
  night: "Night",
  early_morning: "Early morning",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export function formatInjuryDayOfWeekLabel(dow: InjuryDayOfWeek): string {
  return dow.charAt(0).toUpperCase() + dow.slice(1);
}
