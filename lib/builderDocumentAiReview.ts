import { extractResponsesApiOutputText } from "@/lib/ai/responses";
import { getReviewLayoutGuidance } from "@/lib/documentLayoutGuidance";
import { buildNoteCoverage, detectDocumentQualityIssues } from "@/lib/documentAiReviewSignals";
import type { ReviewDocumentAnnotation } from "@/lib/documentReviewExtraction";
import { extractReviewDocumentText } from "@/lib/documentReviewExtraction";
import { getOpenAiApiBaseUrl, resolveOpenAiCompatibleModelId } from "@/lib/openaiClient";

export type BuilderProgramAiReviewFinding = {
  sectionLabel: string;
  issue: string;
  documentExample: string;
  preferredExample: string;
  reviewerNote: string;
  referenceSupport?: string;
  whyItMatters?: string;
};

export type BuilderProgramAiReviewSectionNote = {
  sectionLabel: string;
  status: "present" | "partial" | "missing";
  whatWasFound: string;
  whatNeedsWork: string;
  suggestedBuilderTarget: string;
  whyItMatters?: string;
  referenceSupport?: string;
};

export type BuilderProgramAiReview = {
  reviewMode: "builder_review" | "csep_completeness";
  executiveSummary: string;
  /** How well the draft covers stated project scope, trade work, hazards, and controls */
  scopeTradeAndHazardCoverage: string;
  /** Strengths vs typical OSHA construction expectations and program clarity */
  regulatoryAndProgramStrengths: string[];
  /** Gaps, ambiguities, or risks to resolve before final approval */
  gapsRisksOrClarifications: string[];
  /** Concrete edits or follow-ups for the reviewer */
  recommendedEditsBeforeApproval: string[];
  /** First-class missing-items checklist for builder and completeness review flows */
  missingItemsChecklist: string[];
  /** Alignment notes based on current CSEP builder expectations */
  builderAlignmentNotes: string[];
  /** Section-by-section audit against builder expectations */
  sectionReviewNotes: BuilderProgramAiReviewSectionNote[];
  /** Review findings tied to real document examples and improved target examples */
  detailedFindings: BuilderProgramAiReviewFinding[];
  /** Optional checklist delta for required planning controls that appear missing or partial */
  checklistDelta?: string[];
  documentQualityIssues?: string[];
  noteCoverage?: string[];
  overallAssessment: "sufficient" | "needs_work" | "insufficient_context";
};

const DISCLAIMER =
  "This AI review is for internal triage only. It is not legal advice, does not replace a competent safety professional or the AHJ, and may omit or misread content. Verify against current OSHA / state rules, environmental obligations where applicable, and the contract documents.";
const DEFAULT_BUILDER_REVIEW_MODEL = "gpt-4o-mini";
const COMMON_REFERENCE_SECTION_LABELS = [
  "Scope of Work",
  "Roles and Responsibilities",
  "Emergency Procedures",
  "Fall Rescue",
  "Training Requirements",
  "Permit Requirements",
  "Inspection and Verification",
  "PPE Requirements",
  "Environmental Controls",
];

function includesAny(text: string, tokens: string[]) {
  return tokens.some((token) => text.includes(token));
}

function compactWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function uniqueTrimmedStrings(values: Array<string | null | undefined>, maxItems?: number) {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const value of values) {
    const normalized = compactWhitespace(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(normalized);
    if (typeof maxItems === "number" && items.length >= maxItems) {
      break;
    }
  }

  return items;
}

function toHumanReviewVoice(value: string | null | undefined) {
  const normalized = compactWhitespace(value);
  if (!normalized) return "";

  return normalized
    .replace(/^Could not verify\b/i, "I'm not seeing")
    .replace(/^No clearly labeled or field-usable\b/i, "I'm not seeing a clear")
    .replace(/^The document does not clearly\b/i, "Right now the document doesn't clearly")
    .replace(/^The document does not show\b/i, "Right now the document doesn't show")
    .replace(/^Emergency response content is missing or too weak\b/i, "The emergency section still feels too thin")
    .replace(/^Training, orientation, or competent-person coverage is not clearly documented\b/i, "The training and qualifications piece still isn't clear enough")
    .replace(/^Permit-triggering work is not mapped consistently\b/i, "The permit triggers still are not mapped cleanly")
    .replace(/^Supervision roles and accountability expectations need to be clearer\b/i, "The supervision and accountability language still needs to be clearer")
    .replace(/\bfield-usable\b/gi, "practical")
    .replace(/\bcoverage looks incomplete\b/gi, "the section still feels incomplete")
    .replace(/\bAdd this section\b/gi, "Add this section")
    .replace(/\bAdd a dedicated\b/gi, "Add a clear")
    .replace(/\bUse explicit role ownership\b/gi, "Spell out who owns what")
    .replace(/\bReplace generic opening language\b/gi, "Swap the generic opening language")
    .replace(/\bMatch each row to a real selected task\b/gi, "Tie each row back to an actual task")
    .replace(/\bThe field copy should tell workers exactly who to call, where responders enter, and where crews report after an event\./gi,
      "Crews should be able to read this and immediately know who to call, where responders come in, and where everyone reports after an incident.")
    .replace(/\bUse named role expectations and record references instead of only saying workers will be trained\./gi,
      "Name the roles, the required training, and where that training is documented instead of just saying the crew will be trained.")
    .replace(/\bRender permit logic the same way the builder develops other required control sections\./gi,
      "Lay out the permit triggers the same way the rest of the control sections are laid out so it is easy to follow in the field.")
    .replace(/\bExpand this section into a complete builder-style package with clear responsibilities, triggers, and site-specific instructions\./gi,
      "This needs to be built out into a fuller section with real responsibilities, triggers, and site-specific direction.")
    .replace(/\bAdd this section in a clear standalone format so the issued CSEP fully covers this builder expectation\./gi,
      "This should stand on its own as a clear section so the issued CSEP actually covers this part of the plan.")
    .replace(/\bTighten this section so it follows the builder structure and uses project-specific field wording instead of generic policy language\./gi,
      "This section is there, but it should be tightened up so it follows the builder structure and sounds project-specific.")
    .trim();
}

