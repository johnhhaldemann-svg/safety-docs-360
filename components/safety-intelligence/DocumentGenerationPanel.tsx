"use client";

import { useState } from "react";
import type { GeneratedDocumentPayload } from "@/components/safety-intelligence/types";
import { appNativeSelectClassName } from "@/components/WorkspacePrimitives";

export function DocumentGenerationPanel({
  onGenerate,
  generated,
}: {
  onGenerate: (documentType: string) => Promise<void> | void;
  generated: GeneratedDocumentPayload | null;
}) {
  const [documentType, setDocumentType] = useState("jsa");
  const [working, setWorking] = useState(false);

  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4 shadow-[var(--app-shadow-soft)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <label className="grid gap-2 text-sm font-medium text-[var(--app-text-strong)]">
          Document type
          <select
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            className={appNativeSelectClassName}
          >
            <option value="jsa">JSA</option>
            <option value="csep">CSEP</option>
            <option value="peshep">PESHEP</option>
            <option value="pshsep">PSHSEP</option>
            <option value="permit">Permit</option>
            <option value="sop">SOP</option>
            <option value="work_plan">Work plan</option>
            <option value="safety_narrative">Safety narrative</option>
          </select>
        </label>
        <button
          type="button"
          disabled={working}
          onClick={async () => {
            setWorking(true);
            try {
              await onGenerate(documentType);
            } finally {
              setWorking(false);
            }
          }}
          className="rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {working ? "Generating..." : "Generate draft"}
        </button>
      </div>
      {generated ? (
        <div className="mt-4 grid gap-3">
          <div className="rounded-xl bg-[var(--app-panel)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--app-text-strong)]">{generated.document.title}</p>
            <p className="mt-1 text-sm text-[var(--app-text)]">{generated.risk.summary}</p>
          </div>
          {generated.document.sections.slice(0, 3).map((section) => (
            <div key={section.heading} className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">{section.heading}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-strong)]">{section.body}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

