"use client";

import Link from "next/link";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Download,
  Edit3,
  FileText,
  Flame,
  ImageUp,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  Card,
  ExportButton,
  PageHeader,
  SectionTitle,
  StatusIcon,
  cx,
} from "@/components/safe-predict/SafePredictPrimitives";
import { useSafePredictData } from "@/components/safe-predict/SafePredictDataProvider";
import {
  type SafePredictDemoEmployee,
  type SafePredictDemoEmployeeStatus,
  type SafePredictPermitSummary,
  type SafePredictTradeReadiness,
} from "@/lib/safePredictMockData";
import type { SafePredictJobsiteRecord, SafePredictPermitRecord } from "@/lib/safePredictData";
import type { SafePredictTrainingMatrix } from "@/lib/safePredictData";
import {
  buildSafePredictTrainingTradeGroups,
  type SafePredictTrainingRequirementGroup,
  type SafePredictTrainingTradeGroup,
  type SafePredictTrainingWorkerSummary,
} from "@/lib/safePredictTrainingMatrix";

const statusLabels: Record<SafePredictDemoEmployeeStatus, string> = {
  compliant: "Compliant",
  expiring: "Expiring Soon",
  overdue: "Overdue",
};

type WorkflowSeverity = "critical" | "high" | "medium";
type WorkflowKind = "training" | "permit" | "jobsite";

type WorkforceWorkflowItem = {
  id: string;
  kind: WorkflowKind;
  title: string;
  detail: string;
  actionTitle: string;
  linkedRisk: string;
  siteId: string;
  siteName: string;
  severity: WorkflowSeverity;
  dueAt: string;
  href: string;
  canCreate: boolean;
};

type WorkflowStatus = {
  state: "idle" | "busy" | "success" | "error";
  message?: string;
};

type WorkforceTabId = "overview" | "workforce" | "training" | "permits" | "jobsites" | "forecast" | "reports";

type TrainingGroup = SafePredictTradeReadiness & {
  overdueCount: number;
  expiringCount: number;
  compliantCount: number;
};

type PermitCategoryGroup = {
  category: string;
  active: number;
  expiringSoon: number;
  expired: number;
  missingSignatures: number;
  rows: SafePredictPermitSummary[];
};

type TrackedTrainingRecord = {
  id: string;
  requirement_id?: string | null;
  title: string;
  completed_on?: string | null;
  expires_on?: string | null;
  provider?: string | null;
  source?: string | null;
  notes?: string | null;
};

type TrainingRecordForm = {
  title: string;
  completedOn: string;
  expiresOn: string;
  provider: string;
  notes: string;
  source: string;
};

type EmployeeContactForm = {
  email: string;
  phone: string;
};

const emptyTrainingRecordForm: TrainingRecordForm = {
  title: "",
  completedOn: "",
  expiresOn: "",
  provider: "",
  notes: "",
  source: "manual",
};

const emptyEmployeeContactForm: EmployeeContactForm = {
  email: "",
  phone: "",
};

type TrainingRecordPhotoDraft = Omit<TrainingRecordForm, "source"> & {
  confidence: number;
  warnings: string[];
};

const workforceTabs: Array<{ id: WorkforceTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "workforce", label: "Workforce" },
  { id: "training", label: "Training Matrix" },
  { id: "permits", label: "Permits" },
  { id: "jobsites", label: "Jobsite Assignments" },
  { id: "forecast", label: "Forecast Actions" },
  { id: "reports", label: "Reports" },
];

function employeeStatusRank(status: SafePredictDemoEmployeeStatus) {
  if (status === "overdue") return 0;
  if (status === "expiring") return 1;
  return 2;
}

function permitStatusRank(row: Pick<SafePredictPermitSummary, "expiringSoon" | "expired">) {
  if (row.expired > 0) return 0;
  if (row.expiringSoon > 0) return 1;
  return 2;
}

function formatDueDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function trainingGroupsFromTrades(trades: SafePredictTradeReadiness[]): TrainingGroup[] {
  return trades
    .map((trade) => {
      const statuses = [trade.fallProtection, trade.confinedSpace, trade.loto, trade.hazcom, trade.firstAid];
      return {
        ...trade,
        overdueCount: statuses.filter((status) => status === "overdue").length,
        expiringCount: statuses.filter((status) => status === "expiring").length,
        compliantCount: statuses.filter((status) => status === "compliant").length,
      };
    })
    .sort((a, b) => b.overdueCount - a.overdueCount || b.expiringCount - a.expiringCount || a.trade.localeCompare(b.trade));
}

function permitCategoryForType(type: string) {
  const value = type.toLowerCase();
  if (value.includes("hot") || value.includes("fire") || value.includes("burn")) return "Hot Work / Fire";
  if (value.includes("electrical") || value.includes("loto") || value.includes("lockout") || value.includes("energy")) return "Energy Control";
  if (value.includes("scaffold") || value.includes("elevated") || value.includes("fall") || value.includes("ladder")) return "Work at Height";
  if (value.includes("excavat") || value.includes("trench") || value.includes("confined")) return "Excavation / Confined Space";
  if (value.includes("crane") || value.includes("lift") || value.includes("rigging")) return "Lifting Operations";
  return "General High Risk";
}

function permitCategoryGroups(permitRows: SafePredictPermitSummary[], permitRecords: SafePredictPermitRecord[]): PermitCategoryGroup[] {
  const missingByType = new Map<string, number>();
  for (const permit of permitRecords) {
    if (permit.readiness !== "Ready") {
      missingByType.set(permit.type, (missingByType.get(permit.type) ?? 0) + 1);
    }
  }

  const groups = new Map<string, PermitCategoryGroup>();
  for (const row of permitRows) {
    const category = permitCategoryForType(row.type);
    const current = groups.get(category) ?? {
      category,
      active: 0,
      expiringSoon: 0,
      expired: 0,
      missingSignatures: 0,
      rows: [],
    };
    current.active += row.active;
    current.expiringSoon += row.expiringSoon;
    current.expired += row.expired;
    current.missingSignatures += missingByType.get(row.type) ?? 0;
    current.rows.push(row);
    groups.set(category, current);
  }

  return Array.from(groups.values()).sort(
    (a, b) =>
      b.expired - a.expired ||
      b.expiringSoon - a.expiringSoon ||
      b.missingSignatures - a.missingSignatures ||
      a.category.localeCompare(b.category)
  );
}

function jobsiteForecastLevel(jobsite: SafePredictJobsiteRecord) {
  if (jobsite.riskLevel === "critical" || jobsite.riskLevel === "high") return "Elevated";
  if (jobsite.riskLevel === "medium" || jobsite.openActions > 0) return "Watch";
  return "Stable";
}

function jobsiteReadinessScore(jobsite: SafePredictJobsiteRecord, employees: SafePredictDemoEmployee[]) {
  const assigned = employees.filter((employee) => employee.assignedSiteId === jobsite.id);
  return assigned.length > 0 ? readinessScoreForEmployees(assigned) : 0;
}

function workflowStatusText(item: WorkforceWorkflowItem, statuses: Record<string, WorkflowStatus>) {
  const status = statuses[item.id];
  if (status?.state === "success") return "Created";
  if (status?.state === "busy") return "Creating";
  if (status?.state === "error") return "Needs Site";
  return item.canCreate ? "Recommended" : "Needs Assignment";
}

function workforceTotalsFromEmployees(employees: SafePredictDemoEmployee[]) {
  const workers = employees.length;
  const compliant = employees.filter((employee) => employee.status === "compliant").length;
  const expiringSoon = employees.filter((employee) => employee.status === "expiring").length;
  const overdue = employees.filter((employee) => employee.status === "overdue").length;
  const percent = (count: number) => (workers > 0 ? Math.round((count / workers) * 100) : 0);
  return {
    workers,
    compliant,
    expiringSoon,
    overdue,
    compliantPercent: percent(compliant),
    expiringSoonPercent: percent(expiringSoon),
    overduePercent: percent(overdue),
  };
}

function readinessScoreForEmployees(employees: SafePredictDemoEmployee[]) {
  if (employees.length === 0) return 0;
  return Math.round(employees.reduce((sum, employee) => sum + employee.readinessScore, 0) / employees.length);
}

function readinessLabel(score: number, hasEmployees: boolean) {
  if (!hasEmployees) return "No roster data";
  if (score >= 80) return "Good";
  if (score >= 65) return "Needs Review";
  return "At Risk";
}

function employeeStatusClass(status: SafePredictDemoEmployeeStatus) {
  if (status === "overdue") return "bg-red-50 text-red-600";
  if (status === "expiring") return "bg-amber-50 text-amber-600";
  return "bg-emerald-50 text-emerald-600";
}

