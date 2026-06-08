"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, ShieldAlert, Zap } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Card, PageHeader, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";

const supabase = getSupabaseBrowserClient();

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${token}` };
}

type CA = {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  category: string;
  status: string;
  due_at: string | null;
  created_at: string;
  sif_potential: boolean | null;
  immediate_action_required: boolean | null;
  observation_type: string | null;
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
  stop_work: "bg-red-100 text-red-800 border-red-300",
};

const CATEGORY_LABELS: Record<string, string> = {
  hazard: "Hazard",
  near_miss: "Near Miss",
  incident: "Incident",
  good_catch: "Good Catch",
  ppe_violation: "PPE Violation",
  housekeeping: "Housekeeping",
  equipment_issue: "Equipment Issue",
  fall_hazard: "Fall Hazard",
  electrical_hazard: "Electrical Hazard",
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

function isOverdue(dueAt: string | null, status: string) {
  if (!dueAt || status === "verified_closed" || status === "corrected") return false;
  return new Date(dueAt) < new Date();
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "corrected", label: "Corrected" },
  { value: "verified_closed", label: "Verified Closed" },
  { value: "escalated", label: "Escalated" },
];

export default function SafePredictCorrectiveActionsPage() {
  const [actions, setActions] = useState<CA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (overdueOnly) params.set("overdue", "true");
      const res = await fetch(`/api/company/corrective-actions?${params.toString()}`, {
        headers,
        cache: forceRefresh ? "no-cache" : "default",
      });
      if (!res.ok) throw new Error("Failed to load corrective actions.");
      const json = (await res.json()) as { actions?: CA[] };
      setActions(json.actions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, overdueOnly]);

  useEffect(() => { void load(); }, [load]);

  const open = actions.filter((a) => a.status === "open" || a.status === "assigned" || a.status === "in_progress");
  const overdue = actions.filter((a) => isOverdue(a.due_at, a.status));
  const sif = actions.filter((a) => a.sif_potential);
  const closed = actions.filter((a) => a.status === "verified_closed" || a.status === "corrected");

  return (
    <div className="min-h-[calc(100vh-5rem)]">
      <PageHeader
        title="Corrective Actions"
        subtitle="Track, assign and close safety corrective actions across all sites."
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
          { icon: AlertTriangle, label: "Open", value: open.length, color: "text-blue-600", bg: "bg-blue-50" },
          { icon: Clock, label: "Overdue", value: overdue.length, color: "text-red-600", bg: "bg-red-50" },
          { icon: Zap, label: "SIF Potential", value: sif.length, color: "text-orange-600", bg: "bg-orange-50" },
          { icon: CheckCircle2, label: "Closed", value: closed.length, color: "text-emerald-600", bg: "bg-emerald-50" },
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

      <div className="px-4 pb-8 sm:px-7">
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <SectionTitle
              title="All Corrective Actions"
              hint="All open and closed corrective actions for your company. Filter by status or show overdue items only."
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={overdueOnly}
                      onChange={(e) => setOverdueOnly(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300"
                    />
                    Overdue only
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                  >
                    {STATUS_FILTER_OPTIONS.map((o) => (
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

          {!error && !loading && actions.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <CheckCircle2 className="h-8 w-8" />
              <p className="text-sm font-semibold">No corrective actions found</p>
              <p className="text-xs">Try changing the filter or check back later.</p>
            </div>
          )}

          {!error && actions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-black text-slate-500">
                    <th className="px-5 py-3">Title</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Category</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 hidden md:table-cell">Due</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {actions.map((action) => {
                    const overdue = isOverdue(action.due_at, action.status);
                    return (
                      <tr key={action.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900 leading-5">{action.title}</p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {action.sif_potential && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-black text-orange-700">
                                <Zap className="h-2.5 w-2.5" /> SIF
                              </span>
                            )}
                            {action.immediate_action_required && (
                              <span className="inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700">
                                Immediate
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-slate-600">
                            {CATEGORY_LABELS[action.category] ?? action.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            label={action.severity}
                            className={SEVERITY_STYLES[action.severity] ?? SEVERITY_STYLES.low}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            label={action.status.replace(/_/g, " ")}
                            className={STATUS_STYLES[action.status] ?? STATUS_STYLES.open}
                          />
                        </td>
                        <td className={cx("px-4 py-3 text-xs hidden md:table-cell", overdue ? "font-bold text-red-600" : "text-slate-500")}>
                          {overdue && "⚠ "}{formatDate(action.due_at)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">
                          {formatDate(action.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
                {actions.length} corrective action{actions.length === 1 ? "" : "s"} shown
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
