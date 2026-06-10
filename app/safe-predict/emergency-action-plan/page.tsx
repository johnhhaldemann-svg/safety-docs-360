"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Building2, RefreshCw, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Card, PageHeader, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";

const supabase = getSupabaseBrowserClient();

type EmergencyContact = {
  name: string;
  phone: string;
};

type EAPRecord = {
  id: string;
  jobsite_name: string;
  last_reviewed: string | null;
  muster_point: string;
  coordinator_name: string;
  coordinator_phone: string;
  evacuation_route: string;
  emergency_contacts: EmergencyContact[];
  created_at: string;
};

const DEMO_PLANS: EAPRecord[] = [
  {
    id: "demo-1",
    jobsite_name: "Riverside Medical Centre",
    last_reviewed: "2025-11-14",
    muster_point: "North car park, Zone A — adjacent to site gate",
    coordinator_name: "Marcus Elliot",
    coordinator_phone: "0412 345 678",
    evacuation_route: "Exit via the north stairwell to Level 1, proceed through the main lobby and out to the north car park. Do not use lifts during evacuation.",
    emergency_contacts: [
      { name: "Marcus Elliot (Site Coordinator)", phone: "0412 345 678" },
      { name: "Sandra Wei (Project Manager)", phone: "0423 456 789" },
      { name: "Fire & Emergency (Site Line)", phone: "0400 111 222" },
    ],
    created_at: "2024-08-01T10:00:00Z",
  },
  {
    id: "demo-2",
    jobsite_name: "Downtown Tower B",
    last_reviewed: "2026-02-03",
    muster_point: "Collins Street footpath, south end — 50 m from hoarding",
    coordinator_name: "Priya Nambiar",
    coordinator_phone: "0434 567 890",
    evacuation_route: "Descend the east fire stairs to ground level. Pass through the hoarding pedestrian gate onto Collins Street. Proceed south to muster point.",
    emergency_contacts: [
      { name: "Priya Nambiar (Coordinator)", phone: "0434 567 890" },
      { name: "Tom Harding (Deputy)", phone: "0445 678 901" },
      { name: "Emergency Warden Desk", phone: "0400 999 000" },
    ],
    created_at: "2025-01-10T08:30:00Z",
  },
  {
    id: "demo-3",
    jobsite_name: "Eastside Highway Bridge",
    last_reviewed: null,
    muster_point: "Gravel laydown area, west embankment — marked with orange flag",
    coordinator_name: "Dean Waller",
    coordinator_phone: "0456 789 012",
    evacuation_route: "Move away from the bridge deck immediately. Descend the temporary access stairs on the west side. Proceed to the gravel laydown area. Keep clear of live traffic lanes at all times.",
    emergency_contacts: [
      { name: "Dean Waller (Coordinator)", phone: "0456 789 012" },
      { name: "Harriet Ong (Safety Officer)", phone: "0467 890 123" },
      { name: "Traffic Management Control", phone: "0400 777 888" },
    ],
    created_at: "2025-06-01T09:00:00Z",
  },
];

const REVIEW_THRESHOLD_MONTHS = 12;

function planStatus(lastReviewed: string | null): "current" | "needs-review" | "missing" {
  if (!lastReviewed) return "missing";
  const reviewed = new Date(lastReviewed);
  const now = new Date();
  const diffMs = now.getTime() - reviewed.getTime();
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
  return diffMonths > REVIEW_THRESHOLD_MONTHS ? "needs-review" : "current";
}

