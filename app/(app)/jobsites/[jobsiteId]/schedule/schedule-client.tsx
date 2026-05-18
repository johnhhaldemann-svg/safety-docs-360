"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Archive, CalendarDays, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  InlineMessage,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

type ScheduleItem = {
  id: string;
  source: "manual" | "microsoft_project";
  title: string;
  status: string;
  workStartDate: string;
  workEndDate: string | null;
  trade: string | null;
  workArea: string | null;
  crewOrContractor: string | null;
  notes: string | null;
  readOnly: boolean;
};

type SchedulePayload = {
  jobsite?: {
    name?: string | null;
    jobsite_number?: string | null;
    project_number?: string | null;
  };
  window?: { startDate: string; endDate: string; days: number };
  items?: ScheduleItem[];
  warning?: string;
  error?: string;
};

type FormState = {
  title: string;
  workStartDate: string;
  workEndDate: string;
  trade: string;
  workArea: string;
  crewOrContractor: string;
  status: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  workStartDate: "",
  workEndDate: "",
  trade: "",
  workArea: "",
  crewOrContractor: "",
  status: "planned",
  notes: "",
};

function getAuthHeaders(accessToken?: string | null): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function labelize(value: string | null | undefined) {
  return String(value ?? "planned")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sourceLabel(source: ScheduleItem["source"]) {
  return source === "microsoft_project" ? "Microsoft Project" : "Manual";
}

function itemTone(item: ScheduleItem): "neutral" | "success" | "warning" | "info" {
  const status = item.status.toLowerCase();
  if (status === "blocked") return "warning";
  if (status === "completed") return "success";
  if (item.source === "microsoft_project") return "info";
  return "neutral";
}

export function JobsiteScheduleClient({ jobsiteId }: { jobsiteId: string }) {
  const [payload, setPayload] = useState<SchedulePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const response = await fetch(`/api/company/jobsites/${jobsiteId}/schedule`, {
      headers: getAuthHeaders(session?.access_token),
    });
    const data = (await response.json().catch(() => null)) as SchedulePayload | null;
    setPayload(data ?? {});
    if (!response.ok) {
      setMessage(data?.error || "Failed to load the schedule.");
      setMessageTone("error");
    } else if (data?.warning) {
      setMessage(data.warning);
      setMessageTone("warning");
    }
    setLoading(false);
  }, [jobsiteId]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const groupedItems = useMemo(() => {
    const rows = [...(payload?.items ?? [])];
    return rows.sort((a, b) => a.workStartDate.localeCompare(b.workStartDate));
  }, [payload?.items]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveItem() {
    if (!form.title.trim()) {
      setMessage("Schedule title is required.");
      setMessageTone("error");
      return;
    }
    if (!form.workStartDate) {
      setMessage("Start date is required.");
      setMessageTone("error");
      return;
    }

    setSaving(true);
    setMessage(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const response = await fetch(`/api/company/jobsites/${jobsiteId}/schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(session?.access_token),
      },
      body: JSON.stringify({
        title: form.title,
        workStartDate: form.workStartDate,
        workEndDate: form.workEndDate || null,
        trade: form.trade,
        workArea: form.workArea,
        crewOrContractor: form.crewOrContractor,
        status: form.status,
        notes: form.notes,
      }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!response.ok) {
      setMessage(data?.error || "Failed to save schedule item.");
      setMessageTone("error");
      setSaving(false);
      return;
    }
    setMessage(data?.message || "Schedule item added.");
    setMessageTone("success");
    setForm(EMPTY_FORM);
    await loadSchedule();
    setSaving(false);
  }

  async function archiveItem(item: ScheduleItem) {
    if (item.readOnly) return;
    setMessage(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const response = await fetch(`/api/company/jobsites/${jobsiteId}/schedule`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(session?.access_token),
      },
      body: JSON.stringify({ itemId: item.id, archived: true }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!response.ok) {
      setMessage(data?.error || "Failed to archive schedule item.");
      setMessageTone("error");
      return;
    }
    setMessage(data?.message || "Schedule item archived.");
    setMessageTone("success");
    await loadSchedule();
  }

  const jobsiteNumber = payload?.jobsite?.jobsite_number || payload?.jobsite?.project_number || jobsiteId;

  return (
    <SectionCard
      title="30-Day Schedule Outlook"
      description={`${payload?.jobsite?.name ?? "This jobsite"} · ${jobsiteNumber}`}
      actions={
        <button type="button" onClick={() => void loadSchedule()} className={appButtonSecondaryClassName}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          {loading ? "Refreshing" : "Refresh"}
        </button>
      }
    >
      <div className="space-y-5">
        {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Window" value={`${formatDate(payload?.window?.startDate)} - ${formatDate(payload?.window?.endDate)}`} />
          <SummaryCard label="Manual Items" value={String(groupedItems.filter((item) => item.source === "manual").length)} />
          <SummaryCard label="Imported Tasks" value={String(groupedItems.filter((item) => item.source === "microsoft_project").length)} />
        </div>

        <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <Plus className="h-4 w-4" aria-hidden />
            Add Upcoming Work
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" placeholder="Work title" value={form.title} onChange={(event) => updateForm("title", event.target.value)} />
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" type="date" value={form.workStartDate} onChange={(event) => updateForm("workStartDate", event.target.value)} />
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" type="date" value={form.workEndDate} onChange={(event) => updateForm("workEndDate", event.target.value)} />
            <select className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" value={form.status} onChange={(event) => updateForm("status", event.target.value)}>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
              <option value="completed">Completed</option>
            </select>
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" placeholder="Trade" value={form.trade} onChange={(event) => updateForm("trade", event.target.value)} />
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" placeholder="Work area" value={form.workArea} onChange={(event) => updateForm("workArea", event.target.value)} />
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" placeholder="Crew or contractor" value={form.crewOrContractor} onChange={(event) => updateForm("crewOrContractor", event.target.value)} />
            <button type="button" disabled={saving} onClick={() => void saveItem()} className={appButtonPrimaryClassName}>
              <Plus className="h-4 w-4" aria-hidden />
              {saving ? "Saving" : "Add Work"}
            </button>
          </div>
          <textarea className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" rows={3} placeholder="Notes" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} />
        </div>

        <div className="space-y-3">
          {loading ? <InlineMessage>Loading schedule...</InlineMessage> : null}
          {!loading && groupedItems.length === 0 ? (
            <InlineMessage tone="warning">No manual work or imported Microsoft Project tasks are scheduled in the next 30 days.</InlineMessage>
          ) : null}
          {groupedItems.map((item) => (
            <article key={`${item.source}-${item.id}`} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-sky-300" aria-hidden />
                    <h3 className="text-base font-bold text-slate-100">{item.title}</h3>
                    <StatusBadge label={labelize(item.status)} tone={itemTone(item)} />
                    <StatusBadge label={sourceLabel(item.source)} tone={item.source === "microsoft_project" ? "info" : "neutral"} />
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {formatDate(item.workStartDate)}{item.workEndDate && item.workEndDate !== item.workStartDate ? ` - ${formatDate(item.workEndDate)}` : ""}
                  </p>
                </div>
                {!item.readOnly ? (
                  <button type="button" onClick={() => void archiveItem(item)} className={appButtonSecondaryClassName}>
                    <Archive className="h-4 w-4" aria-hidden />
                    Archive
                  </button>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Field label="Trade" value={item.trade || "Not set"} />
                <Field label="Work area" value={item.workArea || "Not set"} />
                <Field label="Crew / contractor" value={item.crewOrContractor || "Not set"} />
              </div>
              {item.notes ? <p className="mt-4 text-sm leading-6 text-slate-300">{item.notes}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-bold text-slate-100">{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}
