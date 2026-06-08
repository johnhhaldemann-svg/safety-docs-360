"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen, CheckCircle2, ClipboardList, GraduationCap, HardHat,
  Plus, RefreshCw, ShieldAlert, Star, ToggleLeft, ToggleRight, Users,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Card, PageHeader, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";

const supabase = getSupabaseBrowserClient();

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

type Program = { id: string; name: string; description: string | null; audience: string; active: boolean };
type Requirement = { id: string; program_id: string; jobsite_id: string | null; active: boolean };
type Jobsite = { id: string; name: string };

const AUDIENCE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  worker:        { label: "Worker",        icon: HardHat,    color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
  visitor:       { label: "Visitor",       icon: Users,      color: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200" },
  subcontractor: { label: "Subcontractor", icon: ClipboardList, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  supervisor:    { label: "Supervisor",    icon: GraduationCap, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
};
const AUDIENCE_KEYS = Object.keys(AUDIENCE_CONFIG);

const DEFAULT_PROGRAMS = [
  "Site Safety Orientation",
  "Daily Pre-Task Briefing",
  "Fire & Emergency Procedures",
  "PPE Requirements",
  "Hot Work Safety",
  "Confined Space Awareness",
  "Working at Heights",
  "Electrical Safety",
];

export default function SafePredictInductionsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [jobsites, setJobsites] = useState<Jobsite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New program state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAudience, setNewAudience] = useState("worker");
  const [defaultAudience, setDefaultAudience] = useState("worker"); // persisted default
  const [creating, setCreating] = useState(false);

  // New requirement state
  const [reqProgramId, setReqProgramId] = useState("");
  const [reqJobsiteId, setReqJobsiteId] = useState("");
  const [addingReq, setAddingReq] = useState(false);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const h = await authHeaders();
      const opts = { headers: h, cache: forceRefresh ? ("no-cache" as RequestCache) : ("default" as RequestCache) };
      const [pRes, rRes, jRes] = await Promise.all([
        fetch("/api/company/inductions/programs", opts),
        fetch("/api/company/inductions/requirements", opts),
        fetch("/api/company/jobsites", opts),
      ]);
      const pData = (await pRes.json().catch(() => null)) as { programs?: Program[] } | null;
      const rData = (await rRes.json().catch(() => null)) as { requirements?: Requirement[] } | null;
      const jData = (await jRes.json().catch(() => null)) as { jobsites?: Array<{ id?: string; name?: string }> } | null;
      setPrograms(pData?.programs ?? []);
      setRequirements(rData?.requirements ?? []);
      setJobsites(
        (jData?.jobsites ?? [])
          .map((j) => ({ id: String(j.id ?? ""), name: String(j.name ?? "Jobsite") }))
          .filter((j) => j.id)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Keep newAudience in sync with default when panel opens
  useEffect(() => {
    if (showCreate) setNewAudience(defaultAudience);
  }, [showCreate, defaultAudience]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const h = await authHeaders();
      const res = await fetch("/api/company/inductions/programs", {
        method: "POST",
        headers: h,
        body: JSON.stringify({ name: newName.trim(), audience: newAudience }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Create failed.");
      setSuccess(`"${newName.trim()}" program created.`);
      setNewName("");
      setShowCreate(false);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setCreating(false);
    }
  }

  async function handleAddRequirement() {
    if (!reqProgramId) return;
    setAddingReq(true);
    setError(null);
    setSuccess(null);
    try {
      const h = await authHeaders();
      const res = await fetch("/api/company/inductions/requirements", {
        method: "POST",
        headers: h,
        body: JSON.stringify({ programId: reqProgramId, jobsiteId: reqJobsiteId || null }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Failed to add requirement.");
      setSuccess("Requirement added.");
      setReqProgramId("");
      setReqJobsiteId("");
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add requirement.");
    } finally {
      setAddingReq(false);
    }
  }

  async function toggleActive(p: Program) {
    setError(null);
    try {
      const h = await authHeaders();
      const res = await fetch(`/api/company/inductions/programs/${encodeURIComponent(p.id)}`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ active: !p.active }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Update failed.");
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    }
  }

  function programName(id: string) {
    return programs.find((p) => p.id === id)?.name ?? id.slice(0, 8) + "…";
  }
  function jobsiteName(id: string | null) {
    if (!id) return "All jobsites";
    return jobsites.find((j) => j.id === id)?.name ?? id.slice(0, 8) + "…";
  }

  const activePrograms = programs.filter((p) => p.active);

  return (
    <div className="min-h-[calc(100vh-5rem)]">
      <PageHeader
        title="Induction Programs"
        subtitle="Define induction programs and assign them to jobsites. Field crews record completions on each jobsite's Inductions tab."
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
              New Program
            </button>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4 sm:px-7">
        {[
          { icon: BookOpen,       label: "Total Programs",   value: programs.length,        color: "text-blue-600",    bg: "bg-blue-50" },
          { icon: CheckCircle2,   label: "Active",           value: activePrograms.length,  color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: ClipboardList,  label: "Requirements",     value: requirements.filter(r => r.active).length, color: "text-violet-600", bg: "bg-violet-50" },
          { icon: HardHat,        label: "Jobsites Covered", value: new Set(requirements.filter(r => r.active && r.jobsite_id).map(r => r.jobsite_id)).size, color: "text-amber-600", bg: "bg-amber-50" },
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
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
          </div>
        )}

        {/* Default audience preference */}
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Star className="h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-sm font-semibold text-slate-700">Default audience type for new programs:</p>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_KEYS.map((key) => {
                const cfg = AUDIENCE_CONFIG[key];
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setDefaultAudience(key); setNewAudience(key); }}
                    className={cx(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition",
                      defaultAudience === key
                        ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-blue-300`
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-slate-400 pl-7">
            This pre-selects the audience when you create a new program. You can change it per program.
          </p>
        </div>

        {/* Create Program Panel */}
        {showCreate && (
          <Card>
            <div className="border-b border-slate-100 px-5 py-4">
              <SectionTitle title="New Induction Program" hint="Define a named program and assign it an audience type." />
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Name with quick-pick suggestions */}
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                    Program Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Site Safety Orientation"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  {/* Quick-pick common program names */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {DEFAULT_PROGRAMS.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setNewName(name)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audience */}
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                    Audience Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {AUDIENCE_KEYS.map((key) => {
                      const cfg = AUDIENCE_CONFIG[key];
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setNewAudience(key)}
                          className={cx(
                            "flex items-center gap-2 rounded-lg border p-2.5 text-sm font-semibold transition",
                            newAudience === key
                              ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-blue-200`
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {cfg.label}
                          {key === defaultAudience && (
                            <Star className="ml-auto h-3 w-3 text-amber-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={creating || !newName.trim()}
                  className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {creating ? "Creating…" : "Create Program"}
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

        {/* Programs list */}
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <SectionTitle
              title="Program Library"
              hint="Activate or deactivate programs. Active programs can be assigned as jobsite requirements."
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {!loading && programs.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
              <BookOpen className="h-10 w-10" />
              <p className="text-sm font-semibold">No programs yet</p>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-1 flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" /> New Program
              </button>
            </div>
          )}

          {!loading && programs.length > 0 && (
            <ul className="divide-y divide-slate-50">
              {programs.map((p) => {
                const cfg = AUDIENCE_CONFIG[p.audience] ?? AUDIENCE_CONFIG.worker;
                const Icon = cfg.icon;
                return (
                  <li key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors">
                    <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg", cfg.bg)}>
                      <Icon className={cx("h-5 w-5", cfg.color)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 leading-5">{p.name}</p>
                      <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold mt-0.5", cfg.bg, cfg.color, cfg.border)}>
                        {cfg.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleActive(p)}
                      className={cx(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition",
                        p.active
                          ? "border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      )}
                    >
                      {p.active
                        ? <><ToggleRight className="h-3.5 w-3.5" /> Active</>
                        : <><ToggleLeft className="h-3.5 w-3.5" /> Inactive</>
                      }
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Requirements */}
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <SectionTitle
              title="Jobsite Requirements"
              hint="Assign a program to all jobsites or one specific site. Leave 'All jobsites' to make it company-wide."
              action={
                activePrograms.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={reqProgramId}
                      onChange={(e) => setReqProgramId(e.target.value)}
                      className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 focus:border-blue-400 focus:outline-none"
                    >
                      <option value="">Select program…</option>
                      {activePrograms.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <select
                      value={reqJobsiteId}
                      onChange={(e) => setReqJobsiteId(e.target.value)}
                      className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 focus:border-blue-400 focus:outline-none"
                    >
                      <option value="">All jobsites</option>
                      {jobsites.map((j) => (
                        <option key={j.id} value={j.id}>{j.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleAddRequirement()}
                      disabled={addingReq || !reqProgramId}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {addingReq ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Add
                    </button>
                  </div>
                ) : null
              }
            />
          </div>

          {requirements.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
              <ClipboardList className="h-8 w-8" />
              <p className="text-sm font-semibold">No requirements set</p>
              <p className="text-xs">Activate a program above, then assign it to jobsites here.</p>
            </div>
          )}

          {requirements.length > 0 && (
            <ul className="divide-y divide-slate-50">
              {requirements.map((r) => {
                const prog = programs.find((p) => p.id === r.program_id);
                const cfg = prog ? (AUDIENCE_CONFIG[prog.audience] ?? AUDIENCE_CONFIG.worker) : AUDIENCE_CONFIG.worker;
                const Icon = cfg.icon;
                return (
                  <li key={r.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                    <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", cfg.bg)}>
                      <Icon className={cx("h-4 w-4", cfg.color)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-sm leading-5">{programName(r.program_id)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {jobsiteName(r.jobsite_id)}
                        {prog && (
                          <span className={cx("ml-2 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold", cfg.bg, cfg.color, cfg.border)}>
                            {cfg.label}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className={cx(
                      "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold",
                      r.active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-100 text-slate-500"
                    )}>
                      {r.active ? "Active" : "Inactive"}
                    </span>
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
