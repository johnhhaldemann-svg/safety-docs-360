"use client";

import { deferEffect } from "@/lib/deferredEffect";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  GitBranch,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Card, PageHeader, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";

const supabase = getSupabaseBrowserClient();

async function getAuthHeaders(): Promise<Record<string, string>> {
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

type RCARecord = {
  id: string;
  incident_title: string;
  rca_method: string;
  status: string;
  assigned_investigator: string | null;
  due_date: string | null;
  root_cause_summary: string | null;
  initial_findings: string | null;
  linked_corrective_actions: number | null;
  created_at: string;
};

const DEMO_RECORDS: RCARecord[] = [
  {
    id: "demo-rca-1",
    incident_title: "Fall from scaffold — Level 3, Block B",
    rca_method: "5-Why Analysis",
    status: "completed",
    assigned_investigator: "Marcus Webb",
    due_date: "2026-05-20",
    root_cause_summary:
      "Guardrail was removed to facilitate material delivery and not reinstated before work resumed. No formal re-inspection protocol existed for temporary dismantling.",
    initial_findings: "Worker fell approximately 2.4 m after stepping onto an unguarded section of scaffold.",
    linked_corrective_actions: 3,
    created_at: "2026-05-01T09:15:00Z",
  },
  {
    id: "demo-rca-2",
    incident_title: "Forklift near-miss — Loading Bay 4",
    rca_method: "Fishbone / Ishikawa",
    status: "in_review",
    assigned_investigator: "Priya Nair",
    due_date: "2026-06-15",
    root_cause_summary:
      "Pedestrian exclusion zone markings were faded and not visible in low-light conditions. Spotter was not assigned for the shift.",
    initial_findings:
      "Forklift operator turned without visibility of a pedestrian crossing the bay. No contact occurred.",
    linked_corrective_actions: 1,
    created_at: "2026-05-28T14:00:00Z",
  },
  {
    id: "demo-rca-3",
    incident_title: "Electrical arc flash — Switchroom, Site Office",
    rca_method: "Fault Tree Analysis",
    status: "open",
    assigned_investigator: "Leon Kowalski",
    due_date: "2026-06-30",
    root_cause_summary: null,
    initial_findings:
      "Technician received minor burns during energised work. Lockout/tagout procedure was not completed prior to panel access.",
    linked_corrective_actions: 0,
    created_at: "2026-06-03T08:45:00Z",
  },
];

const RCA_METHODS = [
  "5-Why Analysis",
  "Fishbone / Ishikawa",
  "Fault Tree Analysis",
  "Bow-Tie Analysis",
  "SCAT (Systematic Cause Analysis)",
];

const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-50 text-amber-700 border-amber-200",
  in_review: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_review: "In Review",
  completed: "Completed",
};

const EMPTY_FORM = {
  incident_title: "",
  rca_method: "5-Why Analysis",
  assigned_investigator: "",
  due_date: "",
  initial_findings: "",
  root_cause_statement: "",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold capitalize",
        className
      )}
    >
      {label}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(dueDate: string | null, status: string) {
  if (!dueDate || status === "completed") return false;
  const due = new Date(dueDate);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return due < thirtyDaysAgo;
}

