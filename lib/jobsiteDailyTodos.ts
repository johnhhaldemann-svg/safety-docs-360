export type JobsiteDailyTodoRole = "pm" | "sl";
export type JobsiteDailyTodoStatus = "open" | "reviewed" | "completed" | "closed_out";
export type JobsiteDailyTodoPriority = "low" | "medium" | "high" | "critical";

export type JobsiteDailyTodoTargetTab =
  | "Overview"
  | "Predictive Risk"
  | "Corrective Actions"
  | "Workforce"
  | "Schedule"
  | "Permits"
  | "Inspections"
  | "Incidents & Observations"
  | "Documents & Reports"
  | "Activity Timeline";

export type JobsiteDailyTodoInput = {
  jobsiteId: string;
  jobsiteName: string;
  workDate: string;
  riskLevel: JobsiteDailyTodoPriority;
  firstScheduleRiskTitle?: string | null;
  highRiskScheduleCount: number;
  openActionsCount: number;
  overdueActionsCount: number;
  permitBlockerCount: number;
  inspectionGapCount: number;
  readyReportCount: number;
  workforceGapCount: number;
};

export type JobsiteDailyTodoItem = {
  id: string;
  sourceKey: string;
  role: JobsiteDailyTodoRole;
  title: string;
  detail: string;
  status: JobsiteDailyTodoStatus;
  priority: JobsiteDailyTodoPriority;
  targetTab: JobsiteDailyTodoTargetTab;
  targetHref?: string;
};

export type LocalDailyDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
};

const DEFAULT_TIME_ZONE = "America/Chicago";

function twoDigit(value: number) {
  return String(value).padStart(2, "0");
}

function addDays(dateOnly: string, days: number) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getLocalDailyDateParts(now: Date, timeZone = DEFAULT_TIME_ZONE): LocalDailyDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
  };
}

export function getDailyTodoWorkDate(
  now = new Date(),
  options: { timeZone?: string; resetHour?: number } = {}
) {
  const resetHour = options.resetHour ?? 5;
  const parts = getLocalDailyDateParts(now, options.timeZone ?? DEFAULT_TIME_ZONE);
  const localDate = `${parts.year}-${twoDigit(parts.month)}-${twoDigit(parts.day)}`;
  return parts.hour < resetHour ? addDays(localDate, -1) : localDate;
}

export function dailyTodoResetLabel(resetHour = 5) {
  const suffix = resetHour === 0 ? "12am" : resetHour < 12 ? `${resetHour}am` : resetHour === 12 ? "12pm" : `${resetHour - 12}pm`;
  return `Refreshes daily at ${suffix}`;
}

function priorityFromCounts(input: JobsiteDailyTodoInput): JobsiteDailyTodoPriority {
  if (input.riskLevel === "critical" || input.overdueActionsCount > 0 || input.permitBlockerCount > 0) return "critical";
  if (input.riskLevel === "high" || input.highRiskScheduleCount > 0 || input.inspectionGapCount > 0) return "high";
  if (input.workforceGapCount > 0 || input.openActionsCount > 0) return "medium";
  return "low";
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

export function buildJobsiteDailyTodos(input: JobsiteDailyTodoInput): JobsiteDailyTodoItem[] {
  const dailyPriority = priorityFromCounts(input);
  const firstSchedule = input.firstScheduleRiskTitle?.trim() || "today's scheduled work";
  const hrefBase = `/safe-predict/jobsites/${encodeURIComponent(input.jobsiteId)}`;

  const items: JobsiteDailyTodoItem[] = [
    {
      id: `${input.workDate}-${input.jobsiteId}-pm-risk-review`,
      sourceKey: "pm-risk-review",
      role: "pm",
      title: "PM daily risk review",
      detail:
        input.highRiskScheduleCount > 0
          ? `Review ${plural(input.highRiskScheduleCount, "high-risk schedule item")} starting with ${firstSchedule}.`
          : "Review the site risk board and confirm no schedule changes create new exposure.",
      status: "open",
      priority: dailyPriority,
      targetTab: input.highRiskScheduleCount > 0 ? "Schedule" : "Predictive Risk",
      targetHref: `${hrefBase}/schedule`,
    },
    {
      id: `${input.workDate}-${input.jobsiteId}-sl-prework-readiness`,
      sourceKey: "sl-prework-readiness",
      role: "sl",
      title: "SL pre-work readiness check",
      detail:
        input.permitBlockerCount > 0
          ? `Verify ${plural(input.permitBlockerCount, "permit blocker")} before releasing the crew.`
          : "Confirm permits, JSAs, crew readiness, and pre-task controls before work starts.",
      status: "open",
      priority: input.permitBlockerCount > 0 ? "critical" : input.workforceGapCount > 0 ? "medium" : "low",
      targetTab: input.permitBlockerCount > 0 ? "Permits" : "Workforce",
      targetHref: `${hrefBase}/permits`,
    },
    {
      id: `${input.workDate}-${input.jobsiteId}-pm-action-closeout`,
      sourceKey: "pm-action-closeout",
      role: "pm",
      title: "PM open action closeout",
      detail:
        input.overdueActionsCount > 0
          ? `Close out or escalate ${plural(input.overdueActionsCount, "overdue action")} before the PM handoff.`
          : input.openActionsCount > 0
            ? `Review ${plural(input.openActionsCount, "open action")} and move completed work to verification.`
            : "Confirm there are no open corrective actions blocking the shift.",
      status: "open",
      priority: input.overdueActionsCount > 0 ? "critical" : input.openActionsCount > 0 ? "high" : "low",
      targetTab: "Corrective Actions",
      targetHref: `${hrefBase}#actions`,
    },
    {
      id: `${input.workDate}-${input.jobsiteId}-sl-field-verification`,
      sourceKey: "sl-field-verification",
      role: "sl",
      title: "SL field verification",
      detail:
        input.inspectionGapCount > 0
          ? `Walk down and document ${plural(input.inspectionGapCount, "inspection gap")} before closeout.`
          : "Capture observations, coaching notes, and any changed conditions during the shift.",
      status: "open",
      priority: input.inspectionGapCount > 0 ? "high" : "medium",
      targetTab: input.inspectionGapCount > 0 ? "Inspections" : "Incidents & Observations",
      targetHref: `${hrefBase}/inspections`,
    },
    {
      id: `${input.workDate}-${input.jobsiteId}-pm-sl-closeout`,
      sourceKey: "pm-sl-closeout",
      role: "pm",
      title: "PM / SL end-of-day closeout",
      detail:
        input.readyReportCount > 0
          ? `Review ${plural(input.readyReportCount, "ready report")} and close the daily record.`
          : "Confirm completed items, unresolved risks, and handoff notes are ready for tomorrow.",
      status: "open",
      priority: input.readyReportCount > 0 ? "medium" : "low",
      targetTab: input.readyReportCount > 0 ? "Documents & Reports" : "Activity Timeline",
      targetHref: `${hrefBase}/reports`,
    },
  ];

  return items;
}
