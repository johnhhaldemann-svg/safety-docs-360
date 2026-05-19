"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FilterX,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { triggerBrowserDownload } from "@/lib/browserDownload";
import { useSafePredictData } from "@/components/safe-predict/SafePredictDataProvider";
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
  riskForecastForSite,
  siteScoped,
  summarizeSafePredictDataset,
  type SafePredictJobsiteRecord,
  type SafePredictJobsiteStatus,
} from "@/lib/safePredictData";
import type { SafePredictRiskLevel } from "@/lib/safePredictMockData";
import { CONSTRUCTION_TRADE_LABELS } from "@/lib/constructionTradeTaxonomy";
import {
  buildRuleBasedScheduleHazardPrediction,
  type ScheduleHazardPredictionResponse,
} from "@/lib/scheduleHazardPrediction";

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
};

type ScheduleTaskForm = {
  title: string;
  dueDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
  trade: string;
  taskType: string;
  owner: string;
  workArea: string;
  crewSize: string;
  riskLevel: SafePredictRiskLevel;
  hazards: string;
  permits: string;
  controls: string;
  notes: string;
};

type ScheduledRiskEvent = {
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
};

const scheduleTemplateColumns = [
  { key: "title", label: "Task title", aliases: ["task", "task title", "title", "activity"] },
  { key: "dueDate", label: "Date", aliases: ["date", "due date", "work start date", "start date"] },
  { key: "trade", label: "Trade", aliases: ["trade", "crew trade"] },
  { key: "taskType", label: "Task type", aliases: ["task type", "type", "work type"] },
  { key: "workArea", label: "Work area", aliases: ["work area", "area", "location"] },
  { key: "shiftStartTime", label: "Shift start", aliases: ["shift start", "start time", "shift start time"] },
  { key: "shiftEndTime", label: "Shift end", aliases: ["shift end", "end time", "shift end time"] },
  { key: "crewSize", label: "Crew size", aliases: ["crew size", "crew", "headcount"] },
  { key: "riskLevel", label: "Risk level", aliases: ["risk", "risk level", "priority"] },
  { key: "owner", label: "Owner / supervisor", aliases: ["owner", "supervisor", "owner / supervisor"] },
  { key: "hazards", label: "Hazards", aliases: ["hazards", "hazard categories"] },
  { key: "permits", label: "Permit triggers", aliases: ["permit triggers", "permits", "permit"] },
  { key: "controls", label: "Required controls", aliases: ["required controls", "controls"] },
  { key: "notes", label: "Notes", aliases: ["notes", "context"] },
] as const;

const scheduleTemplateHeader = scheduleTemplateColumns.map((column) => column.label).join(",");

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

function controlList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listText(value: string[]) {
  return value.join(", ");
}

