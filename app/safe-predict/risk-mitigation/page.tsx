"use client";
import { deferEffect } from "@/lib/deferredEffect";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Download, FilterX, Loader2, MapPin, Plus, Search, ShieldCheck, Sparkles, X } from "lucide-react";
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
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import type { SafePredictAssignableUser, SafePredictJobsiteRecord } from "@/lib/safePredictData";
import type { SafePredictAiActionSuggestion } from "@/lib/correctiveActionAi";

const statuses: SafePredictActionStatus[] = ["New", "In Progress", "Awaiting Verification", "Closed"];
const suggestionCategories = [
  { label: "Corrective action", value: "corrective_action" },
  { label: "Hazard", value: "hazard" },
  { label: "Near miss", value: "near_miss" },
  { label: "Incident", value: "incident" },
  { label: "PPE violation", value: "ppe_violation" },
  { label: "Housekeeping", value: "housekeeping" },
  { label: "Equipment issue", value: "equipment_issue" },
  { label: "Fall hazard", value: "fall_hazard" },
  { label: "Electrical hazard", value: "electrical_hazard" },
  { label: "Excavation/trench concern", value: "excavation_trench_concern" },
  { label: "Fire/hot work concern", value: "fire_hot_work_concern" },
];
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

function riskMapDotClass(level: SafePredictJobsiteRecord["riskLevel"]) {
  if (level === "critical") return "bg-red-500";
  if (level === "high") return "bg-orange-500";
  if (level === "medium") return "bg-amber-400";
  return "bg-emerald-500";
}

function dateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function priorityFromSeverity(level: SafePredictAiActionSuggestion["severity"]): SafePredictCorrectiveAction["priority"] {
  return level === "critical" || level === "high" ? "high" : "medium";
}

