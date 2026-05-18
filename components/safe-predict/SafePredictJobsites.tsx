"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  FilterX,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
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
  "Permits",
  "Inspections",
  "Incidents & Observations",
  "Documents & Reports",
  "Activity Timeline",
] as const;

type DetailTableAction = {
  label: string;
  href?: string;
  onClick?: () => void;
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
        <MetricCard title="Active Jobsites" value={dataset.jobsites.length} detail={loading ? "Checking live data" : mode === "live" ? "Live data" : "Sample data"} tone="blue" icon={<Building2 className="h-7 w-7" />} href="#jobsite-list" />
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
              <p className="text-lg font-black text-slate-950">No jobsites match those filters.</p>
              <p className="mt-2 text-sm font-semibold text-slate-500">Clear filters or switch back to sample data.</p>
            </div>
          ) : null}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle title="Site Risk Map" />
            <div className="mt-4">
              <RiskHeatMap variant="dashboard" />
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle title="Recent Jobsite Activity" />
            <div className="mt-5">
              <EventTimeline events={dataset.events} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function SafePredictJobsiteDetail({ jobsiteId }: { jobsiteId: string }) {
  const { dataset, updateActionStatus, addDraftAction, setSelectedJobsiteId } = useSafePredictData();
  const [activeTab, setActiveTab] = useState<(typeof detailTabs)[number]>("Overview");
  const site = jobsiteById(dataset, jobsiteId);
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
            <div className="mt-4"><RiskHeatMap variant={site.id === "plant-1" || site.id === "warehouse-a" ? "mitigation" : "dashboard"} /></div>
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
