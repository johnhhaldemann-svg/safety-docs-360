"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Archive, Bot, CalendarDays, Pencil, Plus, RefreshCw, X } from "lucide-react";
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
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  trade: string | null;
  workArea: string | null;
  crewOrContractor: string | null;
  crewSize: number | null;
  supervisorName: string | null;
  riskLevel: "low" | "medium" | "high" | "critical";
  isHighRisk: boolean;
  hazardCategories: string[];
  permitTriggers: string[];
  requiredControls: string[];
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
  summary?: {
    totalItems: number;
    manualItems: number;
    importedTasks: number;
    highRiskItems: number;
    permitRequiredItems: number;
    missingControlItems: number;
  };
  items?: ScheduleItem[];
  warning?: string;
  error?: string;
};

type AutoAssignPermitSummary = {
  scheduleItemId: string;
  permitType: string;
  permitCode: string;
  permitId: string | null;
  title: string;
  ownerUserId: string | null;
  ownerLabel: string;
  rationale: string;
  status: "created" | "would_create" | "skipped";
  skipReason?: string;
};

type AutoAssignTaskSummary = {
  scheduleItemId: string;
  title: string;
  permitTriggers: string[];
  ownerUserId: string | null;
  ownerLabel: string;
  assignmentRationale: string;
  createdCount: number;
  skippedCount: number;
};

type AutoAssignResponse = {
  error?: string;
  dryRun?: boolean;
  scope?: "daily" | "weekly";
  window?: { startDate: string; endDate: string; days: number };
  createdPermits?: AutoAssignPermitSummary[];
  skippedPermits?: AutoAssignPermitSummary[];
  unassignedPermits?: AutoAssignPermitSummary[];
  tasks?: AutoAssignTaskSummary[];
};

