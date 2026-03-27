"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OBSERVATION_TYPES, SEVERITY_OPTIONS, STATUS_OPTIONS } from "@/lib/safety-observations/constants";
import { getCategoriesForType, getSubcategoriesFor } from "@/lib/safety-observations/tree";
import type { SafetyObservationRow } from "@/lib/safety-observations/types";

type JobsiteOption = { id: string; name: string };
type AssigneeOption = { id: string; label: string };

const defaultForm = {
  observation_type: "Hazard" as string,
  category: "",
  subcategory: "",
  severity: "Low" as string,
  status: "Open" as string,
  jobsite_id: "",
  title: "",
  description: "",
  location: "",
  trade: "",
  immediate_action_taken: "",
  corrective_action: "",
  assigned_to: "",
  due_date: "",
};

export function ObservationForm({
  jobsites,
  assignees,
  submitting,
  initial,
  onSubmit,
  onCancel,
}: {
  jobsites: JobsiteOption[];
  assignees: AssigneeOption[];
  submitting: boolean;
  initial: SafetyObservationRow | null;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(defaultForm);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  useEffect(() => {
    if (initial) {
      setForm({
        observation_type: initial.observation_type,
        category: initial.category,
        subcategory: initial.subcategory,
        severity: initial.severity,
        status: initial.status,
        jobsite_id: initial.jobsite_id ?? "",
        title: initial.title,
        description: initial.description ?? "",
        location: initial.location ?? "",
        trade: initial.trade ?? "",
        immediate_action_taken: initial.immediate_action_taken ?? "",
        corrective_action: initial.corrective_action ?? "",
        assigned_to: initial.assigned_to ?? "",
        due_date: initial.due_date ? initial.due_date.slice(0, 10) : "",
      });
    } else {
      const firstType = OBSERVATION_TYPES[0];
      const cats = getCategoriesForType(firstType);
      const firstCat = cats[0] ?? "";
      const subs = firstCat ? getSubcategoriesFor(firstType, firstCat) : [];
      setForm({
        ...defaultForm,
        observation_type: firstType,
        category: firstCat,
        subcategory: subs[0] ?? "",
      });
    }
    setPhotoPreviews([]);
  }, [initial]);

  const categories = useMemo(() => getCategoriesForType(form.observation_type), [form.observation_type]);
  const subcategories = useMemo(
    () => (form.category ? getSubcategoriesFor(form.observation_type, form.category) : []),
    [form.observation_type, form.category]
  );

  useEffect(() => {
    return () => {
      photoPreviews.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [photoPreviews]);

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "observation_type") {
        const cats = getCategoriesForType(value as string);
        next.category = cats[0] ?? "";
        next.subcategory = next.category
          ? getSubcategoriesFor(value as string, next.category)[0] ?? ""
          : "";
      }
      if (key === "category") {
        next.subcategory = getSubcategoriesFor(next.observation_type, value as string)[0] ?? "";
      }
      return next;
    });
  }

  function onPhotosChange(files: FileList | null) {
    if (!files?.length) return;
    const next = Array.from(files);
    setPhotoPreviews((prev) => [...prev, ...next.map((f) => URL.createObjectURL(f))]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      title: form.title.trim(),
      description: form.description.trim() || null,
      observation_type: form.observation_type,
      category: form.category,
      subcategory: form.subcategory,
      severity: form.severity,
      status: form.status,
      jobsite_id: form.jobsite_id || null,
      location: form.location.trim() || null,
      trade: form.trade.trim() || null,
      immediate_action_taken: form.immediate_action_taken.trim() || null,
      corrective_action: form.corrective_action.trim() || null,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
      photo_urls: [] as string[],
    });
  }

  return (
    <Card id="new-observation" className="shadow-md">
      <CardHeader>
        <CardTitle>{initial ? "Edit observation" : "New observation"}</CardTitle>
        <CardDescription>
          Log hazards, positive observations, and near misses. Category options follow the selected type.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="obs-type">Observation type</Label>
              <select
                id="obs-type"
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={form.observation_type}
                onChange={(e) => patch("observation_type", e.target.value)}
              >
                {OBSERVATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obs-sev">Severity</Label>
              <select
                id="obs-sev"
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={form.severity}
                onChange={(e) => patch("severity", e.target.value)}
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obs-cat">Category</Label>
              <select
                id="obs-cat"
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={form.category}
                onChange={(e) => patch("category", e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obs-sub">Subcategory</Label>
              <select
                id="obs-sub"
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={form.subcategory}
                onChange={(e) => patch("subcategory", e.target.value)}
              >
                {subcategories.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obs-status">Status</Label>
              <select
                id="obs-status"
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={form.status}
                onChange={(e) => patch("status", e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obs-jobsite">Jobsite</Label>
              <select
                id="obs-jobsite"
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={form.jobsite_id}
                onChange={(e) => patch("jobsite_id", e.target.value)}
              >
                <option value="">Unassigned</option>
                {jobsites.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs-title">Title</Label>
            <Input
              id="obs-title"
              required
              value={form.title}
              onChange={(e) => patch("title", e.target.value)}
              placeholder="Short summary of what you observed"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="obs-desc">Description</Label>
            <Textarea
              id="obs-desc"
              value={form.description}
              onChange={(e) => patch("description", e.target.value)}
              placeholder="Details, context, and who was involved"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="obs-loc">Location</Label>
              <Input
                id="obs-loc"
                value={form.location}
                onChange={(e) => patch("location", e.target.value)}
                placeholder="Area, grid, elevation…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obs-trade">Trade / contractor</Label>
              <Input
                id="obs-trade"
                value={form.trade}
                onChange={(e) => patch("trade", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="obs-immediate">Immediate action taken</Label>
            <Textarea id="obs-immediate" value={form.immediate_action_taken} onChange={(e) => patch("immediate_action_taken", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="obs-corrective">Corrective action</Label>
            <Textarea id="obs-corrective" value={form.corrective_action} onChange={(e) => patch("corrective_action", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="obs-assign">Assigned to</Label>
              <select
                id="obs-assign"
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={form.assigned_to}
                onChange={(e) => patch("assigned_to", e.target.value)}
              >
                <option value="">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obs-due">Due date</Label>
              <Input id="obs-due" type="date" value={form.due_date} onChange={(e) => patch("due_date", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Photos</Label>
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              <input
                type="file"
                accept="image/*"
                multiple
                className="text-sm"
                onChange={(e) => onPhotosChange(e.target.files)}
              />
              <p className="mt-2 text-xs text-slate-500">
                Previews are local only until storage upload is wired; saved observations store photo URLs from a future upload step.
              </p>
              {photoPreviews.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {photoPreviews.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="" className="h-16 w-16 rounded-lg border object-cover" />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : initial ? "Update observation" : "Save observation"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