function quoteDocumentExample(text: string, tokens: string[], fallbackLabel: string) {
  const normalized = compactWhitespace(text);
  if (!normalized) {
    return `No readable ${fallbackLabel.toLowerCase()} text was found in the uploaded document.`;
  }

  const lower = normalized.toLowerCase();
  const matchIndex = tokens
    .map((token) => lower.indexOf(token))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (matchIndex === undefined) {
    return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
  }

  const start = Math.max(0, matchIndex - 70);
  const end = Math.min(normalized.length, matchIndex + 140);
  const excerpt = normalized.slice(start, end);
  return `${start > 0 ? "..." : ""}${excerpt}${end < normalized.length ? "..." : ""}`;
}

function buildPreferredExample(
  label: string,
  fallback: string,
  builderExpectationSummary: string[]
) {
  const labelLower = label.toLowerCase();
  const matchingBuilderNote =
    builderExpectationSummary.find((item) => item.toLowerCase().includes(labelLower)) ??
    builderExpectationSummary[0] ??
    fallback;

  return compactWhitespace(matchingBuilderNote).slice(0, 280);
}

function createFinding(params: {
  sectionLabel: string;
  issue: string;
  documentText: string;
  tokens: string[];
  builderExpectationSummary: string[];
  preferredFallback: string;
  reviewerNote: string;
  referenceSupport?: string;
  whyItMatters?: string;
}): BuilderProgramAiReviewFinding {
  return {
    sectionLabel: params.sectionLabel,
    issue: toHumanReviewVoice(params.issue),
    documentExample: quoteDocumentExample(params.documentText, params.tokens, params.sectionLabel),
    preferredExample: buildPreferredExample(
      params.sectionLabel,
      params.preferredFallback,
      params.builderExpectationSummary
    ),
    reviewerNote: toHumanReviewVoice(params.reviewerNote),
    referenceSupport: toHumanReviewVoice(params.referenceSupport),
    whyItMatters: toHumanReviewVoice(params.whyItMatters),
  };
}

function buildReferenceSupport(siteReferenceFileName?: string | null, fallback?: string) {
  if (fallback?.trim()) return fallback.trim();
  if (siteReferenceFileName?.trim()) {
    return `This should also line up with the uploaded reference document${siteReferenceFileName.includes(",") ? "s" : ""}: ${siteReferenceFileName}.`;
  }
  return "This should also line up with the uploaded site or GC reference requirements when they are provided.";
}

function buildWhyItMatters(sectionLabel: string, fallback?: string) {
  if (fallback?.trim()) return fallback.trim();
  const label = sectionLabel.toLowerCase();
  if (label.includes("emergency") || label.includes("rescue")) {
    return "It matters because the crew needs clear emergency direction they can actually follow in the field.";
  }
  if (label.includes("permit")) {
    return "It matters because permit triggers need to be clear before the work starts so nothing gets missed.";
  }
  if (label.includes("training")) {
    return "It matters because the document should show who is qualified to do the work and what training backs that up.";
  }
  if (label.includes("inspection")) {
    return "It matters because the team needs a clear record of what was checked and corrected before work begins.";
  }
  return "It matters because the issued CSEP should match the site requirements and give the crew clear working direction.";
}

function buildCsepMissingItemsChecklist(text: string) {
  const checklist: string[] = [];

  if (!includesAny(text, ["scope of work", "project scope", "trade summary", "task"])) {
    checklist.push("Could not verify a clear scope of work, trade summary, or task list.");
  }
  if (!includesAny(text, ["hazard", "risk", "activity hazard matrix", "control"])) {
    checklist.push("Could not verify a task-by-task hazard and control section.");
  }
  if (!includesAny(text, ["ppe", "hard hat", "safety glasses", "gloves", "harness"])) {
    checklist.push("Could not verify required PPE tied to the active work scope.");
  }
  if (!includesAny(text, ["permit", "hot work", "lift plan", "elevated work", "loto", "confined space"])) {
    checklist.push("Could not verify permit or notice requirements for triggered work.");
  }
  if (!includesAny(text, ["emergency", "evacuation", "medical", "911", "incident"])) {
    checklist.push("Could not verify emergency response and incident reporting procedures.");
  }
  if (!includesAny(text, ["responsibilit", "competent person", "superintendent", "foreman", "supervisor"])) {
    checklist.push("Could not verify named responsibilities, competent-person oversight, or supervision roles.");
  }
  if (!includesAny(text, ["training", "orientation", "osha 10", "certification"])) {
    checklist.push("Could not verify training, orientation, or certification requirements.");
  }
  if (!includesAny(text, ["inspection", "checklist", "audit", "pre-use"])) {
    checklist.push("Could not verify inspection, checklist, or recurring verification requirements.");
  }
  if (!includesAny(text, ["environment", "spill", "storm water", "waste"])) {
    checklist.push("Could not verify environmental or spill-control expectations.");
  }
  if (!includesAny(text, ["signature", "approved by", "prepared by", "revision"])) {
    checklist.push("Could not verify document control, revision history, or approval/signature fields.");
  }

  return checklist.slice(0, 8);
}

function buildChecklistDeltaSignals(text: string) {
  const delta: string[] = [];
  if (!includesAny(text, ["corrective action", "disciplinary"])) {
    delta.push("Baseline: corrective action and disciplinary process language is missing or unclear.");
  }
  if (!includesAny(text, ["responsibilit", "competent person", "supervisor"])) {
    delta.push("Baseline: defined safety responsibilities should be made explicit.");
  }
  if (!includesAny(text, ["incident", "investigation", "event management"])) {
    delta.push("Baseline: incident investigation/event-management workflow appears incomplete.");
  }
  if (!includesAny(text, ["hazard communication", "ghs", "sds"])) {
    delta.push("Baseline: HazCom/GHS controls are not clearly documented.");
  }
  if (!includesAny(text, ["spill", "storm water", "swppp", "waste"])) {
    delta.push("Environmental: spill, stormwater, or waste controls may be missing.");
  }
  if (!includesAny(text, ["training", "osha 10", "orientation"])) {
    delta.push("Training: workforce/supervisor training evidence is weak or absent.");
  }
  return delta.slice(0, 6);
}

function buildBuilderAlignmentNotes(builderExpectationSummary: string[]) {
  return builderExpectationSummary.slice(0, 8);
}

function extractExpectationLabel(expectation: string) {
  return compactWhitespace(expectation.split(":")[0] ?? expectation) || "Builder Section";
}

function buildSectionKeywordHints(label: string) {
  return label
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4 && !["section", "requirements", "specific"].includes(part))
    .slice(0, 4);
}

