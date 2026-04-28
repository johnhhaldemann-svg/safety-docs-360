"use client";

import { formatSafetyBlueprintDocumentType } from "@/lib/safetyBlueprintLabels";
import { EmptyState, StatusBadge } from "@/components/WorkspacePrimitives";

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
    <div className="grid gap-3">
      {documents.length === 0 ? (
        <EmptyState
          title="No drafts waiting for review"
          description="Generate a draft from an evaluated work package and it will appear here for admin review."
          align="left"
          className="p-5"
        />
      ) : null}
      {visibleDocuments.map((document) => (
        <div
          key={document.id}
          className="rounded-xl border border-[var(--app-border-strong)] bg-white/92 px-4 py-3 shadow-[var(--app-shadow-soft)]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--app-text-strong)]">{document.title}</p>
              <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">
                {formatSafetyBlueprintDocumentType(document.document_type).replace(/_/g, " ")}
              </p>
              <p className="mt-2 text-xs text-[var(--app-muted)]">
                Generated {new Date(document.generated_at).toLocaleString()}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              <StatusBadge label={document.status} tone={document.status === "approved" ? "success" : "warning"} />
              <p className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-strong)]">
                Review next
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
