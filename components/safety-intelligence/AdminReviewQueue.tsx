"use client";

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
  return (
    <div className="grid gap-3">
      {documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-white/80 px-4 py-6 text-sm text-[var(--app-text)]">
          No generated drafts are waiting in the review queue yet.
        </div>
      ) : null}
      {documents.map((document) => (
        <div
          key={document.id}
          className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 px-4 py-4 shadow-[var(--app-shadow-soft)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--app-text-strong)]">{document.title}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--app-text)]">
                {document.document_type.replace(/_/g, " ")}
              </p>
            </div>
            <div className="text-right">
              <p className="rounded-full bg-[rgba(217,164,65,0.12)] px-3 py-1 text-xs font-semibold uppercase text-[var(--semantic-warning)]">
                {document.status}
              </p>
              <p className="mt-2 text-xs text-[var(--app-text)]">
                {new Date(document.generated_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