function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function normalizeScheduleDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!usMatch) return null;
  const month = Number(usMatch[1]);
  const day = Number(usMatch[2]);
  const year = Number(usMatch[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeScheduleTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const twentyFourHour = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return null;
  }

  const amPm = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!amPm) return null;
  let hour = Number(amPm[1]);
  const minute = Number(amPm[2] ?? "0");
  const period = amPm[3].toLowerCase();
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  if (period === "pm" && hour !== 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeScheduleRisk(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "high";
  if (["critical", "high", "medium", "low"].includes(normalized)) return normalized as SafePredictRiskLevel;
  return null;
}

function parseScheduleTemplateCsv(text: string) {
  const [headerRow, ...dataRows] = parseCsvRows(text.replace(/^\uFEFF/, ""));
  const tasks: ScheduleTaskForm[] = [];
  const errors: string[] = [];
  if (!headerRow) return { tasks, errors: ["No CSV header row found."] };

  const headerMap = new Map<string, number>();
  headerRow.forEach((header, index) => headerMap.set(normalizeCsvHeader(header), index));

  function cellFor(column: (typeof scheduleTemplateColumns)[number]) {
    const match = column.aliases.find((alias) => headerMap.has(normalizeCsvHeader(alias)));
    return typeof match === "string" ? headerMap.get(normalizeCsvHeader(match)) : undefined;
  }

  for (const [rowOffset, row] of dataRows.entries()) {
    const rowNumber = rowOffset + 2;
    const valueFor = (column: (typeof scheduleTemplateColumns)[number]) => {
      const index = cellFor(column);
      return typeof index === "number" ? (row[index] ?? "").trim() : "";
    };

    const title = valueFor(scheduleTemplateColumns[0]);
    if (!title && row.every((value) => !value.trim())) continue;
    if (!title) {
      errors.push(`Row ${rowNumber}: task title is required.`);
      continue;
    }

    const dueDate = normalizeScheduleDate(valueFor(scheduleTemplateColumns[1]));
    const shiftStartTime = normalizeScheduleTime(valueFor(scheduleTemplateColumns[5]));
    const shiftEndTime = normalizeScheduleTime(valueFor(scheduleTemplateColumns[6]));
    const riskLevel = normalizeScheduleRisk(valueFor(scheduleTemplateColumns[8]));
    const crewSize = valueFor(scheduleTemplateColumns[7]);
    const crewSizeNumber = crewSize ? Number(crewSize) : null;
    const invalidCrewSize = crewSizeNumber !== null && (!Number.isFinite(crewSizeNumber) || crewSizeNumber < 0);

    if (dueDate === null) errors.push(`Row ${rowNumber}: date must be YYYY-MM-DD or MM/DD/YYYY.`);
    if (shiftStartTime === null) errors.push(`Row ${rowNumber}: shift start must be HH:MM or h:mm AM/PM.`);
    if (shiftEndTime === null) errors.push(`Row ${rowNumber}: shift end must be HH:MM or h:mm AM/PM.`);
    if (riskLevel === null) errors.push(`Row ${rowNumber}: risk level must be critical, high, medium, or low.`);
    if (invalidCrewSize) errors.push(`Row ${rowNumber}: crew size must be a positive number.`);
    if (dueDate === null || shiftStartTime === null || shiftEndTime === null || riskLevel === null || invalidCrewSize) continue;

    tasks.push({
      title,
      dueDate,
      shiftStartTime,
      shiftEndTime,
      trade: valueFor(scheduleTemplateColumns[2]),
      taskType: valueFor(scheduleTemplateColumns[3]),
      workArea: valueFor(scheduleTemplateColumns[4]),
      crewSize,
      riskLevel,
      owner: valueFor(scheduleTemplateColumns[9]),
      hazards: valueFor(scheduleTemplateColumns[10]),
      permits: valueFor(scheduleTemplateColumns[11]),
      controls: valueFor(scheduleTemplateColumns[12]),
      notes: valueFor(scheduleTemplateColumns[13]),
    });
  }

  return { tasks, errors };
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
      .filter((site) => risk === "all" || site.riskLevel === risk)
      .filter((site) => !normalizedQuery || jobsiteSearchText(site).includes(normalizedQuery))
      .sort((a, b) => riskSort(b.riskLevel) - riskSort(a.riskLevel));
  }, [dataset.jobsites, normalizedQuery, risk, status]);

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
        <div className="grid gap-4 2xl:grid-cols-[1fr_190px_170px_auto] 2xl:items-end">
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
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black text-slate-700 sm:grid-cols-4">
                    <span className="rounded-md bg-slate-50 p-2"><Users className="mr-1 inline h-3.5 w-3.5" />{site.workforceCount}</span>
                    <span className="rounded-md bg-slate-50 p-2">{site.activePermits} permits</span>
                    <span className="rounded-md bg-slate-50 p-2">{site.openActions} actions</span>
                    <span className="rounded-md bg-slate-50 p-2">{site.inspectionGaps} gaps</span>
                  </div>
                  <p className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-blue-600">
                    Open command center <ArrowRight className="h-4 w-4" />
                  </p>
                </Link>
              );
            })}
          </div>
          {visibleJobsites.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-lg font-black text-slate-950">{isLiveEmpty ? "No live jobsites yet." : "No jobsites match those filters."}</p>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {isLiveEmpty ? "Add or import the first jobsite for this company to populate this workspace." : "Clear filters or switch back to sample data."}
              </p>
            </div>
          ) : null}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle title="Site Risk Map" />
            <div className="mt-4">
              {isLiveMode ? (
                <LiveJobsiteRiskList
                  jobsites={dataset.jobsites}
                  emptyTitle="No live risk zones"
                  emptyDetail="Site risk zones will appear after this company has jobsites and field activity."
                />
              ) : isLiveEmpty ? (
                <EmptyLivePanel
                  title="No live risk zones"
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
                  title="No recent activity"
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
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
      <p className="text-sm font-black text-slate-950">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-5 text-slate-500">{detail}</p>
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
            {jobsite.riskScore}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function SafePredictJobsiteDetail({ jobsiteId }: { jobsiteId: string }) {
  const { dataset, updateActionStatus, addDraftAction, setSelectedJobsiteId, mode } = useSafePredictData();
  const [activeTab, setActiveTab] = useState<(typeof detailTabs)[number]>("Overview");
  const manualScheduleTaskIdRef = useRef(0);
  const scheduleTemplateInputRef = useRef<HTMLInputElement | null>(null);
  const [manualScheduleTasks, setManualScheduleTasks] = useState<ScheduledRiskEvent[]>([]);
  const [schedulePrediction, setSchedulePrediction] = useState<ScheduleHazardPredictionResponse | null>(null);
  const [schedulePredictionLoading, setSchedulePredictionLoading] = useState(false);
  const [schedulePredictionError, setSchedulePredictionError] = useState<string | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleImporting, setScheduleImporting] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
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
    }));
  const upcomingRiskEvents = [...manualScheduleTasks, ...alertScheduleEvents, ...hazardScheduleEvents, ...inspectionScheduleEvents, ...permitScheduleEvents, ...actionScheduleEvents]
    .sort((a, b) => riskSort(b.riskLevel) - riskSort(a.riskLevel) || a.title.localeCompare(b.title));

  const highRiskScheduleCount = upcomingRiskEvents.filter((event) => event.riskLevel === "critical" || event.riskLevel === "high").length;

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
      sourceMetadata: prediction
        ? {
            schedulePrediction: {
              source: prediction.source,
              inputFingerprint: prediction.inputFingerprint ?? null,
              confidence: prediction.confidence,
              rationale: prediction.rationale,
              matchedSignals: prediction.matchedSignals,
            },
          }
        : null,
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
    const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    return {
      ok: response.ok,
      message: data?.message,
      error: data?.error || (response.ok ? null : "Schedule task could not be saved."),
    };
  }

  function scheduleEventForForm(form: ScheduleTaskForm, prediction: ScheduleHazardPredictionResponse | null, source: string) {
    const controls = controlList(form.controls);
    manualScheduleTaskIdRef.current += 1;
    return {
      id: `manual-schedule-${manualScheduleTaskIdRef.current}`,
      title: form.title.trim(),
      type: form.taskType || "Task",
      date: compactDateLabel(form.dueDate),
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
      hazards: "",
      permits: "",
      controls: "",
      notes: "",
    });
    setSchedulePrediction(null);
    setSchedulePredictionError(null);
  }

  async function addScheduleTask() {
    const title = scheduleTaskForm.title.trim();
    if (!title) return;
    setScheduleSaving(true);
    setScheduleMessage(null);
    const prediction = schedulePrediction;
    const formToSave = enrichScheduleFormWithPrediction({ ...scheduleTaskForm, title }, prediction);
    if (mode === "live") {
      try {
        const result = await saveScheduleFormToApi(formToSave, prediction, await scheduleAccessToken());
        if (!result.ok) {
          setScheduleMessage(result.error || "Schedule task could not be saved.");
          setScheduleSaving(false);
          return;
        }
        setScheduleMessage(result.message || "Schedule task saved.");
      } catch (error) {
        setScheduleMessage(error instanceof Error ? error.message : "Schedule task could not be saved.");
        setScheduleSaving(false);
        return;
      }
    }
    const task = scheduleEventForForm(formToSave, prediction, mode === "live" ? "Saved schedule task" : "Added task");
    setManualScheduleTasks((current) => [task, ...current]);
    resetScheduleTaskForm();
    setScheduleSaving(false);
  }

  function downloadScheduleTemplate() {
    const blob = new Blob([`${scheduleTemplateHeader}\r\n`], { type: "text/csv;charset=utf-8" });
    triggerBrowserDownload(blob, scheduleTemplateFileName(site));
    setScheduleMessage("Schedule template downloaded. Fill one task per row, then upload the CSV.");
  }

  async function uploadScheduleTemplate(file: File | null) {
    if (!file) return;
    setScheduleImporting(true);
    setScheduleMessage(null);
    try {
      const text = await file.text();
      const parsed = parseScheduleTemplateCsv(text);
      if (parsed.tasks.length === 0) {
        setScheduleMessage(parsed.errors.length > 0 ? parsed.errors.slice(0, 3).join(" ") : "No schedule rows were found in that template.");
        return;
      }

      const events: ScheduledRiskEvent[] = [];
      const saveErrors: string[] = [];
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
        }
        events.push(scheduleEventForForm(taskWithPrediction, prediction, mode === "live" ? "Imported schedule task" : "Imported task"));
      }

      if (events.length > 0) setManualScheduleTasks((current) => [...events, ...current]);
      const skipped = parsed.errors.length + saveErrors.length;
      const detail = [...parsed.errors, ...saveErrors].slice(0, 3).join(" ");
      setScheduleMessage(`Imported ${events.length} schedule task${events.length === 1 ? "" : "s"}${skipped ? `; skipped ${skipped}. ${detail}` : "."}`);
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
            <button type="button" onClick={() => setActiveTab("Documents & Reports")} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm">
              Files & reports
            </button>
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

      <Card className="mb-5 p-5">
        <div className="grid gap-5 2xl:grid-cols-[1fr_420px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge level={site.riskLevel} />
              <span className={cx("rounded-full border px-2.5 py-1 text-xs font-black", statusClasses(site.status))}>{statusLabel(site.status)}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{site.code}</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoTile label="Risk Score" value={`${site.riskScore}/100`} tone="text-red-600" />
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

      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-1">
        <div className="flex flex-wrap gap-2">
          {detailTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setSelectedJobsiteId(site.id);
              }}
              className={cx("min-h-10 flex-1 rounded-md px-3 py-2 text-xs font-black transition sm:flex-none", activeTab === tab ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50")}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Overview" ? (
        <div className="grid gap-5 2xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-5">
            <SectionTitle title="Jobsite Risk Heat Map" />
            <div className="mt-4">
              {mode === "live" ? (
                <LiveJobsiteRiskList
                  jobsites={[site]}
                  emptyTitle="No live risk zones"
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
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "Predictive Risk" ? (
        <Card className="p-5">
          <SectionTitle title="Site 30-Day Risk Forecast" />
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
        </Card>
      ) : null}

      {activeTab === "Workforce" ? (
        <DataTable
          title="Workforce"
          rows={siteEmployees.map((employee) => [employee.name, employee.trade, employee.role, employee.status, `${employee.readinessScore}`])}
          headers={["Employee", "Trade", "Role", "Status", "Readiness", "Action"]}
          actions={siteEmployees.map(() => ({ label: "Assign training", href: `/safe-predict/training?jobsiteId=${encodeURIComponent(site.id)}` }))}
        />
      ) : null}

      {activeTab === "Permits" ? (
        <DataTable
          title="Permits"
          rows={sitePermits.map((permit) => [permit.type, permit.status, permit.owner, permit.expiresAt, permit.riskLevel])}
          headers={["Permit", "Status", "Owner", "Expires", "Risk", "Action"]}
          actions={sitePermits.map(() => ({ label: "Renew", href: `/safe-predict/permit-center?jobsiteId=${encodeURIComponent(site.id)}` }))}
        />
      ) : null}

      {activeTab === "Inspections" ? (
        <DataTable
          title="Inspections"
          rows={siteInspections.map((inspection) => [inspection.title, inspection.checklist, inspection.inspector, inspection.status, `${inspection.failedItems}`])}
          headers={["Inspection", "Checklist", "Inspector", "Status", "Failed", "Action"]}
          actions={siteInspections.map((inspection) => ({ label: "Create action", onClick: () => createActionForSignal({ id: inspection.id, title: inspection.title, riskLevel: inspection.riskLevel, createdFrom: "Inspection" }) }))}
        />
      ) : null}

      {activeTab === "Incidents & Observations" ? (
        <div className="grid gap-5 2xl:grid-cols-2">
          <DataTable
            title="Incidents"
            rows={siteIncidents.map((incident) => [incident.title, incident.type, incident.status, incident.reportedBy, incident.reportedAt])}
            headers={["Incident", "Type", "Status", "Reported By", "Date", "Action"]}
            actions={siteIncidents.map((incident) => ({ label: "Create action", onClick: () => createActionForSignal({ id: incident.id, title: incident.title, riskLevel: incident.severity, createdFrom: "Manual" }) }))}
          />
          <DataTable
            title="Observations"
            rows={siteObservations.map((observation) => [observation.title, observation.category, observation.status, observation.submittedBy, observation.submittedAt])}
            headers={["Observation", "Category", "Status", "Submitted By", "Date", "Action"]}
            actions={siteObservations.map((observation) => ({ label: "Convert", onClick: () => createActionForSignal({ id: observation.id, title: observation.title, riskLevel: observation.riskLevel, createdFrom: "Observation" }) }))}
          />
        </div>
      ) : null}

      {activeTab === "Documents & Reports" ? (
        <div className="grid gap-5 2xl:grid-cols-2">
          <DataTable title="Documents" rows={siteDocuments.map((document) => [document.title, document.type, document.status, document.updatedAt])} headers={["Document", "Type", "Status", "Updated", "Action"]} actions={siteDocuments.map(() => ({ label: "Open", href: "/safe-predict/reports" }))} />
          <DataTable title="Reports" rows={siteReports.map((report) => [report.title, report.audience, report.status, report.updatedAt])} headers={["Report", "Audience", "Status", "Updated", "Action"]} actions={siteReports.map(() => ({ label: "Open", href: "/safe-predict/reports" }))} />
        </div>
      ) : null}

      {activeTab === "Activity Timeline" ? (
        <Card className="p-5">
          <SectionTitle title="Activity Timeline" />
          <div className="mt-5"><EventTimeline events={siteEvents.length > 0 ? siteEvents : dataset.events} /></div>
        </Card>
      ) : null}

      {activeTab === "Schedule" ? (
        <Card className="p-5">
          <SectionTitle title="Schedule" hint="Add upcoming tasks and plan work from highest risk down to lowest risk before the crew starts." />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoTile label="Upcoming Events" value={upcomingRiskEvents.length} />
            <InfoTile label="High Risk Events" value={highRiskScheduleCount} tone="text-red-600" />
            <InfoTile label="Added Tasks" value={manualScheduleTasks.length} tone="text-blue-600" />
            <InfoTile label="Next Owner" value={upcomingRiskEvents[0]?.owner ?? site.siteLead} />
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <Plus className="h-4 w-4 text-blue-600" />
                Add Schedule Task
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadScheduleTemplate}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </button>
                <label className={cx("inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 shadow-sm hover:bg-blue-50", scheduleImporting ? "pointer-events-none opacity-60" : "")}>
                  <Upload className="h-4 w-4" />
                  {scheduleImporting ? "Uploading" : "Upload Template"}
                  <input
                    ref={scheduleTemplateInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(event) => void uploadScheduleTemplate(event.target.files?.[0] ?? null)}
                  />
                </label>
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Plans into high-to-low risk order</span>
              </div>
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
                <Plus className="h-4 w-4" />
                {scheduleSaving ? "Saving" : mode === "live" ? "Save" : "Add"}
              </button>
              {scheduleMessage ? <span className="text-xs font-bold text-slate-600">{scheduleMessage}</span> : null}
            </div>
          </div>

          <div className="mt-5 grid gap-5 2xl:grid-cols-[1fr_360px]">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-black text-slate-950">Upcoming High-to-Low Risk Plan</h3>
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Critical, high, medium, low</span>
              </div>
              <div className="mt-3 space-y-3">
                {upcomingRiskEvents.map((event) => (
                  <article key={event.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-blue-600" />
                          <h4 className="text-sm font-black leading-5 text-slate-950">{event.title}</h4>
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

function InfoTile({ label, value, tone = "text-slate-950" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cx("mt-2 text-lg font-black leading-snug break-words", tone)}>{value}</p>
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

function DataTable({ title, headers, rows, actions = [] }: { title: string; headers: string[]; rows: string[][]; actions?: DetailTableAction[] }) {
  const visibleHeaders = headers.filter((header) => header !== "Action");
  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-3"><SectionTitle title={title} /></div>
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
              <div className="mt-4">
                {actions[rowIndex].href ? (
                  <Link href={actions[rowIndex].href} className="inline-flex w-full justify-center rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-50">{actions[rowIndex].label}</Link>
                ) : (
                  <button type="button" onClick={actions[rowIndex].onClick} className="inline-flex w-full justify-center rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-50">{actions[rowIndex].label}</button>
                )}
              </div>
            ) : null}
          </article>
        ))}
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-semibold text-slate-500">No records yet for this jobsite.</div>
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
                    {actions[rowIndex].href ? (
                      <Link href={actions[rowIndex].href} className="inline-flex rounded-md border border-blue-200 px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-50">{actions[rowIndex].label}</Link>
                    ) : (
                      <button type="button" onClick={actions[rowIndex].onClick} className="inline-flex rounded-md border border-blue-200 px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-50">{actions[rowIndex].label}</button>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={headers.length} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">No records yet for this jobsite.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
