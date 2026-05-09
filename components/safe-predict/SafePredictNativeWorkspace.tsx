"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  Download,
  FileText,
  FilterX,
  GraduationCap,
  MapPin,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useSafePredictData } from "@/components/safe-predict/SafePredictDataProvider";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  Card,
  CorrectiveActionCard,
  EventTimeline,
  ExportButton,
  ForecastTrendChart,
  MetricCard,
  NextStepRow,
  RiskBadge,
  RiskHeatMap,
  SectionTitle,
  SelectShell,
  cx,
} from "@/components/safe-predict/SafePredictPrimitives";
import { SafePredictOriginalSystemLinks } from "@/components/safe-predict/SafePredictOriginalSystemLinks";
import {
  riskForecastForSite,
  siteScoped,
  summarizeSafePredictDataset,
  type SafePredictDataset,
} from "@/lib/safePredictData";
import {
  safePredictWorkspaceConfigs,
  type SafePredictWorkspaceSlug,
} from "@/lib/safePredictWorkspaceConfig";
import { mapSafePredictOperationHref } from "@/lib/safePredictRouteMap";
import type { SafePredictActionStatus, SafePredictDemoEmployee, SafePredictRiskLevel } from "@/lib/safePredictMockData";

type RowAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type ScopedRows = {
  actions: SafePredictDataset["actions"];
  alerts: SafePredictDataset["alerts"];
  inspections: SafePredictDataset["inspections"];
  incidents: SafePredictDataset["incidents"];
  observations: SafePredictDataset["observations"];
  hazards: SafePredictDataset["hazards"];
  permits: SafePredictDataset["permits"];
  employees: SafePredictDataset["employees"];
  documents: SafePredictDataset["documents"];
  reports: SafePredictDataset["reports"];
};

type WorkspaceRows = {
  title: string;
  headers: string[];
  rows: string[][];
  actions: RowAction[];
  exportRows: unknown[];
  cardGrid?: ReactNode;
  rowIds?: string[];
};

type TrainingAssignmentResult = {
  workerId: string;
  workerName: string;
  title: string;
  action: "create_requirement" | "assign_training" | "update_record" | "review";
  riskLevel: SafePredictRiskLevel;
  requirementTitle: string;
  detail: string;
  createdRequirementId?: string | null;
  createdActionId?: string | null;
};

function workspacePrimaryHref(workspace: SafePredictWorkspaceSlug) {
  if (workspace === "incidents") return mapSafePredictOperationHref("/incidents");
  if (workspace === "observations") return mapSafePredictOperationHref("/field-audits");
  if (workspace === "corrective-actions") return mapSafePredictOperationHref("/field-id-exchange");
  if (workspace === "inspections") return mapSafePredictOperationHref("/jobsites");
  if (workspace === "training") return mapSafePredictOperationHref("/training-matrix");
  if (workspace === "permits") return mapSafePredictOperationHref("/permits");
  if (workspace === "analytics") return mapSafePredictOperationHref("/analytics");
  if (workspace === "reports") return mapSafePredictOperationHref("/reports");
  return "/safe-predict/settings";
}

function WorkspaceIcon({ workspace }: { workspace: SafePredictWorkspaceSlug }) {
  if (workspace === "incidents") return <AlertTriangle className="h-6 w-6" />;
  if (workspace === "observations") return <ShieldAlert className="h-6 w-6" />;
  if (workspace === "corrective-actions") return <ClipboardCheck className="h-6 w-6" />;
  if (workspace === "inspections") return <CalendarCheck className="h-6 w-6" />;
  if (workspace === "hazards") return <TriangleAlert className="h-6 w-6" />;
  if (workspace === "training") return <GraduationCap className="h-6 w-6" />;
  if (workspace === "permits") return <FileText className="h-6 w-6" />;
  if (workspace === "analytics") return <BarChart3 className="h-6 w-6" />;
  if (workspace === "reports") return <Download className="h-6 w-6" />;
  return <Settings className="h-6 w-6" />;
}

function siteName(siteId: string, jobsites: Array<{ id: string; name: string }>) {
  return jobsites.find((site) => site.id === siteId)?.name ?? "All Sites";
}

function inferLocalTrainingTitle(employee: SafePredictDemoEmployee) {
  const haystack = [employee.trade, employee.role, ...(employee.credentials ?? [])].join(" ").toLowerCase();
  if (/\belectrical|electrician|loto|lockout|energy/.test(haystack)) return "LOTO Authorized Worker";
  if (/\bweld|hot work|fire watch/.test(haystack)) return "Hot Work / Fire Watch Training";
  if (/\bscaffold|height|fall|deck/.test(haystack)) return "Fall Protection / Scaffold User Training";
  if (/\bexcavat|trench|civil|concrete/.test(haystack)) return "Excavation and Trenching Competent Person";
  if (/\bsafety manager|site safety|supervisor|foreman/.test(haystack)) return "Supervisor Safety Leadership and Field Verification";
  return "Site Safety Orientation and Hazard Reporting";
}

