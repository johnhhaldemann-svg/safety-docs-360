import type { ReviewDocumentAnnotation } from "@/lib/documentReviewExtraction";

function includesAny(text: string, tokens: string[]) {
  return tokens.some((token) => text.includes(token));
}

function compact(value: string | null | undefined) {
  return value?.trim() ? value.trim() : null;
}

export function detectDocumentQualityIssues(documentText: string) {
  const text = documentText.toLowerCase();
  const issues: string[] = [];

  if (/\btest\b/.test(text)) {
    issues.push(
      "Placeholder values such as TEST appear in the draft and should be replaced with project-specific data before approval."
    );
  }

  if (
    includesAny(text, [
      "prepared by safety_plan_deterministic_assembler",
      "prepared by deterministic",
      "deterministic assembler",
      "safety_plan_deterministic_assembler",
    ])
  ) {
    issues.push(
      "Internal generator wording is leaking into the document output and should be replaced with human-facing prepared-by language."
    );
  }

  if (includesAny(text, ["related task triggers", "task triggers"])) {
    issues.push(
      "Task-trigger wording appears in a user-facing section and should be renamed so the document lists the tasks directly."
    );
  }

  if (includesAny(text, ["risk score"])) {
    issues.push(
      "A raw risk score is displayed in the draft front matter and should be suppressed or moved out of the customer-facing presentation."
    );
  }

  return issues.slice(0, 6);
}

export function buildNoteCoverage(annotations: ReviewDocumentAnnotation[]) {
  return annotations.slice(0, 8).map((annotation) => {
    const note = annotation.note.trim();
    const noteLower = note.toLowerCase();
    const anchor = compact(annotation.anchorText);
    const target = anchor ? `"${anchor}"` : "the flagged document area";

    if (noteLower.includes("bigger")) {
      return `Address "${note}" by increasing the visual prominence of ${target}.`;
    }

    if (noteLower.includes("bottom")) {
      return `Address "${note}" by moving ${target} lower in the layout so it sits at the page bottom.`;
    }

    if (noteLower.includes("logo")) {
      return `Address "${note}" by replacing ${target} with company-specific logo handling and removing placeholder text when no logo is available.`;
    }

    if (noteLower.includes("list the task") || noteLower.includes("trigger") || (anchor ?? "").toLowerCase().includes("trigger")) {
      return `Address "${note}" by renaming ${target} to task-facing language and listing the tasks directly.`;
    }

    return `Address "${note}" by revising ${target} and confirming the reviewer concern is resolved in the generated document.`;
  });
}
