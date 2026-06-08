"use client";

import { deferEffect } from "@/lib/deferredEffect";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Filter,
  Lightbulb,
  Plus,
  RefreshCw,
  Tag,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Card, PageHeader, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";

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

type LessonLearned = {
  id: string;
  title: string;
  category: string;
  source_type: string;
  source_reference: string | null;
  severity: string;
  key_learning: string;
  recommended_action: string;
  jobsite: string | null;
  captured_at: string;
  created_at: string;
};

const CATEGORY_STYLES: Record<string, string> = {
  "Fall Protection": "bg-red-100 text-red-700 border-red-200",
  "Electrical": "bg-amber-100 text-amber-700 border-amber-200",
  "Equipment": "bg-blue-100 text-blue-700 border-blue-200",
  "Chemical": "bg-purple-100 text-purple-700 border-purple-200",
  "Behavioral": "bg-slate-100 text-slate-600 border-slate-200",
  "Environmental": "bg-green-100 text-green-700 border-green-200",
  "Other": "bg-gray-100 text-gray-600 border-gray-200",
};

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

const SOURCE_TYPE_STYLES: Record<string, string> = {
  "Incident": "bg-red-50 text-red-700 border-red-200",
  "Near Miss": "bg-orange-50 text-orange-700 border-orange-200",
  "Observation": "bg-blue-50 text-blue-700 border-blue-200",
  "Audit Finding": "bg-violet-50 text-violet-700 border-violet-200",
  "External Industry Alert": "bg-teal-50 text-teal-700 border-teal-200",
};

const CATEGORY_TABS = [
  "All",
  "Fall Protection",
  "Electrical",
  "Equipment",
  "Chemical",
  "Behavioral",
  "Environmental",
  "Other",
];

const SOURCE_TYPES = [
  "Incident",
  "Near Miss",
  "Observation",
  "Audit Finding",
  "External Industry Alert",
];

const DEMO_LESSONS: LessonLearned[] = [
  {
    id: "ll-001",
    title: "Improper Harness Donning Leads to Fall Near-Miss at Rooftop Level",
    category: "Fall Protection",
    source_type: "Near Miss",
    source_reference: "NM-2024-047",
    severity: "high",
    key_learning:
      "Worker had completed fall protection training 18 months prior but had developed an incorrect habit of skipping the leg strap check during rushed morning starts. A pre-task inspection by a foreman caught the unbuckled dorsal D-ring before work commenced at height.",
    recommended_action:
      "Implement mandatory buddy-check protocol for all harness donning before any work above 6 ft. Refresh fall protection training annually rather than bi-annually. Add harness donning to daily toolbox talk rotation.",
    jobsite: "Tower Block C — Level 14",
    captured_at: "2024-11-12T08:30:00Z",
    created_at: "2024-11-12T08:30:00Z",
  },
  {
    id: "ll-002",
    title: "Unlabeled Conduit Creates Arc Flash Risk During Energized Work",
    category: "Electrical",
    source_type: "Incident",
    source_reference: "INC-2024-103",
    severity: "high",
    key_learning:
      "An electrician received a minor arc flash burn when cutting into a conduit assumed to be de-energized based on an outdated single-line drawing. The drawing had not been updated to reflect a rerouted circuit added six months prior during a scope change.",
    recommended_action:
      "Require as-built drawing verification before any energized-adjacent work. Mandate live-circuit test using a CAT IV meter on all conductors before cutting. Establish a drawing change-control process so scope changes trigger immediate diagram updates.",
    jobsite: "Warehouse Fitout — Electrical Room B",
    captured_at: "2024-10-28T14:15:00Z",
    created_at: "2024-10-28T14:15:00Z",
  },
  {
    id: "ll-003",
    title: "Overhead Crane Swing Load Strikes Scaffold Due to Missing Exclusion Zone",
    category: "Equipment",
    source_type: "Near Miss",
    source_reference: "NM-2024-039",
    severity: "high",
    key_learning:
      "A swinging load from an overhead crane grazed scaffold planking while workers were still on the deck. No exclusion zone had been established because the lift plan was treated as a routine pick rather than a critical lift, underestimating the swing radius.",
    recommended_action:
      "Classify any lift within 3 m of occupied scaffold as a critical lift requiring a written lift plan and dedicated spotter. Install visible exclusion zone barriers before all crane operations. Brief all workers on swing-radius hazards at daily start.",
    jobsite: "Fabrication Yard — Bay 4",
    captured_at: "2024-09-15T10:00:00Z",
    created_at: "2024-09-15T10:00:00Z",
  },
  {
    id: "ll-004",
    title: "Solvent Vapour Accumulation in Confined Space Due to Inadequate Ventilation",
    category: "Chemical",
    source_type: "Audit Finding",
    source_reference: "AUD-2024-018",
    severity: "medium",
    key_learning:
      "A confined space entry audit found that ventilation calculations had not accounted for the higher evaporation rate of the substituted solvent (MEK replacing toluene). Atmospheric monitoring showed vapour levels at 45% LEL before workers had entered.",
    recommended_action:
      "Require re-assessment of ventilation requirements whenever a chemical substitution is made on a confined space job. Update confined space entry permits to include ventilation rate calculations linked to the specific product SDS. Provide continuous atmospheric monitoring for all solvent use in confined spaces.",
    jobsite: "Pump Station 7 — Underground Wet Well",
    captured_at: "2024-08-22T09:45:00Z",
    created_at: "2024-08-22T09:45:00Z",
  },
  {
    id: "ll-005",
    title: "Production Pressure Culture Suppressing Near-Miss Reporting",
    category: "Behavioral",
    source_type: "External Industry Alert",
    source_reference: "Industry Alert — AISC Nov 2024",
    severity: "medium",
    key_learning:
      "An industry-wide survey found that 34% of construction workers on major projects withheld near-miss reports due to fear of schedule impact or peer pressure. Projects with anonymous reporting mechanisms had 2.4x higher near-miss capture rates and lower recordable injury rates.",
    recommended_action:
      "Deploy anonymous digital near-miss reporting (QR code on site noticeboards). Remove language linking safety performance bonuses to zero near-miss counts — reward reporting rate instead. Train all supervisors to respond to near-miss reports with positive reinforcement, not investigation as discipline.",
    jobsite: null,
    captured_at: "2024-11-05T00:00:00Z",
    created_at: "2024-11-05T00:00:00Z",
  },
];

