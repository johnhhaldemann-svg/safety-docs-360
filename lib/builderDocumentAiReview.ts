import { extractResponsesApiOutputText } from "@/lib/ai/responses";
import { getReviewLayoutGuidance } from "@/lib/documentLayoutGuidance";
import { buildNoteCoverage, detectDocumentQualityIssues } from "@/lib/documentAiReviewSignals";
import type { ReviewDocumentAnnotation } from "@/lib/documentReviewExtraction";
import { extractReviewDocumentText } from "@/lib/documentReviewExtraction";
import { getOpenAiApiBaseUrl, resolveOpenAiCompatibleModelId } from "@/lib/openaiClient";

export type BuilderProgramAiReviewFinding = {
  sectionLabel: string;
  sentiment?: "positive" | "negative";
  /**
   * Build-instruction format. Every note must read as a concrete instruction
   * for the document builder, not as editorial critique.
   */
  problem: string;
  requiredOutput: string;
  acceptanceCheck: string;
  doNot: string;
  /** Legacy fields retained for downstream compatibility. */
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
  /**
   * Build-instruction format. Every note must read as a concrete instruction
   * for the document builder, not as editorial critique.
   */
  problem: string;
  requiredOutput: string;
  acceptanceCheck: string;
  doNot: string;
  /** Legacy fields retained for downstream compatibility. */
  whatWasFound: string;
  whatNeedsWork: string;
  suggestedBuilderTarget: string;
  whyItMatters?: string;
  referenceSupport?: string;
};

export type BuilderProgramAiReviewComplianceSummary = {
  compliancePercent: number;
  presentCount: number;
  partialCount: number;
  missingCount: number;
  totalSections: number;
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
  complianceSummary: BuilderProgramAiReviewComplianceSummary;
};

const DISCLAIMER =
  "This AI review is for internal triage only. It is not legal advice, does not replace a competent safety professional or the AHJ, and may omit or misread content. Verify against current OSHA / state rules, environmental obligations where applicable, and the contract documents.";
const DEFAULT_BUILDER_REVIEW_MODEL = "gpt-4o-mini";
const OPENAI_REVIEW_TIMEOUT_MS = 45000;
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

function countOccurrences(text: string, token: string) {
  if (!text || !token) return 0;
  let count = 0;
  let idx = text.indexOf(token);
  while (idx !== -1) {
    count += 1;
    idx = text.indexOf(token, idx + token.length);
  }
  return count;
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
  sentiment?: "positive" | "negative";
  issue: string;
  documentText: string;
  tokens: string[];
  builderExpectationSummary: string[];
  preferredFallback: string;
  reviewerNote: string;
  referenceSupport?: string;
  whyItMatters?: string;
  problem?: string;
  requiredOutput?: string;
  acceptanceCheck?: string;
  doNot?: string;
}): BuilderProgramAiReviewFinding {
  const sentiment = params.sentiment ?? "negative";
  const issue = toHumanReviewVoice(params.issue);
  const reviewerNote = toHumanReviewVoice(params.reviewerNote);
  const preferredExample = buildPreferredExample(
    params.sectionLabel,
    params.preferredFallback,
    params.builderExpectationSummary
  );
  const problem = toHumanReviewVoice(params.problem ?? params.issue);
  const requiredOutput = toHumanReviewVoice(
    params.requiredOutput ?? params.preferredFallback ?? preferredExample
  );
  const acceptanceCheck = toHumanReviewVoice(
    params.acceptanceCheck ??
      buildDefaultAcceptanceCheck(params.sectionLabel, sentiment === "positive" ? "present" : "partial")
  );
  const doNot = toHumanReviewVoice(params.doNot ?? buildDefaultDoNot(params.sectionLabel));
  return {
    sectionLabel: params.sectionLabel,
    sentiment,
    problem,
    requiredOutput,
    acceptanceCheck,
    doNot,
    issue,
    documentExample: quoteDocumentExample(params.documentText, params.tokens, params.sectionLabel),
    preferredExample,
    reviewerNote,
    referenceSupport: toHumanReviewVoice(params.referenceSupport),
    whyItMatters: toHumanReviewVoice(params.whyItMatters),
  };
}

