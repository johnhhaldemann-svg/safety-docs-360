"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen, Check, CheckCircle2, ChevronDown, ChevronUp, ClipboardList,
  GraduationCap, HardHat, Pencil, Plus, RefreshCw, ShieldAlert, Star,
  ToggleLeft, ToggleRight, Users, X,
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

type Program = {
  id: string; name: string; description: string | null;
  audience: string; active: boolean; required_docs?: string[];
};
type Completion = {
  id: string; program_id: string; jobsite_id: string | null;
  user_id: string | null; visitor_display_name: string | null;
  completed_at: string; notes: string | null;
};
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
  const [newAudiences, setNewAudiences] = useState<string[]>(["worker"]);
  const [defaultAudiences, setDefaultAudiences] = useState<string[]>(["worker"]);
  const [creating, setCreating] = useState(false);

  // New requirement state
  const [reqProgramId, setReqProgramId] = useState("");
  const [reqJobsiteId, setReqJobsiteId] = useState("");
  const [addingReq, setAddingReq] = useState(false);

  // All completions (loaded once for gap analysis)
  const [allCompletions, setAllCompletions] = useState<Completion[]>([]);
  const [loadingAllCompletions, setLoadingAllCompletions] = useState(false);
  // AI sync
  const [syncingAI, setSyncingAI] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  // Program detail expand
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completions, setCompletions] = useState<Record<string, Completion[]>>({});
  const [loadingCompletions, setLoadingCompletions] = useState<Record<string, boolean>>({});
  // Inline description editing
  const [editingDescId, setEditingDescId] = useState<string | null>(null);
  const [editingDescVal, setEditingDescVal] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  // Required docs inline editing
  const [newDocInput, setNewDocInput] = useState<Record<string, string>>({});
  const descRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const h = await authHeaders();
      const opts = { headers: h, cache: forceRefresh ? ("no-cache" as RequestCache) : ("default" as RequestCache) };
      const [pRes, rRes, jRes, cRes] = await Promise.all([
        fetch("/api/company/inductions/programs", opts),
        fetch("/api/company/inductions/requirements", opts),
        fetch("/api/company/jobsites", opts),
        fetch("/api/company/inductions/completions", opts),
      ]);
      const pData = (await pRes.json().catch(() => null)) as { programs?: Program[] } | null;
      const rData = (await rRes.json().catch(() => null)) as { requirements?: Requirement[] } | null;
      const jData = (await jRes.json().catch(() => null)) as { jobsites?: Array<{ id?: string; name?: string }> } | null;
      const cData = (await cRes.json().catch(() => null)) as { completions?: Completion[] } | null;
      setPrograms(pData?.programs ?? []);
      setRequirements(rData?.requirements ?? []);
      setJobsites(
        (jData?.jobsites ?? [])
          .map((j) => ({ id: String(j.id ?? ""), name: String(j.name ?? "Jobsite") }))
          .filter((j) => j.id)
      );
      const allC = cData?.completions ?? [];
      setAllCompletions(allC);
      // Pre-populate per-program completions map
      const byProg: Record<string, Completion[]> = {};
      allC.forEach((c) => { (byProg[c.program_id] ??= []).push(c); });
      setCompletions(byProg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Keep newAudiences in sync with defaults when panel opens
  useEffect(() => {
    if (showCreate) setNewAudiences([...defaultAudiences]);
  }, [showCreate]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleAudienceSelection(key: string) {
    setNewAudiences((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((a) => a !== key) : prev) : [...prev, key]
    );
  }

  function toggleDefaultAudience(key: string) {
    setDefaultAudiences((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((a) => a !== key) : prev) : [...prev, key]
    );
  }

  async function handleCreate() {
    if (!newName.trim() || newAudiences.length === 0) return;
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const h = await authHeaders();
      // Create one program per selected audience type
      const results = await Promise.all(
        newAudiences.map((aud) =>
          fetch("/api/company/inductions/programs", {
            method: "POST",
            headers: h,
            body: JSON.stringify({ name: newName.trim(), audience: aud }),
          }).then((r) => r.json().catch(() => null) as Promise<{ error?: string } | null>)
        )
      );
      const failed = results.filter((r) => r && "error" in r && r.error);
      if (failed.length > 0) throw new Error((failed[0] as { error: string }).error);
      const label = newAudiences.length > 1
        ? `${newAudiences.length} programs created for "${newName.trim()}"`
        : `"${newName.trim()}" program created.`;
      setSuccess(label);
      setNewName("");
      setNewAudiences([...defaultAudiences]);
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

  async function handleSyncAI() {
    setSyncingAI(true);
    setSyncResult(null);
    try {
      const h = await authHeaders();
      // Trigger AI knowledge map rebuild so induction data is re-indexed
      const res = await fetch("/api/ai-knowledge-map/rebuild-index", { method: "POST", headers: h });
      const data = (await res.json().catch(() => null)) as { nodesIndexed?: number; error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Sync failed.");
      setSyncResult(`AI knowledge map updated — ${data?.nodesIndexed ?? "all"} nodes indexed. The AI will now factor induction gaps into risk recommendations.`);
    } catch (e) {
      setSyncResult(`Note: ${e instanceof Error ? e.message : "Could not reach AI index endpoint."}`);
    } finally {
      setSyncingAI(false);
    }
  }

  // Gap analysis: derive coverage issues from loaded data
  function computeGaps() {
    const activeReqs = requirements.filter((r) => r.active);
    const activePrograms = programs.filter((p) => p.active);

    // Programs with no requirements at all
    const undeployed = activePrograms.filter(
      (p) => !activeReqs.some((r) => r.program_id === p.id)
    );

    // Requirements with zero completions
    const uncompleted = activeReqs.filter(
      (r) => !allCompletions.some((c) => c.program_id === r.program_id)
    );

    // Jobsites that have at least one requirement but zero completions scoped to them
    const jobsitesWithReqs = new Set(
      activeReqs.filter((r) => r.jobsite_id).map((r) => r.jobsite_id!)
    );
    const jobsitesWithCompletions = new Set(
      allCompletions.filter((c) => c.jobsite_id).map((c) => c.jobsite_id!)
    );
    const jobsiteGaps = Array.from(jobsitesWithReqs).filter(
      (jid) => !jobsitesWithCompletions.has(jid)
    );

    return { undeployed, uncompleted, jobsiteGaps };
  }

  async function toggleExpand(p: Program) {
    if (expandedId === p.id) { setExpandedId(null); return; }
    setExpandedId(p.id);
    // Load completions if not already fetched
    if (!completions[p.id]) {
      setLoadingCompletions((prev) => ({ ...prev, [p.id]: true }));
      try {
        const h = await authHeaders();
        const res = await fetch(`/api/company/inductions/completions`, { headers: h });
        const data = (await res.json().catch(() => null)) as { completions?: Completion[] } | null;
        const all = data?.completions ?? [];
        // Group by program_id
        const byProgram: Record<string, Completion[]> = {};
        all.forEach((c) => { (byProgram[c.program_id] ??= []).push(c); });
        setCompletions((prev) => ({ ...prev, ...byProgram }));
      } catch { /* ignore */ } finally {
        setLoadingCompletions((prev) => ({ ...prev, [p.id]: false }));
      }
    }
  }

  function startEditDesc(p: Program) {
    setEditingDescId(p.id);
    setEditingDescVal(p.description ?? "");
    setTimeout(() => descRef.current?.focus(), 50);
  }

  async function saveDesc(p: Program) {
    setSavingDesc(true);
    try {
      const h = await authHeaders();
      await fetch(`/api/company/inductions/programs/${encodeURIComponent(p.id)}`, {
        method: "PATCH", headers: h,
        body: JSON.stringify({ description: editingDescVal }),
      });
      setPrograms((prev) =>
        prev.map((x) => x.id === p.id ? { ...x, description: editingDescVal || null } : x)
      );
      setEditingDescId(null);
    } catch { /* ignore */ } finally {
      setSavingDesc(false);
    }
  }

  async function addRequiredDoc(p: Program, doc: string) {
    const trimmed = doc.trim();
    if (!trimmed) return;
    const updated = [...(p.required_docs ?? []), trimmed];
    const h = await authHeaders();
    await fetch(`/api/company/inductions/programs/${encodeURIComponent(p.id)}`, {
      method: "PATCH", headers: h,
      body: JSON.stringify({ requiredDocs: updated }),
    });
    setPrograms((prev) =>
      prev.map((x) => x.id === p.id ? { ...x, required_docs: updated } : x)
    );
    setNewDocInput((prev) => ({ ...prev, [p.id]: "" }));
  }

  async function removeRequiredDoc(p: Program, idx: number) {
    const updated = (p.required_docs ?? []).filter((_, i) => i !== idx);
    const h = await authHeaders();
    await fetch(`/api/company/inductions/programs/${encodeURIComponent(p.id)}`, {
      method: "PATCH", headers: h,
      body: JSON.stringify({ requiredDocs: updated }),
    });
    setPrograms((prev) =>
      prev.map((x) => x.id === p.id ? { ...x, required_docs: updated } : x)
    );
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
  const gaps = computeGaps();
  const totalGaps = gaps.undeployed.length + gaps.uncompleted.length + gaps.jobsiteGaps.length;

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
            <p className="text-sm font-semibold text-slate-700">Default audience types for new programs:</p>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_KEYS.map((key) => {
                const cfg = AUDIENCE_CONFIG[key];
                const Icon = cfg.icon;
                const selected = defaultAudiences.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleDefaultAudience(key)}
                    className={cx(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition",
                      selected
                        ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-blue-300`
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    {selected
                      ? <Check className="h-3.5 w-3.5" />
                      : <Icon className="h-3.5 w-3.5" />
                    }
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-slate-400 pl-7">
            Select one or more — these pre-select when you open &quot;New Program&quot;. At least one must remain selected.
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

                {/* Audience — multi-select */}
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                    Audience Type
                    <span className="ml-1.5 normal-case font-semibold text-slate-400">(select all that apply)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {AUDIENCE_KEYS.map((key) => {
                      const cfg = AUDIENCE_CONFIG[key];
                      const Icon = cfg.icon;
                      const selected = newAudiences.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleAudienceSelection(key)}
                          className={cx(
                            "relative flex items-center gap-2 rounded-lg border p-2.5 text-sm font-semibold transition",
                            selected
                              ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-blue-200`
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {cfg.label}
                          {selected && (
                            <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                              <Check className="h-2.5 w-2.5 text-white" />
                            </span>
                          )}
                          {!selected && defaultAudiences.includes(key) && (
                            <Star className="ml-auto h-3 w-3 text-amber-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {newAudiences.length > 1 && (
                    <p className="mt-2 text-[11px] font-semibold text-blue-700">
                      ✓ Will create {newAudiences.length} separate programs (one per audience type)
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={creating || !newName.trim() || newAudiences.length === 0}
                  className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {creating
                    ? "Creating…"
                    : newAudiences.length > 1
                      ? `Create ${newAudiences.length} Programs`
                      : "Create Program"
                  }
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
            <ul className="divide-y divide-slate-100">
              {programs.map((p) => {
                const cfg = AUDIENCE_CONFIG[p.audience] ?? AUDIENCE_CONFIG.worker;
                const Icon = cfg.icon;
                const isExpanded = expandedId === p.id;
                const progCompletions = completions[p.id] ?? [];
                const isLoadingC = loadingCompletions[p.id];
                const docs = p.required_docs ?? [];

                return (
                  <li key={p.id}>
                    {/* Row header — click anywhere to expand */}
                    <button
                      type="button"
                      onClick={() => void toggleExpand(p)}
                      className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50/60 transition-colors"
                    >
                      <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg", cfg.bg)}>
                        <Icon className={cx("h-5 w-5", cfg.color)} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 leading-5">{p.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold", cfg.bg, cfg.color, cfg.border)}>
                            {cfg.label}
                          </span>
                          {p.description && (
                            <span className="text-xs text-slate-400 truncate max-w-[240px]">{p.description}</span>
                          )}
                          {!p.description && (
                            <span className="text-xs text-slate-300 italic">No description — click to add</span>
                          )}
                          {docs.length > 0 && (
                            <span className="text-[11px] font-semibold text-slate-400">{docs.length} required doc{docs.length !== 1 ? "s" : ""}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
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
                          {p.active ? <><ToggleRight className="h-3.5 w-3.5" /> Active</> : <><ToggleLeft className="h-3.5 w-3.5" /> Inactive</>}
                        </button>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-slate-400" />
                          : <ChevronDown className="h-4 w-4 text-slate-400" />
                        }
                      </div>
                    </button>

                    {/* Expand panel */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-5 space-y-5">
                        {/* Description */}
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Description</p>
                            {editingDescId !== p.id && (
                              <button type="button" onClick={() => startEditDesc(p)}
                                className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:text-blue-600 hover:border-blue-200 transition">
                                <Pencil className="h-3 w-3" /> Edit
                              </button>
                            )}
                          </div>
                          {editingDescId === p.id ? (
                            <div className="space-y-2">
                              <textarea
                                ref={descRef}
                                value={editingDescVal}
                                onChange={(e) => setEditingDescVal(e.target.value)}
                                rows={3}
                                placeholder="Describe what this induction program covers…"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              />
                              <div className="flex gap-2">
                                <button type="button" onClick={() => void saveDesc(p)} disabled={savingDesc}
                                  className="flex h-7 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">
                                  {savingDesc ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                                </button>
                                <button type="button" onClick={() => setEditingDescId(null)}
                                  className="h-7 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-600 leading-relaxed">
                              {p.description || <span className="text-slate-400 italic">No description yet.</span>}
                            </p>
                          )}
                        </div>

                        {/* Required documents */}
                        <div>
                          <p className="mb-1.5 text-xs font-black uppercase tracking-wide text-slate-500">Required Documents / Steps</p>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {docs.length === 0 && (
                              <span className="text-xs text-slate-400 italic">None listed yet.</span>
                            )}
                            {docs.map((doc, idx) => (
                              <span key={idx} className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                                {doc}
                                <button type="button" onClick={() => void removeRequiredDoc(p, idx)}
                                  className="ml-0.5 text-slate-400 hover:text-red-600 transition">
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input
                              value={newDocInput[p.id] ?? ""}
                              onChange={(e) => setNewDocInput((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter") void addRequiredDoc(p, newDocInput[p.id] ?? ""); }}
                              placeholder="Add document or step (press Enter)"
                              className="h-8 flex-1 max-w-xs rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                            />
                            <button type="button"
                              onClick={() => void addRequiredDoc(p, newDocInput[p.id] ?? "")}
                              className="flex h-8 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100">
                              <Plus className="h-3.5 w-3.5" /> Add
                            </button>
                          </div>
                        </div>

                        {/* Completions */}
                        <div>
                          <p className="mb-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                            Completions
                            {progCompletions.length > 0 && (
                              <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">
                                {progCompletions.length}
                              </span>
                            )}
                          </p>
                          {isLoadingC && (
                            <p className="flex items-center gap-1.5 text-xs text-slate-400">
                              <RefreshCw className="h-3 w-3 animate-spin" /> Loading completions…
                            </p>
                          )}
                          {!isLoadingC && progCompletions.length === 0 && (
                            <p className="text-xs text-slate-400 italic">No completions recorded yet for this program.</p>
                          )}
                          {!isLoadingC && progCompletions.length > 0 && (
                            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-slate-100 text-left text-[11px] font-black text-slate-400">
                                    <th className="px-3 py-2">Person</th>
                                    <th className="px-3 py-2 hidden sm:table-cell">Jobsite</th>
                                    <th className="px-3 py-2">Completed</th>
                                    <th className="px-3 py-2 hidden md:table-cell">Notes</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {progCompletions.slice(0, 10).map((c) => (
                                    <tr key={c.id} className="hover:bg-slate-50/60">
                                      <td className="px-3 py-2 font-semibold text-slate-700">
                                        {c.visitor_display_name ?? (c.user_id ? c.user_id.slice(0, 8) + "…" : "—")}
                                      </td>
                                      <td className="px-3 py-2 text-slate-500 hidden sm:table-cell">
                                        {jobsiteName(c.jobsite_id)}
                                      </td>
                                      <td className="px-3 py-2 text-slate-500">
                                        {new Date(c.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                      </td>
                                      <td className="px-3 py-2 text-slate-400 hidden md:table-cell">
                                        {c.notes ?? "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {progCompletions.length > 10 && (
                                <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
                                  Showing 10 of {progCompletions.length} completions
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* AI Gap Analysis */}
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <SectionTitle
              title="AI Gap Analysis"
              hint="Automatically computed from your active programs, requirements, and completion records. Sync to AI so recommendations include induction gaps."
              action={
                <button
                  type="button"
                  onClick={() => void handleSyncAI()}
                  disabled={syncingAI}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-bold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                >
                  {syncingAI
                    ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Syncing…</>
                    : <><BookOpen className="h-3.5 w-3.5" /> Sync to AI</>
                  }
                </button>
              }
            />
          </div>

          {syncResult && (
            <div className={cx(
              "mx-5 mt-4 rounded-lg border px-4 py-3 text-xs font-semibold",
              syncResult.startsWith("Note:")
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            )}>
              {syncResult}
            </div>
          )}

          <div className="p-5 space-y-3">
            {loading && (
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <RefreshCw className="h-3 w-3 animate-spin" /> Analysing…
              </p>
            )}

            {!loading && totalGaps === 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-emerald-800">No gaps detected</p>
                  <p className="text-xs text-emerald-700">All active programs are deployed and have completions recorded.</p>
                </div>
              </div>
            )}

            {!loading && gaps.undeployed.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-amber-700">
                  ⚠ Undeployed Programs ({gaps.undeployed.length})
                </p>
                <p className="mb-3 text-xs text-amber-700">
                  These programs are active but have no jobsite requirements assigned — crews won&apos;t be prompted to complete them.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {gaps.undeployed.map((p) => {
                    const cfg = AUDIENCE_CONFIG[p.audience] ?? AUDIENCE_CONFIG.worker;
                    return (
                      <span key={p.id} className={cx("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold", cfg.bg, cfg.color, cfg.border)}>
                        {p.name}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-amber-600">
                  Fix: go to Jobsite Requirements below → assign each program to jobsites or company-wide.
                </p>
              </div>
            )}

            {!loading && gaps.uncompleted.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-red-700">
                  🔴 Required but Zero Completions ({gaps.uncompleted.length})
                </p>
                <p className="mb-3 text-xs text-red-700">
                  These requirements are active but no one has been recorded as completing them yet.
                </p>
                <ul className="space-y-1">
                  {gaps.uncompleted.map((r) => {
                    const prog = programs.find((p) => p.id === r.program_id);
                    return (
                      <li key={r.id} className="flex items-center gap-2 text-xs text-red-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                        <span className="font-semibold">{prog?.name ?? r.program_id.slice(0, 8) + "…"}</span>
                        <span className="text-red-500">→ {jobsiteName(r.jobsite_id)}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[11px] text-red-600">
                  The AI will flag these as training gaps when generating risk recommendations.
                </p>
              </div>
            )}

            {!loading && gaps.jobsiteGaps.length > 0 && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-orange-700">
                  ⚡ Jobsites With No Completions ({gaps.jobsiteGaps.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {gaps.jobsiteGaps.map((jid) => (
                    <span key={jid} className="rounded-full border border-orange-200 bg-white px-2.5 py-1 text-xs font-bold text-orange-700">
                      {jobsiteName(jid)}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-orange-600">
                  These jobsites have induction requirements but no completions on record. Ensure crews are completing inductions on arrival.
                </p>
              </div>
            )}

            {!loading && (
              <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-4 py-3">
                <p className="text-xs font-bold text-violet-800">How the AI uses this data</p>
                <p className="mt-1 text-[11px] text-violet-700 leading-relaxed">
                  Induction programs, requirements, and completions are indexed in the AI Knowledge Map under the
                  <strong> &quot;training&quot;</strong> node type. The AI links them to active risk patterns using the
                  <strong> risk_increased_by_training_gap</strong> relationship — so when you generate Risk Memory
                  recommendations, gaps here will surface as prioritised action items. Click <strong>Sync to AI</strong> after
                  any changes to ensure the index is current.
                </p>
              </div>
            )}
          </div>
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