function LiveRiskMapPanel({ jobsites }: { jobsites: SafePredictJobsiteRecord[] }) {
  if (jobsites.length === 0) {
    return (
      <div className="grid min-h-[220px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 text-center">
        <div>
          <p className="text-sm font-black text-slate-800">No live risk map data yet</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Add jobsites, inspections, observations, or incidents to populate this map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {jobsites.slice(0, 6).map((jobsite) => (
        <button
          key={jobsite.id}
          type="button"
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:bg-white"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-slate-900">{jobsite.name}</span>
            <span className="mt-1 block text-xs font-semibold text-slate-500">{jobsite.openActions} open actions</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 text-sm font-black text-slate-800">
            <span className={cx("h-2.5 w-2.5 rounded-full", riskMapDotClass(jobsite.riskLevel))} />
            {jobsite.riskScore}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function SafePredictRiskMitigationPage() {
  const { dataset, loading, updateActionStatus, addDraftAction, createCorrectiveAction } = useSafePredictData();
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
  const [aiSuggestion, setAiSuggestion] = useState<SafePredictAiActionSuggestion | null>(null);
  const [aiAssignableUsers, setAiAssignableUsers] = useState<SafePredictAssignableUser[]>(dataset.assignableUsers);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiMessage, setAiMessage] = useState("");

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

  useEffect(() => deferEffect(() => {
    setActions(providerActions);
  }), [providerActions]);

  useEffect(() => deferEffect(() => {
    setAiAssignableUsers(dataset.assignableUsers);
  }), [dataset.assignableUsers]);

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
  const riskScore =
    dataset.jobsites.length > 0
      ? Math.round(dataset.jobsites.reduce((sum, jobsite) => sum + jobsite.riskScore, 0) / dataset.jobsites.length)
      : 0;
  const hasClosedActions = summary.closed > 0;
  const activeAlertCount = visibleAlerts.length + summary.overdue;

  function changeStatus(id: string, status: SafePredictActionStatus) {
    if (statusFilter !== "all" && statusFilter !== status) {
      setStatusFilter("all");
    }
    updateActionStatus(id, status);
    setActions((current) => {
      return current.map((action) =>
        action.id === id
          ? {
              ...action,
              status,
              progress: status === "Closed" ? 100 : status === "Awaiting Verification" ? 85 : status === "In Progress" ? Math.max(action.progress, 40) : action.progress,
            }
          : action
      );
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
    const defaultAssignee = dataset.company.safetyLead && dataset.company.safetyLead !== "Not set" ? dataset.company.safetyLead : "Unassigned";
    const fallbackSiteId = dataset.jobsites[0]?.id ?? "workspace";
    const nextAction: SafePredictCorrectiveAction = {
      id: `local-${Date.now()}`,
      title: `Review ${riskForAction.title.toLowerCase()} controls`,
      linkedRiskId: riskForAction.id,
      linkedRisk: riskForAction.title,
      assignee: defaultAssignee,
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
      siteId: "siteId" in riskForAction && typeof riskForAction.siteId === "string" ? riskForAction.siteId : fallbackSiteId,
      priority: nextAction.priority,
      createdFrom: riskForAction.source === "Observation" ? "Observation" : riskForAction.source === "Inspection" ? "Inspection" : "Predictive Alert",
      status,
    });
    setNewActionId(sharedAction.id);
    setSelectedRiskId(riskForAction.id);
    setSearchTerm("");
    setStatusFilter(status);
    setSiteFilter("all");
    setRiskLevel("all");
    setTypeFilter("all");
    setTimeFilter("all-time");
    setAlertsOpen(false);
    setActions((current) => [{ ...sharedAction, status: sharedAction.status }, ...current.filter((action) => action.id !== sharedAction.id)]);
    window.setTimeout(() => {
      document.getElementById("corrective-action-tracker")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function generateAiAction() {
    const riskForAction = selectedRisk ?? visibleAlerts[0] ?? providerAlerts[0];
    if (!riskForAction) {
      setAiMessage("Select a risk signal before asking AI to prepare an action.");
      return;
    }

    setAiLoading(true);
    setAiMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      if (!token) {
        setAiMessage("Sign in to generate AI mitigation actions for this workspace.");
        return;
      }

      const response = await fetch("/api/company/corrective-actions/ai-suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          risk: {
            id: riskForAction.id,
            title: riskForAction.title,
            detail: riskForAction.detail,
            riskLevel: riskForAction.riskLevel,
            source: riskForAction.source,
            site: riskForAction.site,
            siteId: "siteId" in riskForAction && typeof riskForAction.siteId === "string" ? riskForAction.siteId : undefined,
            area: riskForAction.area,
            score: riskForAction.score,
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            suggestion?: SafePredictAiActionSuggestion;
            assignableUsers?: SafePredictAssignableUser[];
          }
        | null;

      if (!response.ok || !payload?.suggestion) {
        setAiSuggestion(null);
        setAiMessage(payload?.error || "AI could not prepare a mitigation action.");
        return;
      }

      setAiSuggestion(payload.suggestion);
      setAiAssignableUsers(payload.assignableUsers?.length ? payload.assignableUsers : dataset.assignableUsers);
      setSelectedRiskId(riskForAction.id);
      setAiMessage(payload.suggestion.warning || "AI prepared a mitigation action for review.");
      window.setTimeout(() => {
        document.getElementById("ai-mitigation-review")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    } catch (error) {
      setAiSuggestion(null);
      setAiMessage(error instanceof Error ? error.message : "AI could not prepare a mitigation action.");
    } finally {
      setAiLoading(false);
    }
  }

  async function saveAiAction() {
    if (!aiSuggestion) return;
    if (!aiSuggestion.assignedUserId) {
      setAiMessage("Choose an active company user before saving this AI action.");
      return;
    }
    const riskForAction = selectedRisk ?? visibleAlerts.find((alert) => alert.id === aiSuggestion.riskId) ?? providerAlerts.find((alert) => alert.id === aiSuggestion.riskId);
    const fallbackSiteId = dataset.jobsites[0]?.id ?? "workspace";
    const siteId =
      riskForAction && "siteId" in riskForAction && typeof riskForAction.siteId === "string"
        ? riskForAction.siteId
        : fallbackSiteId;
    setAiSaving(true);
    setAiMessage("");
    const result = await createCorrectiveAction({
      title: aiSuggestion.title,
      linkedRiskId: aiSuggestion.riskId,
      linkedRisk: aiSuggestion.riskTitle,
      siteId,
      priority: priorityFromSeverity(aiSuggestion.severity),
      createdFrom: riskForAction?.source === "Observation" ? "Observation" : riskForAction?.source === "Inspection" ? "Inspection" : "Predictive Alert",
      description: `${aiSuggestion.description}\n\nAI rationale: ${aiSuggestion.rationale}\nRisk signal: ${aiSuggestion.riskId}.`,
      category: aiSuggestion.category,
      assignedUserId: aiSuggestion.assignedUserId,
      dueAt: aiSuggestion.dueAt,
      observationType: "negative",
      sifPotential: false,
      status: "New",
    });
    setAiSaving(false);
    if (!result.success || !result.action) {
      setAiMessage(result.error || "Could not save the AI action.");
      return;
    }
    setNewActionId(result.action.id);
    setActions((current) => [result.action!, ...current.filter((action) => action.id !== result.action!.id)]);
    setStatusFilter("New");
    setSearchTerm("");
    setAiSuggestion(null);
    setAiMessage("AI action saved to the corrective action tracker.");
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
          onClick={() => void generateAiAction()}
          disabled={aiLoading || !selectedRisk}
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-black text-blue-700 shadow-sm disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        >
          {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          AI Action
        </button>
        <button
          type="button"
          onClick={() => addCorrectiveAction("New")}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)]"
        >
          <Plus className="h-4 w-4" />
          New Corrective Action
        </button>
      </div>

      {aiMessage ? (
        <p className={cx("mb-5 rounded-lg px-4 py-3 text-sm font-bold", aiMessage.includes("saved") || aiMessage.includes("prepared") ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
          {aiMessage}
        </p>
      ) : null}

      {aiSuggestion ? (
        <Card id="ai-mitigation-review" className="mb-5 scroll-mt-24 p-5">
          <SectionTitle
            title="Review AI Mitigation Action"
            action={
              <button type="button" onClick={() => setAiSuggestion(null)} className="text-sm font-black text-slate-500">
                Dismiss
              </button>
            }
          />
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_160px_180px_240px]">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Action</span>
              <input
                value={aiSuggestion.title}
                onChange={(event) => setAiSuggestion((current) => current ? { ...current, title: event.target.value } : current)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-500"
              />
            </label>
            <SelectShell
              label="Severity"
              value={aiSuggestion.severity}
              onChange={(value) => setAiSuggestion((current) => current ? { ...current, severity: value as SafePredictAiActionSuggestion["severity"] } : current)}
              options={[
                { label: "Critical", value: "critical" },
                { label: "High", value: "high" },
                { label: "Medium", value: "medium" },
                { label: "Low", value: "low" },
              ]}
            />
            <SelectShell
              label="Category"
              value={aiSuggestion.category}
              onChange={(value) => setAiSuggestion((current) => current ? { ...current, category: value } : current)}
              options={suggestionCategories}
            />
            <SelectShell
              label="Assignee"
              value={aiSuggestion.assignedUserId ?? ""}
              onChange={(value) => {
                const user = aiAssignableUsers.find((candidate) => candidate.id === value);
                setAiSuggestion((current) => current ? { ...current, assignedUserId: value || null, assignedUserName: user?.name ?? null } : current);
              }}
              options={[
                { label: "Choose active user", value: "" },
                ...aiAssignableUsers.map((user) => ({ label: `${user.name} - ${user.role}`, value: user.id })),
              ]}
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_180px] xl:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Mitigation details</span>
              <textarea
                value={aiSuggestion.description}
                onChange={(event) => setAiSuggestion((current) => current ? { ...current, description: event.target.value } : current)}
                className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-slate-800 shadow-sm outline-none focus:border-blue-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Due date</span>
              <input
                type="date"
                value={dateInputValue(aiSuggestion.dueAt)}
                onChange={(event) => setAiSuggestion((current) => current ? { ...current, dueAt: event.target.value ? new Date(`${event.target.value}T17:00:00`).toISOString() : "" } : current)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-500"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm font-semibold leading-5 text-slate-600">{aiSuggestion.rationale}</p>
            <button
              type="button"
              onClick={() => void saveAiAction()}
              disabled={aiSaving || !aiSuggestion.title.trim() || !aiSuggestion.assignedUserId}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {aiSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {aiSaving ? "Saving..." : "Save AI Action"}
            </button>
          </div>
        </Card>
      ) : null}

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <MetricCard title="Total Open Actions" value={summary.open} detail={summary.open === 0 ? "No actions yet" : "Filtered action board"} tone="blue" icon={<ShieldCheck className="h-7 w-7" />} href="#corrective-action-tracker" sourceLabel="View board" />
        <MetricCard title="Overdue Actions" value={summary.overdue} detail={summary.overdue === 0 ? "Nothing overdue" : "Filtered overdue actions"} tone="red" icon={<CalendarDays className="h-7 w-7" />} href="#corrective-action-tracker" sourceLabel="View overdue" />
        <MetricCard title="Avg. Time to Close" value={hasClosedActions ? summary.averageDaysToClose : 0} suffix="days" detail={hasClosedActions ? "Based on closed actions" : "No closed actions yet"} tone="purple" icon={<CalendarDays className="h-7 w-7" />} />
        <MetricCard title="Actions Closed (30 Days)" value={summary.closed} detail={summary.closed === 0 ? "No closures yet" : "Closed actions"} tone="green" icon={<ShieldCheck className="h-7 w-7" />} />
        <MetricCard title="Risk Score (All Sites)" value={riskScore} suffix="/100" detail={riskScore === 0 ? "No risk inputs yet" : "Current live score"} tone="amber" icon={<ShieldCheck className="h-7 w-7" />} sparkline={riskScore === 0 ? undefined : <MiniSparkline data={[58, 62, 56, 74, 71, riskScore]} color="#f97316" />} />
      </div>

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Company in this workspace</p>
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
                <span className={cx("grid h-16 w-16 place-items-center rounded-full border-4 text-center font-black", alert.riskLevel === "critical" ? "border-red-500 text-red-600" : alert.riskLevel === "high" ? "border-orange-500 text-orange-800" : alert.riskLevel === "medium" ? "border-amber-400 text-amber-800" : "border-emerald-500 text-emerald-800")}>
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
            {!loading ? (
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
              <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-4" role="status" aria-label="Loading saved corrective action board">
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
            <div className="mt-4">
              {dataset.mode === "live" ? <LiveRiskMapPanel jobsites={dataset.jobsites} /> : <RiskHeatMap variant="mitigation" />}
            </div>
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