function buildLocalTrainingAssignments(employees: SafePredictDemoEmployee[]): TrainingAssignmentResult[] {
  return employees.map((employee) => {
    const requirementTitle = inferLocalTrainingTitle(employee);
    const hasEvidence = employee.credentials.length > 0;
    const action: TrainingAssignmentResult["action"] =
      employee.status === "overdue"
        ? "assign_training"
        : employee.status === "expiring"
          ? "assign_training"
          : hasEvidence
            ? "review"
            : "update_record";
    const riskLevel: SafePredictRiskLevel =
      employee.status === "overdue" || employee.readinessScore < 70
        ? "high"
        : employee.status === "expiring" || employee.readinessScore < 85 || !hasEvidence
          ? "medium"
          : "low";
    return {
      workerId: employee.id,
      workerName: employee.name,
      title:
        action === "update_record"
          ? `Update training records for ${employee.name}`
          : action === "review"
            ? `Review training fit for ${employee.name}`
            : `Assign ${requirementTitle} to ${employee.name}`,
      action,
      riskLevel,
      requirementTitle,
      detail:
        action === "update_record"
          ? `${employee.name} appears ready, but this view does not have training evidence attached. Verify and update the record.`
          : action === "review"
            ? `${employee.name} does not show an urgent gap. Review only.`
            : `${employee.name} has a readiness gap or renewal signal. Assign training to mitigate jobsite risk.`,
    };
  });
}

