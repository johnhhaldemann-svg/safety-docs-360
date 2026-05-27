"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  PlusCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import {
  PageHero,
  SectionCard,
  appButtonPrimaryClassName,
  appButtonQuietClassName,
  appButtonSecondaryClassName,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";

type OwnerChangeLogEntry = {
  id: string;
  change_key: string;
  changed_at: string;
  module_key: string | null;
  module_name: string;
  plain_english_description: string;
  files_changed: string[];
  pages_affected: string[];
  risk_level: "Low" | "Medium" | "High";
  owner_review_required: boolean;
  validation_checklist_url: string | null;
  related_page_url: string | null;
  customer_ready_status:
    | "Not tested"
    | "Blocked"
    | "Needs owner review"
    | "Approved for demo"
    | "Approved for customer use";
  why_changed: string;
  what_could_break: string;
  owner_manual_review: string;
  safe_to_show_customer: "Yes" | "No" | "Needs Review";
};

type ChangeLogResponse = {
  changes: OwnerChangeLogEntry[];
};

type FormState = {
  moduleName: string;
  plainEnglishDescription: string;
  riskLevel: OwnerChangeLogEntry["risk_level"];
  ownerReviewRequired: boolean;
  relatedPageUrl: string;
  validationChecklistUrl: string;
  customerReadyStatus: OwnerChangeLogEntry["customer_ready_status"];
  filesChanged: string;
  pagesAffected: string;
  whyChanged: string;
  whatCouldBreak: string;
  ownerManualReview: string;
  safeToShowCustomer: OwnerChangeLogEntry["safe_to_show_customer"];
};

const emptyForm: FormState = {
  moduleName: "",
  plainEnglishDescription: "",
  riskLevel: "Medium",
  ownerReviewRequired: true,
  relatedPageUrl: "",
  validationChecklistUrl: "",
  customerReadyStatus: "Needs owner review",
  filesChanged: "",
  pagesAffected: "",
  whyChanged: "",
  whatCouldBreak: "",
  ownerManualReview: "",
  safeToShowCustomer: "Needs Review",
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function riskStyles(risk: OwnerChangeLogEntry["risk_level"]) {
  if (risk === "High") return "border-red-200 bg-red-50 text-red-950";
  if (risk === "Medium") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function safeStyles(status: OwnerChangeLogEntry["safe_to_show_customer"]) {
  if (status === "Yes") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "No") return "border-red-200 bg-red-50 text-red-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

function splitList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
      />
    </label>
  );
}

