"use client";

import { deferEffect } from "@/lib/deferredEffect";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, TriangleAlert, Zap } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Card, PageHeader, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";
import { BODY_PARTS, BODY_PART_LABELS, type BodyPart } from "@/lib/incidents/bodyPart";
import {
  EXPOSURE_EVENT_TYPES,
  EXPOSURE_EVENT_TYPE_LABELS,
  type ExposureEventType,
} from "@/lib/incidents/exposureEventType";
import {
  INCIDENT_SOURCES,
  INCIDENT_SOURCE_LABELS,
  type IncidentSource,
} from "@/lib/incidents/incidentSource";
import {
  formatInjuryDayOfWeekLabel,
  INJURY_DAYS_OF_WEEK,
  INJURY_SEASON_LABELS,
  INJURY_TIME_OF_DAY_LABELS,
  type InjuryDayOfWeek,
  type InjurySeason,
  type InjuryTimeOfDay,
} from "@/lib/incidents/injuryTimePatterns";
import { INJURY_TYPES, INJURY_TYPE_LABELS, type InjuryType } from "@/lib/incidents/injuryType";
import { RiskMemoryFormFields } from "@/components/risk-memory/RiskMemoryFormFields";
import {
  EMPTY_RISK_MEMORY_FORM,
  buildRiskMemoryApiObject,
  type RiskMemoryFormInput,
} from "@/lib/riskMemory/form";
import { demoContractors, demoCrews, demoIncidentRows } from "@/lib/demoWorkspace";

const supabase = getSupabaseBrowserClient();

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Missing auth token.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function isSalesDemoRequest(headers: HeadersInit) {
  const response = await fetch("/api/auth/me", { headers });
  const data = (await response.json().catch(() => null)) as { user?: { role?: string | null } } | null;
  return response.ok && data?.user?.role === "sales_demo";
}

type IncidentRow = {
  id: string;
  title: string;
  status: string;
  category: string;
  severity: string;
  injury_type?: InjuryType | null;
  body_part?: BodyPart | null;
  injury_source?: IncidentSource | null;
  exposure_event_type?: ExposureEventType | null;
  days_away_from_work?: number | null;
  days_restricted?: number | null;
  job_transfer?: boolean | null;
  recordable?: boolean | null;
  lost_time?: boolean | null;
  fatality?: boolean | null;
  idlh_flag?: boolean | null;
  sif_flag: boolean;
  escalation_level: string;
  stop_work_status: string;
  created_at: string;
  occurred_at?: string | null;
  injury_month?: number | null;
  injury_season?: string | null;
  injury_day_of_week?: string | null;
  injury_time_of_day?: string | null;
};

const EMPTY_FORM = {
  title: "",
  category: "incident",
  severity: "medium",
  injuryType: "" as InjuryType | "",
  bodyPart: "" as BodyPart | "",
  eventType: "" as ExposureEventType | "",
  source: "" as IncidentSource | "",
  daysAwayFromWork: 0,
  daysRestricted: 0,
  jobTransfer: false,
  recordable: false,
  lostTime: false,
  fatality: false,
  idlhFlag: false,
  occurredAt: "",
  observationId: "",
  dapActivityId: "",
  riskMemory: { ...EMPTY_RISK_MEMORY_FORM } as RiskMemoryFormInput,
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold capitalize", className)}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function InputField({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100",
        className
      )}
    />
  );
}

function SelectField({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400",
        className
      )}
    />
  );
}

