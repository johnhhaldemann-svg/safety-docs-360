"use client";

import { Eye, Pencil, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SafetyObservationRow } from "@/lib/safety-observations/types";
import { ObservationSeverityBadge } from "./ObservationSeverityBadge";
import { ObservationStatusBadge } from "./ObservationStatusBadge";

function formatLabel(s: string) {
  return s.replace(/_/g, " ");
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function ObservationList({
  observations,
  jobsiteLabelById,
  assigneeLabelById,
  loading,
  onView,
  onEdit,
  onClose,
  onLoadMore,
  hasMore,
  loadingMore,
}: {
  observations: SafetyObservationRow[];
  jobsiteLabelById: Record<string, string>;
  assigneeLabelById: Record<string, string>;
  loading: boolean;
  onView: (row: SafetyObservationRow) => void;
  onEdit: (row: SafetyObservationRow) => void;
  onClose: (row: SafetyObservationRow) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
}) {
  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-slate-500">Loading observations…</CardContent>
      </Card>
    );
  }

  if (observations.length === 0) {
    return (
      <Card className="border-dashed border-slate-200 bg-slate-50/50">
        <CardContent className="py-12 text-center text-sm text-slate-600">
          No observations match the current filters.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Sub</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Jobsite</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {observations.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/80">
                <td className="max-w-[200px] px-4 py-3 font-semibold text-slate-900">
                  <span className="line-clamp-2">{row.title}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatLabel(row.observation_type)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatLabel(row.category)}</td>
                <td className="max-w-[120px] truncate px-4 py-3 text-slate-600">{formatLabel(row.subcategory)}</td>
                <td className="px-4 py-3">
                  <ObservationSeverityBadge severity={row.severity} />
                </td>
                <td className="px-4 py-3">
                  <ObservationStatusBadge status={row.status} />
                </td>
                <td className="max-w-[140px] truncate px-4 py-3 text-slate-600">
                  {row.jobsite_id ? jobsiteLabelById[row.jobsite_id] ?? row.jobsite_id.slice(0, 8) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(row.created_at)}</td>
                <td className="max-w-[120px] truncate px-4 py-3 text-slate-600">
                  {row.assigned_to
                    ? assigneeLabelById[row.assigned_to] ?? row.assigned_to.slice(0, 8)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex flex-wrap justify-end gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => onView(row)}>
                      <Eye className="size-3.5" />
                      View
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => onEdit(row)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={row.status === "Closed"}
                      onClick={() => onClose(row)}
                    >
                      <CheckCircle className="size-3.5" />
                      Close
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {observations.map((row) => (
          <Card key={row.id} className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base leading-snug">{row.title}</CardTitle>
              <div className="flex flex-wrap gap-2 pt-2">
                <ObservationSeverityBadge severity={row.severity} />
                <ObservationStatusBadge status={row.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <div>
                <span className="font-semibold text-slate-800">Type: </span>
                {formatLabel(row.observation_type)}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Category: </span>
                {formatLabel(row.category)} / {formatLabel(row.subcategory)}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Jobsite: </span>
                {row.jobsite_id ? jobsiteLabelById[row.jobsite_id] ?? "—" : "—"}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Created: </span>
                {formatDate(row.created_at)}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onView(row)}>
                  View
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => onEdit(row)}>
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={row.status === "Closed"}
                  onClick={() => onClose(row)}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasMore ? (
        <div className="flex justify-center pt-2">
          <Button type="button" variant="secondary" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
