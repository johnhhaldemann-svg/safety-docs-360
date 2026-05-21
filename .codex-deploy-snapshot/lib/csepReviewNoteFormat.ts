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
  if (!normalized || !sectionLabel) return normalized;
  return normalized.replace(new RegExp(`^${escapeRegExp(sectionLabel)}\\s*:\\s*`, "i"), "").trim();
}

function normalizeReferenceValue(referenceSupport?: string) {
  const normalized = compactWhitespace(referenceSupport);
  if (!normalized) return "";

  return normalized
    .replace(/^reference document(?: excerpt)?\s*:\s*/i, "")
    .replace(/^reference document\s*\([^)]+\)\s*:\s*/i, "")
    .trim();
}

/**
 * Concrete-language fallbacks used when a finding/section note is missing one
 * of the build-instruction fields. Mirrors the helpers in
 * lib/builderDocumentAiReview.ts so the rendered output never falls back to
 * vague editorial wording.
 */
function defaultProblemForSection(sectionLabel: string, statusOrSentiment?: string) {
  const label = sectionLabel.trim() || "this section";
  if (statusOrSentiment === "missing") {
    return `${label} is not present in the current CSEP output.`;
  }
  if (statusOrSentiment === "partial") {
    return `${label} is referenced but not built out in the current CSEP output.`;
  }
  return `${label} is in the document but does not yet match the required CSEP build target.`;
}

function defaultRequiredOutputForSection(sectionLabel: string) {
  const label = sectionLabel.trim() || "this section";
  return `Build ${label} as its own labeled section using the builder template structure with all required subsections populated from the project record.`;
}

function defaultAcceptanceCheck(sectionLabel: string, statusOrSentiment?: string) {
  const label = sectionLabel.trim() || "this section";
  if (statusOrSentiment === "missing") {
    return `${label} appears as its own labeled section in the body with the required structure populated and no placeholder wording.`;
  }
  return `${label} reads as a final, project-specific build instruction with the required structure populated and no vague filler.`;
}

function defaultDoNot(sectionLabel: string) {
  const label = sectionLabel.trim() || "this section";
  return `Do not leave ${label} as a vague editorial note, do not duplicate it in another section, and do not introduce 'tighten' / 'improve' / 'sounds generic' filler wording.`;
}

type ReviewNoteFields = {
  section: string;
  problem: string;
  requiredOutput: string;
  acceptanceCheck: string;
  doNot: string;
  reference: string;
};

function pickSectionNoteFields(note: BuilderProgramAiReviewSectionNote): ReviewNoteFields {
  const sectionLabel = note.sectionLabel?.trim() || "Unspecified section";
  const problem =
    compactWhitespace(note.problem) ||
    compactWhitespace(stripSectionLabelPrefix(note.whatWasFound, sectionLabel)) ||
    defaultProblemForSection(sectionLabel, note.status);
  const requiredOutput =
    compactWhitespace(stripSectionLabelPrefix(note.requiredOutput, sectionLabel)) ||
    compactWhitespace(stripSectionLabelPrefix(note.suggestedBuilderTarget, sectionLabel)) ||
    compactWhitespace(stripSectionLabelPrefix(note.whatNeedsWork, sectionLabel)) ||
    defaultRequiredOutputForSection(sectionLabel);
  const acceptanceCheck =
    compactWhitespace(note.acceptanceCheck) || defaultAcceptanceCheck(sectionLabel, note.status);
  const doNot = compactWhitespace(note.doNot) || defaultDoNot(sectionLabel);
  return {
    section: sectionLabel,
    problem,
    requiredOutput,
    acceptanceCheck,
    doNot,
    reference: normalizeReferenceValue(note.referenceSupport),
  };
}

function pickFindingFields(finding: BuilderProgramAiReviewFinding): ReviewNoteFields {
  const sectionLabel = finding.sectionLabel?.trim() || "Unspecified section";
  const problem =
    compactWhitespace(finding.problem) ||
    compactWhitespace(stripSectionLabelPrefix(finding.issue, sectionLabel)) ||
    defaultProblemForSection(sectionLabel, finding.sentiment);
  const requiredOutput =
    compactWhitespace(stripSectionLabelPrefix(finding.requiredOutput, sectionLabel)) ||
    compactWhitespace(stripSectionLabelPrefix(finding.preferredExample, sectionLabel)) ||
    compactWhitespace(stripSectionLabelPrefix(finding.reviewerNote, sectionLabel)) ||
    defaultRequiredOutputForSection(sectionLabel);
  const acceptanceCheck =
    compactWhitespace(finding.acceptanceCheck) ||
    defaultAcceptanceCheck(sectionLabel, finding.sentiment === "positive" ? "present" : finding.sentiment);
  const doNot = compactWhitespace(finding.doNot) || defaultDoNot(sectionLabel);
  return {
    section: sectionLabel,
    problem,
    requiredOutput,
    acceptanceCheck,
    doNot,
    reference: normalizeReferenceValue(finding.referenceSupport),
  };
}

function fieldsToList(fields: ReviewNoteFields) {
  const list = [
    { label: "Section", value: fields.section },
    { label: "Problem", value: fields.problem },
    { label: "Required Output", value: fields.requiredOutput },
    { label: "Acceptance Check", value: fields.acceptanceCheck },
    { label: "Do Not", value: fields.doNot },
  ];
  if (fields.reference) {
    list.push({ label: "Reference", value: fields.reference });
  }
  return list;
}

function fieldsToString(fields: ReviewNoteFields) {
  const parts = [
    `Section: ${fields.section}`,
    `Problem: ${fields.problem}`,
    `Required Output: ${fields.requiredOutput}`,
    `Acceptance Check: ${fields.acceptanceCheck}`,
    `Do Not: ${fields.doNot}`,
  ];
  if (fields.reference) {
    parts.push(`Reference: ${fields.reference}`);
  }
  return parts.join("\n");
}

export function getCsepFindingNoteFields(finding: BuilderProgramAiReviewFinding) {
  return fieldsToList(pickFindingFields(finding));
}

export function formatCsepFindingNote(finding: BuilderProgramAiReviewFinding) {
  return fieldsToString(pickFindingFields(finding));
}

export function getCsepSectionNoteFields(note: BuilderProgramAiReviewSectionNote) {
  return fieldsToList(pickSectionNoteFields(note));
}

export function formatCsepSectionNote(note: BuilderProgramAiReviewSectionNote) {
  return fieldsToString(pickSectionNoteFields(note));
}