function workflowToneClass(severity: WorkflowSeverity) {
  if (severity === "critical") return "border-red-200 bg-red-50 text-red-700";
  if (severity === "high") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function workflowIcon(kind: WorkflowKind) {
  if (kind === "permit") return <FileText className="h-4 w-4" />;
  if (kind === "jobsite") return <MapPin className="h-4 w-4" />;
  return <Users className="h-4 w-4" />;
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function jobsiteForId(jobsites: SafePredictJobsiteRecord[], siteId: string) {
  return jobsites.find((jobsite) => jobsite.id === siteId);
}

function trackedEmployeeRecordId(employee: SafePredictDemoEmployee | null) {
  if (!employee) return null;
  if (employee.trackedEmployeeId) return employee.trackedEmployeeId;
  return employee.id.startsWith("tracked:") ? employee.id.slice("tracked:".length) : null;
}

function formFromTrainingRecord(record: TrackedTrainingRecord): TrainingRecordForm {
  return {
    title: record.title,
    completedOn: record.completed_on ?? "",
    expiresOn: record.expires_on ?? "",
    provider: record.provider ?? "",
    notes: record.notes ?? "",
    source: record.source ?? "manual",
  };
}

function trainingRecordDateLabel(value?: string | null) {
  return value?.trim() || "No date";
}

function safePermitActionName(value?: string | null): string {
  const cleaned = String(value ?? "").trim();
  if (!cleaned || cleaned.toLowerCase() === "none") return "expiring permit exposure";
  return cleaned;
}

async function safePredictAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function tradeReadinessFromEmployees(employees: SafePredictDemoEmployee[]): SafePredictTradeReadiness[] {
  const byTrade = new Map<string, SafePredictDemoEmployee[]>();
  for (const employee of employees) {
    const trade = employee.trade || "Unassigned";
    byTrade.set(trade, [...(byTrade.get(trade) ?? []), employee]);
  }

  return Array.from(byTrade.entries()).map(([trade, rows]) => {
    const hasOverdue = rows.some((employee) => employee.status === "overdue");
    const hasExpiring = rows.some((employee) => employee.status === "expiring");
    const status: SafePredictDemoEmployeeStatus = hasOverdue ? "overdue" : hasExpiring ? "expiring" : "compliant";
    return {
      trade,
      workers: rows.length,
      fallProtection: status,
      confinedSpace: status,
      loto: status,
      hazcom: status,
      firstAid: status,
      overallStatus: status === "overdue" ? "Overdue" : status === "expiring" ? "Expiring" : "Compliant",
    };
  });
}

function permitSummariesFromPermits(permits: SafePredictPermitRecord[]): SafePredictPermitSummary[] {
  const byType = new Map<string, SafePredictPermitSummary>();
  for (const permit of permits) {
    const type = permit.type || "Permit";
    const current = byType.get(type) ?? { type, active: 0, expiringSoon: 0, expired: 0 };
    if (permit.status === "Expired") current.expired += 1;
    else if (permit.status === "Expiring Soon") current.expiringSoon += 1;
    else current.active += 1;
    byType.set(type, current);
  }
  return Array.from(byType.values());
}

function permitTotals(rows: SafePredictPermitSummary[]) {
  return rows.reduce(
    (total, row) => ({
      active: total.active + row.active,
      expiringSoon: total.expiringSoon + row.expiringSoon,
      expired: total.expired + row.expired,
    }),
    { active: 0, expiringSoon: 0, expired: 0 }
  );
}

function priorityRank(item: WorkforceWorkflowItem) {
  if (item.severity === "critical") return 0;
  if (item.severity === "high") return 1;
  return 2;
}

function buildWorkflowItems(params: {
  employees: SafePredictDemoEmployee[];
  permits: SafePredictPermitRecord[];
  permitRows: SafePredictPermitSummary[];
  jobsites: SafePredictJobsiteRecord[];
}) {
  const { employees, permits, permitRows, jobsites } = params;
  const fallbackSite = jobsites.find((jobsite) => jobsite.status === "active") ?? jobsites[0];
  const items: WorkforceWorkflowItem[] = [];

  for (const employee of employees
    .filter((row) => row.status !== "compliant" || row.readinessScore < 85)
    .sort((a, b) => {
      const aStatus = a.status === "overdue" ? 0 : a.status === "expiring" ? 1 : 2;
      const bStatus = b.status === "overdue" ? 0 : b.status === "expiring" ? 1 : 2;
      return aStatus - bStatus || a.readinessScore - b.readinessScore;
    })
    .slice(0, 5)) {
    const site = jobsiteForId(jobsites, employee.assignedSiteId) ?? fallbackSite;
    const severity: WorkflowSeverity = employee.status === "overdue" || employee.readinessScore < 70 ? "critical" : "medium";
    items.push({
      id: `training-${employee.id}`,
      kind: "training",
      title: `Resolve training readiness for ${employee.name}`,
      detail: `${statusLabels[employee.status]} - ${employee.trade} at ${site?.name ?? "unassigned jobsite"}.`,
      actionTitle: `Resolve training readiness for ${employee.name}`,
      linkedRisk: `${employee.trade} readiness gap`,
      siteId: site?.id ?? "",
      siteName: site?.name ?? "No jobsite assigned",
      severity,
      dueAt: addDaysIso(severity === "critical" ? 7 : 14),
      href: "/safe-predict/training",
      canCreate: Boolean(site?.id),
    });
  }

  const permitSource = permits.length > 0
    ? permits
        .filter((permit) => permit.status !== "Active")
        .slice(0, 5)
        .map((permit) => ({
          id: permit.id,
          type: permit.type,
          status: permit.status,
          siteId: permit.siteId,
          siteName: jobsiteForId(jobsites, permit.siteId)?.name ?? "Assigned jobsite",
        }))
    : permitRows
        .filter((permit) => permit.expired > 0 || permit.expiringSoon > 0)
        .slice(0, 5)
        .map((permit) => ({
          id: permit.type,
          type: permit.type,
          status: permit.expired > 0 ? "Expired" : "Expiring Soon",
          siteId: fallbackSite?.id ?? "",
          siteName: fallbackSite?.name ?? "No jobsite available",
        }));

  for (const permit of permitSource) {
    const severity: WorkflowSeverity = permit.status === "Expired" ? "critical" : "medium";
    const permitActionName = safePermitActionName(permit.type);
    items.push({
      id: `permit-${permit.id}`,
      kind: "permit",
      title: `Renew or review ${permitActionName}`,
      detail: `${permit.status} permit exposure at ${permit.siteName}.`,
      actionTitle: `Renew or review ${permitActionName}`,
      linkedRisk: `${permitActionName} permit readiness`,
      siteId: permit.siteId,
      siteName: permit.siteName,
      severity,
      dueAt: addDaysIso(severity === "critical" ? 3 : 10),
      href: "/safe-predict/permits",
      canCreate: Boolean(permit.siteId),
    });
  }

  for (const jobsite of jobsites
    .filter((site) => site.riskLevel === "critical" || site.riskLevel === "high" || site.openActions > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 4)) {
    const severity: WorkflowSeverity = jobsite.riskLevel === "critical" ? "critical" : "high";
    items.push({
      id: `jobsite-${jobsite.id}`,
      kind: "jobsite",
      title: `Review workforce prevention plan for ${jobsite.name}`,
      detail: `${jobsite.riskScore} risk score - ${jobsite.openActions} open action${jobsite.openActions === 1 ? "" : "s"}.`,
      actionTitle: `Review workforce prevention plan for ${jobsite.name}`,
      linkedRisk: `${jobsite.name} workforce prevention`,
      siteId: jobsite.id,
      siteName: jobsite.name,
      severity,
      dueAt: addDaysIso(5),
      href: `/safe-predict/jobsites/${encodeURIComponent(jobsite.id)}`,
      canCreate: true,
    });
  }

  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => priorityRank(a) - priorityRank(b));
}

export function SafePredictWorkforceDashboard() {
  const { dataset, loading, mode, createCorrectiveAction, refreshLiveData } = useSafePredictData();
  const [activeTab, setActiveTab] = useState<WorkforceTabId>("overview");
  const [statusFilter, setStatusFilter] = useState<"all" | SafePredictDemoEmployeeStatus>("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [workflowStatuses, setWorkflowStatuses] = useState<Record<string, WorkflowStatus>>({});
  const employees = dataset.employees;
  const jobsites = dataset.jobsites;
  const trades = dataset.tradeReadiness.length > 0 ? dataset.tradeReadiness : tradeReadinessFromEmployees(employees);
  const permitRows = dataset.permitSummaries.length > 0 ? dataset.permitSummaries : permitSummariesFromPermits(dataset.permits);
  const trainingGroups = useMemo(() => trainingGroupsFromTrades(trades), [trades]);
  const permitGroups = useMemo(() => permitCategoryGroups(permitRows, dataset.permits), [dataset.permits, permitRows]);
  const workforce = workforceTotalsFromEmployees(employees);
  const permits = permitTotals(permitRows);
  const readinessScore = readinessScoreForEmployees(employees);
  const hasEmployees = employees.length > 0;
  const isLiveEmpty = mode === "live" && !loading && !hasEmployees;
  const highRiskActivityCount = jobsites.filter((jobsite) => jobsite.riskLevel === "critical" || jobsite.riskLevel === "high").length;
  const forecastLabel = !hasEmployees
    ? "No Data"
    : workforce.overdue > 0 || highRiskActivityCount > 0
      ? "Elevated"
      : workforce.expiringSoon > 0 || permits.expiringSoon > 0
        ? "Watch"
        : "Stable";
  const forecastDetail = !hasEmployees
    ? "Upload workforce records to calculate."
    : forecastLabel === "Elevated"
      ? `${workforce.overdue} overdue worker${workforce.overdue === 1 ? "" : "s"} and ${highRiskActivityCount} high-risk site${highRiskActivityCount === 1 ? "" : "s"}.`
      : forecastLabel === "Watch"
        ? `${workforce.expiringSoon} expiring worker record${workforce.expiringSoon === 1 ? "" : "s"} or permit renewal signal.`
        : "No elevated workforce signals.";
  const forecastClassName =
    forecastLabel === "Elevated"
      ? "text-purple-700"
      : forecastLabel === "Watch"
        ? "text-amber-600"
        : forecastLabel === "Stable"
          ? "text-emerald-700"
          : "text-slate-500";
  const predictedRiskImpact = !hasEmployees ? "No Data" : forecastLabel === "Elevated" ? "High" : forecastLabel === "Watch" ? "Watch" : "Stable";
  const incidentLikelihood = !hasEmployees ? "No Data" : forecastLabel === "Elevated" ? "Elevated" : forecastLabel === "Watch" ? "Moderate" : "Low";
  const activeFilterText = [
    statusFilter !== "all" ? statusLabels[statusFilter] : "All statuses",
    siteFilter !== "all" ? jobsiteForId(jobsites, siteFilter)?.name ?? "Selected site" : "All jobsites",
    query.trim() ? `"${query.trim()}"` : "No search",
  ].join(" / ");
  const visibleEmployees = useMemo(
    () =>
      employees
        .filter((employee) => {
          const jobsite = jobsiteForId(jobsites, employee.assignedSiteId);
          const searchable = [employee.name, employee.id, employee.trade, employee.role, employee.supervisor, jobsite?.name, employee.shift]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return (
            (statusFilter === "all" || employee.status === statusFilter) &&
            (siteFilter === "all" || employee.assignedSiteId === siteFilter) &&
            (!query.trim() || searchable.includes(query.trim().toLowerCase()))
          );
        })
        .sort((a, b) => employeeStatusRank(a.status) - employeeStatusRank(b.status) || a.readinessScore - b.readinessScore || a.name.localeCompare(b.name)),
    [employees, jobsites, query, siteFilter, statusFilter]
  );
  const workflowItems = useMemo(
    () => buildWorkflowItems({ employees, permits: dataset.permits, permitRows, jobsites }),
    [dataset.permits, employees, jobsites, permitRows]
  );
  const topCreatableItems = workflowItems.filter((item) => item.canCreate && workflowStatuses[item.id]?.state !== "success").slice(0, 3);
  const selectedEmployee = selectedEmployeeId
    ? employees.find((employee) => employee.id === selectedEmployeeId) ?? null
    : null;

  useEffect(() => {
    if (!selectedEmployee) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedEmployeeId(null);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedEmployee]);

  function filterBySite(siteId: string) {
    setSiteFilter(siteId);
    setActiveTab("jobsites");
  }

  function clearRosterFilters() {
    setStatusFilter("all");
    setSiteFilter("all");
    setQuery("");
  }

  function activateKpi(tab: WorkforceTabId, status?: SafePredictDemoEmployeeStatus | "all") {
    setActiveTab(tab);
    if (status) setStatusFilter(status);
  }

  async function createWorkflowAction(item: WorkforceWorkflowItem) {
    if (!item.canCreate || !item.siteId) {
      setWorkflowStatuses((current) => ({
        ...current,
        [item.id]: {
          state: "error",
          message: "Assign this worker or record to a jobsite before creating a corrective action.",
        },
      }));
      return;
    }

    setWorkflowStatuses((current) => ({ ...current, [item.id]: { state: "busy" } }));
    const result = await createCorrectiveAction({
      title: item.actionTitle,
      linkedRiskId: item.id,
      linkedRisk: item.linkedRisk,
      siteId: item.siteId,
      priority: item.severity === "medium" ? "medium" : "high",
      createdFrom: "Manual",
      description: item.detail,
      category: "corrective_action",
      dueAt: item.dueAt,
      status: "New",
    });

    if (!result.success) {
      setWorkflowStatuses((current) => ({
        ...current,
        [item.id]: {
          state: "error",
          message: result.error || "Could not create this action.",
        },
      }));
      return;
    }

    setWorkflowStatuses((current) => ({
      ...current,
      [item.id]: {
        state: "success",
        message: mode === "live" ? "Saved to corrective actions." : "Queued locally in demo mode.",
      },
    }));
    refreshLiveData();
  }

  async function createTopWorkflowActions() {
    for (const item of topCreatableItems) {
      await createWorkflowAction(item);
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 pb-8 sm:px-7">
      <PageHeader
        title="Workforce Readiness & Prevention"
        subtitle="A command view for training readiness, permit exposure, and crew-prevention follow-through."
        actions={
          <>
            <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm">
              <CalendarDays className="h-4 w-4" />
              May 20 - May 26, 2026
            </button>
            <button
              type="button"
              onClick={refreshLiveData}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <Link href="/safe-predict/team-access" className="inline-flex h-11 items-center gap-2 rounded-lg border border-blue-100 bg-white px-4 text-sm font-black text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50">
              <Users className="h-4 w-4" />
              Manage Team Access
            </Link>
            <ExportButton
              fileName="safe-predict-workforce-readiness.json"
              label="Export workforce readiness report"
              payload={{ company: dataset.company, workforce, permits, employees, jobsites, trades, permitRows, workflowItems }}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)]"
            >
              <Download className="h-4 w-4" />
              Export Report
            </ExportButton>
          </>
        }
      />

      <section className="rounded-lg border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <div className="grid gap-0 xl:grid-cols-[250px_minmax(0,1fr)_320px]">
          <button type="button" onClick={() => activateKpi("overview", "all")} className="border-b border-slate-200 p-5 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 xl:border-b-0 xl:border-r">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Overall Readiness</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full p-2" style={{ background: `conic-gradient(#16a34a 0 ${readinessScore}%, #dcfce7 ${readinessScore}% 100%)` }}>
                <div className="grid h-full w-full place-items-center rounded-full bg-white text-center">
                  <span>
                    <span className="block text-3xl font-black text-slate-950">{hasEmployees ? readinessScore : "--"}</span>
                    <span className="text-xs font-bold text-slate-500">{hasEmployees ? "/100" : "No data"}</span>
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xl font-black text-emerald-700">{readinessLabel(readinessScore, hasEmployees)}</p>
                <p className="mt-2 text-sm font-semibold leading-5 text-slate-600">
                  {isLiveEmpty ? "Add users or upload non-user employees to start tracking readiness." : `${workforce.workers} workers in scope.`}
                </p>
              </div>
            </div>
          </button>
          <div className="grid divide-y divide-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
            <StatusSummaryButton title="Compliant" value={`${workforce.compliantPercent}%`} detail={`${workforce.compliant} worker${workforce.compliant === 1 ? "" : "s"}`} tone="green" active={statusFilter === "compliant" && activeTab === "workforce"} onClick={() => activateKpi("workforce", "compliant")} />
            <StatusSummaryButton title="Expiring Soon" value={`${workforce.expiringSoonPercent}%`} detail={`${workforce.expiringSoon} worker${workforce.expiringSoon === 1 ? "" : "s"}`} tone="amber" active={statusFilter === "expiring" && activeTab === "workforce"} onClick={() => activateKpi("workforce", "expiring")} />
            <StatusSummaryButton title="Overdue" value={`${workforce.overduePercent}%`} detail={`${workforce.overdue} worker${workforce.overdue === 1 ? "" : "s"}`} tone="red" active={statusFilter === "overdue" && activeTab === "workforce"} onClick={() => activateKpi("workforce", "overdue")} />
          </div>
          <div className="grid gap-0 border-t border-slate-200 md:grid-cols-2 xl:border-l xl:border-t-0">
            <button type="button" onClick={() => activateKpi("permits")} className={cx("border-b border-slate-200 p-5 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 md:border-b-0 md:border-r xl:border-b", activeTab === "permits" ? "bg-blue-50/70" : undefined)}>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white"><FileText className="h-5 w-5" /></span>
              <p className="mt-3 text-sm font-black text-slate-900">Permit Exposure</p>
              <p className="mt-1 font-app-display text-3xl font-black text-slate-950">{permits.expiringSoon + permits.expired}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">{permits.active} active across {jobsites.length} site{jobsites.length === 1 ? "" : "s"}.</p>
            </button>
            <button type="button" onClick={() => activateKpi("forecast")} className={cx("p-5 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100", activeTab === "forecast" ? "bg-blue-50/70" : undefined)}>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600 text-white"><TrendingUp className="h-5 w-5" /></span>
              <p className="mt-3 text-sm font-black text-slate-900">Forecast</p>
              <p className={cx("mt-1 font-app-display text-2xl font-black", forecastClassName)}>{forecastLabel}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{forecastDetail}</p>
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <p className="text-sm font-bold text-slate-700">Active view: <span className="text-slate-950">{activeFilterText}</span></p>
          {statusFilter !== "all" || siteFilter !== "all" || query.trim() ? <button type="button" onClick={clearRosterFilters} className="text-sm font-black text-blue-600">Clear filters</button> : null}
        </div>
      </section>

      <div className="sticky top-0 z-20 mt-5 rounded-lg border border-slate-200 bg-white/95 shadow-[0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 px-3 py-3">
          {workforceTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cx(
                "h-10 shrink-0 rounded-lg px-3 text-sm font-black transition focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
                activeTab === tab.id ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 p-3 lg:grid-cols-[minmax(220px,1fr)_190px_190px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workers, trades, supervisors, jobsites"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as "all" | SafePredictDemoEmployeeStatus);
              if (activeTab === "overview") setActiveTab("workforce");
            }}
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="all">All statuses</option>
            <option value="overdue">Overdue first</option>
            <option value="expiring">Expiring soon</option>
            <option value="compliant">Compliant</option>
          </select>
          <select
            value={siteFilter}
            onChange={(event) => setSiteFilter(event.target.value)}
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="all">All jobsites</option>
            {jobsites.map((jobsite) => (
              <option key={jobsite.id} value={jobsite.id}>{jobsite.name}</option>
            ))}
          </select>
          <button type="button" onClick={clearRosterFilters} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50">
            <SlidersHorizontal className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <aside className="order-first xl:order-last">
          <WorkflowActionRail items={workflowItems} statuses={workflowStatuses} topCount={topCreatableItems.length} onCreate={createWorkflowAction} onCreateTop={createTopWorkflowActions} />
        </aside>
        <main className="order-last grid min-w-0 gap-5 xl:order-first">
          {activeTab === "overview" ? (
            <OverviewTab
              employees={employees}
              hasEmployees={hasEmployees}
              highRiskActivityCount={highRiskActivityCount}
              incidentLikelihood={incidentLikelihood}
              jobsites={jobsites}
              permitExposure={permits.expiringSoon + permits.expired}
              permitRows={permitRows}
              predictedRiskImpact={predictedRiskImpact}
              workflowItems={workflowItems}
              workforce={workforce}
              onCreateAction={createWorkflowAction}
              workflowStatuses={workflowStatuses}
            />
          ) : null}
          {activeTab === "workforce" ? (
            <WorkforceDataGrid
              activeFilterText={activeFilterText}
              employees={employees}
              isLiveEmpty={isLiveEmpty}
              jobsites={jobsites}
              selectedEmployeeId={selectedEmployeeId}
              visibleEmployees={visibleEmployees}
              onOpenEmployee={setSelectedEmployeeId}
            />
          ) : null}
          {activeTab === "training" ? (
            <TrainingMatrixTab groups={trainingGroups} trainingMatrix={dataset.trainingMatrix} />
          ) : null}
          {activeTab === "permits" ? <PermitsTab groups={permitGroups} permits={permits} /> : null}
          {activeTab === "jobsites" ? (
            <JobsiteAssignmentsTab
              employees={employees}
              jobsites={jobsites}
              permits={dataset.permits}
              siteFilter={siteFilter}
              onFilter={filterBySite}
            />
          ) : null}
          {activeTab === "forecast" ? (
            <ForecastActionsTab items={workflowItems} statuses={workflowStatuses} onCreate={createWorkflowAction} />
          ) : null}
          {activeTab === "reports" ? (
            <ReportsTab
              dataset={dataset}
              employees={employees}
              jobsites={jobsites}
              permitGroups={permitGroups}
              permits={permits}
              trades={trainingGroups}
              workflowItems={workflowItems}
              workforce={workforce}
            />
          ) : null}
        </main>
      </div>

      <EmployeeProfileDrawer
        employee={selectedEmployee}
        jobsites={jobsites}
        onClose={() => setSelectedEmployeeId(null)}
        onTrainingRecordsChanged={refreshLiveData}
      />
      <p className="mt-5 text-center text-xs font-semibold text-slate-500">Data is refreshed every 15 minutes</p>
    </div>
  );
}

function OverviewTab({
  employees,
  hasEmployees,
  highRiskActivityCount,
  incidentLikelihood,
  jobsites,
  permitExposure,
  permitRows,
  predictedRiskImpact,
  workflowItems,
  workforce,
  workflowStatuses,
  onCreateAction,
}: {
  employees: SafePredictDemoEmployee[];
  hasEmployees: boolean;
  highRiskActivityCount: number;
  incidentLikelihood: string;
  jobsites: SafePredictJobsiteRecord[];
  permitExposure: number;
  permitRows: SafePredictPermitSummary[];
  predictedRiskImpact: string;
  workflowItems: WorkforceWorkflowItem[];
  workforce: ReturnType<typeof workforceTotalsFromEmployees>;
  workflowStatuses: Record<string, WorkflowStatus>;
  onCreateAction: (item: WorkforceWorkflowItem) => void;
}) {
  const workersNotReady = employees
    .filter((employee) => employee.status !== "compliant")
    .sort((a, b) => employeeStatusRank(a.status) - employeeStatusRank(b.status) || a.readinessScore - b.readinessScore)
    .slice(0, 5);
  const permitsDue = permitRows
    .filter((permit) => permit.expired > 0 || permit.expiringSoon > 0)
    .sort((a, b) => permitStatusRank(a) - permitStatusRank(b) || b.expired + b.expiringSoon - (a.expired + a.expiringSoon))
    .slice(0, 5);
  const elevatedSites = jobsites
    .filter((jobsite) => jobsite.riskLevel === "critical" || jobsite.riskLevel === "high" || jobsite.openActions > 0)
    .sort((a, b) => b.riskScore - a.riskScore || b.openActions - a.openActions)
    .slice(0, 4);

  return (
    <div className="grid gap-5">
      <PreventionInsightsCard
        hasEmployees={hasEmployees}
        highRiskActivityCount={highRiskActivityCount}
        incidentLikelihood={incidentLikelihood}
        permitExposure={permitExposure}
        predictedRiskImpact={predictedRiskImpact}
        workforce={workforce}
      />
      <div className="grid gap-5 2xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Workers Not Ready" hint="Overdue and expiring workforce records sorted before compliant records." />
          <div className="mt-4 space-y-3">
            {workersNotReady.map((employee) => (
              <div key={employee.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{employee.name}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">{employee.trade} - {employee.role}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={cx("rounded-full px-3 py-1 text-xs font-black", employeeStatusClass(employee.status))}>{statusLabels[employee.status]}</span>
                  <p className="mt-1 text-xs font-black text-slate-700">{employee.readinessScore}/100</p>
                </div>
              </div>
            ))}
            {workersNotReady.length === 0 ? <EmptyPanel>No worker readiness exceptions are active.</EmptyPanel> : null}
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle title="Permits Required Today" hint="Permit categories with expired or expiring requirements appear first." />
          <div className="mt-4 space-y-3">
            {permitsDue.map((permit) => (
              <div key={permit.type} className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-black text-slate-950">{permit.type}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{permitCategoryForType(permit.type)}</p>
                </div>
                <div className="flex gap-2 text-xs font-black">
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-600">{permit.expired} overdue</span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-600">{permit.expiringSoon} expiring</span>
                </div>
              </div>
            ))}
            {permitsDue.length === 0 ? <EmptyPanel>No permit renewals are due today.</EmptyPanel> : null}
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle title="Jobsites With Elevated Risk" hint="Sites are sorted by forecast risk, then open action load." />
          <div className="mt-4 grid gap-3">
            {elevatedSites.map((jobsite) => (
              <div key={jobsite.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{jobsite.name}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{jobsite.phase}</p>
                  </div>
                  <span className={cx("rounded-full px-3 py-1 text-xs font-black", jobsiteForecastLevel(jobsite) === "Elevated" ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-600")}>{jobsiteForecastLevel(jobsite)}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
                  <span className="rounded-lg bg-white p-2 text-slate-700">{jobsite.workforceCount} workers</span>
                  <span className="rounded-lg bg-white p-2 text-slate-700">{jobsite.activePermits} permits</span>
                  <span className="rounded-lg bg-white p-2 text-slate-700">{jobsite.openActions} actions</span>
                </div>
              </div>
            ))}
            {elevatedSites.length === 0 ? <EmptyPanel>No elevated jobsites are active.</EmptyPanel> : null}
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle title="Top Recommended Actions" hint="Highest priority actions can be created from the command center." />
          <div className="mt-4 space-y-3">
            {workflowItems.slice(0, 5).map((item) => {
              const status = workflowStatuses[item.id];
              return (
                <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-start gap-3">
                    <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg border", workflowToneClass(item.severity))}>{workflowIcon(item.kind)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black leading-5 text-slate-950">{item.title}</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-500">Due {formatDueDate(item.dueAt)} - {workflowStatusText(item, workflowStatuses)}</span>
                    <button type="button" onClick={() => onCreateAction(item)} disabled={status?.state === "busy" || status?.state === "success"} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500">
                      {status?.state === "busy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      Create
                    </button>
                  </div>
                  {status?.message ? <p className={cx("mt-2 text-xs font-bold", status.state === "error" ? "text-red-600" : "text-emerald-700")}>{status.message}</p> : null}
                </div>
              );
            })}
            {workflowItems.length === 0 ? <EmptyPanel>No recommended actions are available yet.</EmptyPanel> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

function WorkforceDataGrid({
  activeFilterText,
  employees,
  isLiveEmpty,
  jobsites,
  selectedEmployeeId,
  visibleEmployees,
  onOpenEmployee,
}: {
  activeFilterText: string;
  employees: SafePredictDemoEmployee[];
  isLiveEmpty: boolean;
  jobsites: SafePredictJobsiteRecord[];
  selectedEmployeeId: string | null;
  visibleEmployees: SafePredictDemoEmployee[];
  onOpenEmployee: (id: string) => void;
}) {
  return (
    <Card id="employee-roster" className="scroll-mt-36 overflow-hidden">
      <div className="border-b border-slate-200 p-5">
        <SectionTitle title="Workforce Roster" action={<span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">{visibleEmployees.length} of {employees.length}</span>} hint="Searchable roster sorted exception-first: overdue, expiring soon, then compliant." />
        <p className="mt-2 text-sm font-semibold text-slate-600">{activeFilterText}</p>
      </div>
      <div className="space-y-3 p-4 md:hidden">
        {visibleEmployees.map((employee) => {
          const jobsite = jobsiteForId(jobsites, employee.assignedSiteId);
          return (
            <MobileRecordCard
              key={`${employee.id}-mobile-grid`}
              title={employee.name}
              rows={[["Trade / Role", `${employee.trade} / ${employee.role}`], ["Assigned jobsite", jobsite?.name ?? "Unassigned"], ["Readiness", `${employee.readinessScore}/100`], ["Status", statusLabels[employee.status]]]}
              active={selectedEmployeeId === employee.id}
              actionLabel={`Open ${employee.name}`}
              onClick={() => onOpenEmployee(employee.id)}
            />
          );
        })}
        {visibleEmployees.length === 0 ? <EmptyPanel>{isLiveEmpty ? "No workforce records yet. Add users or upload non-user employees to populate this roster." : "No employees match those filters."}</EmptyPanel> : null}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase text-slate-500">
              <th className="px-5 py-3">Worker</th>
              <th className="px-5 py-3">Trade / Role</th>
              <th className="px-5 py-3">Jobsite</th>
              <th className="px-5 py-3 text-center">Readiness</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Supervisor</th>
              <th className="px-5 py-3">Last Signal</th>
            </tr>
          </thead>
          <tbody>
            {visibleEmployees.map((employee) => {
              const jobsite = jobsiteForId(jobsites, employee.assignedSiteId);
              return (
                <tr key={employee.id} onClick={() => onOpenEmployee(employee.id)} className={cx("group cursor-pointer border-b border-slate-100 transition hover:bg-blue-50/60", selectedEmployeeId === employee.id ? "bg-blue-50" : undefined)}>
                  <td className="px-5 py-3">
                    <button type="button" className="text-left font-black text-slate-950 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100" onClick={() => onOpenEmployee(employee.id)}>{employee.name}</button>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{employee.id} - {employee.shift}</p>
                  </td>
                  <td className="px-5 py-3"><p className="font-semibold text-slate-800">{employee.trade}</p><p className="mt-1 text-xs text-slate-500">{employee.role}</p></td>
                  <td className="px-5 py-3 font-semibold text-slate-700">{jobsite?.name ?? "Unassigned"}</td>
                  <td className="px-5 py-3 text-center"><span className="inline-flex min-w-12 justify-center rounded-full bg-slate-100 px-3 py-1 font-black text-slate-900">{employee.readinessScore}</span></td>
                  <td className="px-5 py-3"><span className={cx("rounded-full px-3 py-1 text-xs font-black", employeeStatusClass(employee.status))}>{statusLabels[employee.status]}</span></td>
                  <td className="px-5 py-3 font-semibold text-slate-700">{employee.supervisor}</td>
                  <td className="px-5 py-3 text-xs font-semibold text-slate-500">{employee.lastActivity}</td>
                </tr>
              );
            })}
            {visibleEmployees.length === 0 ? <tr><td colSpan={7} className="px-5 py-10 text-center text-sm font-semibold text-slate-500">{isLiveEmpty ? "No workforce records yet. Add users or upload non-user employees to populate this roster." : "No employees match those filters."}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TrainingWorkerList({
  label,
  workers,
  tone,
}: {
  label: string;
  workers: SafePredictTrainingWorkerSummary[];
  tone: "red" | "amber" | "green";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-100 bg-red-50 text-red-700"
      : tone === "amber"
        ? "border-amber-100 bg-amber-50 text-amber-700"
        : "border-emerald-100 bg-emerald-50 text-emerald-700";
  const visibleWorkers = workers.slice(0, 5);
  const remaining = workers.length - visibleWorkers.length;

  if (workers.length === 0) return null;

  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {visibleWorkers.map((worker) => (
          <span key={`${worker.id}-${label}`} title={worker.detail} className={cx("rounded-full border px-2.5 py-1 text-xs font-black", toneClass)}>
            {worker.name}
          </span>
        ))}
        {remaining > 0 ? (
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600">
            +{remaining} more
          </span>
        ) : null}
      </div>
    </div>
  );
}

function RequirementScope({
  requirement,
}: {
  requirement: SafePredictTrainingRequirementGroup;
}) {
  const scopes = [
    ...requirement.positions.map((value) => `Position: ${value}`),
    ...requirement.trades.map((value) => `Trade: ${value}`),
    ...requirement.subTrades.map((value) => `Subtrade: ${value}`),
    ...requirement.taskCodes.map((value) => `Task: ${value.replace(/_/g, " ")}`),
  ];

  if (scopes.length === 0) {
    return <p className="mt-2 text-xs font-semibold text-slate-500">Applies to all in-scope workers.</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {scopes.slice(0, 6).map((scope) => (
        <span key={scope} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-600">
          {scope}
        </span>
      ))}
      {scopes.length > 6 ? (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-600">
          +{scopes.length - 6} more
        </span>
      ) : null}
    </div>
  );
}

function DynamicRequirementCard({
  requirement,
  trade,
}: {
  requirement: SafePredictTrainingRequirementGroup;
  trade: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-black leading-5 text-slate-950">{requirement.title}</p>
          <RequirementScope requirement={requirement} />
        </div>
        <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-xs font-black", employeeStatusClass(requirement.overallStatus))}>
          {statusLabels[requirement.overallStatus]}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black">
        <span className="rounded-lg bg-red-50 p-2 text-red-600">{requirement.overdueCount}<span className="block text-[10px] uppercase">Need it</span></span>
        <span className="rounded-lg bg-amber-50 p-2 text-amber-600">{requirement.expiringCount}<span className="block text-[10px] uppercase">Expiring</span></span>
        <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">{requirement.compliantCount}<span className="block text-[10px] uppercase">Have it</span></span>
      </div>
      <div className="mt-4 grid gap-3">
        <TrainingWorkerList label={`Who needs it in ${trade}`} workers={requirement.overdueWorkers} tone="red" />
        <TrainingWorkerList label="Expiring soon" workers={requirement.expiringWorkers} tone="amber" />
        <TrainingWorkerList label="Has it" workers={requirement.compliantWorkers} tone="green" />
      </div>
    </article>
  );
}

function DynamicTrainingTradeSection({
  group,
  isOpen,
  onToggle,
}: {
  group: SafePredictTrainingTradeGroup;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <section>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
        <div className="min-w-0">
          <p className="text-base font-black text-slate-950">{group.trade}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">{group.workers} workers - {group.overdueCount} need it - {group.expiringCount} expiring</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">{group.overdueCount}</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-600">{group.expiringCount}</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{group.compliantCount}</span>
          <ChevronDown className={cx("h-4 w-4 text-slate-400 transition", isOpen ? "rotate-180" : undefined)} />
        </div>
      </button>
      {isOpen ? (
        <div className="grid gap-3 bg-slate-50 p-4 lg:grid-cols-2">
          {group.requirements.map((requirement) => (
            <DynamicRequirementCard key={`${group.trade}-${requirement.id}`} trade={group.trade} requirement={requirement} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StaticTrainingFallback({
  groups,
}: {
  groups: TrainingGroup[];
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  return (
      <div className="divide-y divide-slate-100">
        {groups.map((group) => {
          const isOpen = expanded[group.trade] ?? group.overdueCount > 0;
          return (
            <section key={group.trade}>
              <button type="button" onClick={() => setExpanded((current) => ({ ...current, [group.trade]: !isOpen }))} className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
                <div className="min-w-0">
                  <p className="text-base font-black text-slate-950">{group.trade}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{group.workers} workers - {group.overdueCount} overdue - {group.expiringCount} expiring</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">{group.overdueCount}</span>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-600">{group.expiringCount}</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{group.compliantCount}</span>
                  <ChevronDown className={cx("h-4 w-4 text-slate-400 transition", isOpen ? "rotate-180" : undefined)} />
                </div>
              </button>
              {isOpen ? (
                <div className="grid gap-3 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-5">
                  {([
                    ["Fall Protection", group.fallProtection],
                    ["Confined Space", group.confinedSpace],
                    ["LOTO", group.loto],
                    ["HazCom", group.hazcom],
                    ["First Aid", group.firstAid],
                  ] as Array<[string, SafePredictDemoEmployeeStatus]>).map(([label, status]) => (
                    <div key={`${group.trade}-${label}`} className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <StatusIcon status={status} />
                        <span className={cx("rounded-full px-2.5 py-1 text-xs font-black", employeeStatusClass(status))}>{statusLabels[status]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
        {groups.length === 0 ? <div className="p-5"><EmptyPanel>No training matrix rows yet.</EmptyPanel></div> : null}
      </div>
  );
}

function TrainingMatrixTab({ groups, trainingMatrix }: { groups: TrainingGroup[]; trainingMatrix: SafePredictTrainingMatrix }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const dynamicGroups = useMemo(() => buildSafePredictTrainingTradeGroups(trainingMatrix), [trainingMatrix]);
  const hasDynamicMatrix = dynamicGroups.length > 0;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 p-5">
        <SectionTitle
          title="Training Matrix"
          hint={
            hasDynamicMatrix
              ? "Live company training requirements grouped by trade, with in-scope workers and exception counts."
              : "Fallback training tiles are shown until company training requirements and worker records are available."
          }
        />
        {!hasDynamicMatrix ? (
          <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            Configure company training requirements in Training Tracker to make this view authoritative by trade, position, and worker.
          </p>
        ) : null}
        {trainingMatrix.schemaWarning ? (
          <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {trainingMatrix.schemaWarning}
          </p>
        ) : null}
      </div>
      {hasDynamicMatrix ? (
        <div className="divide-y divide-slate-100">
          {dynamicGroups.map((group) => {
            const isOpen = expanded[group.trade] ?? group.overdueCount > 0;
            return (
              <DynamicTrainingTradeSection
                key={group.trade}
                group={group}
                isOpen={isOpen}
                onToggle={() => setExpanded((current) => ({ ...current, [group.trade]: !isOpen }))}
              />
            );
          })}
        </div>
      ) : (
        <StaticTrainingFallback groups={groups} />
      )}
    </Card>
  );
}

function PermitsTab({ groups, permits }: { groups: PermitCategoryGroup[]; permits: { active: number; expiringSoon: number; expired: number } }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 p-5">
        <SectionTitle title="Permit Exposure" action={<Link href="/safe-predict/permits" className="inline-flex items-center gap-2 text-sm font-black text-blue-600">View all permits <ArrowRight className="h-4 w-4" /></Link>} />
      </div>
      <div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-3">
        <MetricLine label="Active" value={permits.active} tone="green" />
        <MetricLine label="Expiring Soon" value={permits.expiringSoon} tone="amber" />
        <MetricLine label="Overdue" value={permits.expired} tone="red" />
      </div>
      <div className="divide-y divide-slate-100">
        {groups.map((group) => (
          <section key={group.category} className="p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_420px] lg:items-start">
              <div>
                <p className="text-lg font-black text-slate-950">{group.category}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{group.rows.length} permit type{group.rows.length === 1 ? "" : "s"} in this high-risk category.</p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs font-black">
                <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">{group.active}<span className="block text-[10px] uppercase">Active</span></span>
                <span className="rounded-lg bg-amber-50 p-2 text-amber-600">{group.expiringSoon}<span className="block text-[10px] uppercase">Expiring</span></span>
                <span className="rounded-lg bg-red-50 p-2 text-red-600">{group.expired}<span className="block text-[10px] uppercase">Overdue</span></span>
                <span className="rounded-lg bg-slate-100 p-2 text-slate-700">{group.missingSignatures}<span className="block text-[10px] uppercase">Signature</span></span>
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {[...group.rows]
                .sort((a, b) => permitStatusRank(a) - permitStatusRank(b) || a.type.localeCompare(b.type))
                .map((permit) => (
                  <div key={`${group.category}-${permit.type}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                    <p className="font-black text-slate-950"><Flame className="mr-2 inline h-4 w-4 text-orange-500" />{permit.type}</p>
                    <p className="mt-2 text-xs font-black text-slate-500">{permit.expired} overdue - {permit.expiringSoon} expiring - {permit.active} active</p>
                  </div>
                ))}
            </div>
          </section>
        ))}
        {groups.length === 0 ? <div className="p-5"><EmptyPanel>No permit records yet.</EmptyPanel></div> : null}
      </div>
    </Card>
  );
}

function JobsiteAssignmentsTab({ employees, jobsites, permits, siteFilter, onFilter }: { employees: SafePredictDemoEmployee[]; jobsites: SafePredictJobsiteRecord[]; permits: SafePredictPermitRecord[]; siteFilter: string; onFilter: (siteId: string) => void }) {
  const sorted = [...jobsites].sort((a, b) => {
    const aLevel = jobsiteForecastLevel(a) === "Elevated" ? 0 : jobsiteForecastLevel(a) === "Watch" ? 1 : 2;
    const bLevel = jobsiteForecastLevel(b) === "Elevated" ? 0 : jobsiteForecastLevel(b) === "Watch" ? 1 : 2;
    return aLevel - bLevel || b.riskScore - a.riskScore;
  });
  return (
    <div className="grid gap-5 2xl:grid-cols-2">
      {sorted.map((jobsite) => {
        const assigned = employees.filter((employee) => employee.assignedSiteId === jobsite.id);
        const sitePermits = permits.filter((permit) => permit.siteId === jobsite.id);
        const highRiskTasks = [jobsite.phase, jobsite.projectType].filter(Boolean).join(" / ");
        const forecast = jobsiteForecastLevel(jobsite);
        const readiness = jobsiteReadinessScore(jobsite, employees);
        return (
          <button key={jobsite.id} type="button" onClick={() => onFilter(jobsite.id)} className={cx("rounded-lg border bg-white p-5 text-left shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:border-blue-200 hover:bg-blue-50/30 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100", siteFilter === jobsite.id ? "border-blue-300 ring-4 ring-blue-100" : "border-slate-200")}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xl font-black leading-tight text-slate-950">{jobsite.name}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{jobsite.address}, {jobsite.cityState}</p>
              </div>
              <span className={cx("rounded-full px-3 py-1 text-xs font-black", forecast === "Elevated" ? "bg-violet-50 text-violet-700" : forecast === "Watch" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-700")}>{forecast}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
              <MetricLine label="Workers" value={assigned.length || jobsite.workforceCount} tone="slate" />
              <MetricLine label="Readiness" value={assigned.length ? readiness : "--"} tone={readiness >= 80 ? "green" : "amber"} />
              <MetricLine label="Required Permits" value={sitePermits.length || jobsite.activePermits} tone="blue" />
              <MetricLine label="High-Risk Tasks" value={jobsite.riskScore} tone={forecast === "Elevated" ? "red" : "amber"} />
              <MetricLine label="Open Actions" value={jobsite.openActions} tone={jobsite.openActions > 0 ? "red" : "green"} />
              <MetricLine label="Forecast" value={forecast} tone={forecast === "Elevated" ? "violet" : forecast === "Watch" ? "amber" : "green"} />
            </div>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">{highRiskTasks}</p>
          </button>
        );
      })}
      {jobsites.length === 0 ? <Card className="p-5"><EmptyPanel>No jobsites yet. Add or import jobsites before assigning workforce records.</EmptyPanel></Card> : null}
    </div>
  );
}

function ForecastActionsTab({ items, statuses, onCreate }: { items: WorkforceWorkflowItem[]; statuses: Record<string, WorkflowStatus>; onCreate: (item: WorkforceWorkflowItem) => void }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 p-5">
        <SectionTitle title="Forecast Actions" hint="AI predictions are organized as prevention work with assignee, due date, and workflow state." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase text-slate-500">
              <th className="px-5 py-3">Prediction</th>
              <th className="px-5 py-3">Reason</th>
              <th className="px-5 py-3">Prevention Action</th>
              <th className="px-5 py-3">Assigned To</th>
              <th className="px-5 py-3">Due Date</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Create</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const status = statuses[item.id];
              return (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-5 py-4"><span className={cx("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black", workflowToneClass(item.severity))}>{workflowIcon(item.kind)}{item.severity}</span></td>
                  <td className="px-5 py-4 font-semibold leading-6 text-slate-700">{item.detail}</td>
                  <td className="px-5 py-4 font-black text-slate-950">{item.actionTitle}</td>
                  <td className="px-5 py-4 font-semibold text-slate-700">{item.siteName || "Safety team"}</td>
                  <td className="px-5 py-4 font-black text-slate-700">{formatDueDate(item.dueAt)}</td>
                  <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{workflowStatusText(item, statuses)}</span>{status?.message ? <p className={cx("mt-2 text-xs font-bold", status.state === "error" ? "text-red-600" : "text-emerald-700")}>{status.message}</p> : null}</td>
                  <td className="px-5 py-4 text-right">
                    <button type="button" onClick={() => onCreate(item)} disabled={!item.canCreate || status?.state === "busy" || status?.state === "success"} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500">
                      {status?.state === "busy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      Action
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 ? <tr><td colSpan={7} className="px-5 py-10 text-center text-sm font-semibold text-slate-500">No forecast actions are available yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ReportsTab({
  dataset,
  employees,
  jobsites,
  permitGroups,
  permits,
  trades,
  workflowItems,
  workforce,
}: {
  dataset: ReturnType<typeof useSafePredictData>["dataset"];
  employees: SafePredictDemoEmployee[];
  jobsites: SafePredictJobsiteRecord[];
  permitGroups: PermitCategoryGroup[];
  permits: { active: number; expiringSoon: number; expired: number };
  trades: TrainingGroup[];
  workflowItems: WorkforceWorkflowItem[];
  workforce: ReturnType<typeof workforceTotalsFromEmployees>;
}) {
  const cards = [
    { title: "Executive Readiness Export", detail: `${workforce.workers} workers, ${permits.expiringSoon + permits.expired} permit exceptions, ${workflowItems.length} AI actions.` },
    { title: "Training Exceptions", detail: `${trades.reduce((total, trade) => total + trade.overdueCount, 0)} overdue modules and ${trades.reduce((total, trade) => total + trade.expiringCount, 0)} expiring modules.` },
    { title: "Permit Exposure", detail: `${permitGroups.length} high-risk categories with ${permits.expired} overdue permits.` },
    { title: "Jobsite Forecast", detail: `${jobsites.filter((jobsite) => jobsiteForecastLevel(jobsite) === "Elevated").length} elevated jobsites and ${jobsites.reduce((total, jobsite) => total + jobsite.openActions, 0)} open actions.` },
  ];
  return (
    <div className="grid gap-5">
      <Card className="p-5">
        <SectionTitle title="Reports" hint="Export-ready command center summaries without rebuilding the long dashboard report." />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <article key={card.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-base font-black text-slate-950">{card.title}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{card.detail}</p>
            </article>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <ExportButton
            fileName="safe-predict-workforce-command-center.json"
            label="Export workforce command center report"
            payload={{ company: dataset.company, workforce, permits, employees, jobsites, trades, permitGroups, workflowItems }}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)]"
          >
            <Download className="h-4 w-4" />
            Export Command Report
          </ExportButton>
          <Link href="/safe-predict/training" className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700">Training report <ArrowRight className="h-4 w-4" /></Link>
          <Link href="/safe-predict/permits" className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700">Permit report <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </Card>
    </div>
  );
}

function MetricLine({ label, value, tone }: { label: string; value: string | number; tone: "green" | "amber" | "red" | "blue" | "violet" | "slate" }) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-600"
        : tone === "red"
          ? "bg-red-50 text-red-600"
          : tone === "blue"
            ? "bg-blue-50 text-blue-700"
            : tone === "violet"
              ? "bg-violet-50 text-violet-700"
              : "bg-slate-100 text-slate-700";
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className={cx("mt-2 inline-flex rounded-full px-3 py-1 text-sm font-black", toneClass)}>{value}</p>
    </div>
  );
}

function StatusSummaryButton({ title, value, detail, tone, active, onClick }: { title: string; value: string; detail: string; tone: "green" | "amber" | "red"; active: boolean; onClick: () => void }) {
  const color = tone === "green" ? "bg-emerald-600" : tone === "amber" ? "bg-amber-500" : "bg-red-500";
  const Icon = tone === "green" ? Check : tone === "amber" ? Clock : AlertCircle;
  return (
    <button type="button" onClick={onClick} className={cx("p-5 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100", active ? "bg-blue-50/70" : undefined)}>
      <div className="flex items-center gap-3">
        <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-lg text-white", color)}><Icon className="h-6 w-6" /></span>
        <div>
          <p className="text-sm font-black text-slate-900">{title}</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">{detail}</p>
        </div>
      </div>
      <p className="mt-4 font-app-display text-4xl font-black text-slate-950">{value}</p>
      <div className="mt-3 h-1.5 rounded-full bg-slate-100">
        <div className={cx("h-full rounded-full", tone === "green" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-red-500")} style={{ width: value }} />
      </div>
    </button>
  );
}

function WorkflowActionRail({ items, statuses, topCount, onCreate, onCreateTop }: { items: WorkforceWorkflowItem[]; statuses: Record<string, WorkflowStatus>; topCount: number; onCreate: (item: WorkforceWorkflowItem) => void; onCreateTop: () => void }) {
  const busy = Object.values(statuses).some((status) => status.state === "busy");
  return (
    <Card className="sticky top-20 overflow-hidden">
      <div className="border-b border-slate-200 p-5">
        <SectionTitle title="Action Workflow" hint="Prioritized next steps generated from workforce, permit, and jobsite risk signals." />
        <p className="mt-2 text-sm leading-6 text-slate-600">Convert the highest readiness signals into corrective actions without leaving the workforce page.</p>
        <button type="button" onClick={onCreateTop} disabled={busy || topCount === 0} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.2)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Create Top Actions
        </button>
      </div>
      <div className="max-h-[calc(100vh-18rem)] space-y-3 overflow-y-auto p-4">
        {items.map((item) => {
          const status = statuses[item.id] ?? { state: "idle" as const };
          return (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg border", workflowToneClass(item.severity))}>{workflowIcon(item.kind)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cx("rounded-full border px-2 py-0.5 text-[11px] font-black uppercase", workflowToneClass(item.severity))}>{item.severity}</span>
                    <span className="truncate text-xs font-bold text-slate-500">{item.siteName}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-black leading-5 text-slate-950">{item.title}</h3>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{item.detail}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => onCreate(item)} disabled={status.state === "busy" || status.state === "success"} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
                  {status.state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {status.state === "success" ? "Created" : "Create Action"}
                </button>
                <Link href={item.href} className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50">Open</Link>
              </div>
              {status.message ? <p aria-live="polite" className={cx("mt-2 text-xs font-bold leading-5", status.state === "error" ? "text-red-600" : "text-emerald-700")}>{status.message}</p> : !item.canCreate ? <p className="mt-2 text-xs font-bold leading-5 text-amber-700">Assign a jobsite before creating this action. <Link href="/safe-predict/team-access" className="underline">Open Team Access</Link></p> : null}
            </article>
          );
        })}
        {items.length === 0 ? <EmptyPanel>No priority actions are visible. New workflow items appear when training, permit, or jobsite risk signals need follow-up.</EmptyPanel> : null}
      </div>
    </Card>
  );
}

function PreventionInsightsCard({ hasEmployees, highRiskActivityCount, incidentLikelihood, permitExposure, predictedRiskImpact, workforce }: { hasEmployees: boolean; highRiskActivityCount: number; incidentLikelihood: string; permitExposure: number; predictedRiskImpact: string; workforce: ReturnType<typeof workforceTotalsFromEmployees> }) {
  return (
    <Card className="p-5">
      <SectionTitle title="Prevention Insights" action={<span className="rounded-md bg-violet-100 px-2 py-1 text-xs font-black text-violet-700">AI</span>} />
      <p className="mt-3 text-sm leading-6 text-slate-700">The model weighs training, permit, and jobsite assignment signals to guide prevention work.</p>
      <div className="mt-4 rounded-lg bg-violet-50 p-4 text-sm font-black leading-6 text-violet-900">{hasEmployees ? `${workforce.overdue} overdue worker${workforce.overdue === 1 ? "" : "s"}, ${permitExposure} permit exposure item${permitExposure === 1 ? "" : "s"}, and ${highRiskActivityCount} high-risk site${highRiskActivityCount === 1 ? "" : "s"}.` : "No workforce records are available yet, so predictive workforce risk is not calculated."}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InsightPill label="Predicted Risk Impact" value={predictedRiskImpact} tone={predictedRiskImpact === "High" ? "red" : predictedRiskImpact === "Watch" ? "amber" : predictedRiskImpact === "Stable" ? "green" : "slate"} />
        <InsightPill label="Incident Likelihood" value={incidentLikelihood} tone={incidentLikelihood === "Elevated" ? "violet" : incidentLikelihood === "Moderate" ? "amber" : incidentLikelihood === "Low" ? "green" : "slate"} />
      </div>
    </Card>
  );
}

function InsightPill({ label, value, tone }: { label: string; value: string; tone: "red" | "amber" | "green" | "violet" | "slate" }) {
  const toneClass = tone === "red" ? "bg-red-50 text-red-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "violet" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-500";
  return <div className="rounded-lg border border-slate-100 bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><span className={cx("mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black", toneClass)}>{value}</span></div>;
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-semibold text-slate-500">{children}</div>;
}

function EmployeeProfileDrawer({
  employee,
  jobsites,
  onClose,
  onTrainingRecordsChanged,
}: {
  employee: SafePredictDemoEmployee | null;
  jobsites: SafePredictJobsiteRecord[];
  onClose: () => void;
  onTrainingRecordsChanged: () => void;
}) {
  const trackedEmployeeId = trackedEmployeeRecordId(employee);
  const [records, setRecords] = useState<TrackedTrainingRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsSaving, setRecordsSaving] = useState(false);
  const [recordMessage, setRecordMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordForm, setRecordForm] = useState<TrainingRecordForm>(emptyTrainingRecordForm);
  const [photoExtracting, setPhotoExtracting] = useState(false);
  const [photoExtraction, setPhotoExtraction] = useState<Pick<TrainingRecordPhotoDraft, "confidence" | "warnings"> | null>(null);
  const [contactForm, setContactForm] = useState<EmployeeContactForm>(emptyEmployeeContactForm);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactMessage, setContactMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const loadTrainingRecords = useCallback(async () => {
    if (!trackedEmployeeId) {
      setRecords([]);
      return;
    }
    setRecordsLoading(true);
    setRecordMessage(null);
    try {
      const token = await safePredictAccessToken();
      const response = await fetch(`/api/company/tracked-employees/${encodeURIComponent(trackedEmployeeId)}/training-records`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as { records?: TrackedTrainingRecord[]; error?: string } | null;
      if (!response.ok) {
        setRecordMessage({ tone: "error", text: data?.error || "Training records could not be loaded." });
        setRecords([]);
        return;
      }
      setRecords(data?.records ?? []);
    } catch (error) {
      setRecordMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Training records could not be loaded.",
      });
      setRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  }, [trackedEmployeeId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setEditingRecordId(null);
      setRecordForm(emptyTrainingRecordForm);
      setRecordMessage(null);
      setPhotoExtraction(null);
      setContactForm({ email: employee?.email ?? "", phone: employee?.phone ?? "" });
      setContactMessage(null);
      if (trackedEmployeeId) {
        void loadTrainingRecords();
      } else {
        setRecords([]);
      }
    }, 0);
    return () => window.clearTimeout(handle);
  }, [employee?.email, employee?.phone, loadTrainingRecords, trackedEmployeeId]);

  if (!employee) return null;

  const jobsite = jobsiteForId(jobsites, employee.assignedSiteId);
  const profileRows: Array<[string, string]> = [["Employee ID", employee.id], ["Email", employee.email || "Not on file"], ["Phone", employee.phone || "Not on file"], ["Supervisor", employee.supervisor], ["Shift", `${employee.shift} shift`], ["Assigned jobsite", jobsite?.name ?? "Unassigned"], ["Project phase", jobsite?.phase ?? "No active assignment"], ["Last activity", employee.lastActivity]];
  const isTrackedEmployee = Boolean(trackedEmployeeId);

  async function saveContactDetails() {
    if (!trackedEmployeeId) return;
    setContactSaving(true);
    setContactMessage(null);
    try {
      const token = await safePredictAccessToken();
      const response = await fetch(`/api/company/tracked-employees/${encodeURIComponent(trackedEmployeeId)}`, {
        method: "PATCH",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: contactForm.email,
          phone: contactForm.phone,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setContactMessage({ tone: "error", text: data?.error || "Contact details could not be saved." });
        return;
      }
      setContactMessage({ tone: "success", text: "Contact details saved." });
      onTrainingRecordsChanged();
    } catch (error) {
      setContactMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Contact details could not be saved.",
      });
    } finally {
      setContactSaving(false);
    }
  }

  async function saveTrainingRecord() {
    if (!trackedEmployeeId) return;
    if (!recordForm.title.trim()) {
      setRecordMessage({ tone: "error", text: "Training title is required." });
      return;
    }
    setRecordsSaving(true);
    setRecordMessage(null);
    try {
      const token = await safePredictAccessToken();
      const response = await fetch(
        editingRecordId
          ? `/api/company/tracked-employees/${encodeURIComponent(trackedEmployeeId)}/training-records/${encodeURIComponent(editingRecordId)}`
          : `/api/company/tracked-employees/${encodeURIComponent(trackedEmployeeId)}/training-records`,
        {
          method: editingRecordId ? "PATCH" : "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(recordForm),
        }
      );
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setRecordMessage({ tone: "error", text: data?.error || "Training record could not be saved." });
        return;
      }
      setRecordMessage({ tone: "success", text: editingRecordId ? "Training record updated." : "Training record added." });
      setEditingRecordId(null);
      setRecordForm(emptyTrainingRecordForm);
      setPhotoExtraction(null);
      await loadTrainingRecords();
      onTrainingRecordsChanged();
    } catch (error) {
      setRecordMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Training record could not be saved.",
      });
    } finally {
      setRecordsSaving(false);
    }
  }

  async function deleteTrainingRecord(recordId: string) {
    if (!trackedEmployeeId) return;
    setRecordsSaving(true);
    setRecordMessage(null);
    try {
      const token = await safePredictAccessToken();
      const response = await fetch(
        `/api/company/tracked-employees/${encodeURIComponent(trackedEmployeeId)}/training-records/${encodeURIComponent(recordId)}`,
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setRecordMessage({ tone: "error", text: data?.error || "Training record could not be deleted." });
        return;
      }
      if (editingRecordId === recordId) {
        setEditingRecordId(null);
        setRecordForm(emptyTrainingRecordForm);
        setPhotoExtraction(null);
      }
      setRecordMessage({ tone: "success", text: "Training record deleted." });
      await loadTrainingRecords();
      onTrainingRecordsChanged();
    } catch (error) {
      setRecordMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Training record could not be deleted.",
      });
    } finally {
      setRecordsSaving(false);
    }
  }

  async function extractTrainingRecordFromPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!trackedEmployeeId || !file) return;
    if (!file.type.startsWith("image/")) {
      setRecordMessage({ tone: "error", text: "Choose an image of the training card or certificate." });
      return;
    }
    setPhotoExtracting(true);
    setPhotoExtraction(null);
    setRecordMessage(null);
    try {
      const token = await safePredictAccessToken();
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `/api/company/tracked-employees/${encodeURIComponent(trackedEmployeeId)}/training-records/extract-photo`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData,
        }
      );
      const data = (await response.json().catch(() => null)) as {
        draft?: TrainingRecordPhotoDraft;
        error?: string;
      } | null;
      if (!response.ok || !data?.draft) {
        setRecordMessage({ tone: "error", text: data?.error || "AI could not read that training image." });
        return;
      }
      setEditingRecordId(null);
      setRecordForm({
        title: data.draft.title,
        completedOn: data.draft.completedOn,
        expiresOn: data.draft.expiresOn,
        provider: data.draft.provider,
        notes: data.draft.notes,
        source: "ai_photo_extract",
      });
      setPhotoExtraction({
        confidence: data.draft.confidence,
        warnings: data.draft.warnings ?? [],
      });
      setRecordMessage({ tone: "success", text: "Draft filled from photo. Review before adding." });
    } catch (error) {
      setRecordMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "AI could not read that training image.",
      });
    } finally {
      setPhotoExtracting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close employee profile" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-950/35" />
      <aside role="dialog" aria-modal="true" aria-labelledby="employee-profile-title" className="absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0"><p className="text-xs font-black uppercase tracking-wide text-blue-600">Employee profile</p><h2 id="employee-profile-title" className="mt-2 text-2xl font-black leading-tight text-slate-950">{employee.name}</h2><p className="mt-1 text-sm font-semibold text-slate-600">{employee.trade} - {employee.role}</p></div>
            <button type="button" aria-label="Close employee profile" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Readiness</p><p className="mt-1 text-3xl font-black text-slate-950">{employee.readinessScore}</p></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Status</p><span className={cx("mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black", employeeStatusClass(employee.status))}>{statusLabels[employee.status]}</span></div></div>
        </div>
        <div className="flex-1 space-y-5 p-5">
          <section><h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><UserRound className="h-4 w-4 text-blue-600" />Profile details</h3><dl className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">{profileRows.map(([label, value]) => <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:gap-4"><dt className="text-xs font-bold uppercase text-slate-500">{label}</dt><dd className="text-sm font-semibold text-slate-800">{value}</dd></div>)}</dl></section>
          {isTrackedEmployee ? (
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><Mail className="h-4 w-4 text-blue-600" />Contact details</h3>
              <div className="mt-3 grid gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Email</span>
                  <input type="email" value={contactForm.email} onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="worker@example.com" />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Phone</span>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="tel" value={contactForm.phone} onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="(555) 010-1234" />
                  </div>
                </label>
                {contactMessage ? (
                  <p className={cx("rounded-lg px-3 py-2 text-xs font-black", contactMessage.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>{contactMessage.text}</p>
                ) : null}
                <button type="button" onClick={() => void saveContactDetails()} disabled={contactSaving} className="inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                  {contactSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Contact
                </button>
              </div>
            </section>
          ) : null}
          <section><h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><ShieldCheck className="h-4 w-4 text-emerald-600" />Credentials</h3><div className="mt-3 flex flex-wrap gap-2">{employee.credentials.map((credential) => <span key={credential} className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{credential}</span>)}</div></section>
          {isTrackedEmployee ? (
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-black text-slate-950">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Non-user training
                  </h3>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Edit records for this tracked employee without adding app access.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecordId(null);
                    setRecordForm(emptyTrainingRecordForm);
                    setRecordMessage(null);
                    setPhotoExtraction(null);
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 text-xs font-black text-blue-700 transition hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4" />
                  New
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-lg border border-blue-100 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase text-slate-500">Read from photo</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Upload a training card or certificate to fill a draft for review.</p>
                    </div>
                    <label className={cx("inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 text-sm font-black text-blue-700 transition hover:bg-blue-100", photoExtracting ? "pointer-events-none opacity-70" : "")}>
                      {photoExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
                      {photoExtracting ? "Reading" : "Upload Photo"}
                      <input type="file" accept="image/*" className="sr-only" disabled={photoExtracting} onChange={(event) => void extractTrainingRecordFromPhoto(event)} />
                    </label>
                  </div>
                  {photoExtraction ? (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                      <p>AI confidence: {Math.round(photoExtraction.confidence * 100)}%</p>
                      {photoExtraction.warnings.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {photoExtraction.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <label className="grid gap-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Training title</span>
                  <input value={recordForm.title} onChange={(event) => setRecordForm((current) => ({ ...current, title: event.target.value }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="OSHA 10 Construction" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-bold uppercase text-slate-500">Completed</span>
                    <input type="date" value={recordForm.completedOn} onChange={(event) => setRecordForm((current) => ({ ...current, completedOn: event.target.value }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-bold uppercase text-slate-500">Expires</span>
                    <input type="date" value={recordForm.expiresOn} onChange={(event) => setRecordForm((current) => ({ ...current, expiresOn: event.target.value }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                  </label>
                </div>
                <label className="grid gap-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Provider</span>
                  <input value={recordForm.provider} onChange={(event) => setRecordForm((current) => ({ ...current, provider: event.target.value }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Training provider" />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Notes</span>
                  <textarea value={recordForm.notes} onChange={(event) => setRecordForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Card number, evaluator, restrictions, or document location" />
                </label>
                {recordMessage ? (
                  <p className={cx("rounded-lg px-3 py-2 text-xs font-black", recordMessage.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>{recordMessage.text}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void saveTrainingRecord()} disabled={recordsSaving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                    {recordsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {editingRecordId ? "Save Record" : "Add Record"}
                  </button>
                  {editingRecordId ? (
                    <button type="button" onClick={() => { setEditingRecordId(null); setRecordForm(emptyTrainingRecordForm); setPhotoExtraction(null); }} className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <p className="text-xs font-bold uppercase text-slate-500">Records on file</p>
                {recordsLoading ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-500">Loading training records...</p> : null}
                {!recordsLoading && records.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 bg-white p-3 text-sm font-semibold text-slate-500">No training records yet.</p> : null}
                {records.map((record) => (
                  <article key={record.id} className={cx("rounded-lg border bg-white p-3", editingRecordId === record.id ? "border-blue-300 ring-4 ring-blue-50" : "border-slate-200")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-950">{record.title}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Completed {trainingRecordDateLabel(record.completed_on)} / Expires {trainingRecordDateLabel(record.expires_on)}
                        </p>
                        {record.provider ? <p className="mt-1 text-xs font-semibold text-slate-600">{record.provider}</p> : null}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button type="button" aria-label={`Edit ${record.title}`} onClick={() => { setEditingRecordId(record.id); setRecordForm(formFromTrainingRecord(record)); setRecordMessage(null); setPhotoExtraction(null); }} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-blue-700 transition hover:bg-blue-50">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label={`Delete ${record.title}`} onClick={() => void deleteTrainingRecord(record.id)} disabled={recordsSaving} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          {jobsite ? <section className="rounded-lg border border-blue-100 bg-blue-50 p-4"><h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><MapPin className="h-4 w-4 text-blue-600" />Assignment</h3><p className="mt-2 text-sm font-black text-slate-900">{jobsite.name}</p><p className="mt-1 text-sm text-slate-600">{jobsite.address}, {jobsite.cityState}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs font-bold uppercase text-slate-500">Site risk</p><p className="font-black text-slate-900">{jobsite.riskScore}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Open actions</p><p className="font-black text-slate-900">{jobsite.openActions}</p></div></div></section> : null}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-slate-200 p-5"><Link href="/safe-predict/training" className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white">Training matrix <ArrowRight className="h-4 w-4" /></Link><Link href="/safe-predict/team-access" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700">Team access <ArrowRight className="h-4 w-4" /></Link></div>
      </aside>
    </div>
  );
}

function MobileRecordCard({ title, rows, actionLabel, active, onClick }: { title: string; rows: Array<[string, string]>; actionLabel?: string; active?: boolean; onClick?: () => void }) {
  if (onClick) {
    return (
      <button type="button" aria-label={actionLabel ?? title} onClick={onClick} className={cx("block w-full rounded-lg border bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/60 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100", active ? "border-blue-300 bg-blue-50" : "border-slate-200")}>
        <span className="flex items-start justify-between gap-3"><span className="text-base font-black leading-snug text-slate-950">{title}</span><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /></span>
        <span className="mt-3 grid gap-2 text-sm">{rows.map(([label, value]) => <span key={`${title}-${label}`} className="flex justify-between gap-3 border-t border-slate-200 pt-2"><span className="font-bold text-slate-500">{label}</span><span className="text-right font-semibold text-slate-800">{value}</span></span>)}</span>
      </button>
    );
  }
  return <article className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-base font-black leading-snug text-slate-950">{title}</p><dl className="mt-3 grid gap-2 text-sm">{rows.map(([label, value]) => <div key={`${title}-${label}`} className="flex justify-between gap-3 border-t border-slate-200 pt-2"><dt className="font-bold text-slate-500">{label}</dt><dd className="text-right font-semibold text-slate-800">{value}</dd></div>)}</dl></article>;
}
