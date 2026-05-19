"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Download, FilterX, MapPin, Plus, Search, ShieldCheck, X } from "lucide-react";
import {
  Card,
  CorrectiveActionCard,
  EventTimeline,
  ExportButton,
  InsightWorkflow,
  MetricCard,
  MiniSparkline,
  PageHeader,
  RiskHeatMap,
  SectionTitle,
  SelectShell,
  cx,
} from "@/components/safe-predict/SafePredictPrimitives";
import {
  filterAlertsByRisk,
  summarizeActions,
  type SafePredictActionStatus,
  type SafePredictCorrectiveAction,
} from "@/lib/safePredictMockData";
import { SafePredictOriginalSystemLinks } from "@/components/safe-predict/SafePredictOriginalSystemLinks";
import { useSafePredictData } from "@/components/safe-predict/SafePredictDataProvider";
import type { SafePredictJobsiteRecord } from "@/lib/safePredictData";

const statuses: SafePredictActionStatus[] = ["New", "In Progress", "Awaiting Verification", "Closed"];
const localActionsStorageKey = "safe-predict-local-actions-v1";
const hashAliases: Record<string, string> = {
  "fall-compliance": "machine-guarding",
  "housekeeping-control": "housekeeping",
  "electrical-loto": "ppe-compliance",
  riverside: "ppe-compliance",
  "plant-1": "machine-guarding",
  "warehouse-a": "forklift-proximity",
  "plant-2": "slips-trips",
  "warehouse-b": "housekeeping",
};

const jobsiteAlertAliases: Record<string, string> = {
  riverside: "ppe-compliance",
  "plant-1": "machine-guarding",
  "warehouse-a": "forklift-proximity",
  "plant-2": "slips-trips",
  "warehouse-b": "housekeeping",
};

function riskSiteKey(site: string) {
  return site.trim().toLowerCase().replace(/\s+/g, "-");
}

function alertSiteMatches(alertSite: string, jobsiteId: string, jobsites: SafePredictJobsiteRecord[]) {
  if (jobsiteId === "all") return true;
  const jobsite = jobsites.find((site) => site.id === jobsiteId);
  if (!jobsite) return false;
  const alertKey = riskSiteKey(alertSite);
  return alertKey === jobsite.id || alertKey === riskSiteKey(jobsite.name) || alertKey === riskSiteKey(jobsite.name.replace(/Modernization|Expansion|Concrete Package|Punch List|Commercial Tower/g, "").trim());
}

function actionSiteMatches(action: SafePredictCorrectiveAction, jobsiteId: string) {
  if (jobsiteId === "all") return true;
  return action.linkedRiskId === jobsiteAlertAliases[jobsiteId];
}

function alertWithinTime(alertTimeAgo: string, timeFilter: string) {
  if (timeFilter === "all-time") return true;
  const lower = alertTimeAgo.toLowerCase();
  if (timeFilter === "last-hour") return lower.includes("m ago") || lower === "1h ago";
  if (timeFilter === "today") return lower.includes("m ago") || lower.includes("h ago");
  return true;
}

function isActionStatus(status: string): status is SafePredictActionStatus {
  return statuses.includes(status as SafePredictActionStatus);
}

function normalizeStoredActions(value: unknown): SafePredictCorrectiveAction[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value.filter((action): action is SafePredictCorrectiveAction => {
    if (!action || typeof action !== "object") return false;
    const candidate = action as Partial<SafePredictCorrectiveAction>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.title === "string" &&
      typeof candidate.linkedRiskId === "string" &&
      typeof candidate.linkedRisk === "string" &&
      typeof candidate.assignee === "string" &&
      typeof candidate.dueDate === "string" &&
      typeof candidate.priority === "string" &&
      typeof candidate.progress === "number" &&
      typeof candidate.status === "string" &&
      isActionStatus(candidate.status)
    );
  });
  return normalized.length > 0 ? normalized : null;
}

function loadStoredCorrectiveActions() {
  try {
    const storedActions = window.localStorage.getItem(localActionsStorageKey);
    if (!storedActions) return null;
    return normalizeStoredActions(JSON.parse(storedActions));
  } catch (error) {
    console.error("Failed to restore SafePredict local actions:", error);
    return null;
  }
}

function persistCorrectiveActions(actions: SafePredictCorrectiveAction[]) {
  window.localStorage.setItem(localActionsStorageKey, JSON.stringify(actions));
}