function buildSectionReviewNotes(params: {
  documentText: string;
  builderExpectationSummary: string[];
  maxItems?: number;
  siteReferenceText?: string | null;
  siteReferenceFileName?: string | null;
}): BuilderProgramAiReviewSectionNote[] {
  const normalized = compactWhitespace(params.documentText);
  const lower = normalized.toLowerCase();

  return params.builderExpectationSummary
    .slice(0, params.maxItems ?? 18)
    .map((expectation) => {
      const sectionLabel = extractExpectationLabel(expectation);
      const tokens = buildSectionKeywordHints(sectionLabel);
      const matchCount = tokens.filter((token) => lower.includes(token)).length;
      const status: BuilderProgramAiReviewSectionNote["status"] =
        matchCount >= Math.max(1, Math.min(2, tokens.length)) ? "present" : matchCount > 0 ? "partial" : "missing";

      return {
        sectionLabel,
        status,
        whatWasFound: toHumanReviewVoice(
          status === "present"
            ? quoteDocumentExample(normalized, tokens, sectionLabel)
            : status === "partial"
              ? `Some related text was found, but coverage looks incomplete: ${quoteDocumentExample(normalized, tokens, sectionLabel)}`
              : `No clearly labeled or field-usable ${sectionLabel.toLowerCase()} content was confirmed in the uploaded document.`
        ),
        whatNeedsWork: toHumanReviewVoice(
          status === "present"
            ? `Tighten this section so it follows the builder structure and uses project-specific field wording instead of generic policy language.`
            : status === "partial"
              ? `Expand this section into a complete builder-style package with clear responsibilities, triggers, and site-specific instructions.`
              : `Add this section in a clear standalone format so the issued CSEP fully covers this builder expectation.`
        ),
        suggestedBuilderTarget: toHumanReviewVoice(expectation),
        whyItMatters: buildWhyItMatters(sectionLabel),
        referenceSupport: buildReferenceSupport(
          params.siteReferenceFileName,
          params.siteReferenceText?.trim()
            ? `If the uploaded reference document covers ${sectionLabel.toLowerCase()}, carry that direction into the issued CSEP instead of leaving it only in the reference package.`
            : undefined
        ),
      };
    });
}

type ReferenceSectionGapSignal = {
  sectionLabel: string;
  checklistItem: string;
  finding: BuilderProgramAiReviewFinding;
  sectionNote: BuilderProgramAiReviewSectionNote;
};

function normalizeReviewKey(value: string) {
  return compactWhitespace(value).toLowerCase();
}

function buildReferenceSectionGapSignals(params: {
  documentText: string;
  siteReferenceText?: string | null;
  siteReferenceFileName?: string | null;
  builderExpectationSummary: string[];
  maxItems?: number;
}): ReferenceSectionGapSignal[] {
  const referenceText = compactWhitespace(params.siteReferenceText);
  if (referenceText.length < 40) {
    return [];
  }

  const draftLower = compactWhitespace(params.documentText).toLowerCase();
  const referenceLower = referenceText.toLowerCase();
  const candidateLabels = uniqueTrimmedStrings(
    [
      ...params.builderExpectationSummary.map((item) => extractExpectationLabel(item)),
      ...COMMON_REFERENCE_SECTION_LABELS,
    ],
    24
  );

  const signals: ReferenceSectionGapSignal[] = [];

  for (const sectionLabel of candidateLabels) {
    if (signals.length >= (params.maxItems ?? 4)) {
      break;
    }

    const tokens = buildSectionKeywordHints(sectionLabel);
    if (!tokens.length) continue;

    const referenceMatches = tokens.filter((token) => referenceLower.includes(token)).length;
    const draftMatches = tokens.filter((token) => draftLower.includes(token)).length;

    if (referenceMatches < Math.min(1, tokens.length) || draftMatches > 0) {
      continue;
    }

    const referenceExcerpt = quoteDocumentExample(referenceText, tokens, sectionLabel);
    const preferredTarget = buildPreferredExample(
      sectionLabel,
      `${sectionLabel}: Carry the site- or GC-required direction into the issued CSEP in a clear field-ready section.`,
      params.builderExpectationSummary
    );
    const referenceSupport = compactWhitespace(
      [
        params.siteReferenceFileName?.trim()
          ? `Reference document (${params.siteReferenceFileName.trim()}):`
          : "Reference document excerpt:",
        referenceExcerpt,
      ].join(" ")
    );
    const whyItMatters = buildWhyItMatters(
      sectionLabel,
      "It matters because the issued CSEP should include the site or GC direction the field team is expected to follow, not leave that requirement buried only in the reference document."
    );
    const finding = createFinding({
      sectionLabel,
      issue: `The uploaded reference document includes ${sectionLabel.toLowerCase()} direction that I am not seeing carried into this CSEP yet.`,
      documentText: params.documentText,
      tokens,
      builderExpectationSummary: params.builderExpectationSummary,
      preferredFallback: preferredTarget,
      reviewerNote:
        "Pull this requirement out of the reference document and build it into the CSEP as clear project-specific field direction.",
      referenceSupport,
      whyItMatters,
    });
    const sectionNote: BuilderProgramAiReviewSectionNote = {
      sectionLabel,
      status: "missing",
      whatWasFound:
        `I'm not seeing ${sectionLabel.toLowerCase()} coverage in the CSEP, but the uploaded reference document does call it out.`,
      whatNeedsWork:
        "Add this as a real CSEP section or subsection so the final issued plan carries the reference requirement directly.",
      suggestedBuilderTarget: preferredTarget,
      whyItMatters,
      referenceSupport,
    };

    signals.push({
      sectionLabel,
      checklistItem: `Could not verify ${sectionLabel.toLowerCase()} coverage that appears in the uploaded reference document.`,
      finding,
      sectionNote,
    });
  }

  return signals;
}

