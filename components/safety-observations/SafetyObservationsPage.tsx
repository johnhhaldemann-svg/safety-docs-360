"use client";

import { createClient } from "@supabase/supabase-js";
import { Download, Filter, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineMessage } from "@/components/WorkspacePrimitives";
import {
  MOCK_SAFETY_OBSERVATIONS,
  computeKpisFromRows,
} from "@/lib/safety-observations/mock-data";
import type { SafetyObservationKpis, SafetyObservationRow } from "@/lib/safety-observations/types";
import { ObservationAnalytics } from "./ObservationAnalytics";
import { ObservationFilters, type ObservationFilterState } from "./ObservationFilters";
import { ObservationForm } from "./ObservationForm";
import { ObservationKpiCards } from "./ObservationKpiCards";
import { ObservationList } from "./ObservationList";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const emptyKpis: SafetyObservationKpis = {
  totalObservations: 0,
  openHazards: 0,
  highCriticalOpen: 0,
  positiveObservations: 0,
  nearMisses: 0,
  closedThisWeek: 0,
};

function matchesFilters(row: SafetyObservationRow, f: ObservationFilterState): boolean {
  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    const hay = `${row.title} ${row.description ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.observation_type && row.observation_type !== f.observation_type) return false;
  if (f.category && row.category !== f.category) return false;
  if (f.subcategory && row.subcategory !== f.subcategory) return false;
  if (f.severity && row.severity !== f.severity) return false;
  if (f.status && row.status !== f.status) return false;
  if (f.jobsite_id && row.jobsite_id !== f.jobsite_id) return false;
  return true;
}

function toCsv(rows: SafetyObservationRow[]) {
  const headers = [
    "title",
    "observation_type",
    "category",
    "subcategory",
    "severity",
    "status",
    "jobsite_id",
    "created_at",
    "assigned_to",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        JSON.stringify(r.title),
        r.observation_type,
        r.category,
        r.subcategory,
        r.severity,
        r.status,
        r.jobsite_id ?? "",
        r.created_at,
        r.assigned_to ?? "",
      ].join(",")
    );
  }
  return lines.join("\n");
}

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Missing auth token.");
  return { Authorization: `Bearer ${session.access_token}` };
}

export function SafetyObservationsPage() {
  const [filters, setFilters] = useState<ObservationFilterState>({
    search: "",
    observation_type: "",
    category: "",
    subcategory: "",
    severity: "",
    status: "",
    jobsite_id: "",
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [observations, setObservations] = useState<SafetyObservationRow[]>([]);
  const [kpis, setKpis] = useState<SafetyObservationKpis>(emptyKpis);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [useDemo, setUseDemo] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<SafetyObservationRow | null>(null);
  const [viewRow, setViewRow] = useState<SafetyObservationRow | null>(null);
  const [jobsites, setJobsites] = useState<Array<{ id: string; name: string }>>([]);
  const [assignees, setAssignees] = useState<Array<{ id: string; label: string }>>([]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => window.clearTimeout(t);
  }, [filters.search]);

  const filtersForQuery = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch]
  );

  const buildListParams = useCallback(
    (pageNum: number, pageSize: number) => {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("pageSize", String(pageSize));
      params.set("days", "365");
      if (filtersForQuery.search) params.set("search", filtersForQuery.search);
      if (filtersForQuery.observation_type) params.set("observation_type", filtersForQuery.observation_type);
      if (filtersForQuery.category) params.set("category", filtersForQuery.category);
      if (filtersForQuery.subcategory) params.set("subcategory", filtersForQuery.subcategory);
      if (filtersForQuery.severity) params.set("severity", filtersForQuery.severity);
      if (filtersForQuery.status) params.set("status", filtersForQuery.status);
      if (filtersForQuery.jobsite_id) params.set("jobsite_id", filtersForQuery.jobsite_id);
      return params;
    },
    [filtersForQuery]
  );

  const demoFiltered = useMemo(() => {
    return MOCK_SAFETY_OBSERVATIONS.filter((r) => matchesFilters(r, filtersForQuery));
  }, [filtersForQuery]);

  const displayObservations = useDemo ? demoFiltered : observations;
  const displayKpis = useDemo ? computeKpisFromRows(demoFiltered) : kpis;

  const jobsiteLabelById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const j of jobsites) m[j.id] = j.name;
    return m;
  }, [jobsites]);

  const assigneeLabelById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of assignees) m[a.id] = a.label;
    return m;
  }, [assignees]);

  const loadMeta = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const [jsRes, uRes] = await Promise.all([
        fetch("/api/company/jobsites", { headers }),
        fetch("/api/company/users", { headers }),
      ]);
      if (jsRes.ok) {
        const jsData = (await jsRes.json()) as { jobsites?: Array<{ id: string; name?: string }> };
        setJobsites(
          (jsData.jobsites ?? []).map((j) => ({
            id: j.id,
            name: j.name?.trim() || `Jobsite ${j.id.slice(0, 8)}`,
          }))
        );
      }
      if (uRes.ok) {
        const uData = (await uRes.json()) as {
          users?: Array<{ id: string; name?: string; email?: string }>;
        };
        setAssignees(
          (uData.users ?? []).map((u) => ({
            id: u.id,
            label: `${u.name ?? "User"}${u.email ? ` (${u.email})` : ""}`,
          }))
        );
      }
    } catch {
      /* optional meta */
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setMessage("");
        try {
          const headers = await getAuthHeaders();
          const params = new URLSearchParams();
          params.set("page", "1");
          params.set("pageSize", "20");
          params.set("days", "365");
          if (filtersForQuery.search) params.set("search", filtersForQuery.search);
          if (filtersForQuery.observation_type) params.set("observation_type", filtersForQuery.observation_type);
          if (filtersForQuery.category) params.set("category", filtersForQuery.category);
          if (filtersForQuery.subcategory) params.set("subcategory", filtersForQuery.subcategory);
          if (filtersForQuery.severity) params.set("severity", filtersForQuery.severity);
          if (filtersForQuery.status) params.set("status", filtersForQuery.status);
          if (filtersForQuery.jobsite_id) params.set("jobsite_id", filtersForQuery.jobsite_id);

          const res = await fetch(`/api/company/safety-observations?${params}`, { headers });
          const data = (await res.json().catch(() => null)) as {
            observations?: SafetyObservationRow[];
            total?: number;
            kpis?: SafetyObservationKpis;
            error?: string;
            code?: string;
          } | null;

          if (cancelled) return;

          if (!res.ok) {
            if (res.status === 503 || data?.code === "schema") {
              setUseDemo(true);
              setKpis(computeKpisFromRows(MOCK_SAFETY_OBSERVATIONS));
              setObservations([]);
              setTotal(MOCK_SAFETY_OBSERVATIONS.length);
              setPage(1);
              setMessage(
                "Showing demo data until the safety_observations migration is applied to your Supabase project."
              );
              return;
            }
            setMessage(data?.error || "Failed to load observations.");
            setUseDemo(true);
            setKpis(computeKpisFromRows(MOCK_SAFETY_OBSERVATIONS));
            setObservations([]);
            setPage(1);
            return;
          }

          setUseDemo(false);
          setObservations(data?.observations ?? []);
          setKpis(data?.kpis ?? emptyKpis);
          setTotal(data?.total ?? 0);
          setPage(1);
        } catch {
          if (!cancelled) {
            setUseDemo(true);
            setKpis(computeKpisFromRows(MOCK_SAFETY_OBSERVATIONS));
            setMessage("Using demo data (could not reach API).");
            setObservations([]);
            setPage(1);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [filtersForQuery, buildListParams]);

  async function loadMore() {
    if (useDemo) return;
    setLoadingMore(true);
    try {
      const headers = await getAuthHeaders();
      const nextPage = page + 1;
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", "20");
      params.set("days", "365");
      if (filtersForQuery.search) params.set("search", filtersForQuery.search);
      if (filtersForQuery.observation_type) params.set("observation_type", filtersForQuery.observation_type);
      if (filtersForQuery.category) params.set("category", filtersForQuery.category);
      if (filtersForQuery.subcategory) params.set("subcategory", filtersForQuery.subcategory);
      if (filtersForQuery.severity) params.set("severity", filtersForQuery.severity);
      if (filtersForQuery.status) params.set("status", filtersForQuery.status);
      if (filtersForQuery.jobsite_id) params.set("jobsite_id", filtersForQuery.jobsite_id);

      const res = await fetch(`/api/company/safety-observations?${params}`, { headers });
      const data = (await res.json().catch(() => null)) as {
        observations?: SafetyObservationRow[];
      } | null;
      if (res.ok) {
        const rows = data?.observations ?? [];
        setObservations((prev) => [...prev, ...rows]);
        setPage(nextPage);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSubmit(payload: Record<string, unknown>) {
    setSubmitting(true);
    setMessage("");
    try {
      const headers = { ...(await getAuthHeaders()), "Content-Type": "application/json" };
      if (editing) {
        const res = await fetch(`/api/company/safety-observations/${editing.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(data?.error || "Update failed.");
      } else {
        const res = await fetch("/api/company/safety-observations", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(data?.error || "Create failed.");
      }
      setEditing(null);
      if (!useDemo) {
        const params = buildListParams(1, 20);
        const r2 = await fetch(`/api/company/safety-observations?${params}`, { headers });
        const d2 = (await r2.json()) as {
          observations?: SafetyObservationRow[];
          kpis?: SafetyObservationKpis;
          total?: number;
        };
        if (r2.ok) {
          setObservations(d2.observations ?? []);
          setKpis(d2.kpis ?? emptyKpis);
          setTotal(d2.total ?? 0);
          setPage(1);
        }
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose(row: SafetyObservationRow) {
    setMessage("");
    try {
      const headers = { ...(await getAuthHeaders()), "Content-Type": "application/json" };
      const res = await fetch(`/api/company/safety-observations/${row.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "Closed" }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Close failed.");
      if (!useDemo) {
        setObservations((prev) =>
          prev.map((o) => (o.id === row.id ? { ...o, status: "Closed", closed_at: new Date().toISOString() } : o))
        );
        const params = buildListParams(1, Math.max(20, observations.length));
        const r2 = await fetch(`/api/company/safety-observations?${params}`, { headers });
        const d2 = (await r2.json()) as { kpis?: SafetyObservationKpis } | null;
        if (r2.ok && d2?.kpis) setKpis(d2.kpis);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Close failed.");
    }
  }

  function exportCsv() {
    const blob = new Blob([toCsv(displayObservations)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `safety-observations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasMore = !useDemo && page * 20 < total;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Safety Observations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Track hazards, positive observations, and near misses across jobsites. Distinct from Corrective Actions
            (Field ID Exchange), this module uses a structured category tree for reporting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            onClick={() => {
              setEditing(null);
              document.getElementById("new-observation")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <Plus className="size-4" />
            New observation
          </Button>
          <Button type="button" variant="secondary" onClick={exportCsv}>
            <Download className="size-4" />
            Export
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById("observation-filters")?.scrollIntoView({ behavior: "smooth" })}
          >
            <Filter className="size-4" />
            Filters
          </Button>
        </div>
      </div>

      {message ? (
        <InlineMessage tone={useDemo ? "warning" : "error"}>{message}</InlineMessage>
      ) : null}

      <ObservationKpiCards kpis={displayKpis} loading={loading && !useDemo} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <ObservationForm
          key={editing?.id ?? "new"}
          jobsites={jobsites}
          assignees={assignees}
          submitting={submitting}
          initial={editing}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
        />

        <div className="space-y-4" id="observation-filters">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Recent observations</h2>
            <p className="mt-1 text-sm text-slate-500">Search and filter the list. Load more when connected to live data.</p>
            <div className="mt-4">
              <ObservationFilters value={filters} onChange={setFilters} jobsites={jobsites} />
            </div>
          </div>
          <ObservationList
            observations={displayObservations}
            jobsiteLabelById={jobsiteLabelById}
            assigneeLabelById={assigneeLabelById}
            loading={loading && !useDemo}
            onView={setViewRow}
            onEdit={(row) => {
              setEditing(row);
              document.getElementById("new-observation")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            onClose={handleClose}
            onLoadMore={() => void loadMore()}
            hasMore={hasMore}
            loadingMore={loadingMore}
          />
        </div>
      </div>

      <ObservationAnalytics rows={displayObservations.length ? displayObservations : MOCK_SAFETY_OBSERVATIONS} />

      <Dialog open={Boolean(viewRow)} onOpenChange={(o) => !o && setViewRow(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewRow?.title}</DialogTitle>
            <DialogDescription>
              {viewRow ? (
                <span>
                  {viewRow.observation_type.replace(/_/g, " ")} · {viewRow.category.replace(/_/g, " ")} ·{" "}
                  {viewRow.subcategory.replace(/_/g, " ")}
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {viewRow ? (
            <div className="space-y-3 text-sm text-slate-700">
              <div>
                <span className="font-semibold text-slate-900">Severity: </span>
                {viewRow.severity}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Status: </span>
                {viewRow.status}
              </div>
              {viewRow.description ? (
                <div>
                  <div className="font-semibold text-slate-900">Description</div>
                  <p className="mt-1 whitespace-pre-wrap">{viewRow.description}</p>
                </div>
              ) : null}
              {viewRow.immediate_action_taken ? (
                <div>
                  <div className="font-semibold text-slate-900">Immediate action</div>
                  <p className="mt-1 whitespace-pre-wrap">{viewRow.immediate_action_taken}</p>
                </div>
              ) : null}
              {viewRow.corrective_action ? (
                <div>
                  <div className="font-semibold text-slate-900">Corrective action</div>
                  <p className="mt-1 whitespace-pre-wrap">{viewRow.corrective_action}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
