"use client";

import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PermitCopilotPanel } from "@/components/permits/PermitCopilotPanel";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
} from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

type PermitRow = {
  id: string;
  title: string;
  permit_type: string;
  status: string;
  severity: string;
  category: string;
  jobsite_id: string | null;
  owner_user_id: string | null;
  due_at: string | null;
  sif_flag: boolean;
  escalation_level: string;
  escalation_reason: string | null;
  stop_work_status: string;
  stop_work_reason: string | null;
  dap_activity_id: string | null;
  observation_id: string | null;
  created_at: string;
  updated_at: string;
};

type JobsiteRow = {
  id: string;
  name: string;
  project_number: string | null;
  location: string | null;
  status: string;
};

type JsaActivityRow = {
  id: string;
  jsa_id: string;
  jobsite_id: string | null;
  activity_name: string;
  trade: string | null;
  area: string | null;
  permit_required: boolean | null;
  permit_type: string | null;
  planned_risk_level: string | null;
};

type PermitForm = {
  title: string;
  permitType: string;
  severity: string;
  category: string;
  jobsiteId: string;
  ownerUserId: string;
  dueAt: string;
  sifFlag: boolean;
  escalationLevel: string;
  escalationReason: string;
  stopWorkStatus: string;
  stopWorkReason: string;
  jsaActivityId: string;
  observationId: string;
};

const PERMIT_TYPES = [
  ["hot_work", "Hot Work"],
  ["confined_space", "Confined Space"],
  ["electrical", "Electrical"],
  ["excavation", "Excavation"],
  ["work_at_heights", "Work at Heights"],
  ["lockout_tagout", "Lockout / Tagout"],
] as const;
const SEVERITY_OPTIONS = ["low", "medium", "high", "critical"] as const;
const CATEGORIES = [
  ["corrective_action", "Corrective Action"],
  ["safety", "Safety"],
  ["operations", "Operations"],
  ["maintenance", "Maintenance"],
  ["environmental", "Environmental"],
] as const;
const ESCALATION_OPTIONS = ["none", "monitor", "urgent", "critical"] as const;
const STOP_WORK_OPTIONS = ["normal", "stop_work_requested", "stop_work_active", "cleared"] as const;

function buildEmptyForm(jobsiteId = ""): PermitForm {
  return {
    title: "",
    permitType: "hot_work",
    severity: "medium",
    category: "corrective_action",
    jobsiteId,
    ownerUserId: "",
    dueAt: "",
    sifFlag: false,
    escalationLevel: "none",
    escalationReason: "",
    stopWorkStatus: "normal",
    stopWorkReason: "",
    jsaActivityId: "",
    observationId: "",
  };
}

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Missing auth token.");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

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