export default function SafePredictRiskMitigationPage() {
  const { dataset, updateActionStatus, addDraftAction } = useSafePredictData();
  const providerActions = dataset.actions;
  const providerAlerts = dataset.alerts;
  const [timeFilter, setTimeFilter] = useState("all-time");
  const [siteFilter, setSiteFilter] = useState("all");
  const [riskLevel, setRiskLevel] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [mapSite, setMapSite] = useState("plant-1");
  const [selectedRiskId, setSelectedRiskId] = useState(providerAlerts[0]?.id ?? "");
  const [newActionId, setNewActionId] = useState("");
  const [actions, setActions] = useState<SafePredictCorrectiveAction[]>(providerActions);
  const [actionsReady, setActionsReady] = useState(false);

  useEffect(() => {
    function syncSelectedRiskFromHash() {
      const rawHash = window.location.hash.replace("#", "");
      const nextRiskId = hashAliases[rawHash] ?? rawHash;
      if (rawHash in jobsiteAlertAliases) {
        setSiteFilter(rawHash);
        setMapSite(rawHash);
      }
      if (providerAlerts.some((alert) => alert.id === nextRiskId)) {
        setSelectedRiskId(nextRiskId);
      }
    }

    syncSelectedRiskFromHash();
    window.addEventListener("hashchange", syncSelectedRiskFromHash);
    return () => window.removeEventListener("hashchange", syncSelectedRiskFromHash);
  }, [providerAlerts]);

  useEffect(() => {
    setActions(providerActions);
  }, [providerActions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedActions = loadStoredCorrectiveActions();
      if (storedActions) {
        setActions(storedActions);
      }
      setActionsReady(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!actionsReady) return;
    persistCorrectiveActions(actions);
  }, [actions, actionsReady]);

  const visibleAlerts = useMemo(() => {
    const byRisk = filterAlertsByRisk(providerAlerts, riskLevel)
      .filter((alert) => alertSiteMatches(alert.site, siteFilter, dataset.jobsites) || alert.id === jobsiteAlertAliases[siteFilter])
      .filter((alert) => alertWithinTime(alert.timeAgo, timeFilter))
      .filter((alert) => typeFilter === "all" || alert.source === typeFilter);
    const query = searchTerm.trim().toLowerCase();
    if (!query) return byRisk;
    return byRisk.filter((alert) =>
      [alert.title, alert.detail, alert.source, alert.site, alert.area].some((value) => value.toLowerCase().includes(query))
    );
  }, [dataset.jobsites, providerAlerts, riskLevel, searchTerm, siteFilter, timeFilter, typeFilter]);
  const visibleActions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return actions.filter((action) =>
      actionSiteMatches(action, siteFilter) &&
      (statusFilter === "all" || action.status === statusFilter) &&
      [action.title, action.linkedRisk, action.assignee, action.status].some((value) => value.toLowerCase().includes(query))
    );
  }, [actions, searchTerm, siteFilter, statusFilter]);
  const selectedRisk = visibleAlerts.find((alert) => alert.id === selectedRiskId) ?? visibleAlerts[0] ?? providerAlerts.find((alert) => alert.id === selectedRiskId);
  const relatedActions = selectedRisk ? actions.filter((action) => action.linkedRiskId === selectedRisk.id) : [];
  const summary = summarizeActions(visibleActions);
  const activeAlertCount = visibleAlerts.length + summary.overdue;

  function changeStatus(id: string, status: SafePredictActionStatus) {
    if (statusFilter !== "all" && statusFilter !== status) {
      setStatusFilter("all");
    }
    updateActionStatus(id, status);
    setActions((current) => {
      const nextActions = current.map((action) =>
        action.id === id
          ? {
              ...action,
              status,
              progress: status === "Closed" ? 100 : status === "Awaiting Verification" ? 85 : status === "In Progress" ? Math.max(action.progress, 40) : action.progress,
            }
          : action
      );
      persistCorrectiveActions(nextActions);
      return nextActions;
    });
  }

  function clearFilters() {
    setTimeFilter("all-time");
    setSiteFilter("all");
    setRiskLevel("all");
    setStatusFilter("all");
    setTypeFilter("all");
    setSearchTerm("");
    setAlertsOpen(false);
  }

  function addCorrectiveAction(status: SafePredictActionStatus = "New") {
    const riskForAction = selectedRisk ?? visibleAlerts[0] ?? providerAlerts[0];
    if (!riskForAction) return;
    const nextAction: SafePredictCorrectiveAction = {
      id: `local-${Date.now()}`,
      title: `Review ${riskForAction.title.toLowerCase()} controls`,
      linkedRiskId: riskForAction.id,
      linkedRisk: riskForAction.title,
      assignee: "Alex Morgan",
      dueDate: "May 30",
      status,
      priority: riskForAction.riskLevel === "critical" || riskForAction.riskLevel === "high" ? "high" : "medium",
      progress: status === "Closed" ? 100 : status === "Awaiting Verification" ? 85 : status === "In Progress" ? 40 : 0,
      aiRecommended: true,
    };
    const sharedAction = addDraftAction({
      title: nextAction.title,
      linkedRiskId: nextAction.linkedRiskId,
      linkedRisk: nextAction.linkedRisk,
      siteId: "siteId" in riskForAction && typeof riskForAction.siteId === "string" ? riskForAction.siteId : "riverside",
      priority: nextAction.priority,
      createdFrom: riskForAction.source === "Observation" ? "Observation" : riskForAction.source === "Inspection" ? "Inspection" : "Predictive Alert",
    });
    if (status !== "New") updateActionStatus(sharedAction.id, status);
    setNewActionId(nextAction.id);
    setSelectedRiskId(riskForAction.id);
    setSearchTerm("");
    setStatusFilter(status);
    setSiteFilter("all");
    setRiskLevel("all");
    setTypeFilter("all");
    setTimeFilter("all-time");
    setAlertsOpen(false);
    setActions((current) => {
      const nextActions = [nextAction, ...current];
      persistCorrectiveActions(nextActions);
      return nextActions;
    });
    window.setTimeout(() => {
      document.getElementById("corrective-action-tracker")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 pb-8 sm:px-7">
      <PageHeader
        title="Risk Mitigation Workspace"
        subtitle="Turn AI insights into action and reduce risk across your operations."
        actions={
          <div className="relative w-full min-w-0 sm:w-[420px]">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 shadow-sm"
              placeholder="Search incidents, hazards, tasks..."
            />
          </div>
        }
      />

      {alertsOpen ? (
        <Card className="mb-5 border-blue-200 p-4 shadow-[0_16px_32px_rgba(37,99,235,0.12)]">
          <div className="flex items-start justify-between gap-3">
            <div className="relative w-full min-w-0 sm:min-w-[320px]">
              <p className="text-xs font-black uppercase tracking-wide text-blue-600">Filtered alerts</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">{visibleAlerts.length} risk alerts and {summary.overdue} overdue actions need attention.</p>
            </div>
            <button type="button" onClick={() => setAlertsOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500" aria-label="Close alerts panel">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {visibleAlerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => {
                  setSelectedRiskId(alert.id);
                  setAlertsOpen(false);
                  document.getElementById("prioritized-risk-queue")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-left hover:bg-white"
              >
                <p className="text-sm font-black text-slate-950">{alert.title}</p>
                <p className="mt-1 text-xs font-semibold text-blue-600">{alert.source} - {alert.timeAgo}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{alert.site} / {alert.area}</p>
              </button>
            ))}
            {visibleAlerts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">No alerts match these filters.</p>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <SelectShell
          label="Time"
          value={timeFilter}
          onChange={setTimeFilter}
          options={[
            { label: "All Time", value: "all-time" },
            { label: "Last Hour", value: "last-hour" },
            { label: "Today", value: "today" },
          ]}
          className="w-[160px]"
        />
        <SelectShell
          label="Sites"
          value={siteFilter}
          onChange={(value) => {
            setSiteFilter(value);
            if (value !== "all") {
              setMapSite(value);
              setSelectedRiskId(jobsiteAlertAliases[value] ?? selectedRiskId);
            }
          }}
          options={[
            { label: "All Sites", value: "all" },
            ...dataset.jobsites.map((jobsite) => ({ label: jobsite.name, value: jobsite.id })),
          ]}
          className="w-[160px]"
        />
        <SelectShell
          label="Risk Level"
          value={riskLevel}
          onChange={setRiskLevel}
          options={[
            { label: "All", value: "all" },
            { label: "Critical", value: "critical" },
            { label: "High", value: "high" },
            { label: "Medium", value: "medium" },
            { label: "Low", value: "low" },
          ]}
          className="w-[160px]"
        />
        <SelectShell
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: "All", value: "all" },
            ...statuses.map((status) => ({ label: status, value: status })),
          ]}
          className="w-[160px]"
        />
        <SelectShell
          label="Type"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { label: "All", value: "all" },
            { label: "Predictive Alert", value: "Predictive Alert" },
            { label: "Observation", value: "Observation" },
            { label: "Inspection", value: "Inspection" },
          ]}
          className="w-[160px]"
        />
        <button
          type="button"
          onClick={() => setAlertsOpen((current) => !current)}
          className="ml-auto inline-flex h-11 items-center gap-2 rounded-lg border border-red-100 bg-white px-4 text-sm font-black text-red-600 shadow-sm"
          aria-label={alertsOpen ? "Hide filtered alerts" : "Show filtered alerts"}
          aria-expanded={alertsOpen}
        >
          <AlertTriangle className="h-4 w-4" />
          Filtered Alerts
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">{activeAlertCount}</span>
        </button>
        <button
          onClick={clearFilters}
          className="inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-black text-blue-600"
        >
          <FilterX className="h-4 w-4" />
          Clear Filters
        </button>
        <ExportButton
          fileName="safe-predict-corrective-actions.json"
          label="Export corrective action report"
          payload={{
            company: dataset.company,
            jobsites: dataset.jobsites,
            employees: dataset.employees,
            selectedRisk,
            filters: { time: timeFilter, site: siteFilter, riskLevel, status: statusFilter, type: typeFilter, searchTerm },
            alerts: visibleAlerts,
            actions: visibleActions,
            events: dataset.events,
            summary,
          }}
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm"
        >
          <Download className="h-4 w-4" />
          Export Report
        </ExportButton>
        <button
          type="button"
          onClick={() => addCorrectiveAction("New")}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)]"
        >
          <Plus className="h-4 w-4" />
          New Corrective Action
        </button>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <MetricCard title="Total Open Actions" value={summary.open} detail="Filtered action board" tone="blue" icon={<ShieldCheck className="h-7 w-7" />} href="#corrective-action-tracker" sourceLabel="View board" />
        <MetricCard title="Overdue Actions" value={summary.overdue} detail="Filtered overdue actions" tone="red" icon={<CalendarDays className="h-7 w-7" />} href="#corrective-action-tracker" sourceLabel="View overdue" />
        <MetricCard title="Avg. Time to Close" value={summary.averageDaysToClose} suffix="days" detail="Down 18% vs last 7 days" tone="purple" icon={<CalendarDays className="h-7 w-7" />} />
        <MetricCard title="Actions Closed (30 Days)" value={summary.closed * 14} detail="Up 24% vs last 30 days" tone="green" icon={<ShieldCheck className="h-7 w-7" />} />
        <MetricCard title="Risk Score (All Sites)" value={summary.riskScore} suffix="/100" detail="Down 9 pts vs last 7 days" tone="amber" icon={<ShieldCheck className="h-7 w-7" />} sparkline={<MiniSparkline data={[58, 62, 56, 74, 71, 68]} color="#f97316" />} />
      </div>

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Demo company in this workspace</p>
            <p className="mt-1 text-lg font-black text-slate-950">{dataset.company.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dataset.jobsites.map((jobsite) => (
              <button
                key={jobsite.id}
                type="button"
                onClick={() => {
                  setSiteFilter(jobsite.id);
                  setMapSite(jobsite.id);
                  setSelectedRiskId(jobsiteAlertAliases[jobsite.id] ?? selectedRiskId);
                  window.location.hash = jobsite.id;
                }}
                className={cx(
                  "inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-black hover:bg-white sm:flex-none",
                  siteFilter === jobsite.id ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-700"
                )}
              >
                <MapPin className="h-3.5 w-3.5 text-blue-600" />
                {jobsite.name}
                <span className="text-slate-400">{jobsite.riskScore}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="mb-5">
        <SafePredictOriginalSystemLinks workspace="risk-mitigation" compact />
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 2xl:grid-cols-[340px_minmax(0,1fr)_390px]">
        <Card id="prioritized-risk-queue" className="scroll-mt-24 overflow-hidden">
          <div className="p-4">
            <SectionTitle title="Prioritized Risk Queue" />
          </div>
          <div className="divide-y divide-slate-100">
            {visibleAlerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => setSelectedRiskId(alert.id)}
                className={cx(
                  "grid w-full grid-cols-[72px_1fr_18px] gap-3 border-l-4 p-4 text-left transition hover:bg-slate-50",
                  selectedRisk?.id === alert.id ? "bg-blue-50/60" : "bg-white",
                  alert.riskLevel === "critical" ? "border-l-red-500" : alert.riskLevel === "high" ? "border-l-orange-500" : alert.riskLevel === "medium" ? "border-l-amber-500" : "border-l-emerald-500"
                )}
              >
                <span className={cx("grid h-16 w-16 place-items-center rounded-full border-4 text-center font-black", alert.riskLevel === "critical" ? "border-red-500 text-red-600" : alert.riskLevel === "high" ? "border-orange-500 text-orange-600" : alert.riskLevel === "medium" ? "border-amber-400 text-amber-600" : "border-emerald-500 text-emerald-600")}>
                  <span>
                    <span className="block text-xl">{alert.score}</span>
                    <span className="block text-[10px]">{alert.riskLevel}</span>
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block font-black text-slate-950">{alert.title}</span>
                  <span className="mt-1 block text-xs font-bold text-blue-600">{alert.source}</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-600">{alert.detail}</span>
                  <span className="mt-2 block text-xs text-slate-500">{alert.site} - {alert.area}</span>
                </span>
                <span className="pt-7 text-slate-400">&gt;</span>
              </button>
            ))}
            {visibleAlerts.length === 0 ? (
              <div className="p-6 text-center text-sm font-semibold text-slate-500">No risks match those filters.</div>
            ) : null}
          </div>
          <div className="border-t border-slate-100 p-4 text-center">
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 text-sm font-black text-blue-600">View Full Queue -&gt;</button>
          </div>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <SectionTitle title="From AI Insight to Mitigation" />
            <div className="mt-5">
              <InsightWorkflow />
            </div>
          </Card>

          <Card id="corrective-action-tracker" className="scroll-mt-24 p-4">
            <SectionTitle title="Corrective Action Tracker" />
            {actionsReady ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
                {statuses.map((status) => {
                  const rows = visibleActions.filter((action) => action.status === status);
                  return (
                    <div key={status} className="rounded-lg border border-slate-200 bg-slate-50/70">
                      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                        <p className="text-sm font-black text-slate-900">{status}</p>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-black text-slate-600">{rows.length}</span>
                      </div>
                      <div className="space-y-3 p-2">
                        {rows.map((action) => (
                          <CorrectiveActionCard
                            key={action.id}
                            action={action}
                            highlighted={action.id === newActionId || relatedActions.some((related) => related.id === action.id)}
                            onStatusChange={changeStatus}
                          />
                        ))}
                        {rows.length === 0 ? (
                          <p className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs font-semibold text-slate-500">
                            No matching actions
                          </p>
                        ) : null}
                        <button type="button" onClick={() => addCorrectiveAction(status)} className="w-full rounded-md border border-dashed border-blue-200 py-2 text-xs font-black text-blue-600">
                          + Add Action
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-4" aria-label="Loading saved corrective action board">
                {statuses.map((status) => (
                  <div key={status} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                    <div className="h-4 w-24 rounded bg-slate-200" />
                    <div className="mt-4 space-y-3">
                      <div className="h-24 rounded-lg border border-slate-200 bg-white" />
                      <div className="h-24 rounded-lg border border-slate-200 bg-white" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle
              title="Work Area Risk Map"
              action={
                <SelectShell
                  value={mapSite}
                  onChange={(value) => {
                    setMapSite(value);
                    setSiteFilter(value);
                    setSelectedRiskId(jobsiteAlertAliases[value] ?? selectedRiskId);
                  }}
                  options={dataset.jobsites.map((jobsite) => ({ label: jobsite.name, value: jobsite.id }))}
                  className="w-[150px]"
                />
              }
            />
            <div className="mt-4"><RiskHeatMap variant="mitigation" /></div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Critical</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> High</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Medium</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Low</span>
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle title="Recent Events" action={<Link href="/safe-predict/reports" className="text-sm font-black text-blue-600">View All</Link>} />
            <div className="mt-5"><EventTimeline events={dataset.events} /></div>
          </Card>
        </div>
      </div>
    </div>
  );
}
