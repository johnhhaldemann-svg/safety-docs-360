"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OBSERVATION_TYPES, SEVERITY_OPTIONS, STATUS_OPTIONS } from "@/lib/safety-observations/constants";
import { getCategoriesForType, getSubcategoriesFor } from "@/lib/safety-observations/tree";
import { cn } from "@/lib/utils";

export type ObservationFilterState = {
  search: string;
  observation_type: string;
  category: string;
  subcategory: string;
  severity: string;
  status: string;
  jobsite_id: string;
};

type JobsiteOption = { id: string; name: string };

export function ObservationFilters({
  value,
  onChange,
  jobsites,
  className,
}: {
  value: ObservationFilterState;
  onChange: (next: ObservationFilterState) => void;
  jobsites: JobsiteOption[];
  className?: string;
}) {
  const categories = value.observation_type ? getCategoriesForType(value.observation_type) : [];
  const subcategories =
    value.observation_type && value.category
      ? getSubcategoriesFor(value.observation_type, value.category)
      : [];

  function patch(partial: Partial<ObservationFilterState>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search title or description…"
          className="pl-10"
          value={value.search}
          onChange={(e) => patch({ search: e.target.value })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <select
            className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={value.observation_type}
            onChange={(e) =>
              patch({
                observation_type: e.target.value,
                category: "",
                subcategory: "",
              })
            }
          >
            <option value="">All types</option>
            {OBSERVATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <select
            className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={value.category}
            disabled={!value.observation_type}
            onChange={(e) => patch({ category: e.target.value, subcategory: "" })}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Subcategory</Label>
          <select
            className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={value.subcategory}
            disabled={!value.category}
            onChange={(e) => patch({ subcategory: e.target.value })}
          >
            <option value="">All subcategories</option>
            {subcategories.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Severity</Label>
          <select
            className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={value.severity}
            onChange={(e) => patch({ severity: e.target.value })}
          >
            <option value="">All</option>
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <select
            className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={value.status}
            onChange={(e) => patch({ status: e.target.value })}
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Jobsite</Label>
          <select
            className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={value.jobsite_id}
            onChange={(e) => patch({ jobsite_id: e.target.value })}
          >
            <option value="">All jobsites</option>
            {jobsites.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