const STATUS_STYLES: Record<string, string> = {
  current: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "needs-review": "bg-amber-50 text-amber-700 border-amber-200",
  missing: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  current: "Current",
  "needs-review": "Needs Review",
  missing: "Missing",
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

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-y"
      />
    </div>
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

const EMPTY_FORM = {
  jobsite_name: "",
  coordinator_name: "",
  coordinator_phone: "",
  muster_point: "",
  evacuation_route: "",
  last_reviewed: "",
  contact1_name: "",
  contact1_phone: "",
  contact2_name: "",
  contact2_phone: "",
  contact3_name: "",
  contact3_phone: "",
};

export default function EmergencyActionPlanPage() {
  const [plans, setPlans] = useState<EAPRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async (_forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from("jobsite_emergency_plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (dbErr) throw dbErr;

      if (!data || data.length === 0) {
        setIsDemoMode(true);
        setPlans(DEMO_PLANS);
      } else {
        setIsDemoMode(false);
        setPlans(data as EAPRecord[]);
      }
    } catch {
      setIsDemoMode(true);
      setPlans(DEMO_PLANS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const plansOnFile = plans.length;
  const plansNeedingReview = plans.filter((p) => planStatus(p.last_reviewed) === "needs-review").length;
  // For demo purposes, show a static count of active jobsites without a plan
  const sitesWithoutPlan = isDemoMode ? 2 : 0;

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const contacts: EmergencyContact[] = [
        { name: form.contact1_name, phone: form.contact1_phone },
        { name: form.contact2_name, phone: form.contact2_phone },
        { name: form.contact3_name, phone: form.contact3_phone },
      ].filter((c) => c.name || c.phone);

      const payload = {
        jobsite_name: form.jobsite_name,
        coordinator_name: form.coordinator_name,
        coordinator_phone: form.coordinator_phone,
        muster_point: form.muster_point,
        evacuation_route: form.evacuation_route,
        last_reviewed: form.last_reviewed || null,
        emergency_contacts: contacts,
      };

      const { error: insertErr } = await supabase
        .from("jobsite_emergency_plans")
        .insert([payload]);

      if (insertErr) throw insertErr;

      setSaveMsg("Plan saved successfully.");
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load(true);
    } catch {
      if (isDemoMode) {
        const contacts: EmergencyContact[] = [
          { name: form.contact1_name, phone: form.contact1_phone },
          { name: form.contact2_name, phone: form.contact2_phone },
          { name: form.contact3_name, phone: form.contact3_phone },
        ].filter((c) => c.name || c.phone);

        const newPlan: EAPRecord = {
          id: `local-${Date.now()}`,
          jobsite_name: form.jobsite_name,
          coordinator_name: form.coordinator_name,
          coordinator_phone: form.coordinator_phone,
          muster_point: form.muster_point,
          evacuation_route: form.evacuation_route,
          last_reviewed: form.last_reviewed || null,
          emergency_contacts: contacts,
          created_at: new Date().toISOString(),
        };
        setPlans((prev) => [newPlan, ...prev]);
        setSaveMsg("Plan saved (demo mode — not persisted).");
        setForm(EMPTY_FORM);
        setShowForm(false);
      } else {
        setSaveMsg("Failed to save plan. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)]">
      <PageHeader
        title="Emergency Action Plans"
        subtitle="Site-specific evacuation procedures, emergency contacts, and response protocols for each active jobsite."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading}
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm((v) => !v); setSaveMsg(null); }}
              className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              {showForm ? "Cancel" : "+ New Plan"}
            </button>
          </div>
        }
      />

      {isDemoMode && (
        <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 sm:mx-7">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Demo mode — showing sample data. Connect the <strong>jobsite_emergency_plans</strong> table to see live records.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 sm:px-7">
        {[
          {
            icon: ShieldCheck,
            label: "Plans on File",
            value: plansOnFile,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            icon: RefreshCw,
            label: "Needs Review (>12 mo)",
            value: plansNeedingReview,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            icon: Building2,
            label: "Sites Without a Plan",
            value: sitesWithoutPlan,
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

      <div className="px-4 pb-8 sm:px-7">
        {/* New Plan Form */}
        {showForm && (
          <Card className="mb-6 p-5">
            <SectionTitle title="Create / Update Emergency Action Plan" />
            <form onSubmit={(e) => void handleSave(e)} className="mt-4 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label="Jobsite Name"
                  value={form.jobsite_name}
                  onChange={(v) => setField("jobsite_name", v)}
                  placeholder="e.g. Riverside Medical Centre"
                  required
                />
                <InputField
                  label="Last Reviewed Date"
                  value={form.last_reviewed}
                  onChange={(v) => setField("last_reviewed", v)}
                  type="date"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label="Emergency Coordinator"
                  value={form.coordinator_name}
                  onChange={(v) => setField("coordinator_name", v)}
                  placeholder="Full name"
                  required
                />
                <InputField
                  label="Coordinator Phone"
                  value={form.coordinator_phone}
                  onChange={(v) => setField("coordinator_phone", v)}
                  placeholder="e.g. 0412 345 678"
                />
              </div>

              <InputField
                label="Muster Point Location"
                value={form.muster_point}
                onChange={(v) => setField("muster_point", v)}
                placeholder="e.g. North car park, Zone A — adjacent to site gate"
                required
              />

              <TextAreaField
                label="Evacuation Route Description"
                value={form.evacuation_route}
                onChange={(v) => setField("evacuation_route", v)}
                placeholder="Describe the primary evacuation route step by step…"
                rows={3}
              />

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600">Emergency Contacts</p>
                <div className="grid gap-2">
                  {([1, 2, 3] as const).map((n) => (
                    <div key={n} className="grid grid-cols-2 gap-2">
                      <InputField
                        label={`Contact ${n} Name`}
                        value={form[`contact${n}_name` as keyof typeof EMPTY_FORM]}
                        onChange={(v) => setField(`contact${n}_name` as keyof typeof EMPTY_FORM, v)}
                        placeholder="Name / role"
                      />
                      <InputField
                        label={`Contact ${n} Phone`}
                        value={form[`contact${n}_phone` as keyof typeof EMPTY_FORM]}
                        onChange={(v) => setField(`contact${n}_phone` as keyof typeof EMPTY_FORM, v)}
                        placeholder="Phone number"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving || !form.jobsite_name || !form.coordinator_name || !form.muster_point}
                  className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Plan"}
                </button>
                {saveMsg && (
                  <span
                    className={cx(
                      "text-sm font-medium",
                      saveMsg.includes("success") || saveMsg.includes("demo")
                        ? "text-emerald-700"
                        : "text-red-600"
                    )}
                  >
                    {saveMsg}
                  </span>
                )}
              </div>
            </form>
          </Card>
        )}

        {/* Plan list */}
        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            Loading plans…
          </div>
        ) : plans.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-14">
            <ShieldCheck className="h-10 w-10 text-slate-300" />
            <p className="font-semibold text-slate-500">No emergency action plans on file.</p>
            <p className="text-sm text-slate-400">Click &ldquo;+ New Plan&rdquo; to create the first one.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            <SectionTitle title="Plans by Jobsite" />
            {plans.map((plan) => {
              const status = planStatus(plan.last_reviewed);
              const isExpanded = expandedId === plan.id;
              return (
                <Card key={plan.id} className="overflow-hidden p-0">
                  {/* Row header */}
                  <button
                    type="button"
                    className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                    onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                  >
                    <span className={cx("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", status === "current" ? "bg-emerald-50" : status === "needs-review" ? "bg-amber-50" : "bg-red-50")}>
                      <ShieldCheck className={cx("h-4 w-4", status === "current" ? "text-emerald-600" : status === "needs-review" ? "text-amber-500" : "text-red-500")} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">{plan.jobsite_name}</span>
                        <Badge
                          label={STATUS_LABELS[status]}
                          className={STATUS_STYLES[status]}
                        />
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                        <span>
                          <span className="font-semibold text-slate-700">Coordinator:</span>{" "}
                          {plan.coordinator_name}
                        </span>
                        <span>
                          <span className="font-semibold text-slate-700">Muster:</span>{" "}
                          {plan.muster_point}
                        </span>
                        <span>
                          <span className="font-semibold text-slate-700">Last reviewed:</span>{" "}
                          {formatDate(plan.last_reviewed)}
                        </span>
                      </div>
                    </div>
                    <span className="ml-2 mt-1 text-xs text-slate-400 shrink-0">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">Evacuation Route</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{plan.evacuation_route || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-2">Emergency Contacts</p>
                        {plan.emergency_contacts && plan.emergency_contacts.length > 0 ? (
                          <ul className="flex flex-col gap-1.5">
                            {plan.emergency_contacts.map((c, i) => (
                              <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                                <span className="font-medium">{c.name}</span>
                                {c.phone && (
                                  <>
                                    <span className="text-slate-300">—</span>
                                    <a
                                      href={`tel:${c.phone.replace(/\s/g, "")}`}
                                      className="text-blue-600 hover:underline"
                                    >
                                      {c.phone}
                                    </a>
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-slate-400">No contacts listed.</p>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
