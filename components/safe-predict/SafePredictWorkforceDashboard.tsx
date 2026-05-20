"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Download,
  FileText,
  Flame,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  Card,
  ExportButton,
  PageHeader,
  ReadinessDonut,
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
    items.push({
      id: `permit-${permit.id}`,
      kind: "permit",
      title: `Renew or review ${permit.type}`,
      detail: `${permit.status} permit exposure at ${permit.siteName}.`,
      actionTitle: `Renew or review ${permit.type}`,
      linkedRisk: `${permit.type} permit readiness`,
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

  function filterByStatus(status: "all" | SafePredictDemoEmployeeStatus) {
    setStatusFilter(status);
    setActiveTab(status === "all" ? "overview" : "workforce");
  }

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
          {activeTab === "training" ? <TrainingMatrixTab groups={trainingGroups} /> : null}
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

      <EmployeeProfileDrawer employee={selectedEmployee} jobsites={jobsites} onClose={() => setSelectedEmployeeId(null)} />
      <p className="mt-5 text-center text-xs font-semibold text-slate-500">Data is refreshed every 15 minutes</p>
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

function RosterCard({ activeFilterText, datasetCompanyName, employees, isLiveEmpty, jobsites, mode, selectedEmployeeId, visibleEmployees, onOpenEmployee }: { activeFilterText: string; datasetCompanyName: string; employees: SafePredictDemoEmployee[]; isLiveEmpty: boolean; jobsites: SafePredictJobsiteRecord[]; mode: "demo" | "live"; selectedEmployeeId: string | null; visibleEmployees: SafePredictDemoEmployee[]; onOpenEmployee: (id: string) => void }) {
  return (
    <Card id="employee-roster" className="scroll-mt-24 overflow-hidden">
      <div className="border-b border-slate-200 p-5">
        <SectionTitle title="Workforce Roster" action={<Link href="/safe-predict/team-access" className="inline-flex items-center gap-2 text-sm font-black text-blue-600">Add or edit access <ArrowRight className="h-4 w-4" /></Link>} />
        <p className="mt-1 text-sm leading-6 text-slate-600">{mode === "live" ? `${datasetCompanyName} roster-only employees and invited users for workforce, training, assignment, and risk conversations.` : `${datasetCompanyName} demo people data for workforce, training, assignment, and risk conversations.`}</p>
        <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-500">Showing {visibleEmployees.length} of {employees.length} {mode === "live" ? "workforce records" : "shell employees"} - {activeFilterText}</p>
      </div>
      <div className="space-y-3 p-4 md:hidden">
        {visibleEmployees.map((employee) => {
          const jobsite = jobsiteForId(jobsites, employee.assignedSiteId);
          return (
            <MobileRecordCard key={`${employee.id}-mobile`} title={employee.name} active={selectedEmployeeId === employee.id} actionLabel={`Open ${employee.name} profile`} onClick={() => onOpenEmployee(employee.id)} rows={[["Trade", employee.trade], ["Role", employee.role], ["Jobsite", jobsite?.name ?? "Unassigned"], ["Readiness", `${employee.readinessScore}`], ["Status", statusLabels[employee.status]]]} />
          );
        })}
        {visibleEmployees.length === 0 ? <EmptyPanel>{isLiveEmpty ? "No workforce records yet. Add users or upload non-user employees to populate this roster." : "No employees match those roster filters."}</EmptyPanel> : null}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-black text-slate-600">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Trade / Role</th>
              <th className="px-4 py-3">Assigned Jobsite</th>
              <th className="px-4 py-3 text-center">Readiness</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleEmployees.map((employee) => {
              const jobsite = jobsiteForId(jobsites, employee.assignedSiteId);
              return (
                <tr key={employee.id} role="button" tabIndex={0} aria-label={`Open ${employee.name} profile`} onClick={() => onOpenEmployee(employee.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenEmployee(employee.id); } }} className={cx("group cursor-pointer border-b border-slate-100 transition hover:bg-blue-50/50 focus:bg-blue-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-100", selectedEmployeeId === employee.id ? "bg-blue-50" : undefined)}>
                  <td className="px-4 py-3">
                    <p className="inline-flex items-center gap-2 font-black text-slate-900">{employee.name}<ArrowRight className="h-3.5 w-3.5 text-blue-500 opacity-0 transition group-hover:opacity-100" /></p>
                    <p className="mt-1 text-xs text-slate-500">{employee.id} - {employee.shift} shift</p>
                  </td>
                  <td className="px-4 py-3"><p className="font-semibold text-slate-800">{employee.trade}</p><p className="mt-1 text-xs text-slate-500">{employee.role}</p></td>
                  <td className="px-4 py-3 text-slate-700">{jobsite?.name ?? "Unassigned"}</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex min-w-12 justify-center rounded-full bg-slate-100 px-3 py-1 font-black text-slate-900">{employee.readinessScore}</span></td>
                  <td className="px-4 py-3"><span className={cx("rounded-full px-3 py-1 text-xs font-black", employeeStatusClass(employee.status))}>{statusLabels[employee.status]}</span></td>
                </tr>
              );
            })}
            {visibleEmployees.length === 0 ? <tr><td colSpan={5} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">{isLiveEmpty ? "No workforce records yet. Add users or upload non-user employees to populate this roster." : "No employees match those roster filters."}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function JobsiteSnapshot({ jobsites, siteFilter, onFilter }: { jobsites: SafePredictJobsiteRecord[]; siteFilter: string; onFilter: (siteId: string) => void }) {
  return (
    <Card className="p-5">
      <SectionTitle title="Jobsite Assignment Snapshot" />
      <div className="mt-4 space-y-3">
        {jobsites.map((jobsite) => (
          <button key={jobsite.id} type="button" onClick={() => onFilter(jobsite.id)} className={cx("flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100", siteFilter === jobsite.id ? "border-blue-300 bg-blue-50" : "border-slate-100 bg-slate-50")}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600"><MapPin className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-slate-900">{jobsite.name}</span><span className="mt-1 block text-xs text-slate-500">{jobsite.workforceCount} workers - {jobsite.siteLead}</span></span>
            <span className="text-sm font-black text-slate-900">{jobsite.riskScore}</span>
          </button>
        ))}
        {jobsites.length === 0 ? <EmptyPanel>No jobsites yet. Add or import jobsites before assigning workforce records.</EmptyPanel> : null}
      </div>
    </Card>
  );
}

function TrainingMatrix({ trades }: { trades: SafePredictTradeReadiness[] }) {
  return (
    <Card id="training-matrix" className="scroll-mt-24 overflow-hidden">
      <div className="border-b border-slate-200 p-5"><SectionTitle title="Training & Compliance Matrix" /></div>
      <div className="space-y-3 p-4 md:hidden">
        {trades.map((row) => <MobileRecordCard key={`${row.trade}-mobile`} title={row.trade} rows={[["Workers", `${row.workers}`], ["Fall Protection", statusLabels[row.fallProtection]], ["Confined Space", statusLabels[row.confinedSpace]], ["LOTO", statusLabels[row.loto]], ["HazCom", statusLabels[row.hazcom]], ["First Aid", statusLabels[row.firstAid]], ["Overall", row.overallStatus]]} />)}
        {trades.length === 0 ? <EmptyPanel>No training matrix rows yet.</EmptyPanel> : null}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead><tr className="border-b border-slate-200 bg-slate-50 text-xs font-black text-slate-600"><th className="px-5 py-3">Team / Trade</th><th className="px-5 py-3 text-center">Workers</th><th className="px-5 py-3 text-center">Fall Protection</th><th className="px-5 py-3 text-center">Confined Space</th><th className="px-5 py-3 text-center">LOTO</th><th className="px-5 py-3 text-center">HazCom</th><th className="px-5 py-3 text-center">First Aid</th><th className="px-5 py-3 text-center">Overall Status</th></tr></thead>
          <tbody>
            {trades.map((row) => (
              <tr key={row.trade} className="border-b border-slate-100">
                <td className="px-5 py-3 font-black text-slate-900"><Users className="mr-2 inline h-4 w-4 text-blue-600" />{row.trade}</td>
                <td className="px-5 py-3 text-center font-semibold text-slate-700">{row.workers}</td>
                <td className="px-5 py-3 text-center"><StatusIcon status={row.fallProtection} /></td>
                <td className="px-5 py-3 text-center"><StatusIcon status={row.confinedSpace} /></td>
                <td className="px-5 py-3 text-center"><StatusIcon status={row.loto} /></td>
                <td className="px-5 py-3 text-center"><StatusIcon status={row.hazcom} /></td>
                <td className="px-5 py-3 text-center"><StatusIcon status={row.firstAid} /></td>
                <td className="px-5 py-3 text-center"><span className={cx("rounded-full px-3 py-1 text-xs font-black", row.overallStatus === "Overdue" ? "bg-red-50 text-red-600" : row.overallStatus === "Expiring" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>{row.overallStatus}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {trades.length === 0 ? <div className="px-5 py-8 text-center text-sm font-semibold text-slate-500">No training matrix rows yet. Upload non-user employees or invite users to build readiness by trade.</div> : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-5 text-sm">
        <div className="flex flex-wrap gap-5 text-slate-600"><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> Compliant</span><span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-amber-500" /> Expiring (&lt;= 30 days)</span><span className="inline-flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-500" /> Overdue (&gt; 30 days)</span></div>
        <Link href="/safe-predict/training" className="inline-flex items-center gap-2 font-black text-blue-600">View full training report <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </Card>
  );
}

function PermitRegister({ permitRows, permits }: { permitRows: SafePredictPermitSummary[]; permits: { active: number; expiringSoon: number; expired: number } }) {
  return (
    <Card id="permit-register" className="scroll-mt-24 overflow-hidden">
      <div className="border-b border-slate-200 p-5"><SectionTitle title="Required Permits" action={<Link href="/safe-predict/permits" className="inline-flex items-center gap-2 text-sm font-black text-blue-600">View all permits <ArrowRight className="h-4 w-4" /></Link>} /></div>
      <div className="space-y-3 p-4 md:hidden">
        {permitRows.map((permit) => <MobileRecordCard key={`${permit.type}-mobile`} title={permit.type} rows={[["Active", `${permit.active}`], ["Expiring Soon", `${permit.expiringSoon}`], ["Expired", `${permit.expired}`]]} />)}
        <MobileRecordCard title="Total" rows={[["Active", `${permits.active}`], ["Expiring Soon", `${permits.expiringSoon}`], ["Expired", `${permits.expired}`]]} />
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead><tr className="border-b border-slate-200 bg-slate-50 text-xs font-black text-slate-600"><th className="px-5 py-3">Permit Type</th><th className="px-5 py-3 text-center">Active</th><th className="px-5 py-3 text-center">Expiring Soon</th><th className="px-5 py-3 text-center">Expired</th></tr></thead>
          <tbody>
            {permitRows.map((permit) => <tr key={permit.type} className="border-b border-slate-100"><td className="px-5 py-3 font-black text-slate-900"><Flame className="mr-2 inline h-4 w-4 text-orange-500" />{permit.type}</td><td className="px-5 py-3 text-center font-black text-emerald-700">{permit.active}</td><td className="px-5 py-3 text-center font-black text-amber-600">{permit.expiringSoon}</td><td className="px-5 py-3 text-center font-black text-red-600">{permit.expired}</td></tr>)}
            <tr className="bg-slate-50 font-black"><td className="px-5 py-3">Total</td><td className="px-5 py-3 text-center text-emerald-700">{permits.active}</td><td className="px-5 py-3 text-center text-amber-600">{permits.expiringSoon}</td><td className="px-5 py-3 text-center text-red-600">{permits.expired}</td></tr>
          </tbody>
        </table>
        {permitRows.length === 0 ? <div className="px-5 py-8 text-center text-sm font-semibold text-slate-500">No permit records yet.</div> : null}
      </div>
    </Card>
  );
}

function ReadinessStatusCard({ hasEmployees, workforce }: { hasEmployees: boolean; workforce: ReturnType<typeof workforceTotalsFromEmployees> }) {
  return (
    <Card className="p-5">
      <SectionTitle title="Worker Readiness by Status" />
      <div className="mt-3 grid gap-4 md:grid-cols-[210px_1fr]">
        <div className="relative">
          {hasEmployees ? <ReadinessDonut /> : <div className="grid h-[210px] place-items-center rounded-full border border-dashed border-slate-200 bg-slate-50 text-sm font-black text-slate-500">No roster</div>}
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><span><Users className="mx-auto h-7 w-7 text-slate-700" /><span className="mt-1 block text-sm font-black text-slate-950">{workforce.workers}</span><span className="text-xs text-slate-500">Total Workers</span></span></div>
        </div>
        <div className="space-y-4 self-center text-sm">
          <p className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-600" />Compliant</span><strong>{workforce.compliant} ({workforce.compliantPercent}%)</strong></p>
          <p className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500" />Expiring Soon</span><strong>{workforce.expiringSoon} ({workforce.expiringSoonPercent}%)</strong></p>
          <p className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500" />Overdue</span><strong>{workforce.overdue} ({workforce.overduePercent}%)</strong></p>
        </div>
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

function EmployeeProfileDrawer({ employee, jobsites, onClose }: { employee: SafePredictDemoEmployee | null; jobsites: SafePredictJobsiteRecord[]; onClose: () => void }) {
  if (!employee) return null;
  const jobsite = jobsiteForId(jobsites, employee.assignedSiteId);
  const profileRows: Array<[string, string]> = [["Employee ID", employee.id], ["Supervisor", employee.supervisor], ["Shift", `${employee.shift} shift`], ["Assigned jobsite", jobsite?.name ?? "Unassigned"], ["Project phase", jobsite?.phase ?? "No active assignment"], ["Last activity", employee.lastActivity]];
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
          <section><h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><ShieldCheck className="h-4 w-4 text-emerald-600" />Credentials</h3><div className="mt-3 flex flex-wrap gap-2">{employee.credentials.map((credential) => <span key={credential} className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{credential}</span>)}</div></section>
          {jobsite ? <section className="rounded-lg border border-blue-100 bg-blue-50 p-4"><h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><MapPin className="h-4 w-4 text-blue-600" />Assignment</h3><p className="mt-2 text-sm font-black text-slate-900">{jobsite.name}</p><p className="mt-1 text-sm text-slate-600">{jobsite.address}, {jobsite.cityState}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs font-bold uppercase text-slate-500">Site risk</p><p className="font-black text-slate-900">{jobsite.riskScore}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Open actions</p><p className="font-black text-slate-900">{jobsite.openActions}</p></div></div></section> : null}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-slate-200 p-5"><Link href="/safe-predict/training" className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white">Training records <ArrowRight className="h-4 w-4" /></Link><Link href="/safe-predict/team-access" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700">Team access <ArrowRight className="h-4 w-4" /></Link></div>
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
