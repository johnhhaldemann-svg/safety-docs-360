"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CloudSun,
  Download,
  Pencil,
  FilterX,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X,
} from "lucide-react";
import { AiEngineRefreshButton } from "@/components/ai-engine/AiEngineRefreshButton";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { triggerBrowserDownload } from "@/lib/browserDownload";
import { useSafePredictData, type SafePredictJobsiteUpdateInput } from "@/components/safe-predict/SafePredictDataProvider";
import {
  SafePredictPermitFormDialog,
  type SafePredictPermitFormMode,
  type SafePredictPermitFormSaveInput,
} from "@/components/safe-predict/SafePredictPermitFormDialog";
import {
  Card,
  CorrectiveActionCard,
  EventTimeline,
  ExportButton,
  ForecastTrendChart,
  MetricCard,
  PageHeader,
  RiskBadge,
  RiskHeatMap,
  SectionTitle,
  SelectShell,
  cx,
} from "@/components/safe-predict/SafePredictPrimitives";
import {
  jobsiteById,
  clampRiskScore,
  riskForecastForSite,
  siteScoped,
  summarizeSafePredictDataset,
  type SafePredictDataset,
  type SafePredictJobsiteRecord,
  type SafePredictJobsiteStatus,
} from "@/lib/safePredictData";
import { SAFE_PREDICT_RISK_INDEX_HELPER, type SafePredictRiskLevel } from "@/lib/safePredictMockData";
import { permitReadinessLabel as permitFormReadinessLabel } from "@/lib/safePredictPermitForms";
import { CONSTRUCTION_TRADE_LABELS } from "@/lib/constructionTradeTaxonomy";
import {
  buildRuleBasedScheduleHazardPrediction,
  type ScheduleHazardPredictionResponse,
} from "@/lib/scheduleHazardPrediction";
import { formatTitleCase } from "@/lib/formatTitleCase";
import {
  parseScheduleTemplateFile,
  scheduleTemplateAccept,
  scheduleTemplateHeader,
  type ScheduleTemplateTask,
} from "@/lib/scheduleTemplateImport";
import {
  buildScheduleCalendarDays,
  compactScheduleDateLabel,
  dedupeScheduleEvents,
  scheduleApiItemToEvent,
  scheduleDateLabelToDateOnly,
  scheduleEventDateKeys,
  toDateOnly,
  normalizeScheduleRiskLevel,
  type SafePredictScheduleApiItem,
  type SafePredictScheduleEvent,
} from "@/lib/safePredictScheduleCalendar";

const statusOptions: Array<{ label: string; value: SafePredictJobsiteStatus | "all" }> = [
  { label: "All Statuses", value: "all" },
  { label: "Action Needed", value: "action-needed" },
  { label: "Active", value: "active" },
  { label: "Planned", value: "planned" },
  { label: "Completed", value: "completed" },
];

const detailTabs = [
  "Overview",
  "Predictive Risk",
  "Corrective Actions",
  "Workforce",
  "Schedule",
  "Permits",
  "Inspections",
  "Incidents & Observations",
  "Documents & Reports",
  "Activity Timeline",
] as const;

type DetailTab = (typeof detailTabs)[number];

const scheduleTaskTypeOptions = [
  "Work at height / elevated work",
  "Hot work / welding / cutting",
  "Excavation / trenching",
  "Confined space entry",
  "Electrical / LOTO",
  "Crane / rigging / lifting",
  "Steel erection / decking",
  "Demolition / removal",
  "Concrete / formwork / pour",
  "Mobile equipment / logistics",
  "General task",
];

const scheduleWorkAreaOptions = [
  "Roof / elevated deck",
  "Exterior perimeter",
  "Interior buildout",
  "Mechanical room",
  "Electrical room",
  "Excavation zone",
  "Laydown / loading zone",
  "Traffic route",
  "Manufacturing floor",
  "Warehouse aisle",
  "Other work area",
];

type DetailTableAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  secondaryLabel?: string;
  secondaryOnClick?: () => void;
};

type ScheduleTaskForm = ScheduleTemplateTask;

type ScheduledRiskEvent = SafePredictScheduleEvent & {
  editForm?: ScheduleTaskForm;
  readOnly?: boolean;
  scheduleItemId?: string;
};

type JobsiteAttentionTone = "critical" | "high" | "medium" | "low" | "blue";

type JobsiteAttentionItem = {
  id: string;
  title: string;
  detail: string;
  tone: JobsiteAttentionTone;
  actionLabel: string;
  targetTab: DetailTab;
};

type JobsiteReadinessSignal = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: JobsiteAttentionTone;
  targetTab: DetailTab;
};

type JobsiteActivityItem = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  tone: JobsiteAttentionTone;
};

type JobsiteCommandSummary = {
  site: SafePredictJobsiteRecord;
  aiRiskSummary: string;
  nextBestAction: string;
  nextScheduleTitle: string;
  nextScheduleDate: string;
  highRiskScheduleCount: number;
  attentionItems: JobsiteAttentionItem[];
  readinessSignals: JobsiteReadinessSignal[];
  activityItems: JobsiteActivityItem[];
};

type SchedulePermitReadiness = {
  id: string;
  title: string;
  date: string;
  riskLevel: SafePredictRiskLevel;
  status: "ready" | "needs-permit" | "needs-review";
  detail: string;
  permitLabels: string[];
};

type JobsiteWeatherAlertSummary = {
  id?: string | null;
  event_name?: string | null;
  headline?: string | null;
  severity?: string | null;
  expires_at?: string | null;
};

type JobsiteWeatherSettingsSummary = {
  weather_enabled?: boolean | null;
  zip_code?: string | null;
  weather_location_source?: string | null;
  weather_location_confidence?: string | null;
  weather_last_checked_at?: string | null;
  nws_forecast_url?: string | null;
};

type JobsiteWeatherForecastDay = {
  date?: string | null;
  name?: string | null;
  highTemperature?: number | null;
  lowTemperature?: number | null;
  temperatureUnit?: string | null;
  precipitationChance?: number | null;
  precipitationTypes?: string[] | null;
  shortForecast?: string | null;
  detailedForecast?: string | null;
  windSpeed?: string | null;
  windDirection?: string | null;
};

type JobsiteWeatherForecastSummary = {
  days?: JobsiteWeatherForecastDay[];
  sourceUrl?: string | null;
  publicUrl?: string | null;
  error?: string | null;
};

type JobsiteWeatherOverviewData = {
  jobsite?: JobsiteWeatherSettingsSummary | null;
  forecast?: JobsiteWeatherForecastSummary | null;
  alerts?: JobsiteWeatherAlertSummary[];
  error?: string | null;
};

function statusLabel(status: SafePredictJobsiteStatus) {
  if (status === "action-needed") return "Action Needed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusClasses(status: SafePredictJobsiteStatus) {
  if (status === "action-needed") return "border-red-200 bg-red-50 text-red-700";
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "planned") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function riskSort(level: SafePredictRiskLevel) {
  return level === "critical" ? 4 : level === "high" ? 3 : level === "medium" ? 2 : 1;
}

function riskText(level: SafePredictRiskLevel) {
  return level === "critical" ? "Critical" : level === "high" ? "High" : level === "medium" ? "Medium" : "Low";
}

function attentionToneClass(tone: JobsiteAttentionTone) {
  if (tone === "critical") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "high") return "border-orange-200 bg-orange-50 text-orange-700";
  if (tone === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "blue") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function signalBorderClass(tone: JobsiteAttentionTone) {
  if (tone === "critical") return "border-l-red-500";
  if (tone === "high") return "border-l-orange-500";
  if (tone === "medium") return "border-l-amber-400";
  if (tone === "blue") return "border-l-blue-500";
  return "border-l-emerald-500";
}

function openActionDueValue(dueDate: string) {
  const parsed = Date.parse(dueDate);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function normalizePermitMatchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function permitMatchesTrigger(permitType: string, trigger: string) {
  const permit = normalizePermitMatchText(permitType);
  const needed = normalizePermitMatchText(trigger);
  if (!permit || !needed) return false;
  return permit.includes(needed) || needed.includes(permit) || needed.split(" ").some((part) => part.length > 4 && permit.includes(part));
}

function buildSchedulePermitReadiness(events: ScheduledRiskEvent[], permits: SafePredictDataset["permits"]): SchedulePermitReadiness[] {
  return events
    .filter((event) => event.type !== "Permit")
    .slice(0, 8)
    .map((event) => {
      const permitLabels = event.permits?.filter(Boolean) ?? [];
      if (permitLabels.length === 0) {
        return {
          id: event.id,
          title: event.title,
          date: event.date,
          riskLevel: event.riskLevel,
          status: "ready",
          detail: "No permit trigger predicted for this task.",
          permitLabels,
        } satisfies SchedulePermitReadiness;
      }

      const matchedPermits = permitLabels.flatMap((label) => permits.filter((permit) => permitMatchesTrigger(permit.type, label)));
      const uniqueMatchedPermits = [...new Map(matchedPermits.map((permit) => [permit.id, permit])).values()];
      if (uniqueMatchedPermits.length === 0) {
        return {
          id: event.id,
          title: event.title,
          date: event.date,
          riskLevel: event.riskLevel,
          status: "needs-permit",
          detail: `${permitLabels.join(", ")} not found in the permit log.`,
          permitLabels,
        } satisfies SchedulePermitReadiness;
      }

      const reviewPermits = uniqueMatchedPermits.filter((permit) => permit.status !== "Active");
      return {
        id: event.id,
        title: event.title,
        date: event.date,
        riskLevel: event.riskLevel,
        status: reviewPermits.length > 0 ? "needs-review" : "ready",
        detail:
          reviewPermits.length > 0
            ? `${reviewPermits.map((permit) => `${permit.type} is ${permit.status.toLowerCase()}`).join("; ")}.`
            : `${uniqueMatchedPermits.length} matching active permit${uniqueMatchedPermits.length === 1 ? "" : "s"} found.`,
        permitLabels,
      } satisfies SchedulePermitReadiness;
    });
}

function permitReadinessTone(status: SchedulePermitReadiness["status"]): JobsiteAttentionTone {
  if (status === "needs-permit") return "critical";
  if (status === "needs-review") return "medium";
  return "low";
}

function schedulePermitReadinessLabel(status: SchedulePermitReadiness["status"]) {
  if (status === "needs-permit") return "Needs permit";
  if (status === "needs-review") return "Needs review";
  return "Ready";
}

function buildJobsiteCommandSummary(
  dataset: SafePredictDataset,
  site: SafePredictJobsiteRecord,
  scheduleEvents: ScheduledRiskEvent[] = []
): JobsiteCommandSummary {
  const siteEmployees = dataset.employees.filter((employee) => employee.assignedSiteId === site.id);
  const siteActions = siteScoped(dataset.actions, site.id);
  const openActions = siteActions.filter((action) => action.status !== "Closed");
  const overdueActions = openActions.filter((action) => openActionDueValue(action.dueDate) < Date.now());
  const siteInspections = siteScoped(dataset.inspections, site.id);
  const inspectionGaps = siteInspections.filter((inspection) => inspection.failedItems > 0 || inspection.status === "Overdue" || inspection.status === "Failed Check");
  const sitePermits = siteScoped(dataset.permits, site.id);
  const permitBlockers = sitePermits.filter((permit) => permit.status !== "Active" || permit.riskLevel === "critical" || permit.riskLevel === "high");
  const siteIncidents = siteScoped(dataset.incidents, site.id);
  const siteObservations = siteScoped(dataset.observations, site.id);
  const siteDocuments = siteScoped(dataset.documents, site.id);
  const siteReports = siteScoped(dataset.reports, site.id);
  const workforceAtRisk = siteEmployees.filter((employee) => employee.status !== "compliant");
  const highRiskSchedule = scheduleEvents.filter((event) => event.riskLevel === "critical" || event.riskLevel === "high");
  const nextSchedule = scheduleEvents[0];
  const attentionItems: JobsiteAttentionItem[] = [];

  if (highRiskSchedule.length > 0) {
    attentionItems.push({
      id: "schedule-risk",
      title: `${highRiskSchedule.length} high-risk schedule item${highRiskSchedule.length === 1 ? "" : "s"}`,
      detail: `${highRiskSchedule[0].title} is the first item needing a pre-task control check.`,
      tone: highRiskSchedule.some((event) => event.riskLevel === "critical") ? "critical" : "high",
      actionLabel: "Review schedule",
      targetTab: "Schedule",
    });
  }
  if (overdueActions.length > 0) {
    attentionItems.push({
      id: "overdue-actions",
      title: `${overdueActions.length} overdue corrective action${overdueActions.length === 1 ? "" : "s"}`,
      detail: `${overdueActions[0].title} needs owner follow-up before work continues.`,
      tone: "critical",
      actionLabel: "Open actions",
      targetTab: "Corrective Actions",
    });
  }
  if (permitBlockers.length > 0) {
    attentionItems.push({
      id: "permit-readiness",
      title: `${permitBlockers.length} permit blocker${permitBlockers.length === 1 ? "" : "s"}`,
      detail: `${permitBlockers[0].type} is ${permitBlockers[0].status.toLowerCase()} and should be verified before the shift.`,
      tone: permitBlockers.some((permit) => permit.status === "Expired") ? "critical" : "medium",
      actionLabel: "Check permits",
      targetTab: "Permits",
    });
  }
  if (inspectionGaps.length > 0) {
    attentionItems.push({
      id: "inspection-gaps",
      title: `${inspectionGaps.length} inspection gap${inspectionGaps.length === 1 ? "" : "s"}`,
      detail: `${inspectionGaps[0].title} has ${inspectionGaps[0].failedItems} failed check${inspectionGaps[0].failedItems === 1 ? "" : "s"}.`,
      tone: "medium",
      actionLabel: "Inspect gaps",
      targetTab: "Inspections",
    });
  }
  if (attentionItems.length === 0) {
    attentionItems.push({
      id: "steady-state",
      title: "No urgent blockers detected",
      detail: "Keep the daily huddle focused on schedule changes, permit readiness, and field observations.",
      tone: "low",
      actionLabel: "Review dashboard",
      targetTab: "Overview",
    });
  }

  const readinessSignals: JobsiteReadinessSignal[] = [
    {
      id: "workforce",
      label: "Workforce",
      value: `${siteEmployees.length || site.workforceCount}`,
      detail: workforceAtRisk.length > 0 ? `${workforceAtRisk.length} worker${workforceAtRisk.length === 1 ? "" : "s"} need readiness review.` : "Crew readiness looks clear.",
      tone: workforceAtRisk.length > 0 ? "medium" : "low",
      targetTab: "Workforce",
    },
    {
      id: "permits",
      label: "Permits",
      value: `${sitePermits.length || site.activePermits}`,
      detail: permitBlockers.length > 0 ? `${permitBlockers.length} permit item${permitBlockers.length === 1 ? "" : "s"} need review.` : "No permit blockers detected.",
      tone: permitBlockers.length > 0 ? "high" : "low",
      targetTab: "Permits",
    },
    {
      id: "inspections",
      label: "Inspections",
      value: `${inspectionGaps.length || site.inspectionGaps}`,
      detail: inspectionGaps.length > 0 ? "Failed or overdue checks need closure." : "No failed checks currently flagged.",
      tone: inspectionGaps.length > 0 ? "medium" : "low",
      targetTab: "Inspections",
    },
    {
      id: "documents",
      label: "Docs & reports",
      value: `${siteDocuments.length + siteReports.length}`,
      detail: siteReports.some((report) => report.status === "Ready") ? "Client or leadership report is ready." : "No ready report is waiting.",
      tone: siteReports.some((report) => report.status === "Ready") ? "blue" : "low",
      targetTab: "Documents & Reports",
    },
  ];

  const activityItems: JobsiteActivityItem[] = [
    ...openActions.slice(0, 2).map<JobsiteActivityItem>((action) => ({
      id: `action-${action.id}`,
      title: action.title,
      detail: `${action.status} corrective action assigned to ${action.assignee}.`,
      meta: action.dueDate,
      tone: action.priority === "critical" ? "critical" : action.priority === "high" ? "high" : "medium",
    })),
    ...siteObservations.slice(0, 1).map<JobsiteActivityItem>((observation) => ({
      id: `observation-${observation.id}`,
      title: observation.title,
      detail: observation.detail,
      meta: observation.submittedAt,
      tone: observation.riskLevel === "critical" ? "critical" : observation.riskLevel === "high" ? "high" : "blue",
    })),
    ...siteIncidents.slice(0, 1).map<JobsiteActivityItem>((incident) => ({
      id: `incident-${incident.id}`,
      title: incident.title,
      detail: incident.detail,
      meta: incident.reportedAt,
      tone: incident.severity === "critical" ? "critical" : incident.severity === "high" ? "high" : "medium",
    })),
  ].slice(0, 4);

  const nextBestAction =
    attentionItems[0]?.id === "steady-state"
      ? "Run the daily huddle and confirm no new schedule or permit changes."
      : attentionItems[0].detail;
  const aiRiskSummary =
    site.riskLevel === "critical" || site.riskLevel === "high"
      ? `${riskText(site.riskLevel)} jobsite risk is being driven by ${attentionItems[0].title.toLowerCase()}.`
      : `${riskText(site.riskLevel)} jobsite risk with ${openActions.length} open action${openActions.length === 1 ? "" : "s"} and ${permitBlockers.length} permit blocker${permitBlockers.length === 1 ? "" : "s"}.`;

  return {
    site,
    aiRiskSummary,
    nextBestAction,
    nextScheduleTitle: nextSchedule?.title ?? "No scheduled high-risk work loaded",
    nextScheduleDate: nextSchedule?.date ?? "Next 7 days",
    highRiskScheduleCount: highRiskSchedule.length,
    attentionItems: attentionItems.slice(0, 4),
    readinessSignals,
    activityItems,
  };
}

function predictionSourceLabel(source?: ScheduleHazardPredictionResponse["source"]) {
  if (source === "ai_updated_today") return "AI updated today";
  if (source === "ai_cached") return "AI cached";
  if (source === "rules_fallback") return "Rules fallback";
  return "Rules";
}

function compactDateLabel(value: string) {
  if (!value) return "Next 7 days";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed);
    }
  }
  return value;
}