const EMPTY_FORM = {
  title: "",
  category: "Fall Protection",
  source_type: "Incident",
  severity: "medium",
  key_learning: "",
  recommended_action: "",
  jobsite: "",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold", className)}>
      {label}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function InputField({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100",
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
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400",
        className
      )}
    />
  );
}

function TextareaField({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none",
        className
      )}
    />
  );
}

export default function SafePredictLessonsLearnedPage() {
  const [lessons, setLessons] = useState<LessonLearned[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "warning">("success");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLessons = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const isDemo = await isSalesDemoRequest(headers);
      setDemoMode(isDemo);

      if (isDemo) {
        setLessons(DEMO_LESSONS);
        setLoading(false);
        return;
      }

      const res = await fetch("/api/company/lessons-learned", {
        headers,
        cache: forceRefresh ? "no-cache" : "default",
      });

      if (res.status === 404) {
        // Table may not exist yet — fall back to demo data
        setLessons(DEMO_LESSONS);
        setDemoMode(true);
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error("Failed to load lessons learned.");
      const json = (await res.json()) as { lessons?: LessonLearned[] };
      setLessons(json.lessons ?? []);
    } catch {
      // Fallback to demo data if API is unavailable
      setLessons(DEMO_LESSONS);
      setDemoMode(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => deferEffect(() => {
    void loadLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const filtered = categoryFilter === "All"
    ? lessons
    : lessons.filter((l) => l.category === categoryFilter);

  // Metrics
  const totalLessons = lessons.length;
  const thisMonth = lessons.filter((l) => {
    const d = new Date(l.captured_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const categoriesCovered = new Set(lessons.map((l) => l.category)).size;
  const highPriority = lessons.filter((l) => l.severity === "high").length;

  async function saveLesson() {
    if (!form.title.trim()) {
      setMessageTone("warning");
      setMessage("Please enter a lesson title.");
      return;
    }
    if (!form.key_learning.trim()) {
      setMessageTone("warning");
      setMessage("Please describe the key learning.");
      return;
    }
    if (!form.recommended_action.trim()) {
      setMessageTone("warning");
      setMessage("Please enter a recommended action.");
      return;
    }

    setSaving(true);
    setMessage("");

    if (demoMode) {
      const newLesson: LessonLearned = {
        id: `ll-demo-${Date.now()}`,
        title: form.title,
        category: form.category,
        source_type: form.source_type,
        source_reference: null,
        severity: form.severity,
        key_learning: form.key_learning,
        recommended_action: form.recommended_action,
        jobsite: form.jobsite || null,
        captured_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      setLessons((prev) => [newLesson, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setMessageTone("success");
      setMessage("Lesson captured (demo mode — not persisted).");
      setSaving(false);
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/company/lessons-learned", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          source_type: form.source_type,
          severity: form.severity,
          key_learning: form.key_learning,
          recommended_action: form.recommended_action,
          jobsite: form.jobsite || null,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Failed to save lesson.");
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      setMessageTone("success");
      setMessage("Lesson captured successfully.");
      await loadLessons(true);
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Failed to save lesson.");
    }
    setSaving(false);
  }

  return (
    <div className="min-h-[calc(100vh-5rem)]">
      <PageHeader
        title="Lessons Learned"
        subtitle="Capture and share safety learnings from incidents, near-misses, and corrective actions across all jobsites to prevent recurrence."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadLessons(true)}
              disabled={loading}
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={cx("h-3.5 w-3.5", loading && "animate-spin")} />
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm((v) => !v); setMessage(""); }}
              className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Capture Lesson
            </button>
          </div>
        }
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4 sm:px-7">
        {[
          { icon: BookOpen, label: "Total Lessons", value: totalLessons, color: "text-blue-600", bg: "bg-blue-50" },
          { icon: Lightbulb, label: "Shared This Month", value: thisMonth, color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: Tag, label: "Categories Covered", value: categoriesCovered, color: "text-violet-600", bg: "bg-violet-50" },
          { icon: AlertTriangle, label: "High Priority", value: highPriority, color: "text-red-600", bg: "bg-red-50" },
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

      {/* Demo badge */}
      {demoMode && (
        <div className="mx-4 mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700 sm:mx-7">
          Showing demo lessons learned. Connect your company data to see real entries.
        </div>
      )}

      {/* Capture form */}
      {showForm && (
        <div className="mx-4 mb-4 sm:mx-7">
          <Card>
            <div className="border-b border-slate-100 px-5 py-4">
              <SectionTitle
                title="Capture New Lesson"
                hint="Document a safety learning so it can be shared across all jobsites."
              />
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {/* Title */}
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Lesson Title <span className="text-red-500">*</span>
                </label>
                <InputField
                  placeholder="Brief descriptive title of the lesson…"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>

              {/* Category */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Category</label>
                <SelectField
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                >
                  {CATEGORY_TABS.filter((c) => c !== "All").map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </SelectField>
              </div>

              {/* Source type */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Source Type</label>
                <SelectField
                  value={form.source_type}
                  onChange={(e) => setForm((p) => ({ ...p, source_type: e.target.value }))}
                >
                  {SOURCE_TYPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </SelectField>
              </div>

              {/* Severity */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Severity</label>
                <SelectField
                  value={form.severity}
                  onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </SelectField>
              </div>

              {/* Jobsite */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Jobsite (optional)</label>
                <InputField
                  placeholder="e.g. Tower Block C — Level 14"
                  value={form.jobsite}
                  onChange={(e) => setForm((p) => ({ ...p, jobsite: e.target.value }))}
                />
              </div>

              {/* Key learning */}
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Key Learning <span className="text-red-500">*</span>
                </label>
                <TextareaField
                  rows={3}
                  placeholder="What was learned? What went wrong or was at risk, and why? Include contributing factors…"
                  value={form.key_learning}
                  onChange={(e) => setForm((p) => ({ ...p, key_learning: e.target.value }))}
                />
              </div>

              {/* Recommended action */}
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Recommended Action <span className="text-red-500">*</span>
                </label>
                <TextareaField
                  rows={3}
                  placeholder="What should be done differently to prevent recurrence? Be specific and actionable…"
                  value={form.recommended_action}
                  onChange={(e) => setForm((p) => ({ ...p, recommended_action: e.target.value }))}
                />
              </div>
            </div>

            {/* Form actions */}
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
              <div>
                {message && (
                  <p className={cx(
                    "text-sm font-medium",
                    messageTone === "success" && "text-emerald-700",
                    messageTone === "error" && "text-red-600",
                    messageTone === "warning" && "text-amber-700",
                  )}>
                    {message}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setMessage(""); setForm(EMPTY_FORM); }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveLesson()}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Lesson"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Top-level message (outside form) */}
      {message && !showForm && (
        <div className={cx(
          "mx-4 mb-4 rounded-lg border px-4 py-2.5 text-sm font-medium sm:mx-7",
          messageTone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
          messageTone === "error" && "border-red-200 bg-red-50 text-red-600",
          messageTone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
        )}>
          {message}
        </div>
      )}

      {/* Category filter tabs */}
      <div className="px-4 pb-4 sm:px-7">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <Filter className="mr-1 h-3.5 w-3.5 shrink-0 text-slate-400" />
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setCategoryFilter(tab)}
              className={cx(
                "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition",
                categoryFilter === tab
                  ? "border-blue-300 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {tab}
              {tab !== "All" && (
                <span className="ml-1 opacity-60">
                  ({lessons.filter((l) => l.category === tab).length})
                </span>
              )}
              {tab === "All" && (
                <span className="ml-1 opacity-60">({lessons.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lessons list */}
      <div className="px-4 pb-8 sm:px-7">
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <SectionTitle
              title="Lessons Library"
              hint="Click a lesson to expand the full learning and recommended action. Filter by category using the tabs above."
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Loading lessons…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Lightbulb className="h-10 w-10 text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">No lessons found</p>
              <p className="text-xs text-slate-400">
                {categoryFilter !== "All"
                  ? `No lessons in the "${categoryFilter}" category yet.`
                  : "Capture your first lesson using the button above."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((lesson) => {
                const isExpanded = expandedId === lesson.id;
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      className="w-full text-left px-5 py-4 hover:bg-slate-50 transition"
                      onClick={() => setExpandedId(isExpanded ? null : lesson.id)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
                          <span className="font-semibold text-sm text-slate-900 leading-snug">
                            {lesson.title}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <Badge
                            label={lesson.category}
                            className={CATEGORY_STYLES[lesson.category] ?? "bg-gray-100 text-gray-600 border-gray-200"}
                          />
                          <Badge
                            label={lesson.severity.charAt(0).toUpperCase() + lesson.severity.slice(1)}
                            className={SEVERITY_STYLES[lesson.severity] ?? "bg-slate-100 text-slate-600 border-slate-200"}
                          />
                          <Badge
                            label={lesson.source_type}
                            className={SOURCE_TYPE_STYLES[lesson.source_type] ?? "bg-gray-100 text-gray-600 border-gray-200"}
                          />
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        {lesson.source_reference && (
                          <span className="font-mono">{lesson.source_reference}</span>
                        )}
                        {lesson.jobsite && (
                          <span>{lesson.jobsite}</span>
                        )}
                        <span>{formatDate(lesson.captured_at)}</span>
                      </div>

                      {!isExpanded && (
                        <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {lesson.key_learning}
                        </p>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-4">
                        <div>
                          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            Key Learning
                          </p>
                          <p className="text-sm text-slate-700 leading-relaxed">{lesson.key_learning}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            Recommended Action
                          </p>
                          <p className="text-sm text-slate-700 leading-relaxed">{lesson.recommended_action}</p>
                        </div>
                        {(lesson.jobsite || lesson.source_reference) && (
                          <div className="flex flex-wrap gap-4 text-xs text-slate-500 border-t border-slate-200 pt-3">
                            {lesson.source_reference && (
                              <span>
                                <span className="font-semibold text-slate-600">Source: </span>
                                {lesson.source_type} — {lesson.source_reference}
                              </span>
                            )}
                            {lesson.jobsite && (
                              <span>
                                <span className="font-semibold text-slate-600">Jobsite: </span>
                                {lesson.jobsite}
                              </span>
                            )}
                            <span>
                              <span className="font-semibold text-slate-600">Captured: </span>
                              {formatDate(lesson.captured_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