export default function PermitsPage() {
  const searchParams = useSearchParams();
  const [permits, setPermits] = useState<PermitRow[]>([]);
  const [jobsites, setJobsites] = useState<JobsiteRow[]>([]);
  const [jsaActivities, setJsaActivities] = useState<JsaActivityRow[]>([]);
  const [form, setForm] = useState<PermitForm>(buildEmptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadData() {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const permitsQuery = statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const [permitsResponse, jobsitesResponse, activitiesResponse] = await Promise.all([
        fetch(`/api/company/permits${permitsQuery}`, { headers }),
        fetch("/api/company/jobsites", { headers }),
        fetch("/api/company/jsa-activities", { headers }),
      ]);

      const permitsData = (await permitsResponse.json().catch(() => null)) as {
        permits?: PermitRow[];
        error?: string;
        warning?: string;
      } | null;
      const jobsitesData = (await jobsitesResponse.json().catch(() => null)) as {
        jobsites?: JobsiteRow[];
        error?: string;
        warning?: string;
      } | null;
      const activitiesData = (await activitiesResponse.json().catch(() => null)) as {
        activities?: JsaActivityRow[];
        error?: string;
        warning?: string;
      } | null;

      if (!permitsResponse.ok) {
        throw new Error(permitsData?.error || permitsData?.warning || "Failed to load permits.");
      }

      setPermits(permitsData?.permits ?? []);
      setJobsites(jobsitesData?.jobsites ?? []);
      setJsaActivities(activitiesData?.activities ?? []);

      if (!jobsitesResponse.ok) {
        const warning = jobsitesData?.error || jobsitesData?.warning || "Jobsites could not be loaded.";
        setMessageTone("warning");
        setMessage(warning);
      }
      if (!activitiesResponse.ok) {
        const warning = activitiesData?.error || activitiesData?.warning || "JSA activities could not be loaded.";
        setMessageTone((current) => (current === "error" ? current : "warning"));
        setMessage(warning);
      }
    } catch (error) {
      setPermits([]);
      setJobsites([]);
      setJsaActivities([]);
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to load permits.");
    }
    setLoading(false);
  }

  useEffect(() => {
    const jsaActivityId = searchParams.get("jsaActivityId")?.trim() ?? "";
    setForm((current) => ({
      ...current,
      ...(jsaActivityId ? { jsaActivityId } : {}),
    }));
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchParams]);

  useEffect(() => {
    if (!form.jobsiteId && jobsites.length === 1) {
      setForm((current) => ({ ...current, jobsiteId: jobsites[0].id }));
    }
  }, [jobsites, form.jobsiteId]);

  const jobsiteById = useMemo(
    () => new Map(jobsites.map((jobsite) => [jobsite.id, jobsite])),
    [jobsites]
  );
  const activityById = useMemo(
    () => new Map(jsaActivities.map((activity) => [activity.id, activity])),
    [jsaActivities]
  );
  const selectedActivity = useMemo(
    () => (form.jsaActivityId ? activityById.get(form.jsaActivityId) ?? null : null),
    [form.jsaActivityId, activityById]
  );
  const selectedJobsite = useMemo(
    () => {
      const derivedJobsiteId = selectedActivity?.jobsite_id ?? "";
      if (derivedJobsiteId) {
        return jobsiteById.get(derivedJobsiteId) ?? null;
      }
      return form.jsaActivityId ? null : form.jobsiteId ? jobsiteById.get(form.jobsiteId) ?? null : null;
    },
    [form.jobsiteId, form.jsaActivityId, jobsiteById, selectedActivity?.jobsite_id]
  );
  const permitRows = useMemo(
    () =>
      permits.map((permit) => ({
        ...permit,
        jobsite: permit.jobsite_id ? jobsiteById.get(permit.jobsite_id) ?? null : null,
      })),
    [permits, jobsiteById]
  );
  const counts = useMemo(
    () => ({
      total: permits.length,
      active: permits.filter((item) => item.status === "active").length,
      stopWork: permits.filter((item) => item.stop_work_status === "stop_work_active").length,
      sif: permits.filter((item) => item.sif_flag).length,
    }),
    [permits]
  );

  useEffect(() => {
    if (!selectedActivity) return;
    setForm((current) => {
      const next: PermitForm = { ...current };
      if (selectedActivity.jobsite_id) {
        next.jobsiteId = selectedActivity.jobsite_id;
      }
      if (selectedActivity.permit_type) {
        next.permitType = selectedActivity.permit_type;
      }
      if (!current.title.trim() && selectedActivity.activity_name.trim()) {
        next.title = `${selectedActivity.activity_name} permit`;
      }
      return next;
    });
  }, [selectedActivity]);

  async function createPermit() {
    if (!form.title.trim() || !form.jsaActivityId.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const activity = activityById.get(form.jsaActivityId.trim()) ?? null;
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/permits", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: form.title,
          permitType: form.permitType,
          severity: form.severity,
          category: form.category,
          jobsiteId: form.jobsiteId || activity?.jobsite_id || null,
          ownerUserId: form.ownerUserId || null,
          dueAt: form.dueAt || null,
          sifFlag: form.sifFlag,
          escalationLevel: form.escalationLevel,
          escalationReason: form.escalationReason,
          stopWorkStatus: form.stopWorkStatus,
          stopWorkReason: form.stopWorkReason,
          jsaActivityId: form.jsaActivityId || null,
          observationId: form.observationId || null,
          status: "draft",
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to create permit.");
      setForm((current) => buildEmptyForm(current.jobsiteId));
      setMessageTone("success");
      setMessage("Permit created.");
      await loadData();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to create permit.");
    }
    setSaving(false);
  }

  async function updateRiskState(permit: PermitRow, updates: Record<string, unknown>) {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/permits", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: permit.id, ...updates }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to update permit.");
      await loadData();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to update permit.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Safety Modules"
        title="Permits"
        description="Manage permit lifecycle, SIF flags, escalation, and stop-work controls."
        actions={
          <Link href="/dashboard" className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300">
            Back to Dashboard
          </Link>
        }
      />

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4"><div className="text-xs text-slate-500">Total</div><div className="mt-2 text-3xl font-black">{counts.total}</div></div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4"><div className="text-xs text-slate-500">Active</div><div className="mt-2 text-3xl font-black">{counts.active}</div></div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4"><div className="text-xs text-slate-500">SIF Flagged</div><div className="mt-2 text-3xl font-black">{counts.sif}</div></div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4"><div className="text-xs text-slate-500">Stop Work</div><div className="mt-2 text-3xl font-black">{counts.stopWork}</div></div>
      </section>

      <SectionCard title="Create Permit" description="Capture the jobsite, controls, and risk context so the permit appears in the right board.">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label
                  htmlFor="permit-title"
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500"
                >
                  Permit title
                </label>
                <input
                  id="permit-title"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Permit title"
                  className="app-form-input"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Linked JSA step</label>
                <select
                  value={form.jsaActivityId}
                  onChange={(event) => setForm((prev) => ({ ...prev, jsaActivityId: event.target.value }))}
                  className="app-form-input"
                >
                  <option value="">Choose the JSA step that needs a permit</option>
                  {jsaActivities.map((activity) => {
                    const jobsite = activity.jobsite_id ? jobsiteById.get(activity.jobsite_id) : null;
                    return (
                      <option key={activity.id} value={activity.id}>
                        {activity.activity_name}
                        {activity.trade ? ` - ${activity.trade}` : ""}
                        {jobsite ? ` - ${jobsite.name}` : ""}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  The permit inherits its jobsite and permit type from the selected JSA step.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Permit type</label>
                <select
                  value={form.permitType}
                  onChange={(event) => setForm((prev) => ({ ...prev, permitType: event.target.value }))}
                  disabled={Boolean(selectedActivity?.permit_type)}
                  className="app-form-input disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {PERMIT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedActivity?.permit_type
                    ? "This value is inherited from the linked JSA step."
                    : "Set the permit type if the linked JSA step does not already define it."}
                </p>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Severity</label>
                <select
                  value={form.severity}
                  onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value }))}
                  className="app-form-input"
                >
                  {SEVERITY_OPTIONS.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Category</label>
                <select
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  className="app-form-input"
                >
                  {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label
                  htmlFor="permit-due-date"
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500"
                >
                  Due date
                </label>
                <input
                  id="permit-due-date"
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, dueAt: event.target.value }))}
                  className="app-form-input"
                />
              </div>
              <div>
                <label
                  htmlFor="permit-owner-user-id"
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500"
                >
                  Owner user id
                </label>
                <input
                  id="permit-owner-user-id"
                  value={form.ownerUserId}
                  onChange={(event) => setForm((prev) => ({ ...prev, ownerUserId: event.target.value }))}
                  placeholder="Optional owner user id"
                  className="app-form-input"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Escalation level</label>
                <select
                  value={form.escalationLevel}
                  onChange={(event) => setForm((prev) => ({ ...prev, escalationLevel: event.target.value }))}
                  className="app-form-input"
                >
                  {ESCALATION_OPTIONS.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Stop work status</label>
                <select
                  value={form.stopWorkStatus}
                  onChange={(event) => setForm((prev) => ({ ...prev, stopWorkStatus: event.target.value }))}
                  className="app-form-input"
                >
                  {STOP_WORK_OPTIONS.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Escalation reason</label>
                <textarea
                  value={form.escalationReason}
                  onChange={(event) => setForm((prev) => ({ ...prev, escalationReason: event.target.value }))}
                  placeholder="Why this permit should escalate, if needed"
                  className="app-form-input min-h-28"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Stop work reason</label>
                <textarea
                  value={form.stopWorkReason}
                  onChange={(event) => setForm((prev) => ({ ...prev, stopWorkReason: event.target.value }))}
                  placeholder="Why this permit should stop work, if needed"
                  className="app-form-input min-h-28"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">JSA link</label>
                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
                  <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                    {selectedActivity ? selectedActivity.activity_name : "No JSA step selected"}
                  </div>
                  <div className="mt-1 text-xs text-[var(--app-muted)]">
                    {selectedActivity
                      ? `${labelize(selectedActivity.permit_type)}${selectedActivity.trade ? ` · ${selectedActivity.trade}` : ""}${
                          selectedActivity.area ? ` · ${selectedActivity.area}` : ""
                        }`
                      : "Pick the JSA step that requires the permit."}
                  </div>
                  <div className="mt-2 text-xs text-[var(--app-muted)]">
                    {selectedActivity
                      ? `Jobsite: ${
                          selectedActivity.jobsite_id
                            ? jobsiteById.get(selectedActivity.jobsite_id)?.name ?? selectedActivity.jobsite_id
                            : "Not assigned"
                        }`
                      : "The permit cannot be saved until a JSA step is linked."}
                  </div>
                </div>
              </div>
              <div>
                <label
                  htmlFor="permit-observation-id"
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500"
                >
                  Observation id
                </label>
                <input
                  id="permit-observation-id"
                  value={form.observationId}
                  onChange={(event) => setForm((prev) => ({ ...prev, observationId: event.target.value }))}
                  placeholder="Observation id (optional)"
                  className="app-form-input"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text)]">
                <input type="checkbox" checked={form.sifFlag} onChange={(event) => setForm((prev) => ({ ...prev, sifFlag: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-[var(--app-accent-primary)]" />
                SIF flag
              </label>
              <button type="button" onClick={() => void createPermit()} disabled={saving || !form.title.trim() || !form.jsaActivityId.trim()} className="app-btn-primary rounded-xl px-4 py-2.5 text-sm disabled:opacity-60">
                {saving ? "Creating..." : "Create Permit"}
              </button>
            </div>

            <PermitCopilotPanel
              key={selectedActivity?.id ?? "no-jsa"}
              selectedActivity={selectedActivity}
              selectedJobsiteName={selectedJobsite?.name ?? null}
              currentDraft={{
                title: form.title,
                permitType: form.permitType,
                severity: form.severity,
                category: form.category,
                escalationLevel: form.escalationLevel,
                escalationReason: form.escalationReason,
                stopWorkStatus: form.stopWorkStatus,
                stopWorkReason: form.stopWorkReason,
                dueAt: form.dueAt,
                ownerUserId: form.ownerUserId,
                jsaActivityId: form.jsaActivityId,
                observationId: form.observationId,
              }}
              onApply={(patch) => setForm((current) => ({ ...current, ...patch }))}
            />
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--app-border)] bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--app-muted)]">Permit snapshot</div>
              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-xs text-[var(--app-muted)]">Jobsite</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">
                    {selectedJobsite ? selectedJobsite.name : form.jobsiteId ? "Selected jobsite" : "Company-wide / unassigned"}
                  </div>
                  {selectedJobsite ? (
                    <div className="mt-1 text-xs text-[var(--app-muted)]">
                      {selectedJobsite.project_number ? `${selectedJobsite.project_number} · ` : ""}
                      {selectedJobsite.location ?? "No location listed"}
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
                    <div className="text-xs text-[var(--app-muted)]">Type</div>
                    <div className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">{PERMIT_TYPES.find(([value]) => value === form.permitType)?.[1] ?? form.permitType}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
                    <div className="text-xs text-[var(--app-muted)]">Severity</div>
                    <div className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">{labelize(form.severity)}</div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
                    <div className="text-xs text-[var(--app-muted)]">Escalation</div>
                    <div className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">{labelize(form.escalationLevel)}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
                    <div className="text-xs text-[var(--app-muted)]">Stop work</div>
                    <div className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">{labelize(form.stopWorkStatus)}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3 text-sm text-[var(--app-text)]">
                  <div>JSA activity: {selectedActivity?.activity_name ?? "Not linked"}</div>
                  <div className="mt-1">Observation: {form.observationId.trim() || "Not linked"}</div>
                </div>
              </div>
            </div>
            <InlineMessage tone="neutral">Select a jobsite if you want the permit to show up on that jobsite board after creation.</InlineMessage>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Permit Operations" description="Track permit status and high-risk controls.">
        <div className="mb-4">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        {loading ? (
          <InlineMessage>Loading permits...</InlineMessage>
        ) : permitRows.length === 0 ? (
          <EmptyState title="No permits yet" description="Create your first permit to start high-risk controls." />
        ) : (
          <div className="space-y-3">
            {permitRows.map((permit) => (
              <div key={permit.id} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-slate-100">{permit.title}</div>
                    <div className="text-xs text-slate-500">{labelize(permit.permit_type)} · {labelize(permit.category)}</div>
                    <div className="text-xs text-slate-500">Jobsite: {permit.jobsite?.name ?? "Company-wide / unassigned"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge label={permit.status} tone={permit.status === "active" ? "success" : permit.status === "closed" ? "neutral" : "info"} />
                    <StatusBadge label={permit.escalation_level} tone={permit.escalation_level === "critical" ? "warning" : "info"} />
                    <StatusBadge label={permit.stop_work_status} tone={permit.stop_work_status === "stop_work_active" || permit.stop_work_status === "stop_work_requested" ? "warning" : "neutral"} />
                    {permit.sif_flag ? <StatusBadge label="SIF" tone="warning" /> : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Severity</div>
                    <div className="mt-1 text-sm font-semibold text-slate-100">{labelize(permit.severity)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Due</div>
                    <div className="mt-1 text-sm font-semibold text-slate-100">{formatDateTime(permit.due_at)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Owner</div>
                    <div className="mt-1 text-sm font-semibold text-slate-100">{permit.owner_user_id ?? "Not assigned"}</div>
                  </div>
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Created</div>
                    <div className="mt-1 text-sm font-semibold text-slate-100">{formatDateTime(permit.created_at)}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Linked JSA activity</div>
                      <div className="mt-1 text-sm font-semibold text-slate-100">{permit.dap_activity_id ?? "Not linked"}</div>
                    </div>
                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Linked observation</div>
                      <div className="mt-1 text-sm font-semibold text-slate-100">{permit.observation_id ?? "Not linked"}</div>
                    </div>
                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Updated</div>
                      <div className="mt-1 text-sm font-semibold text-slate-100">{formatDateTime(permit.updated_at)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Jobsite scope</div>
                      <div className="mt-1 text-sm font-semibold text-slate-100">{permit.jobsite?.location ?? "No location listed"}</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Control notes</div>
                    <div className="mt-2 space-y-2 text-sm text-slate-300">
                      <p>Escalation reason: {permit.escalation_reason ?? "Not provided"}</p>
                      <p>Stop work reason: {permit.stop_work_reason ?? "Not provided"}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void updateRiskState(permit, { status: permit.status === "active" ? "closed" : "active" })} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300">
                    {permit.status === "active" ? "Close" : "Activate"}
                  </button>
                  <button type="button" onClick={() => void updateRiskState(permit, { sifFlag: !permit.sif_flag })} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300">
                    {permit.sif_flag ? "Unset SIF" : "Set SIF"}
                  </button>
                  <button type="button" onClick={() => void updateRiskState(permit, { escalationLevel: permit.escalation_level === "none" ? "urgent" : "none" })} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300">
                    {permit.escalation_level === "none" ? "Escalate" : "Clear Escalation"}
                  </button>
                  <button type="button" onClick={() => void updateRiskState(permit, permit.stop_work_status === "stop_work_active" ? { stopWorkStatus: "cleared", stopWorkReason: "Cleared by manager." } : { stopWorkStatus: "stop_work_active", stopWorkReason: "High-risk condition detected." })} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    {permit.stop_work_status === "stop_work_active" ? "Clear Stop Work" : "Stop Work"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
