"use client";

import { useRef, useState } from "react";
import {
  buildMarketplacePreviewSections,
  normalizePreviewText,
  splitPreviewLines,
} from "@/lib/marketplacePreviewSections";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

type PreviewVariant = "marketplace" | "workspace" | "admin";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  excerpt: string;
  truncated: boolean;
  empty: boolean;
  pageCount?: number | null;
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
      return "On-screen preview with section teasers and blurred continuations before unlock.";
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
      return "See a readable piece from each section, with the rest blurred out until a buyer unlocks the file.";
  }
}

export function MarketplacePreviewModal({
  open,
  onClose,
  title,
  excerpt,
  truncated,
  empty,
  pageCount,
  pdfObjectUrl,
  variant = "marketplace",
}: Props) {
  const [showAllExcerpt, setShowAllExcerpt] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(dialogRef, {
    active: open,
    onEscape: onClose,
    initialFocus: closeButtonRef,
  });

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
  const excerptCardClass = isMarketplacePreview
    ? "rounded-3xl border border-slate-300/80 bg-gradient-to-br from-slate-50 to-slate-100 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.12)]"
    : "rounded-2xl border border-[var(--app-border-strong)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(241,247,255,0.95)_100%)] p-4 shadow-[0_10px_24px_rgba(38,64,106,0.08)]";
  const excerptTextClass = isMarketplacePreview ? "text-slate-900" : "text-[var(--app-text-strong)]";
  const excerptMetaClass = "text-[var(--app-muted)]";
  const focusPoints = !empty ? summaryPoints.slice(0, 3) : [];
  const buyerHighlights = isMarketplacePreview
    ? keyFields.slice(0, 5)
    : keyFields.slice(0, 6);
  const pageCountLabel =
    typeof pageCount === "number" && Number.isFinite(pageCount) && pageCount > 0
      ? `${pageCount} page${pageCount === 1 ? "" : "s"}`
      : null;
  const marketplaceSections =
    isMarketplacePreview && !empty
      ? buildMarketplacePreviewSections(previewLines, {
          teaserLineCount: 3,
          maxSections: showAllExcerpt ? 12 : 6,
          fallbackGroupSize: 5,
        })
      : [];
  const visibleMarketplaceSections = showAllExcerpt
    ? marketplaceSections
    : marketplaceSections.slice(0, 4);
  const hasMoreMarketplaceSections =
    marketplaceSections.length > visibleMarketplaceSections.length;
  const previewLineLimit = isMarketplacePreview ? 36 : 9;
  const visibleExcerptLines = showAllExcerpt ? previewLines : previewLines.slice(0, previewLineLimit);
  const excerptChunks = chunkLines(visibleExcerptLines, 3);
  const hasMoreExcerpt = previewLines.length > visibleExcerptLines.length;
  const previewSnapshotCards = isMarketplacePreview
    ? [
        {
          label: "Visible lines",
          value: empty ? "0" : String(Math.min(previewLines.length, previewLineLimit)),
        },
        { label: "Section teasers", value: String(visibleMarketplaceSections.length) },
        ...(pageCountLabel ? [{ label: "Page count", value: pageCountLabel }] : []),
        {
          label: "Locked continuation",
          value: empty ? "Hidden" : `${Math.max(0, previewLines.length - previewLineLimit)} lines`,
        },
      ]
    : [];

  return (
    <div
      className="preview-modal-light fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[rgba(223,233,247,0.78)] p-4 backdrop-blur-sm sm:items-center"
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
        ref={dialogRef}
        className={`relative z-[101] flex w-full max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-[1.75rem] border border-[var(--app-border-strong)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(241,247,255,0.96)_100%)] shadow-[0_28px_64px_rgba(38,64,106,0.18)] sm:max-h-[calc(100dvh-3rem)] ${
          pdfObjectUrl ? "max-w-[min(94vw,72rem)]" : "max-w-[min(94vw,64rem)]"
        }`}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="shrink-0 border-b border-[var(--app-border)] px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--app-accent-primary)]">
                {previewScopeLabel} preview
              </p>
              <h2
                id="document-excerpt-preview-title"
                className="mt-2 text-xl font-black tracking-tight text-[var(--app-text-strong)] sm:text-2xl"
              >
                {title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--app-text)]">
                {previewScopeDescription}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-accent-primary-soft)] hover:text-[var(--app-text-strong)]"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {isMarketplacePreview ? (
            <section className="rounded-[1.75rem] border border-[rgba(79,125,243,0.22)] bg-[linear-gradient(135deg,_rgba(248,251,255,0.98)_0%,_rgba(231,240,255,0.96)_58%,_rgba(223,235,255,0.96)_100%)] p-5 shadow-[0_20px_48px_rgba(79,125,243,0.12)]">
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
                  <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Page count
                    </p>
                    <p className="mt-2 text-lg font-black text-white">
                      {pageCountLabel ?? "Unavailable"}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 sm:col-span-2 xl:col-span-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      What buyers get
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      A clean sample, clearer structure, and enough context to decide whether the
                      document is worth unlocking{pageCountLabel ? ` after seeing the full ${pageCountLabel}.` : "."}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {previewSnapshotCards.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {previewSnapshotCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-slate-700/80 bg-slate-900/70 px-4 py-3"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    {card.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">{card.value}</p>
                </div>
              ))}
            </div>
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
                    {isMarketplacePreview ? "Section previews" : "Sample pages"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {isMarketplacePreview
                      ? "Each section opens with a readable piece, then blurs the rest like a Quizlet-style teaser."
                      : "The sample below is grouped into smaller cards so it is easier to scan."}
                  </p>
                </div>
                {isMarketplacePreview ? (
                  !empty && hasMoreMarketplaceSections ? (
                    <button
                      type="button"
                      onClick={() => setShowAllExcerpt((value) => !value)}
                      className="rounded-xl border border-slate-700/80 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
                    >
                      {showAllExcerpt
                        ? "Show less"
                        : `Show more (${marketplaceSections.length - visibleMarketplaceSections.length})`}
                    </button>
                  ) : null
                ) : !empty && previewLines.length > previewLineLimit ? (
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
              ) : isMarketplacePreview ? (
                <div className="max-h-[min(52vh,32rem)] overflow-y-auto p-4 sm:p-5">
                  <div className="grid gap-4 xl:grid-cols-2">
                    {visibleMarketplaceSections.map((section, index) => (
                      <PreviewSectionCard
                        key={`${index}-${section.title}`}
                        index={index}
                        sectionTitle={section.title}
                        teaserLines={section.teaserLines}
                        blurredLines={section.blurredLines}
                      />
                    ))}
                  </div>
                  {hasMoreMarketplaceSections ? (
                    <p className="mt-4 text-xs font-medium text-slate-500">
                      Showing the first {visibleMarketplaceSections.length} section teasers. Expand to reveal more.
                    </p>
                  ) : null}
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

function PreviewSectionCard({
  index,
  sectionTitle,
  teaserLines,
  blurredLines,
}: {
  index: number;
  sectionTitle: string;
  teaserLines: string[];
  blurredLines: string[];
}) {
  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(14,27,46,0.96)_0%,_rgba(7,14,26,0.96)_100%)] shadow-[0_14px_36px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-300/80">
            Section {String(index + 1).padStart(2, "0")}
          </p>
          <h4 className="mt-1 text-base font-bold text-white">{sectionTitle}</h4>
        </div>
        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200">
          Preview
        </span>
      </div>

      <div className="px-4 py-4">
        <div className="space-y-2">
          {teaserLines.map((line, lineIndex) => (
            <p key={`${index}-${lineIndex}-${line.slice(0, 18)}`} className="text-sm leading-6 text-slate-100">
              {line}
            </p>
          ))}
        </div>

        <div className="relative mt-4 overflow-hidden rounded-[1.4rem] border border-white/10 bg-slate-950/60 px-4 py-4">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-200/0 via-slate-200/10 to-slate-200/20" />
          <div className="relative z-[1]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-300">
                Blurred continuation
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                {blurredLines.length > 0 ? `${blurredLines.length} lines blurred` : "No extra lines in this section"}
              </span>
            </div>
            <div className="space-y-2 blur-[2.25px] select-none opacity-55">
              {blurredLines.length > 0 ? (
                blurredLines.slice(0, 4).map((line, lineIndex) => (
                  <p key={`${index}-${lineIndex}-${line.slice(0, 18)}`} className="text-sm leading-6 text-slate-200">
                    {line}
                  </p>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-300">
                  Additional content for this section is hidden until unlock.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
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
