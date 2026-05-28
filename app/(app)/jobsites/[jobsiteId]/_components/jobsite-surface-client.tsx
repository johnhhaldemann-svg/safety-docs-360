"use client";
import { deferEffect } from "@/lib/deferredEffect";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  InlineMessage,
  SectionCard,
  StatusBadge,
  appButtonQuietClassName,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import { emergencyActionPlanStatusLabel, type EmergencyActionPlanReadiness } from "@/lib/jobsiteEmergencyActionPlan";
import type { JobsiteLaunchReadiness, JobsiteLaunchStationStatus, JobsiteLaunchStatus } from "@/lib/jobsiteLaunchReadiness";
import type { JobsiteTopRisk, JobsiteTopRiskLevel } from "@/lib/jobsiteTopRisks";

const supabase = getSupabaseBrowserClient();

type PermitRow = {
  id: string;
  title: string;
  permit_type: string;
  status: string;
  severity: string;
  category: string;
  due_at: string | null;
  owner_user_id: string | null;
  sif_flag: boolean;
  escalation_level: string;
  escalation_reason: string | null;
  stop_work_status: string;
  stop_work_reason: string | null;
  dap_activity_id: string | null;
  observation_id: string | null;
  created_at: string;
  updated_at: string;
  jobsite_id?: string | null;
};

type JobsiteRow = {
  id?: string;
  name?: string;
  jobsite_number?: string | null;
  project_number?: string | null;
  location?: string | null;
  status?: string;
  zip_code?: string | null;
  weather_address_line_1?: string | null;
  weather_address_line_2?: string | null;
  weather_city?: string | null;
  weather_state?: string | null;
  weather_country?: string | null;
  project_manager?: string | null;
  safety_lead?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
};

type TeamUserRow = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
};

type JobsiteAssignmentRow = {
  id?: string | null;
  user_id?: string | null;
  jobsite_id?: string | null;
  role?: string | null;
};

type EmployeeOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type SurfaceRow = Record<string, unknown> & { id?: string | null };

function labelize(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Not set";
  return raw
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function rowText(row: SurfaceRow, keys: string[], fallback = "Not set") {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "Yes" : "No";
  }
  return fallback;
}

function rowDate(row: SurfaceRow, keys: string[]) {
  return formatDateTime(rowText(row, keys, ""));
}

function surfaceRows(payload: Record<string, unknown> | null, key: string) {
  return (((payload?.[key] as SurfaceRow[] | undefined) ?? []) as SurfaceRow[]).filter(Boolean);
}

function emergencyReadinessTone(readiness?: string | null): "success" | "warning" | "error" {
  if (readiness === "complete") return "success";
  if (readiness === "missing_critical_info") return "error";
  return "warning";
}

function topRiskTone(level: JobsiteTopRiskLevel): "neutral" | "success" | "warning" | "error" | "info" {
  if (level === "critical") return "error";
  if (level === "high") return "warning";
  if (level === "moderate") return "info";
  return "success";
}

function topRiskLabel(level: JobsiteTopRiskLevel) {
  if (level === "moderate") return "Moderate";
  return labelize(level);
}

function sourceLabel(type: string) {
  return labelize(type === "corrective_action" ? "corrective actions" : type);
}

function launchStatusLabel(status: JobsiteLaunchStatus | JobsiteLaunchStationStatus | undefined) {
  if (status === "go") return "GO";
  if (status === "hold") return "HOLD";
  if (status === "review") return "REVIEW";
  return "NO SIGNAL";
}

function launchBadgeTone(status: JobsiteLaunchStatus | JobsiteLaunchStationStatus | undefined): "neutral" | "success" | "warning" | "error" | "info" {
  if (status === "go") return "success";
  if (status === "hold") return "error";
  if (status === "review") return "warning";
  return "neutral";
}

function launchPanelClass(status: JobsiteLaunchStatus | JobsiteLaunchStationStatus | undefined) {
  if (status === "hold") return "border-red-500/45 bg-red-950/24";
  if (status === "review") return "border-amber-500/45 bg-amber-950/20";
  if (status === "go") return "border-emerald-500/40 bg-emerald-950/18";
  return "border-slate-700/80 bg-slate-950/45";
}

function fallbackLaunchReadiness(links: Record<string, string>, eapReadiness: EmergencyActionPlanReadiness): JobsiteLaunchReadiness {
  const emergencyStatus = eapReadiness === "complete" ? "go" : eapReadiness === "missing_critical_info" ? "hold" : "review";
  const stations: JobsiteLaunchReadiness["stations"] = [
    { id: "emergency", label: "Emergency", status: emergencyStatus, summary: emergencyStatus === "go" ? "Emergency profile ready" : "EAP needs review", detail: "Emergency readiness is derived from the jobsite Emergency Action Plan.", href: links.emergencyActionPlan },
    { id: "risk", label: "Risk", status: "no_signal", summary: "Risk board loading", detail: "Top 10 risk signals are not available in this payload.", href: links.liveView },
    { id: "work_plan", label: "Work Plan", status: "no_signal", summary: "No plan signal", detail: "Daily work plan signal is not available.", href: links.schedule },
    { id: "permits", label: "Permits", status: "no_signal", summary: "No permit signal", detail: "Permit readiness is not available.", href: links.permits },
    { id: "workforce", label: "Workforce", status: "no_signal", summary: "No workforce signal", detail: "Workforce readiness is not available.", href: links.team },
    { id: "documents", label: "Documents", status: "no_signal", summary: "No document signal", detail: "Document readiness is not available.", href: links.documents },
    { id: "incidents", label: "Incidents", status: "no_signal", summary: "No incident signal", detail: "Incident readiness is not available.", href: links.incidents },
    { id: "activity", label: "Activity", status: "no_signal", summary: "No activity signal", detail: "Activity readiness is not available.", href: links.liveView },
  ];
  return {
    status: emergencyStatus === "hold" ? "hold" : "review",
    headline: emergencyStatus === "hold" ? "Launch hold: immediate review needed before work is released." : "Launch review: verify station signals before work proceeds.",
    primaryBlocker: stations.find((station) => station.status !== "go")?.summary ?? "No active blocker detected.",
    nextAction: "Confirm station records and refresh the jobsite overview before releasing work.",
    stations,
    criticalCount: stations.filter((station) => station.status === "hold").length,
    warningCount: stations.filter((station) => station.status === "review" || station.status === "no_signal").length,
  };
}

