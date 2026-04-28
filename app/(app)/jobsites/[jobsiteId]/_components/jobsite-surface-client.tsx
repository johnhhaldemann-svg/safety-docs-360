"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  InlineMessage,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";

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
  project_number?: string | null;
  location?: string | null;
  status?: string;
  project_manager?: string | null;
  safety_lead?: string | null;
};

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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
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

  return (
    <SectionCard title={title} description={description}>
      {loading ? <InlineMessage>Loading...</InlineMessage> : null}
      {!loading && error ? <InlineMessage tone={errorTone}>{error}</InlineMessage> : null}
      {!loading && !error && surface === "overview" ? (
        <div className="space-y-4">
          {typeof payload?.analyticsSummaryIssue === "string" && payload.analyticsSummaryIssue.trim() ? (
            <InlineMessage tone="warning">{payload.analyticsSummaryIssue}</InlineMessage>
          ) : null}
          <OverviewWidgets payload={payload} />
        </div>
      ) : null}
      {!loading && !error && surface === "permits" ? (
        <PermitSurface payload={payload} />
      ) : null}
      {!loading && !error && surface !== "overview" && surface !== "permits" ? (
        <pre className="overflow-auto rounded-xl border border-slate-700/80 bg-slate-950/50 p-4 text-xs text-slate-300">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : null}
    </SectionCard>
  );
}

function OverviewWidgets({ payload }: { payload: Record<string, unknown> | null }) {
  const jobsite = (payload?.jobsite as JobsiteRow | undefined) ?? null;
  const overview = (payload?.overview as Record<string, unknown> | undefined) ?? {};
  const widgets = (payload?.widgets as Record<string, unknown> | undefined) ?? {};
  const incidents = (widgets.recentIncidents as Array<Record<string, unknown>> | undefined) ?? [];
  const links = (payload?.links as Record<string, string> | undefined) ?? {};
  const jobsiteId = String(jobsite?.id ?? "");
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
      <div className="rounded-3xl border border-slate-700/80 bg-slate-950/50 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
              Project Home
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-100">
              {jobsite?.name ?? "Jobsite"}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge label={labelize(jobsite?.status ?? "active")} tone="success" />
              {jobsite?.project_number ? <StatusBadge label={jobsite.project_number} tone="info" /> : null}
              {jobsite?.location ? <StatusBadge label={jobsite.location} tone="neutral" /> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/jobsites/${encodeURIComponent(jobsiteId)}/contractor-training`} className={appButtonPrimaryClassName}>
              Contractor Training
            </Link>
            <Link href={`/jobsites/${encodeURIComponent(jobsiteId)}/live-view`} className={appButtonSecondaryClassName}>
              Live View
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FieldCard label="Location" value={jobsite?.location ?? "No location listed"} />
          <FieldCard label="Project number" value={jobsite?.project_number ?? "Not assigned"} />
          <FieldCard label="Project manager" value={jobsite?.project_manager ?? "Not assigned"} />
          <FieldCard label="Safety lead" value={jobsite?.safety_lead ?? "Not assigned"} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-4">
            <div className="text-xs text-slate-500">{card.label}</div>
            <div className="mt-2 text-3xl font-black text-slate-100">{card.value}</div>
          </div>
        ))}
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
