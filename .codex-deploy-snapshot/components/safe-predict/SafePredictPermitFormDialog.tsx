"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Pencil, X } from "lucide-react";
import {
  defaultPermitChecklistItems,
  isPermitFormComplete,
  permitReadinessLabel,
  preparePermitFormForSave,
  SAFE_PREDICT_PERMIT_ACK_STATEMENT,
  type SafePredictPermitForm,
} from "@/lib/safePredictPermitForms";
import type { SafePredictDataset } from "@/lib/safePredictData";
import type { SafePredictRiskLevel } from "@/lib/safePredictMockData";
import { SectionTitle, SelectShell, cx } from "@/components/safe-predict/SafePredictPrimitives";

export type SafePredictPermitFormMode = "view" | "edit" | "create";

export type SafePredictPermitFormSaveInput = {
  id?: string;
  title: string;
  siteId: string;
  type: string;
  status: SafePredictDataset["permits"][number]["status"];
  owner: string;
  expiresAt: string;
  riskLevel: SafePredictRiskLevel;
  permitForm: SafePredictPermitForm;
};

const permitTypeOptions = [
  { label: "Hot Work", value: "Hot Work" },
  { label: "Confined Space", value: "Confined Space" },
  { label: "Electrical", value: "Electrical" },
  { label: "Excavation", value: "Excavation" },
  { label: "Work at Heights", value: "Work at Heights" },
  { label: "Lockout / Tagout", value: "Lockout / Tagout" },
  { label: "Lift Plan", value: "Lift Plan" },
  { label: "Scaffold Inspection", value: "Scaffold Inspection" },
];

const permitStatusOptions: Array<{ label: string; value: SafePredictDataset["permits"][number]["status"] }> = [
  { label: "Active", value: "Active" },
  { label: "Expiring Soon", value: "Expiring Soon" },
  { label: "Expired", value: "Expired" },
];

const riskOptions: Array<{ label: string; value: SafePredictRiskLevel }> = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" },
];

function permitDraftFromRecord(
  permit: SafePredictDataset["permits"][number] | null,
  fallbackSiteId: string
): SafePredictPermitFormSaveInput {
  const type = permit?.type ?? "Hot Work";
  return {
    id: permit?.id,
    title: permit?.title || permit?.type || "",
    siteId: permit?.siteId || fallbackSiteId,
    type,
    status: permit?.status ?? "Active",
    owner: permit?.owner ?? "",
    expiresAt: permit?.expiresAt ?? "",
    riskLevel: permit?.riskLevel ?? "medium",
    permitForm:
      permit?.permitForm ??
      {
        checklistItems: defaultPermitChecklistItems(type),
        acknowledgement: {
          acknowledged: false,
          name: "",
          acknowledgedAt: null,
          statement: SAFE_PREDICT_PERMIT_ACK_STATEMENT,
        },
        notes: "",
      },
  };
}