function occurredAtToLocalInput(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear().toString()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatIncidentTimePatternLine(item: IncidentRow): string | null {
  if (item.injury_month == null || item.injury_month < 1) return null;
  const season =
    item.injury_season && item.injury_season in INJURY_SEASON_LABELS
      ? INJURY_SEASON_LABELS[item.injury_season as InjurySeason]
      : (item.injury_season ?? "—");
  const dow =
    item.injury_day_of_week && (INJURY_DAYS_OF_WEEK as readonly string[]).includes(item.injury_day_of_week)
      ? formatInjuryDayOfWeekLabel(item.injury_day_of_week as InjuryDayOfWeek)
      : (item.injury_day_of_week ?? "—");
  const tod =
    item.injury_time_of_day && item.injury_time_of_day in INJURY_TIME_OF_DAY_LABELS
      ? INJURY_TIME_OF_DAY_LABELS[item.injury_time_of_day as InjuryTimeOfDay]
      : (item.injury_time_of_day ?? "—");
  return `M${item.injury_month.toString()} · ${season} · ${dow} · ${tod}`;
}

function InlineBtn({
  children,
  onClick,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
        danger
          ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

export default function SafePredictIncidentsPage() {
  // useSearchParams() requires a Suspense boundary for static prerendering (CSR bailout).
  return (
    <Suspense fallback={null}>
      <SafePredictIncidentsPageContent />
    </Suspense>
  );
}

function SafePredictIncidentsPageContent() {
  const searchParams = useSearchParams();
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error" | "neutral">("neutral");
  const [contractors, setContractors] = useState<Array<{ id: string; name: string }>>([]);
  const [crews, setCrews] = useState<Array<{ id: string; name: string }>>([]);
  const [demoMode, setDemoMode] = useState(false);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const isDemo = await isSalesDemoRequest(headers);
      setDemoMode(isDemo);
      if (isDemo) {
        setIncidents(
          (statusFilter === "all"
            ? demoIncidentRows
            : demoIncidentRows.filter((i) => i.status === statusFilter)) as IncidentRow[]
        );
        setContractors(demoContractors);
        setCrews(demoCrews);
        setLoading(false);
        return;
      }
      const query = statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const response = await fetch(`/api/company/incidents${query}`, { headers });
      const data = (await response.json().catch(() => null)) as { incidents?: IncidentRow[]; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Failed to load incidents.");
      setIncidents(data?.incidents ?? []);
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Failed to load incidents.");
      setIncidents([]);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    void (async () => {
      try {
        const headers = await getAuthHeaders();
        const [cRes, crRes] = await Promise.all([
          fetch("/api/company/contractors", { headers }),
          fetch("/api/company/crews", { headers }),
        ]);
        const cData = (await cRes.json().catch(() => null)) as { contractors?: Array<{ id: string; name: string }> } | null;
        const crData = (await crRes.json().catch(() => null)) as { crews?: Array<{ id: string; name: string }> } | null;
        if (cRes.ok && cData?.contractors) setContractors(cData.contractors);
        if (crRes.ok && crData?.crews) setCrews(crData.crews);
      } catch { /* optional */ }
    })();
  }, []);

  useEffect(() => deferEffect(() => {
    const observationId = searchParams.get("observationId")?.trim() ?? "";
    if (observationId) setForm((prev) => ({ ...prev, observationId }));
    void loadIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [statusFilter, searchParams]);

  const counts = useMemo(() => ({
    total: incidents.length,
    open: incidents.filter((i) => i.status !== "closed").length,
    sif: incidents.filter((i) => i.sif_flag).length,
    stopWork: incidents.filter((i) => i.stop_work_status === "stop_work_active").length,
  }), [incidents]);

  async function createIncident() {
    if (!form.title.trim()) return;
    if (!form.eventType) { setMessageTone("warning"); setMessage("Select an event / exposure type."); return; }
    if (!form.source) { setMessageTone("warning"); setMessage("Select an injury source (equipment / object)."); return; }
    if (form.category === "incident" && !form.injuryType) { setMessageTone("warning"); setMessage("Select an injury type for injury incidents."); return; }
    if (form.category === "incident" && !form.bodyPart) { setMessageTone("warning"); setMessage("Select a body part for injury incidents."); return; }
    setSaving(true);
    setMessage("");
    try {
      if (demoMode) {
        const nowIso = new Date().toISOString();
        setIncidents((prev) => [{
          id: `demo-${Date.now()}`, title: form.title, status: "open",
          category: form.category, severity: form.severity,
          injury_type: form.category === "incident" ? form.injuryType || null : null,
          body_part: form.category === "incident" ? form.bodyPart || null : null,
          injury_source: form.source || null, exposure_event_type: form.eventType || null,
          days_away_from_work: form.daysAwayFromWork, days_restricted: form.daysRestricted,
          job_transfer: form.jobTransfer, recordable: form.recordable, lost_time: form.lostTime,
          fatality: form.fatality, idlh_flag: form.idlhFlag, sif_flag: form.category === "incident",
          escalation_level: "none", stop_work_status: "normal", created_at: nowIso,
          occurred_at: form.occurredAt.trim() ? new Date(form.occurredAt).toISOString() : nowIso,
          injury_month: new Date(nowIso).getUTCMonth() + 1, injury_season: "spring",
          injury_day_of_week: "friday", injury_time_of_day: "morning",
        }, ...prev]);
        setForm(EMPTY_FORM);
        setMessageTone("success");
        setMessage("Demo incident created.");
        setSaving(false);
        return;
      }
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/incidents", {
        method: "POST", headers,
        body: JSON.stringify({
          title: form.title, category: form.category, severity: form.severity,
          status: "open", escalationLevel: "none", stopWorkStatus: "normal",
          sifFlag: form.category === "incident", eventType: form.eventType, source: form.source,
          daysAwayFromWork: form.daysAwayFromWork, daysRestricted: form.daysRestricted,
          jobTransfer: form.jobTransfer, recordable: form.recordable, lostTime: form.lostTime,
          fatality: form.fatality, idlhFlag: form.idlhFlag,
          ...(form.category === "incident" ? { injuryType: form.injuryType, bodyPart: form.bodyPart } : {}),
          occurredAt: form.occurredAt.trim() ? new Date(form.occurredAt).toISOString() : null,
          observationId: form.observationId || null, dapActivityId: form.dapActivityId || null,
          ...((): Record<string, unknown> => {
            const rm = buildRiskMemoryApiObject(form.riskMemory);
            return rm ? { riskMemory: rm } : {};
          })(),
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Failed to create incident.");
      setForm(EMPTY_FORM);
      setMessageTone("success");
      setMessage("Incident created.");
      await loadIncidents();
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Failed to create incident.");
    }
    setSaving(false);
  }

  async function updateIncident(item: IncidentRow, updates: Record<string, unknown>) {
    if (demoMode) {
      setIncidents((prev) => prev.map((i) => i.id === item.id ? { ...i, ...updates } : i));
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/incidents", {
        method: "PATCH", headers,
        body: JSON.stringify({ id: item.id, ...updates }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Failed to update incident.");
      await loadIncidents();
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Failed to update incident.");
    }
  }

  const inputSelect = "h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 focus:border-blue-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <div className="min-h-[calc(100vh-5rem)]">
      <PageHeader
        title="Incidents"
        subtitle="Track incidents and near misses with SIF, escalation, stop-work controls, and DART outcomes."
        actions={
          <button
            type="button"
            onClick={() => void loadIncidents()}
            disabled={loading}
            className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4 sm:px-7">
        {[
          { icon: AlertTriangle, label: "Total", value: counts.total, color: "text-blue-600", bg: "bg-blue-50" },
          { icon: TriangleAlert, label: "Open", value: counts.open, color: "text-amber-600", bg: "bg-amber-50" },
          { icon: Zap, label: "SIF", value: counts.sif, color: "text-orange-600", bg: "bg-orange-50" },
          { icon: ShieldAlert, label: "Stop Work", value: counts.stopWork, color: "text-red-600", bg: "bg-red-50" },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg", bg)}>
              <Icon className={cx("h-5 w-5", color)} />
            </span>
            <div>
              <p className="text-xl font-black text-slate-950">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Inline message */}
      {message && (
        <div className={cx(
          "mx-4 mb-4 rounded-lg border px-4 py-3 text-sm font-semibold sm:mx-7",
          messageTone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
          messageTone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
          messageTone === "error" && "border-red-200 bg-red-50 text-red-700",
          messageTone === "neutral" && "border-slate-200 bg-slate-50 text-slate-700",
        )}>
          {message}
        </div>
      )}

      {/* Create form */}
      <div className="px-4 pb-4 sm:px-7">
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <SectionTitle
              title="Create Incident / Near Miss"
              hint="Classify event/exposure, equipment source, injury details, and DART outcomes."
            />
          </div>
          <div className="p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <InputField
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Incident title"
                aria-label="Incident title"
              />
              <SelectField
                value={form.category}
                onChange={(e) => setForm((p) => ({
                  ...p, category: e.target.value,
                  injuryType: e.target.value === "incident" ? p.injuryType : "",
                  bodyPart: e.target.value === "incident" ? p.bodyPart : "",
                }))}
              >
                <option value="incident">Incident</option>
                <option value="near_miss">Near Miss</option>
                <option value="hazard">Hazard</option>
              </SelectField>
              <SelectField
                value={form.severity}
                onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </SelectField>

              <label className="flex flex-col gap-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">When it occurred (optional)</span>
                <InputField
                  type="datetime-local"
                  value={form.occurredAt}
                  onChange={(e) => setForm((p) => ({ ...p, occurredAt: e.target.value }))}
                />
                <span className="text-slate-400">Drives injury month, season, weekday, and time-of-day (UTC).</span>
              </label>

              <SelectField
                value={form.eventType}
                onChange={(e) => setForm((p) => ({ ...p, eventType: e.target.value as ExposureEventType | "" }))}
                aria-label="Event or exposure type"
              >
                <option value="">Select event / exposure type…</option>
                {EXPOSURE_EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>{EXPOSURE_EVENT_TYPE_LABELS[t]}</option>
                ))}
              </SelectField>

              <SelectField
                value={form.source}
                onChange={(e) => setForm((p) => ({ ...p, source: e.target.value as IncidentSource | "" }))}
                aria-label="Injury source"
              >
                <option value="">Select equipment / object source…</option>
                {INCIDENT_SOURCES.map((t) => (
                  <option key={t} value={t}>{INCIDENT_SOURCE_LABELS[t]}</option>
                ))}
              </SelectField>

              <SelectField
                value={form.injuryType}
                onChange={(e) => setForm((p) => ({ ...p, injuryType: e.target.value as InjuryType | "" }))}
                disabled={form.category !== "incident"}
                aria-label="Injury type"
              >
                <option value="">{form.category === "incident" ? "Select injury type…" : "N/A"}</option>
                {INJURY_TYPES.map((t) => (
                  <option key={t} value={t}>{INJURY_TYPE_LABELS[t]}</option>
                ))}
              </SelectField>

              <SelectField
                value={form.bodyPart}
                onChange={(e) => setForm((p) => ({ ...p, bodyPart: e.target.value as BodyPart | "" }))}
                disabled={form.category !== "incident"}
                aria-label="Body part"
              >
                <option value="">{form.category === "incident" ? "Select body part…" : "N/A"}</option>
                {BODY_PARTS.map((t) => (
                  <option key={t} value={t}>{BODY_PART_LABELS[t]}</option>
                ))}
              </SelectField>

              <label className="flex flex-col gap-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Days away from work</span>
                <InputField
                  type="number" min={0} step={1}
                  value={form.daysAwayFromWork}
                  onChange={(e) => { const n = parseInt(e.target.value, 10); setForm((p) => ({ ...p, daysAwayFromWork: Number.isFinite(n) && n >= 0 ? n : 0 })); }}
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Days restricted duty</span>
                <InputField
                  type="number" min={0} step={1}
                  value={form.daysRestricted}
                  onChange={(e) => { const n = parseInt(e.target.value, 10); setForm((p) => ({ ...p, daysRestricted: Number.isFinite(n) && n >= 0 ? n : 0 })); }}
                />
              </label>

              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.jobTransfer}
                  onChange={(e) => setForm((p) => ({ ...p, jobTransfer: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Job transfer (DART)
              </label>

              {/* OSHA checkboxes */}
              <div className="col-span-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Objective Severity (OSHA-style)</p>
                <div className="flex flex-wrap gap-5">
                  {[
                    { key: "recordable", label: "Recordable" },
                    { key: "lostTime", label: "Lost time" },
                    { key: "fatality", label: "Fatality" },
                    { key: "idlhFlag", label: "IDLH" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form[key as keyof typeof form] as boolean}
                        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <InputField
                value={form.observationId}
                onChange={(e) => setForm((p) => ({ ...p, observationId: e.target.value }))}
                placeholder="Observation ID (optional)"
              />
              <InputField
                value={form.dapActivityId}
                onChange={(e) => setForm((p) => ({ ...p, dapActivityId: e.target.value }))}
                placeholder="JSA Activity ID (optional)"
              />

              {/* Risk Memory fields */}
              <div className="col-span-full mt-1 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                <RiskMemoryFormFields
                  value={form.riskMemory}
                  onChange={(riskMemory) => setForm((p) => ({ ...p, riskMemory }))}
                  showOutcomeFields
                  showPicklistSettingsLink
                  contractors={contractors}
                  crews={crews}
                />
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => void createIncident()}
                disabled={
                  saving || !form.title.trim() || !form.eventType || !form.source ||
                  (form.category === "incident" && (!form.injuryType || !form.bodyPart))
                }
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create Incident"}
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Incident list */}
      <div className="px-4 pb-8 sm:px-7">
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <SectionTitle
              title="Incident Operations"
              hint="Manage lifecycle and high-risk controls."
              action={
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={inputSelect}
                >
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="closed">Closed</option>
                </select>
              }
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {!loading && incidents.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <CheckCircle2 className="h-8 w-8" />
              <p className="text-sm font-semibold">No incidents yet</p>
              <p className="text-xs">Log your first incident or near miss to begin tracking.</p>
            </div>
          )}

          {!loading && incidents.length > 0 && (
            <div className="divide-y divide-slate-100">
              {incidents.map((item) => {
                const timePattern = formatIncidentTimePatternLine(item);
                return (
                  <div key={item.id} className="px-5 py-4 hover:bg-slate-50/60 transition-colors">
                    {/* Top row */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900 leading-5">{item.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {item.category} ·{" "}
                          {item.exposure_event_type
                            ? EXPOSURE_EVENT_TYPE_LABELS[item.exposure_event_type]
                            : "Event/exposure not set"}{" "}
                          ·{" "}
                          {item.injury_source
                            ? INCIDENT_SOURCE_LABELS[item.injury_source]
                            : "Source not set"}
                          {item.injury_type ? ` · ${INJURY_TYPE_LABELS[item.injury_type]}` : ""}
                          {item.body_part ? ` · ${BODY_PART_LABELS[item.body_part]}` : ""}
                          {timePattern ? ` · ${timePattern}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge label={item.status} className={STATUS_STYLES[item.status] ?? STATUS_STYLES.open} />
                        <Badge label={item.severity} className={SEVERITY_STYLES[item.severity] ?? SEVERITY_STYLES.low} />
                        {item.sif_flag && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-black text-orange-700 border border-orange-200">
                            <Zap className="h-3 w-3" /> SIF
                          </span>
                        )}
                        {item.escalation_level !== "none" && (
                          <Badge label={`Escalated: ${item.escalation_level}`} className="bg-red-50 text-red-700 border-red-200" />
                        )}
                        {item.stop_work_status === "stop_work_active" && (
                          <Badge label="Stop Work" className="bg-red-100 text-red-800 border-red-300" />
                        )}
                      </div>
                    </div>

                    {/* Inline edit controls */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {/* Occurred */}
                      <label className="flex flex-col gap-0.5 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">Occurred</span>
                        <input
                          key={`${item.id}-occ-${item.occurred_at ?? ""}`}
                          type="datetime-local"
                          defaultValue={occurredAtToLocalInput(item.occurred_at)}
                          onBlur={(e) => {
                            const nextIso = e.target.value ? new Date(e.target.value).toISOString() : null;
                            if (nextIso !== (item.occurred_at ?? null)) {
                              void updateIncident(item, { occurredAt: nextIso });
                            }
                          }}
                          className="h-8 w-44 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
                        />
                      </label>

                      {/* Event type */}
                      <label className="flex flex-col gap-0.5 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">Event / exposure</span>
                        <select
                          value={item.exposure_event_type ?? ""}
                          onChange={(e) => void updateIncident(item, { eventType: e.target.value || null })}
                          className={inputSelect}
                        >
                          <option value="">Unset</option>
                          {EXPOSURE_EVENT_TYPES.map((t) => (
                            <option key={t} value={t}>{EXPOSURE_EVENT_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </label>

                      {/* Source */}
                      <label className="flex flex-col gap-0.5 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">Source</span>
                        <select
                          value={item.injury_source ?? ""}
                          onChange={(e) => void updateIncident(item, { source: e.target.value || null })}
                          className={inputSelect}
                        >
                          <option value="">Unset</option>
                          {INCIDENT_SOURCES.map((t) => (
                            <option key={t} value={t}>{INCIDENT_SOURCE_LABELS[t]}</option>
                          ))}
                        </select>
                      </label>

                      {/* Days */}
                      <label className="flex flex-col gap-0.5 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">Away (days)</span>
                        <input
                          key={`${item.id}-away`}
                          type="number" min={0} step={1}
                          defaultValue={item.days_away_from_work ?? 0}
                          onBlur={(e) => {
                            const n = parseInt(e.target.value, 10);
                            const v = Number.isFinite(n) && n >= 0 ? n : 0;
                            if (v !== (item.days_away_from_work ?? 0)) void updateIncident(item, { daysAwayFromWork: v });
                          }}
                          className="h-8 w-16 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
                        />
                      </label>

                      <label className="flex flex-col gap-0.5 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">Restricted (days)</span>
                        <input
                          key={`${item.id}-rest`}
                          type="number" min={0} step={1}
                          defaultValue={item.days_restricted ?? 0}
                          onBlur={(e) => {
                            const n = parseInt(e.target.value, 10);
                            const v = Number.isFinite(n) && n >= 0 ? n : 0;
                            if (v !== (item.days_restricted ?? 0)) void updateIncident(item, { daysRestricted: v });
                          }}
                          className="h-8 w-16 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
                        />
                      </label>

                      {/* Checkboxes */}
                      {[
                        { key: "job_transfer", label: "Transfer", apiKey: "jobTransfer" },
                        { key: "recordable", label: "Rec.", apiKey: "recordable" },
                        { key: "lost_time", label: "LT", apiKey: "lostTime" },
                        { key: "fatality", label: "Fatality", apiKey: "fatality" },
                        { key: "idlh_flag", label: "IDLH", apiKey: "idlhFlag" },
                      ].map(({ key, label, apiKey }) => (
                        <label key={key} className="flex cursor-pointer items-center gap-1 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={Boolean(item[key as keyof IncidentRow])}
                            onChange={(e) => void updateIncident(item, { [apiKey]: e.target.checked })}
                            className="h-3.5 w-3.5 rounded border-slate-300"
                          />
                          <span className="font-semibold">{label}</span>
                        </label>
                      ))}

                      {/* Action buttons */}
                      <InlineBtn
                        onClick={() => void updateIncident(item, {
                          status: item.status === "open" ? "in_progress" : item.status === "in_progress" ? "closed" : "open"
                        })}
                      >
                        Cycle Status
                      </InlineBtn>
                      <InlineBtn
                        onClick={() => void updateIncident(item, { sifFlag: !item.sif_flag })}
                      >
                        {item.sif_flag ? "Unset SIF" : "Set SIF"}
                      </InlineBtn>
                      <InlineBtn
                        onClick={() => void updateIncident(item, {
                          escalationLevel: item.escalation_level === "none" ? "critical" : "none"
                        })}
                      >
                        {item.escalation_level === "none" ? "Escalate" : "Clear Escalation"}
                      </InlineBtn>
                      <InlineBtn
                        danger
                        onClick={() => void updateIncident(item,
                          item.stop_work_status === "stop_work_active"
                            ? { stopWorkStatus: "cleared", stopWorkReason: "Cleared by operations lead." }
                            : { stopWorkStatus: "stop_work_active", stopWorkReason: "Unsafe condition requires stop work." }
                        )}
                      >
                        {item.stop_work_status === "stop_work_active" ? "Clear Stop Work" : "Stop Work"}
                      </InlineBtn>
                    </div>
                  </div>
                );
              })}
              <p className="px-5 py-3 text-xs text-slate-400">
                {incidents.length} incident{incidents.length === 1 ? "" : "s"} shown
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