function ChangeCard({ change }: { change: OwnerChangeLogEntry }) {
  return (
    <article className="rounded-xl border border-[var(--app-border)] bg-white p-5 shadow-[0_10px_22px_rgba(44,58,86,0.055)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
            {formatDate(change.changed_at)}
          </p>
          <h2 className="mt-1 text-lg font-black text-[var(--app-text-strong)]">
            {change.module_name}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${riskStyles(change.risk_level)}`}>
            {change.risk_level} risk
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${safeStyles(change.safe_to_show_customer)}`}>
            Customer: {change.safe_to_show_customer}
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--app-text)]">
        {change.plain_english_description}
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">Why it changed</p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{change.why_changed}</p>
        </div>
        <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">What could break</p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{change.what_could_break}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">Files changed</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-[var(--app-text)]">
            {change.files_changed.length > 0 ? (
              change.files_changed.map((file) => <li key={file}>{file}</li>)
            ) : (
              <li>No files listed.</li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">Pages affected</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-[var(--app-text)]">
            {change.pages_affected.length > 0 ? (
              change.pages_affected.map((page) => <li key={page}>{page}</li>)
            ) : (
              <li>No pages listed.</li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">Owner review</p>
          <p className="mt-2 text-xs leading-5 text-[var(--app-text)]">{change.owner_manual_review}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--app-panel-soft)] px-2.5 py-1 text-xs font-bold text-[var(--app-text-strong)]">
          {change.customer_ready_status}
        </span>
        {change.owner_review_required ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-950">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Owner review required
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Review optional
          </span>
        )}
        {change.related_page_url ? (
          <Link href={change.related_page_url} className={appButtonQuietClassName}>
            <ExternalLink className="h-4 w-4" aria-hidden />
            Open page
          </Link>
        ) : null}
        {change.validation_checklist_url ? (
          <Link href={change.validation_checklist_url} className={appButtonQuietClassName}>
            <FileText className="h-4 w-4" aria-hidden />
            Checklist
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export default function WhatChangedPage() {
  const [changes, setChanges] = useState<OwnerChangeLogEntry[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const response = await fetch("/api/superadmin/owner-validation/change-log", {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 403) {
        setForbidden(true);
        setChanges([]);
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Change log failed (${response.status})`);
      }

      const body = (await response.json()) as ChangeLogResponse;
      setChanges(body.changes);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "What Changed could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const requiredReviewCount = useMemo(
    () => changes.filter((change) => change.owner_review_required).length,
    [changes]
  );

  async function saveChange() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/superadmin/owner-validation/change-log", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleName: form.moduleName,
          plainEnglishDescription: form.plainEnglishDescription,
          riskLevel: form.riskLevel,
          ownerReviewRequired: form.ownerReviewRequired,
          relatedPageUrl: form.relatedPageUrl,
          validationChecklistUrl: form.validationChecklistUrl,
          customerReadyStatus: form.customerReadyStatus,
          filesChanged: splitList(form.filesChanged),
          pagesAffected: splitList(form.pagesAffected),
          whyChanged: form.whyChanged,
          whatCouldBreak: form.whatCouldBreak,
          ownerManualReview: form.ownerManualReview,
          safeToShowCustomer: form.safeToShowCustomer,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Change save failed (${response.status})`);
      }

      setForm(emptyForm);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Change entry could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <section className="rounded-xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-12 w-12 text-red-600" aria-hidden />
          <h1 className="mt-4 text-xl font-bold text-red-950">Access denied</h1>
          <p className="mt-2 text-sm leading-6 text-red-900">
            What Changed is restricted to Super Admin users only.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <PageHero
        eyebrow="Super Admin"
        title="What Changed?"
        description="A plain-English release log showing what changed, what pages are affected, what could break, and what the owner should review."
        actions={
          <>
            <button type="button" className={appButtonSecondaryClassName} onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
              Refresh
            </button>
            <Link href="/superadmin/owner-validation" className={appButtonPrimaryClassName}>
              <FileText className="h-4 w-4" aria-hidden />
              Owner Validation
            </Link>
          </>
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-950">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 shadow-[0_10px_22px_rgba(44,58,86,0.055)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">Entries</p>
          <p className="mt-1 text-3xl font-black text-[var(--app-text-strong)]">{changes.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
          <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">Need review</p>
          <p className="mt-1 text-3xl font-black">{requiredReviewCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 shadow-[0_10px_22px_rgba(44,58,86,0.055)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">Latest change</p>
          <p className="mt-2 text-sm font-bold text-[var(--app-text-strong)]">
            {changes[0] ? formatDate(changes[0].changed_at) : "No entries yet"}
          </p>
        </div>
      </section>

      <SectionCard
        title="Record A Change"
        description="Use this after a Codex or developer task so the owner can see what changed and what to click."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <TextInput
            label="Feature/module changed"
            value={form.moduleName}
            onChange={(value) => setForm((current) => ({ ...current, moduleName: value }))}
            placeholder="Owner Validation Console"
          />
          <TextInput
            label="Related page"
            value={form.relatedPageUrl}
            onChange={(value) => setForm((current) => ({ ...current, relatedPageUrl: value }))}
            placeholder="/superadmin/owner-validation"
          />
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
              Risk level
            </span>
            <select
              value={form.riskLevel}
              onChange={(event) => setForm((current) => ({ ...current, riskLevel: event.target.value as FormState["riskLevel"] }))}
              className={`${appNativeSelectClassName} w-full`}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
              Safe to show customer?
            </span>
            <select
              value={form.safeToShowCustomer}
              onChange={(event) => setForm((current) => ({ ...current, safeToShowCustomer: event.target.value as FormState["safeToShowCustomer"] }))}
              className={`${appNativeSelectClassName} w-full`}
            >
              <option value="Needs Review">Needs Review</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </label>
          <TextArea
            label="Plain-English description"
            value={form.plainEnglishDescription}
            onChange={(value) => setForm((current) => ({ ...current, plainEnglishDescription: value }))}
            placeholder="What changed in owner-friendly language?"
          />
          <TextArea
            label="Why was it changed?"
            value={form.whyChanged}
            onChange={(value) => setForm((current) => ({ ...current, whyChanged: value }))}
          />
          <TextArea
            label="What could break?"
            value={form.whatCouldBreak}
            onChange={(value) => setForm((current) => ({ ...current, whatCouldBreak: value }))}
          />
          <TextArea
            label="What should the owner click?"
            value={form.ownerManualReview}
            onChange={(value) => setForm((current) => ({ ...current, ownerManualReview: value }))}
          />
          <TextArea
            label="Files changed, one per line"
            value={form.filesChanged}
            onChange={(value) => setForm((current) => ({ ...current, filesChanged: value }))}
            rows={4}
          />
          <TextArea
            label="Pages affected, one per line"
            value={form.pagesAffected}
            onChange={(value) => setForm((current) => ({ ...current, pagesAffected: value }))}
            rows={4}
          />
          <TextInput
            label="Validation checklist link"
            value={form.validationChecklistUrl}
            onChange={(value) => setForm((current) => ({ ...current, validationChecklistUrl: value }))}
            placeholder="/superadmin/owner-validation#owner-review"
          />
          <label className="flex items-center gap-3 rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)]">
            <input
              type="checkbox"
              checked={form.ownerReviewRequired}
              onChange={(event) => setForm((current) => ({ ...current, ownerReviewRequired: event.target.checked }))}
              className="h-4 w-4 rounded border-[var(--app-border)]"
            />
            Owner review required
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className={appButtonPrimaryClassName}
            onClick={() => void saveChange()}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PlusCircle className="h-4 w-4" aria-hidden />}
            Record change
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Recent Changes"
        description="Each entry should tell the owner what changed, why, what could break, and what to manually review."
      >
        {loading && changes.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[var(--app-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading changes...
          </div>
        ) : (
          <div className="space-y-4">
            {changes.map((change) => (
              <ChangeCard key={change.id} change={change} />
            ))}
            {changes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--app-border-strong)] bg-white p-8 text-center text-sm text-[var(--app-muted)]">
                No change log entries have been recorded yet.
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
