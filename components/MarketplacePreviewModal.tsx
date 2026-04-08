"use client";

type PreviewVariant = "marketplace" | "workspace" | "admin";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  excerpt: string;
  truncated: boolean;
  empty: boolean;
  /** When set (e.g. marketplace PDF), show native browser PDF preview via blob URL - not a download link. */
  pdfObjectUrl?: string | null;
  /** Workspace = in-review / active library rows; marketplace = credit unlock listings; admin = review queue */
  variant?: PreviewVariant;
};

type PreviewField = {
  label: string;
  value: string;
};

const PREVIEW_FIELD_LABELS = [
  "Project Name",
  "Project Number",
  "Project Address",
  "Owner / Client",
  "GC / CM",
  "Safety Contact",
  "Contractor Company",
  "Contractor Phone",
  "Contractor Email",
  "Plan Author",
  "Approved By",
  "Approval Date",
  "Revision",
  "Document Status",
  "Document Purpose",
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePreviewText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitPreviewLines(value: string) {
  if (!value.trim()) {
    return [] as string[];
  }

  const labelPattern = PREVIEW_FIELD_LABELS.map(escapeRegExp).join("|");
  const withLabelBreaks = value.replace(new RegExp(`\\b(${labelPattern})\\b`, "g"), "\n$1");

  return withLabelBreaks
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function extractPreviewFields(lines: string[]) {
  const fields: PreviewField[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    for (const label of PREVIEW_FIELD_LABELS) {
      const labelLower = label.toLowerCase();
      if (!lowerLine.startsWith(labelLower)) {
        continue;
      }

      if (seen.has(labelLower)) {
        break;
      }

      const value = line
        .slice(label.length)
        .replace(/^[:\-–—\s]+/u, "")
        .trim();

      if (!value) {
        break;
      }

      seen.add(labelLower);
      fields.push({ label, value });
      break;
    }

    if (fields.length >= 8) {
      break;
    }
  }

  return fields;
}

function variantLabel(variant: PreviewVariant) {
  switch (variant) {
    case "admin":
      return "Admin review";
    case "workspace":
      return "Workspace";
    case "marketplace":
    default:
      return "Marketplace";
  }
}

function variantDescription(variant: PreviewVariant) {
  switch (variant) {
    case "admin":
      return "On-screen excerpt for internal review only.";
    case "workspace":
      return "On-screen excerpt for your company workspace.";
    case "marketplace":
    default:
      return "On-screen excerpt before unlock.";
  }
}

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

  const normalizedExcerpt = normalizePreviewText(excerpt);
  const previewLines = splitPreviewLines(normalizedExcerpt);
  const keyFields = extractPreviewFields(previewLines);
  const previewModeLabel = pdfObjectUrl ? "PDF preview" : "Text excerpt";
  const previewScopeLabel = variantLabel(variant);
  const previewScopeDescription = variantDescription(variant);

  const emptyBody =
    variant === "admin"
      ? "No readable text could be extracted. Use Download full draft or Open full upload on the review page if you need the complete file."
      : variant === "workspace"
        ? "No readable text could be extracted. When this record is approved, open the full file from Ready to open."
        : "No readable text could be pulled from the preview file. Unlock the document after purchase to access the complete file from the publisher.";

  const footerMain =
    variant === "admin"
      ? "This is an on-screen excerpt only, not the full file. Use Download full draft or Open full upload on the review page when you need the complete document."
      : variant === "workspace"
        ? "This is an on-screen excerpt only, not a download. After approval, use Open document under Ready to open for the full file."
        : "This screen shows a short on-platform excerpt only. There is no file download here. Purchasing unlocks the full document through your library.";

  const truncatedNote =
    variant === "admin"
      ? "Text is truncated; download the full draft or company upload from the review actions if you need everything."
      : variant === "workspace"
        ? "Text is truncated; the full file is available only after approval from Ready to open."
        : "Text is truncated; the full content is available only after unlock.";

  const metaCards = [
    { label: "Scope", value: previewScopeLabel },
    { label: "Mode", value: previewModeLabel },
    { label: "Lines", value: empty ? "0" : String(previewLines.length) },
    { label: "Preview", value: truncated ? "Truncated" : "Full excerpt" },
  ];

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
        className={`relative z-[101] w-full rounded-[1.75rem] border border-slate-600 bg-slate-950 p-5 shadow-2xl sm:p-6 ${
          pdfObjectUrl ? "max-w-[min(94vw,72rem)]" : "max-w-[min(94vw,64rem)]"
        }`}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-sky-300/90">
              {previewScopeLabel} preview
            </p>
            <h2
              id="document-excerpt-preview-title"
              className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl"
            >
              {title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {previewScopeDescription}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metaCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-700/80 bg-slate-900/70 px-4 py-3"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                {card.label}
              </p>
              <p className="mt-2 text-sm font-semibold text-white">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="rounded-3xl border border-slate-700/80 bg-slate-900/80 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Overview
                </p>
                <h3 className="mt-2 text-lg font-bold text-white">Document snapshot</h3>
              </div>
              <span className="rounded-full border border-slate-700/80 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-300">
                {empty ? "No text extracted" : "Readable excerpt"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MiniStat label="Audience" value={previewScopeLabel} />
              <MiniStat label="Readability" value={empty ? "No readable text" : "Text available"} />
              <MiniStat label="Source" value={pdfObjectUrl ? "Browser PDF viewer" : "Text excerpt"} />
              <MiniStat label="Availability" value={truncated ? "Truncated" : "Complete excerpt"} />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-700/80 bg-slate-950/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                What this preview means
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{footerMain}</p>
              {!pdfObjectUrl && !empty && truncated ? (
                <p className="mt-3 text-sm font-medium text-sky-300">{truncatedNote}</p>
              ) : null}
              {empty ? (
                <p className="mt-3 text-sm leading-6 text-slate-400">{emptyBody}</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-700/80 bg-slate-900/80 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Key details
                </p>
                <h3 className="mt-2 text-lg font-bold text-white">Detected fields</h3>
              </div>
            </div>

            {keyFields.length > 0 ? (
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {keyFields.map((field) => (
                  <div
                    key={field.label}
                    className="rounded-2xl border border-slate-700/70 bg-slate-950/80 px-4 py-3"
                  >
                    <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      {field.label}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold leading-6 text-slate-100">
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/70 p-4">
                <p className="text-sm font-semibold text-slate-200">
                  No labeled fields were detected.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  This preview is still readable below, but it does not contain the common
                  construction labels we look for.
                </p>
              </div>
            )}
          </section>
        </div>

        {pdfObjectUrl ? (
          <div className="mt-5 flex flex-col gap-3">
            <a
              href={pdfObjectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center rounded-xl border border-slate-600 bg-slate-900/90 px-3 py-2 text-sm font-semibold text-sky-300 transition hover:border-slate-500 hover:bg-slate-800/80"
            >
              Open PDF in new tab
            </a>
            <object
              data={pdfObjectUrl}
              type="application/pdf"
              title={title}
              className="h-[min(60vh,36rem)] w-full rounded-3xl border border-slate-700/80 bg-white"
            >
              <p className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-4 text-sm leading-6 text-slate-400">
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
          <section className="mt-5 rounded-3xl border border-slate-700/80 bg-slate-900/80">
            <div className="border-b border-slate-800/80 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Readable excerpt
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                The text below is split into smaller rows so it is easier to scan.
              </p>
            </div>
            {empty ? (
              <div className="px-5 py-6">
                <p className="text-sm leading-6 text-slate-400">{emptyBody}</p>
              </div>
            ) : (
              <div className="max-h-[min(52vh,28rem)] overflow-y-auto">
                {previewLines.map((line, index) => (
                  <div
                    key={`${index}-${line.slice(0, 32)}`}
                    className="flex gap-3 border-b border-slate-800/70 px-5 py-3 last:border-b-0"
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-slate-300">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-slate-100">{line}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <p className="mt-4 text-xs leading-5 text-slate-500">
          {pdfObjectUrl && variant === "marketplace"
            ? "This uses the browser's built-in PDF viewer. Unlocking still adds the full file to your library for download or open."
            : footerMain}
        </p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}
