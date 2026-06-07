"use client";

import { useEffect, useState, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, Download, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import type { Osha300Entry } from "@/lib/osha300";
import { ILLNESS_TYPE_LABELS } from "@/lib/osha300";
import { PageHero, SectionCard } from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

type LogSummary = {
  totalRecordable: number;
  totalFatalities: number;
  totalDaysAway: number;
  totalDaysAwayCount: number;
  totalDaysRestrictedCount: number;
  unclassifiedCount: number;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ClassificationBadge({ entry }: { entry: Osha300Entry }) {
  if (!entry.recordable)
    return <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Not recordable</span>;
  if (entry.death)
    return <span className="rounded-full bg-rose-900/60 px-2 py-0.5 text-[10px] font-semibold text-rose-300">Death (G)</span>;
  if (entry.daysAway)
    return <span className="rounded-full bg-orange-900/60 px-2 py-0.5 text-[10px] font-semibold text-orange-300">Days away (H)</span>;
  if (entry.restricted)
    return <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Restricted (I)</span>;
  return <span className="rounded-full bg-sky-900/60 px-2 py-0.5 text-[10px] font-semibold text-sky-300">Other recordable (J)</span>;
}

export default function Osha300Page() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [entries, setEntries] = useState<Osha300Entry[]>([]);
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordableOnly, setRecordableOnly] = useState(true);
  const [autofilling, setAutofilling] = useState<string | null>(null);
  const [autofillAllRunning, setAutofillAllRunning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `/api/company/osha-300?year=${year}&recordableOnly=${recordableOnly}`,
        { headers }
      );
      const data = (await res.json().catch(() => null)) as {
        entries?: Osha300Entry[];
        summary?: LogSummary;
      } | null;
      if (res.ok && data) {
        setEntries(data.entries ?? []);
        setSummary(data.summary ?? null);
      } else {
        toast.error("Failed to load OSHA 300 log.");
      }
    } finally {
      setLoading(false);
    }
  }, [year, recordableOnly]);

  useEffect(() => { void load(); }, [load]);

  async function autofillSingle(incidentId: string) {
    setAutofilling(incidentId);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/company/osha-300/autofill", {
        method: "POST",
        headers,
        body: JSON.stringify({ incidentId, apply: true }),
      });
      const data = (await res.json().catch(() => null)) as {
        suggestion?: { recordable: boolean; reasoning: string };
        applied?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.applied) {
        toast.error(data?.error ?? "Auto-fill failed.");
        return;
      }
      toast.success(
        data.suggestion?.recordable
          ? "OSHA 300 fields filled — incident marked recordable."
          : "Incident assessed as not OSHA-recordable."
      );
      await load();
    } finally {
      setAutofilling(null);
    }
  }

  async function autofillAll() {
    // Find incidents that don't have osha_description set and aren't recordable yet
    const unclassified = entries.filter(
      (e) => !e.recordable && !e.descriptionOfInjury?.startsWith("[AI]")
    );
    if (unclassified.length === 0) {
      toast.info("No unclassified incidents to process.");
      return;
    }
    setAutofillAllRunning(true);
    let done = 0;
    try {
      const headers = await getAuthHeaders();
      for (const entry of unclassified.slice(0, 20)) {
        await fetch("/api/company/osha-300/autofill", {
          method: "POST",
          headers,
          body: JSON.stringify({ incidentId: entry.incidentId, apply: true }),
        });
        done++;
      }
      toast.success(`Auto-filled ${done} incident${done === 1 ? "" : "s"}.`);
      await load();
    } finally {
      setAutofillAllRunning(false);
    }
  }

  async function exportPdf() {
    setExportingPdf(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/company/osha-300/export-pdf?year=${year}`, { headers });
      if (!res.ok) { toast.error("Failed to generate PDF."); return; }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `osha-300-log-${year}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExportingPdf(false);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <PageHero
        eyebrow="Compliance"
        title="OSHA 300 Log"
        description="Work-related injury and illness log — 29 CFR 1904"
      />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={recordableOnly}
                onChange={(e) => setRecordableOnly(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800"
              />
              Recordable only
            </label>
          </div>
          <div className="flex items-center gap-2">
            {summary && summary.unclassifiedCount > 0 && (
              <button
                onClick={autofillAll}
                disabled={autofillAllRunning || loading}
                className="flex items-center gap-2 rounded-xl border border-sky-700/60 px-3 py-2 text-sm font-semibold text-sky-400 transition-colors hover:bg-sky-950/40 disabled:opacity-50"
              >
                {autofillAllRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                AI Auto-fill ({summary.unclassifiedCount})
              </button>
            )}
            <button
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-400 transition-colors hover:text-slate-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={exportPdf}
              disabled={exportingPdf || entries.filter((e) => e.recordable).length === 0}
              className="flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 disabled:opacity-50"
            >
              {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export PDF
            </button>
          </div>
        </div>

        {/* Summary metrics */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Recordable cases", value: summary.totalRecordable, tone: "rose" },
              { label: "Fatalities", value: summary.totalFatalities, tone: "rose" },
              { label: "Days-away cases", value: summary.totalDaysAway, tone: "orange" },
              { label: "Total days away", value: summary.totalDaysAwayCount, tone: "amber" },
              { label: "Total days restricted", value: summary.totalDaysRestrictedCount, tone: "amber" },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-3 text-center"
              >
                <div
                  className={`text-2xl font-bold ${
                    m.tone === "rose" && m.value > 0 ? "text-rose-400" :
                    m.tone === "orange" && m.value > 0 ? "text-orange-400" :
                    m.tone === "amber" && m.value > 0 ? "text-amber-400" : "text-slate-300"
                  }`}
                >
                  {m.value}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Log table */}
        <SectionCard title="OSHA 300 Log Entries">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <ShieldAlert className="h-8 w-8 text-slate-600" />
              <div className="text-sm text-slate-500">
                No {recordableOnly ? "recordable " : ""}incidents found for {year}.
              </div>
              {recordableOnly && (
                <button
                  onClick={() => setRecordableOnly(false)}
                  className="text-xs text-sky-400 hover:underline"
                >
                  Show all incidents to run AI auto-fill
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-4 pl-3">Case #</th>
                    <th className="py-2 pr-4">Date (D)</th>
                    <th className="py-2 pr-4">Employee (B)</th>
                    <th className="py-2 pr-4">Where (E)</th>
                    <th className="py-2 pr-4">Classification</th>
                    <th className="py-2 pr-4">Days away (K)</th>
                    <th className="py-2 pr-4">Days restricted (L)</th>
                    <th className="py-2 pr-4">Illness type (M)</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {entries.map((entry) => (
                    <>
                      <tr
                        key={entry.incidentId}
                        className="group cursor-pointer transition-colors hover:bg-slate-800/30"
                        onClick={() =>
                          setExpandedId((prev) =>
                            prev === entry.incidentId ? null : entry.incidentId
                          )
                        }
                      >
                        <td className="py-2.5 pr-4 pl-3 font-mono text-xs text-slate-400">
                          {entry.caseNumber}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-slate-300 whitespace-nowrap">
                          {formatDate(entry.dateOfInjury)}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-slate-300 max-w-[130px] truncate">
                          {entry.employeeName ?? <span className="text-slate-600">—</span>}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-slate-400 max-w-[120px] truncate">
                          {entry.whereOccurred ?? <span className="text-slate-600">—</span>}
                        </td>
                        <td className="py-2.5 pr-4">
                          <ClassificationBadge entry={entry} />
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-slate-300 text-center">
                          {entry.daysAwayCount > 0 ? entry.daysAwayCount : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-slate-300 text-center">
                          {entry.daysRestrictedCount > 0 ? entry.daysRestrictedCount : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-slate-400">
                          {ILLNESS_TYPE_LABELS[entry.illnessType]}
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {!entry.recordable && (
                              <button
                                onClick={() => void autofillSingle(entry.incidentId)}
                                disabled={autofilling === entry.incidentId}
                                title="AI Auto-fill OSHA classification"
                                className="flex items-center gap-1 rounded-lg border border-sky-700/50 px-2 py-1 text-[10px] font-semibold text-sky-400 transition-colors hover:bg-sky-950/40 disabled:opacity-50"
                              >
                                {autofilling === entry.incidentId ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Bot className="h-3 w-3" />
                                )}
                                Auto-fill
                              </button>
                            )}
                            {entry.recordable && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            )}
                            <ChevronDown
                              className={`h-3.5 w-3.5 text-slate-600 transition-transform ${
                                expandedId === entry.incidentId ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </td>
                      </tr>
                      {expandedId === entry.incidentId && (
                        <tr key={`${entry.incidentId}-expanded`} className="bg-slate-900/40">
                          <td colSpan={9} className="px-3 py-3">
                            <div className="space-y-1.5 text-xs">
                              <div>
                                <span className="font-semibold text-slate-400">Column F — Description: </span>
                                <span className="text-slate-200">
                                  {entry.descriptionOfInjury ?? <span className="italic text-slate-500">No description. Run AI auto-fill to generate one.</span>}
                                </span>
                              </div>
                              {!entry.recordable && (
                                <div className="flex items-center gap-2 text-amber-300">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                  This incident has not been classified as OSHA-recordable. Use AI Auto-fill to assess it.
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <p className="text-center text-[11px] text-slate-600">
          OSHA Form 300 — Log of Work-Related Injuries and Illnesses — 29 CFR Part 1904.
          This log is generated from incident records in SafetyDocs360. Review all entries for accuracy before submitting to OSHA.
        </p>
      </div>
    </div>
  );
}
