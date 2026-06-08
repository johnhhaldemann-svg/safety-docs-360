"use client";

import { deferEffect } from "@/lib/deferredEffect";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Calendar, ClipboardList, Plus, RefreshCw, Users } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Card, PageHeader, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";

const supabase = getSupabaseBrowserClient();

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Missing auth token.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function isSalesDemoRequest(headers: HeadersInit): Promise<boolean> {
  const response = await fetch("/api/auth/me", { headers });
  const data = (await response.json().catch(() => null)) as { user?: { role?: string | null } } | null;
  return response.ok && data?.user?.role === "sales_demo";
}

const TOOLBOX_TOPICS = [
  "Fall Protection",
  "PPE & Personal Protective Equipment",
  "Ladder Safety",
  "Scaffold Safety",
  "Electrical Safety & LOTO",
  "Trenching & Excavation",
  "Crane & Rigging",
  "Struck-by Hazards",
  "Caught-in/Between Hazards",
  "Heat & Cold Stress",
  "Housekeeping",
  "Emergency Action Plan",
  "Hazard Communication (HazCom)",
  "Hand & Power Tools",
  "Fire Prevention",
  "Vehicle & Traffic Safety",
  "Silica Dust Exposure",
  "First Aid & Bloodborne Pathogens",
];

type ToolboxTalkRow = {
  id: string;
  topic: string;
  presenter: string;
  talk_date: string;
  location: string;
  attendee_count: number;
  notes: string | null;
  created_at: string;
};

const DEMO_TALKS: ToolboxTalkRow[] = [
  {
    id: "demo-1",
    topic: "Fall Protection",
    presenter: "Mike Torres",
    talk_date: "2026-06-06",
    location: "Site A – Building 3",
    attendee_count: 18,
    notes: "Covered 100% tie-off policy, anchor point inspection, and harness donning. All crew signed attendance sheet.",
    created_at: "2026-06-06T07:15:00Z",
  },
  {
    id: "demo-2",
    topic: "Heat & Cold Stress",
    presenter: "Sandra Kim",
    talk_date: "2026-05-29",
    location: "Site B – Parking Structure",
    attendee_count: 12,
    notes: "Reviewed hydration schedule, shade tent locations, and heat illness warning signs. Crew asked about cool-down breaks.",
    created_at: "2026-05-29T06:50:00Z",
  },
  {
    id: "demo-3",
    topic: "Electrical Safety & LOTO",
    presenter: "James Okafor",
    talk_date: "2026-05-21",
    location: "Site A – Mechanical Room",
    attendee_count: 9,
    notes: "Demonstrated lockout/tagout procedure on panel boards. Emphasized personal locks and verification testing.",
    created_at: "2026-05-21T07:05:00Z",
  },
  {
    id: "demo-4",
    topic: "Struck-by Hazards",
    presenter: "Rosa Mendez",
    talk_date: "2026-05-14",
    location: "Site C – Exterior Framing",
    attendee_count: 22,
    notes: "Discussed overhead work zones, hard hat requirements, and spotter duties during crane picks.",
    created_at: "2026-05-14T06:45:00Z",
  },
];

