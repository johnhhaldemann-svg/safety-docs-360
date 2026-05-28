"use client";
import { deferEffect } from "@/lib/deferredEffect";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Filter,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Star,
  XCircle,
} from "lucide-react";

type ReviewRow = {
  id: string;
  sourceType: "sor" | "incident" | "injury" | "corrective_action";
  companyId: string;
  companyName: string;
  title: string;
  detail: string;
  status: "pending" | "approved" | "rejected";
  rating: number | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  reviewedAt: string | null;
  severity: string | null;
};

type Payload = {
  rows: ReviewRow[];
  summary: {
    pending: number;
    approved: number;
    rejected: number;
    averageRating: number | null;
  };
};

const SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "sor", label: "SOR" },
  { value: "incident", label: "Incidents" },
  { value: "injury", label: "Injuries" },
  { value: "corrective_action", label: "Corrective actions" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All statuses" },
];

function formatDate(value: string | null) {
  if (!value) return "Not reviewed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function sourceLabel(sourceType: ReviewRow["sourceType"]) {
  if (sourceType === "sor") return "SOR";
  if (sourceType === "injury") return "Injury";
  if (sourceType === "corrective_action") return "Corrective Action";
  return "Incident";
}

function statusClasses(status: ReviewRow["status"]) {
  if (status === "approved") return "border-emerald-500/40 bg-emerald-950/30 text-emerald-100";
  if (status === "rejected") return "border-red-500/40 bg-red-950/30 text-red-100";
  return "border-amber-500/40 bg-amber-950/30 text-amber-100";
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "emerald" | "red" | "sky";
}) {
  const tones = {
    amber: "border-amber-500/35 bg-amber-950/25 text-amber-100",
    emerald: "border-emerald-500/35 bg-emerald-950/25 text-emerald-100",
    red: "border-red-500/35 bg-red-950/25 text-red-100",
    sky: "border-sky-500/35 bg-sky-950/25 text-sky-100",
  };
  return (
    <div className={`rounded-md border p-4 ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function PredictionValidationPage() {
  const [sourceType, setSourceType] = useState("all");
  const [status, setStatus] = useState("pending");
  const [rating, setRating] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewRating, setReviewRating] = useState("3");
  const [reviewTags, setReviewTags] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("sourceType", sourceType);
    params.set("status", status);
    params.set("limit", "150");
    if (rating) params.set("rating", rating);
    if (companyId.trim()) params.set("companyId", companyId.trim());
    return params.toString();
  }, [companyId, rating, sourceType, status]);

  const rows = payload?.rows ?? [];
  const selectedRows = rows.filter((row) => selected.has(`${row.sourceType}:${row.id}`));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/superadmin/prediction-validation?${query}`);
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to load prediction validation queue.");
      }
      setPayload(body as Payload);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load prediction validation queue.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => deferEffect(() => {
    void load();
  }), [load]);

  function toggle(row: ReviewRow) {
    const key = `${row.sourceType}:${row.id}`;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      if (current.size === rows.length) return new Set();
      return new Set(rows.map((row) => `${row.sourceType}:${row.id}`));
    });
  }

  async function review(nextStatus: "approved" | "rejected", explicitRow?: ReviewRow) {
    const targetRows = explicitRow ? [explicitRow] : selectedRows;
    if (targetRows.length === 0) {
      setError("Select at least one record to review.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/superadmin/prediction-validation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          rating: reviewRating ? Number(reviewRating) : null,
          tags: reviewTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          notes: reviewNotes,
          items: targetRows.map((row) => ({ id: row.id, sourceType: row.sourceType })),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to save review decision.");
      }
      setReviewNotes("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save review decision.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-200">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Superadmin
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Prediction Validation</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Review SOR, incident, injury, and corrective-action records before they become eligible for prediction models.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-sky-500/50 bg-sky-950 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-900"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </header>

        {error ? (
          <div className="rounded-md border border-red-500/50 bg-red-950/40 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pending" value={String(payload?.summary.pending ?? 0)} tone="amber" />
          <StatCard label="Approved" value={String(payload?.summary.approved ?? 0)} tone="emerald" />
          <StatCard label="Rejected" value={String(payload?.summary.rejected ?? 0)} tone="red" />
          <StatCard
            label="Average rating"
            value={payload?.summary.averageRating == null ? "n/a" : payload.summary.averageRating.toFixed(2)}
            tone="sky"
          />
        </section>

        <section className="rounded-md border border-slate-800 bg-slate-950/80 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Filter className="h-4 w-4 text-sky-200" aria-hidden="true" />
            Filters
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
              aria-label="Source type"
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Validation status"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              aria-label="Rating filter"
            >
              <option value="">Any rating</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value} star
                </option>
              ))}
            </select>
            <input
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              placeholder="Company ID"
            />
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
            >
              Apply
            </button>
          </div>
        </section>

        <section className="rounded-md border border-slate-800 bg-slate-950/80 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <ClipboardCheck className="h-4 w-4 text-sky-200" aria-hidden="true" />
                Review decision
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {selectedRows.length} selected. Approved records require a 1-5 quality rating.
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-[100px_1fr_1.5fr_auto_auto]">
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={reviewRating}
                onChange={(event) => setReviewRating(event.target.value)}
                aria-label="Review rating"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <input
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={reviewTags}
                onChange={(event) => setReviewTags(event.target.value)}
                placeholder="Tags, comma-separated"
              />
              <input
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={reviewNotes}
                onChange={(event) => setReviewNotes(event.target.value)}
                placeholder="Review notes"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void review("approved")}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-950 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-900 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Approve
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void review("rejected")}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-red-500/50 bg-red-950 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-900 disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Reject
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-slate-800 bg-slate-950/80">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-4">
            <h2 className="text-sm font-semibold text-slate-100">Validation queue</h2>
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
            >
              {selected.size === rows.length && rows.length > 0 ? "Clear selection" : "Select all"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-3 pl-4 pr-3">Select</th>
                  <th className="py-3 pr-4">Record</th>
                  <th className="py-3 pr-4">Company</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Rating</th>
                  <th className="py-3 pr-4">Created</th>
                  <th className="py-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {loading ? (
                  <tr>
                    <td className="py-8 text-center text-slate-400" colSpan={7}>
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-hidden="true" />
                    </td>
                  </tr>
                ) : null}
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td className="py-8 text-center text-slate-400" colSpan={7}>
                      No records match this queue.
                    </td>
                  </tr>
                ) : null}
                {!loading
                  ? rows.map((row) => {
                      const key = `${row.sourceType}:${row.id}`;
                      return (
                        <tr key={key} className={selected.has(key) ? "bg-sky-950/25" : ""}>
                          <td className="py-3 pl-4 pr-3">
                            <input
                              type="checkbox"
                              checked={selected.has(key)}
                              onChange={() => toggle(row)}
                              aria-label={`Select ${sourceLabel(row.sourceType)} ${row.id}`}
                            />
                          </td>
                          <td className="max-w-lg py-3 pr-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-200">
                                {sourceLabel(row.sourceType)}
                              </span>
                              {row.severity ? (
                                <span className="text-xs uppercase tracking-wide text-slate-400">{row.severity}</span>
                              ) : null}
                            </div>
                            <div className="mt-1 font-medium text-slate-100">{row.title}</div>
                            <div className="mt-1 text-xs text-slate-400">{row.detail || row.id}</div>
                            {row.notes ? <div className="mt-1 text-xs text-slate-500">{row.notes}</div> : null}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="font-medium text-slate-100">{row.companyName}</div>
                            <div className="text-xs text-slate-500">{row.companyId}</div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClasses(row.status)}`}>
                              {row.status}
                            </span>
                            <div className="mt-1 text-xs text-slate-500">{formatDate(row.reviewedAt)}</div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-4 w-4 text-amber-300" aria-hidden="true" />
                              {row.rating ?? "n/a"}
                            </span>
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void review("approved", row)}
                                className="rounded-md border border-emerald-500/40 px-2 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-950"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void review("rejected", row)}
                                className="rounded-md border border-red-500/40 px-2 py-1 text-xs font-semibold text-red-100 hover:bg-red-950"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
