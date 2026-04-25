"use client";

import { formatSafetyBlueprintDocumentType } from "@/lib/safetyBlueprintLabels";

export function AdminReviewQueue({
  documents,
}: {
  documents: Array<{
    id: string;
    document_type: string;
    title: string;
    status: string;
    generated_at: string;
  }>;
}) {
  const visibleDocuments = documents.slice(0, 6);
  const hiddenCount = Math.max(0, documents.length - visibleDocuments.length);

  return (
    <div className="grid gap-2">
      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--app-border-strong)] bg-white/80 px-3 py-4 text-xs text-[var(--app-text)]">
          No generated drafts are waiting in the review queue yet.
        </div>
      ) : null}
      {visibleDocuments.map((document) => (
        <div
          key={document.id}
          className="rounded-xl border border-[var(--app-border-strong)] bg-white/85 px-3 py-2.5 shadow-[var(--app-shadow-soft)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[var(--app-text-strong)]">{document.title}</p>
              <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] text-[var(--app-text)]">
                {formatSafetyBlueprintDocumentType(document.document_type).replace(/_/g, " ")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="rounded-full bg-[rgba(217,164,65,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--semantic-warning)]">
                {document.status}
              </p>
              <p className="mt-1 text-[10px] text-[var(--app-text)]">
                {new Date(document.generated_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ))}
      {hiddenCount ? (
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs font-semibold text-[var(--app-text)]">
          {hiddenCount} older draft{hiddenCount === 1 ? "" : "s"} hidden to keep this workspace focused.
        </div>
      ) : null}
    </div>
  );
}