function mergeReferenceGapSignals(review: BuilderProgramAiReview, signals: ReferenceSectionGapSignal[]) {
  if (!signals.length) {
    return review;
  }

  review.missingItemsChecklist = uniqueTrimmedStrings(
    [...review.missingItemsChecklist, ...signals.map((signal) => signal.checklistItem)],
    12
  );

  const sectionNotesByKey = new Map(
    review.sectionReviewNotes.map((note) => [normalizeReviewKey(note.sectionLabel), note] as const)
  );
  for (const signal of signals) {
    const key = normalizeReviewKey(signal.sectionLabel);
    const existing = sectionNotesByKey.get(key);
    if (!existing) {
      review.sectionReviewNotes.push(signal.sectionNote);
      sectionNotesByKey.set(key, signal.sectionNote);
      continue;
    }

    if (!existing.referenceSupport) {
      existing.referenceSupport = signal.sectionNote.referenceSupport;
    }
    if (!existing.whyItMatters) {
      existing.whyItMatters = signal.sectionNote.whyItMatters;
    }
    if (existing.status === "present") {
      existing.status = "partial";
    }
  }

  const findingKeys = new Set(
    review.detailedFindings.map((item) =>
      `${normalizeReviewKey(item.sectionLabel)}::${normalizeReviewKey(item.issue)}`
    )
  );
  for (const signal of signals) {
    const key = `${normalizeReviewKey(signal.finding.sectionLabel)}::${normalizeReviewKey(signal.finding.issue)}`;
    if (findingKeys.has(key)) continue;
    findingKeys.add(key);
    review.detailedFindings.push(signal.finding);
  }

  return review;
}

function buildFallbackDetailedFindings(params: {
  documentText: string;
  builderExpectationSummary: string[];
  siteReferenceFileName?: string | null;
}) {
  const findings: BuilderProgramAiReviewFinding[] = [];
  const normalized = params.documentText.trim();
  const lower = normalized.toLowerCase();

  if (!includesAny(lower, ["scope of work", "project scope", "trade summary", "task"])) {
    findings.push(
      createFinding({
        sectionLabel: "Scope of Work",
        issue:
          "The document does not clearly define the contractor's active scope, trade summary, or task list.",
        documentText: normalized,
        tokens: ["scope", "trade", "task"],
        builderExpectationSummary: params.builderExpectationSummary,
        preferredFallback:
          "Scope of Work: Describe the exact self-performed work, active tasks, major tools/equipment, and excluded interface trades so crews know what this CSEP governs.",
        reviewerNote:
          "Replace generic opening language with the actual builder-style scope package for this contractor.",
        referenceSupport: buildReferenceSupport(
          params.siteReferenceFileName,
          "If the uploaded reference documents define the contractor scope or coordination boundaries, this section should match that language."
        ),
        whyItMatters:
          "It matters because the scope section tells the crew exactly what work this plan covers and keeps interface trades from getting mixed in.",
      })
    );
  }

  if (!includesAny(lower, ["hazard", "risk", "control", "activity hazard matrix"])) {
    findings.push(
      createFinding({
        sectionLabel: "Activity Hazard Analysis Matrix",
        issue:
          "The document does not show a task-by-task hazard and control matrix aligned to the active work.",
        documentText: normalized,
        tokens: ["hazard", "risk", "control", "matrix"],
        builderExpectationSummary: params.builderExpectationSummary,
        preferredFallback:
          "Activity Hazard Analysis Matrix: For each active task, list key hazards, required controls, PPE, permits, and supervision responsibilities.",
        reviewerNote:
          "Match each row to a real selected task instead of repeating general project-wide safety wording.",
        referenceSupport: buildReferenceSupport(
          params.siteReferenceFileName,
          "Use the uploaded reference documents to make sure the hazard controls match any GC or site-specific expectations."
        ),
        whyItMatters:
          "It matters because crews need hazards and controls tied to the actual work, not just broad safety language.",
      })
    );
  }

  if (!includesAny(lower, ["emergency", "911", "evacuation", "medical", "incident"])) {
    findings.push(
      createFinding({
        sectionLabel: "Emergency Procedures",
        issue: "Emergency response content is missing or too weak to support field use.",
        documentText: normalized,
        tokens: ["emergency", "evacuation", "medical", "incident"],
        builderExpectationSummary: params.builderExpectationSummary,
        preferredFallback:
          "Emergency Procedures: State 911 wording, site access instructions, assembly area expectations, and the immediate incident notification chain.",
        reviewerNote:
          "The field copy should tell workers exactly who to call, where responders enter, and where crews report after an event.",
        referenceSupport: buildReferenceSupport(
          params.siteReferenceFileName,
          "If the uploaded reference documents include emergency access, responder entry, or reporting instructions, this section should match that direction."
        ),
        whyItMatters: buildWhyItMatters("Emergency Procedures"),
      })
    );
  }

  if (
    !includesAny(lower, [
      "training",
      "orientation",
      "osha 10",
      "competent person",
      "certification",
    ])
  ) {
    findings.push(
      createFinding({
        sectionLabel: "Training Requirements",
        issue: "Training, orientation, or competent-person coverage is not clearly documented.",
        documentText: normalized,
        tokens: ["training", "orientation", "competent", "certification"],
        builderExpectationSummary: params.builderExpectationSummary,
        preferredFallback:
          "Training Requirements: Identify orientation, OSHA, competent-person, equipment, and task-specific qualifications required before work starts.",
        reviewerNote:
          "Use named role expectations and record references instead of only saying workers will be trained.",
        referenceSupport: buildReferenceSupport(
          params.siteReferenceFileName,
          "If the uploaded references call for specific qualifications, competent persons, or orientation steps, this section should point back to those requirements."
        ),
        whyItMatters: buildWhyItMatters("Training Requirements"),
      })
    );
  }

  if (
    !includesAny(lower, [
      "permit",
      "hot work",
      "lift plan",
      "elevated work",
      "confined space",
    ])
  ) {
    findings.push(
      createFinding({
        sectionLabel: "Permit Requirements",
        issue: "Permit-triggering work is not mapped consistently to the actual project activities.",
        documentText: normalized,
        tokens: ["permit", "hot work", "lift", "elevated", "confined"],
        builderExpectationSummary: params.builderExpectationSummary,
        preferredFallback:
          "Permit Requirements: Identify each triggered permit or notice, when it applies, and who is responsible for obtaining and closing it.",
        reviewerNote:
          "Render permit logic the same way the builder develops other required control sections.",
        referenceSupport: buildReferenceSupport(
          params.siteReferenceFileName,
          "Use the uploaded site or GC references to confirm which permits, notices, or lift documents are required for this job."
        ),
        whyItMatters: buildWhyItMatters("Permit Requirements"),
      })
    );
  }

  if (findings.length < 3) {
    findings.push(
      createFinding({
        sectionLabel: "Roles and Responsibilities",
        issue: "Supervision roles and accountability expectations need to be clearer in the field copy.",
        documentText: normalized,
        tokens: ["superintendent", "foreman", "supervisor", "responsib"],
        builderExpectationSummary: params.builderExpectationSummary,
        preferredFallback:
          "Roles and Responsibilities: Name the contractor superintendent, foreman/lead, workers, and safety support expectations for this project.",
        reviewerNote:
          "Use explicit role ownership so the issued CSEP reads like a final contractor document, not a draft summary.",
        referenceSupport: buildReferenceSupport(params.siteReferenceFileName),
        whyItMatters:
          "It matters because the document should make it obvious who owns each part of the work and the safety process.",
      })
    );
  }

  return findings.slice(0, 6);
}