type FormState = {
  title: string;
  workStartDate: string;
  workEndDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
  trade: string;
  workArea: string;
  crewOrContractor: string;
  crewSize: string;
  supervisorName: string;
  riskLevel: ScheduleItem["riskLevel"];
  isHighRisk: boolean;
  hazardCategories: string;
  permitTriggers: string;
  requiredControls: string;
  status: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  workStartDate: "",
  workEndDate: "",
  shiftStartTime: "",
  shiftEndTime: "",
  trade: "",
  workArea: "",
  crewOrContractor: "",
  crewSize: "",
  supervisorName: "",
  riskLevel: "medium",
  isHighRisk: false,
  hazardCategories: "",
  permitTriggers: "",
  requiredControls: "",
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

function formatTime(value?: string | null) {
  if (!value) return "Not set";
  const [hour, minute] = value.split(":");
  if (!hour || !minute) return value;
  const parsed = new Date(`2026-01-01T${hour}:${minute}:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(parsed);
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
  if (status === "blocked" || item.riskLevel === "critical") return "warning";
  if (status === "completed") return "success";
  if (item.source === "microsoft_project") return "info";
  return "neutral";
}

function riskTone(riskLevel: ScheduleItem["riskLevel"]): "neutral" | "success" | "warning" | "info" {
  if (riskLevel === "critical" || riskLevel === "high") return "warning";
  if (riskLevel === "low") return "success";
  return "info";
}

function csv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(value: string[]) {
  return value.join(", ");
}

function itemToForm(item: ScheduleItem): FormState {
  return {
    title: item.title ?? "",
    workStartDate: item.workStartDate ?? "",
    workEndDate: item.workEndDate ?? "",
    shiftStartTime: item.shiftStartTime ?? "",
    shiftEndTime: item.shiftEndTime ?? "",
    trade: item.trade ?? "",
    workArea: item.workArea ?? "",
    crewOrContractor: item.crewOrContractor ?? "",
    crewSize: item.crewSize == null ? "" : String(item.crewSize),
    supervisorName: item.supervisorName ?? "",
    riskLevel: item.riskLevel ?? "medium",
    isHighRisk: Boolean(item.isHighRisk),
    hazardCategories: listToText(item.hazardCategories ?? []),
    permitTriggers: listToText(item.permitTriggers ?? []),
    requiredControls: listToText(item.requiredControls ?? []),
    status: item.status ?? "planned",
    notes: item.notes ?? "",
  };
}

export function JobsiteScheduleClient({ jobsiteId }: { jobsiteId: string }) {
  const [payload, setPayload] = useState<SchedulePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [assigningPermits, setAssigningPermits] = useState<SchedulePermitAssignmentScope | null>(null);
  const [assignmentResult, setAssignmentResult] = useState<AutoAssignResponse | null>(null);

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
      setMessage(data?.error || "Failed to load the work schedule.");
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

  const summary = payload?.summary ?? {
    totalItems: groupedItems.length,
    manualItems: groupedItems.filter((item) => item.source === "manual").length,
    importedTasks: groupedItems.filter((item) => item.source === "microsoft_project").length,
    highRiskItems: groupedItems.filter((item) => item.isHighRisk).length,
    permitRequiredItems: groupedItems.filter((item) => item.permitTriggers.length > 0).length,
    missingControlItems: groupedItems.filter((item) => item.isHighRisk && item.requiredControls.length === 0).length,
  };

  const assignmentByTask = useMemo(() => {
    const map = new Map<string, AutoAssignTaskSummary>();
    for (const task of assignmentResult?.tasks ?? []) map.set(task.scheduleItemId, task);
    return map;
  }, [assignmentResult?.tasks]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingItemId(null);
  }

  function editItem(item: ScheduleItem) {
    if (item.readOnly) return;
    setEditingItemId(item.id);
    setForm(itemToForm(item));
    setMessage(null);
  }

  function buildRequestBody() {
    return {
      ...(editingItemId ? { itemId: editingItemId } : {}),
      title: form.title,
      workStartDate: form.workStartDate,
      workEndDate: form.workEndDate || null,
      shiftStartTime: form.shiftStartTime || null,
      shiftEndTime: form.shiftEndTime || null,
      trade: form.trade,
      workArea: form.workArea,
      crewOrContractor: form.crewOrContractor,
      crewSize: form.crewSize ? Number(form.crewSize) : null,
      supervisorName: form.supervisorName,
      riskLevel: form.riskLevel,
      isHighRisk: form.isHighRisk,
      hazardCategories: csv(form.hazardCategories),
      permitTriggers: csv(form.permitTriggers),
      requiredControls: csv(form.requiredControls),
      status: form.status,
      notes: form.notes,
    };
  }

  async function saveItem() {
    if (!form.title.trim()) {
      setMessage("Work title is required.");
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
      method: editingItemId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(session?.access_token),
      },
      body: JSON.stringify(buildRequestBody()),
    });
    const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!response.ok) {
      setMessage(data?.error || "Failed to save work schedule item.");
      setMessageTone("error");
      setSaving(false);
      return;
    }
    setMessage(data?.message || (editingItemId ? "Work schedule item updated." : "Work schedule item added."));
    setMessageTone("success");
    resetForm();
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
      setMessage(data?.error || "Failed to archive work schedule item.");
      setMessageTone("error");
      return;
    }
    setMessage(data?.message || "Work schedule item archived.");
    setMessageTone("success");
    if (editingItemId === item.id) resetForm();
    await loadSchedule();
  }

  async function autoAssignPermits(scope: SchedulePermitAssignmentScope) {
    setAssigningPermits(scope);
    setMessage(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const response = await fetch(`/api/company/jobsites/${jobsiteId}/schedule/permits/auto-assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(session?.access_token),
      },
      body: JSON.stringify({ scope }),
    });
    const data = (await response.json().catch(() => null)) as AutoAssignResponse | null;
    setAssignmentResult(data);
    if (!response.ok) {
      setMessage(data?.error || "Failed to auto-assign permit drafts.");
      setMessageTone("error");
      setAssigningPermits(null);
      return;
    }
    const created = data?.createdPermits?.length ?? 0;
    const skipped = data?.skippedPermits?.length ?? 0;
    const unassigned = data?.unassignedPermits?.length ?? 0;
    setMessage(`AI permit assignment complete: ${created} draft${created === 1 ? "" : "s"} created, ${skipped} skipped, ${unassigned} needing owner review.`);
    setMessageTone(unassigned > 0 ? "warning" : "success");
    await loadSchedule();
    setAssigningPermits(null);
  }

  const jobsiteNumber = payload?.jobsite?.jobsite_number || payload?.jobsite?.project_number || jobsiteId;

  return (
    <SectionCard
      title="Work Schedule"
      description={`${payload?.jobsite?.name ?? "This jobsite"} - ${jobsiteNumber}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void autoAssignPermits("daily")} disabled={Boolean(assigningPermits)} className={appButtonSecondaryClassName}>
            <Bot className="h-4 w-4" aria-hidden />
            {assigningPermits === "daily" ? "Assigning" : "AI assign daily"}
          </button>
          <button type="button" onClick={() => void autoAssignPermits("weekly")} disabled={Boolean(assigningPermits)} className={appButtonSecondaryClassName}>
            <Bot className="h-4 w-4" aria-hidden />
            {assigningPermits === "weekly" ? "Assigning" : "AI assign week"}
          </button>
          <button type="button" onClick={() => void loadSchedule()} className={appButtonSecondaryClassName}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            {loading ? "Refreshing" : "Refresh"}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

        {assignmentResult?.window ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="AI Permit Window" value={`${formatDate(assignmentResult.window.startDate)} - ${formatDate(assignmentResult.window.endDate)}`} />
            <SummaryCard label="Drafts Created" value={String(assignmentResult.createdPermits?.length ?? 0)} tone="text-emerald-300" />
            <SummaryCard label="Skipped Existing" value={String(assignmentResult.skippedPermits?.length ?? 0)} tone="text-sky-300" />
            <SummaryCard label="Owner Review" value={String(assignmentResult.unassignedPermits?.length ?? 0)} tone={(assignmentResult.unassignedPermits?.length ?? 0) > 0 ? "text-amber-300" : "text-slate-100"} />
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard label="Window" value={`${formatDate(payload?.window?.startDate)} - ${formatDate(payload?.window?.endDate)}`} />
          <SummaryCard label="Scheduled Work" value={String(summary.totalItems)} />
          <SummaryCard label="High Risk" value={String(summary.highRiskItems)} tone="text-amber-300" />
          <SummaryCard label="Permit Needs" value={String(summary.permitRequiredItems)} />
          <SummaryCard label="Control Gaps" value={String(summary.missingControlItems)} tone="text-red-300" />
          <SummaryCard label="Imported" value={String(summary.importedTasks)} />
        </div>

        <div className="rounded-xl border border-amber-400/40 bg-amber-950/20 p-4">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Predictive model signals</div>
          <p className="mt-2 text-sm leading-6 text-amber-50">
            Upcoming high-risk work, missing permit triggers, missing controls, weekend work, large crews, and missing supervisor verification feed the Human Behavior Risk layer before work starts.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
              <Plus className="h-4 w-4" aria-hidden />
              {editingItemId ? "Update Scheduled Work" : "Add Upcoming Work"}
            </div>
            {editingItemId ? (
              <button type="button" onClick={resetForm} className={appButtonSecondaryClassName}>
                <X className="h-4 w-4" aria-hidden />
                Cancel edit
              </button>
            ) : null}
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
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" type="time" value={form.shiftStartTime} onChange={(event) => updateForm("shiftStartTime", event.target.value)} />
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" type="time" value={form.shiftEndTime} onChange={(event) => updateForm("shiftEndTime", event.target.value)} />
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" placeholder="Trade" value={form.trade} onChange={(event) => updateForm("trade", event.target.value)} />
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" placeholder="Work area" value={form.workArea} onChange={(event) => updateForm("workArea", event.target.value)} />
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" placeholder="Crew or contractor" value={form.crewOrContractor} onChange={(event) => updateForm("crewOrContractor", event.target.value)} />
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" type="number" min="0" placeholder="Crew size" value={form.crewSize} onChange={(event) => updateForm("crewSize", event.target.value)} />
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" placeholder="Supervisor" value={form.supervisorName} onChange={(event) => updateForm("supervisorName", event.target.value)} />
            <select className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" value={form.riskLevel} onChange={(event) => updateForm("riskLevel", event.target.value as ScheduleItem["riskLevel"])}>
              <option value="low">Low risk</option>
              <option value="medium">Medium risk</option>
              <option value="high">High risk</option>
              <option value="critical">Critical risk</option>
            </select>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <input type="checkbox" checked={form.isHighRisk} onChange={(event) => updateForm("isHighRisk", event.target.checked)} />
            High-risk work
          </label>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" placeholder="Hazards, comma separated" value={form.hazardCategories} onChange={(event) => updateForm("hazardCategories", event.target.value)} />
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" placeholder="Permit triggers, comma separated" value={form.permitTriggers} onChange={(event) => updateForm("permitTriggers", event.target.value)} />
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" placeholder="Required controls, comma separated" value={form.requiredControls} onChange={(event) => updateForm("requiredControls", event.target.value)} />
          </div>
          <textarea className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" rows={3} placeholder="Notes" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} />
          <button type="button" disabled={saving} onClick={() => void saveItem()} className={`${appButtonPrimaryClassName} mt-3`}>
            <Plus className="h-4 w-4" aria-hidden />
            {saving ? "Saving" : editingItemId ? "Update Work" : "Add Work"}
          </button>
        </div>

        <div className="space-y-3">
          {loading ? <InlineMessage>Loading work schedule...</InlineMessage> : null}
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
                    <StatusBadge label={labelize(item.riskLevel)} tone={riskTone(item.riskLevel)} />
                    {item.isHighRisk ? <StatusBadge label="High risk" tone="warning" /> : null}
                    <StatusBadge label={sourceLabel(item.source)} tone={item.source === "microsoft_project" ? "info" : "neutral"} />
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {formatDate(item.workStartDate)}{item.workEndDate && item.workEndDate !== item.workStartDate ? ` - ${formatDate(item.workEndDate)}` : ""} · {formatTime(item.shiftStartTime)} - {formatTime(item.shiftEndTime)}
                  </p>
                </div>
                {!item.readOnly ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => editItem(item)} className={appButtonSecondaryClassName}>
                      <Pencil className="h-4 w-4" aria-hidden />
                      Edit
                    </button>
                    <button type="button" onClick={() => void archiveItem(item)} className={appButtonSecondaryClassName}>
                      <Archive className="h-4 w-4" aria-hidden />
                      Archive
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Field label="Trade" value={item.trade || "Not set"} />
                <Field label="Work area" value={item.workArea || "Not set"} />
                <Field label="Crew / contractor" value={item.crewOrContractor || "Not set"} />
                <Field label="Crew size" value={item.crewSize == null ? "Not set" : String(item.crewSize)} />
                <Field label="Supervisor" value={item.supervisorName || "Not assigned"} />
                <Field label="Hazards" value={item.hazardCategories.length ? item.hazardCategories.join(", ") : "Not set"} />
                <Field label="Permits" value={item.permitTriggers.length ? item.permitTriggers.join(", ") : "No trigger listed"} />
                <Field label="Controls" value={item.requiredControls.length ? item.requiredControls.join(", ") : "No controls listed"} />
              </div>
              {assignmentByTask.has(item.id) ? (
                <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-950/20 p-3 text-sm text-sky-50">
                  <div className="font-bold">AI permit assignment</div>
                  <div className="mt-1 text-sky-100">
                    Owner: {assignmentByTask.get(item.id)?.ownerLabel ?? "Unassigned"} · Created {assignmentByTask.get(item.id)?.createdCount ?? 0} · Skipped {assignmentByTask.get(item.id)?.skippedCount ?? 0}
                  </div>
                  <div className="mt-1 text-sky-200">{assignmentByTask.get(item.id)?.assignmentRationale}</div>
                </div>
              ) : null}
              {item.notes ? <p className="mt-4 text-sm leading-6 text-slate-300">{item.notes}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

type SchedulePermitAssignmentScope = "daily" | "weekly";

function SummaryCard({ label, value, tone = "text-slate-100" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-2 text-sm font-bold ${tone}`}>{value}</div>
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
