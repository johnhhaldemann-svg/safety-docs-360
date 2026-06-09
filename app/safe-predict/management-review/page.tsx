"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  CheckSquare,
  FileText,
  Save,
  Square,
  TrendingUp,
  Users,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Card, PageHeader, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";
import {
  REVIEW_SLUG, WeekPeriod, Jobsite,
  PERIOD_LABELS, PERIOD_BUTTON_LABELS, PERIOD_API_PARAM,
  AGENDA_ITEMS, DEMO_METRICS,
} from "@/lib/management-review/data";
import { generatePresentation } from "@/lib/management-review/generatePresentation";
import { generatePptx } from "@/lib/management-review/generatePptx";

const supabase = getSupabaseBrowserClient();

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManagementReviewPage() {
  const [period, setPeriod] = useState<WeekPeriod>("4w");
  const [jobsites, setJobsites] = useState<Jobsite[]>([]);
  const [selectedJobsite, setSelectedJobsite] = useState<string>("all");
  const [incidents, setIncidents] = useState<number | null>(null);
  const [openCAs, setOpenCAs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [pptxLoading, setPptxLoading] = useState(false);
  const [pptxError,   setPptxError]   = useState<string | null>(null);

  useEffect(() => {
    async function loadJobsites() {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/company/jobsites", { headers });
        if (!res.ok) return;
        const data = (await res.json()) as { jobsites?: Jobsite[] } | Jobsite[] | null;
        if (Array.isArray(data)) setJobsites(data);
        else if (data && typeof data === "object" && "jobsites" in data && Array.isArray((data as { jobsites: Jobsite[] }).jobsites))
          setJobsites((data as { jobsites: Jobsite[] }).jobsites);
      } catch { /* silent */ }
    }
    void loadJobsites();
  }, []);

  const fetchMetrics = useCallback(async (p: WeekPeriod, site: string) => {
    setLoading(true);
    const param = PERIOD_API_PARAM[p];
    const siteQ = site !== "all" ? `&jobsiteId=${site}` : "";
    try {
      const headers = await getAuthHeaders();
      const [incRes, caRes] = await Promise.all([
        fetch(`/api/company/incidents?period=${param}${siteQ}`, { headers }),
        fetch(`/api/company/corrective-actions?status=open${siteQ}`, { headers }),
      ]);
      if (incRes.ok) {
        const d = (await incRes.json()) as { incidents?: unknown[] } | unknown[];
        setIncidents(Array.isArray(d) ? d.length : Array.isArray((d as { incidents?: unknown[] }).incidents) ? (d as { incidents: unknown[] }).incidents.length : DEMO_METRICS[p].incidents);
      } else setIncidents(DEMO_METRICS[p].incidents);
      if (caRes.ok) {
        const d = (await caRes.json()) as { corrective_actions?: unknown[] } | unknown[];
        setOpenCAs(Array.isArray(d) ? d.length : Array.isArray((d as { corrective_actions?: unknown[] }).corrective_actions) ? (d as { corrective_actions: unknown[] }).corrective_actions.length : DEMO_METRICS[p].openCAs);
      } else setOpenCAs(DEMO_METRICS[p].openCAs);
    } catch {
      setIncidents(DEMO_METRICS[p].incidents);
      setOpenCAs(DEMO_METRICS[p].openCAs);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchMetrics(period, selectedJobsite); }, [period, selectedJobsite, fetchMetrics]);

  const demo = DEMO_METRICS[period];
  const resolvedIncidents = incidents ?? demo.incidents;
  const resolvedOpenCAs   = openCAs   ?? demo.openCAs;

  const KPI_CARDS = [
    { label:"Total Incidents",         value: loading ? "—" : resolvedIncidents,        icon:<BarChart3 className="w-5 h-5"/>,   color:"text-red-600",     bar:"#ef4444", pct: Math.min(100,resolvedIncidents*8) },
    { label:"Open Corrective Actions", value: loading ? "—" : resolvedOpenCAs,          icon:<FileText className="w-5 h-5"/>,    color:"text-amber-600",   bar:"#f59e0b", pct: Math.min(100,Math.round((resolvedOpenCAs/20)*100)) },
    { label:"Inspection Compliance",   value: loading ? "—" : `${demo.inspectionRate}%`, icon:<CheckSquare className="w-5 h-5"/>, color:"text-blue-600",   bar:"#3b82f6", pct: demo.inspectionRate },
    { label:"Induction Completion",    value: loading ? "—" : `${demo.inductionRate}%`,  icon:<Users className="w-5 h-5"/>,       color:"text-violet-600", bar:"#8b5cf6", pct: demo.inductionRate },
    { label:"Leading Indicator Score", value: loading ? "—" : `${demo.leadingScore}/100`, icon:<TrendingUp className="w-5 h-5"/>, color:"text-emerald-600", bar:"#10b981", pct: demo.leadingScore },
  ];

  function toggleItem(i: number) {
    setCheckedItems(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  function handleExport() {
    const exportDate = new Date().toLocaleDateString("en-AU", { year:"numeric", month:"long", day:"numeric" });
    const html = generatePresentation(exportDate, checkedItems, notes);
    const blob = new Blob([html], { type:"text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `safepredict-review-${REVIEW_SLUG}-${new Date().toISOString().split("T")[0] ?? "export"}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  }

  function handlePdfExport() {
    const exportDate = new Date().toLocaleDateString("en-AU", { year:"numeric", month:"long", day:"numeric" });
    const html = generatePresentation(exportDate, checkedItems, notes, true);
    const blob = new Blob([html], { type:"text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  }

  async function handlePptxExport() {
    setPptxLoading(true); setPptxError(null);
    try {
      const exportDate = new Date().toLocaleDateString("en-AU", { year:"numeric", month:"long", day:"numeric" });
      await generatePptx(exportDate, checkedItems);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setPptxError(e instanceof Error ? e.message : "PPTX generation failed");
    } finally { setPptxLoading(false); }
  }

  const jobsiteLabel = selectedJobsite === "all" ? "All Jobsites" : (jobsites.find(j => j.id === selectedJobsite)?.name ?? "");

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        title="Management Review"
        subtitle="H1 2026 executive safety performance review — 5 companies · 11 jobsites · ISO 45001"
      />

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
          {(["1w","2w","4w","8w","12w"] as WeekPeriod[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cx("px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all",
                period === p ? "bg-white text-sky-700 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              {PERIOD_BUTTON_LABELS[p]}
            </button>
          ))}
        </div>
        {jobsites.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <select value={selectedJobsite} onChange={e => setSelectedJobsite(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer">
              <option value="all">All Jobsites</option>
              {jobsites.map(j => <option key={j.id} value={j.id}>{j.name}{j.code ? ` (${j.code})` : ""}</option>)}
            </select>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400 -mt-4">
        Page KPIs showing <strong className="text-slate-600">{PERIOD_LABELS[period]}</strong>
        {selectedJobsite !== "all" && <> · <strong className="text-slate-600">{jobsiteLabel}</strong></>}
        {" · "}Export always produces the full H1 2026 portfolio review.
      </p>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle title="Period KPI Summary"
          hint={`Live metrics · ${PERIOD_LABELS[period].toLowerCase()}`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mt-4">
          {KPI_CARDS.map(m => (
            <Card key={m.label} className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className={cx("p-2 rounded-lg bg-slate-50", m.color)}>{m.icon}</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{m.value}</div>
                <div className="text-xs font-medium text-slate-500 mt-0.5">{m.label}</div>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width:`${m.pct}%`, background:m.bar }} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Agenda ─────────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle title="Review Agenda"
          hint="ISO 45001 agenda — check off items as discussed. Completion state exports into the deck." />
        <Card className="mt-4 divide-y divide-slate-100">
          {AGENDA_ITEMS.map((item, i) => {
            const checked = checkedItems.has(i);
            return (
              <button key={i} onClick={() => toggleItem(i)}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors group">
                {checked
                  ? <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
                  : <Square className="w-5 h-5 text-slate-300 group-hover:text-slate-400 shrink-0" />}
                <span className={cx("text-sm", checked ? "line-through text-slate-400" : "text-slate-700")}>
                  <span className="font-medium text-slate-400 mr-2">{i + 1}.</span>{item}
                </span>
              </button>
            );
          })}
        </Card>
        <p className="mt-2 text-xs text-slate-400">{checkedItems.size} of {AGENDA_ITEMS.length} items completed</p>
      </section>

      {/* ── Minutes ────────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle title="Minutes &amp; Outcomes"
          hint="Notes entered here appear on a bonus slide at the end of the exported presentation." />
        <Card className="mt-4 p-5">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Enter meeting minutes, decisions, assigned actions, and next review date…"
            className="w-full min-h-[160px] resize-y rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 transition" />
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-slate-400">{notes.length > 0 ? `${notes.length} characters · will appear as a bonus slide` : "No notes yet"}</span>
            <div className="flex items-center gap-3 flex-wrap">
              {saved && (
                <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4" /> Downloaded
                </span>
              )}
              {pptxError && (
                <span className="text-xs text-red-600 font-medium">{pptxError}</span>
              )}
              <button onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold transition-colors shadow-sm">
                <Save className="w-4 h-4" /> HTML
              </button>
              <button onClick={handlePdfExport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors shadow-sm">
                <FileText className="w-4 h-4" /> Save as PDF
              </button>
              <button onClick={() => void handlePptxExport()} disabled={pptxLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-sm">
                {pptxLoading
                  ? <><TrendingUp className="w-4 h-4 animate-spin" /> Building PPTX…</>
                  : <><TrendingUp className="w-4 h-4" /> Export PPTX</>}
              </button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