function buildDeterministicBuilderProgramReview(params: {
  documentText: string;
  programLabel: string;
  projectName: string;
  reviewMode?: "builder_review" | "csep_completeness";
  additionalReviewerContext?: string | null;
  siteReferenceText?: string | null;
  siteReferenceFileName?: string | null;
  companyMemoryExcerpts?: string | null;
  builderExpectationSummary?: string[] | null;
  annotations?: ReviewDocumentAnnotation[];
}): BuilderProgramAiReview {
  const draftText = params.documentText.trim().toLowerCase();
  const referenceText = `${params.additionalReviewerContext ?? ""}\n${params.siteReferenceText ?? ""}\n${params.companyMemoryExcerpts ?? ""}`.toLowerCase();
  const hasBody = draftText.length >= 80;
  const builderExpectationSummary = params.builderExpectationSummary ?? [];
  const strengths: string[] = [];
  const gaps: string[] = [];
  const edits: string[] = [];
  const checklistDelta = buildChecklistDeltaSignals(draftText);
  const missingItemsChecklist = buildCsepMissingItemsChecklist(draftText);
  const sectionReviewNotes = buildSectionReviewNotes({
    documentText: params.documentText,
    builderExpectationSummary,
    siteReferenceText: params.siteReferenceText,
    siteReferenceFileName: params.siteReferenceFileName,
  });
  const detailedFindings = buildFallbackDetailedFindings({
    documentText: params.documentText,
    builderExpectationSummary,
    siteReferenceFileName: params.siteReferenceFileName,
  });
  const referenceGapSignals = buildReferenceSectionGapSignals({
    documentText: params.documentText,
    siteReferenceText: params.siteReferenceText,
    siteReferenceFileName: params.siteReferenceFileName,
    builderExpectationSummary,
  });

  if (includesAny(draftText, ["ppe", "hard hat", "gloves", "respirator", "safety glasses"])) {
    strengths.push("The draft appears to include at least some PPE expectations for field crews.");
  } else {
    gaps.push("PPE expectations are not clearly described and should be made explicit for the planned work.");
    edits.push("Add a dedicated PPE section tied to the active trades, tasks, and site conditions.");
  }

  if (includesAny(draftText, ["permit", "hot work", "confined space", "loto", "excavat", "trench"])) {
    strengths.push(
      "The draft references permit-sensitive work or approval triggers that usually require closer field coordination."
    );
  } else {
    gaps.push(
      "Permit-triggering activities are not clearly mapped, so reviewers should confirm whether hot work, excavation, electrical, or confined-space permits apply."
    );
    edits.push("Add a permit matrix listing each task and the required permit, notice, or pre-task authorization.");
  }

  if (includesAny(draftText, ["hazard", "risk", "control", "mitigation"])) {
    strengths.push("The submission includes hazard or control language that can be used to support task-level review.");
  } else {
    gaps.push("Hazards and controls are too thin for a reliable pre-approval review.");
    edits.push("Add a task-by-task hazard and control table before approval.");
  }

  if (includesAny(draftText, ["emergency", "medical", "evacuation", "first aid"])) {
    strengths.push("Emergency-response content appears to be present.");
  } else {
    gaps.push("Emergency procedures are not clearly stated for crews working under this plan.");
    edits.push("Add emergency response, evacuation, and incident-reporting steps for the site.");
  }

  if (referenceText.trim()) {
    if (!hasBody) {
      gaps.push("Reference material was provided, but the draft text is too limited to confirm alignment.");
      edits.push("Compare the uploaded site or GC requirements against the final draft after expanding the body content.");
    } else {
      strengths.push("Reviewer-supplied site, GC, or company reference context is available for comparison during final approval.");
      edits.push("Verify that site-specific restrictions, owner exhibits, and GC-required controls are carried into the final approved version.");
    }
  }

  if (!hasBody) {
    gaps.unshift("The uploaded draft has little extractable text, so this review is based on limited content.");
    edits.unshift("Re-export the draft after confirming the document body is present and readable.");
  }

  while (strengths.length < 2) {
    strengths.push(
      "The draft establishes enough structure to support a human approval review, even if several details still need tightening."
    );
  }
  while (gaps.length < 2) {
    gaps.push("Reviewer clarification is needed before treating the draft as approval-ready.");
  }
  while (edits.length < 2) {
    edits.push("Have the reviewer confirm trade scope, hazards, controls, and permit triggers before final approval.");
  }

  return mergeReferenceGapSignals(
    {
      reviewMode: params.reviewMode ?? "builder_review",
      executiveSummary: hasBody
        ? `${params.programLabel} draft for ${params.projectName || "the project"} was reviewed using deterministic fallback logic because no server OpenAI key is configured. The document appears to include some structured safety content, but it still needs human confirmation before approval.`
        : `${params.programLabel} draft for ${params.projectName || "the project"} could not be deeply reviewed because the extracted text is too limited and no server OpenAI key is configured.`,
      scopeTradeAndHazardCoverage: hasBody
        ? "The draft includes enough readable content to flag likely strengths and gaps, but trade scope, task hazards, controls, PPE, permits, and site-specific restrictions still need reviewer confirmation."
        : "The draft text is too limited to confirm trade scope, hazards, controls, and permit coverage with confidence.",
      regulatoryAndProgramStrengths: strengths.slice(0, 6),
      gapsRisksOrClarifications: gaps.slice(0, 8),
      recommendedEditsBeforeApproval: edits.slice(0, 6),
      missingItemsChecklist,
      builderAlignmentNotes: buildBuilderAlignmentNotes(builderExpectationSummary),
      sectionReviewNotes,
      detailedFindings,
      checklistDelta,
      documentQualityIssues: detectDocumentQualityIssues(params.documentText),
      noteCoverage: buildNoteCoverage(params.annotations ?? []),
      overallAssessment: hasBody ? "needs_work" : "insufficient_context",
    },
    referenceGapSignals
  );
}

