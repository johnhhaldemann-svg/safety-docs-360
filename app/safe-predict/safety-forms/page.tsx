"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckSquare, ClipboardList, FileText, Plus, RefreshCw,
  ShieldAlert, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Card, PageHeader, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";

const supabase = getSupabaseBrowserClient();

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

type Definition = { id: string; title: string; active: boolean };

type FieldType = "text" | "checkbox" | "number" | "select" | "date" | "textarea";

type FormField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string; // comma-separated for select type
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Short Text",
  textarea: "Long Text",
  checkbox: "Checkbox (Yes/No)",
  number: "Number",
  select: "Dropdown",
  date: "Date",
};

function generateFieldId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `field_${Date.now()}`;
}

export default function SafePredictSafetyFormsPage() {
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [fields, setFields] = useState<FormField[]>([
    { id: "site", label: "Jobsite acknowledgment", type: "checkbox", required: true },
    { id: "notes", label: "Notes", type: "textarea", required: false },
  ]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/company/safety-forms/definitions", {
        headers,
        cache: forceRefresh ? "no-cache" : "default",
      });
      const data = (await res.json().catch(() => null)) as { definitions?: Definition[]; error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Failed to load.");
      setDefinitions(data?.definitions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // ---- field builder helpers ----
  function addField() {
    setFields((prev) => [
      ...prev,
      { id: `field_${Date.now()}`, label: "", type: "text", required: false },
    ]);
  }

  function removeField(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateField(idx: number, patch: Partial<FormField>) {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        const updated = { ...f, ...patch };
        // Auto-generate id from label if not manually set
        if (patch.label !== undefined) {
          updated.id = generateFieldId(patch.label);
        }
        return updated;
      })
    );
  }

  function moveField(idx: number, dir: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  // ---- create ----
  async function handleCreate() {
    if (!newTitle.trim()) return;
    if (fields.some((f) => !f.label.trim())) {
      setError("All fields must have a label.");
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const headers = await getAuthHeaders();
      const schema = {
        fields: fields.map((f) => ({
          id: f.id || generateFieldId(f.label),
          label: f.label,
          type: f.type,
          required: f.required,
          ...(f.type === "select" && f.options
            ? { options: f.options.split(",").map((s) => s.trim()).filter(Boolean) }
            : {}),
        })),
      };
      const res = await fetch("/api/company/safety-forms/definitions", {
        method: "POST",
        headers,
        body: JSON.stringify({ title: newTitle.trim(), initialSchema: schema }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Create failed.");
      setSuccess(`"${newTitle.trim()}" form created successfully.`);
      setNewTitle("");
      setFields([
        { id: "site", label: "Jobsite acknowledgment", type: "checkbox", required: true },
        { id: "notes", label: "Notes", type: "textarea", required: false },
      ]);
      setShowCreate(false);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setCreating(false);
    }
  }

  const activeCount = definitions.filter((d) => d.active).length;

  return (
    <div className="min-h-[calc(100vh-5rem)]">
      <PageHeader
        title="Safety Forms"
        subtitle="Define and manage your company's safety form templates. Field crews fill these out on the jobsite."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading}
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              New Form
            </button>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 sm:px-7">
        {[
          { icon: ClipboardList, label: "Total Forms", value: definitions.length, color: "text-blue-600", bg: "bg-blue-50" },
          { icon: CheckSquare, label: "Active", value: activeCount, color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: FileText, label: "Inactive", value: definitions.length - activeCount, color: "text-slate-500", bg: "bg-slate-100" },
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

      <div className="space-y-4 px-4 pb-8 sm:px-7">

        {/* Alerts */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <ShieldAlert className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <CheckSquare className="h-4 w-4 shrink-0" /> {success}
          </div>
        )}

        {/* Create Form Panel */}
        {showCreate && (
          <Card>
            <div className="border-b border-slate-100 px-5 py-4">
              <SectionTitle
                title="Create New Form"
                hint="Define a form template your crew will fill out on the jobsite."
              />
            </div>
            <div className="space-y-5 p-5">
              {/* Title */}
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                  Form Title <span className="text-red-500">*</span>
                </label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Daily Pre-Task Safety Check"
                  className="w-full max-w-lg rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Field Builder */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Form Fields ({fields.length})
                  </p>
                  <button
                    type="button"
                    onClick={addField}
                    className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Field
                  </button>
                </div>

                <div className="space-y-2">
                  {fields.map((field, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      {/* Move */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveField(idx, -1)}
                          disabled={idx === 0}
                          className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(idx, 1)}
                          disabled={idx === fields.length - 1}
                          className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Label */}
                      <input
                        value={field.label}
                        onChange={(e) => updateField(idx, { label: e.target.value })}
                        placeholder="Field label"
                        className="h-8 flex-1 min-w-[140px] rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                      />

                      {/* Type */}
                      <select
                        value={field.type}
                        onChange={(e) => updateField(idx, { type: e.target.value as FieldType })}
                        className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 focus:border-blue-400 focus:outline-none"
                      >
                        {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                          <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                        ))}
                      </select>

                      {/* Options (select type only) */}
                      {field.type === "select" && (
                        <input
                          value={field.options ?? ""}
                          onChange={(e) => updateField(idx, { options: e.target.value })}
                          placeholder="Option 1, Option 2, …"
                          className="h-8 flex-1 min-w-[140px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                        />
                      )}

                      {/* Required toggle */}
                      <button
                        type="button"
                        onClick={() => updateField(idx, { required: !field.required })}
                        className={cx(
                          "flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-bold transition",
                          field.required
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                        )}
                      >
                        {field.required
                          ? <><ToggleRight className="h-3.5 w-3.5" /> Required</>
                          : <><ToggleLeft className="h-3.5 w-3.5" /> Optional</>
                        }
                      </button>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeField(idx)}
                        disabled={fields.length <= 1}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {fields.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-center text-xs text-slate-400">
                    No fields yet — click &quot;Add Field&quot; above.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={creating || !newTitle.trim()}
                  className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {creating ? "Creating…" : "Create Form"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Definitions list */}
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <SectionTitle
              title="Form Library"
              hint="These templates are available to all jobsites in your company. Crews fill them out from the jobsite Safety Forms tab."
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {!loading && definitions.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
              <ClipboardList className="h-10 w-10" />
              <p className="text-sm font-semibold">No forms yet</p>
              <p className="text-xs text-center max-w-xs">
                Click &quot;New Form&quot; to create your first safety form template.
              </p>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-1 flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" /> New Form
              </button>
            </div>
          )}

          {!loading && definitions.length > 0 && (
            <ul className="divide-y divide-slate-50">
              {definitions.map((def) => (
                <li key={def.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50">
                    <ClipboardList className="h-5 w-5 text-blue-600" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 leading-5">{def.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{def.id}</p>
                  </div>
                  <span
                    className={cx(
                      "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold",
                      def.active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-100 text-slate-500"
                    )}
                  >
                    {def.active ? "Active" : "Inactive"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Info banner */}
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-5 py-4">
          <p className="text-sm font-semibold text-blue-800">About Safety Forms</p>
          <p className="mt-1 text-xs text-blue-700 leading-relaxed">
            Forms created here are company-wide templates. To assign a form to a specific jobsite or view
            completed submissions, go to <strong>Sites &amp; Operations → [Jobsite] → Safety Forms</strong>.
            Each form supports multiple versions — publishing a new version updates all future submissions
            without affecting historic records.
          </p>
        </div>
      </div>
    </div>
  );
}