function InputField({
  label,
  id,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-bold text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function SelectField({
  label,
  id,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-bold text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function InlineBtn({
  onClick,
  disabled,
  loading,
  children,
  variant = "primary",
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-50";
  const variants = {
    primary:
      "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    ghost:
      "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(base, variants[variant])}
    >
      {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export default function SafePredictRCAPage() {
  const [records, setRecords] = useState<RCARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const isDemo = await isSalesDemoRequest(headers);

      if (isDemo) {
        setRecords(DEMO_RECORDS);
        return;
      }

      // Try the real table; fall back to demo data if the table doesn't exist yet
      const { data, error: sbErr } = await supabase
        .from("company_rca_records")
        .select("*")
        .order("created_at", { ascending: false });

      if (sbErr) {
        // Table may not be migrated yet — use demo data silently
        setRecords(DEMO_RECORDS);
        return;
      }

      setRecords((data as RCARecord[]) ?? DEMO_RECORDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setRecords(DEMO_RECORDS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => deferEffect(() => { void load(); }), [load]);

  const handleSubmit = useCallback(async () => {
    if (!form.incident_title.trim() || !form.rca_method) {
      setSubmitError("Incident title and RCA method are required.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const headers = await getAuthHeaders();
      const isDemo = await isSalesDemoRequest(headers);

      if (isDemo) {
        const newRecord: RCARecord = {
          id: `demo-rca-new-${Date.now()}`,
          incident_title: form.incident_title,
          rca_method: form.rca_method,
          status: "open",
          assigned_investigator: form.assigned_investigator || null,
          due_date: form.due_date || null,
          initial_findings: form.initial_findings || null,
          root_cause_summary: form.root_cause_statement || null,
          linked_corrective_actions: 0,
          created_at: new Date().toISOString(),
        };
        setRecords((prev) => [newRecord, ...prev]);
        setForm({ ...EMPTY_FORM });
        setShowForm(false);
        setSubmitSuccess(true);
        setTimeout(() => setSubmitSuccess(false), 3000);
        return;
      }

      const { error: sbErr } = await supabase.from("company_rca_records").insert({
        incident_title: form.incident_title,
        rca_method: form.rca_method,
        status: "open",
        assigned_investigator: form.assigned_investigator || null,
        due_date: form.due_date || null,
        initial_findings: form.initial_findings || null,
        root_cause_summary: form.root_cause_statement || null,
        linked_corrective_actions: 0,
      });

      if (sbErr) throw new Error(sbErr.message);

      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      void load(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create RCA.");
    } finally {
      setSubmitting(false);
    }
  }, [form, load]);

  const openCount = records.filter((r) => r.status === "open").length;
  const inReviewCount = records.filter((r) => r.status === "in_review").length;
  const completedThisMonth = records.filter((r) => {
    if (r.status !== "completed") return false;
    const d = new Date(r.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const linkedCount = records.filter(
    (r) => r.linked_corrective_actions !== null && r.linked_corrective_actions > 0
  ).length;
  const overdueCount = records.filter((r) => isOverdue(r.due_date, r.status)).length;

  const filtered = records.filter((r) => {
    const matchesStatus = !statusFilter || r.status === statusFilter;
    const matchesSearch =
      !search ||
      r.incident_title.toLowerCase().includes(search.toLowerCase()) ||
      r.rca_method.toLowerCase().includes(search.toLowerCase()) ||
      (r.assigned_investigator ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-[calc(100vh-5rem)]">
      <PageHeader
        title="Root Cause Analysis"
        subtitle="Structured investigation of incidents to identify contributing factors, root causes, and prevent recurrence."
        actions={
          <div className="flex items-center gap-2">
            <InlineBtn
              onClick={() => setShowForm((v) => !v)}
              variant="primary"
            >
              <Plus className="h-3.5 w-3.5" />
              New RCA
            </InlineBtn>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading}
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        }
      />

      {/* Summary metric cards */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4 sm:px-7">
        {[
          {
            icon: GitBranch,
            label: "Open RCAs",
            value: openCount + inReviewCount,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            icon: CheckCircle2,
            label: "Completed This Month",
            value: completedThisMonth,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            icon: ClipboardCheck,
            label: "Linked to Corrective Actions",
            value: linkedCount,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            icon: AlertTriangle,
            label: "Overdue (>30 days)",
            value: overdueCount,
            color: "text-red-600",
            bg: "bg-red-50",
          },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
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

      <div className="flex flex-col gap-4 px-4 pb-8 sm:px-7">
        {/* New RCA form */}
        {showForm && (
          <Card>
            <div className="border-b border-slate-100 px-5 py-4">
              <SectionTitle
                title="Create New RCA"
                hint="Open a structured Root Cause Analysis linked to an incident."
              />
            </div>
            <div className="px-5 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <InputField
                    label="Linked Incident Title"
                    id="rca-incident-title"
                    value={form.incident_title}
                    onChange={(v) => setForm((f) => ({ ...f, incident_title: v }))}
                    placeholder="e.g. Fall from scaffold — Level 3, Block B"
                    required
                  />
                </div>
                <SelectField
                  label="RCA Method"
                  id="rca-method"
                  value={form.rca_method}
                  onChange={(v) => setForm((f) => ({ ...f, rca_method: v }))}
                  options={RCA_METHODS.map((m) => ({ value: m, label: m }))}
                  required
                />
                <InputField
                  label="Assigned Investigator"
                  id="rca-investigator"
                  value={form.assigned_investigator}
                  onChange={(v) => setForm((f) => ({ ...f, assigned_investigator: v }))}
                  placeholder="Full name"
                />
                <InputField
                  label="Due Date"
                  id="rca-due-date"
                  type="date"
                  value={form.due_date}
                  onChange={(v) => setForm((f) => ({ ...f, due_date: v }))}
                />
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label htmlFor="rca-initial-findings" className="text-xs font-bold text-slate-600">
                    Initial Findings
                  </label>
                  <textarea
                    id="rca-initial-findings"
                    rows={3}
                    value={form.initial_findings}
                    onChange={(e) => setForm((f) => ({ ...f, initial_findings: e.target.value }))}
                    placeholder="Describe what happened and the immediate circumstances observed."
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                  />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label htmlFor="rca-root-cause" className="text-xs font-bold text-slate-600">
                    Root Cause Statement
                  </label>
                  <textarea
                    id="rca-root-cause"
                    rows={3}
                    value={form.root_cause_statement}
                    onChange={(e) => setForm((f) => ({ ...f, root_cause_statement: e.target.value }))}
                    placeholder="Summarise the root cause(s) identified — complete after investigation."
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                  />
                </div>
              </div>

              {submitError && (
                <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-red-600">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  {submitError}
                </p>
              )}

              <div className="mt-4 flex items-center gap-2">
                <InlineBtn onClick={handleSubmit} loading={submitting} disabled={submitting}>
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Submit RCA
                </InlineBtn>
                <InlineBtn
                  onClick={() => {
                    setShowForm(false);
                    setForm({ ...EMPTY_FORM });
                    setSubmitError(null);
                  }}
                  variant="ghost"
                >
                  Cancel
                </InlineBtn>
              </div>
            </div>
          </Card>
        )}

        {submitSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            RCA created successfully.
          </div>
        )}

        {/* RCA list */}
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <SectionTitle
              title="All RCA Records"
              hint="Root cause analyses linked to incidents. Click a record to open the full investigation."
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search…"
                      className="h-8 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs font-semibold text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                  >
                    <option value="">All Statuses</option>
                    <option value="open">Open</option>
                    <option value="in_review">In Review</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              }
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-5 py-4 text-sm font-semibold text-red-600">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {!error && !loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <GitBranch className="h-8 w-8" />
              <p className="text-sm font-semibold">No RCA records found</p>
              <p className="text-xs">Try adjusting the filter or create a new RCA above.</p>
            </div>
          )}

          {!error && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-black text-slate-500">
                    <th className="px-5 py-3">Incident</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Method</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 hidden md:table-cell">Investigator</th>
                    <th className="px-4 py-3 hidden md:table-cell">Due</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Root Cause Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((record) => {
                    const overdue = isOverdue(record.due_date, record.status);
                    return (
                      <tr
                        key={record.id}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900 leading-5">
                            {record.incident_title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Opened {formatDate(record.created_at)}
                            {record.linked_corrective_actions !== null &&
                              record.linked_corrective_actions > 0 && (
                                <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-600">
                                  <ClipboardCheck className="h-2.5 w-2.5" />
                                  {record.linked_corrective_actions} CA
                                </span>
                              )}
                          </p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <GitBranch className="h-3 w-3 text-slate-400" />
                            {record.rca_method}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            label={STATUS_LABELS[record.status] ?? record.status}
                            className={STATUS_STYLES[record.status] ?? STATUS_STYLES.open}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 hidden md:table-cell">
                          {record.assigned_investigator ?? "—"}
                        </td>
                        <td
                          className={cx(
                            "px-4 py-3 text-xs hidden md:table-cell",
                            overdue ? "font-bold text-red-600" : "text-slate-500"
                          )}
                        >
                          {overdue && "⚠ "}
                          {formatDate(record.due_date)}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {record.root_cause_summary ? (
                            <p className="max-w-xs truncate text-xs text-slate-600">
                              {record.root_cause_summary}
                            </p>
                          ) : (
                            <span className="text-xs italic text-slate-400">Pending investigation</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
                {filtered.length} RCA record{filtered.length === 1 ? "" : "s"} shown
              </p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