function createPositiveFinding(params: {
  sectionLabel: string;
  issue: string;
  documentText: string;
  tokens: string[];
  builderExpectationSummary: string[];
  preferredFallback: string;
  reviewerNote: string;
  referenceSupport?: string;
  whyItMatters?: string;
  problem?: string;
  requiredOutput?: string;
  acceptanceCheck?: string;
  doNot?: string;
}): BuilderProgramAiReviewFinding {
  return createFinding({
    ...params,
    sentiment: "positive",
    acceptanceCheck:
      params.acceptanceCheck ??
      `${params.sectionLabel} stays at its current structure and wording level, and any other section that drops below this level is rebuilt to match.`,
    doNot:
      params.doNot ??
      `Do not weaken ${params.sectionLabel} during edits and do not duplicate it elsewhere in the document.`,
  });
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

/**
 * Concrete acceptance check for review notes when the model does not supply one.
 * Returns checkable observations, not editorial language.
 */
function buildDefaultAcceptanceCheck(
  sectionLabel: string,
  status: "present" | "partial" | "missing" = "partial"
) {
  const label = sectionLabel.trim() || "this section";
  const lower = label.toLowerCase();

  if (lower.includes("cover")) {
    return `The cover page shows project name, contractor name, trade/sub-trade, issue date, and a single approval block, with no duplicate cover or front-matter pages.`;
  }
  if (lower.includes("table of contents") || lower === "toc") {
    return "The TOC lists front matter, every numbered body section with its subsections, and every appendix, with right-aligned page references that match final pagination.";
  }
  if (lower.includes("project information") || lower.includes("contractor information")) {
    return `${label} contains the labeled fields (project name, address, contractor, trade, sub-trade, issue date, approver) populated from the project record with no placeholders.`;
  }
  if (lower.includes("scope")) {
    return `${label} lists every active task grouped under the correct trade/sub-trade and matches the selected scope exactly, with no tasks from other trades.`;
  }
  if (lower.includes("role") || lower.includes("responsibilit")) {
    return `Each named role lists responsibility, authority, and at least one decision example tied to start, stop-work, permit verification, restart approval, or crew release.`;
  }
  if (lower.includes("hazard") || lower.includes("activity hazard") || lower.includes("matrix")) {
    return `Each active task lists hazards with the corresponding controls, PPE, permits, and competency requirements directly under that task or in a matrix row.`;
  }
  if (lower.includes("emergency")) {
    return "Emergency Procedures contains 911 wording, site address/access for responders, alarm/evacuation steps, assembly area, and the named notification chain.";
  }
  if (lower.includes("weather")) {
    return "Weather Response lists daily monitoring source, communication path, named work restrictions for ice/wind/lightning/heat/cold, and the stop-work trigger for each.";
  }
  if (lower.includes("site") && (lower.includes("note") || lower.includes("specific"))) {
    return "Site-Specific Notes lists the project's site constraints, adjacent operations, and coordination requirements that crews must review during the morning huddle.";
  }
  if (lower.includes("training")) {
    return "Training Requirements names OSHA 10/30 expectations, Subpart R or other task-specific training, competent-person designations, and where records are kept.";
  }
  if (lower.includes("permit")) {
    return "Permit Requirements maps each permit-triggering task to the named permit, the responsible role, and where the issued permit must be posted.";
  }
  if (lower.includes("documentation") || lower.includes("reporting") || lower.includes("inspection")) {
    return `${label} names each required form/record, who completes it, the cadence, and where it is filed.`;
  }
  if (lower.includes("appendix")) {
    return `${label} appears once, with a single title and number, and is referenced from the body where it is used.`;
  }

  if (status === "missing") {
    return `${label} appears as its own labeled section in the body, with the required structure populated and no placeholder wording.`;
  }
  return `${label} reads as a final, project-specific build instruction with the required structure populated and no vague filler.`;
}

/**
 * Concrete "do not" guard rail for review notes when the model does not supply one.
 */
function buildDefaultDoNot(sectionLabel: string) {
  const label = sectionLabel.trim() || "this section";
  const lower = label.toLowerCase();

  if (lower.includes("cover") || lower.includes("front matter")) {
    return "Do not create a duplicate cover or front-matter page and do not leave generic subtitle filler in place.";
  }
  if (lower.includes("table of contents") || lower === "toc") {
    return "Do not leave the TOC as a flat list, do not omit appendices, and do not create more than one TOC.";
  }
  if (lower.includes("scope")) {
    return "Do not include tasks from other trades and do not leave generic scope-of-work boilerplate in place.";
  }
  if (lower.includes("role") || lower.includes("responsibilit")) {
    return "Do not leave roles as general duty summaries with no authority statement and no decision examples.";
  }
  if (lower.includes("hazard") || lower.includes("matrix")) {
    return "Do not list hazards without their paired controls and do not duplicate the matrix in the body and an appendix.";
  }
  if (lower.includes("emergency")) {
    return "Do not bury emergency procedures inside another section and do not leave 911 / assembly area / notification chain as placeholders.";
  }
  if (lower.includes("weather")) {
    return "Do not leave weather guidance as a generic paragraph and do not omit named stop-work triggers.";
  }
  if (lower.includes("training")) {
    return "Do not leave training as 'workers will be trained' and do not omit OSHA 10/30 or Subpart R where the scope requires it.";
  }
  if (lower.includes("permit")) {
    return "Do not list permits without naming the triggering task and the responsible role.";
  }
  if (lower.includes("appendix")) {
    return "Do not duplicate the appendix title or number anywhere else in the document.";
  }

  return "Do not leave this content as a vague editorial note, do not duplicate it in another section, and do not introduce 'tighten' / 'improve' / 'sounds generic' filler wording.";
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
  const referenceNormalized = compactWhitespace(params.siteReferenceText);
  const referenceLower = referenceNormalized.toLowerCase();
  const hasReference = referenceNormalized.length >= 40;

  return params.builderExpectationSummary
    .slice(0, params.maxItems ?? 24)
    .map((expectation) => {
      const sectionLabel = extractExpectationLabel(expectation);
      const tokens = buildSectionKeywordHints(sectionLabel);
      const matchCount = tokens.filter((token) => lower.includes(token)).length;
      const labelPhrase = sectionLabel.toLowerCase().trim();
      const labelIsPhrase = labelPhrase.length >= 6 && /\s/.test(labelPhrase);
      const labelHit = labelIsPhrase && lower.includes(labelPhrase);

      // Stricter evidence rules for marking a section "present":
      // - Single-token labels (e.g. "Training") require the full label phrase
      //   or at least two distinct occurrences of the token. A single passing
      //   mention of a common word is not enough.
      // - Multi-token labels require EITHER the full label phrase OR all
      //   tokens present OR the label phrase close to a structured cue
      //   ("section", ":", "requirements").
      let status: BuilderProgramAiReviewSectionNote["status"];
      if (tokens.length === 0) {
        status = labelHit ? "partial" : "missing";
      } else if (tokens.length === 1) {
        const token = tokens[0];
        const occurrences = token ? countOccurrences(lower, token) : 0;
        if (labelHit || occurrences >= 2) {
          status = "present";
        } else if (occurrences === 1) {
          status = "partial";
        } else {
          status = "missing";
        }
      } else {
        const allTokensPresent = matchCount === tokens.length;
        if (labelHit || allTokensPresent) {
          status = "present";
        } else if (matchCount > 0) {
          status = "partial";
        } else {
          status = "missing";
        }
      }

      // Reference-aware downgrade: if the uploaded reference covers this
      // section more thoroughly than the draft, we cannot claim the draft
      // fully addresses it.
      if (hasReference && tokens.length) {
        const referenceMatches = tokens.filter((token) => referenceLower.includes(token)).length;
        const referenceLabelHit = labelIsPhrase && referenceLower.includes(labelPhrase);
        const referenceStrong = referenceLabelHit || referenceMatches >= Math.max(1, tokens.length - 1);
        const draftStrong = labelHit || matchCount >= tokens.length;
        if (referenceStrong && !draftStrong) {
          status = status === "missing" ? "missing" : "partial";
        }
      }

      const whatWasFound = toHumanReviewVoice(
        status === "present"
          ? quoteDocumentExample(normalized, tokens, sectionLabel)
          : status === "partial"
            ? `Section is referenced but not built out. Captured fragment: ${quoteDocumentExample(normalized, tokens, sectionLabel)}`
            : `${sectionLabel} is not present in the uploaded document.`
      );
      const whatNeedsWork = toHumanReviewVoice(
        status === "present"
          ? `Rebuild ${sectionLabel} using the builder template structure: labeled subheading, populated fields from the project record, and the required content blocks listed below.`
          : status === "partial"
            ? `Expand ${sectionLabel} into the full builder template: labeled subheading, populated fields, required subsections, and named responsibilities/triggers.`
            : `Insert ${sectionLabel} as its own labeled section in the body, populated from the project record using the builder template structure.`
      );
      const suggestedBuilderTarget = toHumanReviewVoice(expectation);

      return {
        sectionLabel,
        status,
        problem: whatWasFound,
        requiredOutput: suggestedBuilderTarget || whatNeedsWork,
        acceptanceCheck: buildDefaultAcceptanceCheck(sectionLabel, status),
        doNot: buildDefaultDoNot(sectionLabel),
        whatWasFound,
        whatNeedsWork,
        suggestedBuilderTarget,
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

function buildComplianceSummary(
  sectionReviewNotes: BuilderProgramAiReviewSectionNote[]
): BuilderProgramAiReviewComplianceSummary {
  const presentCount = sectionReviewNotes.filter((item) => item.status === "present").length;
  const partialCount = sectionReviewNotes.filter((item) => item.status === "partial").length;
  const missingCount = sectionReviewNotes.filter((item) => item.status === "missing").length;
  const totalSections = sectionReviewNotes.length;
  const weightedScore = presentCount + partialCount * 0.5;
  const compliancePercent =
    totalSections > 0 ? Math.round((weightedScore / totalSections) * 100) : 0;

  return {
    compliancePercent,
    presentCount,
    partialCount,
    missingCount,
    totalSections,
  };
}

type ReferenceSectionGapSignal = {
  sectionLabel: string;
  checklistItem: string;
  finding: BuilderProgramAiReviewFinding;
  sectionNote: BuilderProgramAiReviewSectionNote;
  /**
   * Target status this signal wants the merged section note to reflect.
   * "missing" when the draft has zero coverage and the reference covers it.
   * "partial" when the draft has some coverage but the reference is
   * meaningfully deeper (i.e. the reference has content the draft has not
   * carried over).
   */
  targetStatus: "partial" | "missing";
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
    if (signals.length >= (params.maxItems ?? 12)) {
      break;
    }

    const tokens = buildSectionKeywordHints(sectionLabel);
    if (!tokens.length) continue;

    const labelPhrase = sectionLabel.toLowerCase().trim();
    const labelIsPhrase = labelPhrase.length >= 6 && /\s/.test(labelPhrase);
    const referenceLabelHit = labelIsPhrase && referenceLower.includes(labelPhrase);
    const draftLabelHit = labelIsPhrase && draftLower.includes(labelPhrase);

    const referenceMatches = tokens.filter((token) => referenceLower.includes(token)).length;
    const draftMatches = tokens.filter((token) => draftLower.includes(token)).length;

    const referenceCovers = referenceLabelHit || referenceMatches >= Math.max(1, tokens.length - 1);
    if (!referenceCovers) {
      continue;
    }

    const draftCovers = draftLabelHit || draftMatches >= tokens.length;

    // Emit a gap whenever the reference clearly covers this topic but the
    // draft does not fully carry it over. Two shapes:
    // - "missing": draft has zero token hits and no label hit → build this
    //   whole section from the reference.
    // - "partial": draft mentions the topic but does not structurally cover
    //   it the way the reference does → deepen the draft to match.
    let targetStatus: "missing" | "partial";
    if (!draftLabelHit && draftMatches === 0) {
      targetStatus = "missing";
    } else if (!draftCovers && referenceMatches > draftMatches) {
      targetStatus = "partial";
    } else {
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
    const issueText =
      targetStatus === "missing"
        ? `The uploaded reference document includes ${sectionLabel.toLowerCase()} direction that I am not seeing carried into this CSEP yet.`
        : `The uploaded reference document covers ${sectionLabel.toLowerCase()} in more depth than the CSEP; the draft mentions the topic but does not build it out to match the reference.`;
    const reviewerNoteText =
      targetStatus === "missing"
        ? "Pull this requirement out of the reference document and build it into the CSEP as clear project-specific field direction."
        : "Expand this section of the CSEP so it fully mirrors the reference document's direction, not just a passing mention.";
    const finding = createFinding({
      sectionLabel,
      issue: issueText,
      documentText: params.documentText,
      tokens,
      builderExpectationSummary: params.builderExpectationSummary,
      preferredFallback: preferredTarget,
      reviewerNote: reviewerNoteText,
      referenceSupport,
      whyItMatters,
    });
    const whatWasFound =
      targetStatus === "missing"
        ? `${sectionLabel} is not present in the CSEP body, but the uploaded reference document includes it.`
        : `${sectionLabel} is mentioned in the CSEP, but it is not built out to match the level of direction in the uploaded reference document.`;
    const whatNeedsWork =
      targetStatus === "missing"
        ? `Insert ${sectionLabel} as a labeled section or subsection in the CSEP body and populate it from the reference document direction.`
        : `Rebuild ${sectionLabel} in the CSEP so its subsections, fields, and content match the structure in the reference document.`;
    const sectionNote: BuilderProgramAiReviewSectionNote = {
      sectionLabel,
      status: targetStatus,
      problem: whatWasFound,
      requiredOutput: preferredTarget,
      acceptanceCheck: buildDefaultAcceptanceCheck(sectionLabel, targetStatus),
      doNot: buildDefaultDoNot(sectionLabel),
      whatWasFound,
      whatNeedsWork,
      suggestedBuilderTarget: preferredTarget,
      whyItMatters,
      referenceSupport,
    };

    signals.push({
      sectionLabel,
      checklistItem:
        targetStatus === "missing"
          ? `Could not verify ${sectionLabel.toLowerCase()} coverage that appears in the uploaded reference document.`
          : `Could not verify that ${sectionLabel.toLowerCase()} in the CSEP matches the depth of the uploaded reference document.`,
      finding,
      sectionNote,
      targetStatus,
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
    16
  );

  const statusRank: Record<BuilderProgramAiReviewSectionNote["status"], number> = {
    present: 0,
    partial: 1,
    missing: 2,
  };

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

    // Always attach the reference excerpt so the builder can see what the
    // reference actually said — even if we already had a note for this
    // section, the reference content is more specific.
    existing.referenceSupport = signal.sectionNote.referenceSupport || existing.referenceSupport;
    if (!existing.whyItMatters) {
      existing.whyItMatters = signal.sectionNote.whyItMatters;
    }

    // Downgrade status to the worse of (existing, signal.targetStatus).
    // This ensures that if the AI (or deterministic builder) called a
    // section "present" but the reference clearly has content the draft
    // didn't carry over, we reflect that gap in the compliance score.
    const nextStatus =
      statusRank[signal.targetStatus] > statusRank[existing.status]
        ? signal.targetStatus
        : existing.status;
    existing.status = nextStatus;

    // Replace the build-instruction fields with reference-driven language
    // when the signal is more specific. This keeps downstream notes
    // actionable instead of leaving a vague "present" note in place.
    if (nextStatus !== "present") {
      existing.problem = signal.sectionNote.problem || existing.problem;
      existing.requiredOutput = signal.sectionNote.requiredOutput || existing.requiredOutput;
      existing.acceptanceCheck =
        signal.sectionNote.acceptanceCheck || existing.acceptanceCheck;
      existing.doNot = signal.sectionNote.doNot || existing.doNot;
      existing.whatWasFound = signal.sectionNote.whatWasFound || existing.whatWasFound;
      existing.whatNeedsWork = signal.sectionNote.whatNeedsWork || existing.whatNeedsWork;
      existing.suggestedBuilderTarget =
        signal.sectionNote.suggestedBuilderTarget || existing.suggestedBuilderTarget;
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

  return findings.slice(0, 20);
}

function buildPositiveCoverageFindings(params: {
  documentText: string;
  sectionReviewNotes: BuilderProgramAiReviewSectionNote[];
  builderExpectationSummary: string[];
  siteReferenceFileName?: string | null;
  maxItems?: number;
}) {
  const findings: BuilderProgramAiReviewFinding[] = [];
  for (const note of params.sectionReviewNotes) {
    if (findings.length >= (params.maxItems ?? 8)) {
      break;
    }
    if (note.status !== "present") {
      continue;
    }
    findings.push(
      createPositiveFinding({
        sectionLabel: note.sectionLabel,
        issue: `${note.sectionLabel} is already reading clearly and should be kept as a model for the rest of the document.`,
        documentText: params.documentText,
        tokens: buildSectionKeywordHints(note.sectionLabel),
        builderExpectationSummary: params.builderExpectationSummary,
        preferredFallback: note.suggestedBuilderTarget,
        reviewerNote:
          "Keep this section structure and tone. Use it as the standard for weaker sections that still need to be rebuilt.",
        referenceSupport: buildReferenceSupport(
          params.siteReferenceFileName,
          "Where this section already lines up with the uploaded references, keep that same level of project-specific detail."
        ),
        whyItMatters:
          "It matters because strong sections give the reviewer a clean pattern to follow when tightening the rest of the CSEP.",
      })
    );
  }
  return findings;
}

function ensureMinimumReviewComments(params: {
  review: BuilderProgramAiReview;
  documentText: string;
  builderExpectationSummary: string[];
  siteReferenceFileName?: string | null;
  minimumComments?: number;
}) {
  const minimumComments = params.minimumComments ?? 20;
  const review = params.review;
  const seen = new Set(
    review.detailedFindings.map((item) =>
      `${normalizeReviewKey(item.sectionLabel)}::${normalizeReviewKey(item.issue)}`
    )
  );

  const positiveFindings = buildPositiveCoverageFindings({
    documentText: params.documentText,
    sectionReviewNotes: review.sectionReviewNotes,
    builderExpectationSummary: params.builderExpectationSummary,
    siteReferenceFileName: params.siteReferenceFileName,
    maxItems: minimumComments,
  });

  for (const finding of positiveFindings) {
    if (review.detailedFindings.length >= minimumComments) {
      break;
    }
    const key = `${normalizeReviewKey(finding.sectionLabel)}::${normalizeReviewKey(finding.issue)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    review.detailedFindings.push(finding);
  }

  const supplementalNotes = review.sectionReviewNotes.map((note) =>
    note.status === "present"
      ? createPositiveFinding({
          sectionLabel: note.sectionLabel,
          issue: `${note.sectionLabel} is in place and can stay, but keep the same level of detail across the rest of the plan.`,
          documentText: params.documentText,
          tokens: buildSectionKeywordHints(note.sectionLabel),
          builderExpectationSummary: params.builderExpectationSummary,
          preferredFallback: note.suggestedBuilderTarget,
          reviewerNote:
            "No major correction is needed here. Keep this wording level and apply the same standard to weaker sections.",
          referenceSupport: buildReferenceSupport(params.siteReferenceFileName),
          whyItMatters:
            "It matters because the strongest sections should set the quality bar for the rest of the issued document.",
        })
      : createFinding({
          sectionLabel: note.sectionLabel,
          issue: note.whatNeedsWork,
          documentText: params.documentText,
          tokens: buildSectionKeywordHints(note.sectionLabel),
          builderExpectationSummary: params.builderExpectationSummary,
          preferredFallback: note.suggestedBuilderTarget,
          reviewerNote: note.whatNeedsWork,
          referenceSupport: note.referenceSupport,
          whyItMatters: note.whyItMatters,
          problem: note.problem,
          requiredOutput: note.requiredOutput,
          acceptanceCheck: note.acceptanceCheck,
          doNot: note.doNot,
        })
  );

  for (const finding of supplementalNotes) {
    if (review.detailedFindings.length >= minimumComments) {
      break;
    }
    const key = `${normalizeReviewKey(finding.sectionLabel)}::${normalizeReviewKey(finding.issue)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    review.detailedFindings.push(finding);
  }

  return review;
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

  const review = mergeReferenceGapSignals(
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
      complianceSummary: buildComplianceSummary(sectionReviewNotes),
    },
    referenceGapSignals
  );

  ensureMinimumReviewComments({
    review,
    documentText: params.documentText,
    builderExpectationSummary,
    siteReferenceFileName: params.siteReferenceFileName,
    minimumComments: 20,
  });

  review.complianceSummary = buildComplianceSummary(review.sectionReviewNotes);

  return review;
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
    "2a) Read and cross-check the full uploaded document before writing comments. Do not stop after the first few pages or early sections. Sample the beginning, middle, and end so the comments reflect the whole document.",
    "3) When company knowledge excerpts are provided, treat them as the company's own rules and priorities-align the draft and flag conflicts. When a site/owner/GC reference document is provided, compare the draft to that reference: note matches, omissions, and conflicts, in addition to OSHA-oriented gaps.",
    "4) Identify gaps, ambiguities, or risks a reviewer should address before approving, and separate content or generation issues from visible presentation or layout issues.",
    "5) Recommend concrete edits or follow-up questions for the reviewer.",
    "6) Populate missingItemsChecklist with the most important missing, incomplete, or unverifiable CSEP items. Prefer 'Could not verify ...' wording when the text is too thin to prove the item is present. When the uploaded reference document includes a section or requirement that is not carried into the CSEP, add that gap to this checklist explicitly.",
    "7) Use the live CSEP builder expectation summary as the primary template for what good coverage should look like. Populate builderAlignmentNotes with the most important builder sections or expectations that should be reflected in the issued document.",
    "8) Populate sectionReviewNotes with a broad section-by-section audit for the document. Include about 8 to 12 section notes when the document is large enough. Each section note must include: sectionLabel, status (present, partial, or missing), problem, requiredOutput, acceptanceCheck, doNot, whyItMatters, and referenceSupport. Also populate the legacy fields whatWasFound, whatNeedsWork, and suggestedBuilderTarget so they read as concrete build instructions, not as critique. If the uploaded reference document contains a section that is missing from the CSEP, add a sectionReviewNote for it.",
    "STATUS RULES (MANDATORY, apply to every sectionReviewNote):",
    "  present = the CSEP actually contains a labeled subsection with the required structure, populated fields, and concrete field direction for that topic. A single passing keyword mention is NOT present. If you only see the topic named in passing, mark it partial.",
    "  partial = the topic is named or briefly referenced but is not built out with the required structure, subsections, fields, responsibilities, triggers, or specific direction.",
    "  missing = the CSEP does not cover the topic at all, OR the CSEP has only generic placeholder language for it.",
    "  Never mark a section present just because the topic word appears in the document. Require structural coverage.",
    "REFERENCE COMPARISON RULES (MANDATORY when a site/owner/GC reference document is provided):",
    "  For every sectionReviewNote, compare the CSEP content for that topic to what the reference document says about the same topic.",
    "  If the reference document covers the topic in more depth than the CSEP, downgrade the status: present becomes partial, and partial becomes missing. Populate referenceSupport with the reference excerpt that is not carried into the CSEP, and write the problem/requiredOutput to name exactly what should be imported from the reference.",
    "  If the reference document contains a section or requirement that is not reflected in the CSEP at all, add a missing sectionReviewNote for it with referenceSupport quoting or paraphrasing the reference.",
    "  When a reference document is provided, at least half of the sectionReviewNotes should include referenceSupport. Do not return an all-present audit when a reference document is attached unless the CSEP demonstrably matches or exceeds every topic in the reference.",
    "9) Populate detailedFindings with concrete build-instruction comments for the most important wrong, weak, missing, or notably strong items. Return about 6 to 10 findings when the document has enough readable content. If there are not enough negative comments, you may include a few positive comments that call out sections that are done well and should be kept as the quality bar. Spread them across the document instead of clustering only at the beginning. Each finding must include: sectionLabel, problem, requiredOutput, acceptanceCheck, doNot, whyItMatters, referenceSupport, plus the legacy fields issue, documentExample (quoted or paraphrased from the uploaded document), preferredExample, and reviewerNote. The legacy fields must mirror the build-instruction content (issue = problem, preferredExample = requiredOutput, reviewerNote = step-by-step build action). When possible, call out the reference-document section or excerpt that is missing from the CSEP.",
    "10) Include an optional checklistDelta array for checklist-required planning controls that appear missing or partial (baseline, company policy, work-specific, environmental).",
    "11) Populate documentQualityIssues with customer-facing problems such as placeholders, leaked internal generator labels, raw risk-score presentation, branding placeholders, or task-trigger wording.",
    "12) When record notes or embedded DOCX comments are provided, map them to concrete next steps in noteCoverage.",
    "REVIEW NOTE FORMAT (MANDATORY):",
    "Every entry in sectionReviewNotes and detailedFindings must read as an implementation requirement for the document builder, not as editorial critique.",
    "Use this exact 5-part structure for every note (filling problem, requiredOutput, acceptanceCheck, doNot, plus legacy mirror fields):",
    "  Section: name the exact section or subsection (use sectionLabel).",
    "  Problem: state exactly what is missing or wrong in the current output. Be specific and observable. Quote the offending text where possible.",
    "  Required Output: state exactly what the document should contain after the fix. Use concrete structure, fields, headings, table columns, ordered subsections, or content requirements. No vague 'tighten this' wording.",
    "  Acceptance Check: state how we will know it is fixed in the final document (a checkable observation, e.g. 'Each role lists authority + at least one decision example').",
    "  Do Not: state what should not happen, especially no duplicate sections, no overlap with other sections, no vague filler, no editorial language.",
    "BANNED PHRASES: 'tighten', 'improve', 'sounds generic', 'lacks visual balance', 'too generic', 'missing hierarchy', 'should sound more project-specific', 'make more professional', or any other vague critique unless followed by a specific Required Output that names the structure or content to add. Reject and rewrite any note you would otherwise have written this way.",
    "Every note must tell the builder exactly what to generate, move, remove, regroup, or rename. Notes must be usable as build instructions with no guessing. If a note cannot be turned into a concrete build requirement, rewrite it until it can or omit it.",
    "Apply this rule to all review notes for: cover page, table of contents, project information, scope summary, roles and responsibilities, task execution modules, hazard control sections, emergency procedures, weather response, training requirements, documentation and reporting, and appendices.",
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
    try {
      res = await fetch(`${getOpenAiApiBaseUrl()}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(OPENAI_REVIEW_TIMEOUT_MS),
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
                    maxItems: 12,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        sectionLabel: { type: "string" },
                        status: {
                          type: "string",
                          enum: ["present", "partial", "missing"],
                        },
                        problem: { type: "string" },
                        requiredOutput: { type: "string" },
                        acceptanceCheck: { type: "string" },
                        doNot: { type: "string" },
                        whatWasFound: { type: "string" },
                        whatNeedsWork: { type: "string" },
                        suggestedBuilderTarget: { type: "string" },
                        whyItMatters: { type: "string" },
                        referenceSupport: { type: "string" },
                      },
                      required: [
                        "sectionLabel",
                        "status",
                        "problem",
                        "requiredOutput",
                        "acceptanceCheck",
                        "doNot",
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
                    minItems: 6,
                    maxItems: 10,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        sectionLabel: { type: "string" },
                        sentiment: {
                          type: "string",
                          enum: ["positive", "negative"],
                        },
                        problem: { type: "string" },
                        requiredOutput: { type: "string" },
                        acceptanceCheck: { type: "string" },
                        doNot: { type: "string" },
                        issue: { type: "string" },
                        documentExample: { type: "string" },
                        preferredExample: { type: "string" },
                        reviewerNote: { type: "string" },
                        referenceSupport: { type: "string" },
                        whyItMatters: { type: "string" },
                      },
                      required: [
                        "sectionLabel",
                        "sentiment",
                        "problem",
                        "requiredOutput",
                        "acceptanceCheck",
                        "doNot",
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
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        return {
          review: buildDeterministicBuilderProgramReview(params),
          disclaimer: DISCLAIMER,
        };
      }
      throw error;
    }

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
          .map((item) => {
            const sectionLabel = String(item.sectionLabel ?? "").trim();
            const status = (
              item.status === "present" || item.status === "partial" || item.status === "missing"
                ? item.status
                : "partial"
            ) as BuilderProgramAiReviewSectionNote["status"];
            const whatWasFound = toHumanReviewVoice(String(item.whatWasFound ?? "").trim());
            const whatNeedsWork = toHumanReviewVoice(String(item.whatNeedsWork ?? "").trim());
            const suggestedBuilderTarget = toHumanReviewVoice(
              String(item.suggestedBuilderTarget ?? "").trim()
            );
            const problem = toHumanReviewVoice(
              String(item.problem ?? whatWasFound ?? "").trim()
            );
            const requiredOutput = toHumanReviewVoice(
              String(item.requiredOutput ?? suggestedBuilderTarget ?? "").trim()
            );
            const acceptanceCheck = toHumanReviewVoice(
              String(
                item.acceptanceCheck ??
                  buildDefaultAcceptanceCheck(sectionLabel, status)
              ).trim()
            );
            const doNot = toHumanReviewVoice(
              String(item.doNot ?? buildDefaultDoNot(sectionLabel)).trim()
            );
            return {
              sectionLabel,
              status,
              problem,
              requiredOutput,
              acceptanceCheck,
              doNot,
              whatWasFound,
              whatNeedsWork,
              suggestedBuilderTarget,
              whyItMatters: toHumanReviewVoice(
                String(item.whyItMatters ?? buildWhyItMatters(String(item.sectionLabel ?? ""))).trim()
              ),
              referenceSupport: toHumanReviewVoice(
                String(item.referenceSupport ?? buildReferenceSupport(params.siteReferenceFileName)).trim()
              ),
            } satisfies BuilderProgramAiReviewSectionNote;
          })
          .filter(
            (item) =>
              item.sectionLabel &&
              item.problem &&
              item.requiredOutput &&
              item.acceptanceCheck &&
              item.doNot &&
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
          .map((item): BuilderProgramAiReviewFinding => {
            const sentiment: BuilderProgramAiReviewFinding["sentiment"] =
              item.sentiment === "positive" || item.sentiment === "negative"
                ? item.sentiment
                : "negative";
            const sectionLabel = String(item.sectionLabel ?? "").trim();
            const issue = toHumanReviewVoice(String(item.issue ?? "").trim());
            const preferredExample = String(item.preferredExample ?? "").trim();
            const reviewerNote = toHumanReviewVoice(String(item.reviewerNote ?? "").trim());
            const problem = toHumanReviewVoice(String(item.problem ?? issue ?? "").trim());
            const requiredOutput = toHumanReviewVoice(
              String(item.requiredOutput ?? preferredExample ?? "").trim()
            );
            const acceptanceCheck = toHumanReviewVoice(
              String(
                item.acceptanceCheck ??
                  buildDefaultAcceptanceCheck(sectionLabel, sentiment === "positive" ? "present" : "partial")
              ).trim()
            );
            const doNot = toHumanReviewVoice(
              String(item.doNot ?? buildDefaultDoNot(sectionLabel)).trim()
            );
            return {
              sectionLabel,
              sentiment,
              problem,
              requiredOutput,
              acceptanceCheck,
              doNot,
              issue,
              documentExample: String(item.documentExample ?? "").trim(),
              preferredExample,
              reviewerNote,
              referenceSupport: toHumanReviewVoice(
                String(item.referenceSupport ?? buildReferenceSupport(params.siteReferenceFileName)).trim()
              ),
              whyItMatters: toHumanReviewVoice(
                String(item.whyItMatters ?? buildWhyItMatters(String(item.sectionLabel ?? ""))).trim()
              ),
            };
          })
          .filter(
            (item) =>
              item.sectionLabel &&
              item.sentiment &&
              item.problem &&
              item.requiredOutput &&
              item.acceptanceCheck &&
              item.doNot &&
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
    complianceSummary: {
      compliancePercent: 0,
      presentCount: 0,
      partialCount: 0,
      missingCount: 0,
      totalSections: 0,
    },
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

  ensureMinimumReviewComments({
    review,
    documentText: params.documentText,
    builderExpectationSummary: params.builderExpectationSummary ?? [],
    siteReferenceFileName: params.siteReferenceFileName,
    minimumComments: 20,
  });

  review.complianceSummary = buildComplianceSummary(review.sectionReviewNotes);

  return { review, disclaimer: DISCLAIMER };
}