export function SafePredictNativeWorkspace({ workspace }: { workspace: SafePredictWorkspaceSlug }) {
  const { dataset, mode, setMode, selectedJobsiteId, setSelectedJobsiteId, updateActionStatus, closeActionWithPhoto, addDraftAction, addDraftHazard } = useSafePredictData();
  const router = useRouter();
  const config = safePredictWorkspaceConfigs[workspace];
  const [query, setQuery] = useState("");
  const [siteFilter, setSiteFilter] = useState(selectedJobsiteId === "all" ? "all" : selectedJobsiteId);
  const [riskFilter, setRiskFilter] = useState<SafePredictRiskLevel | "all">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showHazardComposer, setShowHazardComposer] = useState(false);
  const [hazardDraft, setHazardDraft] = useState({
    title: "",
    description: "",
    siteId: selectedJobsiteId === "all" ? "" : selectedJobsiteId,
    riskLevel: "medium" as SafePredictRiskLevel,
    controlStatus: "Needs Control" as SafePredictDataset["hazards"][number]["controlStatus"],
    owner: "",
    dueDate: "",
  });
  const [trainingAiLoading, setTrainingAiLoading] = useState(false);
  const [trainingAiMessage, setTrainingAiMessage] = useState("");
  const [trainingAiAssignments, setTrainingAiAssignments] = useState<TrainingAssignmentResult[]>([]);
  const summary = summarizeSafePredictDataset(dataset);
  const normalizedQuery = query.trim().toLowerCase();

  const scoped = useMemo(() => {
    return {
      actions: siteScoped(dataset.actions, siteFilter),
      alerts: siteScoped(dataset.alerts, siteFilter),
      inspections: siteScoped(dataset.inspections, siteFilter),
      incidents: siteScoped(dataset.incidents, siteFilter),
      observations: siteScoped(dataset.observations, siteFilter),
      hazards: siteScoped(dataset.hazards, siteFilter),
      permits: siteScoped(dataset.permits, siteFilter),
      employees: siteFilter === "all" ? dataset.employees : dataset.employees.filter((employee) => employee.assignedSiteId === siteFilter),
      documents: siteScoped(dataset.documents, siteFilter),
      reports: siteScoped(dataset.reports, siteFilter),
    };
  }, [dataset, siteFilter]);

  function clearFilters() {
    setQuery("");
    setSiteFilter("all");
    setSelectedJobsiteId("all");
    setRiskFilter("all");
    setStatusFilter("all");
  }

  function createActionFromSignal(signal: { id: string; title: string; siteId: string; riskLevel?: SafePredictRiskLevel }) {
    const draft = addDraftAction({
      title: `Resolve ${signal.title.toLowerCase()}`,
      linkedRiskId: signal.id,
      linkedRisk: signal.title,
      siteId: signal.siteId,
      priority: signal.riskLevel === "critical" || signal.riskLevel === "high" ? "high" : "medium",
      createdFrom: workspace === "observations" ? "Observation" : workspace === "inspections" ? "Inspection" : workspace === "hazards" ? "Hazard" : "Manual",
    });
    router.push(`/safe-predict/corrective-actions#${draft.id}`);
  }

  function logHazard() {
    const title = hazardDraft.title.trim();
    if (!title) return;
    const fallbackSiteId = siteFilter !== "all" ? siteFilter : dataset.jobsites[0]?.id ?? "riverside";
    const draft = addDraftHazard({
      title,
      description: hazardDraft.description.trim(),
      siteId: hazardDraft.siteId || fallbackSiteId,
      riskLevel: hazardDraft.riskLevel,
      controlStatus: hazardDraft.controlStatus,
      owner: hazardDraft.owner.trim() || "Unassigned",
      dueDate: hazardDraft.dueDate || "No due date",
    });
    setSiteFilter(draft.siteId);
    setSelectedJobsiteId(draft.siteId);
    setStatusFilter("all");
    setRiskFilter("all");
    setQuery("");
    setHazardDraft({
      title: "",
      description: "",
      siteId: draft.siteId,
      riskLevel: "medium",
      controlStatus: "Needs Control",
      owner: "",
      dueDate: "",
    });
    setShowHazardComposer(false);
    window.setTimeout(() => {
      document.getElementById(draft.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  async function assignTrainingWithAi(worker?: SafePredictDemoEmployee) {
    const candidates = worker
      ? [worker]
      : scoped.employees
          .filter((employee) => employee.status !== "compliant" || employee.credentials.length === 0 || employee.readinessScore < 85)
          .slice(0, 12);
    const selectedWorkers = candidates.length > 0 ? candidates : scoped.employees.slice(0, 6);
    if (selectedWorkers.length === 0) {
      setTrainingAiMessage("No workers are visible for AI training assignment.");
      setTrainingAiAssignments([]);
      return;
    }

    setTrainingAiLoading(true);
    setTrainingAiMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;

      if (!token) {
        const localAssignments = buildLocalTrainingAssignments(selectedWorkers).map((assignment) => {
          if (assignment.action === "review") return assignment;
          const draft = addDraftAction({
            title: assignment.title,
            linkedRiskId: `training-${assignment.workerId}`,
            linkedRisk: assignment.requirementTitle,
            siteId: selectedWorkers.find((employee) => employee.id === assignment.workerId)?.assignedSiteId ?? dataset.jobsites[0]?.id ?? "riverside",
            priority: assignment.riskLevel === "critical" || assignment.riskLevel === "high" ? "high" : "medium",
            createdFrom: "Manual",
          });
          return { ...assignment, createdActionId: draft.id };
        });
        setTrainingAiAssignments(localAssignments);
        setTrainingAiMessage("AI training assignments were queued locally. Turn on live beta to write them to company records.");
        return;
      }

      const response = await fetch("/api/company/training-matrix/ai-assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ workers: selectedWorkers }),
      });
      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
            assignments?: TrainingAssignmentResult[];
            createdActions?: number;
            createdRequirements?: number;
          }
        | null;

      if (!response.ok) {
        setTrainingAiMessage(data?.error || "AI could not assign training.");
        setTrainingAiAssignments([]);
        return;
      }

      setTrainingAiAssignments(data?.assignments ?? []);
      setTrainingAiMessage(
        data?.message ||
          `AI queued ${data?.createdActions ?? 0} training follow-up actions and ${data?.createdRequirements ?? 0} missing requirements.`
      );
    } catch (error) {
      setTrainingAiMessage(error instanceof Error ? error.message : "AI could not assign training.");
      setTrainingAiAssignments([]);
    } finally {
      setTrainingAiLoading(false);
    }
  }

  const pageRows = buildRows({
    workspace,
    query: normalizedQuery,
    riskFilter,
    statusFilter,
    scoped,
    jobsites: dataset.jobsites,
    updateActionStatus,
    closeActionWithPhoto,
    createActionFromSignal,
    assignTrainingWithAi,
  });

  const selectedForecastSite = siteFilter === "all" ? dataset.jobsites[0]?.id ?? "riverside" : siteFilter;

  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 pb-8 sm:px-7">
      <div className="flex flex-col gap-4 px-0 py-6 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <WorkspaceIcon workspace={workspace} />
            </span>
            <div>
              <h1 className="font-app-display text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{config.title}</h1>
              <p className="mt-1 text-base text-slate-600">{config.subtitle}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          <button
            type="button"
            onClick={() => setMode(mode === "live" ? "demo" : "live")}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm"
          >
            <ShieldCheck className="h-4 w-4" />
            {mode === "live" ? "Live beta" : "Demo fallback"}
          </button>
          <ExportButton
            fileName={`safe-predict-${workspace}.json`}
            label={`Export ${config.title}`}
            payload={{ mode, workspace, siteFilter, rows: pageRows.exportRows, dataset }}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export
          </ExportButton>
          {workspace === "training" ? (
            <button
              type="button"
              onClick={() => void assignTrainingWithAi()}
              disabled={trainingAiLoading}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Sparkles className="h-4 w-4" />
              {trainingAiLoading ? "Assigning..." : config.primaryAction}
            </button>
          ) : workspace === "hazards" ? (
            <button
              type="button"
              onClick={() => setShowHazardComposer((current) => !current)}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)]"
            >
              <Plus className="h-4 w-4" />
              {config.primaryAction}
            </button>
          ) : (
            <Link href={workspacePrimaryHref(workspace)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)]">
              <Plus className="h-4 w-4" />
              {config.primaryAction}
            </Link>
          )}
        </div>
      </div>

      {workspace === "hazards" && showHazardComposer ? (
        <Card className="mb-5 p-5">
          <SectionTitle title="Log Hazard" />
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr_170px_190px_1fr]">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Hazard</span>
              <input
                value={hazardDraft.title}
                onChange={(event) => setHazardDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Open edge at level 3 stairwell"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
              />
            </label>
            <SelectShell
              label="Jobsite"
              value={hazardDraft.siteId || (siteFilter === "all" ? dataset.jobsites[0]?.id ?? "" : siteFilter)}
              onChange={(value) => setHazardDraft((current) => ({ ...current, siteId: value }))}
              options={dataset.jobsites.map((site) => ({ label: site.name, value: site.id }))}
            />
            <SelectShell
              label="Risk"
              value={hazardDraft.riskLevel}
              onChange={(value) => setHazardDraft((current) => ({ ...current, riskLevel: value as SafePredictRiskLevel }))}
              options={[
                { label: "Critical", value: "critical" },
                { label: "High", value: "high" },
                { label: "Medium", value: "medium" },
                { label: "Low", value: "low" },
              ]}
            />
            <SelectShell
              label="Control"
              value={hazardDraft.controlStatus}
              onChange={(value) =>
                setHazardDraft((current) => ({
                  ...current,
                  controlStatus: value as SafePredictDataset["hazards"][number]["controlStatus"],
                }))
              }
              options={[
                { label: "Needs Control", value: "Needs Control" },
                { label: "Control Planned", value: "Control Planned" },
                { label: "Controlled", value: "Controlled" },
              ]}
            />
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Owner</span>
              <input
                value={hazardDraft.owner}
                onChange={(event) => setHazardDraft((current) => ({ ...current, owner: event.target.value }))}
                placeholder="Owner"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_2fr_auto] xl:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Due date</span>
              <input
                type="date"
                value={hazardDraft.dueDate}
                onChange={(event) => setHazardDraft((current) => ({ ...current, dueDate: event.target.value }))}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Notes</span>
              <input
                value={hazardDraft.description}
                onChange={(event) => setHazardDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Immediate controls, location details, or escalation notes"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
              />
            </label>
            <button
              type="button"
              onClick={logHazard}
              disabled={!hazardDraft.title.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Plus className="h-4 w-4" />
              Log Hazard
            </button>
          </div>
        </Card>
      ) : null}

      {workspace === "training" && (trainingAiMessage || trainingAiAssignments.length > 0) ? (
        <Card className="mb-5 p-5">
          <SectionTitle
            title="AI Training Assignments"
            action={<Link href="/training-matrix" className="text-sm font-black text-blue-600">Open training matrix</Link>}
          />
          {trainingAiMessage ? <p className="mt-2 text-sm font-semibold text-slate-600">{trainingAiMessage}</p> : null}
          {trainingAiAssignments.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {trainingAiAssignments.slice(0, 6).map((assignment) => (
                <article key={`${assignment.workerId}-${assignment.title}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{assignment.title}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{assignment.workerName}</p>
                    </div>
                    <RiskBadge level={assignment.riskLevel} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{assignment.detail}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{assignment.requirementTitle}</span>
                    <span className="rounded-full bg-white px-3 py-1 text-slate-600">{assignment.action.replace(/_/g, " ")}</span>
                  </div>
                  {assignment.createdActionId ? (
                    <Link href={`/safe-predict/corrective-actions#${assignment.createdActionId}`} className="mt-4 inline-flex text-sm font-black text-blue-600">
                      View queued action
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {moduleMetrics(workspace, summary, scoped).map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      <Card className="mt-5 p-5">
        <div className="grid gap-4 2xl:grid-cols-[1fr_190px_170px_170px_auto] 2xl:items-end">
          <label className="relative block">
            <span className="mb-1 block text-xs font-bold text-slate-600">Search</span>
            <Search className="absolute bottom-3 left-3 h-5 w-5 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
              placeholder={`Search ${config.title.toLowerCase()}...`}
            />
          </label>
          <SelectShell
            label="Jobsite"
            value={siteFilter}
            onChange={(value) => {
              setSiteFilter(value);
              setSelectedJobsiteId(value);
            }}
            options={[{ label: "All Sites", value: "all" }, ...dataset.jobsites.map((site) => ({ label: site.name, value: site.id }))]}
          />
          <SelectShell
            label="Risk"
            value={riskFilter}
            onChange={(value) => setRiskFilter(value as SafePredictRiskLevel | "all")}
            options={[
              { label: "All Risk", value: "all" },
              { label: "Critical", value: "critical" },
              { label: "High", value: "high" },
              { label: "Medium", value: "medium" },
              { label: "Low", value: "low" },
            ]}
          />
          <SelectShell
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: "All Statuses", value: "all" },
              { label: "Open", value: "Open" },
              { label: "New", value: "New" },
              { label: "In Progress", value: "In Progress" },
              { label: "Awaiting Verification", value: "Awaiting Verification" },
              { label: "Closed", value: "Closed" },
              { label: "Completed", value: "Completed" },
              { label: "Expired", value: "Expired" },
            ]}
          />
          <button type="button" onClick={clearFilters} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black text-blue-600">
            <FilterX className="h-4 w-4" />
            Clear
          </button>
        </div>
      </Card>

      {workspace === "analytics" ? (
        <div className="mt-5 grid gap-5 2xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-5">
            <SectionTitle title={`Risk Forecast - ${siteName(selectedForecastSite, dataset.jobsites)}`} />
            <ForecastTrendChart data={riskForecastForSite(dataset, selectedForecastSite)} />
          </Card>
          <Card className="p-5">
            <SectionTitle title="Risk Heat Map" />
            <div className="mt-4"><RiskHeatMap variant="dashboard" /></div>
          </Card>
        </div>
      ) : null}

      {workspace === "reports" ? (
        <div className="mt-5 grid gap-5 2xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-5">
            <SectionTitle title="Launch Readiness Snapshot" />
            <div className="mt-4 space-y-3">
              <NextStepRow title="Jobsite records connected" detail={`${dataset.jobsites.length} jobsites are available in SafetyDoc360.`} tone="blue" icon={<MapPin className="h-5 w-5" />} href="/safe-predict/jobsites" />
              <NextStepRow title="Open work remains" detail={`${summary.openActions} actions are still open across the platform.`} tone="high" icon={<ClipboardCheck className="h-5 w-5" />} href="/safe-predict/corrective-actions" />
              <NextStepRow title="Training risk visible" detail={`${summary.workforce.overdue} workers have overdue readiness items.`} tone="medium" icon={<Users className="h-5 w-5" />} href="/safe-predict/training" />
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle title="Activity Timeline" />
            <div className="mt-5"><EventTimeline events={dataset.events} /></div>
          </Card>
        </div>
      ) : null}

      {workspace === "settings" ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <Card className="p-5">
            <SectionTitle title="Data Mode" />
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">SafetyDoc360 reads authenticated workspace APIs when live beta is enabled. If live data is empty or unavailable, the shell company data keeps the platform demo-ready.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => setMode("live")} className={cx("rounded-lg border px-4 py-3 text-sm font-black", mode === "live" ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700")}>Live beta</button>
              <button type="button" onClick={() => setMode("demo")} className={cx("rounded-lg border px-4 py-3 text-sm font-black", mode === "demo" ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700")}>Demo fallback</button>
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle title="Risk Thresholds" />
            <div className="mt-4 space-y-3 text-sm font-black text-slate-700">
              <p className="flex justify-between rounded-lg bg-red-50 p-3 text-red-700"><span>Critical</span><span>90-100</span></p>
              <p className="flex justify-between rounded-lg bg-orange-50 p-3 text-orange-700"><span>High</span><span>70-89</span></p>
              <p className="flex justify-between rounded-lg bg-amber-50 p-3 text-amber-700"><span>Medium</span><span>40-69</span></p>
              <p className="flex justify-between rounded-lg bg-emerald-50 p-3 text-emerald-700"><span>Low</span><span>0-39</span></p>
            </div>
          </Card>
        </div>
      ) : null}

      {!["analytics", "reports", "settings"].includes(workspace) ? (
        <Card className="mt-5 overflow-hidden">
          <div className="p-5 pb-3">
            <SectionTitle title={pageRows.title} action={<span className="text-sm font-black text-slate-500">{pageRows.rows.length} records</span>} />
          </div>
          {pageRows.cardGrid ? (
            <div className="grid gap-4 p-5 pt-2 md:grid-cols-2 2xl:grid-cols-3">{pageRows.cardGrid}</div>
          ) : (
            <DataTable headers={pageRows.headers} rows={pageRows.rows} actions={pageRows.actions} rowIds={pageRows.rowIds} />
          )}
        </Card>
      ) : null}

      <div className="mt-5">
        <SafePredictOriginalSystemLinks workspace={workspace} />
      </div>
    </div>
  );
}

function moduleMetrics(
  workspace: SafePredictWorkspaceSlug,
  summary: ReturnType<typeof summarizeSafePredictDataset>,
  scoped: ScopedRows
) {
  const shared = [
    { title: "Sites In Scope", value: scoped.actions.length || summary.jobsites, detail: "Connected records", tone: "blue" as const, icon: <MapPin className="h-7 w-7" /> },
    { title: "Open Actions", value: summary.openActions, detail: `${summary.overdueActions} overdue`, tone: "orange" as const, icon: <ClipboardCheck className="h-7 w-7" /> },
  ];
  if (workspace === "incidents") return [{ title: "Incident Reviews", value: scoped.incidents.length, detail: "Open and closed", tone: "red" as const, icon: <AlertTriangle className="h-7 w-7" /> }, ...shared, { title: "Near Miss Signals", value: 3, detail: "Last 30 days", tone: "amber" as const, icon: <ShieldAlert className="h-7 w-7" /> }];
  if (workspace === "observations") return [{ title: "Observations", value: scoped.observations.length, detail: "Field signals", tone: "amber" as const, icon: <ShieldAlert className="h-7 w-7" /> }, ...shared, { title: "Converted", value: scoped.observations.filter((row) => row.status === "Converted").length, detail: "To actions", tone: "green" as const, icon: <ShieldCheck className="h-7 w-7" /> }];
  if (workspace === "corrective-actions") return [{ title: "Corrective Actions", value: scoped.actions.length, detail: "In tracker", tone: "orange" as const, icon: <ClipboardCheck className="h-7 w-7" /> }, ...shared, { title: "Closed", value: summary.closedActions, detail: "Verified", tone: "green" as const, icon: <ShieldCheck className="h-7 w-7" /> }];
  if (workspace === "inspections") return [{ title: "Inspections", value: scoped.inspections.length, detail: "Scheduled and complete", tone: "blue" as const, icon: <CalendarCheck className="h-7 w-7" /> }, ...shared, { title: "Failed Checks", value: scoped.inspections.reduce((sum, row) => sum + row.failedItems, 0), detail: "Needs action", tone: "red" as const, icon: <AlertTriangle className="h-7 w-7" /> }];
  if (workspace === "hazards") return [{ title: "Hazards", value: scoped.hazards.length, detail: "Active drivers", tone: "red" as const, icon: <TriangleAlert className="h-7 w-7" /> }, ...shared, { title: "Needs Control", value: scoped.hazards.filter((row) => row.controlStatus !== "Controlled").length, detail: "Open controls", tone: "orange" as const, icon: <ShieldAlert className="h-7 w-7" /> }];
  if (workspace === "training") return [{ title: "Training Compliance", value: `${summary.workforce.compliantPercent}%`, detail: `${summary.workforce.overdue} overdue`, tone: "green" as const, icon: <GraduationCap className="h-7 w-7" /> }, ...shared, { title: "Workers In Scope", value: scoped.employees.length, detail: "Roster rows", tone: "blue" as const, icon: <Users className="h-7 w-7" /> }];
  if (workspace === "permits") return [{ title: "Permit Records", value: scoped.permits.length, detail: `${summary.permits.expired} expired`, tone: "blue" as const, icon: <FileText className="h-7 w-7" /> }, ...shared, { title: "Expiring Soon", value: scoped.permits.filter((row) => row.status === "Expiring Soon").length, detail: "Renewal needed", tone: "amber" as const, icon: <CalendarCheck className="h-7 w-7" /> }];
  if (workspace === "analytics") return [{ title: "Risk Trend", value: "Elevated", detail: "Next 30 days", tone: "red" as const, icon: <BarChart3 className="h-7 w-7" /> }, ...shared, { title: "Risk Score", value: summary.riskScore, detail: "All jobsites", tone: "orange" as const, icon: <ShieldAlert className="h-7 w-7" /> }];
  if (workspace === "reports") return [{ title: "Reports", value: scoped.reports.length, detail: "Ready or draft", tone: "blue" as const, icon: <Download className="h-7 w-7" /> }, ...shared, { title: "Documents", value: scoped.documents.length, detail: "In evidence pack", tone: "green" as const, icon: <FileText className="h-7 w-7" /> }];
  return [{ title: "Mode", value: "Local", detail: "Live beta capable", tone: "blue" as const, icon: <Settings className="h-7 w-7" /> }, ...shared, { title: "Jobsites", value: summary.jobsites, detail: "Available", tone: "green" as const, icon: <MapPin className="h-7 w-7" /> }];
}

function buildRows({
  workspace,
  query,
  riskFilter,
  statusFilter,
  scoped,
  jobsites,
  updateActionStatus,
  closeActionWithPhoto,
  createActionFromSignal,
  assignTrainingWithAi,
}: {
  workspace: SafePredictWorkspaceSlug;
  query: string;
  riskFilter: SafePredictRiskLevel | "all";
  statusFilter: string;
  scoped: ScopedRows;
  jobsites: Array<{ id: string; name: string }>;
  updateActionStatus: (id: string, status: SafePredictActionStatus) => void;
  closeActionWithPhoto: (id: string, file: File) => Promise<{ success: boolean; error?: string }>;
  createActionFromSignal: (signal: { id: string; title: string; siteId: string; riskLevel?: SafePredictRiskLevel }) => void;
  assignTrainingWithAi: (worker?: SafePredictDemoEmployee) => void;
}): WorkspaceRows {
  function textMatches(values: string[]) {
    return !query || values.join(" ").toLowerCase().includes(query);
  }
  function statusMatches(status: string) {
    return statusFilter === "all" || status === statusFilter;
  }
  function riskMatches(level?: SafePredictRiskLevel) {
    return riskFilter === "all" || level === riskFilter;
  }

  if (workspace === "corrective-actions") {
    const actions = scoped.actions.filter((action) => textMatches([action.title, action.linkedRisk, action.assignee, action.status]) && statusMatches(action.status) && riskMatches(action.priority));
    return {
      title: "Corrective Action Tracker",
      headers: [],
      rows: [],
      actions: [],
      exportRows: actions,
      cardGrid: actions.map((action) => (
        <div key={action.id} id={action.id} className="scroll-mt-28">
          <CorrectiveActionCard action={action} onStatusChange={updateActionStatus} onCloseWithPhoto={closeActionWithPhoto} />
        </div>
      )) as ReactNode,
    };
  }

  if (workspace === "incidents") {
    const rows = scoped.incidents.filter((row) => textMatches([row.title, row.detail, row.status, row.type]) && statusMatches(row.status) && riskMatches(row.severity));
    return table("Incident Register", ["Incident", "Jobsite", "Type", "Status", "Reported", "Action"], rows.map((row) => [row.title, siteName(row.siteId, jobsites), row.type, row.status, row.reportedAt]), rows.map((row) => ({ label: "Create Action", onClick: () => createActionFromSignal(row) })), rows);
  }

  if (workspace === "observations") {
    const rows = scoped.observations.filter((row) => textMatches([row.title, row.detail, row.category, row.status]) && statusMatches(row.status) && riskMatches(row.riskLevel));
    return table("Observation Signals", ["Observation", "Jobsite", "Category", "Status", "Submitted", "Action"], rows.map((row) => [row.title, siteName(row.siteId, jobsites), row.category, row.status, row.submittedAt]), rows.map((row) => ({ label: "Convert", onClick: () => createActionFromSignal(row) })), rows);
  }

  if (workspace === "inspections") {
    const rows = scoped.inspections.filter((row) => textMatches([row.title, row.checklist, row.inspector, row.status]) && statusMatches(row.status) && riskMatches(row.riskLevel));
    return table("Inspection Queue", ["Inspection", "Jobsite", "Checklist", "Inspector", "Status", "Failed", "Action"], rows.map((row) => [row.title, siteName(row.siteId, jobsites), row.checklist, row.inspector, row.status, `${row.failedItems}`]), rows.map((row) => ({ label: "Action", onClick: () => createActionFromSignal(row) })), rows);
  }

  if (workspace === "hazards") {
    const rows = scoped.hazards.filter((row) => textMatches([row.title, row.controlStatus, row.owner]) && statusMatches(row.controlStatus) && riskMatches(row.riskLevel));
    return table("Hazard Control Register", ["Hazard", "Jobsite", "Control", "Owner", "Due", "Risk", "Action"], rows.map((row) => [row.title, siteName(row.siteId, jobsites), row.controlStatus, row.owner, row.dueDate, row.riskLevel]), rows.map((row) => ({ label: "Create Control", onClick: () => createActionFromSignal(row) })), rows, rows.map((row) => row.id));
  }

  if (workspace === "training") {
    const rows = scoped.employees.filter((employee) => textMatches([employee.name, employee.trade, employee.role, employee.status]));
    return table(
      "Training & Readiness Roster",
      ["Employee", "Jobsite", "Trade", "Role", "Readiness", "Status"],
      rows.map((row) => [row.name, siteName(row.assignedSiteId, jobsites), row.trade, row.role, `${row.readinessScore}`, row.status]),
      rows.map((row) => ({ label: "Assign", onClick: () => assignTrainingWithAi(row) })),
      rows
    );
  }

  if (workspace === "permits") {
    const rows = scoped.permits.filter((row) => textMatches([row.type, row.status, row.owner]) && statusMatches(row.status) && riskMatches(row.riskLevel));
    return table("Permit Register", ["Permit", "Jobsite", "Status", "Owner", "Expires", "Risk"], rows.map((row) => [row.type, siteName(row.siteId, jobsites), row.status, row.owner, row.expiresAt, row.riskLevel]), rows.map(() => ({ label: "Renew", href: mapSafePredictOperationHref("/permits") })), rows);
  }

  if (workspace === "analytics") {
    return table("Risk Analytics By Jobsite", ["Jobsite", "Risk", "Open Actions", "Inspection Gaps", "Incidents"], jobsites.map((site) => [site.name, "Open", "", "", ""]), [], jobsites);
  }

  if (workspace === "reports") {
    const rows = scoped.reports.filter((row) => textMatches([row.title, row.audience, row.status]) && statusMatches(row.status));
    return table("Report Library", ["Report", "Jobsite", "Audience", "Status", "Updated", "Open"], rows.map((row) => [row.title, siteName(row.siteId, jobsites), row.audience, row.status, row.updatedAt]), rows.map(() => ({ label: "Open", href: mapSafePredictOperationHref("/reports") })), rows);
  }

  return table("Platform Settings", ["Setting", "Value", "Status"], [["Data mode", "Live beta or demo fallback", "Ready"], ["Risk bands", "Low / Medium / High / Critical", "Ready"], ["Visual system", "Concept-picture SafetyDoc360 theme", "Ready"]], [], []);
}

function table(title: string, headers: string[], rows: string[][], actions: RowAction[], exportRows: unknown[], rowIds?: string[]) {
  return { title, headers, rows, actions, exportRows, rowIds };
}

function DataTable({ headers, rows, actions, rowIds }: { headers: string[]; rows: string[][]; actions: RowAction[]; rowIds?: string[] }) {
  const visibleHeaders = headers.filter((header) => header !== "Action");
  return (
    <>
    <div className="space-y-3 p-4 pt-1 md:hidden">
      {rows.map((row, rowIndex) => (
        <article id={rowIds?.[rowIndex]} key={`workspace-card-${rowIndex}`} className="scroll-mt-28 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-base font-black leading-snug text-slate-950">{row[0]}</p>
          <dl className="mt-3 grid gap-2 text-sm">
            {row.slice(1).map((cell, cellIndex) => (
              <div key={`workspace-card-${rowIndex}-${cellIndex}`} className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                <dt className="font-bold text-slate-500">{visibleHeaders[cellIndex + 1] ?? "Detail"}</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {["critical", "high", "medium", "low"].includes(cell) ? <RiskBadge level={cell as SafePredictRiskLevel} /> : cell}
                </dd>
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
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-semibold text-slate-500">No records match the current filters.</div>
      ) : null}
    </div>
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead>
          <tr className="border-y border-slate-200 bg-slate-50 text-xs font-black text-slate-600">
            {headers.map((header) => <th key={header} className="px-5 py-3">{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr id={rowIds?.[rowIndex]} key={row.join("-")} className="scroll-mt-28 border-b border-slate-100 hover:bg-slate-50">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="px-5 py-3 font-semibold text-slate-700">
                  {cellIndex === row.length - 1 && ["critical", "high", "medium", "low"].includes(cell) ? <RiskBadge level={cell as SafePredictRiskLevel} /> : cell}
                </td>
              ))}
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
            <tr><td colSpan={headers.length} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">No records match the current filters.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
    </>
  );
}