function formatWeatherDateTime(value?: string | null) {
  if (!value) return "Not checked yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function weatherLocationSourceLabel(value?: string | null) {
  if (value === "address") return "Address";
  if (value === "zip_centroid") return "ZIP approximate";
  if (value === "manual") return "Manual";
  return "Not resolved";
}

function weatherSeverityClasses(severity?: string | null) {
  const value = String(severity ?? "").toLowerCase();
  if (value.includes("extreme") || value.includes("severe")) return "border-red-200 bg-red-50 text-red-700";
  if (value.includes("moderate")) return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatWeatherForecastDay(value?: string | null) {
  if (!value) return "Day";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(parsed);
}

function weatherPrecipitationLabel(day: JobsiteWeatherForecastDay) {
  const types = (day.precipitationTypes ?? []).filter(Boolean);
  const chance = typeof day.precipitationChance === "number" ? `${day.precipitationChance}%` : null;
  const typeLabel = types.length > 0 ? types.map((type) => formatTitleCase(type)).join("/") : "No precip";
  return chance ? `${chance} ${typeLabel}` : typeLabel;
}

function weatherTemperatureLabel(day: JobsiteWeatherForecastDay) {
  const unit = day.temperatureUnit || "F";
  const high = typeof day.highTemperature === "number" ? `${day.highTemperature}°${unit}` : "--";
  const low = typeof day.lowTemperature === "number" ? `${day.lowTemperature}°${unit}` : "--";
  return `${high} / ${low}`;
}

function publicNwsForecastUrlFromSite(site: SafePredictJobsiteRecord) {
  if (typeof site.weatherLatitude !== "number" || typeof site.weatherLongitude !== "number") return null;
  const params = new URLSearchParams({
    lat: site.weatherLatitude.toFixed(4),
    lon: site.weatherLongitude.toFixed(4),
  });
  return `https://forecast.weather.gov/MapClick.php?${params.toString()}`;
}

function controlList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listText(value: string[]) {
  return value.join(", ");
}

function jobsiteWeatherFromSite(site: SafePredictJobsiteRecord): JobsiteWeatherOverviewData {
  return {
    jobsite: {
      weather_enabled: Boolean(site.weatherEnabled),
      zip_code: site.zipCode ?? null,
      weather_location_source: site.weatherLocationSource ?? null,
      weather_location_confidence: site.weatherLocationConfidence ?? null,
      weather_last_checked_at: site.weatherLastCheckedAt ?? null,
      nws_forecast_url: site.weatherForecastUrl ?? null,
    },
    forecast: {
      days: [],
      sourceUrl: site.weatherForecastUrl ?? null,
      publicUrl: publicNwsForecastUrlFromSite(site),
      error: null,
    },
    alerts: [],
  };
}

function mergeJobsiteWeatherOverview(
  fallbackWeather: JobsiteWeatherOverviewData,
  payload: JobsiteWeatherOverviewData | null
): JobsiteWeatherOverviewData {
  return {
    ...fallbackWeather,
    ...(payload ?? {}),
    jobsite: {
      ...(fallbackWeather.jobsite ?? {}),
      ...(payload?.jobsite ?? {}),
    },
    forecast: {
      ...(fallbackWeather.forecast ?? {}),
      ...(payload?.forecast ?? {}),
      days: Array.isArray(payload?.forecast?.days) ? payload.forecast.days : fallbackWeather.forecast?.days ?? [],
    },
    alerts: Array.isArray(payload?.alerts) ? payload.alerts : fallbackWeather.alerts ?? [],
  };
}

function JobsiteWeatherOverviewCard({
  site,
  weather,
  refreshing = false,
  onRefresh,
  testSending = false,
  testNotificationMessage,
  testNotificationTone = "neutral",
  onSendTestNotification,
}: {
  site: SafePredictJobsiteRecord;
  weather: JobsiteWeatherOverviewData | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  testSending?: boolean;
  testNotificationMessage?: string | null;
  testNotificationTone?: "success" | "error" | "neutral";
  onSendTestNotification?: () => void;
}) {
  const jobsiteWeather = weather?.jobsite ?? jobsiteWeatherFromSite(site).jobsite;
  const alerts = weather?.alerts ?? [];
  const forecast = weather?.forecast;
  const forecastDays = forecast?.days ?? [];
  const enabled = Boolean(jobsiteWeather?.weather_enabled);
  const zipCode = jobsiteWeather?.zip_code || site.zipCode || "";
  const sourceLabel = weatherLocationSourceLabel(jobsiteWeather?.weather_location_source ?? site.weatherLocationSource);
  const confidence = jobsiteWeather?.weather_location_confidence ?? site.weatherLocationConfidence;
  const forecastUrl = forecast?.publicUrl ?? publicNwsForecastUrlFromSite(site);
  const canAttemptRefresh =
    enabled ||
    Boolean(zipCode) ||
    (typeof site.weatherLatitude === "number" && typeof site.weatherLongitude === "number");
  const title = alerts.length > 0 ? `${alerts.length} active weather alert${alerts.length === 1 ? "" : "s"}` : enabled ? "No active NWS alerts" : "Weather monitoring off";
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl border", alerts.length > 0 ? "border-red-200 bg-red-50 text-red-600" : enabled ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-slate-200 bg-slate-50 text-slate-500")}>
            <CloudSun className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Jobsite Weather</p>
            <h2 className="mt-1 text-xl font-black leading-tight text-slate-950">{title}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {sourceLabel}{zipCode ? ` - ZIP ${zipCode}` : ""}{confidence ? ` - ${formatTitleCase(confidence)} confidence` : ""} - Last checked {formatWeatherDateTime(jobsiteWeather?.weather_last_checked_at ?? site.weatherLastCheckedAt)}
            </p>
            {!enabled && !zipCode ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Add a ZIP code in jobsite settings before turning on weather notifications.</p>
            ) : null}
            {sourceLabel === "ZIP approximate" ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-amber-700">ZIP-based weather is approximate and is used for NWS alert coverage.</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing || !canAttemptRefresh}
              className={cx(
                "inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-black shadow-sm transition",
                refreshing || !canAttemptRefresh
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              <RefreshCw className={cx("h-4 w-4", refreshing ? "animate-spin" : "")} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          ) : null}
          {onSendTestNotification ? (
            <button
              type="button"
              onClick={onSendTestNotification}
              disabled={testSending || !enabled}
              className={cx(
                "inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-black shadow-sm transition",
                testSending || !enabled
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              )}
            >
              <CloudSun className={cx("h-4 w-4", testSending ? "animate-pulse" : "")} />
              {testSending ? "Sending test" : "Send test alert"}
            </button>
          ) : null}
          {forecastUrl ? (
            <a href={forecastUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 shadow-sm hover:bg-blue-100">
              NWS forecast
            </a>
          ) : null}
        </div>
      </div>
      {weather?.error ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{weather.error}</p>
      ) : null}
      {forecast?.error ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{forecast.error}</p>
      ) : null}
      {testNotificationMessage ? (
        <p className={cx(
          "mt-4 rounded-lg border px-3 py-2 text-sm font-semibold",
          testNotificationTone === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : testNotificationTone === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-slate-200 bg-slate-50 text-slate-700"
        )}>{testNotificationMessage}</p>
      ) : null}
      {forecastDays.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {forecastDays.slice(0, 5).map((day, index) => (
            <div key={day.date ?? `${day.name ?? "forecast"}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{formatWeatherForecastDay(day.date)}</p>
                  <p className="mt-1 text-lg font-black leading-none text-slate-950">{weatherTemperatureLabel(day)}</p>
                </div>
                <span className={cx(
                  "max-w-28 rounded-full border px-2 py-0.5 text-center text-[10px] font-black uppercase leading-tight tracking-wide",
                  (day.precipitationTypes ?? []).some((type) => ["storm", "ice", "sleet", "snow"].includes(type))
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-blue-100 bg-blue-50 text-blue-700"
                )}>
                  {weatherPrecipitationLabel(day)}
                </span>
              </div>
              <p className="mt-3 min-h-10 text-xs font-bold leading-5 text-slate-700">{day.shortForecast || "Forecast pending"}</p>
              {(day.windSpeed || day.windDirection) ? (
                <p className="mt-2 text-[11px] font-semibold text-slate-500">Wind {day.windDirection ? `${day.windDirection} ` : ""}{day.windSpeed}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : enabled ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">5-day NWS forecast will appear after the weather location is resolved.</p>
      ) : null}
      {alerts.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {alerts.slice(0, 4).map((alert, index) => (
            <div key={alert.id ?? `${alert.event_name ?? "alert"}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cx("rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide", weatherSeverityClasses(alert.severity))}>{alert.severity || "Alert"}</span>
                <span className="text-xs font-bold text-slate-500">Expires {formatWeatherDateTime(alert.expires_at)}</span>
              </div>
              <p className="mt-2 text-sm font-black text-slate-950">{alert.event_name || "Weather alert"}</p>
              {alert.headline ? <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{alert.headline}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function scheduleTemplateFileName(site: SafePredictJobsiteRecord) {
  const slug = [site.code, site.name]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "jobsite"}-schedule-template.csv`;
}

function jobsiteSearchText(site: SafePredictJobsiteRecord) {
  return [site.name, site.code, site.address, site.cityState, site.phase, site.siteLead, site.projectManager, site.customerName].join(" ").toLowerCase();
}

function scheduleFormForApiItem(item: SafePredictScheduleApiItem): ScheduleTaskForm {
  const taskType = typeof item.sourceMetadata?.taskType === "string" ? item.sourceMetadata.taskType : "";
  const startDate = item.workStartDate?.slice(0, 10) ?? "";
  const endDate = item.workEndDate?.slice(0, 10) ?? "";
  const metadata = item.sourceMetadata ?? {};
  const metadataString = (key: string) => {
    const value = metadata[key];
    return value == null ? undefined : String(value);
  };
  return {
    title: item.title?.trim() || "",
    dueDate: startDate,
    workEndDate: endDate && endDate !== startDate ? endDate : "",
    shiftStartTime: item.shiftStartTime ?? "",
    shiftEndTime: item.shiftEndTime ?? "",
    trade: item.trade ?? "",
    taskType,
    owner: item.supervisorName ?? "",
    workArea: item.workArea ?? "",
    crewSize: item.crewSize == null ? "" : String(item.crewSize),
    riskLevel: normalizeScheduleRiskLevel(item.riskLevel),
    hazards: listText(item.hazardCategories ?? []),
    permits: listText(item.permitTriggers ?? []),
    controls: listText(item.requiredControls ?? []),
    notes: item.notes ?? "",
    sourceMetadata: {
      importKey: metadataString("importKey"),
      importSource: metadataString("importSource"),
      sourceTaskId: metadataString("sourceTaskId"),
      percentComplete: metadataString("percentComplete"),
      projectStatus: metadataString("projectStatus"),
      priority: metadataString("priority"),
      outlineLevel: metadataString("outlineLevel"),
    },
  };
}

export function SafePredictJobsitesPortfolio() {
  const { dataset, loading, mode, setMode, selectedJobsiteId, setSelectedJobsiteId, addDraftJobsite } = useSafePredictData();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SafePredictJobsiteStatus | "all">("all");
  const [risk, setRisk] = useState<SafePredictRiskLevel | "all">("all");
  const [showCreateJobsite, setShowCreateJobsite] = useState(false);
  const [newJobsite, setNewJobsite] = useState({
    name: "",
    code: "",
    address: "",
    projectManager: "",
    safetyLead: "",
    customerName: "",
    customerReportEmail: "",
  });
  const summary = summarizeSafePredictDataset(dataset);
  const normalizedQuery = query.trim().toLowerCase();
  const isLiveMode = mode === "live";
  const isLiveEmpty = isLiveMode && dataset.jobsites.length === 0;

  const visibleJobsites = useMemo(() => {
    return dataset.jobsites
      .filter((site) => status === "all" || site.status === status)
      .filter((site) => risk === "all" || site.riskLevel === risk || (risk === "critical" && site.riskLevel === "high"))
      .filter((site) => !normalizedQuery || jobsiteSearchText(site).includes(normalizedQuery))
      .sort((a, b) => riskSort(b.riskLevel) - riskSort(a.riskLevel));
  }, [dataset.jobsites, normalizedQuery, risk, status]);
  const jobsiteCommandSummaries = useMemo(() => {
    return new Map(dataset.jobsites.map((site) => [site.id, buildJobsiteCommandSummary(dataset, site)]));
  }, [dataset]);
  const portfolioAttention = visibleJobsites
    .map((site) => jobsiteCommandSummaries.get(site.id))
    .filter((summary): summary is JobsiteCommandSummary => Boolean(summary))
    .flatMap((summary) => summary.attentionItems.map((item) => ({ ...item, site: summary.site })))
    .slice(0, 5);

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setRisk("all");
  }

  function createJobsite() {
    if (!newJobsite.name.trim()) return;
    const draft = addDraftJobsite({
      name: newJobsite.name.trim(),
      code: newJobsite.code.trim(),
      address: newJobsite.address.trim(),
      projectManager: newJobsite.projectManager.trim(),
      safetyLead: newJobsite.safetyLead.trim(),
      customerName: newJobsite.customerName.trim(),
      customerReportEmail: newJobsite.customerReportEmail.trim(),
    });
    setShowCreateJobsite(false);
    setNewJobsite({
      name: "",
      code: "",
      address: "",
      projectManager: "",
      safetyLead: "",
      customerName: "",
      customerReportEmail: "",
    });
    router.push(`/safe-predict/jobsites/${encodeURIComponent(draft.id)}`);
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 pb-8 sm:px-7">
      <PageHeader
        title="Jobsites"
        subtitle="Project command centers for risk, people, permits, inspections, and actions."
        actions={
          <>
            <button
              type="button"
              onClick={() => setMode(mode === "live" ? "demo" : "live")}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm"
            >
              <ShieldCheck className="h-4 w-4" />
              {mode === "live" ? "Live data" : "Sample data"}
            </button>
            <button type="button" onClick={() => setShowCreateJobsite((open) => !open)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)]">
              <Plus className="h-4 w-4" />
              New jobsite
            </button>
          </>
        }
      />

      {showCreateJobsite ? (
        <Card className="mb-5 p-5">
          <SectionTitle title="Create Jobsite" action={<span className="text-xs font-black uppercase tracking-wide text-blue-600">{mode === "live" ? "Posts to live API and keeps local draft" : "Local draft"}</span>} />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["name", "Jobsite name"],
              ["code", "Project code"],
              ["address", "Location"],
              ["projectManager", "Project manager"],
              ["safetyLead", "Safety lead"],
              ["customerName", "Customer"],
              ["customerReportEmail", "Report email"],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">{label}</span>
                <input
                  value={newJobsite[key as keyof typeof newJobsite]}
                  onChange={(event) => setNewJobsite((current) => ({ ...current, [key]: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={createJobsite} disabled={!newJobsite.name.trim()} className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
              Create jobsite
            </button>
            <button type="button" onClick={() => setShowCreateJobsite(false)} className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
              Cancel
            </button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Active Jobsites" value={dataset.jobsites.length} detail={loading ? "Checking live data" : isLiveMode ? "Live data" : "Sample data"} tone="blue" icon={<Building2 className="h-7 w-7" />} href="#jobsite-list" />
        <MetricCard title="Elevated Sites" value={dataset.jobsites.filter((site) => site.riskLevel === "critical" || site.riskLevel === "high").length} detail="Needs safety review" tone="red" icon={<AlertTriangle className="h-7 w-7" />} href="#jobsite-list" />
        <MetricCard title="Open Actions" value={summary.openActions} detail={`${summary.overdueActions} overdue`} tone="orange" icon={<ClipboardCheck className="h-7 w-7" />} href="/safe-predict/corrective-actions" />
        <MetricCard title="Inspection Gaps" value={summary.inspectionGaps} detail="Across active sites" tone="amber" icon={<CalendarCheck className="h-7 w-7" />} href="/safe-predict/inspections" />
      </div>

      <Card className="mt-5 p-5">
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-blue-600">Daily Command Brief</p>
                <h2 className="text-xl font-black text-slate-950">What Needs Attention Before the Next Shift</h2>
              </div>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              Jobsites are ranked by risk, open work, permit readiness, inspection gaps, and field activity so safety managers can move from signal to action fast.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setRisk("critical")} className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700">
                Critical only
              </button>
              <button type="button" onClick={() => setStatus("action-needed")} className="inline-flex h-9 items-center rounded-lg border border-orange-200 bg-orange-50 px-3 text-xs font-black text-orange-700">
                Action needed
              </button>
              <button type="button" onClick={() => setShowCreateJobsite(true)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700">
                <Plus className="h-3.5 w-3.5" />
                Add jobsite
              </button>
            </div>
          </div>
          <div className="grid gap-2">
            {portfolioAttention.length > 0 ? (
              portfolioAttention.map((item) => (
                <Link
                  key={`${item.site.id}-${item.id}`}
                  href={`/safe-predict/jobsites/${encodeURIComponent(item.site.id)}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-white"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-black uppercase tracking-wide text-slate-500">{item.site.name}</span>
                    <span className="mt-1 block text-sm font-black text-slate-950">{formatTitleCase(item.title) || item.title}</span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">{item.detail}</span>
                  </span>
                  <span className={cx("shrink-0 rounded-full border px-2.5 py-1 text-xs font-black", attentionToneClass(item.tone))}>{item.actionLabel}</span>
                </Link>
              ))
            ) : (
              <EmptyLivePanel title="No Command Signals Yet" detail="Create a jobsite or switch to sample data to see the command brief populate with risk-ranked work." />
            )}
          </div>
        </div>
      </Card>

      <Card className="mt-5 p-5">
        <div className="grid gap-4 xl:grid-cols-[1fr_190px_170px_auto] xl:items-end">
          <label className="relative block">
            <span className="mb-1 block text-xs font-bold text-slate-600">Search</span>
            <Search className="absolute bottom-3 left-3 h-5 w-5 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
              placeholder="Search jobsite, lead, code, customer..."
              type="search"
            />
          </label>
          <SelectShell label="Status" value={status} onChange={(value) => setStatus(value as SafePredictJobsiteStatus | "all")} options={statusOptions} />
          <SelectShell
            label="Risk"
            value={risk}
            onChange={(value) => setRisk(value as SafePredictRiskLevel | "all")}
            options={[
              { label: "All Risk", value: "all" },
              { label: "Critical", value: "critical" },
              { label: "High", value: "high" },
              { label: "Medium", value: "medium" },
              { label: "Low", value: "low" },
            ]}
          />
          <button type="button" onClick={clearFilters} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black text-blue-600">
            <FilterX className="h-4 w-4" />
            Clear
          </button>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[1.15fr_0.85fr]">
        <Card id="jobsite-list" className="scroll-mt-24 p-5">
          <SectionTitle
            title="Jobsite Portfolio"
            action={
              <ExportButton
                fileName="safe-predict-jobsites.json"
                label="Export jobsites"
                payload={{ mode, jobsites: visibleJobsites, summary }}
                className="text-sm font-black text-blue-600"
              >
                Export
              </ExportButton>
            }
          />
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {visibleJobsites.map((site) => {
              const selected = selectedJobsiteId === site.id;
              const command = jobsiteCommandSummaries.get(site.id) ?? buildJobsiteCommandSummary(dataset, site);
              const primaryAttention = command.attentionItems[0];
              return (
                <Link
                  key={site.id}
                  href={`/safe-predict/jobsites/${encodeURIComponent(site.id)}`}
                  data-testid={`safe-predict-jobsite-card-${site.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    setSelectedJobsiteId(site.id);
                    router.push(`/safe-predict/jobsites/${encodeURIComponent(site.id)}`);
                  }}
                  className={cx(
                    "group rounded-lg border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_14px_28px_rgba(15,23,42,0.1)]",
                    selected ? "border-blue-300 ring-4 ring-blue-50" : "border-slate-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-lg bg-blue-50 text-blue-600">
                      <MapPin className="h-6 w-6" />
                    </span>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className={cx("rounded-full border px-2.5 py-1 text-xs font-black", statusClasses(site.status))}>{statusLabel(site.status)}</span>
                      <RiskBadge level={site.riskLevel} />
                    </div>
                  </div>
                  <h2 className="mt-4 text-lg font-black text-slate-950">{site.name}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{site.code} - {site.cityState}</p>
                  <p className="mt-2 text-sm leading-5 text-slate-600">{site.phase}</p>
                  <div className={cx("mt-4 rounded-lg border px-3 py-2", attentionToneClass(primaryAttention.tone))}>
                    <p className="text-xs font-black uppercase tracking-wide">Needs attention</p>
                    <p className="mt-1 text-sm font-black leading-5">{formatTitleCase(primaryAttention.title) || primaryAttention.title}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 opacity-90">{primaryAttention.detail}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black text-slate-700 sm:grid-cols-4">
                    <span className="rounded-md bg-slate-50 p-2"><Users className="mr-1 inline h-3.5 w-3.5" />{site.workforceCount}</span>
                    <span className="rounded-md bg-slate-50 p-2">{site.activePermits} permits</span>
                    <span className="rounded-md bg-slate-50 p-2">{site.openActions} actions</span>
                    <span className="rounded-md bg-slate-50 p-2">{site.inspectionGaps} gaps</span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {command.readinessSignals.slice(0, 2).map((signal) => (
                      <span key={`${site.id}-${signal.id}`} className={cx("rounded-md border-l-4 bg-slate-50 p-2 text-xs font-bold text-slate-600", signalBorderClass(signal.tone))}>
                        <span className="block font-black text-slate-950">{signal.label}: {signal.value}</span>
                        {signal.detail}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-blue-600">
                    Open command center <ArrowRight className="h-4 w-4" />
                  </p>
                </Link>
              );
            })}
          </div>
          {visibleJobsites.length === 0 ? (
            <CommandEmptyState
              isLiveEmpty={isLiveEmpty}
              onCreate={() => setShowCreateJobsite(true)}
              onClear={clearFilters}
              onSample={() => setMode("demo")}
            />
          ) : null}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle title="Site Risk Map" />
            <div className="mt-4">
              {isLiveMode ? (
                <LiveJobsiteRiskList
                  jobsites={dataset.jobsites}
                  emptyTitle="No Live Risk Zones"
                  emptyDetail="Site risk zones will appear after this company has jobsites and field activity."
                />
              ) : isLiveEmpty ? (
                <EmptyLivePanel
                  title="No Live Risk Zones"
                  detail="Site risk zones will appear after this company has jobsites and field activity."
                />
              ) : (
                <RiskHeatMap variant="dashboard" />
              )}
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle title="Recent Jobsite Activity" />
            <div className="mt-5">
              {dataset.events.length > 0 ? (
                <EventTimeline events={dataset.events} />
              ) : (
                <EmptyLivePanel
                  title="No Recent Activity"
                  detail="Jobsite events, observations, corrective actions, and reports will appear here as live records are created."
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EmptyLivePanel({ title, detail }: { title: string; detail: string }) {
  const displayTitle = formatTitleCase(title) || title;

  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
      <p className="text-sm font-black text-slate-950">{displayTitle}</p>
      <p className="mt-2 text-sm font-semibold leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function CommandEmptyState({
  isLiveEmpty,
  onCreate,
  onClear,
  onSample,
}: {
  isLiveEmpty: boolean;
  onCreate: () => void;
  onClear: () => void;
  onSample: () => void;
}) {
  return (
    <div className="mt-5 rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-8">
      <div className="mx-auto max-w-2xl text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-white text-blue-600 shadow-sm">
          <Building2 className="h-6 w-6" />
        </span>
        <p className="mt-4 text-lg font-black text-slate-950">
          {isLiveEmpty ? "Start the company command center with the first jobsite." : "No jobsites match the current command filters."}
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          {isLiveEmpty
            ? "Once a jobsite exists, this page ranks risk, open actions, permits, inspections, schedule hazards, documents, and activity in one safety-manager view."
            : "Clear the filters to return to the ranked portfolio, or use sample data to preview the full command center."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onCreate} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-sm">
            <Plus className="h-4 w-4" />
            New jobsite
          </button>
          <button type="button" onClick={onClear} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm">
            <FilterX className="h-4 w-4" />
            Clear filters
          </button>
          {isLiveEmpty ? (
            <button type="button" onClick={onSample} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-black text-blue-700 shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              View sample command center
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function riskDotClass(level: SafePredictJobsiteRecord["riskLevel"]) {
  if (level === "critical") return "bg-red-500";
  if (level === "high") return "bg-orange-500";
  if (level === "medium") return "bg-amber-400";
  return "bg-emerald-500";
}

function LiveJobsiteRiskList({
  jobsites,
  emptyTitle,
  emptyDetail,
}: {
  jobsites: SafePredictJobsiteRecord[];
  emptyTitle: string;
  emptyDetail: string;
}) {
  if (jobsites.length === 0) {
    return <EmptyLivePanel title={emptyTitle} detail={emptyDetail} />;
  }

  return (
    <div className="grid gap-3">
      {jobsites.slice(0, 6).map((jobsite) => (
        <Link
          key={jobsite.id}
          href={`/safe-predict/jobsites/${encodeURIComponent(jobsite.id)}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 transition hover:bg-white"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-slate-900">{jobsite.name}</span>
            <span className="mt-1 block text-xs font-semibold text-slate-500">{jobsite.openActions} open actions</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 text-sm font-black text-slate-800">
            <span className={cx("h-2.5 w-2.5 rounded-full", riskDotClass(jobsite.riskLevel))} />
            {clampRiskScore(jobsite.riskScore)}
          </span>
        </Link>
      ))}
    </div>
  );
}

function JobsiteCommandDashboard({
  summary,
  mode,
  onRefreshSchedule,
  onCreateAction,
  onOpenTab,
}: {
  summary: JobsiteCommandSummary;
  mode: "demo" | "live";
  onRefreshSchedule: () => void | Promise<void>;
  onCreateAction: () => void;
  onOpenTab: (tab: DetailTab) => void;
}) {
  return (
    <Card className="mb-5 p-5">
      <div className="grid gap-5 2xl:grid-cols-[1fr_420px]">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-blue-600">Safety Manager Command Center</p>
              <h2 className="mt-1 text-2xl font-black leading-tight text-slate-950">Today&apos;s Jobsite Decision Board</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">{summary.aiRiskSummary}</p>
            </div>
            {mode === "live" ? (
              <AiEngineRefreshButton
                days={30}
                jobsiteId={summary.site.id}
                label="Refresh site AI"
                onRefreshed={onRefreshSchedule}
                compact
                buttonClassName="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60"
              />
            ) : (
              <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-600">
                <Sparkles className="h-4 w-4" />
                Sample AI brief
              </span>
            )}
          </div>

          <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-blue-700">Next best action</p>
                <p className="mt-1 text-sm font-black leading-6 text-slate-950">{summary.nextBestAction}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onCreateAction} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-black text-white shadow-sm">
                  <Plus className="h-3.5 w-3.5" />
                  Create action
                </button>
                <button type="button" onClick={() => onOpenTab("Schedule")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 shadow-sm">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Open schedule
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {summary.attentionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenTab(item.targetTab)}
                className={cx("rounded-lg border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm", attentionToneClass(item.tone))}
              >
                <span className="block text-xs font-black uppercase tracking-wide">{item.actionLabel}</span>
                <span className="mt-1 block text-sm font-black leading-5 text-slate-950">{formatTitleCase(item.title) || item.title}</span>
                <span className="mt-1 block text-xs font-semibold leading-5 opacity-90">{item.detail}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-blue-600 shadow-sm">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Next schedule risk</p>
                <p className="mt-1 truncate text-sm font-black text-slate-950">{summary.nextScheduleTitle}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{summary.nextScheduleDate} | {summary.highRiskScheduleCount} high-risk item{summary.highRiskScheduleCount === 1 ? "" : "s"}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {summary.readinessSignals.map((signal) => (
              <button
                key={signal.id}
                type="button"
                onClick={() => onOpenTab(signal.targetTab)}
                className={cx("rounded-lg border border-slate-200 border-l-4 bg-white p-3 text-left shadow-sm hover:bg-slate-50", signalBorderClass(signal.tone))}
              >
                <span className="block text-xs font-black uppercase tracking-wide text-slate-500">{signal.label}</span>
                <span className="mt-1 block text-lg font-black text-slate-950">{signal.value}</span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">{signal.detail}</span>
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-black text-slate-950">Latest Site Activity</p>
            <div className="mt-3 space-y-2">
              {summary.activityItems.length > 0 ? (
                summary.activityItems.map((item) => (
                  <button key={item.id} type="button" onClick={() => onOpenTab("Activity Timeline")} className="flex w-full items-start justify-between gap-3 rounded-lg bg-slate-50 p-3 text-left hover:bg-blue-50/50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-slate-950">{formatTitleCase(item.title) || item.title}</span>
                      <span className="mt-1 line-clamp-2 block text-xs font-semibold leading-5 text-slate-600">{item.detail}</span>
                    </span>
                    <span className={cx("shrink-0 rounded-full border px-2 py-1 text-[11px] font-black", attentionToneClass(item.tone))}>{item.meta}</span>
                  </button>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs font-semibold text-slate-500">
                  No activity has been recorded for this jobsite yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SafePredictJobsiteEditor({
  site,
  onCancel,
  onSave,
}: {
  site: SafePredictJobsiteRecord;
  onCancel: () => void;
  onSave: (input: SafePredictJobsiteUpdateInput) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SafePredictJobsiteUpdateInput>({
    name: site.name,
    jobsiteNumber: site.jobsiteNumber ?? site.code ?? "",
    projectNumber: site.projectNumber ?? "",
    location: site.address === "Not set" ? "" : site.address,
    projectManager: site.projectManager === "Not assigned" ? "" : site.projectManager,
    safetyLead: site.siteLead === "Not set" ? "" : site.siteLead,
    customerCompanyName: site.customerName === "Not set" ? "" : site.customerName,
    customerReportEmail: site.customerReportEmail === "Not set" ? "" : site.customerReportEmail,
    startDate: site.startDate ?? "",
    endDate: site.endDate ?? "",
    notes: site.notes ?? "",
    zipCode: site.zipCode ?? "",
    addressLine1: site.addressLine1 ?? (site.address === "Not set" ? "" : site.address),
    addressLine2: site.addressLine2 ?? "",
    city: site.city ?? "",
    state: site.state ?? "",
    country: site.country ?? "",
    status: site.status,
  });

  function updateField<K extends keyof SafePredictJobsiteUpdateInput>(key: K, value: SafePredictJobsiteUpdateInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        jobsiteNumber: form.jobsiteNumber?.trim() ?? "",
        projectNumber: form.projectNumber?.trim() ?? "",
        location: form.location?.trim() ?? "",
        projectManager: form.projectManager?.trim() ?? "",
        safetyLead: form.safetyLead?.trim() ?? "",
        customerCompanyName: form.customerCompanyName?.trim() ?? "",
        customerReportEmail: form.customerReportEmail?.trim() ?? "",
        notes: form.notes?.trim() ?? "",
        zipCode: form.zipCode?.trim() ?? "",
        addressLine1: form.addressLine1?.trim() ?? "",
        addressLine2: form.addressLine2?.trim() ?? "",
        city: form.city?.trim() ?? "",
        state: form.state?.trim() ?? "",
        country: form.country?.trim() ?? "",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-5 p-5">
      <form onSubmit={(event) => void submitForm(event)} className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SectionTitle title="Edit Jobsite Information" hint="These fields drive the jobsite header, weather location, reports, and customer-facing details." />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onCancel} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50">
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button type="submit" disabled={saving || !form.name.trim()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              <CheckCircle2 className="h-4 w-4" />
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          <EditorField label="Jobsite name" value={form.name} onChange={(value) => updateField("name", value)} required />
          <EditorField label="Jobsite number" value={form.jobsiteNumber ?? ""} onChange={(value) => updateField("jobsiteNumber", value)} />
          <EditorField label="Project number" value={form.projectNumber ?? ""} onChange={(value) => updateField("projectNumber", value)} />
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Status</span>
            <select value={form.status ?? "active"} onChange={(event) => updateField("status", event.target.value as SafePredictJobsiteStatus)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="action-needed">Action Needed</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <EditorField label="Project manager" value={form.projectManager ?? ""} onChange={(value) => updateField("projectManager", value)} />
          <EditorField label="Safety lead" value={form.safetyLead ?? ""} onChange={(value) => updateField("safetyLead", value)} />
          <EditorField label="Customer" value={form.customerCompanyName ?? ""} onChange={(value) => updateField("customerCompanyName", value)} />
          <EditorField label="Report email" value={form.customerReportEmail ?? ""} onChange={(value) => updateField("customerReportEmail", value)} type="email" />
          <EditorField label="Street address" value={form.addressLine1 ?? ""} onChange={(value) => updateField("addressLine1", value)} className="lg:col-span-2" />
          <EditorField label="Address line 2" value={form.addressLine2 ?? ""} onChange={(value) => updateField("addressLine2", value)} />
          <EditorField label="City" value={form.city ?? ""} onChange={(value) => updateField("city", value)} />
          <EditorField label="State" value={form.state ?? ""} onChange={(value) => updateField("state", value)} />
          <EditorField label="ZIP" value={form.zipCode ?? ""} onChange={(value) => updateField("zipCode", value)} />
          <EditorField label="Country" value={form.country ?? ""} onChange={(value) => updateField("country", value)} />
          <EditorField label="General location" value={form.location ?? ""} onChange={(value) => updateField("location", value)} />
          <EditorField label="Start date" value={form.startDate ?? ""} onChange={(value) => updateField("startDate", value)} type="date" />
          <EditorField label="End date" value={form.endDate ?? ""} onChange={(value) => updateField("endDate", value)} type="date" />
          <label className="block lg:col-span-4">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Notes</span>
            <textarea value={form.notes ?? ""} onChange={(event) => updateField("notes", event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </label>
        </div>
      </form>
    </Card>
  );
}

function EditorField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

type SafePredictJobsiteAssignment = {
  id?: string;
  user_id: string;
  jobsite_id: string;
  role?: string | null;
};

function safePredictRoleNeedsJobsiteAssignment(role?: string | null) {
  const normalized = (role ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  return (
    normalized === "project_manager" ||
    normalized === "field_supervisor" ||
    normalized === "foreman" ||
    normalized === "field_user" ||
    normalized === "read_only" ||
    normalized === "company_user"
  );
}

function roleLabel(role: string) {
  return formatTitleCase(role.replace(/_/g, " ")) || role;
}

function JobsiteAssignmentManager({
  site,
  dataset,
  mode,
  onChanged,
}: {
  site: SafePredictJobsiteRecord;
  dataset: SafePredictDataset;
  mode: "demo" | "live";
  onChanged: () => void;
}) {
  const [assignments, setAssignments] = useState<SafePredictJobsiteAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const assignmentMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const assignment of assignments) {
      if (!assignment.user_id || !assignment.jobsite_id) continue;
      const existing = map.get(assignment.user_id) ?? new Set<string>();
      existing.add(assignment.jobsite_id);
      map.set(assignment.user_id, existing);
    }
    return map;
  }, [assignments]);

  const fieldScopedUsers = useMemo(
    () => dataset.assignableUsers.filter((user) => safePredictRoleNeedsJobsiteAssignment(user.role)),
    [dataset.assignableUsers]
  );
  const companyWideUsers = useMemo(
    () => dataset.assignableUsers.filter((user) => !safePredictRoleNeedsJobsiteAssignment(user.role)),
    [dataset.assignableUsers]
  );

  const loadAssignments = useCallback(async () => {
    if (mode !== "live") {
      setAssignments([]);
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      const response = await fetch("/api/company/jobsite-assignments", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const payload = (await response.json().catch(() => null)) as { assignments?: SafePredictJobsiteAssignment[]; warning?: string; error?: string } | null;
      if (!response.ok) {
        setMessage(payload?.warning || payload?.error || "Jobsite assignments could not be loaded.");
        return;
      }
      setAssignments(Array.isArray(payload?.assignments) ? payload.assignments : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Jobsite assignments could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  async function toggleAssignment(userId: string) {
    if (mode !== "live") {
      setMessage("Assignments are saved in live company workspaces.");
      return;
    }
    const user = dataset.assignableUsers.find((candidate) => candidate.id === userId);
    if (!user) return;
    const currentIds = Array.from(assignmentMap.get(userId) ?? new Set<string>());
    const isAssigned = currentIds.includes(site.id);
    const nextIds = isAssigned ? currentIds.filter((id) => id !== site.id) : [...currentIds, site.id];

    setSavingUserId(userId);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      const response = await fetch("/api/company/jobsite-assignments", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId, jobsiteIds: nextIds }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setMessage(payload?.error || "Could not update this assignment.");
        return;
      }
      setAssignments((current) => [
        ...current.filter((assignment) => assignment.user_id !== userId),
        ...nextIds.map((jobsiteId) => ({
          user_id: userId,
          jobsite_id: jobsiteId,
          role: user.role,
        })),
      ]);
      setMessage(isAssigned ? `${user.name} removed from this jobsite.` : `${user.name} assigned to this jobsite.`);
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update this assignment.");
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SectionTitle title="Jobsite Assignments" hint="Assign field-scoped users to this jobsite so their dashboards, work, and reports stay focused." />
        <button type="button" onClick={() => void loadAssignments()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60">
          <Users className="h-4 w-4" />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {message ? (
        <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
          {message}
        </p>
      ) : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {fieldScopedUsers.map((user) => {
          const assigned = assignmentMap.get(user.id)?.has(site.id) ?? false;
          return (
            <article key={user.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{user.name}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">{user.email}</p>
                </div>
                <span className={cx("shrink-0 rounded-full border px-2 py-1 text-[11px] font-black", assigned ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600")}>
                  {assigned ? "Assigned" : "Not assigned"}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">{roleLabel(user.role)}</span>
                <button type="button" onClick={() => void toggleAssignment(user.id)} disabled={savingUserId === user.id} className={cx("inline-flex h-9 items-center rounded-lg px-3 text-xs font-black shadow-sm transition disabled:cursor-wait disabled:opacity-60", assigned ? "border border-red-200 bg-white text-red-700 hover:bg-red-50" : "bg-blue-600 text-white hover:bg-blue-700")}>
                  {savingUserId === user.id ? "Saving..." : assigned ? "Remove" : "Assign"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {fieldScopedUsers.length === 0 ? (
        <EmptyTabPanel title="No Assignable Users Yet" detail="Add field-scoped users or change user roles in Team Access before assigning them to this jobsite." actionLabel="Open team access" href="/safe-predict/team-access" />
      ) : null}
      {companyWideUsers.length > 0 ? (
        <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">
          {companyWideUsers.length} company-wide user{companyWideUsers.length === 1 ? "" : "s"} already have access across jobsites.
        </p>
      ) : null}
    </Card>
  );
}

export function SafePredictJobsiteDetail({ jobsiteId }: { jobsiteId: string }) {
  const { dataset, updateActionStatus, addDraftAction, addDraftPermit, updatePermit, updateJobsite, refreshLiveData, setSelectedJobsiteId, mode } = useSafePredictData();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DetailTab>("Overview");
  const [jobsiteEditorOpen, setJobsiteEditorOpen] = useState(false);
  const [jobsiteMessage, setJobsiteMessage] = useState("");
  const manualScheduleTaskIdRef = useRef(0);
  const scheduleTemplateInputRef = useRef<HTMLInputElement | null>(null);
  const scheduleTaskFormRef = useRef<HTMLDivElement | null>(null);
  const [manualScheduleTasks, setManualScheduleTasks] = useState<ScheduledRiskEvent[]>([]);
  const [persistedScheduleTasks, setPersistedScheduleTasks] = useState<ScheduledRiskEvent[]>([]);
  const [scheduleLoadError, setScheduleLoadError] = useState<string | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [schedulePrediction, setSchedulePrediction] = useState<ScheduleHazardPredictionResponse | null>(null);
  const [schedulePredictionLoading, setSchedulePredictionLoading] = useState(false);
  const [schedulePredictionError, setSchedulePredictionError] = useState<string | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleImporting, setScheduleImporting] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [permitFormOpen, setPermitFormOpen] = useState(false);
  const [permitFormMode, setPermitFormMode] = useState<SafePredictPermitFormMode>("view");
  const [activePermit, setActivePermit] = useState<SafePredictDataset["permits"][number] | null>(null);
  const [permitSaving, setPermitSaving] = useState(false);
  const [permitMessage, setPermitMessage] = useState("");
  const [editingScheduleTask, setEditingScheduleTask] = useState<ScheduledRiskEvent | null>(null);
  const [weatherOverview, setWeatherOverview] = useState<{ jobsiteId: string; data: JobsiteWeatherOverviewData } | null>(null);
  const [weatherRefreshing, setWeatherRefreshing] = useState(false);
  const [weatherTestSending, setWeatherTestSending] = useState(false);
  const [weatherTestMessage, setWeatherTestMessage] = useState<string | null>(null);
  const [weatherTestTone, setWeatherTestTone] = useState<"success" | "error" | "neutral">("neutral");
  const weatherAutoEnableAttemptsRef = useRef<Set<string>>(new Set());
  const [scheduleTaskForm, setScheduleTaskForm] = useState<ScheduleTaskForm>({
    title: "",
    dueDate: "",
    shiftStartTime: "",
    shiftEndTime: "",
    trade: "",
    taskType: "",
    owner: "",
    workArea: "",
    crewSize: "",
    riskLevel: "high",
    workEndDate: "",
    hazards: "",
    permits: "",
    controls: "",
    notes: "",
  });
  const site = jobsiteById(dataset, jobsiteId) ?? {
    id: jobsiteId,
    code: "JOB",
    name: "Selected jobsite",
    address: "",
    cityState: "",
    projectType: "",
    phase: "Planning",
    siteLead: "Unassigned",
    workforceCount: 0,
    activePermits: 0,
    openActions: 0,
    riskScore: 0,
    riskLevel: "low",
    status: "planned",
    projectManager: "Unassigned",
    customerName: "",
    customerReportEmail: "",
    startDate: "",
    endDate: "",
    inspectionGaps: 0,
    incidentCount: 0,
    observationCount: 0,
  } satisfies SafePredictJobsiteRecord;
  const siteEmployees = dataset.employees.filter((employee) => employee.assignedSiteId === site.id);
  const siteActions = siteScoped(dataset.actions, site.id);
  const siteAlerts = siteScoped(dataset.alerts, site.id);
  const siteInspections = siteScoped(dataset.inspections, site.id);
  const siteIncidents = siteScoped(dataset.incidents, site.id);
  const siteObservations = siteScoped(dataset.observations, site.id);
  const siteHazards = siteScoped(dataset.hazards, site.id);
  const sitePermits = siteScoped(dataset.permits, site.id);
  const siteDocuments = siteScoped(dataset.documents, site.id);
  const siteReports = siteScoped(dataset.reports, site.id);
  const siteEvents = dataset.events.filter((event) => event.detail.toLowerCase().includes(site.name.toLowerCase().split(" ")[0]) || event.detail.toLowerCase().includes(site.name.toLowerCase()));
  const displayedRiskScore = clampRiskScore(site.riskScore);
  const scheduleJobsiteId = site.id;
  const scheduleFallbackOwner = site.siteLead;
  const scheduleFallbackLocation = site.phase;
  const fallbackWeatherOverview = jobsiteWeatherFromSite(site);
  const displayedWeatherOverview = mode === "live" && weatherOverview?.jobsiteId === site.id ? weatherOverview.data : fallbackWeatherOverview;

  useEffect(() => {
    let cancelled = false;
    if (mode !== "live") {
      return;
    }

    async function loadWeatherOverview() {
      const fallbackWeather = jobsiteWeatherFromSite(site);
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token ?? null;
        const response = await fetch(`/api/company/jobsites/${encodeURIComponent(site.id)}/weather`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const payload = (await response.json().catch(() => null)) as JobsiteWeatherOverviewData | null;
        if (cancelled) return;
        if (!response.ok) {
          setWeatherOverview({ jobsiteId: site.id, data: { ...fallbackWeather, error: payload?.error || "Weather settings could not be loaded." } });
          return;
        }
        const loadedWeather = mergeJobsiteWeatherOverview(fallbackWeather, payload);
        const loadedJobsiteWeather = loadedWeather.jobsite;
        const savedZip = String(loadedJobsiteWeather?.zip_code ?? site.zipCode ?? "").trim();
        const autoEnableKey = `${site.id}:${savedZip}`;
        if (
          savedZip &&
          !loadedJobsiteWeather?.weather_enabled &&
          !weatherAutoEnableAttemptsRef.current.has(autoEnableKey)
        ) {
          weatherAutoEnableAttemptsRef.current.add(autoEnableKey);
          const activateResponse = await fetch(`/api/company/jobsites/${encodeURIComponent(site.id)}/weather`, {
            method: "POST",
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
          const activatePayload = (await activateResponse.json().catch(() => null)) as JobsiteWeatherOverviewData | null;
          if (cancelled) return;
          if (activateResponse.ok) {
            setWeatherOverview({
              jobsiteId: site.id,
              data: mergeJobsiteWeatherOverview(loadedWeather, activatePayload),
            });
            refreshLiveData();
            return;
          }
          if (activateResponse.status === 401 || activateResponse.status === 403) {
            setWeatherOverview({ jobsiteId: site.id, data: loadedWeather });
            return;
          }
          setWeatherOverview({
            jobsiteId: site.id,
            data: {
              ...loadedWeather,
              error: activatePayload?.error || "Weather monitoring could not be turned on for this ZIP.",
            },
          });
          return;
        }
        setWeatherOverview({
          jobsiteId: site.id,
          data: loadedWeather,
        });
      } catch (error) {
        if (!cancelled) {
          setWeatherOverview({ jobsiteId: site.id, data: { ...fallbackWeather, error: error instanceof Error ? error.message : "Weather settings could not be loaded." } });
        }
      }
    }

    void loadWeatherOverview();
    return () => {
      cancelled = true;
    };
  }, [mode, refreshLiveData, site]);

  async function refreshJobsiteWeather() {
    if (mode !== "live" || weatherRefreshing) return;

    setWeatherRefreshing(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      const response = await fetch(`/api/company/jobsites/${encodeURIComponent(site.id)}/weather`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const payload = (await response.json().catch(() => null)) as JobsiteWeatherOverviewData | null;
      if (!response.ok) {
        setWeatherOverview({
          jobsiteId: site.id,
          data: {
            ...fallbackWeatherOverview,
            ...(displayedWeatherOverview ?? {}),
            error: payload?.error || "Weather refresh failed.",
          },
        });
        return;
      }

      setWeatherOverview({
        jobsiteId: site.id,
        data: mergeJobsiteWeatherOverview(fallbackWeatherOverview, payload),
      });
      refreshLiveData();
    } catch (error) {
      setWeatherOverview({
        jobsiteId: site.id,
        data: {
          ...fallbackWeatherOverview,
          ...(displayedWeatherOverview ?? {}),
          error: error instanceof Error ? error.message : "Weather refresh failed.",
        },
      });
    } finally {
      setWeatherRefreshing(false);
    }
  }

  async function sendWeatherTestNotification() {
    if (mode !== "live" || weatherTestSending) return;

    setWeatherTestSending(true);
    setWeatherTestTone("neutral");
    setWeatherTestMessage("Sending test weather alert...");
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      const response = await fetch(`/api/company/jobsites/${encodeURIComponent(site.id)}/weather`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "send_test_notification", channels: ["email", "sms"] }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        error?: string;
        result?: {
          deliveriesSent?: number;
          recipientsSeen?: number;
          results?: Array<{ error?: string | null; channel?: string; status?: string; recipientName?: string | null }>;
        };
      } | null;
      const firstError = payload?.result?.results?.find((item) => item.status === "failed" && item.error)?.error;
      if (!response.ok) {
        setWeatherTestTone("error");
        setWeatherTestMessage(firstError || payload?.message || payload?.error || "Weather test notification could not be sent.");
        return;
      }

      setWeatherTestTone("success");
      setWeatherTestMessage(
        payload?.message ||
          `Weather test notification sent to ${payload?.result?.recipientsSeen ?? 0} recipient${payload?.result?.recipientsSeen === 1 ? "" : "s"}.`
      );
    } catch (error) {
      setWeatherTestTone("error");
      setWeatherTestMessage(error instanceof Error ? error.message : "Weather test notification could not be sent.");
    } finally {
      setWeatherTestSending(false);
    }
  }

  function openPermitForm(permit: SafePredictDataset["permits"][number], nextMode: SafePredictPermitFormMode) {
    setActivePermit(permit);
    setPermitFormMode(nextMode);
    setPermitMessage("");
    setPermitFormOpen(true);
  }

  function permitStatusApiValue(status: SafePredictDataset["permits"][number]["status"]) {
    if (status === "Active") return "active";
    if (status === "Expired") return "expired";
    return "draft";
  }

  function permitTypeApiValue(type: string) {
    return type.toLowerCase().replace(/\s*\/\s*/g, "_").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function permitDueAtValue(expiresAt: string) {
    const trimmed = expiresAt.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }

  async function savePermit(input: SafePredictPermitFormSaveInput) {
    const title = input.title.trim();
    if (!title || !input.siteId) {
      setPermitMessage("Permit title and jobsite are required.");
      return;
    }

    setPermitSaving(true);
    setPermitMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;

      if (mode === "live" && token) {
        const response = await fetch("/api/company/permits", {
          method: input.id ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: input.id,
            title,
            permitType: permitTypeApiValue(input.type),
            severity: input.riskLevel,
            category: "safety",
            jobsiteId: input.siteId,
            ownerUserId: null,
            dueAt: permitDueAtValue(input.expiresAt),
            sifFlag: input.riskLevel === "critical" || input.riskLevel === "high",
            escalationLevel: input.riskLevel === "critical" ? "urgent" : "none",
            escalationReason: "",
            stopWorkStatus: input.status === "Expired" ? "stop_work_requested" : "normal",
            stopWorkReason: input.status === "Expired" ? "Expired permit requires hold before work proceeds." : "",
            jsaActivityId: null,
            observationId: null,
            status: permitStatusApiValue(input.status),
            permitForm: input.permitForm,
          }),
        });
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          setPermitMessage(payload?.error || "Could not save the permit.");
          return;
        }
      }

      const nextPermit: SafePredictDataset["permits"][number] = {
        ...(activePermit ?? {}),
        id: input.id || activePermit?.id || `draft-permit-${Date.now()}`,
        title,
        siteId: input.siteId,
        type: input.type,
        status: input.status,
        owner: input.owner.trim() || "Unassigned",
        expiresAt: input.expiresAt || "No expiration set",
        riskLevel: input.riskLevel,
        permitForm: input.permitForm,
        readiness: permitFormReadinessLabel(input.permitForm),
      };
      if (input.id || activePermit) {
        updatePermit(nextPermit);
      } else {
        addDraftPermit(nextPermit);
      }
      refreshLiveData();
      setPermitFormOpen(false);
      setActivePermit(null);
      setPermitMessage(mode === "live" && token ? "Permit saved to the company permit register." : "Permit saved locally.");
    } catch (error) {
      setPermitMessage(error instanceof Error ? error.message : "Could not save the permit.");
    } finally {
      setPermitSaving(false);
    }
  }

  const loadPersistedSchedule = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? null;
      const response = await fetch(`/api/company/jobsites/${encodeURIComponent(scheduleJobsiteId)}/schedule`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const data = (await response.json().catch(() => null)) as {
        items?: SafePredictScheduleApiItem[];
        warning?: string;
        error?: string;
      } | null;
      if (!response.ok) {
        setScheduleLoadError(data?.error || "Saved schedule tasks could not be loaded.");
        setPersistedScheduleTasks([]);
        return;
      }
      const items = Array.isArray(data?.items) ? data.items : [];
      setPersistedScheduleTasks(
        items.map((item) => ({
          ...scheduleApiItemToEvent(item, { owner: scheduleFallbackOwner, location: scheduleFallbackLocation }),
          editForm: item.readOnly ? undefined : scheduleFormForApiItem(item),
          readOnly: Boolean(item.readOnly),
          scheduleItemId: item.source === "manual" ? item.id : undefined,
        }))
      );
      setScheduleLoadError(data?.warning ?? null);
    } catch (error) {
      setScheduleLoadError(error instanceof Error ? error.message : "Saved schedule tasks could not be loaded.");
      setPersistedScheduleTasks([]);
    }
  }, [scheduleFallbackLocation, scheduleFallbackOwner, scheduleJobsiteId]);

  useEffect(() => {
    if (mode !== "live") {
      const handle = window.setTimeout(() => {
        setPersistedScheduleTasks([]);
        setScheduleLoadError(null);
      }, 0);
      return () => window.clearTimeout(handle);
    }
    void loadPersistedSchedule();
  }, [loadPersistedSchedule, mode]);

  const alertScheduleEvents: ScheduledRiskEvent[] = siteAlerts.slice(0, 4).map((alert, index) => ({
    id: `alert-${alert.id}`,
    title: alert.title,
    type: alert.source,
    date: index === 0 ? "Today" : `Next ${index + 1} shifts`,
    owner: site.siteLead,
    location: alert.area,
    riskLevel: alert.riskLevel,
    detail: alert.detail,
    controls: ["Pre-task brief", "Supervisor verification"],
    source: "Predictive signal",
    startDate: scheduleDateLabelToDateOnly(index === 0 ? "Today" : `Next ${index + 1} shifts`),
  }));
  const hazardScheduleEvents: ScheduledRiskEvent[] = siteHazards.map((hazard) => ({
    id: `hazard-${hazard.id}`,
    title: hazard.title,
    type: "Hazard control",
    date: hazard.dueDate,
    owner: hazard.owner,
    location: hazard.controlStatus,
    riskLevel: hazard.riskLevel,
    detail: `${hazard.controlStatus} before work continues.`,
    controls: [hazard.controlStatus, "Field verification"],
    source: "Hazard register",
    startDate: scheduleDateLabelToDateOnly(hazard.dueDate),
  }));
  const inspectionScheduleEvents: ScheduledRiskEvent[] = siteInspections.map((inspection) => ({
    id: `inspection-${inspection.id}`,
    title: inspection.title,
    type: "Inspection",
    date: inspection.dueDate,
    owner: inspection.inspector,
    location: inspection.checklist,
    riskLevel: inspection.riskLevel,
    detail: `${inspection.failedItems} failed check${inspection.failedItems === 1 ? "" : "s"} currently tied to this inspection.`,
    controls: inspection.failedItems > 0 ? ["Close failed checks", "Document verification"] : ["Complete checklist"],
    source: "Inspection plan",
    startDate: scheduleDateLabelToDateOnly(inspection.dueDate),
  }));
  const permitScheduleEvents: ScheduledRiskEvent[] = sitePermits.map((permit) => ({
    id: `permit-${permit.id}`,
    title: `${permit.type} permit review`,
    type: "Permit",
    date: permit.expiresAt,
    owner: permit.owner,
    location: permit.status,
    riskLevel: permit.riskLevel,
    detail: `${permit.status} permit needs review before scheduled work.`,
    controls: ["Permit check", "Crew signoff"],
    source: "Permit center",
    startDate: scheduleDateLabelToDateOnly(permit.expiresAt),
  }));
  const actionScheduleEvents: ScheduledRiskEvent[] = siteActions
    .filter((action) => action.status !== "Closed")
    .slice(0, 4)
    .map((action) => ({
      id: `action-${action.id}`,
      title: action.title,
      type: "Task",
      date: action.dueDate,
      owner: action.assignee,
      location: action.linkedRisk,
      riskLevel: action.priority,
      detail: `${action.status} corrective action from ${action.createdFrom}.`,
      controls: ["Complete task", "Verify effectiveness"],
      source: "Corrective actions",
      startDate: scheduleDateLabelToDateOnly(action.dueDate),
    }));
  const upcomingRiskEvents = (dedupeScheduleEvents([...persistedScheduleTasks, ...manualScheduleTasks, ...alertScheduleEvents, ...hazardScheduleEvents, ...inspectionScheduleEvents, ...permitScheduleEvents, ...actionScheduleEvents]) as ScheduledRiskEvent[])
    .sort((a, b) => riskSort(b.riskLevel) - riskSort(a.riskLevel) || a.title.localeCompare(b.title));
  const commandSummary = buildJobsiteCommandSummary(dataset, site, upcomingRiskEvents);

  const highRiskScheduleCount = upcomingRiskEvents.filter((event) => event.riskLevel === "critical" || event.riskLevel === "high").length;
  const addedScheduleCount = upcomingRiskEvents.filter((event) => event.isManual).length;
  const scheduleCalendarDays = buildScheduleCalendarDays(upcomingRiskEvents, calendarMonth);
  const selectedCalendarEvents = selectedCalendarDate
    ? upcomingRiskEvents.filter((event) => scheduleEventDateKeys(event).includes(selectedCalendarDate))
    : upcomingRiskEvents;
  const schedulePermitReadiness = buildSchedulePermitReadiness(upcomingRiskEvents, sitePermits);
  const blockedSchedulePermitItems = schedulePermitReadiness.filter((item) => item.status !== "ready");
  const openSiteActionsCount = siteActions.filter((action) => action.status !== "Closed").length;
  const tabCounts: Partial<Record<DetailTab, number>> = {
    "Corrective Actions": openSiteActionsCount,
    Workforce: siteEmployees.length || site.workforceCount,
    Schedule: upcomingRiskEvents.length,
    Permits: blockedSchedulePermitItems.length || sitePermits.length || site.activePermits,
    Inspections: siteInspections.filter((inspection) => inspection.failedItems > 0 || inspection.status === "Overdue" || inspection.status === "Failed Check").length || site.inspectionGaps,
    "Incidents & Observations": siteIncidents.length + siteObservations.length,
    "Documents & Reports": siteDocuments.length + siteReports.length,
    "Activity Timeline": siteEvents.length || dataset.events.length,
  };

  function updateScheduleTaskForm<K extends keyof ScheduleTaskForm>(key: K, value: ScheduleTaskForm[K]) {
    setScheduleTaskForm((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    const hasPredictionInputs = Boolean(scheduleTaskForm.trade && scheduleTaskForm.taskType && scheduleTaskForm.workArea);
    if (!hasPredictionInputs) {
      const handle = window.setTimeout(() => {
        setSchedulePrediction(null);
        setSchedulePredictionError(null);
        setSchedulePredictionLoading(false);
      }, 0);
      return () => window.clearTimeout(handle);
    }

    const input = {
      title: "",
      trade: scheduleTaskForm.trade,
      taskType: scheduleTaskForm.taskType,
      workArea: scheduleTaskForm.workArea,
      crewSize: scheduleTaskForm.crewSize,
      shiftStartTime: scheduleTaskForm.shiftStartTime,
      shiftEndTime: scheduleTaskForm.shiftEndTime,
      notes: "",
    };

    if (mode !== "live") {
      const rules = buildRuleBasedScheduleHazardPrediction(input);
      const handle = window.setTimeout(() => {
        setSchedulePrediction({ ...rules, source: "rules", aiMeta: null });
        setSchedulePredictionError(null);
        setSchedulePredictionLoading(false);
      }, 0);
      return () => window.clearTimeout(handle);
    }

    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setSchedulePredictionLoading(true);
      setSchedulePredictionError(null);
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const response = await fetch(`/api/company/jobsites/${encodeURIComponent(site.id)}/schedule/predict`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify(input),
        });
        const data = (await response.json().catch(() => null)) as ScheduleHazardPredictionResponse | { error?: string } | null;
        const errorMessage = data && "error" in data ? data.error : null;
        if (cancelled) return;
        if (!response.ok || !data || errorMessage) {
          const rules = buildRuleBasedScheduleHazardPrediction(input);
          setSchedulePrediction({ ...rules, source: "rules_fallback", aiMeta: null });
          setSchedulePredictionError(errorMessage || "AI enrichment is unavailable; rules are shown.");
        } else {
          setSchedulePrediction(data as ScheduleHazardPredictionResponse);
        }
      } catch {
        if (!cancelled) {
          const rules = buildRuleBasedScheduleHazardPrediction(input);
          setSchedulePrediction({ ...rules, source: "rules_fallback", aiMeta: null });
          setSchedulePredictionError("AI enrichment is unavailable; rules are shown.");
        }
      } finally {
        if (!cancelled) setSchedulePredictionLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [
    mode,
    scheduleTaskForm.crewSize,
    scheduleTaskForm.shiftEndTime,
    scheduleTaskForm.shiftStartTime,
    scheduleTaskForm.taskType,
    scheduleTaskForm.trade,
    scheduleTaskForm.workArea,
    site.id,
  ]);

  function acceptSchedulePrediction() {
    if (!schedulePrediction) return;
    setScheduleTaskForm((current) => ({
      ...current,
      riskLevel: schedulePrediction.riskLevel,
      hazards: listText(schedulePrediction.hazardCategories),
      permits: listText(schedulePrediction.permitTriggers),
      controls: listText(schedulePrediction.requiredControls),
    }));
  }

  function schedulePredictionForForm(form: ScheduleTaskForm): ScheduleHazardPredictionResponse | null {
    if (!form.trade || !form.taskType || !form.workArea) return null;
    const rules = buildRuleBasedScheduleHazardPrediction({
      title: form.title,
      trade: form.trade,
      taskType: form.taskType,
      workArea: form.workArea,
      crewSize: form.crewSize,
      shiftStartTime: form.shiftStartTime,
      shiftEndTime: form.shiftEndTime,
      notes: form.notes,
    });
    return { ...rules, source: "rules", aiMeta: null };
  }

  function enrichScheduleFormWithPrediction(form: ScheduleTaskForm, prediction: ScheduleHazardPredictionResponse | null) {
    if (!prediction) return form;
    return {
      ...form,
      hazards: form.hazards || listText(prediction.hazardCategories),
      permits: form.permits || listText(prediction.permitTriggers),
      controls: form.controls || listText(prediction.requiredControls),
    };
  }

  function schedulePayloadForForm(form: ScheduleTaskForm, prediction: ScheduleHazardPredictionResponse | null) {
    const hazards = controlList(form.hazards);
    const permits = controlList(form.permits);
    const controls = controlList(form.controls);
    return {
      title: form.title.trim(),
      workStartDate: form.dueDate || new Date().toISOString().slice(0, 10),
      workEndDate: form.workEndDate || null,
      shiftStartTime: form.shiftStartTime || null,
      shiftEndTime: form.shiftEndTime || null,
      trade: form.trade,
      workArea: form.workArea,
      crewSize: form.crewSize ? Number(form.crewSize) : null,
      supervisorName: form.owner,
      riskLevel: form.riskLevel,
      isHighRisk: form.riskLevel === "critical" || form.riskLevel === "high",
      hazardCategories: hazards,
      permitTriggers: permits,
      requiredControls: controls,
      status: "planned",
      notes: form.notes,
      sourceMetadata: {
        ...(form.sourceMetadata ?? {}),
        ...(form.taskType ? { taskType: form.taskType } : {}),
        ...(prediction
          ? {
              schedulePrediction: {
                source: prediction.source,
                inputFingerprint: prediction.inputFingerprint ?? null,
                confidence: prediction.confidence,
                rationale: prediction.rationale,
                matchedSignals: prediction.matchedSignals,
              },
            }
          : {}),
      },
    };
  }

  async function scheduleAccessToken() {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function saveScheduleFormToApi(form: ScheduleTaskForm, prediction: ScheduleHazardPredictionResponse | null, accessToken?: string | null) {
    const response = await fetch(`/api/company/jobsites/${encodeURIComponent(site.id)}/schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(schedulePayloadForForm(form, prediction)),
    });
    const data = (await response.json().catch(() => null)) as { error?: string; message?: string; importAction?: "created" | "updated" } | null;
    return {
      ok: response.ok,
      message: data?.message,
      importAction: data?.importAction ?? "created",
      error: data?.error || (response.ok ? null : "Schedule task could not be saved."),
    };
  }

  async function updateScheduleFormInApi(
    itemId: string,
    form: ScheduleTaskForm,
    prediction: ScheduleHazardPredictionResponse | null,
    accessToken?: string | null
  ) {
    const response = await fetch(`/api/company/jobsites/${encodeURIComponent(site.id)}/schedule`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        itemId,
        ...schedulePayloadForForm(form, prediction),
      }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    return {
      ok: response.ok,
      message: data?.message,
      error: data?.error || (response.ok ? null : "Schedule task could not be updated."),
    };
  }

  function scheduleEventForForm(
    form: ScheduleTaskForm,
    prediction: ScheduleHazardPredictionResponse | null,
    source: string,
    existingEvent?: ScheduledRiskEvent | null
  ) {
    const controls = controlList(form.controls);
    const importedEventId = form.sourceMetadata?.importKey ? `schedule-import-${form.sourceMetadata.importKey}` : null;
    const startDate = form.dueDate || toDateOnly(new Date());
    const endDate = form.workEndDate || startDate;
    if (!importedEventId && !existingEvent?.id) manualScheduleTaskIdRef.current += 1;
    return {
      id: importedEventId ?? existingEvent?.id ?? `manual-schedule-${manualScheduleTaskIdRef.current}`,
      title: form.title.trim(),
      type: form.taskType || "Task",
      date: startDate && endDate !== startDate ? `${compactScheduleDateLabel(startDate)}-${compactScheduleDateLabel(endDate)}` : compactDateLabel(form.dueDate),
      owner: form.owner.trim() || site.siteLead,
      location: form.workArea.trim() || site.phase,
      riskLevel: form.riskLevel,
      detail: prediction?.rationale || `${riskText(form.riskLevel)} risk scheduled task added for upcoming work planning.`,
      controls: controls.length > 0 ? controls : ["Pre-task plan", "Supervisor verification"],
      hazards: controlList(form.hazards),
      permits: controlList(form.permits),
      source,
      predictionSource: prediction?.source,
      isManual: true,
      startDate,
      endDate,
      dedupeKey: importedEventId ?? existingEvent?.dedupeKey,
      editForm: form,
      readOnly: existingEvent?.readOnly,
      scheduleItemId: existingEvent?.scheduleItemId,
    } satisfies ScheduledRiskEvent;
  }

  function resetScheduleTaskForm() {
    setScheduleTaskForm({
      title: "",
      dueDate: "",
      shiftStartTime: "",
      shiftEndTime: "",
      trade: "",
      taskType: "",
      owner: "",
      workArea: "",
      crewSize: "",
      riskLevel: "high",
      workEndDate: "",
      hazards: "",
      permits: "",
      controls: "",
      notes: "",
    });
    setSchedulePrediction(null);
    setSchedulePredictionError(null);
    setEditingScheduleTask(null);
  }

  async function addScheduleTask() {
    const title = scheduleTaskForm.title.trim();
    if (!title) return;
    setScheduleSaving(true);
    setScheduleMessage(null);
    const prediction = schedulePrediction;
    const formToSave = enrichScheduleFormWithPrediction({ ...scheduleTaskForm, title }, prediction);
    if (editingScheduleTask) {
      if (mode === "live" && editingScheduleTask.scheduleItemId) {
        try {
          const result = await updateScheduleFormInApi(editingScheduleTask.scheduleItemId, formToSave, prediction, await scheduleAccessToken());
          if (!result.ok) {
            setScheduleMessage(result.error || "Schedule task could not be updated.");
            setScheduleSaving(false);
            return;
          }
          setScheduleMessage(result.message || "Schedule task updated.");
          resetScheduleTaskForm();
          await loadPersistedSchedule();
          setScheduleSaving(false);
          return;
        } catch (error) {
          setScheduleMessage(error instanceof Error ? error.message : "Schedule task could not be updated.");
          setScheduleSaving(false);
          return;
        }
      }

      const updatedTask = scheduleEventForForm(formToSave, prediction, editingScheduleTask.source, editingScheduleTask);
      setManualScheduleTasks((current) => current.map((task) => (task.id === editingScheduleTask.id ? updatedTask : task)));
      setScheduleMessage("Schedule task updated.");
      resetScheduleTaskForm();
      setScheduleSaving(false);
      return;
    }

    if (mode === "live") {
      try {
        const result = await saveScheduleFormToApi(formToSave, prediction, await scheduleAccessToken());
        if (!result.ok) {
          setScheduleMessage(result.error || "Schedule task could not be saved.");
          setScheduleSaving(false);
          return;
        }
        setScheduleMessage(result.message || "Schedule task saved.");
        resetScheduleTaskForm();
        await loadPersistedSchedule();
        setScheduleSaving(false);
        return;
      } catch (error) {
        setScheduleMessage(error instanceof Error ? error.message : "Schedule task could not be saved.");
        setScheduleSaving(false);
        return;
      }
    }
    const task = scheduleEventForForm(formToSave, prediction, "Added task");
    setManualScheduleTasks((current) => [task, ...current]);
    resetScheduleTaskForm();
    setScheduleSaving(false);
  }

  function startEditingScheduleTask(event: ScheduledRiskEvent) {
    if (!event.editForm || event.readOnly) return;
    setActiveTab("Schedule");
    setEditingScheduleTask(event);
    setScheduleTaskForm(event.editForm);
    setSchedulePrediction(null);
    setSchedulePredictionError(null);
    setScheduleMessage(`Editing "${event.title}".`);
    window.setTimeout(() => scheduleTaskFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function downloadScheduleTemplate() {
    const blob = new Blob([`${scheduleTemplateHeader}\r\n`], { type: "text/csv;charset=utf-8" });
    triggerBrowserDownload(blob, scheduleTemplateFileName(site));
    setScheduleMessage("Schedule template downloaded. Fill one task per row, then upload the CSV.");
  }

  async function uploadScheduleTemplate(file: File | null) {
    if (!file) return;
    setScheduleImporting(true);
    setScheduleMessage(`Reading ${file.name}...`);
    try {
      const parsed = await parseScheduleTemplateFile(file);
      if (parsed.tasks.length === 0) {
        setScheduleMessage(parsed.errors.length > 0 ? parsed.errors.slice(0, 3).join(" ") : "No schedule rows were found in that template.");
        return;
      }

      const events: ScheduledRiskEvent[] = [];
      const saveErrors: string[] = [];
      let imported = 0;
      let updated = 0;
      const accessToken = mode === "live" ? await scheduleAccessToken() : null;

      for (const [index, task] of parsed.tasks.entries()) {
        const prediction = schedulePredictionForForm(task);
        const taskWithPrediction = enrichScheduleFormWithPrediction(task, prediction);
        if (mode === "live") {
          const result = await saveScheduleFormToApi(taskWithPrediction, prediction, accessToken);
          if (!result.ok) {
            saveErrors.push(`Row ${index + 2}: ${result.error || "save failed"}`);
            continue;
          }
          if (result.importAction === "updated") updated += 1;
          else imported += 1;
        } else {
          imported += 1;
        }
        events.push(scheduleEventForForm(taskWithPrediction, prediction, mode === "live" ? "Imported schedule task" : "Imported task"));
      }

      if (events.length > 0) {
        if (mode === "live") {
          await loadPersistedSchedule();
        } else {
          setManualScheduleTasks((current) => {
            const incomingIds = new Set(events.map((event) => event.id));
            return [...events, ...current.filter((event) => !incomingIds.has(event.id))];
          });
        }
      }
      const skipped = parsed.errors.length + saveErrors.length;
      const detail = [...parsed.errors, ...saveErrors].slice(0, 3).join(" ");
      const updatedText = updated ? ` Updated ${updated} existing task${updated === 1 ? "" : "s"}.` : "";
      const skippedText = skipped ? ` Skipped ${skipped} row${skipped === 1 ? "" : "s"}. ${detail}` : "";
      setScheduleMessage(`Imported ${imported} schedule task${imported === 1 ? "" : "s"} from ${file.name}.${updatedText}${skippedText} Added tasks are shown in the high-to-low risk plan below.`);
    } catch (error) {
      setScheduleMessage(error instanceof Error ? error.message : "Schedule template could not be uploaded.");
    } finally {
      setScheduleImporting(false);
      if (scheduleTemplateInputRef.current) scheduleTemplateInputRef.current.value = "";
    }
  }

  function createSiteAction() {
    const alert = siteAlerts[0] ?? dataset.alerts[0];
    const action = addDraftAction({
      title: `Review ${site.name} controls`,
      linkedRiskId: alert?.id ?? site.id,
      linkedRisk: alert?.title ?? `${site.name} risk review`,
      siteId: site.id,
      priority: site.riskLevel === "critical" || site.riskLevel === "high" ? "high" : "medium",
      createdFrom: "Manual",
    });
    setActiveTab("Corrective Actions");
    window.setTimeout(() => document.getElementById(action.id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  function createActionForSignal(signal: { id: string; title: string; riskLevel?: SafePredictRiskLevel; createdFrom: "Observation" | "Inspection" | "Hazard" | "Manual" }) {
    const action = addDraftAction({
      title: `Resolve ${signal.title.toLowerCase()}`,
      linkedRiskId: signal.id,
      linkedRisk: signal.title,
      siteId: site.id,
      priority: signal.riskLevel === "critical" || signal.riskLevel === "high" ? "high" : "medium",
      createdFrom: signal.createdFrom,
    });
    setActiveTab("Corrective Actions");
    window.setTimeout(() => document.getElementById(action.id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 pb-8 sm:px-7">
      <PageHeader
        title={site.name}
        subtitle={`${site.phase} - ${site.address}, ${site.cityState}`}
        actions={
          <>
            <Link href="/safe-predict/jobsites" className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm">
              All jobsites
            </Link>
            <button type="button" onClick={() => setJobsiteEditorOpen((open) => !open)} className="inline-flex h-11 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-100">
              <Pencil className="h-4 w-4" />
              Edit jobsite
            </button>
            <button type="button" onClick={() => setActiveTab("Documents & Reports")} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm">
              Files & reports
            </button>
            {mode === "live" ? (
              <AiEngineRefreshButton
                days={30}
                jobsiteId={site.id}
                label="Refresh site AI"
                onRefreshed={async () => {
                  await loadPersistedSchedule();
                  router.refresh();
                }}
                compact
                buttonClassName="inline-flex h-11 items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
              />
            ) : null}
            <ExportButton
              fileName={`safe-predict-${site.id}-jobsite-report.json`}
              label={`Export ${site.name} report`}
              payload={{ site, actions: siteActions, alerts: siteAlerts, inspections: siteInspections, incidents: siteIncidents, observations: siteObservations, permits: sitePermits, reports: siteReports }}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm"
            >
              Export report
            </ExportButton>
            <button type="button" onClick={createSiteAction} className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)]">
              <Plus className="h-4 w-4" />
              New site action
            </button>
          </>
        }
      />

      {permitMessage && !permitFormOpen ? (
        <p className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
          {permitMessage}
        </p>
      ) : null}

      {jobsiteMessage ? (
        <p className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
          {jobsiteMessage}
        </p>
      ) : null}

      {jobsiteEditorOpen ? (
        <SafePredictJobsiteEditor
          site={site}
          onCancel={() => setJobsiteEditorOpen(false)}
          onSave={async (input) => {
            setJobsiteMessage("");
            const result = await updateJobsite(site.id, input);
            if (!result.success) {
              setJobsiteMessage(result.error || "Jobsite information could not be saved.");
              return;
            }
            setJobsiteMessage("Jobsite information saved.");
            setJobsiteEditorOpen(false);
          }}
        />
      ) : null}

      {permitFormOpen ? (
        <SafePredictPermitFormDialog
          key={activePermit?.id ?? `create-${site.id}`}
          mode={permitFormMode}
          permit={activePermit}
          jobsites={dataset.jobsites}
          fallbackSiteId={site.id}
          saving={permitSaving}
          message={permitMessage}
          onClose={() => {
            setPermitFormOpen(false);
            setActivePermit(null);
            setPermitMessage("");
          }}
          onModeChange={setPermitFormMode}
          onSave={(input) => void savePermit(input)}
        />
      ) : null}

      <Card className="mb-5 p-5">
        <div className="grid gap-5 2xl:grid-cols-[1fr_420px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge level={site.riskLevel} />
              <span className={cx("rounded-full border px-2.5 py-1 text-xs font-black", statusClasses(site.status))}>{statusLabel(site.status)}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{site.code}</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoTile label="Risk Score" value={`${displayedRiskScore}/100`} tone="text-red-600" helper={SAFE_PREDICT_RISK_INDEX_HELPER} />
              <InfoTile label="Site Lead" value={site.siteLead} />
              <InfoTile label="Project Manager" value={site.projectManager} />
              <InfoTile label="Customer" value={site.customerName} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4 2xl:grid-cols-2">
            <InfoTile label="Workers" value={siteEmployees.length || site.workforceCount} />
            <InfoTile label="Open Actions" value={siteActions.filter((action) => action.status !== "Closed").length} tone="text-orange-600" />
            <InfoTile label="Permits" value={sitePermits.length || site.activePermits} />
            <InfoTile label="Inspection Gaps" value={site.inspectionGaps} tone="text-amber-600" />
          </div>
        </div>
      </Card>

      <JobsiteCommandDashboard
        summary={commandSummary}
        mode={mode}
        onRefreshSchedule={() => void loadPersistedSchedule()}
        onCreateAction={createSiteAction}
        onOpenTab={(tab) => {
          setActiveTab(tab);
          setSelectedJobsiteId(site.id);
        }}
      />

      <div className="mb-5 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
        <div className="flex min-w-max flex-nowrap gap-2">
          {detailTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setSelectedJobsiteId(site.id);
              }}
              className={cx("min-h-10 shrink-0 rounded-md px-3 py-2 text-xs font-black transition", activeTab === tab ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50")}
            >
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                {tab}
                {tabCounts[tab] ? (
                  <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-black", activeTab === tab ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")}>
                    {tabCounts[tab]}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Overview" ? (
        <div className="space-y-5">
          <JobsiteWeatherOverviewCard
            site={site}
            weather={displayedWeatherOverview}
            refreshing={weatherRefreshing}
            onRefresh={mode === "live" ? () => void refreshJobsiteWeather() : undefined}
            testSending={weatherTestSending}
            testNotificationMessage={weatherTestMessage}
            testNotificationTone={weatherTestTone}
            onSendTestNotification={mode === "live" ? () => void sendWeatherTestNotification() : undefined}
          />
          <div className="grid gap-5 2xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="p-5">
            <SectionTitle title="Today On This Site" hint="A daily shift board that turns jobsite records into decisions before work starts." />
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">Priority focus</p>
              <p className="mt-1 text-lg font-black leading-snug text-slate-950">{formatTitleCase(commandSummary.attentionItems[0]?.title ?? "No blockers detected") || "No Blockers Detected"}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{commandSummary.nextBestAction}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setActiveTab(commandSummary.attentionItems[0]?.targetTab ?? "Schedule")} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-black text-white shadow-sm">
                  Open focus area
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={createSiteAction} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 shadow-sm">
                  <Plus className="h-3.5 w-3.5" />
                  Create action
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <ShiftBoardColumn
                title="Before Work Starts"
                items={[
                  blockedSchedulePermitItems.length > 0 ? `${blockedSchedulePermitItems.length} schedule item${blockedSchedulePermitItems.length === 1 ? "" : "s"} need permit readiness.` : "Permit readiness is clear for visible schedule items.",
                  highRiskScheduleCount > 0 ? `${highRiskScheduleCount} high-risk task${highRiskScheduleCount === 1 ? "" : "s"} need pre-task controls.` : "No high-risk schedule task is currently queued.",
                  openSiteActionsCount > 0 ? `${openSiteActionsCount} open action${openSiteActionsCount === 1 ? "" : "s"} should be reviewed in huddle.` : "No open corrective action is blocking startup.",
                ]}
              />
              <ShiftBoardColumn
                title="During Work"
                items={[
                  siteObservations.length > 0 ? `${siteObservations.length} observation${siteObservations.length === 1 ? "" : "s"} available for field coaching.` : "Capture observations as work starts moving.",
                  siteEmployees.length > 0 ? `${siteEmployees.length} worker${siteEmployees.length === 1 ? "" : "s"} assigned to this jobsite.` : "Assign workers to see crew readiness here.",
                  commandSummary.nextScheduleTitle,
                ]}
              />
              <ShiftBoardColumn
                title="Before Closeout"
                items={[
                  siteInspections.some((inspection) => inspection.failedItems > 0) ? "Close failed inspection checks before shift handoff." : "No failed inspection checks are currently flagged.",
                  siteReports.some((report) => report.status === "Ready") ? "A site report is ready for review or delivery." : "Build reports as documents and field activity accumulate.",
                  siteDocuments.length > 0 ? `${siteDocuments.length} document${siteDocuments.length === 1 ? "" : "s"} connected to this site.` : "Attach JSAs, permits, and inspections to complete the record.",
                ]}
              />
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-500">Readiness</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {commandSummary.readinessSignals.map((signal) => (
                <button key={`overview-${signal.id}`} type="button" onClick={() => setActiveTab(signal.targetTab)} className={cx("rounded-lg border border-slate-200 border-l-4 bg-white p-3 text-left shadow-sm hover:bg-slate-50", signalBorderClass(signal.tone))}>
                  <span className="block text-xs font-black uppercase tracking-wide text-slate-500">{signal.label}</span>
                  <span className="mt-1 block text-lg font-black text-slate-950">{signal.value}</span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">{signal.detail}</span>
                </button>
              ))}
            </div>
            {sitePermits[0] ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Permit Readiness</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{sitePermits[0].title || sitePermits[0].type}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{sitePermits[0].readiness}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openPermitForm(sitePermits[0], "view")} className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50">View</button>
                    <button type="button" onClick={() => openPermitForm(sitePermits[0], "edit")} className="inline-flex h-9 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 shadow-sm hover:bg-blue-100">Edit</button>
                  </div>
                </div>
              </div>
            ) : null}
            </Card>
            <div className="space-y-5">
              <Card className="p-5">
              <SectionTitle title="Risk Map" />
              <div className="mt-4">
                {mode === "live" ? (
                  <LiveJobsiteRiskList
                    jobsites={[site]}
                    emptyTitle="No Live Risk Zones"
                    emptyDetail="This jobsite will show risk zones after field activity is recorded."
                  />
                ) : (
                  <RiskHeatMap variant={site.id === "plant-1" || site.id === "warehouse-a" ? "mitigation" : "dashboard"} />
                )}
              </div>
              </Card>
              <Card className="p-5">
              <SectionTitle title="Top Site Signals" />
              <div className="mt-4 space-y-3">
                {[...siteAlerts, ...siteHazards].slice(0, 5).map((item) => (
                  <button key={item.id} type="button" onClick={() => setActiveTab("Corrective Actions")} className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-left hover:bg-white">
                    <span>
                      <span className="block text-sm font-black text-slate-950">{item.title}</span>
                      <span className="mt-1 block text-xs text-slate-500">{"detail" in item ? item.detail : item.controlStatus}</span>
                    </span>
                    <RiskBadge level={item.riskLevel} />
                  </button>
                ))}
                {[...siteAlerts, ...siteHazards].length === 0 ? (
                  <EmptyTabPanel title="No Site Signals Yet" detail="Risk signals will appear after observations, hazards, inspections, schedules, or AI recommendations are recorded." actionLabel="Create site action" onAction={createSiteAction} />
                ) : null}
              </div>
              </Card>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "Predictive Risk" ? (
        <Card className="p-5">
          <SectionTitle
            title="Site 30-Day Risk Index Forecast"
            hint={SAFE_PREDICT_RISK_INDEX_HELPER}
          />
          <ForecastTrendChart data={riskForecastForSite(dataset, site.id)} />
        </Card>
      ) : null}

      {activeTab === "Corrective Actions" ? (
        <Card id="actions" className="p-5">
          <SectionTitle title="Corrective Actions" />
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {siteActions.map((action) => (
              <div key={action.id} id={action.id} className="scroll-mt-28">
                <CorrectiveActionCard action={action} onStatusChange={updateActionStatus} />
              </div>
            ))}
          </div>
          {siteActions.length === 0 ? (
            <EmptyTabPanel
              title="No Corrective Actions Yet"
              detail="Create the first action from a schedule risk, inspection gap, observation, or manual site concern so the team has a clear owner and next step."
              actionLabel="Create site action"
              onAction={createSiteAction}
            />
          ) : null}
        </Card>
      ) : null}

      {activeTab === "Workforce" ? (
        <div className="space-y-5">
          <JobsiteAssignmentManager site={site} dataset={dataset} mode={mode} onChanged={refreshLiveData} />
          <DataTable
            title="Workforce"
            rows={siteEmployees.map((employee) => [employee.name, employee.trade, employee.role, employee.status, `${employee.readinessScore}`])}
            headers={["Employee", "Trade", "Role", "Status", "Readiness", "Action"]}
            actions={siteEmployees.map(() => ({ label: "Assign training", href: `/safe-predict/training?jobsiteId=${encodeURIComponent(site.id)}` }))}
            emptyTitle="No Workforce Assigned Yet"
            emptyDetail="Assign workers to this jobsite to compare crew readiness against scheduled high-risk work and required training."
            emptyAction={{ label: "Manage workforce", href: "/safe-predict/team-access" }}
          />
        </div>
      ) : null}

      {activeTab === "Permits" ? (
        <div className="space-y-5">
          <PermitReadinessBoard
            items={schedulePermitReadiness}
            onOpenSchedule={() => setActiveTab("Schedule")}
            onOpenPermits={() => setActiveTab("Permits")}
          />
          <DataTable
            title="Permits"
            rows={sitePermits.map((permit) => [permit.title || permit.type, permit.status, permit.owner, permit.expiresAt, permit.riskLevel, permit.readiness])}
            headers={["Permit", "Status", "Owner", "Expires", "Risk", "Readiness", "Action"]}
            actions={sitePermits.map((permit) => ({
              label: "View",
              onClick: () => openPermitForm(permit, "view"),
              secondaryLabel: "Edit",
              secondaryOnClick: () => openPermitForm(permit, "edit"),
            }))}
            emptyTitle="No Permits Logged Yet"
            emptyDetail="Permits added here will connect to scheduled work so supervisors can see what is ready, expiring, or blocking the shift."
            emptyAction={{ label: "Open permit center", href: `/safe-predict/permit-center?jobsiteId=${encodeURIComponent(site.id)}` }}
          />
        </div>
      ) : null}

      {activeTab === "Inspections" ? (
        <DataTable
          title="Inspections"
          rows={siteInspections.map((inspection) => [inspection.title, inspection.checklist, inspection.inspector, inspection.status, `${inspection.failedItems}`])}
          headers={["Inspection", "Checklist", "Inspector", "Status", "Failed", "Action"]}
          actions={siteInspections.map((inspection) => ({ label: "Create action", onClick: () => createActionForSignal({ id: inspection.id, title: inspection.title, riskLevel: inspection.riskLevel, createdFrom: "Inspection" }) }))}
          emptyTitle="No inspections scheduled yet"
          emptyDetail="Schedule inspections or import audit results to surface failed checks, repeat findings, and action-ready gaps."
          emptyAction={{ label: "Open jobsite audits", href: "/safe-predict/inspections" }}
        />
      ) : null}

      {activeTab === "Incidents & Observations" ? (
        <div className="grid gap-5 2xl:grid-cols-2">
          <DataTable
            title="Incidents"
            rows={siteIncidents.map((incident) => [incident.title, incident.type, incident.status, incident.reportedBy, incident.reportedAt])}
            headers={["Incident", "Type", "Status", "Reported By", "Date", "Action"]}
            actions={siteIncidents.map((incident) => ({ label: "Create action", onClick: () => createActionForSignal({ id: incident.id, title: incident.title, riskLevel: incident.severity, createdFrom: "Manual" }) }))}
            emptyTitle="No incidents reported"
            emptyDetail="Incidents and near misses will appear here for investigation, corrective action, and trend review."
            emptyAction={{ label: "Report incident", href: "/safe-predict/incidents" }}
          />
          <DataTable
            title="Observations"
            rows={siteObservations.map((observation) => [observation.title, observation.category, observation.status, observation.submittedBy, observation.submittedAt])}
            headers={["Observation", "Category", "Status", "Submitted By", "Date", "Action"]}
            actions={siteObservations.map((observation) => ({ label: "Convert", onClick: () => createActionForSignal({ id: observation.id, title: observation.title, riskLevel: observation.riskLevel, createdFrom: "Observation" }) }))}
            emptyTitle="No observations captured"
            emptyDetail="Capture good catches, unsafe conditions, and positive observations to feed the jobsite risk model."
            emptyAction={{ label: "Add observation", href: "/safe-predict/observations" }}
          />
        </div>
      ) : null}

      {activeTab === "Documents & Reports" ? (
        <div className="grid gap-5 2xl:grid-cols-2">
          <DataTable title="Documents" rows={siteDocuments.map((document) => [document.title, document.type, document.status, document.updatedAt])} headers={["Document", "Type", "Status", "Updated", "Action"]} actions={siteDocuments.map(() => ({ label: "Open", href: "/safe-predict/reports" }))} emptyTitle="No documents attached" emptyDetail="Attach JSAs, permits, inspections, training records, and site reports to make this jobsite audit-ready." emptyAction={{ label: "Open documents", href: "/safe-predict/reports" }} />
          <DataTable title="Reports" rows={siteReports.map((report) => [report.title, report.audience, report.status, report.updatedAt])} headers={["Report", "Audience", "Status", "Updated", "Action"]} actions={siteReports.map(() => ({ label: "Open", href: "/safe-predict/reports" }))} emptyTitle="No reports built yet" emptyDetail="Build a site report once the schedule, permits, inspections, and field activity are ready for review." emptyAction={{ label: "Build report", href: "/safe-predict/reports" }} />
        </div>
      ) : null}

      {activeTab === "Activity Timeline" ? (
        <Card className="p-5">
          <SectionTitle title="Activity Timeline" />
          <div className="mt-5">
            {siteEvents.length > 0 || dataset.events.length > 0 ? (
              <EventTimeline events={siteEvents.length > 0 ? siteEvents : dataset.events} />
            ) : (
              <EmptyTabPanel title="No Timeline Activity Yet" detail="AI refreshes, schedule edits, permit checks, inspections, observations, and reports will appear here as this jobsite starts moving." />
            )}
          </div>
        </Card>
      ) : null}

      {activeTab === "Schedule" ? (
        <Card className="p-5">
          <SectionTitle title="Schedule" hint="Add upcoming tasks and plan work from highest risk down to lowest risk before the crew starts." />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoTile label="Upcoming Events" value={upcomingRiskEvents.length} />
            <InfoTile label="High Risk Events" value={highRiskScheduleCount} tone="text-red-600" />
            <InfoTile label="Added Tasks" value={addedScheduleCount} tone="text-blue-600" />
            <InfoTile label="Next Owner" value={upcomingRiskEvents[0]?.owner ?? site.siteLead} />
          </div>

          <PermitReadinessBoard
            items={schedulePermitReadiness}
            onOpenSchedule={() => setActiveTab("Schedule")}
            onOpenPermits={() => setActiveTab("Permits")}
          />

          <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <Upload className="h-4 w-4 text-blue-600" />
                Bulk Schedule Import
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadScheduleTemplate}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  <Download className="h-4 w-4" />
                  Download CSV Template
                </button>
                <label
                  className={cx(
                    "inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 shadow-sm hover:bg-blue-50",
                    scheduleImporting ? "pointer-events-none cursor-not-allowed opacity-60" : "cursor-pointer"
                  )}
                >
                  <Upload className="h-4 w-4" />
                  {scheduleImporting ? "Importing" : "Bulk Upload Tasks"}
                  <input
                    ref={scheduleTemplateInputRef}
                    type="file"
                    accept={scheduleTemplateAccept}
                    className="sr-only"
                    disabled={scheduleImporting}
                    onChange={(event) => void uploadScheduleTemplate(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>
            {scheduleMessage ? (
              <div
                aria-live="polite"
                className="mt-3 rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-700 shadow-sm"
              >
                {scheduleMessage}
              </div>
            ) : null}
            {scheduleLoadError ? (
              <div
                aria-live="polite"
                className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800 shadow-sm"
              >
                {scheduleLoadError}
              </div>
            ) : null}
          </div>

          <div ref={scheduleTaskFormRef} className="mt-4 scroll-mt-24 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                {editingScheduleTask ? <Pencil className="h-4 w-4 text-blue-600" /> : <Plus className="h-4 w-4 text-blue-600" />}
                {editingScheduleTask ? "Edit Schedule Task" : "Add Individual Schedule Task"}
              </div>
              {editingScheduleTask ? (
                <button
                  type="button"
                  onClick={resetScheduleTaskForm}
                  className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel edit
                </button>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={scheduleTaskForm.title}
                onChange={(event) => updateScheduleTaskForm("title", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                placeholder="Task title"
              />
              <input
                type="date"
                value={scheduleTaskForm.dueDate}
                onChange={(event) => updateScheduleTaskForm("dueDate", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                aria-label="Task date"
              />
              <select
                value={scheduleTaskForm.trade}
                onChange={(event) => updateScheduleTaskForm("trade", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                aria-label="Trade"
              >
                <option value="">Trade</option>
                {CONSTRUCTION_TRADE_LABELS.map((trade) => (
                  <option key={trade} value={trade}>{trade}</option>
                ))}
              </select>
              <select
                value={scheduleTaskForm.taskType}
                onChange={(event) => updateScheduleTaskForm("taskType", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                aria-label="Task type"
              >
                <option value="">Task type</option>
                {scheduleTaskTypeOptions.map((taskType) => (
                  <option key={taskType} value={taskType}>{taskType}</option>
                ))}
              </select>
              <select
                value={scheduleTaskForm.workArea}
                onChange={(event) => updateScheduleTaskForm("workArea", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                aria-label="Work area"
              >
                <option value="">Work area</option>
                {scheduleWorkAreaOptions.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
              <input
                type="time"
                value={scheduleTaskForm.shiftStartTime}
                onChange={(event) => updateScheduleTaskForm("shiftStartTime", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                aria-label="Shift start time"
              />
              <input
                type="time"
                value={scheduleTaskForm.shiftEndTime}
                onChange={(event) => updateScheduleTaskForm("shiftEndTime", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                aria-label="Shift end time"
              />
              <input
                value={scheduleTaskForm.crewSize}
                onChange={(event) => updateScheduleTaskForm("crewSize", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                min="0"
                placeholder="Crew size"
                type="number"
              />
              <select
                value={scheduleTaskForm.riskLevel}
                onChange={(event) => updateScheduleTaskForm("riskLevel", event.target.value as SafePredictRiskLevel)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                aria-label="Risk level"
              >
                <option value="critical">Critical risk</option>
                <option value="high">High risk</option>
                <option value="medium">Medium risk</option>
                <option value="low">Low risk</option>
              </select>
              <input
                value={scheduleTaskForm.owner}
                onChange={(event) => updateScheduleTaskForm("owner", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                placeholder="Owner / supervisor"
              />
            </div>
            {schedulePrediction ? (
              <div className="mt-3 rounded-lg border border-blue-100 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-600" />
                      <p className="text-sm font-black text-slate-950">Predicted Hazards</p>
                      <RiskBadge level={schedulePrediction.riskLevel} />
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">{predictionSourceLabel(schedulePrediction.source)}</span>
                    </div>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{schedulePrediction.rationale}</p>
                    {schedulePredictionError ? <p className="mt-2 text-xs font-bold text-amber-700">{schedulePredictionError}</p> : null}
                  </div>
                  <button type="button" onClick={acceptSchedulePrediction} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100">
                    <CheckCircle2 className="h-4 w-4" />
                    Use prediction
                  </button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <PredictionField label="Hazards" values={schedulePrediction.hazardCategories} empty="No hazards predicted" />
                  <PredictionField label="Permits" values={schedulePrediction.permitTriggers} empty="No permits predicted" />
                  <PredictionField label="Controls" values={schedulePrediction.requiredControls} empty="No controls predicted" />
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
                Pick trade, task type, and work area to predict likely hazards.
              </div>
            )}
            {schedulePredictionLoading ? <p className="mt-2 text-xs font-bold text-blue-600">Checking daily AI cache...</p> : null}
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <input
                value={scheduleTaskForm.hazards}
                onChange={(event) => updateScheduleTaskForm("hazards", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                placeholder="Hazards, comma separated"
              />
              <input
                value={scheduleTaskForm.permits}
                onChange={(event) => updateScheduleTaskForm("permits", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                placeholder="Permit triggers, comma separated"
              />
              <input
                value={scheduleTaskForm.controls}
                onChange={(event) => updateScheduleTaskForm("controls", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                placeholder="Required controls, comma separated"
              />
            </div>
            <textarea
              value={scheduleTaskForm.notes}
              onChange={(event) => updateScheduleTaskForm("notes", event.target.value)}
              className="mt-3 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
              placeholder="Notes or adjacent work context"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void addScheduleTask()}
                disabled={!scheduleTaskForm.title.trim() || scheduleSaving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingScheduleTask ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {scheduleSaving ? "Saving" : editingScheduleTask ? "Update task" : mode === "live" ? "Save" : "Add"}
              </button>
            </div>
          </div>

          <ScheduleCalendar
            days={scheduleCalendarDays}
            monthDate={calendarMonth}
            selectedDate={selectedCalendarDate}
            onClearDate={() => setSelectedCalendarDate(null)}
            onNextMonth={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            onPreviousMonth={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            onSelectDate={(date) => setSelectedCalendarDate((current) => (current === date ? null : date))}
          />

          <div className="mt-5 grid gap-5 2xl:grid-cols-[1fr_360px]">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-black text-slate-950">Upcoming High-to-Low Risk Plan</h3>
                {selectedCalendarDate ? (
                  <button
                    type="button"
                    onClick={() => setSelectedCalendarDate(null)}
                    className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Show all
                  </button>
                ) : (
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Critical, high, medium, low</span>
                )}
              </div>
              <div className="mt-3 space-y-3">
                {selectedCalendarEvents.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
                    No schedule items on {selectedCalendarDate ? compactScheduleDateLabel(selectedCalendarDate) : "this date"}.
                  </div>
                ) : null}
                {selectedCalendarEvents.map((event) => (
                  <article key={event.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-blue-600" />
                          <h4 className="text-sm font-black leading-5 text-slate-950">{formatTitleCase(event.title) || event.title}</h4>
                          <RiskBadge level={event.riskLevel} />
                          {event.isManual ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">Added</span> : null}
                        </div>
                        <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{event.detail}</p>
                      </div>
                      <div className="shrink-0 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-left lg:w-40">
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{event.type}</p>
                        <p className="mt-1 text-sm font-black text-slate-950">{event.date}</p>
                      </div>
                    </div>
                    {event.editForm && !event.readOnly ? (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => startEditingScheduleTask(event)}
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 hover:bg-blue-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit task
                        </button>
                      </div>
                    ) : null}
                    <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600 md:grid-cols-3">
                      <span className="rounded-md bg-slate-50 p-2">Owner: {event.owner}</span>
                      <span className="rounded-md bg-slate-50 p-2">Area: {event.location}</span>
                      <span className="rounded-md bg-slate-50 p-2">Source: {event.predictionSource ? predictionSourceLabel(event.predictionSource) : event.source}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(event.hazards ?? []).map((hazard) => (
                        <span key={`${event.id}-${hazard}`} className="rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-black text-red-700">{hazard.replace(/_/g, " ")}</span>
                      ))}
                      {(event.permits ?? []).map((permit) => (
                        <span key={`${event.id}-${permit}`} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">{permit.replace(/_/g, " ")}</span>
                      ))}
                      {event.controls.map((control) => (
                        <span key={`${event.id}-${control}`} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600">{control}</span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <SectionTitle title="Recent Activity" />
              <div className="mt-5">
                <EventTimeline events={siteEvents.length > 0 ? siteEvents : dataset.events} />
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function ScheduleCalendar({
  days,
  monthDate,
  selectedDate,
  onClearDate,
  onNextMonth,
  onPreviousMonth,
  onSelectDate,
}: {
  days: ReturnType<typeof buildScheduleCalendarDays>;
  monthDate: Date;
  selectedDate: string | null;
  onClearDate: () => void;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  onSelectDate: (date: string) => void;
}) {
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(monthDate);

  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle title="Schedule Calendar" />
        <div className="flex items-center gap-2">
          {selectedDate ? (
            <button
              type="button"
              onClick={onClearDate}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" />
              Show all
            </button>
          ) : null}
          <button
            type="button"
            onClick={onPreviousMonth}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-36 text-center text-sm font-black text-slate-950">{monthLabel}</div>
          <button
            type="button"
            onClick={onNextMonth}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase tracking-wide text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="py-2">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const selected = selectedDate === day.date;
          const highRisk = day.events.some((event) => event.riskLevel === "critical" || event.riskLevel === "high");
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className={cx(
                "min-h-28 rounded-lg border p-2 text-left transition",
                day.inMonth ? "bg-white" : "bg-slate-50/70 text-slate-400",
                day.events.length > 0 ? "border-slate-200 hover:border-blue-200 hover:bg-blue-50/40" : "border-slate-100",
                highRisk && day.inMonth ? "ring-1 ring-red-100" : "",
                selected ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100" : ""
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cx("grid h-6 w-6 place-items-center rounded-full text-xs font-black", day.isToday ? "bg-blue-600 text-white" : "text-slate-700")}>{day.dayNumber}</span>
                {day.events.length > 0 ? <span className="text-[11px] font-black text-slate-500">{day.events.length}</span> : null}
              </div>
              <div className="mt-2 space-y-1">
                {day.events.slice(0, 3).map((event) => (
                  <div
                    key={`${day.date}-${event.id}`}
                    className={cx("truncate rounded-md border px-2 py-1 text-[11px] font-black leading-4", calendarEventClass(event.riskLevel))}
                    title={`${formatTitleCase(event.title) || event.title} - ${event.source}`}
                  >
                    {formatTitleCase(event.title) || event.title}
                  </div>
                ))}
                {day.events.length > 3 ? (
                  <div className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">+{day.events.length - 3}</div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function calendarEventClass(level: SafePredictRiskLevel) {
  if (level === "critical") return "border-red-200 bg-red-50 text-red-700";
  if (level === "high") return "border-orange-200 bg-orange-50 text-orange-700";
  if (level === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function InfoTile({ label, value, tone = "text-slate-950", helper }: { label: string; value: string | number; tone?: string; helper?: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cx("mt-2 text-lg font-black leading-snug break-words", tone)}>{value}</p>
      {helper ? <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-500">{helper}</p> : null}
    </div>
  );
}

function PredictionField({ label, values, empty }: { label: string; values: string[]; empty: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((value) => (
            <span key={`${label}-${value}`} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-700">
              {value.replace(/_/g, " ")}
            </span>
          ))
        ) : (
          <span className="text-xs font-semibold text-slate-500">{empty}</span>
        )}
      </div>
    </div>
  );
}

function ShiftBoardColumn({ title, items }: { title: string; items: string[] }) {
  const displayTitle = formatTitleCase(title) || title;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{displayTitle}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={`${title}-${item}`} className="rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyTabPanel({
  title,
  detail,
  actionLabel,
  href,
  onAction,
}: {
  title: string;
  detail: string;
  actionLabel?: string;
  href?: string;
  onAction?: () => void;
}) {
  const displayTitle = formatTitleCase(title) || title;

  return (
    <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
      <p className="text-sm font-black text-slate-950">{displayTitle}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">{detail}</p>
      {actionLabel && href ? (
        <Link href={href} className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-blue-200 bg-white px-4 text-sm font-black text-blue-700 shadow-sm hover:bg-blue-50">
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-blue-200 bg-white px-4 text-sm font-black text-blue-700 shadow-sm hover:bg-blue-50">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function PermitReadinessBoard({
  items,
  onOpenSchedule,
  onOpenPermits,
}: {
  items: SchedulePermitReadiness[];
  onOpenSchedule: () => void;
  onOpenPermits: () => void;
}) {
  const blocked = items.filter((item) => item.status !== "ready");
  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-blue-600">Schedule + Permit Readiness</p>
          <h3 className="mt-1 text-base font-black text-slate-950">
            {formatTitleCase(blocked.length > 0 ? `${blocked.length} scheduled task${blocked.length === 1 ? "" : "s"} blocked or needing permit review` : "Visible schedule items are permit-ready")}
          </h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
            Scheduled work is checked against predicted permit triggers and the site permit log.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onOpenSchedule} className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
            Open schedule
          </button>
          <button type="button" onClick={onOpenPermits} className="inline-flex h-9 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100">
            Review permits
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {items.length > 0 ? (
          items.slice(0, 4).map((item) => (
            <article key={`permit-readiness-${item.id}`} className={cx("rounded-lg border p-3", attentionToneClass(permitReadinessTone(item.status)))}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-black leading-5 text-slate-950">{formatTitleCase(item.title) || item.title}</h4>
                <span className="rounded-full border bg-white/70 px-2.5 py-1 text-[11px] font-black">{schedulePermitReadinessLabel(item.status)}</span>
              </div>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{item.date} | {riskText(item.riskLevel)} risk</p>
              <p className="mt-2 text-xs font-semibold leading-5 opacity-90">{item.detail}</p>
              {item.permitLabels.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.permitLabels.map((label) => (
                    <span key={`${item.id}-${label}`} className="rounded-full border border-blue-100 bg-white px-2 py-0.5 text-[11px] font-black text-blue-700">{label.replace(/_/g, " ")}</span>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="lg:col-span-2">
            <EmptyTabPanel title="No Scheduled Work to Check" detail="Add or import schedule tasks with permit triggers to see what is ready, missing, or expiring before work starts." actionLabel="Open schedule" onAction={onOpenSchedule} />
          </div>
        )}
      </div>
    </div>
  );
}

function DataTable({
  title,
  headers,
  rows,
  actions = [],
  emptyTitle = "No records yet for this jobsite.",
  emptyDetail = "Records will appear here as this jobsite starts moving.",
  emptyAction,
}: {
  title: string;
  headers: string[];
  rows: string[][];
  actions?: DetailTableAction[];
  emptyTitle?: string;
  emptyDetail?: string;
  emptyAction?: { label: string; href?: string; onClick?: () => void };
}) {
  const visibleHeaders = headers.filter((header) => header !== "Action");
  const displayTitle = formatTitleCase(title) || title;

  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-3"><SectionTitle title={displayTitle} /></div>
      <div className="space-y-3 p-4 pt-1 md:hidden">
        {rows.map((row, rowIndex) => (
          <article key={`${title}-card-${rowIndex}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-base font-black leading-snug text-slate-950">{row[0]}</p>
            <dl className="mt-3 grid gap-2 text-sm">
              {row.slice(1).map((cell, cellIndex) => (
                <div key={`${title}-card-${rowIndex}-${cellIndex}`} className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                  <dt className="font-bold text-slate-500">{visibleHeaders[cellIndex + 1] ?? "Detail"}</dt>
                  <dd className="text-right font-semibold text-slate-800">{cell}</dd>
                </div>
              ))}
            </dl>
            {actions[rowIndex] ? (
              <div className="mt-4 flex gap-2">
                {actions[rowIndex].href ? (
                  <Link href={actions[rowIndex].href} className="inline-flex w-full justify-center rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-50">{actions[rowIndex].label}</Link>
                ) : (
                  <button type="button" onClick={actions[rowIndex].onClick} className="inline-flex w-full justify-center rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-50">{actions[rowIndex].label}</button>
                )}
                {actions[rowIndex].secondaryLabel ? (
                  <button type="button" onClick={actions[rowIndex].secondaryOnClick} className="inline-flex w-full justify-center rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">{actions[rowIndex].secondaryLabel}</button>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
        {rows.length === 0 ? (
          <EmptyTabPanel title={emptyTitle} detail={emptyDetail} actionLabel={emptyAction?.label} href={emptyAction?.href} onAction={emptyAction?.onClick} />
        ) : null}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50 text-xs font-black text-slate-600">
              {headers.map((header) => <th key={header} className="px-5 py-3">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`} className="border-b border-slate-100">
                {row.map((cell, cellIndex) => <td key={`${title}-${rowIndex}-${cellIndex}`} className="px-5 py-3 font-semibold text-slate-700">{cell}</td>)}
                {actions[rowIndex] ? (
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                    {actions[rowIndex].href ? (
                      <Link href={actions[rowIndex].href} className="inline-flex rounded-md border border-blue-200 px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-50">{actions[rowIndex].label}</Link>
                    ) : (
                      <button type="button" onClick={actions[rowIndex].onClick} className="inline-flex rounded-md border border-blue-200 px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-50">{actions[rowIndex].label}</button>
                    )}
                    {actions[rowIndex].secondaryLabel ? (
                      <button type="button" onClick={actions[rowIndex].secondaryOnClick} className="inline-flex rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">{actions[rowIndex].secondaryLabel}</button>
                    ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length}>
                  <EmptyTabPanel title={emptyTitle} detail={emptyDetail} actionLabel={emptyAction?.label} href={emptyAction?.href} onAction={emptyAction?.onClick} />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
