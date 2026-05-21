const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseDayUtc(value?: string | null): Date | null {
  if (!value || !ISO_DAY.test(value.trim())) return null;
  const d = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function utcDayEnd(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function startOfYearUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
}

/**
 * Resolves dashboard overview date window from URL-style params (used by `/api/dashboard/overview`).
 */
export function resolveOverviewDateParams(input: {
  range?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}): { startDate: string; endDate: string } {
  const range = (input.range ?? "").trim().toLowerCase();
  const customStart = parseDayUtc(input.startDate);
  const customEnd = parseDayUtc(input.endDate);

  if (range === "custom" && customStart && customEnd) {
    const a = customStart.getTime();
    const b = customEnd.getTime();
    const lo = a <= b ? customStart : customEnd;
    const hi = a <= b ? customEnd : customStart;
    return { startDate: lo.toISOString().slice(0, 10), endDate: hi.toISOString().slice(0, 10) };
  }

  const end = utcDayEnd(new Date());
  let start: Date;
  if (range === "7d" || range === "last7" || range === "last_7_days") {
    start = utcDayStart(new Date(end.getTime() - 7 * 86400000));
  } else if (range === "30d" || range === "last30" || range === "last_30_days") {
    start = utcDayStart(new Date(end.getTime() - 30 * 86400000));
  } else if (range === "90d" || range === "last90" || range === "last_90_days") {
    start = utcDayStart(new Date(end.getTime() - 90 * 86400000));
  } else if (range === "ytd" || range === "year_to_date") {
    start = startOfYearUtc(end);
  } else {
    start = utcDayStart(new Date(end.getTime() - 90 * 86400000));
  }

  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}
