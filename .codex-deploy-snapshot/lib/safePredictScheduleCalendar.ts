import type { SafePredictRiskLevel } from "@/lib/safePredictMockData";
import type { ScheduleHazardPredictionResponse } from "@/lib/scheduleHazardPrediction";

export type SafePredictScheduleApiItem = {
  id: string;
  source: "manual" | "microsoft_project";
  title: string | null;
  status: string | null;
  workStartDate: string | null;
  workEndDate: string | null;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  trade: string | null;
  workArea: string | null;
  crewOrContractor: string | null;
  crewSize: number | null;
  supervisorName: string | null;
  riskLevel: SafePredictRiskLevel | string | null;
  isHighRisk: boolean;
  hazardCategories: string[];
  permitTriggers: string[];
  requiredControls: string[];
  sourceMetadata?: Record<string, unknown> | null;
  notes: string | null;
  readOnly?: boolean;
};

export type SafePredictScheduleEvent = {
  id: string;
  title: string;
  type: string;
  date: string;
  owner: string;
  location: string;
  riskLevel: SafePredictRiskLevel;
  detail: string;
  controls: string[];
  hazards?: string[];
  permits?: string[];
  source: string;
  predictionSource?: ScheduleHazardPredictionResponse["source"];
  isManual?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  dedupeKey?: string;
};

export type ScheduleCalendarDay = {
  date: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  events: SafePredictScheduleEvent[];
};

const RISK_LEVELS = new Set(["critical", "high", "medium", "low"]);
const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

export function toDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateOnly(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(dateOnly: string, days: number) {
  const parsed = parseDateOnly(dateOnly);
  if (!parsed) return null;
  parsed.setDate(parsed.getDate() + days);
  return toDateOnly(parsed);
}

export function compactScheduleDateLabel(value?: string | null) {
  if (!value) return "No date";
  const parsed = parseDateOnly(value.slice(0, 10));
  if (!parsed) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed);
}

export function normalizeScheduleRiskLevel(value?: string | null): SafePredictRiskLevel {
  const normalized = String(value ?? "").trim().toLowerCase();
  return RISK_LEVELS.has(normalized) ? (normalized as SafePredictRiskLevel) : "medium";
}

export function scheduleDateLabelToDateOnly(value: string, anchorDate = new Date()) {
  const trimmed = value.trim();
  if (!trimmed || /^no due date$/i.test(trimmed) || /^not set$/i.test(trimmed)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^today$/i.test(trimmed)) return toDateOnly(anchorDate);
  if (/^tomorrow$/i.test(trimmed)) return addDays(toDateOnly(anchorDate), 1);

  const shiftMatch = trimmed.match(/^next\s+(\d+)\s+shifts?$/i);
  if (shiftMatch) return addDays(toDateOnly(anchorDate), Number(shiftMatch[1]));

  const monthDay = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
  if (monthDay) {
    const month = MONTH_INDEX[monthDay[1].toLowerCase()];
    const day = Number(monthDay[2]);
    const year = monthDay[3] ? Number(monthDay[3]) : anchorDate.getFullYear();
    if (typeof month === "number" && Number.isInteger(day) && day >= 1 && day <= 31) {
      const parsed = new Date(year, month, day);
      if (parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day) {
        return toDateOnly(parsed);
      }
    }
  }

  return null;
}

function datesForEvent(event: SafePredictScheduleEvent, anchorDate: Date) {
  const start = event.startDate?.slice(0, 10) || scheduleDateLabelToDateOnly(event.date, anchorDate);
  if (!start) return [];
  const end = event.endDate?.slice(0, 10) || start;
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  if (!startDate || !endDate || endDate < startDate) return [start];

  const out: string[] = [];
  const cursor = new Date(startDate);
  for (let guard = 0; guard < 62 && cursor <= endDate; guard += 1) {
    out.push(toDateOnly(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function scheduleEventDateKeys(event: SafePredictScheduleEvent, anchorDate = new Date()) {
  return datesForEvent(event, anchorDate);
}

export function buildScheduleCalendarDays(events: SafePredictScheduleEvent[], monthDate: Date, today = new Date()) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const todayKey = toDateOnly(today);
  const eventsByDate = new Map<string, SafePredictScheduleEvent[]>();

  for (const event of events) {
    for (const date of datesForEvent(event, today)) {
      const current = eventsByDate.get(date) ?? [];
      current.push(event);
      eventsByDate.set(date, current);
    }
  }

  return Array.from({ length: 42 }, (_, index): ScheduleCalendarDay => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dateKey = toDateOnly(date);
    return {
      date: dateKey,
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === monthDate.getMonth(),
      isToday: dateKey === todayKey,
      events: [...(eventsByDate.get(dateKey) ?? [])].sort((a, b) => riskSortValue(b.riskLevel) - riskSortValue(a.riskLevel) || a.title.localeCompare(b.title)),
    };
  });
}

export function dedupeScheduleEvents(events: SafePredictScheduleEvent[]) {
  const seen = new Set<string>();
  const out: SafePredictScheduleEvent[] = [];
  for (const event of events) {
    const key = event.dedupeKey || event.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
  }
  return out;
}

export function scheduleApiItemToEvent(item: SafePredictScheduleApiItem, fallback: { owner: string; location: string }) {
  const riskLevel = normalizeScheduleRiskLevel(item.riskLevel);
  const startDate = item.workStartDate?.slice(0, 10) || null;
  const endDate = item.workEndDate?.slice(0, 10) || startDate;
  const taskType = typeof item.sourceMetadata?.taskType === "string" ? item.sourceMetadata.taskType : null;
  const sourceLabel = item.source === "microsoft_project" ? "Microsoft Project" : "Saved schedule task";
  const importKey = typeof item.sourceMetadata?.importKey === "string" ? item.sourceMetadata.importKey : null;
  const dateLabel = startDate && endDate && endDate !== startDate ? `${compactScheduleDateLabel(startDate)}-${compactScheduleDateLabel(endDate)}` : compactScheduleDateLabel(startDate);

  return {
    id: importKey ? `schedule-import-${importKey}` : `schedule-${item.source}-${item.id}`,
    title: item.title?.trim() || "Untitled schedule task",
    type: taskType || item.trade || "Task",
    date: dateLabel,
    owner: item.supervisorName?.trim() || fallback.owner,
    location: item.workArea?.trim() || fallback.location,
    riskLevel,
    detail: item.notes?.trim() || `${riskLevel === "critical" || riskLevel === "high" ? "High-risk" : "Scheduled"} work from ${sourceLabel.toLowerCase()}.`,
    controls: item.requiredControls?.length ? item.requiredControls : ["Pre-task plan", "Supervisor verification"],
    hazards: item.hazardCategories ?? [],
    permits: item.permitTriggers ?? [],
    source: sourceLabel,
    isManual: item.source === "manual",
    startDate,
    endDate,
    dedupeKey: importKey ? `schedule-import-${importKey}` : `schedule:${item.source}:${item.id}`,
  } satisfies SafePredictScheduleEvent;
}

function riskSortValue(level: SafePredictRiskLevel) {
  return level === "critical" ? 4 : level === "high" ? 3 : level === "medium" ? 2 : 1;
}
