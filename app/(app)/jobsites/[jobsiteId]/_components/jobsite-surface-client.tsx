"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useEffect, useState } from "react";
import { InlineMessage, SectionCard, StatusBadge } from "@/components/WorkspacePrimitives";

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
  const widgets = (payload?.widgets as Record<string, unknown> | undefined) ?? {};
  const incidents = (widgets.recentIncidents as Array<Record<string, unknown>> | undefined) ?? [];
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

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-4">
            <div className="text-xs text-slate-500">{card.label}</div>
            <div className="mt-2 text-3xl font-black text-slate-100">{card.value}</div>
          </div>
        ))}
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
