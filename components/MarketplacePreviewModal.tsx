"use client";

type PreviewVariant = "marketplace" | "workspace" | "admin";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  excerpt: string;
  truncated: boolean;
  empty: boolean;
  /** When set (e.g. marketplace PDF), show native browser PDF preview via blob URL — not a download link. */
  pdfObjectUrl?: string | null;
  /** Workspace = in-review / active library rows; marketplace = credit unlock listings; admin = review queue */
  variant?: PreviewVariant;
};

export function MarketplacePreviewModal({
  open,
  onClose,
  title,
  excerpt,
  truncated,
  empty,
  pdfObjectUrl,
  variant = "marketplace",
}: Props) {
  if (!open) {
    return null;
  }

  const emptyBody =
    variant === "admin"
      ? "No readable text could be extracted (for example, a scanned PDF). Use Download full draft or Open full upload on this page if you need the complete file."
      : variant === "workspace"
        ? "No readable text could be extracted (for example, a scanned PDF). When this record is approved, open the full file from Ready to open."
        : "No readable text could be pulled from the preview file (for example, a scanned PDF). Unlock the document after purchase to access the complete file from the publisher.";

  const footerMain =
    variant === "admin"
      ? "This is an on-screen excerpt only — not the full file. Use “Download full draft” or “Open full upload” on the review page when you need the complete document."
      : variant === "workspace"
        ? "This is an on-screen excerpt only — not a download. After approval, use Open document under Ready to open for the full file (with the usual confirmation)."
        : "This screen shows a short on-platform excerpt only. There is no file download here. Purchasing unlocks the full document through your library.";

  const truncatedNote =
    variant === "admin"
      ? "Text is truncated; download the full draft or company upload from the review actions if you need everything."
      : variant === "workspace"
        ? "Text is truncated; the full file is available only after approval from Ready to open."
        : "Text is truncated; the full content is available only after unlock.";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-excerpt-preview-title"
    >
      <button
        type="button"
        aria-label="Close preview"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        className={`relative z-[101] w-full rounded-2xl border border-slate-600 bg-slate-950 p-6 shadow-2xl ${
          pdfObjectUrl ? "max-w-[min(92vw,56rem)]" : "max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="document-excerpt-preview-title"
            className="text-lg font-bold tracking-tight text-white"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            Close
          </button>
        </div>

        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-amber-200/90">
          {pdfObjectUrl
            ? "PDF preview in browser — not a file download from this dialog"
            : "Preview excerpt — not the full document"}
        </p>

        {pdfObjectUrl ? (
          <div className="mt-4 flex flex-col gap-2">
            <a
              href={pdfObjectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2 text-sm font-semibold text-sky-300 transition hover:border-slate-500 hover:bg-slate-800/80"
            >
              Open PDF in new tab
            </a>
            <object
              data={pdfObjectUrl}
              type="application/pdf"
              title={title}
              className="h-[min(60vh,32rem)] w-full rounded-xl border border-slate-700/80 bg-white"
            >
              <p className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-4 text-sm leading-6 text-slate-400">
                Embedded preview is not available in this browser.{" "}
                <a
                  href={pdfObjectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-sky-400 underline"
                >
                  Open the PDF in a new tab
                </a>{" "}
                to view it.
              </p>
            </object>
          </div>
        ) : (
          <div className="relative mt-4 max-h-[min(50vh,22rem)] overflow-y-auto rounded-xl border border-slate-700/80 bg-slate-900/90 p-4">
            <div
              className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden opacity-[0.06] select-none"
              aria-hidden
            >
              <span className="-rotate-12 whitespace-nowrap text-3xl font-black tracking-widest text-white">
                PREVIEW ONLY · NOT FOR DOWNLOAD
              </span>
            </div>
            {empty ? (
              <p className="relative z-[1] text-sm leading-6 text-slate-400">{emptyBody}</p>
            ) : (
              <p className="relative z-[1] whitespace-pre-wrap text-sm leading-6 text-slate-200">
                {excerpt}
              </p>
            )}
          </div>
        )}

        <p className="mt-4 text-xs leading-5 text-slate-500">
          {pdfObjectUrl && variant === "marketplace"
            ? "This uses your browser’s built-in PDF viewer. Unlocking still adds the full file to your library for download or open."
            : footerMain}
        </p>
        {!pdfObjectUrl && !empty && truncated ? (
          <p className="mt-2 text-xs font-medium text-sky-300/90">{truncatedNote}</p>
        ) : null}
      </div>
    </div>
  );
}
