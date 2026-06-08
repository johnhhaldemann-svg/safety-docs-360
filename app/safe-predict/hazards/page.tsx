"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, TriangleAlert, Zap } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Card, PageHeader, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";

const supabase = getSupabaseBrowserClient();

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${token}` };
}

type HazardRow = {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  category: string;
  status: string;
  sif_potential: boolean | null;
  sif_category: string | null;
  immediate_action_required: boolean | null;
  due_at: string | null;
  created_at: string;
  jobsite_id: string | null;
};

const HAZARD_CATEGORIES = new Set([
  "hazard",
  "fall_hazard",
  "electrical_hazard",
  "excavation_trench_concern",
  "fire_hot_work_concern",
]);

const HAZARD_CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  hazard: { label: "General Hazard", color: "text-slate-700", bg: "bg-slate-100" },
  fall_hazard: { label: "Fall Hazard", color: "text-orange-700", bg: "bg-orange-100" },
  electrical_hazard: { label: "Electrical", color: "text-yellow-700", bg: "bg-yellow-100" },
  excavation_trench_concern: { label: "Excavation/Trench", color: "text-amber-700", bg: "bg-amber-100" },
  fire_hot_work_concern: { label: "Fire / Hot Work", color: "text-red-700", bg: "bg-red-100" },
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  assigned: "bg-violet-50 text-violet-700 border-violet-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  corrected: "bg-teal-50 text-teal-700 border-teal-200",
  verified_closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  escalated: "bg-red-50 text-red-700 border-red-200",
  stop_work: "bg-red-100 text-red-800 border-red-300",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold capitalize", className)}>
      {label}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(dueAt: string | null, status: string) {
  if (!dueAt || status === "verified_closed" || status === "corrected") return false;
  return new Date(dueAt) < new Date();
}

const CATEGORY_FILTER_OPTIONS = [
  { value: "", label: "All Hazard Types" },
  { value: "hazard", label: "General Hazard" },
  { value: "fall_hazard", label: "Fall Hazard" },
  { value: "electrical_hazard", label: "Electrical" },
  { value: "excavation_trench_concern", label: "Excavation/Trench" },
  { value: "fire_hot_work_concern", label: "Fire / Hot Work" },
];

const SEVERITY_FILTER_OPTIONS = [
  { value: "", label: "All Severities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function SafePredictHazardsPage() {
  const [hazards, setHazards] = useState<HazardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [openOnly, setOpenOnly] = useState(true);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      // Fetch all CAs and filter to hazard categories client-side
      const res = await fetch("/api/company/corrective-actions", {
        headers,
        cache: forceRefresh ? "no-cache" : "default",
      });
      if (!res.ok) throw new Error("Failed to load hazards.");
      const json = (await res.json()) as { actions?: HazardRow[] };
      const all = json.actions ?? [];
      setHazards(all.filter((a) => HAZARD_CATEGORIES.has(a.category)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = hazards.filter((h) => {
    if (categoryFilter && h.category !== categoryFilter) return false;
    if (severityFilter && h.severity !== severityFilter) return false;
    if (openOnly && (h.status === "verified_closed" || h.status === "corrected")) return false;
    return true;
  });

  const criticalHigh = hazards.filter((h) =>
    (h.severity === "critical" || h.severity === "high") &&
    h.status !== "verified_closed" && h.status !== "corrected"
  );
  const sifItems = hazards.filter((h) => h.sif_potential);
  const stopWork = hazards.filter((h) => h.status === "stop_work");
  const openCount = hazards.filter((h) => h.status !== "verified_closed" && h.status !== "corrected").length;

  // Breakdown by type
  const typeCounts = Array.from(HAZARD_CATEGORIES).map((cat) => ({
    category: cat,
    count: hazards.filter((h) => h.category === cat && h.status !== "verified_closed" && h.status !== "corrected").length,
    config: HAZARD_CATEGORY_CONFIG[cat] ?? { label: cat, color: "text-slate-700", bg: "bg-slate-100" },
  })).filter((t) => t.count > 0);

  return (
    <div className="min-h-[calc(100vh-5rem)]">
      <PageHeader
        title="Hazards"
        subtitle="Active hazards identified across all jobsites — fall, electrical, excavation, fire, and general risks."
        actions={
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading}
            className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4 sm:px-7">
        {[
          { icon: TriangleAlert, label: "Open Hazards", value: openCount, color: "text-blue-600", bg: "bg-blue-50" },
          { icon: AlertTriangle, label: "Critical / High", value: criticalHigh.length, color: "text-red-600", bg: "bg-red-50" },
          { icon: Zap, label: "SIF Potential", value: sifItems.length, color: "text-orange-600", bg: "bg-orange-50" },
          { icon: ShieldAlert, label: "Stop Work", value: stopWork.length, color: "text-red-800", bg: "bg-red-100" },
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

      {/* Type breakdown */}
      {typeCounts.length > 0 && (
        <div className="mx-4 mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:mx-7">
          <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">Open Hazards by Type</p>
          <div className="flex flex-wrap gap-2">
            {typeCounts.map(({ category, count, config }) => (
              <button
                key={category}
                type="button"
                onClick={() => setCategoryFilter(categoryFilter === category ? "" : category)}
                className={cx(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition",
                  categoryFilter === category
                    ? "border-blue-400 bg-blue-50 text-blue-700 ring-2 ring-blue-200"
                    : `border-slate-200 ${config.bg} ${config.color} hover:border-slate-300`
                )}
              >
                {config.label}
                <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-black">
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pb-8 sm:px-7">
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <SectionTitle
              title="Hazard Register"
              hint="All identified hazards filtered from corrective actions. Click a hazard type chip above to filter by type."
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={openOnly}
                      onChange={(e) => setOpenOnly(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300"
                    />
                    Open only
                  </label>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                  >
                    {SEVERITY_FILTER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                  >
                    {CATEGORY_FILTER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
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
              <CheckCircle2 className="h-8 w-8" />
              <p className="text-sm font-semibold">No hazards found</p>
              <p className="text-xs">Try adjusting the filters, or no open hazards exist — great news!</p>
            </div>
          )}

          {!error && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-black text-slate-500">
                    <th className="px-5 py-3">Hazard</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Type</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 hidden md:table-cell">Due</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Identified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((hazard) => {
                    const overdue = isOverdue(hazard.due_at, hazard.status);
                    const typeConf = HAZARD_CATEGORY_CONFIG[hazard.category] ?? HAZARD_CATEGORY_CONFIG.hazard;
                    return (
                      <tr key={hazard.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900 leading-5">{hazard.title}</p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {hazard.sif_potential && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-black text-orange-700">
                                <Zap className="h-2.5 w-2.5" /> SIF
                              </span>
                            )}
                            {hazard.status === "stop_work" && (
                              <span className="inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-800">
                                STOP WORK
                              </span>
                            )}
                            {hazard.immediate_action_required && hazard.status !== "stop_work" && (
                              <span className="inline-flex rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-700">
                                Immediate Action
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className={cx("inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold", typeConf.bg, typeConf.color)}>
                            {typeConf.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            label={hazard.severity}
                            className={SEVERITY_STYLES[hazard.severity] ?? SEVERITY_STYLES.low}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            label={hazard.status.replace(/_/g, " ")}
                            className={STATUS_STYLES[hazard.status] ?? STATUS_STYLES.open}
                          />
                        </td>
                        <td className={cx("px-4 py-3 text-xs hidden md:table-cell", overdue ? "font-bold text-red-600" : "text-slate-500")}>
                          {overdue && "⚠ "}{formatDate(hazard.due_at)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">
                          {formatDate(hazard.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
                {filtered.length} hazard{filtered.length === 1 ? "" : "s"} shown
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
