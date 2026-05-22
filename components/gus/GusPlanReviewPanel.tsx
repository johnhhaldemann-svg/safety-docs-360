"use client";

import { ClipboardCheck, FileCheck2, FileText, Save } from "lucide-react";
import type {
  GusDraftDocumentType,
  GusDraftSafeWorkPlan,
} from "@/lib/gus/plans/basePlanningTypes";

type GusPlanReviewPanelProps = {
  plan: GusDraftSafeWorkPlan | null;
  missingInformation: string[];
  stagedDocuments: GusDraftDocumentType[];
  statusMessage: string | null;
  onGeneratePlan: () => void;
  onStageDocument: (documentType: GusDraftDocumentType) => void;
  onSaveSession: () => void;
};

const documentLabels: Record<GusDraftDocumentType, string> = {
  safe_work_plan: "Generate draft safe work plan",
  jsa: "Create draft JSA",
  permit_checklist: "Create draft permit checklist",
  pretask_briefing: "Create pre-task briefing",
};

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">{title}</h4>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm leading-6 text-[var(--app-text)]">
          {items.slice(0, 6).map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-[var(--app-muted)]">Needs review.</p>
      )}
    </div>
  );
}

export function GusPlanReviewPanel({
  plan,
  missingInformation,
  stagedDocuments,
  statusMessage,
  onGeneratePlan,
  onStageDocument,
  onSaveSession,
}: GusPlanReviewPanelProps) {
  return (
    <aside className="space-y-4">
      <section className="rounded-lg border border-[var(--app-border)] bg-white p-4">
        <h3 className="text-sm font-bold text-[var(--app-text-strong)]">Missing Information</h3>
        {missingInformation.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-800">
            {missingInformation.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-6 text-emerald-700">
            Required planning prompts have draft responses. Human review is still required.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-[var(--app-border)] bg-white p-4">
        <h3 className="text-sm font-bold text-[var(--app-text-strong)]">Draft Plan Preview</h3>
        {plan ? (
          <div className="mt-3 space-y-4">
            <div>
              <p className="text-sm font-semibold text-[var(--app-text-strong)]">{plan.title}</p>
              <p className="mt-1 text-xs text-[var(--app-muted)]">
                Status: {plan.status.replaceAll("_", " ")}. Official record created: no.
              </p>
            </div>
            <ListBlock title="Hazards" items={plan.hazards} />
            <ListBlock title="Controls" items={plan.controls} />
            <ListBlock title="Possible Permits" items={plan.possiblePermits} />
            <ListBlock title="Required Reviewers" items={plan.requiredReviewers} />
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
            Generate a draft safe work plan to preview hazards, controls, permits, inspections, and reviewers.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
        <div className="grid gap-2">
          <button
            type="button"
            onClick={onGeneratePlan}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--app-accent-primary)] px-3 py-2 text-sm font-semibold text-white shadow-[var(--app-shadow-primary-button)] transition hover:bg-[var(--app-accent-primary-hover)]"
          >
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            {documentLabels.safe_work_plan}
          </button>
          <button
            type="button"
            onClick={() => onStageDocument("jsa")}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)]"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {documentLabels.jsa}
          </button>
          <button
            type="button"
            onClick={() => onStageDocument("permit_checklist")}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)]"
          >
            <FileCheck2 className="h-4 w-4" aria-hidden="true" />
            {documentLabels.permit_checklist}
          </button>
          <button
            type="button"
            onClick={() => onStageDocument("pretask_briefing")}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)]"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {documentLabels.pretask_briefing}
          </button>
          <button
            type="button"
            onClick={onSaveSession}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-muted)] transition hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text-strong)]"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Save planning session
          </button>
        </div>
        {stagedDocuments.length > 0 ? (
          <p className="mt-3 text-xs leading-5 text-[var(--app-muted)]">
            Staged locally: {stagedDocuments.map((item) => item.replaceAll("_", " ")).join(", ")}.
          </p>
        ) : null}
        {statusMessage ? (
          <p className="mt-3 text-xs font-semibold leading-5 text-emerald-700" role="status">
            {statusMessage}
          </p>
        ) : null}
      </section>
    </aside>
  );
}