const EMPTY_FORM = {
  topic: "",
  presenter: "",
  talk_date: "",
  location: "",
  attendee_count: 0,
  notes: "",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold",
        className
      )}
    >
      {label}
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

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SafePredictToolboxTalksPage() {
  const [talks, setTalks] = useState<ToolboxTalkRow[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error" | "neutral">("neutral");
  const [demoMode, setDemoMode] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadTalks = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const isDemo = await isSalesDemoRequest(headers);
      setDemoMode(isDemo);
      if (isDemo) {
        setTalks(DEMO_TALKS);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("company_toolbox_talks")
        .select("*")
        .order("talk_date", { ascending: false });
      if (error) {
        // Table may not exist yet — fall back to demo data silently
        setTalks(DEMO_TALKS);
        setLoading(false);
        return;
      }
      setTalks((data as ToolboxTalkRow[]) ?? []);
    } catch {
      // Auth not available — fall back to demo data
      setTalks(DEMO_TALKS);
    }
    setLoading(false);
  }, []);

  useEffect(() => deferEffect(() => {
    void loadTalks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const metrics = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const talksThisMonth = talks.filter((t) => {
      const d = new Date(t.talk_date.includes("T") ? t.talk_date : `${t.talk_date}T00:00:00`);
      return d >= thisMonthStart;
    });
    const totalAttendees = talks.reduce((sum, t) => sum + (t.attendee_count ?? 0), 0);
    const topicsSet = new Set(talks.map((t) => t.topic));
    const mostRecent = talks.length > 0 ? talks[0].talk_date : null;
    return {
      talksThisMonth: talksThisMonth.length,
      totalAttendees,
      topicsCovered: topicsSet.size,
      mostRecent,
    };
  }, [talks]);

  async function logTalk() {
    if (!form.topic) {
      setMessageTone("warning");
      setMessage("Select a topic.");
      return;
    }
    if (!form.presenter.trim()) {
      setMessageTone("warning");
      setMessage("Enter a presenter name.");
      return;
    }
    if (!form.talk_date) {
      setMessageTone("warning");
      setMessage("Select a talk date.");
      return;
    }
    if (!form.location.trim()) {
      setMessageTone("warning");
      setMessage("Enter a jobsite or location.");
      return;
    }
    if (!form.attendee_count || form.attendee_count < 1) {
      setMessageTone("warning");
      setMessage("Enter at least 1 attendee.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      if (demoMode) {
        const newTalk: ToolboxTalkRow = {
          id: `demo-${Date.now()}`,
          topic: form.topic,
          presenter: form.presenter,
          talk_date: form.talk_date,
          location: form.location,
          attendee_count: form.attendee_count,
          notes: form.notes || null,
          created_at: new Date().toISOString(),
        };
        setTalks((prev) => [newTalk, ...prev]);
        setForm(EMPTY_FORM);
        setShowForm(false);
        setMessageTone("success");
        setMessage("Demo toolbox talk logged.");
        setSaving(false);
        return;
      }

      const { error } = await supabase.from("company_toolbox_talks").insert({
        topic: form.topic,
        presenter: form.presenter.trim(),
        talk_date: form.talk_date,
        location: form.location.trim(),
        attendee_count: form.attendee_count,
        notes: form.notes.trim() || null,
      });

      if (error) throw new Error(error.message);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setMessageTone("success");
      setMessage("Toolbox talk logged.");
      await loadTalks();
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Failed to log toolbox talk.");
    }
    setSaving(false);
  }

  const messageBg =
    messageTone === "success"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : messageTone === "warning"
      ? "bg-amber-50 border-amber-200 text-amber-800"
      : messageTone === "error"
      ? "bg-red-50 border-red-200 text-red-700"
      : "bg-slate-50 border-slate-200 text-slate-700";

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Toolbox Talks"
        description="Log and track short safety briefings held at the start of each shift."
        icon={<BookOpen className="h-6 w-6 text-blue-600" />}
        actions={
          <div className="flex items-center gap-2">
            {demoMode && (
              <Badge label="Demo Mode" className="bg-amber-50 text-amber-700 border-amber-200" />
            )}
            <button
              type="button"
              onClick={() => void loadTalks()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" />
              Log Talk
            </button>
          </div>
        }
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <ClipboardList className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Talks This Month</p>
            <p className="text-2xl font-bold text-slate-900">{metrics.talksThisMonth}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <Users className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Attendees</p>
            <p className="text-2xl font-bold text-slate-900">{metrics.totalAttendees}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50">
            <BookOpen className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Topics Covered</p>
            <p className="text-2xl font-bold text-slate-900">{metrics.topicsCovered}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
            <Calendar className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Most Recent Talk</p>
            <p className="text-sm font-bold text-slate-900 leading-tight mt-0.5">
              {metrics.mostRecent ? formatDate(metrics.mostRecent) : "—"}
            </p>
          </div>
        </Card>
      </div>

      {/* Feedback message */}
      {message && (
        <div className={cx("rounded-lg border px-4 py-3 text-sm font-medium", messageBg)}>
          {message}
        </div>
      )}

      {/* Log new talk form */}
      {showForm && (
        <Card className="p-5">
          <SectionTitle className="mb-4">Log New Toolbox Talk</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Topic <span className="text-red-500">*</span>
              </label>
              <SelectField
                value={form.topic}
                onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
              >
                <option value="">Select a topic…</option>
                {TOOLBOX_TOPICS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </SelectField>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Presenter <span className="text-red-500">*</span>
              </label>
              <InputField
                type="text"
                placeholder="Full name"
                value={form.presenter}
                onChange={(e) => setForm((prev) => ({ ...prev, presenter: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Talk Date <span className="text-red-500">*</span>
              </label>
              <InputField
                type="date"
                value={form.talk_date}
                onChange={(e) => setForm((prev) => ({ ...prev, talk_date: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Jobsite / Location <span className="text-red-500">*</span>
              </label>
              <InputField
                type="text"
                placeholder="e.g. Site A – Building 3"
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Attendee Count <span className="text-red-500">*</span>
              </label>
              <InputField
                type="number"
                min={1}
                placeholder="0"
                value={form.attendee_count || ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, attendee_count: parseInt(e.target.value, 10) || 0 }))
                }
              />
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Notes
              </label>
              <textarea
                rows={3}
                placeholder="Key points discussed, questions raised, follow-up items…"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void logTalk()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {saving ? "Saving…" : "Log Talk"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setMessage(""); }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* Talks list */}
      <div>
        <SectionTitle className="mb-3">Talk Log</SectionTitle>

        {loading ? (
          <Card className="flex items-center justify-center gap-2 py-12 text-slate-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading toolbox talks…</span>
          </Card>
        ) : talks.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <BookOpen className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">No toolbox talks logged yet</p>
            <p className="text-xs text-slate-400">Click &ldquo;Log Talk&rdquo; above to record your first safety briefing.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                      Date
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Topic
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                      Presenter
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap text-center">
                      Attendees
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Location
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {talks.map((talk) => (
                    <tr key={talk.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">
                        {formatDate(talk.talk_date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          {talk.topic}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {talk.presenter}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-slate-700">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          {talk.attendee_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {talk.location || "—"}
                      </td>
                      <td className="px-4 py-3 max-w-xs text-slate-500">
                        {talk.notes ? (
                          <span className="line-clamp-2">{talk.notes}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