export { extractReviewDocumentText as extractBuilderReviewDocumentText };

export async function generateBuilderProgramAiReview(params: {
  documentText: string;
  /** e.g. CSEP, PSHSEP, PESHEP */
  programLabel: string;
  projectName: string;
  reviewMode?: "builder_review" | "csep_completeness";
  documentTitle?: string | null;
  companyName?: string | null;
  recordNotes?: string | null;
  additionalReviewerContext?: string | null;
  annotations?: ReviewDocumentAnnotation[];
  /** Optional site/owner/GC reference (PDF/DOCX) to compare against the draft */
  siteReferenceText?: string | null;
  siteReferenceFileName?: string | null;
  /** Optional company knowledge snippets (from memory bank, including uploaded reference docs) */
  companyMemoryExcerpts?: string | null;
  /** Optional summary of current live builder section expectations used to judge completeness */
  builderExpectationSummary?: string[] | null;
}): Promise<{ review: BuilderProgramAiReview; disclaimer: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      review: buildDeterministicBuilderProgramReview(params),
      disclaimer: DISCLAIMER,
    };
  }

  const label = params.programLabel.trim().toUpperCase();
  const reviewMode = params.reviewMode ?? "builder_review";
  const hasBody = params.documentText.trim().length >= 80;
  const siteName = params.siteReferenceFileName?.trim() || null;
  const siteText = params.siteReferenceText?.trim() ?? "";
  const hasSiteRef = Boolean(siteName && siteText.length >= 20);

  const memoryExcerpts = params.companyMemoryExcerpts?.trim() ?? "";
  const hasMemory = memoryExcerpts.length >= 40;
  const annotationText = (params.annotations ?? [])
    .slice(0, 8)
    .map((annotation) =>
      [
        `- ${annotation.note}`,
        annotation.anchorText ? `  Anchor text: ${annotation.anchorText}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n");

  const contextBlock = [
    `Program type: ${label} (CSEP / PSHSEP / PESHEP-style builder safety-environmental plans in this product).`,
    `Project name: ${params.projectName || "(none)"}`,
    params.documentTitle?.trim() ? `Title: ${params.documentTitle.trim()}` : null,
    params.companyName?.trim() ? `Company: ${params.companyName.trim()}` : null,
    params.recordNotes?.trim() ? `Record notes: ${params.recordNotes.trim()}` : null,
    annotationText ? `Embedded reviewer notes from DOCX comments:\n${annotationText}` : null,
    params.additionalReviewerContext?.trim()
      ? `Reviewer-provided context (site rules, owner requirements, gaps to check): ${params.additionalReviewerContext.trim()}`
      : null,
    params.builderExpectationSummary?.length
      ? `--- Live CSEP builder expectation summary ---\n${params.builderExpectationSummary.join("\n")}`
      : null,
    hasMemory
      ? `--- Company knowledge (internal reference only; not a regulation) ---\n${memoryExcerpts.slice(0, 24_000)}${memoryExcerpts.length > 24_000 ? "\n�" : ""}`
      : null,
    siteName
      ? hasSiteRef
        ? `--- Site / owner / GC reference document (${siteName}) ---\n${params.siteReferenceText}`
        : `--- Site / owner / GC reference document (${siteName}) ---\n(Uploaded file has little or no extractable text; rely on pasted context and draft below.)`
      : null,
    hasBody
      ? `--- Builder draft under review ---\n${params.documentText}`
      : `--- Builder draft under review ---\n(No extractable text or too short; rely on metadata and reviewer context.)`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    "You are an expert reviewer of U.S. construction safety documentation (OSHA 29 CFR Part 1926 where relevant) and practical field readiness of safety/environmental plans.",
    "The primary file is a draft from the product's builder workflow (CSEP, PSHSEP, PESHEP, etc.). It is not final until a human reviewer approves.",
    reviewMode === "csep_completeness"
      ? "This run is a completed-CSEP completeness review. Prioritize what appears missing, incomplete, weak, or unverifiable relative to the expected CSEP process."
      : "This run is a builder-review workflow. Prioritize strengths, gaps, and edits before approval.",
    getReviewLayoutGuidance(),
    "Tasks:",
    "1) Summarize what the draft appears to cover (scope, trades, hazards, controls, PPE, permits, emergency info, environmental notes if any).",
    "2) Identify strengths relative to typical expectations for a site-specific or project safety/environmental plan.",
    "3) When company knowledge excerpts are provided, treat them as the company's own rules and priorities-align the draft and flag conflicts. When a site/owner/GC reference document is provided, compare the draft to that reference: note matches, omissions, and conflicts, in addition to OSHA-oriented gaps.",
    "4) Identify gaps, ambiguities, or risks a reviewer should address before approving, and separate content or generation issues from visible presentation or layout issues.",
    "5) Recommend concrete edits or follow-up questions for the reviewer.",
    "6) Populate missingItemsChecklist with the most important missing, incomplete, or unverifiable CSEP items. Prefer 'Could not verify ...' wording when the text is too thin to prove the item is present. When the uploaded reference document includes a section or requirement that is not carried into the CSEP, add that gap to this checklist explicitly.",
    "7) Use the live CSEP builder expectation summary as the primary template for what good coverage should look like. Populate builderAlignmentNotes with the most important builder sections or expectations that should be reflected in the issued document.",
    "8) Populate sectionReviewNotes with a broad section-by-section audit for the document. Include 12 to 18 section notes when the document is large enough. Each section note must include: sectionLabel, status (present, partial, or missing), whatWasFound, whatNeedsWork, suggestedBuilderTarget, whyItMatters, and referenceSupport. If the uploaded reference document contains a section that is missing from the CSEP, add a sectionReviewNote for it.",
    "9) Populate detailedFindings with concrete review notes for the most important wrong, weak, or missing items. Include 10 to 18 findings when the document is large enough. Spread them across the document instead of clustering only at the beginning. Each finding must include: sectionLabel, issue, documentExample quoted from or paraphrased from the uploaded document, preferredExample showing what stronger final content should look like, reviewerNote explaining the correction, referenceSupport explaining what in the uploaded reference document(s) supports the comment, and whyItMatters explaining why the correction is needed. When possible, call out the reference-document section or excerpt that is missing from the CSEP.",
    "10) Include an optional checklistDelta array for checklist-required planning controls that appear missing or partial (baseline, company policy, work-specific, environmental).",
    "11) Populate documentQualityIssues with customer-facing problems such as placeholders, leaked internal generator labels, raw risk-score presentation, branding placeholders, or task-trigger wording.",
    "12) When record notes or embedded DOCX comments are provided, map them to concrete next steps in noteCoverage.",
    "Write like an experienced internal reviewer leaving comments for a teammate. Use plain spoken construction language, short direct sentences, and natural wording.",
    "Write each finding so it can cleanly map into this note template: What, Why, How, Referance from referance document if referanced.",
    "For each detailed finding, write the underlying content so it can still read like a real comment I typed on the draft once those labels are added.",
    "Do not sound robotic, legalistic, or AI-generated. Avoid phrases like 'field-usable content was not confirmed', 'coverage appears incomplete', or other stiff audit language when a more human comment would say 'I'm not seeing this yet' or 'this section still needs work'.",
    "When you point something out, sound specific and practical, like a real reviewer marking up a document before issue.",
    "Do NOT invent citations, inspections, or compliance determinations. If text is unreadable or too thin, set overallAssessment to insufficient_context.",
    "Output strict JSON matching the schema.",
    contextBlock,
  ].join("\n\n");

  const preferredModel = (
    process.env.COMPANY_AI_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_BUILDER_REVIEW_MODEL
  ).trim();
  const modelCandidates = [
    preferredModel,
    DEFAULT_BUILDER_REVIEW_MODEL,
  ].filter((model, index, list) => Boolean(model) && list.indexOf(model) === index);

  let res: Response | null = null;
  let errText = "";
  for (const candidate of modelCandidates) {
    res = await fetch(`${getOpenAiApiBaseUrl()}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolveOpenAiCompatibleModelId(candidate),
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "builder_program_ai_review",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                reviewMode: {
                  type: "string",
                  enum: ["builder_review", "csep_completeness"],
                },
                executiveSummary: { type: "string" },
                scopeTradeAndHazardCoverage: { type: "string" },
                regulatoryAndProgramStrengths: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 2,
                  maxItems: 6,
                },
                gapsRisksOrClarifications: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 2,
                  maxItems: 8,
                },
                recommendedEditsBeforeApproval: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 2,
                  maxItems: 6,
                },
                missingItemsChecklist: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 2,
                  maxItems: 10,
                },
                builderAlignmentNotes: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 12,
                },
                sectionReviewNotes: {
                  type: "array",
                  minItems: 8,
                  maxItems: 18,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      sectionLabel: { type: "string" },
                      status: {
                        type: "string",
                        enum: ["present", "partial", "missing"],
                      },
                      whatWasFound: { type: "string" },
                      whatNeedsWork: { type: "string" },
                      suggestedBuilderTarget: { type: "string" },
                      whyItMatters: { type: "string" },
                      referenceSupport: { type: "string" },
                    },
                    required: [
                      "sectionLabel",
                      "status",
                      "whatWasFound",
                      "whatNeedsWork",
                      "suggestedBuilderTarget",
                      "whyItMatters",
                      "referenceSupport",
                    ],
                  },
                },
                detailedFindings: {
                  type: "array",
                  minItems: 5,
                  maxItems: 18,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      sectionLabel: { type: "string" },
                      issue: { type: "string" },
                      documentExample: { type: "string" },
                      preferredExample: { type: "string" },
                      reviewerNote: { type: "string" },
                      referenceSupport: { type: "string" },
                      whyItMatters: { type: "string" },
                    },
                    required: [
                      "sectionLabel",
                      "issue",
                      "documentExample",
                      "preferredExample",
                      "reviewerNote",
                      "referenceSupport",
                      "whyItMatters",
                    ],
                  },
                },
                checklistDelta: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 8,
                },
                documentQualityIssues: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 6,
                },
                noteCoverage: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 8,
                },
                overallAssessment: {
                  type: "string",
                  enum: ["sufficient", "needs_work", "insufficient_context"],
                },
              },
              required: [
                "reviewMode",
                "executiveSummary",
                "scopeTradeAndHazardCoverage",
                "regulatoryAndProgramStrengths",
                "gapsRisksOrClarifications",
                "recommendedEditsBeforeApproval",
                "missingItemsChecklist",
                "builderAlignmentNotes",
                "sectionReviewNotes",
                "detailedFindings",
                "checklistDelta",
                "documentQualityIssues",
                "noteCoverage",
                "overallAssessment",
              ],
            },
          },
        },
      }),
    });

    if (res.ok) {
      break;
    }

    errText = await res.text().catch(() => "");
    const shouldRetryOnFallback =
      candidate !== DEFAULT_BUILDER_REVIEW_MODEL &&
      (errText.includes("model_not_found") ||
        errText.includes("does not have access to model") ||
        errText.includes("invalid_request_error"));
    if (!shouldRetryOnFallback) {
      break;
    }
  }

  if (!res || !res.ok) {
    throw new Error(`OpenAI request failed (${res?.status ?? 502}): ${errText.slice(0, 500)}`);
  }
  const successfulResponse = res;

  const json: unknown = await successfulResponse.json();
  const rawText = extractResponsesApiOutputText(json);
  if (!rawText) {
    throw new Error("Empty model output.");
  }

  let parsed: Partial<BuilderProgramAiReview>;
  try {
    parsed = JSON.parse(rawText) as Partial<BuilderProgramAiReview>;
  } catch {
    throw new Error("Could not parse model JSON.");
  }

  const review: BuilderProgramAiReview = {
    reviewMode:
      parsed.reviewMode === "csep_completeness" ? "csep_completeness" : reviewMode,
    executiveSummary:
      toHumanReviewVoice(String(parsed.executiveSummary ?? "").trim()) || "No summary returned.",
    scopeTradeAndHazardCoverage:
      toHumanReviewVoice(String(parsed.scopeTradeAndHazardCoverage ?? "").trim()) || "-",
    regulatoryAndProgramStrengths: Array.isArray(parsed.regulatoryAndProgramStrengths)
      ? parsed.regulatoryAndProgramStrengths
          .filter((x) => typeof x === "string" && x.trim())
          .map((x) => toHumanReviewVoice(x))
      : [],
    gapsRisksOrClarifications: Array.isArray(parsed.gapsRisksOrClarifications)
      ? parsed.gapsRisksOrClarifications
          .filter((x) => typeof x === "string" && x.trim())
          .map((x) => toHumanReviewVoice(x))
      : [],
    recommendedEditsBeforeApproval: Array.isArray(parsed.recommendedEditsBeforeApproval)
      ? parsed.recommendedEditsBeforeApproval
          .filter((x) => typeof x === "string" && x.trim())
          .map((x) => toHumanReviewVoice(x))
      : [],
    missingItemsChecklist: Array.isArray(parsed.missingItemsChecklist)
      ? parsed.missingItemsChecklist.filter((x) => typeof x === "string" && x.trim())
      : buildCsepMissingItemsChecklist(String(params.documentText ?? "").toLowerCase()),
    builderAlignmentNotes: Array.isArray(parsed.builderAlignmentNotes)
      ? parsed.builderAlignmentNotes
          .filter((x) => typeof x === "string" && x.trim())
          .map((x) => toHumanReviewVoice(x))
      : buildBuilderAlignmentNotes(params.builderExpectationSummary ?? []),
    sectionReviewNotes: Array.isArray(parsed.sectionReviewNotes)
      ? (parsed.sectionReviewNotes as unknown[])
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => ({
            sectionLabel: String(item.sectionLabel ?? "").trim(),
            status: (
              item.status === "present" || item.status === "partial" || item.status === "missing"
                ? item.status
                : "partial"
            ) as BuilderProgramAiReviewSectionNote["status"],
            whatWasFound: toHumanReviewVoice(String(item.whatWasFound ?? "").trim()),
            whatNeedsWork: toHumanReviewVoice(String(item.whatNeedsWork ?? "").trim()),
            suggestedBuilderTarget: toHumanReviewVoice(
              String(item.suggestedBuilderTarget ?? "").trim()
            ),
            whyItMatters: toHumanReviewVoice(
              String(item.whyItMatters ?? buildWhyItMatters(String(item.sectionLabel ?? ""))).trim()
            ),
            referenceSupport: toHumanReviewVoice(
              String(item.referenceSupport ?? buildReferenceSupport(params.siteReferenceFileName)).trim()
            ),
          }))
          .filter(
            (item) =>
              item.sectionLabel &&
              item.whatWasFound &&
              item.whatNeedsWork &&
              item.suggestedBuilderTarget &&
              item.whyItMatters &&
              item.referenceSupport
          )
      : buildSectionReviewNotes({
          documentText: params.documentText,
          builderExpectationSummary: params.builderExpectationSummary ?? [],
          siteReferenceText: params.siteReferenceText,
          siteReferenceFileName: params.siteReferenceFileName,
        }),
    detailedFindings: Array.isArray(parsed.detailedFindings)
      ? (parsed.detailedFindings as unknown[])
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => ({
            sectionLabel: String(item.sectionLabel ?? "").trim(),
            issue: toHumanReviewVoice(String(item.issue ?? "").trim()),
            documentExample: String(item.documentExample ?? "").trim(),
            preferredExample: String(item.preferredExample ?? "").trim(),
            reviewerNote: toHumanReviewVoice(String(item.reviewerNote ?? "").trim()),
            referenceSupport: toHumanReviewVoice(
              String(item.referenceSupport ?? buildReferenceSupport(params.siteReferenceFileName)).trim()
            ),
            whyItMatters: toHumanReviewVoice(
              String(item.whyItMatters ?? buildWhyItMatters(String(item.sectionLabel ?? ""))).trim()
            ),
          }))
          .filter(
            (item) =>
              item.sectionLabel &&
              item.issue &&
              item.documentExample &&
              item.preferredExample &&
              item.reviewerNote &&
              item.referenceSupport &&
              item.whyItMatters
          )
      : buildFallbackDetailedFindings({
          documentText: params.documentText,
          builderExpectationSummary: params.builderExpectationSummary ?? [],
          siteReferenceFileName: params.siteReferenceFileName,
        }),
    checklistDelta: Array.isArray(parsed.checklistDelta)
      ? parsed.checklistDelta
          .filter((x) => typeof x === "string" && x.trim())
          .map((x) => toHumanReviewVoice(x))
      : buildChecklistDeltaSignals(String(params.documentText ?? "").toLowerCase()),
    documentQualityIssues: Array.isArray(parsed.documentQualityIssues)
      ? parsed.documentQualityIssues
          .filter((x) => typeof x === "string" && x.trim())
          .map((x) => toHumanReviewVoice(x))
      : detectDocumentQualityIssues(params.documentText),
    noteCoverage: Array.isArray(parsed.noteCoverage)
      ? parsed.noteCoverage
          .filter((x) => typeof x === "string" && x.trim())
          .map((x) => toHumanReviewVoice(x))
      : buildNoteCoverage(params.annotations ?? []),
    overallAssessment:
      parsed.overallAssessment === "sufficient" ||
      parsed.overallAssessment === "needs_work" ||
      parsed.overallAssessment === "insufficient_context"
        ? parsed.overallAssessment
        : "insufficient_context",
  };

  if (!review.builderAlignmentNotes.length) {
    review.builderAlignmentNotes = buildBuilderAlignmentNotes(params.builderExpectationSummary ?? []);
  }

  if (!review.sectionReviewNotes.length) {
    review.sectionReviewNotes = buildSectionReviewNotes({
      documentText: params.documentText,
      builderExpectationSummary: params.builderExpectationSummary ?? [],
      siteReferenceText: params.siteReferenceText,
      siteReferenceFileName: params.siteReferenceFileName,
    });
  }

  if (!review.detailedFindings.length) {
    review.detailedFindings = buildFallbackDetailedFindings({
      documentText: params.documentText,
      builderExpectationSummary: params.builderExpectationSummary ?? [],
      siteReferenceFileName: params.siteReferenceFileName,
    });
  }

  mergeReferenceGapSignals(
    review,
    buildReferenceSectionGapSignals({
      documentText: params.documentText,
      siteReferenceText: params.siteReferenceText,
      siteReferenceFileName: params.siteReferenceFileName,
      builderExpectationSummary: params.builderExpectationSummary ?? [],
    })
  );

  return { review, disclaimer: DISCLAIMER };
}
