"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Eye, RefreshCw, ShieldAlert, ThumbsDown, ThumbsUp, TriangleAlert } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Card, PageHeader, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";

const supabase = getSupabaseBrowserClient();

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${token}` };
}

type Observation = {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  category: string;
  status: string;
  observation_type: string | null;
  sif_potential: boolean | null;
  created_at: string;
  jobsite_id: string | null;
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
};

const OBS_TYPE_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  positive: { label: "Positive", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: ThumbsUp },
  negative: { label: "Unsafe Act", className: "bg-red-50 text-red-700 border-red-200", icon: ThumbsDown },
  near_miss: { label: "Near Miss", className: "bg-orange-100 text-orange-700 border-orange-200", icon: TriangleAlert },
};

const CATEGORY_LABELS: Record<string, string> = {
  hazard: "Hazard", near_miss: "Near Miss", incident: "Incident",
  good_catch: "Good Catch", ppe_violation: "PPE Violation",
  housekeeping: "Housekeeping", equipment_issue: "Equipment Issue",
  fall_hazard: "Fall Hazard", electrical_hazard: "Electrical Hazard",
  excavation_trench_concern: "Excavation/Trench",
  fire_hot_work_concern: "Fire/Hot Work",
  corrective_action: "Corrective Action",
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

const TYPE_FILTER_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Unsafe Act" },
  { value: "near_miss", label: "Near Miss" },
];

export default function SafePredictObservationsPage() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/company/observations", {
        headers,
        cache: forceRefresh ? "no-cache" : "default",
      });
      if (!res.ok) throw new Error("Failed to load observations.");
      const json = (await res.json()) as { observations?: Observation[] };
      setObservations(json.observations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = typeFilter
    ? observations.filter((o) => o.observation_type === typeFilter)
    : observations;

  const positiveCount = observations.filter((o) => o.observation_type === "positive").length;
  const negativeCount = observations.filter((o) => o.observation_type === "negative" || !o.observation_type).length;
  const nearMissCount = observations.filter((o) => o.observation_type === "near_miss").length;
  const positiveRate = observations.length > 0
    ? Math.round((positiveCount / observations.length) * 100)
    : null;

  return (
    <div className="min-h-[calc(100vh-5rem)]">
      <PageHeader
        title="Observations"
        subtitle="Field observations logged by your team — positive acts, unsafe conditions, and near misses."
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
          { icon: Eye, label: "Total", value: observations.length, color: "text-blue-600", bg: "bg-blue-50" },
          { icon: ThumbsUp, label: "Positive", value: positiveCount, color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: ThumbsDown, label: "Unsafe Acts", value: negativeCount, color: "text-red-600", bg: "bg-red-50" },
          { icon: TriangleAlert, label: "Near Misses", value: nearMissCount, color: "text-orange-600", bg: "bg-orange-50" },
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

      {/* Positive rate bar */}
      {positiveRate !== null && observations.length > 0 && (
        <div className="mx-4 mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:mx-7">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
            <span>Positive Observation Rate</span>
            <span className={positiveRate >= 50 ? "text-emerald-700 font-black" : "text-amber-700 font-black"}>
              {positiveRate}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div
              className={cx("h-full rounded-full transition-all", positiveRate >= 50 ? "bg-emerald-400" : "bg-amber-400")}
              style={{ width: `${positiveRate}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Target: ≥50% positive observations. {positiveRate >= 50 ? "✓ On track." : "Below target — encourage positive reporting."}
          </p>
        </div>
      )}

      <div className="px-4 pb-8 sm:px-7">
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <SectionTitle
              title="Observation Log"
              hint="All observations submitted by field staff. Use the type filter to focus on positive, unsafe act, or near-miss entries."
              action={
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                >
                  {TYPE_FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
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
              <Eye className="h-8 w-8" />
              <p className="text-sm font-semibold">No observations found</p>
              <p className="text-xs">Try changing the filter or check back later.</p>
            </div>
          )}

          {!error && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-black text-slate-500">
                    <th className="px-5 py-3">Observation</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Category</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Status</th>
                    <th className="px-4 py-3 hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((obs) => {
                    const typeConf = OBS_TYPE_CONFIG[obs.observation_type ?? "negative"] ?? OBS_TYPE_CONFIG.negative;
                    const TypeIcon = typeConf.icon;
                    return (
                      <tr key={obs.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900 leading-5">{obs.title}</p>
                          {obs.sif_potential && (
                            <span className="mt-0.5 inline-flex rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-black text-orange-700">
                              SIF Potential
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold", typeConf.className)}>
                            <TypeIcon className="h-3 w-3" />
                            {typeConf.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-slate-600">
                            {CATEGORY_LABELS[obs.category] ?? obs.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            label={obs.severity}
                            className={SEVERITY_STYLES[obs.severity] ?? SEVERITY_STYLES.low}
                          />
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Badge
                            label={obs.status.replace(/_/g, " ")}
                            className={STATUS_STYLES[obs.status] ?? STATUS_STYLES.open}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">
                          {formatDate(obs.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
                {filtered.length} observation{filtered.length === 1 ? "" : "s"} shown
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
