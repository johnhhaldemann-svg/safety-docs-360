"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CompanyAiAssistPanel } from "@/components/company-ai/CompanyAiAssistPanel";
import { CompanyMemoryLessonPrompt } from "@/components/company-ai/CompanyMemoryLessonPrompt";
import { CompanyMemoryBankPanel } from "@/components/company-ai/CompanyMemoryBankPanel";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
} from "@/components/WorkspacePrimitives";
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  return `M${item.injury_month.toString()} · ${season} · ${dow} · ${tod} (UTC bands)`;
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
  /** Required when category is `incident` (API + loss modeling). */
  injuryType: "" as InjuryType | "",
  /** Required when category is `incident` (trade / prevention analytics). */
  bodyPart: "" as BodyPart | "",
  /** OSHA/BLS-style event/exposure; required for all new incidents (API). */
  eventType: "" as ExposureEventType | "",
  /** Equipment / object involved; required for all new incidents (API `source`). */
  source: "" as IncidentSource | "",
  daysAwayFromWork: 0,
  daysRestricted: 0,
  jobTransfer: false,
  /** OSHA-style objective flags (separate from severity band). */
  recordable: false,
  lostTime: false,
  fatality: false,
  /** Local datetime; API stores UTC and derives month/season/day/time-of-day (UTC). */
  occurredAt: "",
  observationId: "",
  dapActivityId: "",
  riskMemory: { ...EMPTY_RISK_MEMORY_FORM } as RiskMemoryFormInput,
};

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Missing auth token.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export default function IncidentsPage() {
  const searchParams = useSearchParams();
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");
  const [memoryLessonNudge, setMemoryLessonNudge] = useState(false);
  const [contractors, setContractors] = useState<Array<{ id: string; name: string }>>([]);
  const [crews, setCrews] = useState<Array<{ id: string; name: string }>>([]);

  async function loadIncidents() {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const query = statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const response = await fetch(`/api/company/incidents${query}`, { headers });
      const data = (await response.json().catch(() => null)) as { incidents?: IncidentRow[]; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to load incidents.");
      setIncidents(data?.incidents ?? []);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to load incidents.");
      setIncidents([]);
    }
    setLoading(false);
  }

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
      } catch {
        /* optional directory */
      }
    })();
  }, []);

  useEffect(() => {
    const observationId = searchParams.get("observationId")?.trim() ?? "";
    if (observationId) {
      setForm((current) => ({ ...current, observationId }));
    }
    void loadIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchParams]);

  const counts = useMemo(
    () => ({
      total: incidents.length,
      open: incidents.filter((item) => item.status !== "closed").length,
      sif: incidents.filter((item) => item.sif_flag).length,
      stopWork: incidents.filter((item) => item.stop_work_status === "stop_work_active").length,
    }),
    [incidents]
  );

  async function createIncident() {
    if (!form.title.trim()) return;
    if (!form.eventType) {
      setMessageTone("warning");
      setMessage("Select an event / exposure type (required for regulatory and loss analytics).");
      return;
    }
    if (!form.source) {
      setMessageTone("warning");
      setMessage("Select an injury source (equipment / object) to link hazards and outcomes.");
      return;
    }
    if (form.category === "incident" && !form.injuryType) {
      setMessageTone("warning");
      setMessage("Select an injury type for injury incidents (required for structured loss analytics).");
      return;
    }
    if (form.category === "incident" && !form.bodyPart) {
      setMessageTone("warning");
      setMessage("Select a body part for injury incidents (required for trade and prevention analytics).");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/incidents", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          severity: form.severity,
          status: "open",
          escalationLevel: "none",
          stopWorkStatus: "normal",
          sifFlag: form.category === "incident",
          eventType: form.eventType,
          source: form.source,
          daysAwayFromWork: form.daysAwayFromWork,
          daysRestricted: form.daysRestricted,
          jobTransfer: form.jobTransfer,
          recordable: form.recordable,
          lostTime: form.lostTime,
          fatality: form.fatality,
          ...(form.category === "incident"
            ? { injuryType: form.injuryType, bodyPart: form.bodyPart }
            : {}),
          occurredAt: form.occurredAt.trim() ? new Date(form.occurredAt).toISOString() : null,
          observationId: form.observationId || null,
          dapActivityId: form.dapActivityId || null,
          ...((): Record<string, unknown> => {
            const rm = buildRiskMemoryApiObject(form.riskMemory);
            return rm ? { riskMemory: rm } : {};
          })(),
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to create incident.");
      setForm(EMPTY_FORM);
      setMessageTone("success");
      setMessage("Incident created.");
      await loadIncidents();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to create incident.");
    }
    setSaving(false);
  }

  async function updateIncident(item: IncidentRow, updates: Record<string, unknown>) {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/incidents", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: item.id, ...updates }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to update incident.");
      await loadIncidents();
      if (updates.status === "closed") {
        setMemoryLessonNudge(true);
      }
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to update incident.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Safety Modules"
        title="Incidents"
        description="Track incidents and near misses with SIF, escalation, stop-work controls, and optional Risk Memory Engine facets for learning trends."
        actions={
          <Link href="/dashboard" className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300">
            Back to Dashboard
          </Link>
        }
      />

      <div id="company-knowledge" className="grid scroll-mt-8 gap-4 lg:grid-cols-2">
        <CompanyAiAssistPanel
          surface="incidents"
          title="Incident assistant"
          structuredContext={JSON.stringify({
            total: counts.total,
            open: counts.open,
            sif: counts.sif,
            stopWork: counts.stopWork,
          })}
        />
        <CompanyMemoryBankPanel />
      </div>

      <CompanyMemoryLessonPrompt
        visible={memoryLessonNudge}
        onDismiss={() => setMemoryLessonNudge(false)}
        href="/incidents#company-knowledge"
      />

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4"><div className="text-xs text-slate-500">Total</div><div className="mt-2 text-3xl font-black">{counts.total}</div></div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4"><div className="text-xs text-slate-500">Open</div><div className="mt-2 text-3xl font-black">{counts.open}</div></div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4"><div className="text-xs text-slate-500">SIF</div><div className="mt-2 text-3xl font-black">{counts.sif}</div></div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4"><div className="text-xs text-slate-500">Stop Work</div><div className="mt-2 text-3xl font-black">{counts.stopWork}</div></div>
      </section>

      <SectionCard
        title="Create Incident / Near Miss"
        description="Classify event/exposure, equipment source, injury details when applicable, and DART outcomes—so hazards tie to outcomes across the program."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Incident title" className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]" />
          <select
            value={form.category}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                category: event.target.value,
                injuryType: event.target.value === "incident" ? prev.injuryType : "",
                bodyPart: event.target.value === "incident" ? prev.bodyPart : "",
              }))
            }
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]"
          >
            <option value="incident">Incident</option>
            <option value="near_miss">Near Miss</option>
            <option value="hazard">Hazard</option>
          </select>
          <select value={form.severity} onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value }))} className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <label className="flex flex-col gap-1 text-xs text-slate-400 md:col-span-1">
            <span className="font-semibold text-slate-300">When it occurred (optional)</span>
            <input
              type="datetime-local"
              value={form.occurredAt}
              onChange={(e) => setForm((prev) => ({ ...prev, occurredAt: e.target.value }))}
              className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]"
            />
            <span className="leading-snug text-slate-500">
              Drives injury month, season, weekday, and time-of-day (stored in UTC).
            </span>
          </label>
          <select
            value={form.eventType}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, eventType: event.target.value as ExposureEventType | "" }))
            }
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]"
            aria-label="Event or exposure type"
          >
            <option value="">Select event / exposure type…</option>
            {EXPOSURE_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EXPOSURE_EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={form.source}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, source: event.target.value as IncidentSource | "" }))
            }
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]"
            aria-label="Injury source (equipment or object)"
          >
            <option value="">Select equipment / object source…</option>
            {INCIDENT_SOURCES.map((t) => (
              <option key={t} value={t}>
                {INCIDENT_SOURCE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={form.injuryType}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, injuryType: event.target.value as InjuryType | "" }))
            }
            disabled={form.category !== "incident"}
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark] disabled:cursor-not-allowed disabled:bg-slate-800/70 disabled:text-slate-400"
            aria-label="Injury type"
          >
            <option value="">{form.category === "incident" ? "Select injury type…" : "N/A (not an injury incident)"}</option>
            {INJURY_TYPES.map((t) => (
              <option key={t} value={t}>
                {INJURY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={form.bodyPart}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, bodyPart: event.target.value as BodyPart | "" }))
            }
            disabled={form.category !== "incident"}
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark] disabled:cursor-not-allowed disabled:bg-slate-800/70 disabled:text-slate-400"
            aria-label="Body part affected"
          >
            <option value="">{form.category === "incident" ? "Select body part…" : "N/A (not an injury incident)"}</option>
            {BODY_PARTS.map((t) => (
              <option key={t} value={t}>
                {BODY_PART_LABELS[t]}
              </option>
            ))}
          </select>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Days away from work</span>
            <input
              type="number"
              min={0}
              step={1}
              value={form.daysAwayFromWork}
              onChange={(event) => {
                const n = parseInt(event.target.value, 10);
                setForm((prev) => ({
                  ...prev,
                  daysAwayFromWork: Number.isFinite(n) && n >= 0 ? n : 0,
                }));
              }}
              className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Days restricted duty</span>
            <input
              type="number"
              min={0}
              step={1}
              value={form.daysRestricted}
              onChange={(event) => {
                const n = parseInt(event.target.value, 10);
                setForm((prev) => ({
                  ...prev,
                  daysRestricted: Number.isFinite(n) && n >= 0 ? n : 0,
                }));
              }}
              className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/90 px-3 py-2.5 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.jobTransfer}
              onChange={(event) => setForm((prev) => ({ ...prev, jobTransfer: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-600"
            />
            Job transfer (DART)
          </label>
          <div className="col-span-full flex flex-wrap gap-4 rounded-xl border border-slate-700/80 bg-slate-950/50 px-3 py-3 text-sm text-slate-300">
            <span className="w-full text-xs font-semibold text-slate-500">Objective severity (OSHA-style)</span>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={form.recordable}
                onChange={(e) => setForm((prev) => ({ ...prev, recordable: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-600"
              />
              Recordable
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={form.lostTime}
                onChange={(e) => setForm((prev) => ({ ...prev, lostTime: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-600"
              />
              Lost time
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={form.fatality}
                onChange={(e) => setForm((prev) => ({ ...prev, fatality: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-600"
              />
              Fatality
            </label>
          </div>
          <input
            value={form.observationId}
            onChange={(event) => setForm((prev) => ({ ...prev, observationId: event.target.value }))}
            placeholder="Observation ID (optional)"
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]"
          />
          <input
            value={form.dapActivityId}
            onChange={(event) => setForm((prev) => ({ ...prev, dapActivityId: event.target.value }))}
            placeholder="JSA Activity ID (optional)"
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]"
          />
          <div className="col-span-full mt-2 rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
            <RiskMemoryFormFields
              value={form.riskMemory}
              onChange={(riskMemory) => setForm((prev) => ({ ...prev, riskMemory }))}
              showOutcomeFields
              contractors={contractors}
              crews={crews}
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={() => void createIncident()}
            disabled={
              saving ||
              !form.title.trim() ||
              !form.eventType ||
              !form.source ||
              (form.category === "incident" && (!form.injuryType || !form.bodyPart))
            }
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create Incident"}
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Incident Operations" description="Manage lifecycle and high-risk controls.">
        <div className="mb-4">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]">
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        {loading ? (
          <InlineMessage>Loading incidents...</InlineMessage>
        ) : incidents.length === 0 ? (
          <EmptyState title="No incidents yet" description="Log your first incident or near miss to begin tracking." />
        ) : (
          <div className="space-y-3">
            {incidents.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.category} · {item.severity}
                      {item.exposure_event_type ? (
                        <> · Event: {EXPOSURE_EVENT_TYPE_LABELS[item.exposure_event_type]}</>
                      ) : (
                        <> · Event/exposure not set</>
                      )}
                      {item.injury_source ? (
                        <> · Source: {INCIDENT_SOURCE_LABELS[item.injury_source]}</>
                      ) : (
                        <> · Source not set</>
                      )}
                      {item.injury_type ? (
                        <> · Injury: {INJURY_TYPE_LABELS[item.injury_type]}</>
                      ) : item.category === "incident" ? (
                        <> · Injury type not set</>
                      ) : null}
                      {item.body_part ? (
                        <> · Body: {BODY_PART_LABELS[item.body_part]}</>
                      ) : item.category === "incident" ? (
                        <> · Body part not set</>
                      ) : null}
                      {(item.days_away_from_work ?? 0) > 0 ||
                      (item.days_restricted ?? 0) > 0 ||
                      item.job_transfer ? (
                        <>
                          {" "}
                          · Away {(item.days_away_from_work ?? 0).toString()}d · Restricted{" "}
                          {(item.days_restricted ?? 0).toString()}d
                          {item.job_transfer ? " · Job transfer" : ""}
                        </>
                      ) : null}
                      {(item.recordable || item.lost_time || item.fatality) && (
                        <>
                          {" "}
                          · Obj:
                          {item.recordable ? " Rec" : ""}
                          {item.lost_time ? " LT" : ""}
                          {item.fatality ? " Fatality" : ""}
                        </>
                      )}
                      {(() => {
                        const timePatternLine = formatIncidentTimePatternLine(item);
                        return timePatternLine ? <> · {timePatternLine}</> : null;
                      })()}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge label={item.status} tone={item.status === "closed" ? "neutral" : item.status === "in_progress" ? "info" : "warning"} />
                    <StatusBadge label={item.escalation_level} tone={item.escalation_level === "critical" ? "warning" : "info"} />
                    <StatusBadge label={item.stop_work_status} tone={item.stop_work_status === "stop_work_active" ? "warning" : "neutral"} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="flex shrink-0 flex-col gap-1 text-xs text-slate-400">
                    <span className="font-semibold">Occurred (local)</span>
                    <input
                      key={`${item.id}-occ-${item.occurred_at ?? ""}-${String(item.injury_month ?? "")}`}
                      type="datetime-local"
                      defaultValue={occurredAtToLocalInput(item.occurred_at)}
                      onBlur={(e) => {
                        const v = e.target.value;
                        const nextIso = v ? new Date(v).toISOString() : null;
                        const prev = item.occurred_at ?? null;
                        if (nextIso !== prev) void updateIncident(item, { occurredAt: nextIso });
                      }}
                      className="w-[11.5rem] rounded-lg border border-slate-600 px-2 py-1 text-xs"
                      title="Sets occurred_at; month, season, weekday, and time-of-day follow in UTC."
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-semibold">Event / exposure</span>
                    <select
                      value={item.exposure_event_type ?? ""}
                      onChange={(e) =>
                        void updateIncident(item, {
                          eventType: e.target.value || null,
                        })
                      }
                      className="max-w-[14rem] rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-200 [color-scheme:dark]"
                      title="OSHA/BLS-style event or exposure classification"
                    >
                      <option value="">Unset</option>
                      {EXPOSURE_EVENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {EXPOSURE_EVENT_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-semibold">Source</span>
                    <select
                      value={item.injury_source ?? ""}
                      onChange={(e) =>
                        void updateIncident(item, {
                          source: e.target.value || null,
                        })
                      }
                      className="max-w-[11rem] rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-200 [color-scheme:dark]"
                      title="Equipment or object involved (SOR / hazard linkage)"
                    >
                      <option value="">Unset</option>
                      {INCIDENT_SOURCES.map((t) => (
                        <option key={t} value={t}>
                          {INCIDENT_SOURCE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-semibold">Injury type</span>
                    <select
                      value={item.injury_type ?? ""}
                      onChange={(e) =>
                        void updateIncident(item, {
                          injuryType: e.target.value || null,
                        })
                      }
                      className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-200 [color-scheme:dark]"
                      disabled={item.category !== "incident"}
                      title={
                        item.category === "incident"
                          ? "Nature of injury for loss / recovery analytics"
                          : "Only injury incidents use structured injury types"
                      }
                    >
                      <option value="">{item.category === "incident" ? "Unset" : "—"}</option>
                      {INJURY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {INJURY_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-semibold">Body part</span>
                    <select
                      value={item.body_part ?? ""}
                      onChange={(e) =>
                        void updateIncident(item, {
                          bodyPart: e.target.value || null,
                        })
                      }
                      className="max-w-[9rem] rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-200 [color-scheme:dark]"
                      disabled={item.category !== "incident"}
                      title={
                        item.category === "incident"
                          ? "Primary region for trade / prevention analytics"
                          : "Only injury incidents use structured body regions"
                      }
                    >
                      <option value="">{item.category === "incident" ? "Unset" : "—"}</option>
                      {BODY_PARTS.map((t) => (
                        <option key={t} value={t}>
                          {BODY_PART_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1 text-xs text-slate-400">
                    <span className="font-semibold">Away</span>
                    <input
                      key={`${item.id}-away-${(item.days_away_from_work ?? 0).toString()}`}
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={item.days_away_from_work ?? 0}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value, 10);
                        const v = Number.isFinite(n) && n >= 0 ? n : 0;
                        if (v !== (item.days_away_from_work ?? 0)) {
                          void updateIncident(item, { daysAwayFromWork: v });
                        }
                      }}
                      className="w-14 rounded-lg border border-slate-600 px-1 py-1 text-xs"
                      title="Days away from work"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs text-slate-400">
                    <span className="font-semibold">Restr.</span>
                    <input
                      key={`${item.id}-rest-${(item.days_restricted ?? 0).toString()}`}
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={item.days_restricted ?? 0}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value, 10);
                        const v = Number.isFinite(n) && n >= 0 ? n : 0;
                        if (v !== (item.days_restricted ?? 0)) {
                          void updateIncident(item, { daysRestricted: v });
                        }
                      }}
                      className="w-14 rounded-lg border border-slate-600 px-1 py-1 text-xs"
                      title="Days restricted duty"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={Boolean(item.job_transfer)}
                      onChange={(e) => void updateIncident(item, { jobTransfer: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-slate-600"
                    />
                    <span className="font-semibold">Transfer</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={Boolean(item.recordable)}
                      onChange={(e) => void updateIncident(item, { recordable: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-slate-600"
                    />
                    <span className="font-semibold">Rec.</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={Boolean(item.lost_time)}
                      onChange={(e) => void updateIncident(item, { lostTime: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-slate-600"
                    />
                    <span className="font-semibold">LT</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={Boolean(item.fatality)}
                      onChange={(e) => void updateIncident(item, { fatality: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-slate-600"
                    />
                    <span className="font-semibold">Fatality</span>
                  </label>
                  <button onClick={() => void updateIncident(item, { status: item.status === "open" ? "in_progress" : item.status === "in_progress" ? "closed" : "open" })} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300">
                    Cycle Status
                  </button>
                  <button onClick={() => void updateIncident(item, { sifFlag: !item.sif_flag })} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300">
                    {item.sif_flag ? "Unset SIF" : "Set SIF"}
                  </button>
                  <button onClick={() => void updateIncident(item, { escalationLevel: item.escalation_level === "none" ? "critical" : "none" })} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300">
                    {item.escalation_level === "none" ? "Escalate" : "Clear Escalation"}
                  </button>
                  <button
                    onClick={() =>
                      void updateIncident(item, item.stop_work_status === "stop_work_active"
                        ? { stopWorkStatus: "cleared", stopWorkReason: "Cleared by operations lead." }
                        : { stopWorkStatus: "stop_work_active", stopWorkReason: "Unsafe condition requires stop work." })
                    }
                    className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700"
                  >
                    {item.stop_work_status === "stop_work_active" ? "Clear Stop Work" : "Stop Work"}
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