export function SafePredictPermitFormDialog({
  mode,
  permit,
  jobsites,
  fallbackSiteId,
  saving = false,
  message = "",
  onClose,
  onModeChange,
  onSave,
}: {
  mode: SafePredictPermitFormMode;
  permit: SafePredictDataset["permits"][number] | null;
  jobsites: Array<{ id: string; name: string }>;
  fallbackSiteId: string;
  saving?: boolean;
  message?: string;
  onClose: () => void;
  onModeChange?: (mode: SafePredictPermitFormMode) => void;
  onSave: (input: SafePredictPermitFormSaveInput) => void | Promise<void>;
}) {
  const editable = mode !== "view";
  const [draft, setDraft] = useState(() => permitDraftFromRecord(permit, fallbackSiteId));

  const preparedForm = useMemo(() => preparePermitFormForSave(draft.permitForm), [draft.permitForm]);
  const readyToSave = Boolean(draft.title.trim() && draft.siteId && isPermitFormComplete(preparedForm));
  const readiness = permitReadinessLabel(preparedForm);

  function updatePermitForm(nextForm: SafePredictPermitForm) {
    setDraft((current) => ({ ...current, permitForm: nextForm }));
  }

  function updateChecklistItem(id: string, checked: boolean) {
    updatePermitForm({
      ...draft.permitForm,
      checklistItems: draft.permitForm.checklistItems.map((item) => (item.id === id ? { ...item, checked } : item)),
    });
  }

  function updatePermitType(type: string) {
    setDraft((current) => ({
      ...current,
      type,
      permitForm: {
        ...current.permitForm,
        checklistItems: defaultPermitChecklistItems(type),
      },
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-lg border border-slate-200 bg-white shadow-2xl sm:rounded-lg">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-5">
          <SectionTitle
            title={mode === "create" ? "Create Permit" : mode === "view" ? "View Permit" : "Edit Permit"}
            action={
              <div className="flex items-center gap-2">
                {mode === "view" && onModeChange ? (
                  <button type="button" onClick={() => onModeChange("edit")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                ) : null}
                <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600" aria-label="Close permit form">
                  <X className="h-4 w-4" />
                </button>
              </div>
            }
            hint="Complete the permit checklist and acknowledgment before releasing the permit as ready."
          />
          {message ? <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">{message}</p> : null}
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block lg:col-span-2">
                <span className="mb-1 block text-xs font-bold text-slate-600">Permit title</span>
                <input value={draft.title} disabled={!editable} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-blue-500 disabled:bg-slate-50" />
              </label>
              <SelectShell label="Jobsite" value={draft.siteId} onChange={(value) => setDraft((current) => ({ ...current, siteId: value }))} options={jobsites.map((site) => ({ label: site.name, value: site.id }))} disabled={!editable} />
              <SelectShell label="Permit type" value={draft.type} onChange={updatePermitType} options={permitTypeOptions} disabled={!editable} />
              <SelectShell label="Status" value={draft.status} onChange={(value) => setDraft((current) => ({ ...current, status: value as SafePredictDataset["permits"][number]["status"] }))} options={permitStatusOptions} disabled={!editable} />
              <SelectShell label="Risk" value={draft.riskLevel} onChange={(value) => setDraft((current) => ({ ...current, riskLevel: value as SafePredictRiskLevel }))} options={riskOptions} disabled={!editable} />
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">Owner</span>
                <input value={draft.owner} disabled={!editable} onChange={(event) => setDraft((current) => ({ ...current, owner: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-blue-500 disabled:bg-slate-50" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">Expiration</span>
                <input value={draft.expiresAt} disabled={!editable} onChange={(event) => setDraft((current) => ({ ...current, expiresAt: event.target.value }))} placeholder="May 27 or 2026-05-27" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-blue-500 disabled:bg-slate-50" />
              </label>
            </div>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Permit checklist</h3>
                <span className={cx("rounded-full border px-2.5 py-1 text-xs font-black", readiness === "Ready" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700")}>{readiness}</span>
              </div>
              <div className="mt-3 grid gap-3">
                {draft.permitForm.checklistItems.map((item) => (
                  <label key={item.id} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={item.checked} disabled={!editable} onChange={(event) => updateChecklistItem(item.id, event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </section>

            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Notes</span>
              <textarea value={draft.permitForm.notes ?? ""} disabled={!editable} onChange={(event) => updatePermitForm({ ...draft.permitForm, notes: event.target.value })} rows={4} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-blue-500 disabled:bg-slate-50" />
            </label>
          </div>

          <div className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-950">
                <CheckCircle2 className="h-5 w-5 text-emerald-800" />
                <h3 className="text-sm font-black uppercase tracking-wide">Acknowledgment</h3>
              </div>
              <label className="mt-4 flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.permitForm.acknowledgement.acknowledged}
                  disabled={!editable}
                  onChange={(event) =>
                    updatePermitForm({
                      ...draft.permitForm,
                      acknowledgement: {
                        ...draft.permitForm.acknowledgement,
                        acknowledged: event.target.checked,
                        acknowledgedAt: event.target.checked ? draft.permitForm.acknowledgement.acknowledgedAt : null,
                      },
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>{draft.permitForm.acknowledgement.statement}</span>
              </label>
              <label className="mt-4 block">
                <span className="mb-1 block text-xs font-bold text-slate-600">Acknowledged by</span>
                <input value={draft.permitForm.acknowledgement.name} disabled={!editable} onChange={(event) => updatePermitForm({ ...draft.permitForm, acknowledgement: { ...draft.permitForm.acknowledgement, name: event.target.value } })} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-blue-500 disabled:bg-slate-50" />
              </label>
              <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                {draft.permitForm.acknowledgement.acknowledgedAt ? `Acknowledged ${new Date(draft.permitForm.acknowledgement.acknowledgedAt).toLocaleString()}` : "Timestamp is set when the acknowledgment is saved."}
              </p>
            </section>

            {editable ? (
              <button type="button" disabled={saving || !readyToSave} onClick={() => void onSave({ ...draft, permitForm: preparedForm })} className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)] disabled:cursor-not-allowed disabled:bg-slate-300">
                {saving ? "Saving..." : mode === "create" ? "Create permit" : "Save permit"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
