import type { ReviewDocumentAnnotation } from "@/lib/documentReviewExtraction";

function compact(value: string | null | undefined) {
  return value?.trim() ? value.trim() : null;
}

function annotationLabel(annotation: ReviewDocumentAnnotation) {
  const parts = [`Note ${annotation.id}`];
  if (annotation.author) parts.push(annotation.author);
  if (annotation.date) parts.push(annotation.date);
  return parts.join(" | ");
}

export function formatEmbeddedReviewNotes(
  annotations: ReviewDocumentAnnotation[],
  maxAnnotations = 8
) {
  return annotations.slice(0, maxAnnotations).map((annotation) => {
    const anchor = compact(annotation.anchorText);
    return [
      `[${annotationLabel(annotation)}] ${annotation.note}`,
      anchor ? `Anchor text: ${anchor}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });
}

export function buildCanonicalDocumentAiContext(params: {
  recordNotes?: string | null;
  annotations?: ReviewDocumentAnnotation[] | null;
  reviewerContext?: string | null;
}) {
  const sections: string[] = [];
  const recordNotes = compact(params.recordNotes);
  const reviewerContext = compact(params.reviewerContext);
  const annotations = params.annotations?.filter((annotation) => annotation.note.trim()) ?? [];

  if (recordNotes) {
    sections.push(`Stored document notes:\n${recordNotes}`);
  }

  if (annotations.length) {
    sections.push(
      `Embedded reviewer notes from DOCX comments:\n${formatEmbeddedReviewNotes(annotations).join("\n\n")}`
    );
  }

  if (reviewerContext) {
    sections.push(`Reviewer-entered context:\n${reviewerContext}`);
  }

  return sections.join("\n\n").trim();
}
