import type {
  BuilderProgramAiReviewFinding,
  BuilderProgramAiReviewSectionNote,
} from "@/lib/builderDocumentAiReview";

function compactWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripSectionLabelPrefix(value: string | null | undefined, sectionLabel: string) {
  const normalized = compactWhitespace(value);
  if (!normalized) return "";
  return normalized.replace(new RegExp(`^${escapeRegExp(sectionLabel)}\\s*:\\s*`, "i"), "").trim();
}

function withSectionLabel(sectionLabel: string, value: string | null | undefined, fallback: string) {
  const normalized = compactWhitespace(value) || fallback;
  if (new RegExp(`^${escapeRegExp(sectionLabel)}\\s*:`, "i").test(normalized)) {
    return normalized;
  }
  return `${sectionLabel}: ${normalized}`;
}

function normalizeReferenceValue(referenceSupport?: string) {
  const normalized = compactWhitespace(referenceSupport);
  if (!normalized) return "N/A";

  return normalized
    .replace(/^reference document(?: excerpt)?\s*:\s*/i, "")
    .replace(/^reference document\s*\([^)]+\)\s*:\s*/i, "")
    .trim();
}

function fallbackReferenceText(referenceSupport?: string) {
  return normalizeReferenceValue(referenceSupport);
}

function sectionStatusWhy(note: BuilderProgramAiReviewSectionNote) {
  if (compactWhitespace(note.whyItMatters)) {
    return compactWhitespace(note.whyItMatters);
  }

  if (note.status === "missing") {
    return `${note.sectionLabel} is still missing from the CSEP, so the issued plan may leave crews without clear direction in the field.`;
  }
  if (note.status === "partial") {
    return `${note.sectionLabel} is only partially covered, so the issued CSEP still needs stronger field-ready direction here.`;
  }
  return `${note.sectionLabel} is present, but it still needs to be tightened so it reads like final project-specific issue content.`;
}

export function getCsepFindingNoteFields(finding: BuilderProgramAiReviewFinding) {
  return [
    {
      label: "What",
      value: withSectionLabel(
        finding.sectionLabel,
        finding.issue,
        "No issue text returned."
      ),
    },
    {
      label: "Current CSEP text",
      value:
        compactWhitespace(finding.documentExample) || "No clear CSEP text was captured for this note.",
    },
    {
      label: "Why",
      value:
        compactWhitespace(finding.whyItMatters) ||
        "This section still needs to be tightened before the CSEP is issued.",
    },
    {
      label: "How",
      value:
        compactWhitespace(finding.reviewerNote) ||
        "Revise this section so it clearly matches the required CSEP content.",
    },
    {
      label: "Target wording",
      value:
        stripSectionLabelPrefix(finding.preferredExample, finding.sectionLabel) ||
        "Add project-specific wording that clearly states the required CSEP direction.",
    },
    {
      label: "Referance",
      value: fallbackReferenceText(finding.referenceSupport),
    },
  ];
}

export function formatCsepFindingNote(finding: BuilderProgramAiReviewFinding) {
  const fields = getCsepFindingNoteFields(finding);
  const what = fields.find((field) => field.label === "What")?.value ?? "No issue text returned.";
  const current =
    fields.find((field) => field.label === "Current CSEP text")?.value ??
    "No clear CSEP text was captured for this note.";
  const why =
    fields.find((field) => field.label === "Why")?.value ??
    "This section still needs to be tightened before the CSEP is issued.";
  const how =
    fields.find((field) => field.label === "How")?.value ??
    "Revise this section so it clearly matches the required CSEP content.";
  const target =
    fields.find((field) => field.label === "Target wording")?.value ??
    "Add project-specific wording that clearly states the required CSEP direction.";
  const reference = fields.find((field) => field.label === "Referance")?.value ?? "N/A";

  return [
    `What: ${what}`,
    "",
    `Current CSEP text: ${current}`,
    "",
    `Why: ${why}`,
    "",
    `How: ${how}`,
    "",
    `Target wording: ${target}  Referance: ${reference}`,
  ].join("\n");
}

export function getCsepSectionNoteFields(note: BuilderProgramAiReviewSectionNote) {
  return [
    {
      label: "What",
      value: withSectionLabel(
        note.sectionLabel,
        note.status === "missing"
          ? `${note.sectionLabel} is missing or not clearly developed in the document.`
          : note.whatNeedsWork,
        `${note.sectionLabel} still needs revision in the CSEP.`
      ),
    },
    {
      label: "Current CSEP text",
      value:
        compactWhitespace(note.whatWasFound) || "No clear CSEP text was captured for this section.",
    },
    {
      label: "Why",
      value: sectionStatusWhy(note),
    },
    {
      label: "How",
      value:
        compactWhitespace(note.whatNeedsWork) ||
        "Revise this section so it clearly matches the required CSEP content.",
    },
    {
      label: "Target wording",
      value:
        stripSectionLabelPrefix(note.suggestedBuilderTarget, note.sectionLabel) ||
        "Add project-specific wording that clearly states the required CSEP direction.",
    },
    {
      label: "Referance",
      value: fallbackReferenceText(note.referenceSupport),
    },
  ];
}

export function formatCsepSectionNote(note: BuilderProgramAiReviewSectionNote) {
  const fields = getCsepSectionNoteFields(note);
  const what =
    fields.find((field) => field.label === "What")?.value ??
    `${note.sectionLabel} still needs revision in the CSEP.`;
  const current =
    fields.find((field) => field.label === "Current CSEP text")?.value ??
    "No clear CSEP text was captured for this section.";
  const why =
    fields.find((field) => field.label === "Why")?.value ?? sectionStatusWhy(note);
  const how =
    fields.find((field) => field.label === "How")?.value ??
    "Revise this section so it clearly matches the required CSEP content.";
  const target =
    fields.find((field) => field.label === "Target wording")?.value ??
    "Add project-specific wording that clearly states the required CSEP direction.";
  const reference = fields.find((field) => field.label === "Referance")?.value ?? "N/A";

  return [
    `What: ${what}`,
    "",
    `Current CSEP text: ${current}`,
    "",
    `Why: ${why}`,
    "",
    `How: ${how}`,
    "",
    `Target wording: ${target}  Referance: ${reference}`,
  ].join("\n");
}
