export type FieldIssueCategory =
  | "hazard"
  | "near_miss"
  | "incident"
  | "good_catch"
  | "ppe_violation"
  | "housekeeping"
  | "equipment_issue"
  | "fall_hazard"
  | "electrical_hazard"
  | "excavation_trench_concern"
  | "fire_hot_work_concern"
  | "corrective_action";

export type FieldIssueStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "corrected"
  | "verified_closed"
  | "escalated"
  | "stop_work";

export type FieldIssueSeverity = "low" | "medium" | "high" | "critical";

export type TrendGranularity = "week" | "month";

export type AnalyticsStatusKey = FieldIssueStatus | "overdue";

export type AnalyticsRange = {
  startMs: number;
  endMs: number;
};

export type FieldIssueAnalyticsItem = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  category: FieldIssueCategory;
  status: FieldIssueStatus;
  severity: FieldIssueSeverity;
  due_at: string | null;
  created_at: string;
  closed_at: string | null;
};

export type AnalyticsKpi = {
  title: string;
  value: string;
  note: string;
};

export type AnalyticsCountRow<T extends string> = {
  key: T;
  count: number;
};

export type AnalyticsTrendPoint = {
  key: string;
  label: string;
  created: number;
  closed: number;
  openBacklog: number;
};

export type AnalyticsMatrixRow = {
  category: FieldIssueCategory;
  open: number;
  assigned: number;
  inProgress: number;
  corrected: number;
  verifiedClosed: number;
  overdue: number;
  escalated: number;
  stopWork: number;
  total: number;
};

export type RepeatIssueSummary = {
  totalRepeatIssues: number;
  repeatedCategories: Array<{ key: FieldIssueCategory; count: number }>;
  repeatedLocations: Array<{ label: string; count: number }>;
  repeatedCompanies: Array<{ label: string; count: number }>;
};

export type ResponsibleCompanyRow = {
  label: string;
  total: number;
  openBacklog: number;
  overdue: number;
  verifiedClosed: number;
};

export type FieldIssueAnalyticsResult = {
  range: AnalyticsRange;
  metricsItems: FieldIssueAnalyticsItem[];
  totalIssues: number;
  openBacklogCount: number;
  overdueCount: number;
  highCriticalCount: number;
  verifiedClosedCount: number;
  closureRate: number;
  averageDaysToClose: number;
  repeatIssueCount: number;
  kpis: AnalyticsKpi[];
  statusCounts: AnalyticsCountRow<AnalyticsStatusKey>[];
  categoryCounts: AnalyticsCountRow<FieldIssueCategory>[];
  severityCounts: AnalyticsCountRow<FieldIssueSeverity>[];
  overdueAgingCounts: Array<{ key: "1_3" | "4_7" | "8_14" | "15_plus"; count: number }>;
  locationCounts: Array<{ label: string; count: number }>;
  companyRows: ResponsibleCompanyRow[];
  trendPoints: AnalyticsTrendPoint[];
  matrixRows: AnalyticsMatrixRow[];
  matrixTotals: Omit<AnalyticsMatrixRow, "category"> & { category: "total" };
  repeatSummary: RepeatIssueSummary;
};

export const FIELD_ISSUE_CATEGORY_ORDER: FieldIssueCategory[] = [
  "hazard",
  "near_miss",
  "incident",
  "good_catch",
  "ppe_violation",
  "housekeeping",
  "equipment_issue",
  "fall_hazard",
  "electrical_hazard",
  "excavation_trench_concern",
  "fire_hot_work_concern",
  "corrective_action",
];

export const FIELD_ISSUE_STATUS_ORDER: FieldIssueStatus[] = [
  "open",
  "assigned",
  "in_progress",
  "corrected",
  "verified_closed",
  "escalated",
  "stop_work",
];

export const ANALYTICS_STATUS_ORDER: AnalyticsStatusKey[] = [
  "open",
  "assigned",
  "in_progress",
  "corrected",
  "verified_closed",
  "overdue",
  "escalated",
  "stop_work",
];