function roleNeedsJobsiteAssignment(role?: string | null) {
  const normalized = String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return new Set([
    "project_manager",
    "field_supervisor",
    "foreman",
    "field_user",
    "read_only",
    "company_user",
  ]).has(normalized);
}

function buildEmployeeOptions(users: TeamUserRow[]) {
  const options = users
    .filter((user) => String(user.status ?? "").trim().toLowerCase() === "active")
    .map((user, index) => {
      const email = String(user.email ?? "").trim();
      const name = String(user.name ?? "").trim() || email;
      if (!name) return null;
      return {
        id: String(user.id ?? (email || `employee-${index}`)),
        name,
        email,
        role: String(user.role ?? "").trim(),
      } satisfies EmployeeOption;
    })
    .filter((option): option is EmployeeOption => Boolean(option));

  return Array.from(new Map(options.map((option) => [option.name.toLowerCase(), option])).values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function getAuthHeaders(accessToken?: string | null): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export function JobsiteSurfaceClient({
  jobsiteId,
  surface,
  title,
  description,
}: {
  jobsiteId: string;
  surface:
    | "overview"
    | "live-view"
    | "jsa"
    | "permits"
    | "incidents"
    | "reports"
    | "documents"
    | "analytics"
    | "team";
  title: string;
  description: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorTone, setErrorTone] = useState<"error" | "warning">("error");
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);

  const loadSurface = useCallback(async (options?: { keepLoading?: boolean }) => {
    let cancelled = false;
    async function load() {
      if (!options?.keepLoading) {
        setLoading(true);
      }
      setError("");
      setErrorTone("error");
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Missing auth token.");
        const response = await fetch(`/api/jobsites/${jobsiteId}/${surface}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        if (!response.ok) {
          const err = typeof data?.error === "string" ? data.error.trim() : "";
          const warn = typeof data?.warning === "string" ? data.warning.trim() : "";
          if (!cancelled) {
            setError(err || warn || "Failed to load jobsite surface.");
            setErrorTone(err ? "error" : "warning");
            setPayload(null);
          }
        } else if (!cancelled) {
          setPayload(data ?? {});
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load.");
          setErrorTone("error");
        }
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [jobsiteId, surface]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void loadSurface().then((nextCleanup) => {
      cleanup = nextCleanup;
    });
    return () => {
      cleanup?.();
    };
  }, [loadSurface]);

  return (
    <SectionCard title={title} description={description}>
      {loading ? <InlineMessage>Loading...</InlineMessage> : null}
      {!loading && error ? <InlineMessage tone={errorTone}>{error}</InlineMessage> : null}
      {!loading && !error && surface === "overview" ? (
        <div className="space-y-4">
          {typeof payload?.analyticsSummaryIssue === "string" && payload.analyticsSummaryIssue.trim() ? (
            <InlineMessage tone="warning">{payload.analyticsSummaryIssue}</InlineMessage>
          ) : null}
          <OverviewWidgets payload={payload} onReload={() => void loadSurface({ keepLoading: true })} />
        </div>
      ) : null}
      {!loading && !error && surface === "permits" ? (
        <PermitSurface payload={payload} />
      ) : null}
      {!loading && !error && surface === "documents" ? (
        <DocumentsSurface payload={payload} jobsiteId={jobsiteId} />
      ) : null}
      {!loading && !error && surface === "reports" ? (
        <ReportsSurface payload={payload} />
      ) : null}
      {!loading && !error && surface === "incidents" ? (
        <IncidentsSurface payload={payload} />
      ) : null}
      {!loading && !error && surface === "team" ? (
        <TeamSurface payload={payload} jobsiteId={jobsiteId} onReload={() => void loadSurface({ keepLoading: true })} />
      ) : null}
      {!loading && !error && surface === "analytics" ? (
        <AnalyticsSurface payload={payload} />
      ) : null}
      {!loading && !error && !["overview", "permits", "documents", "reports", "incidents", "team", "analytics"].includes(surface) ? (
        <InlineMessage tone="warning">This jobsite surface is still being prepared.</InlineMessage>
      ) : null}
    </SectionCard>
  );
}

export function OverviewWidgets({
  payload,
  onReload,
}: {
  payload: Record<string, unknown> | null;
  onReload: () => void;
}) {
  const jobsite = (payload?.jobsite as JobsiteRow | undefined) ?? null;
  const overview = (payload?.overview as Record<string, unknown> | undefined) ?? {};
  const widgets = (payload?.widgets as Record<string, unknown> | undefined) ?? {};
  const emergencyActionPlan = (payload?.emergencyActionPlan as Record<string, unknown> | undefined) ?? {};
  const topJobsiteRisks = ((payload?.topJobsiteRisks as JobsiteTopRisk[] | undefined) ?? []).slice(0, 10);
  const incidents = (widgets.recentIncidents as Array<Record<string, unknown>> | undefined) ?? [];
  const links = (payload?.links as Record<string, string> | undefined) ?? {};
  const payloadUsers = payload?.users;
  const employeeOptions = useMemo(
    () => buildEmployeeOptions(((payloadUsers as TeamUserRow[] | undefined) ?? []) as TeamUserRow[]),
    [payloadUsers]
  );
  const jobsiteId = String(jobsite?.id ?? "");
  const [editing, setEditing] = useState(false);
  const eapReadiness = String(emergencyActionPlan.readiness ?? "needs_review") as EmergencyActionPlanReadiness;
  const eapMissingFields = ((emergencyActionPlan.missingFields as Array<{ label?: string; severity?: string }> | undefined) ?? []);
  const launchReadiness =
    (payload?.launchReadiness as JobsiteLaunchReadiness | undefined) ??
    fallbackLaunchReadiness(links, eapReadiness);
  const cards = [
    { label: "Work Planned Today", value: Number(widgets.workPlannedToday ?? 0) },
    { label: "Active Permits", value: Number(widgets.activePermits ?? 0) },
    { label: "Open Observations", value: Number(widgets.openObservations ?? 0) },
    { label: "High-Risk Items", value: Number(widgets.highRiskItems ?? 0) },
    { label: "SIF Exposures", value: Number(widgets.sifExposures ?? 0) },
    { label: "Positive Observations", value: Number(widgets.positiveObservations ?? 0) },
    { label: "Closed Today", value: Number(widgets.closedToday ?? 0) },
    { label: "Recent Incidents", value: incidents.length },
  ];
  const functionLinks = [
    {
      href: links.emergencyActionPlan ?? `/jobsites/${encodeURIComponent(jobsiteId)}/emergency-action-plan`,
      title: "Emergency Action Plan",
      detail: `${emergencyActionPlanStatusLabel(eapReadiness)}${eapMissingFields.length > 0 ? ` - ${eapMissingFields.length} item${eapMissingFields.length === 1 ? "" : "s"} need review` : ""}`,
      action: "Open EAP",
    },
    {
      href: links.team ?? `/jobsites/${encodeURIComponent(jobsiteId)}/team`,
      title: "Team",
      detail: `${Number(overview.users ?? 0)} company user${Number(overview.users ?? 0) === 1 ? "" : "s"} in scope`,
      action: "Manage people",
    },
    {
      href: `/jobsites/${encodeURIComponent(jobsiteId)}/contractor-training`,
      title: "Contractor Training",
      detail: "Add contractor employees, send QR intake links, and track site-specific training",
      action: "Open matrix",
    },
    {
      href: links.jsa ?? `/jobsites/${encodeURIComponent(jobsiteId)}/jsa`,
      title: "JSA",
      detail: `${Number(overview.jsas ?? 0)} JSA record${Number(overview.jsas ?? 0) === 1 ? "" : "s"} for this site`,
      action: "Open JSA",
    },
    {
      href: `/jobsites/${encodeURIComponent(jobsiteId)}/schedule`,
      title: "Work Schedule",
      detail: "Plan upcoming high-risk work and feed the predictive model",
      action: "Open work schedule",
    },
    {
      href: links.permits ?? `/jobsites/${encodeURIComponent(jobsiteId)}/permits`,
      title: "Permits",
      detail: `${Number(overview.permits ?? 0)} permit record${Number(overview.permits ?? 0) === 1 ? "" : "s"}`,
      action: "Open permits",
    },
    {
      href: links.documents ?? `/jobsites/${encodeURIComponent(jobsiteId)}/documents`,
      title: "Documents",
      detail: `${Number(overview.documents ?? 0)} linked document${Number(overview.documents ?? 0) === 1 ? "" : "s"}`,
      action: "Open documents",
    },
    {
      href: links.liveView ?? `/jobsites/${encodeURIComponent(jobsiteId)}/live-view`,
      title: "Live View",
      detail: `${Number(overview.observations ?? 0)} observation${Number(overview.observations ?? 0) === 1 ? "" : "s"} and live field signals`,
      action: "Open live view",
    },
    {
      href: links.incidents ?? `/jobsites/${encodeURIComponent(jobsiteId)}/incidents`,
      title: "Incidents",
      detail: `${Number(overview.incidents ?? 0)} incident record${Number(overview.incidents ?? 0) === 1 ? "" : "s"}`,
      action: "Open incidents",
    },
    {
      href: links.reports ?? `/jobsites/${encodeURIComponent(jobsiteId)}/reports`,
      title: "Reports",
      detail: `${Number(overview.reports ?? 0)} report${Number(overview.reports ?? 0) === 1 ? "" : "s"} for this site`,
      action: "Open reports",
    },
    {
      href: links.analytics ?? `/jobsites/${encodeURIComponent(jobsiteId)}/analytics`,
      title: "Analytics",
      detail: "Review jobsite trends, safety signals, and operational performance",
      action: "Open analytics",
    },
    {
      href: `/jobsites/${encodeURIComponent(jobsiteId)}/safety-forms`,
      title: "Safety Forms",
      detail: "Open site inspections, checklists, and form submissions",
      action: "Open forms",
    },
    {
      href: `/jobsites/${encodeURIComponent(jobsiteId)}/toolbox`,
      title: "Toolbox",
      detail: "Plan and review toolbox sessions for this jobsite",
      action: "Open toolbox",
    },
    {
      href: `/jobsites/${encodeURIComponent(jobsiteId)}/inductions`,
      title: "Inductions",
      detail: "Manage site orientations and induction readiness",
      action: "Open inductions",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-slate-700/80 bg-[#07111f] shadow-[0_24px_60px_rgba(2,6,23,0.34)]">
        <div className="border-b border-slate-700/70 bg-[linear-gradient(90deg,#06101f_0%,#0b2341_54%,#123a5f_100%)] p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-100">
                  Mission Control
                </span>
                <StatusBadge label={launchStatusLabel(launchReadiness.status)} tone={launchBadgeTone(launchReadiness.status)} />
                <StatusBadge label={labelize(jobsite?.status ?? "active")} tone="info" />
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                {jobsite?.name ?? "Jobsite"}
              </h2>
              <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-sky-100/80">
                {launchReadiness.headline}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {jobsite?.jobsite_number ? <StatusBadge label={`Jobsite ${jobsite.jobsite_number}`} tone="success" /> : null}
                {jobsite?.project_number ? <StatusBadge label={jobsite.project_number} tone="info" /> : null}
                {jobsite?.location ? <StatusBadge label={jobsite.location} tone="neutral" /> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 xl:justify-end">
              <button type="button" onClick={() => setEditing((current) => !current)} className="inline-flex items-center justify-center rounded-xl border border-white/18 bg-white/10 px-4 py-2.5 text-sm font-bold text-sky-50 transition hover:bg-white/16">
                {editing ? "Close Editor" : "Edit Jobsite Info"}
              </button>
              <Link href={`/jobsites/${encodeURIComponent(jobsiteId)}/contractor-training`} className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-[0_14px_28px_rgba(14,165,233,0.25)] transition hover:bg-sky-400">
                Contractor Training
              </Link>
              <Link href={`/jobsites/${encodeURIComponent(jobsiteId)}/live-view`} className="inline-flex items-center justify-center rounded-xl border border-white/18 bg-white px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-sky-50">
                Live View
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.45fr)]">
          <div className={`border-b border-slate-700/70 p-5 sm:p-6 xl:border-b-0 xl:border-r ${launchPanelClass(launchReadiness.status)}`}>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Launch Readiness</div>
            <div className="mt-4 flex items-end gap-4">
              <div className="text-6xl font-black leading-none tracking-tight text-white sm:text-7xl">
                {launchStatusLabel(launchReadiness.status)}
              </div>
              <div className="pb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                {launchReadiness.criticalCount} hold / {launchReadiness.warningCount} review
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-slate-700/80 bg-slate-950/55 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Primary blocker</div>
              <p className="mt-2 text-base font-black leading-6 text-slate-100">{launchReadiness.primaryBlocker}</p>
              <div className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Next action</div>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{launchReadiness.nextAction}</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <FieldCard label="Project manager" value={jobsite?.project_manager ?? "Not assigned"} />
              <FieldCard label="Safety lead" value={jobsite?.safety_lead ?? "Not assigned"} />
              <FieldCard label="Location" value={jobsite?.location ?? "No location listed"} />
              <FieldCard label="Project number" value={jobsite?.project_number ?? "Not assigned"} />
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Operational Stations</div>
                <h3 className="mt-1 text-xl font-black text-slate-100">Maintain the jobsite for launch</h3>
              </div>
              <StatusBadge label="Station checks are conservative" tone="info" />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {launchReadiness.stations.map((station) => (
                <Link
                  key={station.id}
                  href={station.href ?? `/jobsites/${encodeURIComponent(jobsiteId)}/overview`}
                  className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-sky-500/55 ${launchPanelClass(station.status)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{station.label}</div>
                      <p className="mt-2 text-sm font-black leading-5 text-slate-100">{station.summary}</p>
                    </div>
                    <StatusBadge label={launchStatusLabel(station.status)} tone={launchBadgeTone(station.status)} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs font-semibold leading-5 text-slate-400">{station.detail}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {editing && jobsite ? (
        <JobsiteInfoEditor
          jobsite={jobsite}
          employeeOptions={employeeOptions}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onReload();
          }}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Emergency Action Plan
              </div>
              <h3 className="mt-2 text-xl font-black tracking-tight text-slate-100">
                {emergencyActionPlanStatusLabel(eapReadiness)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Emergency contacts, responder access, muster, AED / first aid, and nearest medical resource details.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={emergencyActionPlanStatusLabel(eapReadiness)} tone={emergencyReadinessTone(eapReadiness)} />
              {Boolean(emergencyActionPlan.reviewStale) ? <StatusBadge label="Review stale" tone="warning" /> : null}
              {Boolean(emergencyActionPlan.immediateReviewNeeded) ? <StatusBadge label="Immediate review needed" tone="error" /> : null}
            </div>
          </div>
          {eapMissingFields.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {eapMissingFields.slice(0, 4).map((field, index) => (
                <StatusBadge
                  key={`${field.label ?? "missing"}-${index}`}
                  label={field.label ?? "Missing EAP field"}
                  tone={field.severity === "critical" ? "error" : "warning"}
                />
              ))}
              {eapMissingFields.length > 4 ? <StatusBadge label={`+${eapMissingFields.length - 4} more`} tone="warning" /> : null}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/jobsites/${encodeURIComponent(jobsiteId)}/emergency-action-plan`} className={appButtonPrimaryClassName}>
              Open Emergency Action Plan
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Today&apos;s Telemetry</div>
              <h3 className="mt-2 text-lg font-bold text-slate-100">Operational Metrics</h3>
            </div>
            <StatusBadge label="Live overview" tone="info" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <div key={card.label} className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-4">
                <div className="text-xs text-slate-500">{card.label}</div>
                <div className="mt-2 text-3xl font-black text-slate-100">{card.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
              Site Risk Board
            </div>
            <h3 className="mt-2 text-lg font-bold text-slate-100">Top 10 Jobsite Risks</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Ranked from live jobsite records, scheduled work, permits, incidents, and field observations.
            </p>
          </div>
          <StatusBadge
            label={topJobsiteRisks.some((risk) => risk.riskLevel === "critical") ? "Immediate review needed" : "Dynamic watchlist"}
            tone={topJobsiteRisks.some((risk) => risk.riskLevel === "critical") ? "error" : "info"}
          />
        </div>
        <div className="mt-5 divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/50">
          {topJobsiteRisks.map((risk) => (
            <article key={risk.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-black text-slate-300">
                    {risk.rank}
                  </span>
                  <h4 className="text-sm font-bold text-slate-100">{risk.title}</h4>
                  <StatusBadge label={topRiskLabel(risk.riskLevel)} tone={topRiskTone(risk.riskLevel)} />
                  <StatusBadge
                    label={risk.evidenceCount > 0 ? `${risk.evidenceCount} signal${risk.evidenceCount === 1 ? "" : "s"}` : "No active signal yet"}
                    tone={risk.evidenceCount > 0 ? "warning" : "neutral"}
                  />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Top drivers</div>
                    <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-400">
                      {risk.topDrivers.slice(0, 3).map((driver, index) => (
                        <li key={`${risk.id}-driver-${index}`}>{driver}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Next action</div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">{risk.nextAction}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Score</div>
                <div className="mt-1 text-2xl font-black text-slate-100">{risk.score}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {risk.sources.length > 0 ? (
                    risk.sources.slice(0, 3).map((source) => (
                      <StatusBadge key={`${risk.id}-${source.type}`} label={`${sourceLabel(source.type)} ${source.count}`} tone="neutral" />
                    ))
                  ) : (
                    <StatusBadge label="Baseline watchlist" tone="neutral" />
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Jobsite Functions</h3>
            <p className="mt-1 text-sm text-slate-500">
              Open the tools, records, and workflows scoped to this jobsite.
            </p>
          </div>
          <Link href="/jobsites" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
            Back to all jobsites
          </Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {functionLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 transition hover:-translate-y-0.5 hover:border-sky-500/60 hover:bg-slate-950"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-slate-100">{item.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.detail}</p>
                </div>
                <span className="shrink-0 rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-sky-300 transition group-hover:bg-sky-950/50">
                  Open
                </span>
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {item.action}
              </p>
            </Link>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-4">
        <h3 className="text-sm font-semibold text-slate-100">Recent Incidents</h3>
        {incidents.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No recent incidents for this jobsite.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {incidents.map((incident, index) => (
              <div key={String(incident.id ?? index)} className="rounded-lg border border-slate-700/80 bg-slate-950/50 px-3 py-2 text-sm">
                <div className="font-medium text-slate-200">{String(incident.title ?? "Incident")}</div>
                <div className="text-xs text-slate-500">
                  {labelize(String(incident.status ?? "open"))} · {formatDateTime(
                    typeof incident.created_at === "string" ? incident.created_at : null
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function JobsiteInfoEditor({
  jobsite,
  employeeOptions,
  onCancel,
  onSaved,
}: {
  jobsite: JobsiteRow;
  employeeOptions: EmployeeOption[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => ({
    name: jobsite.name ?? "",
    jobsiteNumber: jobsite.jobsite_number ?? "",
    projectNumber: jobsite.project_number ?? "",
    location: jobsite.location ?? "",
    status: String(jobsite.status ?? "active").toLowerCase(),
    projectManager: jobsite.project_manager ?? "",
    safetyLead: jobsite.safety_lead ?? "",
    zipCode: jobsite.zip_code ?? "",
    addressLine1: jobsite.weather_address_line_1 ?? "",
    addressLine2: jobsite.weather_address_line_2 ?? "",
    city: jobsite.weather_city ?? "",
    state: jobsite.weather_state ?? "",
    country: jobsite.weather_country ?? "US",
    startDate: jobsite.start_date ?? "",
    endDate: jobsite.end_date ?? "",
    notes: jobsite.notes ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error">("success");

  function updateForm(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveJobsite() {
    if (!jobsite.id) return;
    if (!form.name.trim() || !form.jobsiteNumber.trim()) {
      setMessageTone("warning");
      setMessage("Jobsite name and jobsite number are required.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(`/api/company/jobsites/${encodeURIComponent(jobsite.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(session?.access_token),
        },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!response.ok) {
        setMessageTone("error");
        setMessage(payload?.error || "Failed to save jobsite information.");
        return;
      }
      setMessageTone("success");
      setMessage(payload?.message || "Jobsite information saved.");
      onSaved();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to save jobsite information.");
    } finally {
      setSaving(false);
    }
  }

  const inputClassName =
    "mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3.5 py-2.5 text-sm font-medium text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20";
  const selectClassName = `${appNativeSelectClassName} mt-2 w-full border-slate-700 bg-slate-950/60 text-slate-100`;
  const labelClassName = "text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500";
  const currentProjectManagerMissing = form.projectManager && !employeeOptions.some((employee) => employee.name === form.projectManager);
  const currentSafetyLeadMissing = form.safetyLead && !employeeOptions.some((employee) => employee.name === form.safetyLead);

  return (
    <div className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-100">Edit Jobsite Information</h3>
          <p className="mt-1 text-sm text-slate-400">Update the address, project contacts, schedule, and site notes used across this workspace.</p>
        </div>
        <StatusBadge label={labelize(form.status)} tone={form.status === "archived" ? "neutral" : "success"} />
      </div>
      {message ? <div className="mt-4"><InlineMessage tone={messageTone}>{message}</InlineMessage></div> : null}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className={labelClassName}>
          Jobsite Name
          <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} className={inputClassName} />
        </label>
        <label className={labelClassName}>
          Jobsite Number
          <input value={form.jobsiteNumber} onChange={(event) => updateForm("jobsiteNumber", event.target.value)} className={inputClassName} />
        </label>
        <label className={labelClassName}>
          Project Number
          <input value={form.projectNumber} onChange={(event) => updateForm("projectNumber", event.target.value)} className={inputClassName} />
        </label>
        <label className={labelClassName}>
          General Location
          <input value={form.location} onChange={(event) => updateForm("location", event.target.value)} placeholder="City, project campus, or short address" className={inputClassName} />
        </label>
        <label className={labelClassName}>
          Project Manager
          <select value={form.projectManager} onChange={(event) => updateForm("projectManager", event.target.value)} className={selectClassName}>
            <option value="">{employeeOptions.length ? "Select employee" : "No employees available"}</option>
            {currentProjectManagerMissing ? <option value={form.projectManager}>{form.projectManager}</option> : null}
            {employeeOptions.map((employee) => (
              <option key={`project-manager-${employee.id}`} value={employee.name}>
                {[employee.name, employee.role].filter(Boolean).join(" - ")}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClassName}>
          Safety Lead
          <select value={form.safetyLead} onChange={(event) => updateForm("safetyLead", event.target.value)} className={selectClassName}>
            <option value="">{employeeOptions.length ? "Select employee" : "No employees available"}</option>
            {currentSafetyLeadMissing ? <option value={form.safetyLead}>{form.safetyLead}</option> : null}
            {employeeOptions.map((employee) => (
              <option key={`safety-lead-${employee.id}`} value={employee.name}>
                {[employee.name, employee.role].filter(Boolean).join(" - ")}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClassName}>
          Street Address
          <input value={form.addressLine1} onChange={(event) => updateForm("addressLine1", event.target.value)} className={inputClassName} />
        </label>
        <label className={labelClassName}>
          Address Line 2
          <input value={form.addressLine2} onChange={(event) => updateForm("addressLine2", event.target.value)} className={inputClassName} />
        </label>
        <label className={labelClassName}>
          City
          <input value={form.city} onChange={(event) => updateForm("city", event.target.value)} className={inputClassName} />
        </label>
        <label className={labelClassName}>
          State
          <input value={form.state} onChange={(event) => updateForm("state", event.target.value.toUpperCase())} className={inputClassName} />
        </label>
        <label className={labelClassName}>
          ZIP Code
          <input value={form.zipCode} onChange={(event) => updateForm("zipCode", event.target.value)} className={inputClassName} />
        </label>
        <label className={labelClassName}>
          Status
          <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} className={selectClassName}>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className={labelClassName}>
          Start Date
          <input type="date" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} className={inputClassName} />
        </label>
        <label className={labelClassName}>
          End Date
          <input type="date" value={form.endDate} onChange={(event) => updateForm("endDate", event.target.value)} className={inputClassName} />
        </label>
        <label className={`${labelClassName} md:col-span-2 xl:col-span-3`}>
          Site Notes
          <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} rows={4} className={inputClassName} />
        </label>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className={appButtonSecondaryClassName}>
          Cancel
        </button>
        <button type="button" onClick={() => void saveJobsite()} disabled={saving} className={`${appButtonPrimaryClassName} ${saving ? "cursor-not-allowed opacity-60" : ""}`}>
          {saving ? "Saving..." : "Save Jobsite"}
        </button>
      </div>
    </div>
  );
}

function PermitSurface({ payload }: { payload: Record<string, unknown> | null }) {
  const jobsite = (payload?.jobsite as JobsiteRow | undefined) ?? null;
  const permits = ((payload?.permits as Array<PermitRow> | undefined) ?? []) as PermitRow[];
  const counts = {
    total: permits.length,
    active: permits.filter((permit) => permit.status === "active").length,
    stopWork: permits.filter((permit) => permit.stop_work_status === "stop_work_active").length,
    sif: permits.filter((permit) => permit.sif_flag).length,
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total permits" value={counts.total} />
        <StatCard label="Active" value={counts.active} />
        <StatCard label="Stop work" value={counts.stopWork} />
        <StatCard label="SIF" value={counts.sif} />
      </div>

      <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-4">
        <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Jobsite</div>
        <div className="mt-1 text-sm font-semibold text-slate-100">{jobsite?.name ?? "Unknown jobsite"}</div>
        <div className="mt-1 text-xs text-slate-500">
          {jobsite?.project_number ? `${jobsite.project_number} · ` : ""}
          {jobsite?.location ?? "No location listed"}
        </div>
      </div>

      {permits.length === 0 ? (
        <InlineMessage tone="warning">No permits have been created for this jobsite yet.</InlineMessage>
      ) : (
        <div className="space-y-3">
          {permits.map((permit) => (
            <div key={permit.id} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-100">{permit.title}</div>
                  <div className="text-xs text-slate-500">
                    {labelize(permit.permit_type)} · {labelize(permit.category)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    label={permit.status}
                    tone={permit.status === "active" ? "success" : permit.status === "closed" ? "neutral" : "info"}
                  />
                  <StatusBadge
                    label={permit.escalation_level}
                    tone={permit.escalation_level === "critical" ? "warning" : "info"}
                  />
                  <StatusBadge
                    label={permit.stop_work_status}
                    tone={permit.stop_work_status === "stop_work_active" || permit.stop_work_status === "stop_work_requested" ? "warning" : "neutral"}
                  />
                  {permit.sif_flag ? <StatusBadge label="SIF" tone="warning" /> : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <FieldCard label="Severity" value={labelize(permit.severity)} />
                <FieldCard label="Due" value={formatDateTime(permit.due_at)} />
                <FieldCard label="Owner" value={permit.owner_user_id ?? "Not assigned"} />
                <FieldCard label="Created" value={formatDateTime(permit.created_at)} />
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldCard label="Linked JSA activity" value={permit.dap_activity_id ?? "Not linked"} />
                  <FieldCard label="Linked observation" value={permit.observation_id ?? "Not linked"} />
                  <FieldCard label="Updated" value={formatDateTime(permit.updated_at)} />
                  <FieldCard label="Jobsite scope" value={jobsite?.location ?? "No location listed"} />
                </div>
                <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Control notes</div>
                  <div className="mt-2 space-y-2 text-sm text-slate-300">
                    <p>Escalation reason: {permit.escalation_reason ?? "Not provided"}</p>
                    <p>Stop work reason: {permit.stop_work_reason ?? "Not provided"}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentsSurface({ payload, jobsiteId }: { payload: Record<string, unknown> | null; jobsiteId: string }) {
  const jobsite = (payload?.jobsite as JobsiteRow | undefined) ?? null;
  const documents = surfaceRows(payload, "documents");
  const ready = documents.filter((doc) => rowText(doc, ["final_file_path", "file_path", "public_url"], "")).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Scoped documents" value={documents.length} />
        <StatCard label="Ready files" value={ready} />
        <StatCard label="Pending review" value={documents.filter((doc) => rowText(doc, ["status"], "").toLowerCase().includes("review")).length} />
        <StatCard label="Jobsite records" value={documents.length} />
      </div>

      <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-4">
        <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Jobsite</div>
        <div className="mt-1 text-sm font-semibold text-slate-100">{jobsite?.name ?? "Unknown jobsite"}</div>
        <div className="mt-1 text-xs text-slate-500">
          {jobsite?.project_number ? `${jobsite.project_number} · ` : ""}
          {jobsite?.location ?? "No location listed"}
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 p-6">
          <h3 className="text-base font-bold text-slate-100">No documents linked to this jobsite yet.</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Documents appear here when their project name matches this jobsite. Upload or generate a document and assign it to this project to keep the site file organized.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/upload" className={appButtonPrimaryClassName}>Upload document</Link>
            <Link href={`/jobsites/${encodeURIComponent(jobsiteId)}/reports`} className={appButtonSecondaryClassName}>View reports</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc, index) => {
            const id = rowText(doc, ["id"], `document-${index}`);
            const filePath = rowText(doc, ["final_file_path", "file_path"], "");
            return (
              <article key={id} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      {rowText(doc, ["title", "name", "document_title"], "Untitled document")}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {rowText(doc, ["document_type", "category", "type"], "Document")} · Updated {rowDate(doc, ["updated_at", "created_at"])}
                    </p>
                  </div>
                  <StatusBadge label={labelize(rowText(doc, ["status"], "available"))} tone="info" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <FieldCard label="Project" value={rowText(doc, ["project_name"], jobsite?.name ?? "Not assigned")} />
                  <FieldCard label="Owner" value={rowText(doc, ["owner_name", "submitted_by", "user_id"])} />
                  <FieldCard label="Created" value={rowDate(doc, ["created_at"])} />
                  <FieldCard label="File" value={filePath ? "Available" : "Not uploaded"} />
                </div>
                {filePath || id ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/api/documents/download/${encodeURIComponent(id)}`}
                      className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-sky-500/40"
                    >
                      Download
                    </Link>
                    <Link
                      href="/documents"
                      className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-sky-500/40"
                    >
                      Open documents
                    </Link>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportsSurface({ payload }: { payload: Record<string, unknown> | null }) {
  const jobsite = (payload?.jobsite as JobsiteRow | undefined) ?? null;
  const reports = surfaceRows(payload, "reports");
  const published = reports.filter((report) => rowText(report, ["status"], "").toLowerCase() === "published").length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Reports" value={reports.length} />
        <StatCard label="Published" value={published} />
        <StatCard label="Drafts" value={reports.filter((report) => rowText(report, ["status"], "").toLowerCase() === "draft").length} />
        <StatCard label="Generated" value={reports.filter((report) => rowText(report, ["generated_at"], "")).length} />
      </div>
      {reports.length === 0 ? (
        <InlineMessage tone="warning">No reports have been generated for {jobsite?.name ?? "this jobsite"} yet.</InlineMessage>
      ) : (
        <div className="space-y-3">
          {reports.map((report, index) => (
            <article key={rowText(report, ["id"], `report-${index}`)} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{rowText(report, ["title"], "Untitled report")}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {labelize(rowText(report, ["report_type"], "report"))} · {labelize(rowText(report, ["source_module"], "workspace"))}
                  </p>
                </div>
                <StatusBadge
                  label={labelize(rowText(report, ["status"], "draft"))}
                  tone={rowText(report, ["status"], "").toLowerCase() === "published" ? "success" : "info"}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <FieldCard label="Generated" value={rowDate(report, ["generated_at", "created_at"])} />
                <FieldCard label="Updated" value={rowDate(report, ["updated_at"])} />
                <FieldCard label="File" value={rowText(report, ["file_path"], "Not exported")} />
                <FieldCard label="Jobsite" value={jobsite?.name ?? "Scoped jobsite"} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function IncidentsSurface({ payload }: { payload: Record<string, unknown> | null }) {
  const incidents = surfaceRows(payload, "incidents");
  const open = incidents.filter((incident) => rowText(incident, ["status"], "").toLowerCase() !== "closed").length;
  const sif = incidents.filter((incident) => rowText(incident, ["sif_flag", "sif_potential"], "") === "Yes").length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Incidents" value={incidents.length} />
        <StatCard label="Open" value={open} />
        <StatCard label="Closed" value={incidents.length - open} />
        <StatCard label="SIF flagged" value={sif} />
      </div>
      {incidents.length === 0 ? (
        <InlineMessage tone="warning">No incidents or near misses are recorded for this jobsite.</InlineMessage>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident, index) => (
            <article key={rowText(incident, ["id"], `incident-${index}`)} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{rowText(incident, ["title"], "Incident")}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {labelize(rowText(incident, ["incident_type", "category"], "incident"))} · {labelize(rowText(incident, ["severity"], "not set"))}
                  </p>
                </div>
                <StatusBadge label={labelize(rowText(incident, ["status"], "open"))} tone={rowText(incident, ["status"], "").toLowerCase() === "closed" ? "neutral" : "warning"} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <FieldCard label="Occurred" value={rowDate(incident, ["occurred_at", "created_at"])} />
                <FieldCard label="Escalation" value={labelize(rowText(incident, ["escalation_level"], "none"))} />
                <FieldCard label="Stop work" value={labelize(rowText(incident, ["stop_work_status"], "normal"))} />
                <FieldCard label="Updated" value={rowDate(incident, ["updated_at"])} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamSurface({
  payload,
  jobsiteId,
  onReload,
}: {
  payload: Record<string, unknown> | null;
  jobsiteId: string;
  onReload: () => void;
}) {
  const users = ((payload?.users as TeamUserRow[] | undefined) ?? []).filter(Boolean);
  const assignments = ((payload?.assignments as JobsiteAssignmentRow[] | undefined) ?? []).filter(Boolean);
  const [assignmentMap, setAssignmentMap] = useState<Record<string, string[]>>({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error">("success");

  useEffect(() => deferEffect(() => {
    const next: Record<string, string[]> = {};
    for (const assignment of assignments) {
      const userId = assignment.user_id ?? "";
      const assignedJobsiteId = assignment.jobsite_id ?? "";
      if (!userId || !assignedJobsiteId) continue;
      next[userId] = next[userId] ? [...next[userId], assignedJobsiteId] : [assignedJobsiteId];
    }
    setAssignmentMap(next);
  }), [assignments]);

  const usersWithAccess = useMemo(
    () =>
      users.filter((user) => {
        const role = user.role ?? "";
        if (!roleNeedsJobsiteAssignment(role)) return true;
        return (assignmentMap[user.id ?? ""] ?? []).includes(jobsiteId);
      }),
    [assignmentMap, jobsiteId, users]
  );

  const fieldScopedUsers = useMemo(
    () => users.filter((user) => roleNeedsJobsiteAssignment(user.role)),
    [users]
  );
  const assignedFieldUsers = fieldScopedUsers.filter((user) =>
    (assignmentMap[user.id ?? ""] ?? []).includes(jobsiteId)
  );

  async function toggleJobsiteAssignment(user: TeamUserRow) {
    const userId = user.id ?? "";
    if (!userId) return;
    const currentAssignments = assignmentMap[userId] ?? [];
    const assigned = currentAssignments.includes(jobsiteId);
    const nextAssignments = assigned
      ? currentAssignments.filter((id) => id !== jobsiteId)
      : Array.from(new Set([...currentAssignments, jobsiteId]));

    setBusyUserId(userId);
    setMessage("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch("/api/company/jobsite-assignments", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(session?.access_token),
        },
        body: JSON.stringify({ userId, jobsiteIds: nextAssignments }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to update jobsite assignments.");
        return;
      }
      setAssignmentMap((current) => ({ ...current, [userId]: nextAssignments }));
      setMessageTone("success");
      setMessage(assigned ? `${user.name ?? "User"} removed from this jobsite.` : `${user.name ?? "User"} assigned to this jobsite.`);
      onReload();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to update jobsite assignments.");
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Visible users" value={usersWithAccess.length} />
        <StatCard label="Assigned field users" value={assignedFieldUsers.length} />
        <StatCard label="Company-wide roles" value={users.filter((user) => !roleNeedsJobsiteAssignment(user.role)).length} />
        <StatCard label="Assignable users" value={fieldScopedUsers.length} />
      </div>
      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}
      {users.length === 0 ? (
        <InlineMessage tone="warning">No team members are visible for this jobsite.</InlineMessage>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {users.map((user, index) => (
            <article key={user.id ?? `user-${index}`} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <h3 className="text-sm font-semibold text-slate-100">{user.name || user.email || "Team member"}</h3>
              <p className="mt-1 text-xs text-slate-500">{user.email || "No email listed"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge label={labelize(user.role || "member")} tone="info" />
                <StatusBadge label={labelize(user.status || "active")} tone={String(user.status ?? "").toLowerCase() === "suspended" ? "warning" : "success"} />
                <StatusBadge
                  label={
                    roleNeedsJobsiteAssignment(user.role)
                      ? (assignmentMap[user.id ?? ""] ?? []).includes(jobsiteId)
                        ? "Assigned"
                        : "Not Assigned"
                      : "Company-Wide"
                  }
                  tone={
                    !roleNeedsJobsiteAssignment(user.role) || (assignmentMap[user.id ?? ""] ?? []).includes(jobsiteId)
                      ? "success"
                      : "warning"
                  }
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {roleNeedsJobsiteAssignment(user.role) ? (
                  <button
                    type="button"
                    onClick={() => void toggleJobsiteAssignment(user)}
                    disabled={busyUserId === user.id}
                    className={(assignmentMap[user.id ?? ""] ?? []).includes(jobsiteId) ? appButtonQuietClassName : appButtonPrimaryClassName}
                  >
                    {busyUserId === user.id
                      ? "Saving..."
                      : (assignmentMap[user.id ?? ""] ?? []).includes(jobsiteId)
                        ? "Remove From Site"
                        : "Assign To Site"}
                  </button>
                ) : (
                  <Link href="/company-users" className={appButtonSecondaryClassName}>
                    Manage Access
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4">
        <h3 className="text-sm font-semibold text-slate-100">Assignment Notes</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Field-scoped users only see jobsites they are assigned to. Company admins, operations managers, and safety managers keep company-wide access.
        </p>
        <div className="mt-4">
          <Link href="/company-users" className={appButtonSecondaryClassName}>
            Open Full User Directory
          </Link>
        </div>
      </div>
    </div>
  );
}

function AnalyticsSurface({ payload }: { payload: Record<string, unknown> | null }) {
  const analytics = ((payload?.analytics as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
  const riskRows = ((analytics.jobsiteRiskScore as SurfaceRow[] | undefined) ?? []) as SurfaceRow[];
  const currentRisk = riskRows[0];
  const cards = [
    { label: "Risk score rows", value: riskRows.length },
    { label: "Open findings", value: Number(analytics.openDeficiencies ?? analytics.openFindings ?? 0) },
    { label: "Incidents", value: Number(analytics.incidents ?? analytics.incidentCount ?? 0) },
    { label: "Permits", value: Number(analytics.permits ?? analytics.permitCount ?? 0) },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <StatCard key={card.label} label={card.label} value={Number.isFinite(card.value) ? card.value : 0} />)}
      </div>
      {currentRisk ? (
        <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Current jobsite risk signal</h3>
              <p className="mt-1 text-xs text-slate-500">Latest scoped analytics result for this project.</p>
            </div>
            <StatusBadge label={rowText(currentRisk, ["riskLevel", "risk_level", "level"], "Risk tracked")} tone="warning" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FieldCard label="Score" value={rowText(currentRisk, ["score", "riskScore", "risk_score"], "Not scored")} />
            <FieldCard label="Trend" value={rowText(currentRisk, ["trend"], "Not set")} />
            <FieldCard label="Drivers" value={rowText(currentRisk, ["drivers", "topDriver"], "Not listed")} />
            <FieldCard label="Updated" value={rowDate(currentRisk, ["updated_at", "created_at"])} />
          </div>
        </div>
      ) : (
        <InlineMessage tone="warning">No analytics rows are available for this jobsite yet.</InlineMessage>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-black text-slate-100">{value}</div>
    </div>
  );
}

function FieldCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}
