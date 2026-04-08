"use client";

import { useState } from "react";

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

function splitIntoSentences(value: string) {
  return value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function getSummaryPoints(value: string, lines: string[]) {
  const sentences = splitIntoSentences(value).filter((sentence) => sentence.length >= 40);
  if (sentences.length > 0) {
    return sentences.slice(0, 3);
  }

  return lines.slice(0, 3).filter((line) => line.length > 0);
}

function chunkLines(lines: string[], size: number) {
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }
  return chunks;
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

function variantPitch(variant: PreviewVariant) {
  switch (variant) {
    case "admin":
      return "Review the structure, completeness, and readability before you approve the file into the workspace.";
    case "workspace":
      return "Use this preview to confirm the record is polished and ready for your company library.";
    case "marketplace":
    default:
      return "See the finished document style, section structure, and buyer value before you spend credits to unlock it.";
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
  const [showAllExcerpt, setShowAllExcerpt] = useState(false);

  if (!open) {
    return null;
  }

  const normalizedExcerpt = normalizePreviewText(excerpt);
  const previewLines = splitPreviewLines(normalizedExcerpt);
  const summaryPoints = getSummaryPoints(normalizedExcerpt, previewLines);
  const keyFields = extractPreviewFields(previewLines);
  const previewModeLabel = pdfObjectUrl ? "PDF preview" : "Text excerpt";
  const previewScopeLabel = variantLabel(variant);
  const previewScopeDescription = variantDescription(variant);
  const previewPitch = variantPitch(variant);
  const isMarketplacePreview = variant === "marketplace";

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
    { label: "Preview", value: truncated ? "Sample view" : "Full sample" },
  ];
  const previewLineLimit = isMarketplacePreview ? 30 : 9;
  const visibleExcerptLines = showAllExcerpt ? previewLines : previewLines.slice(0, previewLineLimit);
  const excerptChunks = chunkLines(visibleExcerptLines, 3);
  const hasMoreExcerpt = previewLines.length > visibleExcerptLines.length;
  const excerptCardClass = isMarketplacePreview
    ? "rounded-3xl border border-slate-300/80 bg-gradient-to-br from-slate-50 to-slate-100 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.12)]"
    : "rounded-2xl border border-slate-700/80 bg-slate-950/80 p-4";
  const excerptTextClass = isMarketplacePreview ? "text-slate-900" : "text-slate-100";
  const excerptMetaClass = isMarketplacePreview
    ? "text-slate-500"
    : "text-slate-500";
  const focusPoints = !empty ? summaryPoints.slice(0, 3) : [];
  const buyerHighlights = isMarketplacePreview
    ? keyFields.slice(0, 4)
    : keyFields.slice(0, 6);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
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
        className={`relative z-[101] flex w-full max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-[1.75rem] border border-slate-600 bg-slate-950 shadow-2xl sm:max-h-[calc(100dvh-3rem)] ${
          pdfObjectUrl ? "max-w-[min(94vw,72rem)]" : "max-w-[min(94vw,64rem)]"
        }`}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="shrink-0 border-b border-slate-800/80 px-5 py-5 sm:px-6">
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {isMarketplacePreview ? (
            <section className="rounded-[1.75rem] border border-sky-500/20 bg-[linear-gradient(135deg,_rgba(15,23,42,0.96)_0%,_rgba(8,47,73,0.92)_100%)] p-5 shadow-[0_20px_60px_rgba(2,132,199,0.12)]">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_320px] xl:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-sky-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200 ring-1 ring-sky-400/20">
                      Buyer preview
                    </span>
                    <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-200 ring-1 ring-emerald-400/20">
                      Clean format
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-300 ring-1 ring-white/10">
                      No download
                    </span>
                  </div>
                  <h3 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
                    A polished sample that shows the finished document before you unlock it.
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                    {previewPitch}
                  </p>
                  {focusPoints.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {focusPoints.map((point, index) => (
                        <span
                          key={`${index}-${point.slice(0, 24)}`}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
                        >
                          {point}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Document quality
                    </p>
                    <p className="mt-2 text-lg font-black text-white">
                      {empty ? "Unknown" : "Readable and structured"}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Preview depth
                    </p>
                    <p className="mt-2 text-lg font-black text-white">
                      {truncated ? "Teaser sample" : "Full preview"}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 sm:col-span-2 xl:col-span-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      What buyers get
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      A clean sample, clear structure, and enough context to decide whether the
                      document is worth unlocking.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <section className="rounded-3xl border border-slate-700/80 bg-slate-900/80 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Buyer view
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-white">What you are buying</h3>
                </div>
                <span className="rounded-full border border-slate-700/80 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-300">
                  {empty ? "No sample text" : "Sample preview"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MiniStat label="Format" value={pdfObjectUrl ? "PDF sample" : "Text sample"} />
                <MiniStat label="Look and feel" value={empty ? "No sample text" : "Ready to review"} />
                <MiniStat label="Included" value={truncated ? "Preview sample" : "Full sample"} />
                <MiniStat label="Audience" value={previewScopeLabel} />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-700/80 bg-slate-950/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  What this sample shows
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{footerMain}</p>
                {!pdfObjectUrl && !empty && truncated ? (
                  <p className="mt-3 text-sm font-medium text-sky-300">{truncatedNote}</p>
                ) : null}
                {empty ? (
                  <p className="mt-3 text-sm leading-6 text-slate-400">{emptyBody}</p>
                ) : null}
              </div>

              {!empty && summaryPoints.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-slate-700/80 bg-slate-950/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {isMarketplacePreview ? "What buyers notice first" : "Quick summary"}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {summaryPoints.map((point, index) => (
                      <li
                        key={`${index}-${point.slice(0, 20)}`}
                        className="rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm leading-6 text-slate-200"
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-slate-700/80 bg-slate-900/80 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Included in the sample
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-white">Preview highlights</h3>
                </div>
              </div>

              {buyerHighlights.length > 0 ? (
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  {buyerHighlights.map((field) => (
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
                    No preview highlights were detected.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    The sample is still readable below, but it does not include the common labels
                    we use to build the highlight cards.
                  </p>
                </div>
              )}

              {pdfObjectUrl ? (
                <div className="mt-5 space-y-3">
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
                    className="h-[min(48vh,28rem)] w-full rounded-3xl border border-slate-700/80 bg-white"
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
              ) : null}
            </section>
          </div>

          {!pdfObjectUrl ? (
            <section className="mt-5 rounded-3xl border border-slate-700/80 bg-slate-900/80">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Sample pages
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    The sample below is grouped into smaller cards so it is easier to scan.
                  </p>
                </div>
                {!empty && previewLines.length > previewLineLimit ? (
                  <button
                    type="button"
                    onClick={() => setShowAllExcerpt((value) => !value)}
                    className="rounded-xl border border-slate-700/80 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
                  >
                    {showAllExcerpt
                      ? "Show less"
                      : `Show more (${previewLines.length - visibleExcerptLines.length})`}
                  </button>
                ) : null}
              </div>
              {empty ? (
                <div className="px-5 py-6">
                  <p className="text-sm leading-6 text-slate-400">{emptyBody}</p>
                </div>
              ) : (
                <div className="max-h-[min(42vh,24rem)] overflow-y-auto p-4 sm:p-5">
                  <div className="grid gap-3">
                    {excerptChunks.map((chunk, index) => (
                      <article
                        key={`${index}-${chunk[0] ?? "chunk"}`}
                        className={`${excerptCardClass}`}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${excerptMetaClass}`}>
                            Sample section {index + 1}
                          </p>
                          <span className="rounded-full border border-slate-700/80 bg-slate-900/90 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                            {chunk.length} line{chunk.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {chunk.map((line, lineIndex) => (
                            <p
                              key={`${index}-${lineIndex}-${line.slice(0, 24)}`}
                              className={`text-sm leading-7 ${excerptTextClass}`}
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                  {hasMoreExcerpt ? (
                    <p className="mt-4 text-xs font-medium text-slate-500">
                      Showing the first {visibleExcerptLines.length} lines. Expand to see more of the sample.
                    </p>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          <p className="mt-4 text-xs leading-5 text-slate-500">
            {pdfObjectUrl && variant === "marketplace"
              ? "This uses the browser's built-in PDF viewer. Unlocking still adds the full file to your library for download or open."
              : footerMain}
          </p>
        </div>
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