export const SEVERITY_ORDER: FieldIssueSeverity[] = ["low", "medium", "high", "critical"];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function endOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function parseDateInput(value: string, endOfDay: boolean): number | null {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return endOfDay ? endOfLocalDay(date.getTime()) : startOfLocalDay(date.getTime());
}

function getLocationLabel(item: FieldIssueAnalyticsItem, jobsiteNameById: ReadonlyMap<string, string>): string {
  if (!item.jobsite_id) return "General Workspace";
  return jobsiteNameById.get(item.jobsite_id) ?? "General Workspace";
}

function getClosedTimestamp(item: FieldIssueAnalyticsItem): number | null {
  if (!item.closed_at) return null;
  const timestamp = new Date(item.closed_at).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function isOverdue(item: Pick<FieldIssueAnalyticsItem, "status" | "due_at">, referenceTime: number): boolean {
  if (item.status === "verified_closed" || !item.due_at) return false;
  const dueAt = new Date(item.due_at).getTime();
  return !Number.isNaN(dueAt) && dueAt < referenceTime;
}

export function averageDaysToClose(items: readonly FieldIssueAnalyticsItem[]): number {
  const closeDurations = items
    .map((item) => {
      if (item.status !== "verified_closed") return null;
      const createdAt = new Date(item.created_at).getTime();
      const closedAt = getClosedTimestamp(item);
      if (Number.isNaN(createdAt) || closedAt === null) return null;
      return Math.max(0, (closedAt - createdAt) / MS_PER_DAY);
    })
    .filter((value): value is number => value !== null);

  if (closeDurations.length < 1) return 0;
  return closeDurations.reduce((sum, value) => sum + value, 0) / closeDurations.length;
}

export function buildAnalyticsRange(params: {
  startDate: string;
  endDate: string;
  referenceTime: number;
}): AnalyticsRange {
  const fallbackEnd = endOfLocalDay(params.referenceTime);
  const fallbackStart = startOfLocalDay(params.referenceTime - 89 * MS_PER_DAY);
  const parsedStart = parseDateInput(params.startDate, false) ?? fallbackStart;
  const parsedEnd = parseDateInput(params.endDate, true) ?? fallbackEnd;

  if (parsedStart <= parsedEnd) {
    return { startMs: parsedStart, endMs: parsedEnd };
  }

  return { startMs: startOfLocalDay(parsedEnd), endMs: endOfLocalDay(parsedStart) };
}

function isInRange(timestampValue: string, range: AnalyticsRange): boolean {
  const timestamp = new Date(timestampValue).getTime();
  if (Number.isNaN(timestamp)) return false;
  return timestamp >= range.startMs && timestamp <= range.endMs;
}

function countOpenBacklog(items: readonly FieldIssueAnalyticsItem[]): number {
  return items.filter(
    (item) =>
      item.status === "open" ||
      item.status === "assigned" ||
      item.status === "in_progress" ||
      item.status === "corrected"
  ).length;
}

function countByStatus(items: readonly FieldIssueAnalyticsItem[], status: AnalyticsStatusKey, referenceTime: number): number {
  if (status === "overdue") {
    return items.filter((item) => isOverdue(item, referenceTime)).length;
  }
  return items.filter((item) => item.status === status).length;
}

function makeCountRows<T extends string>(
  keys: readonly T[],
  countForKey: (key: T) => number
): AnalyticsCountRow<T>[] {
  return keys.map((key) => ({ key, count: countForKey(key) }));
}

function sortCountRows<T extends string>(rows: AnalyticsCountRow<T>[]): AnalyticsCountRow<T>[] {
  return [...rows]
    .sort((left, right) => right.count - left.count || String(left.key).localeCompare(String(right.key)));
}

function buildOverdueAgingCounts(items: readonly FieldIssueAnalyticsItem[], referenceTime: number) {
  const buckets = {
    "1_3": 0,
    "4_7": 0,
    "8_14": 0,
    "15_plus": 0,
  };

  for (const item of items) {
    if (!isOverdue(item, referenceTime) || !item.due_at) continue;
    const dueAt = new Date(item.due_at).getTime();
    if (Number.isNaN(dueAt)) continue;
    const daysOverdue = Math.max(1, Math.floor((referenceTime - dueAt) / MS_PER_DAY));
    if (daysOverdue <= 3) {
      buckets["1_3"] += 1;
    } else if (daysOverdue <= 7) {
      buckets["4_7"] += 1;
    } else if (daysOverdue <= 14) {
      buckets["8_14"] += 1;
    } else {
      buckets["15_plus"] += 1;
    }
  }

  return [
    { key: "1_3" as const, count: buckets["1_3"] },
    { key: "4_7" as const, count: buckets["4_7"] },
    { key: "8_14" as const, count: buckets["8_14"] },
    { key: "15_plus" as const, count: buckets["15_plus"] },
  ];
}

function startOfWeek(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + shift);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfMonth(timestamp: number): number {
  const date = new Date(timestamp);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function addBucket(timestamp: number, granularity: TrendGranularity): number {
  const date = new Date(timestamp);
  if (granularity === "month") {
    date.setMonth(date.getMonth() + 1, 1);
  } else {
    date.setDate(date.getDate() + 7);
  }
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatBucketLabel(timestamp: number, granularity: TrendGranularity): string {
  const date = new Date(timestamp);
  if (granularity === "month") {
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function normalizeBucketStart(timestamp: number, granularity: TrendGranularity): number {
  return granularity === "month" ? startOfMonth(timestamp) : startOfWeek(timestamp);
}

function buildTrendPoints(params: {
  items: readonly FieldIssueAnalyticsItem[];
  sourceItems: readonly FieldIssueAnalyticsItem[];
  range: AnalyticsRange;
  granularity: TrendGranularity;
}): AnalyticsTrendPoint[] {
  const bucketStarts: number[] = [];
  let cursor = normalizeBucketStart(params.range.startMs, params.granularity);
  while (cursor <= params.range.endMs) {
    bucketStarts.push(cursor);
    cursor = addBucket(cursor, params.granularity);
  }

  if (bucketStarts.length < 1) {
    bucketStarts.push(normalizeBucketStart(params.range.startMs, params.granularity));
  }

  return bucketStarts.map((bucketStart) => {
    const nextBucketStart = addBucket(bucketStart, params.granularity);
    const bucketEnd = Math.min(nextBucketStart - 1, params.range.endMs);
    const created = params.items.filter((item) => {
      const createdAt = new Date(item.created_at).getTime();
      return !Number.isNaN(createdAt) && createdAt >= bucketStart && createdAt <= bucketEnd;
    }).length;
    const closed = params.items.filter((item) => {
      const closedAt = getClosedTimestamp(item);
      return closedAt !== null && closedAt >= bucketStart && closedAt <= bucketEnd;
    }).length;
    const openBacklog = params.sourceItems.filter((item) => {
      const createdAt = new Date(item.created_at).getTime();
      const closedAt = getClosedTimestamp(item);
      if (Number.isNaN(createdAt) || createdAt > bucketEnd) return false;
      return closedAt === null || closedAt > bucketEnd;
    }).length;

    return {
      key: String(bucketStart),
      label: formatBucketLabel(bucketStart, params.granularity),
      created,
      closed,
      openBacklog,
    };
  });
}

function buildMatrixRows(items: readonly FieldIssueAnalyticsItem[], referenceTime: number): AnalyticsMatrixRow[] {
  return FIELD_ISSUE_CATEGORY_ORDER.map((category) => {
    const categoryItems = items.filter((item) => item.category === category);
    return {
      category,
      open: categoryItems.filter((item) => item.status === "open").length,
      assigned: categoryItems.filter((item) => item.status === "assigned").length,
      inProgress: categoryItems.filter((item) => item.status === "in_progress").length,
      corrected: categoryItems.filter((item) => item.status === "corrected").length,
      verifiedClosed: categoryItems.filter((item) => item.status === "verified_closed").length,
      overdue: categoryItems.filter((item) => isOverdue(item, referenceTime)).length,
      escalated: categoryItems.filter((item) => item.status === "escalated").length,
      stopWork: categoryItems.filter((item) => item.status === "stop_work").length,
      total: categoryItems.length,
    };
  });
}

function buildMatrixTotals(rows: readonly AnalyticsMatrixRow[]) {
  return rows.reduce(
    (totals, row) => ({
      category: "total" as const,
      open: totals.open + row.open,
      assigned: totals.assigned + row.assigned,
      inProgress: totals.inProgress + row.inProgress,
      corrected: totals.corrected + row.corrected,
      verifiedClosed: totals.verifiedClosed + row.verifiedClosed,
      overdue: totals.overdue + row.overdue,
      escalated: totals.escalated + row.escalated,
      stopWork: totals.stopWork + row.stopWork,
      total: totals.total + row.total,
    }),
    {
      category: "total" as const,
      open: 0,
      assigned: 0,
      inProgress: 0,
      corrected: 0,
      verifiedClosed: 0,
      overdue: 0,
      escalated: 0,
      stopWork: 0,
      total: 0,
    }
  );
}

function buildRepeatSummary(
  items: readonly FieldIssueAnalyticsItem[],
  companyLabel: string,
  jobsiteNameById: ReadonlyMap<string, string>
): RepeatIssueSummary {
  const categoryLocationCounts = new Map<string, number>();
  const categoryCompanyCounts = new Map<string, number>();

  for (const item of items) {
    const locationLabel = getLocationLabel(item, jobsiteNameById);
    const locationKey = `${item.category}::${locationLabel}`;
    categoryLocationCounts.set(locationKey, (categoryLocationCounts.get(locationKey) ?? 0) + 1);
    const companyKey = `${item.category}::${companyLabel}`;
    categoryCompanyCounts.set(companyKey, (categoryCompanyCounts.get(companyKey) ?? 0) + 1);
  }

  const repeatedCategoryCounts = new Map<FieldIssueCategory, number>();
  const repeatedLocationCounts = new Map<string, number>();
  const repeatedCompanyCounts = new Map<string, number>();
  let totalRepeatIssues = 0;

  for (const item of items) {
    const locationLabel = getLocationLabel(item, jobsiteNameById);
    const locationKey = `${item.category}::${locationLabel}`;
    const companyKey = `${item.category}::${companyLabel}`;
    const isRepeat =
      (categoryLocationCounts.get(locationKey) ?? 0) > 1 ||
      (categoryCompanyCounts.get(companyKey) ?? 0) > 1;

    if (!isRepeat) continue;

    totalRepeatIssues += 1;
    repeatedCategoryCounts.set(item.category, (repeatedCategoryCounts.get(item.category) ?? 0) + 1);

    if ((categoryLocationCounts.get(locationKey) ?? 0) > 1) {
      repeatedLocationCounts.set(locationLabel, (repeatedLocationCounts.get(locationLabel) ?? 0) + 1);
    }
    if ((categoryCompanyCounts.get(companyKey) ?? 0) > 1) {
      repeatedCompanyCounts.set(companyLabel, (repeatedCompanyCounts.get(companyLabel) ?? 0) + 1);
    }
  }

  return {
    totalRepeatIssues,
    repeatedCategories: [...repeatedCategoryCounts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key)),
    repeatedLocations: [...repeatedLocationCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
    repeatedCompanies: [...repeatedCompanyCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
  };
}

export function buildFieldIssueAnalytics(params: {
  items: readonly FieldIssueAnalyticsItem[];
  sourceItems?: readonly FieldIssueAnalyticsItem[];
  jobsiteNameById: ReadonlyMap<string, string>;
  companyLabel: string;
  referenceTime: number;
  startDate: string;
  endDate: string;
  trendGranularity: TrendGranularity;
}): FieldIssueAnalyticsResult {
  const range = buildAnalyticsRange({
    startDate: params.startDate,
    endDate: params.endDate,
    referenceTime: params.referenceTime,
  });
  const sourceItems = params.sourceItems ?? params.items;
  const metricsItems = params.items.filter((item) => isInRange(item.created_at, range));
  const totalIssues = metricsItems.length;
  const openBacklogCount = countOpenBacklog(metricsItems);
  const overdueCount = metricsItems.filter((item) => isOverdue(item, params.referenceTime)).length;
  const highCriticalCount = metricsItems.filter(
    (item) => item.severity === "high" || item.severity === "critical"
  ).length;
  const verifiedClosedCount = metricsItems.filter((item) => item.status === "verified_closed").length;
  const closureRate = totalIssues > 0 ? verifiedClosedCount / totalIssues : 0;
  const averageCloseDays = averageDaysToClose(metricsItems);
  const repeatSummary = buildRepeatSummary(metricsItems, params.companyLabel, params.jobsiteNameById);
  const statusCounts = makeCountRows(ANALYTICS_STATUS_ORDER, (status) =>
    countByStatus(metricsItems, status, params.referenceTime)
  );
  const categoryCounts = sortCountRows(
    makeCountRows(FIELD_ISSUE_CATEGORY_ORDER, (category) =>
      metricsItems.filter((item) => item.category === category).length
    )
  );
  const severityCounts = makeCountRows(SEVERITY_ORDER, (severity) =>
    metricsItems.filter((item) => item.severity === severity).length
  );
  const overdueAgingCounts = buildOverdueAgingCounts(metricsItems, params.referenceTime);

  const locationMap = new Map<string, number>();
  for (const item of metricsItems) {
    const label = getLocationLabel(item, params.jobsiteNameById);
    locationMap.set(label, (locationMap.get(label) ?? 0) + 1);
  }

  const rankedLocations = [...locationMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  const companyRows: ResponsibleCompanyRow[] = [
    {
      label: params.companyLabel,
      total: totalIssues,
      openBacklog: openBacklogCount,
      overdue: overdueCount,
      verifiedClosed: verifiedClosedCount,
    },
  ];

  const trendPoints = buildTrendPoints({
    items: metricsItems,
    sourceItems,
    range,
    granularity: params.trendGranularity,
  });

  const matrixRows = buildMatrixRows(metricsItems, params.referenceTime);
  const matrixTotals = buildMatrixTotals(matrixRows);

  return {
    range,
    metricsItems,
    totalIssues,
    openBacklogCount,
    overdueCount,
    highCriticalCount,
    verifiedClosedCount,
    closureRate,
    averageDaysToClose: averageCloseDays,
    repeatIssueCount: repeatSummary.totalRepeatIssues,
    kpis: [
      {
        title: "Total Issues",
        value: String(totalIssues),
        note: "All filtered issues opened in the selected time period.",
      },
      {
        title: "Open Backlog",
        value: String(openBacklogCount),
        note: "Open, assigned, in-progress, and corrected items still in play.",
      },
      {
        title: "Overdue Items",
        value: String(overdueCount),
        note: "Due dates already passed and not verified closed.",
      },
      {
        title: "High/Critical Issues",
        value: String(highCriticalCount),
        note: "Elevated-severity issues needing tighter follow-up.",
      },
      {
        title: "Verified Closed",
        value: String(verifiedClosedCount),
        note: "Items fully verified closed in the filtered period.",
      },
      {
        title: "Closure Rate",
        value: `${Math.round(closureRate * 100)}%`,
        note: "Verified Closed divided by Total Issues.",
      },
      {
        title: "Average Days to Close",
        value: `${averageCloseDays.toFixed(1)} days`,
        note: "Average elapsed days from open date to verified close date.",
      },
      {
        title: "Repeat Issues",
        value: String(repeatSummary.totalRepeatIssues),
        note: "Same category paired with the same location or company more than once.",
      },
    ],
    statusCounts,
    categoryCounts,
    severityCounts,
    overdueAgingCounts,
    locationCounts: rankedLocations,
    companyRows,
    trendPoints,
    matrixRows,
    matrixTotals,
    repeatSummary,
  };
}
