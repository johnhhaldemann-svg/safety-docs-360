import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { DOCUMENT_DISCLAIMER_LINES } from "@/lib/legal";
import {
  CONTRACTOR_SAFETY_BLUEPRINT_TITLE,
  getSafetyBlueprintDraftFilename,
} from "@/lib/safetyBlueprintLabels";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildStructuredCsepDraft } from "@/lib/csepBuilder";
import { getProjectSpecificSafetyNotesNarrativeBody } from "@/lib/csepSiteSpecificNotes";
import {
  buildCsepPpeSectionBulletsFromCombined,
  cleanFinalText,
  dedupePpeItemsForExport,
  flattenPpeSectionBulletsToItems,
  normalizeFinalExportText,
  normalizeHazardList,
  normalizePermitList,
  normalizePpeList,
} from "@/lib/csepFinalization";
import { polishCsepDocxNarrativeText, splitCsepDocxBodyIntoSegments } from "@/lib/csepDocxNarrativePolish";
import {
  expandParagraphsForDocxReadability,
  splitParagraphAtEstimatedDocxLineCount,
} from "@/lib/csepDocxReadableParagraphs";
import {
  CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY,
  relocateSafetyProgramReferencePacks,
} from "@/lib/csepSafetyProgramReferenceRelocation";
import { formatGcCmPartnersForExport, normalizeGcCmPartnerEntries } from "@/lib/csepGcCmPartners";
import {
  CSEP_WORK_ATTIRE_DEFAULT_BULLETS,
  CSEP_WORK_ATTIRE_SUBSECTION_BODY,
} from "@/lib/csepWorkAttireDefaults";
import { assertCsepExportQuality } from "@/lib/csepExportQualityCheck";
import { CANONICAL_CSEP_SECTION_ORDER } from "@/lib/csep/csep-section-order";
import {
  CSEP_HAZARD_NON_OWNER_POLICY_PATTERN,
  CSEP_SECTION_OWNERSHIP_PATTERNS,
  sectionHasContent,
} from "@/lib/csep/csep-dedupe-rules";
import { CSEP_HAZARD_TEMPLATE_SLICES, buildHazardSliceTitle } from "@/lib/csep/csep-hazard-template";
import { CSEP_REGULATORY_REFERENCE_INDEX } from "@/lib/csepRegulatoryReferenceIndex";
import type { GeneratedSafetyPlanDraft, GeneratedSafetyPlanSection } from "@/types/safety-intelligence";

export type CsepCoverMetadataRow = {
  label: string;
  value: string;
};

export type CsepRevisionEntry = {
  revision: string;
  date: string;
  description: string;
  preparedBy: string;
  approvedBy: string;
};

export type CsepTemplateSubsection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
  table?: GeneratedSafetyPlanSection["table"];
  /**
   * For simple one-line task lists (e.g. Scope Summary task bullets), render `items` as indented
   * body lines without subsection numbering. Defaults to numbered list styling.
   */
  plainItemsStyle?: "numbered" | "offset_lines";
  /**
   * Task-hazard matrices and similar tables: render rows as indented blocks without
   * a deep 5.85.1-style number chain. Default is numbered rows for legacy tables.
   */
  tableRowsStyle?: "numbered" | "offset_lines";
};

export type CsepTemplateSection = {
  key: string;
  title: string;
  kind?: "front_matter" | "main" | "appendix" | "gap";
  numberLabel?: string | null;
  descriptor?: string | null;
  subsections: CsepTemplateSubsection[];
  closingTagline?: string | null;
};

export type CsepRenderModel = {
  projectName: string;
  contractorName: string;
  /**
   * Workspace / configured company name shown in every page footer.
   * Falls back to "Safety360Docs" when not supplied (see `normalizeRenderModel`).
   */
  footerCompanyName: string;
  tradeLabel?: string | null;
  subTradeLabel?: string | null;
  issueLabel: string;
  /** Semicolon-separated tasks for the title page (may be "N/A"). */
  titlePageTaskSummary: string;
  /** Project address or location line for the title page. */
  titlePageProjectLocation: string;
  /** Governing state / jurisdiction for the title page (may be "N/A"). */
  titlePageGoverningState: string;
  statusLabel: string;
  preparedBy: string;
  coverSubtitleLines: string[];
  coverMetadataRows: CsepCoverMetadataRow[];
  coverLogo?: {
    data: Uint8Array;
    type: "png" | "jpg" | "gif" | "bmp";
  } | null;
  approvalLines: string[];
  revisionHistory: CsepRevisionEntry[];
  frontMatterSections: CsepTemplateSection[];
  sections: CsepTemplateSection[];
  appendixSections: CsepTemplateSection[];
  disclaimerLines: readonly string[];
  filenameProjectPart: string;
};

type BuildCsepTemplateSectionsParams = {
  draft?: GeneratedSafetyPlanDraft;
  projectName: string;
  contractorName: string;
  tradeLabel?: string | null;
  subTradeLabel?: string | null;
  issueLabel?: string;
  taskTitles?: string[];
  sourceSections: GeneratedSafetyPlanSection[];
};

type FixedSectionDefinition = {
  key: string;
  /** Base title without outline numbers; ordinals come from `buildCsepOutlinePlan`. */
  title: string;
  kind: "front_matter" | "main";
  descriptor: string;
};

type ParsedSourceNumberedItem = {
  title: string;
  body: string;
};

const STYLE_IDS = {
  body: "CsepBody",
  coverTitle: "CsepCoverTitle",
  coverSubtitle: "CsepCoverSubtitle",
  coverMeta: "CsepCoverMeta",
  sectionHeading: "CsepSectionHeading",
  sectionDescriptor: "CsepSectionDescriptor",
  subheading: "CsepSubheading",
  contentsEntry: "CsepContentsEntry",
} as const;

const COLORS = {
  ink: "1F1F1F",
  titleBlue: "365F91",
  headingBlue: "4F81BD",
  deepBlue: "17365D",
  accentRed: "D63A34",
  gray: "7A7A7A",
  border: "C6D4E1",
} as const;

const INDENTS = {
  numberedLeft: 180,
  numberedHanging: 180,
  childLeft: 540,
  childHanging: 240,
  childBodyLeft: 780,
  grandchildLeft: 900,
  grandchildHanging: 240,
  grandchildBodyLeft: 1140,
} as const;

const FIXED_SECTION_DEFINITIONS: FixedSectionDefinition[] = [...CANONICAL_CSEP_SECTION_ORDER];

function todayIssueLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

export function safeFilePart(value: string, fallback: string) {
  const cleaned = value.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  return cleaned || fallback;
}

function finalValueOrNA(value?: string | null) {
  return normalizeFinalExportText(value) ?? "N/A";
}

function finalPartyValueOrNA(value?: string | null) {
  const normalized = value
    ?.replace(/\r\n?/g, "\n")
    .split(/\n|;/)
    .map((item) => normalizeFinalExportText(item)?.trim() ?? "")
    .filter(Boolean);

  return normalized && normalized.length ? Array.from(new Set(normalized)).join("; ") : "N/A";
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  );
}

function uniqueItems(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function joinDisplayValues(values: Array<string | null | undefined>, fallback = "N/A") {
  const normalized = uniqueValues(values);
  return normalized.length ? normalized.join(" / ") : fallback;
}

function sanitizeGeneratedText(value?: string | null) {
  if (!value) return "";
  return (
    normalizeFinalExportText(
      value
    .replace(/\bContractor Blueprint\b/g, CONTRACTOR_SAFETY_BLUEPRINT_TITLE)
    .replace(/\bSite Blueprint\b/g, CONTRACTOR_SAFETY_BLUEPRINT_TITLE)
    .replace(/\bBlueprint\b/g, CONTRACTOR_SAFETY_BLUEPRINT_TITLE)
    .trim()
    ) ?? ""
  );
}

function sanitizeGeneratedSection(section: GeneratedSafetyPlanSection): GeneratedSafetyPlanSection {
  return {
    ...section,
    title: sanitizeGeneratedText(section.title),
    summary: sanitizeGeneratedText(section.summary ?? ""),
    body: sanitizeGeneratedText(section.body ?? ""),
    bullets: section.bullets?.map((bullet) => sanitizeGeneratedText(bullet)),
    subsections: section.subsections?.map((subsection) => ({
      title: sanitizeGeneratedText(subsection.title),
      body: sanitizeGeneratedText(subsection.body ?? ""),
      bullets: subsection.bullets.map((bullet) => sanitizeGeneratedText(bullet)),
    })),
    table: section.table
      ? {
          columns: section.table.columns.map((column) => sanitizeGeneratedText(column)),
          rows: section.table.rows.map((row) => row.map((cell) => sanitizeGeneratedText(cell))),
        }
      : null,
  };
}

function splitParagraphs(value?: string | null) {
  return (value ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function inlineNumberMarkerIndexes(value: string) {
  return Array.from(value.matchAll(/(?:^|\s)(\d+)\.\s+/g)).map((match) => ({
    index: (match.index ?? 0) + (match[0].startsWith(" ") ? 1 : 0),
  }));
}

function normalizeInlineEnumeratedItem(value: string) {
  const cleaned = normalizeFinalExportText(value)?.trim() ?? "";
  if (!cleaned) return null;
  if (/^[a-z]/.test(cleaned)) return null;
  if (/^[\d.]/.test(cleaned)) return null;
  if (
    !/\b(is|are|shall|must|should|confirm|verify|review|document|maintain|ensure|inspect|complete|use|obtain|coordinate|provide|keep|stop|leave|remove|restore|report|assign)\b/i.test(
      cleaned
    )
  ) {
    return null;
  }
  if (!/[.!?]$/.test(cleaned) && cleaned.split(/\s+/).length <= 5) return null;
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function splitInlineEnumeratedParagraph(value: string) {
  const cleaned = cleanFinalText(value)?.trim() ?? "";
  if (!cleaned) {
    return { intro: null as string | null, items: [] as string[] };
  }

  const markers = inlineNumberMarkerIndexes(cleaned);
  if (markers.length === 0) {
    return { intro: normalizeFinalExportText(cleaned), items: [] as string[] };
  }

  const firstIndex = markers[0]?.index ?? 0;
  const intro = normalizeFinalExportText(cleaned.slice(0, firstIndex)) ?? null;
  const items: string[] = [];

  markers.forEach((marker, index) => {
    const nextMarker = markers[index + 1];
    const rawSegment = cleaned
      .slice(marker.index, nextMarker ? nextMarker.index : undefined)
      .replace(/^\d+\.\s+/, "")
      .trim();
    const normalized = normalizeInlineEnumeratedItem(rawSegment);
    if (normalized) {
      items.push(normalized);
    }
  });

  if (!items.length) {
    return { intro: intro ?? cleaned, items };
  }

  return { intro, items };
}

function splitInlineEnumeratedParagraphs(paragraphs: string[]) {
  const cleanParagraphs: string[] = [];
  const items: string[] = [];

  paragraphs.forEach((paragraph) => {
    const split = splitInlineEnumeratedParagraph(paragraph);
    if (split.intro) {
      cleanParagraphs.push(split.intro);
    }
    items.push(...split.items);
  });

  return {
    paragraphs: uniqueItems(cleanParagraphs),
    items: uniqueItems(items),
  };
}

function normalizeCompareToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripExistingNumberPrefix(value: string) {
  return value
    .replace(/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i, "")
    .replace(/^Appendix\s+[A-Z](?:\.\d+)*\.?\s+/i, "")
    .trim();
}

function splitSentenceValues(value?: string | null) {
  const normalized = normalizeFinalExportText(value)?.trim();
  if (!normalized) return [];

  return uniqueItems(
    normalized
      .split(/\s*[,;]\s*/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function tableColumnIndexes(table: NonNullable<GeneratedSafetyPlanSection["table"]>) {
  const columns = table.columns.map((column) => normalizeToken(column));

  const findIndex = (...aliases: string[]) =>
    columns.findIndex((column) => aliases.some((alias) => column === normalizeToken(alias)));

  return {
    trade: findIndex("trade", "trade subtrade", "trade / subtrade"),
    subTrade: findIndex("subtrade", "sub-trade"),
    activity: findIndex("activity", "task", "task title"),
    hazards: findIndex("hazard", "hazards", "primary hazard", "main hazards"),
    controls: findIndex("control", "controls", "required controls"),
    ppe: findIndex("ppe", "required ppe"),
    permits: findIndex("permit", "permits", "required permits"),
    competency: findIndex("competency", "training", "training requirements"),
  };
}

function valueAt(row: string[], index: number) {
  return index >= 0 ? normalizeFinalExportText(row[index]) : null;
}

function joinSentenceList(values: string[]) {
  if (!values.length) return "";
  if (values.length === 1) return values[0]!;
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function formatActivityMatrixRow(
  table: NonNullable<GeneratedSafetyPlanSection["table"]>,
  row: string[]
) {
  const indexes = tableColumnIndexes(table);
  const hasActivityMatrixContent = [
    indexes.trade,
    indexes.subTrade,
    indexes.activity,
    indexes.hazards,
    indexes.controls,
    indexes.ppe,
    indexes.permits,
    indexes.competency,
  ].some((index) => index >= 0);

  if (!hasActivityMatrixContent) {
    return null;
  }

  const trade = valueAt(row, indexes.trade);
  const subTrade = valueAt(row, indexes.subTrade);
  const activity = valueAt(row, indexes.activity);
  const hazards = normalizeHazardList(splitSentenceValues(valueAt(row, indexes.hazards)));
  const controls = splitSentenceValues(valueAt(row, indexes.controls));
  const ppe = dedupePpeItemsForExport(splitSentenceValues(valueAt(row, indexes.ppe)));
  const permits = normalizePermitList(splitSentenceValues(valueAt(row, indexes.permits)));
  const competency = splitSentenceValues(valueAt(row, indexes.competency));

  const scope = joinDisplayValues([trade, subTrade], "");
  const sentences: string[] = [];

  if (activity && scope) {
    sentences.push(`${activity} for ${scope} involves ${joinSentenceList(hazards)}.`);
  } else if (activity && hazards.length) {
    sentences.push(`${activity} involves ${joinSentenceList(hazards)}.`);
  } else if (scope && hazards.length) {
    sentences.push(`${scope} work involves ${joinSentenceList(hazards)}.`);
  }

  if (controls.length) {
    sentences.push(`Required controls include ${joinSentenceList(controls)}.`);
  }

  if (ppe.length) {
    sentences.push(`Required PPE includes ${joinSentenceList(ppe)}.`);
  }

  if (permits.length) {
    sentences.push(`Required permits include ${joinSentenceList(permits)}.`);
  }

  if (competency.length) {
    sentences.push(`Required competency includes ${joinSentenceList(competency)}.`);
  }

  if (!sentences.length) {
    const fallback = normalizeFinalExportText(
      row.map((cell) => cell?.trim()).filter(Boolean).join(" ")
    );
    return fallback || null;
  }

  return sentences.join(" ");
}

function isTaskHazardStyleTable(table: NonNullable<GeneratedSafetyPlanSection["table"]>) {
  const indexes = tableColumnIndexes(table);
  return [
    indexes.trade,
    indexes.subTrade,
    indexes.activity,
    indexes.hazards,
    indexes.controls,
    indexes.ppe,
    indexes.permits,
  ].some((index) => index >= 0);
}

/**
 * Matrices and line-list tables should not produce a deep outline (e.g. 5.85.1, 5.85.2 for each row).
 */
function shouldUseOffsetTableRows(
  source: Pick<GeneratedSafetyPlanSection, "key" | "title" | "table">
): boolean {
  if (!source.table?.rows.length) return false;
  const key = normalizeToken(source.key ?? "");
  const title = normalizeToken(source.title ?? "");
  if (
    key.includes("activity_hazard") ||
    key.includes("task_hazard") ||
    (key.includes("matrix") && (key.includes("hazard") || key.includes("task") || key.includes("steel"))) ||
    (title.includes("hazard") && title.includes("matrix")) ||
    (title.includes("task") && title.includes("matrix")) ||
    (title.includes("steel") && title.includes("matrix")) ||
    title.includes("hazardcontrolmatrix") ||
    title.includes("activityhazard")
  ) {
    return true;
  }
  return isTaskHazardStyleTable(source.table);
}

function stripSourceNumberingLabel(value?: string | null) {
  const normalized = normalizeFinalExportText(value) ?? "";
  return stripExistingNumberPrefix(normalized);
}

function parseSourceNumberedItem(value?: string | null): ParsedSourceNumberedItem | null {
  const raw = value?.trim() ?? "";
  if (!/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i.test(raw)) {
    return null;
  }

  const withoutNumber = stripExistingNumberPrefix(raw);
  if (!withoutNumber) {
    return null;
  }

  const matched = withoutNumber.match(/^(.+?)(?:\s{2,}|:\s+)(.+)$/);
  if (!matched) {
    return null;
  }

  const [, rawTitle, rawBody] = matched;
  const title = stripSourceNumberingLabel(rawTitle);
  const body = normalizeFinalExportText(rawBody)?.trim() ?? "";
  if (!title || !body) {
    return null;
  }

  return { title, body };
}

function normalizeDisplayPrefix(value: string) {
  return value.endsWith(".0") ? value.slice(0, -2) : value;
}

function splitNarrativeSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function cleanRoleLabel(value: string) {
  return value
    .replace(/^role:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function subsectionHasContent(subsection: CsepTemplateSubsection) {
  return Boolean(
    subsection.paragraphs?.some((paragraph) => paragraph.trim()) ||
      subsection.items?.some((item) => item.trim()) ||
      subsection.table?.rows.some((row) => row.some((cell) => cell.trim()))
  );
}

function normalizeLeadingVisibleBlock(value?: string | null) {
  const cleaned = value?.trim();
  if (!cleaned) return null;

  const withoutLeadingPunctuation = cleaned.replace(/^[,;:]+\s*/, "");
  return withoutLeadingPunctuation.replace(/^([a-z])/, (match) => match.toUpperCase());
}

function normalizeSubsectionLead(subsection: CsepTemplateSubsection): CsepTemplateSubsection {
  const paragraphs = [...(subsection.paragraphs ?? [])];
  const items = [...(subsection.items ?? [])];

  if (paragraphs.length) {
    const normalized = normalizeLeadingVisibleBlock(paragraphs[0]);
    if (normalized) {
      paragraphs[0] = normalized;
    }
  } else if (items.length) {
    const normalized = normalizeLeadingVisibleBlock(items[0]);
    if (normalized) {
      items[0] = normalized;
    }
  }

  return {
    ...subsection,
    paragraphs: paragraphs.length ? uniqueItems(paragraphs) : subsection.paragraphs,
    items: items.length ? uniqueItems(items) : subsection.items,
  };
}

const GENERIC_SUBSECTION_TITLES = new Set(
  [
    "risk",
    "when it applies",
    "purpose",
    "hazard overview",
    "task scope and sequence",
    "program scope",
    "pre start verification",
    "required controls",
    "how controls are met and verified",
    "how controls are verified",
    "permits and ppe",
    "stop-work / hold-point triggers",
    "stop work hold point triggers",
    "stop-work triggers",
    "stop work triggers",
    "verification and handoff",
    "related interfaces",
    "applicable references",
    "references",
    "responsibilities and training",
    "minimum required controls",
    // Per-program procedure subsections produced by buildCsepProgramSection in
    // lib/csepPrograms.ts. Multiple programs can land in the same fixed
    // section (e.g. "Task Execution Modules"), so these generic titles must be
    // prefixed with their source program title to avoid duplicate headings
    // under a shared parent section.
    "pre task setup",
    "work execution",
    "stop work escalation",
    "post task closeout",
    "related tasks",
  ].map((value) => normalizeCompareToken(value))
);

function contextualizeSubsectionTitle(sourceTitle: string, subsectionTitle: string) {
  const cleanSourceTitle = stripExistingNumberPrefix(sourceTitle).trim();
  const cleanSubsectionTitle = stripExistingNumberPrefix(subsectionTitle).trim();
  if (!cleanSourceTitle || !cleanSubsectionTitle) {
    return subsectionTitle;
  }

  const normalizedSubsectionTitle = normalizeCompareToken(cleanSubsectionTitle);
  if (!GENERIC_SUBSECTION_TITLES.has(normalizedSubsectionTitle)) {
    return subsectionTitle;
  }

  if (normalizeCompareToken(cleanSourceTitle) === normalizedSubsectionTitle) {
    return subsectionTitle;
  }

  return `${cleanSourceTitle}: ${cleanSubsectionTitle}`;
}

function normalizeTemplateSection(section: CsepTemplateSection): CsepTemplateSection {
  return {
    ...section,
    subsections: section.subsections.map((subsection) => normalizeSubsectionLead(subsection)),
  };
}

function normalizeRenderModel(model: CsepRenderModel): CsepRenderModel {
  return {
    ...model,
    footerCompanyName: model.footerCompanyName?.trim() || "Safety360Docs",
    frontMatterSections: model.frontMatterSections.map((section) => normalizeTemplateSection(section)),
    sections: model.sections.map((section) => normalizeTemplateSection(section)),
    appendixSections: model.appendixSections.map((section) => normalizeTemplateSection(section)),
  };
}

function dedupeTemplateSubsections(subsections: CsepTemplateSubsection[]) {
  const seen = new Set<string>();

  return subsections
    .map((subsection) => normalizeSubsectionLead(subsection))
    .filter((subsection) => {
    const key = JSON.stringify({
      title: normalizeCompareToken(subsection.title),
      paragraphs: (subsection.paragraphs ?? []).map(normalizeCompareToken),
      items: (subsection.items ?? []).map(normalizeCompareToken),
      plainItemsStyle: subsection.plainItemsStyle ?? null,
      table: subsection.table
        ? {
            columns: subsection.table.columns.map(normalizeCompareToken),
            rows: subsection.table.rows.map((row) => row.map(normalizeCompareToken)),
          }
        : null,
      tableRowsStyle: subsection.tableRowsStyle ?? null,
    });

    if (seen.has(key)) return false;
    seen.add(key);
    return subsectionHasContent(subsection);
    });
}

// Strips sentences and bullet items that already appeared in a prior subsection
// of the same bucket. Prevents the sentence-level repeat validator from firing
// when multiple programs (e.g. two hazards routed to "Task Execution Modules")
// legitimately share common references, controls, or stop-work phrasing. The
// first occurrence wins; empty subsections are dropped.
function stripSharedContentAcrossSubsections(
  subsections: CsepTemplateSubsection[]
): CsepTemplateSubsection[] {
  const seen = new Set<string>();
  const result: CsepTemplateSubsection[] = [];

  for (const subsection of subsections) {
    const filteredParagraphs: string[] = [];
    for (const paragraph of subsection.paragraphs ?? []) {
      const sentences = splitNarrativeSentences(paragraph);
      const keptSentences: string[] = [];
      for (const sentence of sentences) {
        const normalized = normalizeCompareToken(sentence);
        if (!normalized) {
          keptSentences.push(sentence);
          continue;
        }
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        keptSentences.push(sentence);
      }
      const rebuilt = keptSentences.join(" ").trim();
      if (rebuilt) filteredParagraphs.push(rebuilt);
    }

    const filteredItems: string[] = [];
    for (const item of subsection.items ?? []) {
      const normalized = normalizeCompareToken(item);
      if (!normalized) {
        filteredItems.push(item);
        continue;
      }
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      filteredItems.push(item);
    }

    const next: CsepTemplateSubsection = {
      ...subsection,
      paragraphs: filteredParagraphs,
      items: filteredItems,
    };

    if (subsectionHasContent(next)) {
      result.push(next);
    }
  }

  return result;
}

function validateNoRepeatedSentences(section: CsepTemplateSection) {
  const seen = new Set<string>();

  for (const subsection of section.subsections) {
    const sentences = [
      ...(subsection.paragraphs ?? []).flatMap(splitNarrativeSentences),
      ...(subsection.items ?? []),
    ]
      .map(normalizeCompareToken)
      .filter(Boolean);

    for (const sentence of sentences) {
      if (seen.has(sentence)) {
        throw new Error(`CSEP export validation failed: repeated content detected in section ${section.title}.`);
      }
      seen.add(sentence);
    }
  }
}

type VisibleModelTextEntry = {
  label: string;
  value: string;
};

function collectVisibleModelText(model: CsepRenderModel): VisibleModelTextEntry[] {
  const visibleSections = [...model.frontMatterSections, ...model.sections, ...model.appendixSections];

  return [
    { label: "Project name", value: model.projectName },
    { label: "Contractor", value: model.contractorName },
    { label: "Trade", value: model.tradeLabel ?? "" },
    { label: "Sub-trade", value: model.subTradeLabel ?? "" },
    { label: "Issue date", value: model.issueLabel },
    { label: "Status", value: model.statusLabel },
    { label: "Prepared by", value: model.preparedBy },
    ...model.coverSubtitleLines.map((value, index) => ({
      label: `Cover subtitle ${index + 1}`,
      value,
    })),
    ...model.coverMetadataRows.map((row) => ({
      label: `Cover metadata: ${row.label}`,
      value: row.value,
    })),
    ...model.approvalLines.map((value, index) => ({
      label: `Approval line ${index + 1}`,
      value,
    })),
    ...model.revisionHistory.flatMap((row, index) => [
      { label: `Revision history ${index + 1}: revision`, value: row.revision },
      { label: `Revision history ${index + 1}: date`, value: row.date },
      { label: `Revision history ${index + 1}: description`, value: row.description },
      { label: `Revision history ${index + 1}: prepared by`, value: row.preparedBy },
      { label: `Revision history ${index + 1}: approved by`, value: row.approvedBy },
    ]),
    ...visibleSections.flatMap((section) => [
      { label: `Section title: ${section.key}`, value: section.title },
      { label: `Section number: ${section.key}`, value: section.numberLabel ?? "" },
      { label: `Section closing tagline: ${section.key}`, value: section.closingTagline ?? "" },
      ...section.subsections.flatMap((subsection, subsectionIndex) => [
        {
          label: `Subsection title: ${section.title} / ${subsectionIndex + 1}`,
          value: subsection.title,
        },
        ...(subsection.paragraphs ?? []).map((value, paragraphIndex) => ({
          label: `Subsection paragraph: ${section.title} / ${subsection.title || subsectionIndex + 1} / ${paragraphIndex + 1}`,
          value,
        })),
        ...(subsection.items ?? []).map((value, itemIndex) => ({
          label: `Subsection item: ${section.title} / ${subsection.title || subsectionIndex + 1} / ${itemIndex + 1}`,
          value,
        })),
        ...(subsection.table
          ? [
              ...subsection.table.columns.map((value, columnIndex) => ({
                label: `Subsection table column: ${section.title} / ${subsection.title || subsectionIndex + 1} / ${columnIndex + 1}`,
                value,
              })),
              ...subsection.table.rows.flatMap((row, rowIndex) =>
                row.map((value, columnIndex) => ({
                  label: `Subsection table cell: ${section.title} / ${subsection.title || subsectionIndex + 1} / row ${rowIndex + 1} col ${columnIndex + 1}`,
                  value,
                }))
              ),
            ]
          : []),
      ]),
    ]),
    ...model.disclaimerLines.map((value, index) => ({
      label: `Disclaimer line ${index + 1}`,
      value,
    })),
  ].filter((entry) => Boolean(entry.value));
}

function validateSectionOrdering(sections: CsepTemplateSection[]) {
  let priorNumbers: number[] | null = null;

  sections.forEach((section) => {
    const numberLabel = section.numberLabel?.trim() ?? "";
    if (!numberLabel) return;

    const parsed = normalizeDisplayPrefix(numberLabel)
      .split(".")
      .map((part) => Number.parseInt(part, 10))
      .filter((part) => Number.isFinite(part));

    if (!parsed.length) return;

    if (priorNumbers) {
      const maxLength = Math.max(priorNumbers.length, parsed.length);
      for (let index = 0; index < maxLength; index += 1) {
        const priorValue = priorNumbers[index] ?? 0;
        const currentValue = parsed[index] ?? 0;
        if (currentValue > priorValue) break;
        if (currentValue < priorValue) {
          throw new Error(
            `CSEP export validation failed: section numbering is out of order at ${section.title}.`
          );
        }
      }
    }

    priorNumbers = parsed;
  });
}

function resolveSectionNumberLabelForValidation(
  section: CsepTemplateSection,
  index: number
): string | null {
  if (section.numberLabel === null) {
    return null;
  }
  const trimmed = section.numberLabel?.trim() ?? "";
  if (trimmed) {
    return trimmed;
  }
  return String(index + 1);
}

function validateCsepRenderModel(model: CsepRenderModel) {
  const numberedSections = model.sections.map((section, index) => ({
    ...section,
    numberLabel: resolveSectionNumberLabelForValidation(section, index),
  }));
  const seenNumbers = new Set<string>();
  const invalidExactTokens = new Set([
    "test",
    "pending approval",
    "platform fill field",
    "fill",
    "safetydocs360 ai draft builder",
  ]);
  const placeholderPattern =
    /tbd by contractor before issue|company logo placement|insert contractor logo|page\s+of/i;
  const bannedInternalPhrasePattern =
    /Applicability \/ trigger logic|Included for this scope|Review these sections first|Interfaces to coordinate|selected program hazard|Use this module to align sequence, access, and handoffs with that work|primary exposure|secondary exposure|changing condition risk|task scope\s*&\s*work conditions|main exposure profile|program purpose and applicability/i;

  validateSectionOrdering(numberedSections);

  numberedSections.forEach((section) => {
    const numberLabel = section.numberLabel?.trim() ?? "";
    const isFlatProgramSection = usesFlatProgramOutline(section);
    if (!numberLabel) {
      // Unnumbered sections (explicit null numberLabel).
    } else if (seenNumbers.has(numberLabel)) {
      throw new Error(`CSEP export validation failed: duplicate section number ${numberLabel}.`);
    } else {
      seenNumbers.add(numberLabel);
    }

    const seenTitles = new Set<string>();
    section.subsections.forEach((subsection) => {
      const normalizedTitle = normalizeCompareToken(subsection.title);
      if (normalizedTitle) {
        if (!isFlatProgramSection && seenTitles.has(normalizedTitle)) {
          throw new Error(
            `CSEP export validation failed: duplicate subsection heading "${subsection.title}" under ${section.title}.`
          );
        }
        seenTitles.add(normalizedTitle);
      }

      if (!subsectionHasContent(subsection)) {
        throw new Error(
          `CSEP export validation failed: subsection "${subsection.title || section.title}" is empty.`
        );
      }

      const firstBlock = subsection.paragraphs?.[0] ?? subsection.items?.[0] ?? "";
      if (firstBlock && /^[a-z,;:]/.test(firstBlock.trim())) {
        throw new Error(
          `CSEP export validation failed: subsection "${subsection.title || section.title}" starts mid-sentence.`
        );
      }
    });

    if (!isFlatProgramSection) {
      validateNoRepeatedSentences(section);
    }
  });

  const visibleText = collectVisibleModelText(model);
  const placeholderEntry = visibleText.find((entry) => {
    const normalized = normalizeCompareToken(entry.value);
    return (
      invalidExactTokens.has(normalized) ||
      placeholderPattern.test(entry.value) ||
      bannedInternalPhrasePattern.test(entry.value)
    );
  });

  if (placeholderEntry) {
    const preview = placeholderEntry.value.replace(/\s+/g, " ").trim().slice(0, 120);
    const isInternalPhrase = bannedInternalPhrasePattern.test(placeholderEntry.value);
    throw new Error(
      isInternalPhrase
        ? `CSEP export validation failed: internal-only generation terminology remains in final export. Source: ${placeholderEntry.label} = "${preview}".`
        : `CSEP export validation failed: unresolved placeholder content remains in final export. Source: ${placeholderEntry.label} = "${preview}".`
    );
  }
}

function buildRoleAliases(value: string) {
  const cleanValue = cleanRoleLabel(value);
  if (!cleanValue) return [];

  const aliases = new Set<string>([cleanValue]);
  cleanValue
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      aliases.add(part);
      aliases.add(part.replace(/^cm\s+/i, "").trim());
      aliases.add(part.replace(/^project\s+/i, "").trim());
    });
  aliases.add(cleanValue.replace(/^cm\s+/i, "").trim());
  aliases.add(cleanValue.replace(/^project\s+/i, "").trim());

  return Array.from(aliases).filter(Boolean);
}

function buildRoleReplacementItems(source: GeneratedSafetyPlanSection) {
  if (source.key !== "roles_and_responsibilities") {
    return [];
  }

  const narrative = uniqueItems([
    ...splitParagraphs(source.summary),
    ...splitParagraphs(source.body),
  ]).join(" ");
  if (!narrative) {
    return [];
  }

  const defaultRoles = [
    "CM Project Manager",
    "Project Manager",
    "CM Project Superintendent",
    "Project Superintendent",
    "Superintendent",
    "Competent Person",
    "Foreman / Crew Lead",
    "Foreman",
    "Crew Lead",
    "Workers",
    "All site workers",
  ];
  const tableRoles = (source.table?.rows ?? [])
    .map((row) => cleanRoleLabel(row[0] ?? ""))
    .filter(Boolean);
  const roleAnchors = uniqueItems([...tableRoles, ...defaultRoles]).map((title) => ({
    title,
    aliases: buildRoleAliases(title),
  }));
  const matches: Array<{ start: number; end: number; title: string; matchedText: string }> = [];

  roleAnchors.forEach((anchor) => {
    anchor.aliases
      .sort((left, right) => right.length - left.length)
      .forEach((alias) => {
        const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "gi");
        let match = pattern.exec(narrative);
        while (match) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            title: anchor.title,
            matchedText: match[0],
          });
          match = pattern.exec(narrative);
        }
      });
  });

  const orderedMatches = matches
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .filter((match, index, collection) => {
      const previous = collection[index - 1];
      if (!previous) return true;
      return match.start >= previous.end;
    });

  if (orderedMatches.length < 2) {
    return [];
  }

  return orderedMatches
    .map((match, index) => {
      const nextStart = orderedMatches[index + 1]?.start ?? narrative.length;
      let chunk = narrative.slice(match.start, nextStart).trim();
      chunk = chunk.replace(new RegExp(`^${escapeRegExp(match.matchedText)}\\b[:\\-\\s]*`, "i"), "").trim();
      chunk = chunk.replace(/^(?:is\s+responsible\s+for|is\s+responsible\s+to|is|will|shall|must)\s+/i, "");

      const sentences = splitNarrativeSentences(chunk);
      const responsibilitySentences: string[] = [];
      const authoritySentences: string[] = [];

      sentences.forEach((sentence) => {
        if (
          /stop[-\s]?work|authority|hold point|approve|authorization|authorize|restart|do not release|release the crew|hold access/i.test(
            sentence
          )
        ) {
          authoritySentences.push(sentence);
          return;
        }
        responsibilitySentences.push(sentence);
      });

      const parts = [`Role: ${match.title}`];
      if (responsibilitySentences.length) {
        parts.push(`Core Responsibilities: ${responsibilitySentences.join(" ")}`);
      } else if (!authoritySentences.length && chunk) {
        parts.push(chunk);
      }
      if (authoritySentences.length) {
        parts.push(`Authority / Hold Point: ${authoritySentences.join(" ")}`);
      }

      return parts.join(" ").trim();
    })
    .filter(Boolean);
}

function buildRuleTableSubsections(
  source: GeneratedSafetyPlanSection
): CsepTemplateSubsection[] {
  if (!source.table?.rows.length) {
    return [];
  }

  const columns = source.table.columns.map(normalizeToken);
  if (!columns.includes("rule domain") || !columns.includes("rule text")) {
    return [];
  }

  const items = uniqueItems(
    source.table.rows
      .map((row) => {
        const ruleDomain = stripExistingNumberPrefix(cleanFinalText(row[0]) ?? "");
        const ruleText = cleanFinalText(row[1]) ?? "";
        return [ruleDomain, ruleText].filter(Boolean).join(": ").trim();
      })
      .filter(Boolean)
  );

  if (!items.length) {
    return [];
  }

  return [
    {
      title: normalizeToken(source.key) === "life_saving_rules" ? "Life-Saving Rules" : source.title,
      items,
      plainItemsStyle: "offset_lines",
    },
  ];
}

function buildTradeSummarySubsections(
  source: GeneratedSafetyPlanSection
): CsepTemplateSubsection[] | null {
  if (normalizeToken(source.key) !== "trade summary") {
    return null;
  }

  const paragraphs = uniqueItems([
    ...splitParagraphs(source.summary),
    ...splitParagraphs(source.body),
  ]);
  const items = uniqueItems(source.bullets ?? []);
  const table = source.table;

  if (!table?.rows.length) {
    return [
      {
        title: "Trade and hazard context",
        paragraphs,
        items,
      },
    ];
  }

  const columns = table.columns.map(normalizeToken);
  const tradeIndex = columns.findIndex((column) => column === "trade");
  const subTradeIndex = columns.findIndex((column) => column === "sub trade");
  const hazardIndex = columns.findIndex((column) => column === "hazards");
  const permitIndex = columns.findIndex((column) => column === "permits");

  const tradePackages = uniqueItems(
    table.rows.map((row) =>
      [row[tradeIndex] ?? "", row[subTradeIndex] ?? ""]
        .map((value) => cleanFinalText(value))
        .filter(Boolean)
        .join(" / ")
    )
  );
  const hazards = uniqueItems(
    table.rows.flatMap((row) =>
      (row[hazardIndex] ?? "")
        .split(/,\s*/)
        .map((value) => cleanFinalText(value))
    )
  );
  const permits = uniqueItems(
    table.rows.flatMap((row) =>
      (row[permitIndex] ?? "")
        .split(/,\s*/)
        .map((value) => cleanFinalText(value))
    )
  ).filter((value) => normalizeToken(value) !== "none");

  const synthesizedParagraph = normalizeFinalExportText(
    [
      tradePackages.length
        ? `Planning context for ${tradePackages.join(", ")}; use Scope Summary for the task list.`
        : null,
      hazards.length ? `Primary hazards include ${hazards.join(", ")}.` : null,
      permits.length ? `Anticipated permit triggers include ${permits.join(", ")}.` : null,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return [
    {
      title: "Trade and hazard context",
      paragraphs: uniqueItems([...paragraphs, synthesizedParagraph].filter(Boolean)),
      items,
    },
  ];
}

function sourceSearchText(section: GeneratedSafetyPlanSection) {
  return normalizeToken(
    [
      section.key,
      section.title,
      section.summary ?? "",
      section.body ?? "",
      ...(section.bullets ?? []),
      ...(section.subsections ?? []).flatMap((subsection) => [
        subsection.title,
        subsection.body ?? "",
        ...(subsection.bullets ?? []),
      ]),
      ...(section.table?.columns ?? []),
      ...(section.table?.rows.flat() ?? []),
    ].join(" ")
  );
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function isEnforcementSubsectionTitleForSplit(title: string) {
  return /\b(6\.4|enforcement\s+and\s+corrective)\b/i.test(title);
}

function isWorkAttireSubsectionTitleForSplit(title: string) {
  const t = title.toLowerCase();
  return /\b6\.1\b/.test(t) || /\bwork\s+attire\b/i.test(t);
}

function isPpeReferenceSubsectionTitleForSplit(title: string) {
  const t = title.toLowerCase();
  if (isWorkAttireSubsectionTitleForSplit(title)) return false;
  if (/^required\s+ppe$/i.test(title.trim())) return true;
  if (/\b6\.2\b/.test(t)) return true;
  if (/personal\s+protective(\s+equipment)?/.test(t)) return true;
  return /\bppe\b/.test(t) && /minimum|reference|6\.2|enforcement|supervision/.test(t);
}

function mergeGeneratedSafetyPlanSections(group: GeneratedSafetyPlanSection[]): GeneratedSafetyPlanSection {
  const [first, ...rest] = group;
  if (!first) {
    throw new Error("mergeGeneratedSafetyPlanSections: empty group");
  }
  if (!rest.length) return first;
  const allSubs = group.flatMap((s) => s.subsections ?? []);
  const nk = normalizeToken(first.key ?? "");
  const allBulletSources =
    nk === "required ppe"
      ? group.flatMap((s) => [
          ...(s.bullets ?? []),
          ...(s.subsections ?? []).flatMap((sub) => sub.bullets ?? []),
        ])
      : group.flatMap((s) => s.bullets ?? []);
  const allBullets = uniqueItems(allBulletSources);
  const summaryParts = group.map((s) => s.summary).filter((v): v is string => Boolean(v?.trim()));
  const bodyParts = group.map((s) => s.body).filter((v): v is string => Boolean(v?.trim()));
  const mergedBullets =
    nk === "required ppe"
      ? buildCsepPpeSectionBulletsFromCombined(
          dedupePpeItemsForExport(flattenPpeSectionBulletsToItems(allBullets))
        )
      : allBullets;
  const mergedSubsections = nk === "required ppe" ? undefined : allSubs;
  return {
    ...first,
    summary: summaryParts.length ? summaryParts.join("\n\n") : first.summary,
    body: bodyParts.length ? bodyParts.join("\n\n") : first.body,
    bullets: mergedBullets.length ? mergedBullets : first.bullets,
    subsections: mergedSubsections?.length ? mergedSubsections : first.subsections,
  };
}

/**
 * Splits the assembled `contractor_iipp` block so work attire, PPE, and enforcement
 * become stand-alone sections (work attire and PPE are not co-mingled in Hazards
 * narrative), then merges duplicate `required_ppe` / `enforcement` sources.
 */
function expandCsepSourceSectionsForFixedLayout(
  sourceSections: GeneratedSafetyPlanSection[]
): GeneratedSafetyPlanSection[] {
  const expanded: GeneratedSafetyPlanSection[] = [];

  for (const section of sourceSections) {
    const k = normalizeToken(section.key ?? "");
    if (k !== "contractor iipp") {
      expanded.push(section);
      continue;
    }
    const subs = section.subsections ?? [];
    if (subs.length === 0) {
      expanded.push(section);
      continue;
    }

    const workAttire: NonNullable<GeneratedSafetyPlanSection["subsections"]> = [];
    const ppe: NonNullable<GeneratedSafetyPlanSection["subsections"]> = [];
    const enforcement: NonNullable<GeneratedSafetyPlanSection["subsections"]> = [];
    const iipp: NonNullable<GeneratedSafetyPlanSection["subsections"]> = [];
    for (const sub of subs) {
      const title = sub.title ?? "";
      if (isEnforcementSubsectionTitleForSplit(title)) enforcement.push(sub);
      else if (isWorkAttireSubsectionTitleForSplit(title)) workAttire.push(sub);
      else if (isPpeReferenceSubsectionTitleForSplit(title)) ppe.push(sub);
      else iipp.push(sub);
    }

    if (workAttire.length) {
      expanded.push({
        ...section,
        key: "work_attire_requirements",
        title: "Work Attire Requirements",
        summary: undefined,
        body: undefined,
        bullets: undefined,
        table: null,
        subsections: workAttire,
      });
    }
    if (ppe.length) {
      expanded.push({
        ...section,
        key: "required_ppe",
        title: "Required PPE",
        summary: undefined,
        body: undefined,
        bullets: undefined,
        table: null,
        subsections: ppe,
      });
    }
    if (enforcement.length) {
      expanded.push({
        ...section,
        key: "enforcement_and_corrective_action",
        title: "Enforcement and Corrective Action",
        summary: undefined,
        body: undefined,
        bullets: undefined,
        table: null,
        subsections: enforcement,
      });
    }
    expanded.push({
      ...section,
      subsections: iipp.length ? iipp : undefined,
    });
  }

  const MERGE_KEYS = new Set([
    "required ppe",
    "enforcement and corrective action",
  ]);
  const others: GeneratedSafetyPlanSection[] = [];
  const buckets = new Map<string, GeneratedSafetyPlanSection[]>();
  for (const s of expanded) {
    const nk = normalizeToken(s.key ?? "");
    if (MERGE_KEYS.has(nk)) {
      if (!buckets.has(nk)) buckets.set(nk, []);
      buckets.get(nk)!.push(s);
    } else {
      others.push(s);
    }
  }
  const mergedFromBuckets = Array.from(buckets.values()).map((g) => mergeGeneratedSafetyPlanSections(g));
  return [...others, ...mergedFromBuckets];
}

function mapSourceSectionToFixedSection(section: GeneratedSafetyPlanSection) {
  const keyTitle = normalizeToken(`${section.key} ${section.title}`);
  const combined = sourceSearchText(section);
  const keyNorm = normalizeToken(section.key ?? "");
  const fixedKey = FIXED_SECTION_DEFINITIONS.find((definition) => normalizeToken(definition.key) === keyNorm);
  if (fixedKey) return fixedKey.key;
  if (keyNorm.startsWith("program ")) {
    return "hazard_control_modules";
  }

  // --- 1) Explicit key routing (highest priority; avoids keyword bleed) ---
  // `normalizeToken` maps underscores to spaces — keys must match that form.
  const SCOPE_SOURCE_KEYS = new Set([
    "project information",
    "contractor information",
    "trade summary",
    "scope of work",
    "site specific notes",
    "project scope and trade specific activities",
  ]);
  if (SCOPE_SOURCE_KEYS.has(keyNorm)) {
    return keyNorm === "project information" || keyNorm === "contractor information"
      ? "project_and_contractor_information"
      : "scope_of_work_section";
  }
  if (keyNorm === "common overlapping trades") {
    return "trade_interaction_and_coordination";
  }
  if (keyNorm === "roles and responsibilities" || keyNorm === "roles_and_responsibilities") {
    return "roles_and_responsibilities";
  }
  if (keyNorm === "security and access" || keyNorm === "security and access control") {
    return "site_access_security_laydown_traffic_control";
  }
  if (keyNorm === "hazard communication" || keyNorm === "hazard communication program" || keyNorm === "hazcom program") {
    return "hazard_communication_and_environmental_protection";
  }
  if (keyNorm === "enforcement and corrective action") {
    return "iipp_incident_reporting_corrective_action";
  }
  if (keyNorm === "work attire requirements" || keyNorm === "work_attire_requirements") {
    return "ppe_and_work_attire";
  }
  if (keyNorm === "required ppe" || keyNorm === "personal protective equipment") {
    return "ppe_and_work_attire";
  }
  if (keyNorm === "union" || keyNorm === "union requirements" || keyNorm === "labor provisions") {
    return "worker_conduct_fit_for_duty_disciplinary_program";
  }
  if (
    keyNorm === "company overview" ||
    keyNorm === "company overview and safety philosophy" ||
    keyNorm === "message from owner" ||
    keyNorm === "owner message"
  ) {
    return "owner_message";
  }
  if (
    keyNorm === "contractor iipp" ||
    keyNorm === "emergency procedures" ||
    keyNorm === "emergency preparedness and response" ||
    keyNorm === "health and wellness" ||
    keyNorm === "incident reporting and investigation" ||
    keyNorm === "training and instruction" ||
    keyNorm === "drug and alcohol testing" ||
    keyNorm === "drug and alcohol" ||
    keyNorm === "recordkeeping" ||
    keyNorm === "continuous improvement" ||
    keyNorm === "project close out" ||
    keyNorm === "contractor monitoring audits and reporting" ||
    keyNorm === "checklists and inspections" ||
    keyNorm === "contractor safety meetings and engagement"
  ) {
    if (
      keyNorm === "recordkeeping" ||
      keyNorm === "training and instruction" ||
      keyNorm === "checklists and inspections" ||
      keyNorm === "contractor monitoring audits and reporting"
    ) {
      return keyNorm === "training and instruction" ? "training_competency_and_certifications" : "inspections_audits_and_records";
    }
    if (keyNorm === "continuous improvement" || keyNorm === "project close out") {
      return "project_closeout";
    }
    if (keyNorm === "emergency procedures" || keyNorm === "emergency preparedness and response") return "emergency_response_and_rescue";
    if (keyNorm === "health and wellness" || keyNorm === "drug and alcohol testing" || keyNorm === "drug and alcohol") return "worker_conduct_fit_for_duty_disciplinary_program";
    return "iipp_incident_reporting_corrective_action";
  }
  if (keyNorm === "sub tier contractor management" || keyNorm === "permits and forms") {
    return keyNorm === "permits and forms" ? "required_permits_and_hold_points" : "trade_interaction_and_coordination";
  }
  if (
    keyNorm === "weather requirements and severe weather response" ||
    keyNorm === "environmental execution requirements" ||
    keyNorm === "regulatory framework" ||
    keyNorm === "safe work practices and trade specific procedures" ||
    keyNorm === "hse elements and site specific hazard analysis" ||
    keyNorm === "appendices and support library" ||
    keyNorm === "weather"
  ) {
    if (keyNorm === "regulatory framework") return "regulatory_basis_and_references";
    if (keyNorm === "environmental execution requirements") return "hazard_communication_and_environmental_protection";
    if (keyNorm === "weather requirements and severe weather response" || keyNorm === "weather") return "emergency_response_and_rescue";
    return "hazard_control_modules";
  }

  if (
    includesAny(keyTitle, [
      "task module",
      "hazard module",
      "activity hazard",
      "task hazard",
      "safe work",
      "required ppe",
      "additional permits",
      "selected hazards",
      "jsa",
      "fall protection",
      "hot work",
      "lockout",
      "electrical",
      "compressed gas",
      "ladders",
      "housekeeping",
      "fire prevention",
      "barricade",
      "ppe",
      "permit",
      "rescue",
    ])
  ) {
    if (includesAny(keyTitle, ["task module", "activity hazard", "task hazard", "jsa"])) return "task_execution_modules";
    if (includesAny(keyTitle, ["required ppe", "ppe"])) return "ppe_and_work_attire";
    if (includesAny(keyTitle, ["additional permits", "permit"])) return "required_permits_and_hold_points";
    if (includesAny(keyTitle, ["rescue"])) return "emergency_response_and_rescue";
    return "hazard_control_modules";
  }

  if (includesAny(combined, ["table of contents", " index "])) {
    return "table_of_contents";
  }

  if (
    includesAny(combined, [
      "owner message",
      "message from owner",
      "policy statement",
      "safety philosophy",
      "leadership commitment",
      "company overview",
    ])
  ) {
    return "owner_message";
  }

  if (includesAny(combined, ["purpose", "how to use this plan", "plan use guidance"])) {
    return "purpose";
  }

  if (
    includesAny(keyTitle, [
      "project information",
      "contractor information",
      "project overview",
      "project site information",
      "trade summary",
      "scope of work",
      "scope summary",
      "project scope",
      "site specific notes",
      "site specific note",
      "project specific notes",
    ])
  ) {
    return includesAny(keyTitle, ["project information", "contractor information"])
      ? "project_and_contractor_information"
      : "scope_of_work_section";
  }

  if (
    includesAny(combined, [
      "top 10",
      "top ten",
      "selected hazards",
      "risk summary",
      "highest exposure",
      "highest risk",
      "life saving rules",
    ])
  ) {
    return "top_10_critical_risks";
  }

  if (
    includesAny(combined, [
      "overlapping trades",
      "trade conflict",
      "trade interaction",
      "shared area",
      "shared work area",
      "sequencing",
      "handoff",
      "related interfaces",
      "coordination",
    ])
  ) {
    return "trade_interaction_and_coordination";
  }

  if (includesAny(combined, ["roles and responsibilities", "roles & responsibilities", "safety roles and responsibilities"])) {
    return "roles_and_responsibilities";
  }

  if (
    includesAny(combined, [
      "incident reporting",
      "incident investigation",
      "injury",
      "illness",
      "near miss",
      "hazard reporting",
      "emergency response",
      "emergency procedures",
      "medical response",
      "return to work",
      "health and wellness",
      "drug",
      "alcohol",
      "fit for duty",
      "inspection",
      "recordkeeping",
      "continuous improvement",
      "training and instruction",
    ])
  ) {
    if (includesAny(combined, ["recordkeeping", "training and instruction", "inspection", "monitoring", "audit"])) {
      return includesAny(combined, ["training and instruction"])
        ? "training_competency_and_certifications"
        : "inspections_audits_and_records";
    }
    if (includesAny(combined, ["continuous improvement", "close out", "close-out", "lessons learned", "project close out"])) {
      return "project_closeout";
    }
    if (includesAny(combined, ["emergency response", "emergency procedures", "medical response"])) return "emergency_response_and_rescue";
    if (includesAny(combined, ["health and wellness", "drug", "alcohol", "fit for duty"])) return "worker_conduct_fit_for_duty_disciplinary_program";
    return "iipp_incident_reporting_corrective_action";
  }

  if (
    includesAny(combined, [
      "disciplinary",
      "discipline",
      "enforcement program",
      "enforcement action",
      "unsafe act",
      "removal from site",
    ]) ||
    (includesAny(combined, ["enforcement", "corrective action"]) && !includesAny(combined, ["chemical", "hazcom", "hazard communication", "sds"]))
  ) {
    return "worker_conduct_fit_for_duty_disciplinary_program";
  }

  if (includesAny(combined, ["union", "collective bargaining", "cba ", "labor agreement"]) || keyTitle.includes("union")) {
    return "worker_conduct_fit_for_duty_disciplinary_program";
  }

  if (
    includesAny(combined, [
      "security and access",
      "access control",
      "site entry",
      "worker access",
      "visitor",
      "visitor escort",
      "delivery",
      "truck route",
      "laydown",
      "traffic control",
      "unloading",
      "contraband",
      "weapon",
      "restricted area",
      "restricted item",
      "site security",
    ])
  ) {
    if (!includesAny(combined, ["it security", "data security", "chemical security", "cyber security"])) {
      return "site_access_security_laydown_traffic_control";
    }
  }

  if (
    includesAny(combined, [
      "hazcom",
      "hazard communication",
      "sds",
      "safety data sheet",
      "portable container",
      "ghs",
      "nfpa",
    ]) ||
    (includesAny(combined, ["label", "chemical", "msds"]) && !includesAny(combined, ["price label", "package label for shipping"]))
  ) {
    return "hazard_communication_and_environmental_protection";
  }

  return "hazard_control_modules";
}

function toTemplateSubsections(source: GeneratedSafetyPlanSection): CsepTemplateSubsection[] {
  const subsections: CsepTemplateSubsection[] = [];
  const tradeSummarySubsections = buildTradeSummarySubsections(source);
  if (tradeSummarySubsections) {
    return dedupeTemplateSubsections(tradeSummarySubsections);
  }
  const ruleTableSubsections = buildRuleTableSubsections(source);
  if (ruleTableSubsections.length) {
    return dedupeTemplateSubsections(ruleTableSubsections);
  }
  const roleReplacementItems = buildRoleReplacementItems(source);
  if (roleReplacementItems.length) {
    subsections.push({
      title: "",
      items: roleReplacementItems,
    });

    (source.subsections ?? []).forEach((subsection) => {
      subsections.push({
        title: contextualizeSubsectionTitle(source.title, subsection.title),
        paragraphs: expandParagraphsForDocxReadability(uniqueItems(splitParagraphs(subsection.body))),
        items: uniqueItems(subsection.bullets),
      });
    });

    return dedupeTemplateSubsections(subsections);
  }

  const leadingParagraphs = uniqueItems([
    ...splitParagraphs(source.summary),
    ...splitParagraphs(source.body),
  ]);
  const splitLeading = splitInlineEnumeratedParagraphs(leadingParagraphs);
  const leadingItems = uniqueItems(source.bullets ?? []);
  const shouldFoldLeadingParagraphsIntoItems =
    source.kind === "main" &&
    Boolean((source.subsections ?? []).length || source.table?.rows.length);
  const formattedLeadingParagraphItems = shouldFoldLeadingParagraphsIntoItems
    ? splitLeading.paragraphs
    : [];
  const leadingNarrativeParagraphs = shouldFoldLeadingParagraphsIntoItems
    ? []
    : splitLeading.paragraphs;
  const initialItems = uniqueItems([
    ...formattedLeadingParagraphItems,
    ...splitLeading.items,
    ...leadingItems,
  ]);

  // When a source has structured subsections (e.g. program blocks with
  // "When It Applies", "Responsibilities and Training", ...), always render a
  // parent heading with the source title so the first subsection is not left
  // floating as an untitled intro paragraph directly above "When It Applies".
  //
  // Additionally, whenever the source contributes standalone narrative
  // paragraphs, a leading table, or its own pre-extracted numbered items, the
  // leading block MUST carry the source title so the renderer emits a labeled
  // parent subheading. Without this, long standalone paragraphs (common in
  // Sections 6 / 8 / 9 — High-Risk Work Programs, Training & Recordkeeping,
  // and Close-Out — where several narrative-only sources land in the same
  // fixed bucket) would render as orphan body text between numbered items
  // with no clear parent heading above them.
  const hasStructuredSubsections = Boolean((source.subsections ?? []).length);
  const hasOrphanableLeadingContent =
    leadingNarrativeParagraphs.length > 0 ||
    initialItems.length > 0 ||
    Boolean(source.table?.rows.length);
  const parentHeadingTitle =
    hasStructuredSubsections || hasOrphanableLeadingContent
      ? source.title ?? ""
      : "";

  if (
    leadingNarrativeParagraphs.length ||
    initialItems.length ||
    source.table?.rows.length ||
    parentHeadingTitle
  ) {
    const mapsToTopRisks =
      mapSourceSectionToFixedSection(source) === "top_10_critical_risks" ||
      /^top[_\s-]*(10|ten)\s*risks?$/i.test(normalizeToken(source.key)) ||
      /^top[_\s-]*(10|ten)\s*risks?$/i.test(normalizeToken(source.title));
    const listLikeKeyNorms = new Set([
      "additional permits",
      "selected hazards",
      "common overlapping trades",
    ]);
    const key = normalizeToken(source.key ?? "");
    const plainListLineItems = listLikeKeyNorms.has(key);
    const plainItemsStyle: CsepTemplateSubsection["plainItemsStyle"] =
      initialItems.length > 0 &&
      (source.key === "scope_of_work" || mapsToTopRisks || plainListLineItems)
        ? "offset_lines"
        : undefined;
    const tableRowsStyle: CsepTemplateSubsection["tableRowsStyle"] = shouldUseOffsetTableRows(source)
      ? "offset_lines"
      : undefined;
    subsections.push({
      title: parentHeadingTitle,
      paragraphs: expandParagraphsForDocxReadability(leadingNarrativeParagraphs),
      items: initialItems,
      table: source.table ?? null,
      plainItemsStyle,
      tableRowsStyle,
    });
  }

  (source.subsections ?? []).forEach((subsection) => {
    const splitSubsectionParagraphs = splitInlineEnumeratedParagraphs(
      uniqueItems(splitParagraphs(subsection.body))
    );
    const splitBullets = uniqueItems(subsection.bullets).flatMap((item) =>
      splitParagraphAtEstimatedDocxLineCount(item, { maxLines: 6 })
    );
    subsections.push({
      title: contextualizeSubsectionTitle(source.title, subsection.title),
      paragraphs: expandParagraphsForDocxReadability(splitSubsectionParagraphs.paragraphs),
      items: uniqueItems([...splitSubsectionParagraphs.items, ...splitBullets]),
    });
  });

  return subsections.length ? dedupeTemplateSubsections(subsections) : [];
}

export function toTemplateSection(source: GeneratedSafetyPlanSection): CsepTemplateSection {
  return {
    key: source.key,
    title: source.title,
    kind: source.kind ?? undefined,
    numberLabel: source.numberLabel ?? undefined,
    subsections: toTemplateSubsections(source),
    closingTagline: null,
  };
}

export function buildCsepTemplateSections(
  params: BuildCsepTemplateSectionsParams
): CsepTemplateSection[] {
  const grouped = new Map<string, CsepTemplateSubsection[]>();

  const preparedSources = expandCsepSourceSectionsForFixedLayout(params.sourceSections);
  const eligibleSections = preparedSources.filter(
    (section) => section.kind !== "front_matter" && section.kind !== "appendix"
  );

  // Dedupe source sections by stable key/title before grouping so that
  // two source sections sharing the same key or normalized title do not
  // produce duplicate headings or duplicate content blocks in the same
  // grouped bucket.
  const dedupedSources: GeneratedSafetyPlanSection[] = [];
  const seenSourceSignatures = new Set<string>();
  eligibleSections.forEach((section) => {
    const normalizedKey = normalizeToken(section.key);
    const normalizedTitle = normalizeToken(section.title);
    const signature = normalizedKey || normalizedTitle;
    if (!signature) return;
    // Exclude the raw task/hazard/control matrix from the main narrative body;
    // it is rendered as an appendix table instead.
    if (
      normalizedKey.includes("activity hazard matrix") ||
      normalizedKey.includes("task hazard control matrix") ||
      normalizedTitle.includes("activity hazard matrix") ||
      normalizedTitle.includes("task hazard control matrix")
    ) {
      return;
    }
    if (seenSourceSignatures.has(signature)) return;
    seenSourceSignatures.add(signature);
    dedupedSources.push(section);
  });

  dedupedSources.forEach((section) => {
    if (normalizeToken(section.key ?? "") === "project information") return;
    const mappedKey = mapSourceSectionToFixedSection(section);
    if (!mappedKey) return;
    const existing = grouped.get(mappedKey) ?? [];
    const subsections = toTemplateSubsections(section);
    existing.push(...subsections);
    grouped.set(mappedKey, existing);
  });

  return FIXED_SECTION_DEFINITIONS.map((definition) => ({
    key: definition.key,
    title: definition.title,
    descriptor: definition.descriptor,
    kind: definition.kind,
    subsections: buildSectionSubsections(definition, grouped, {
      draft: params.draft ?? createEmptyDraftContext(),
      projectName: params.projectName,
      contractorName: params.contractorName,
      tradeLabel: params.tradeLabel ?? "N/A",
      subTradeLabel: params.subTradeLabel ?? "N/A",
      taskTitles: params.taskTitles ?? [],
    }),
    closingTagline: null,
  }));
}

const REQUIRED_COVER_METADATA_ROW_LABELS = new Set(["Project Name", "Project Address", "Contractor", "Date"]);

function meaningfulFieldRows(rows: CsepCoverMetadataRow[]) {
  return rows.filter(
    (row) => REQUIRED_COVER_METADATA_ROW_LABELS.has(row.label) || normalizeCompareToken(row.value) !== "n a"
  );
}

function hasMeaningfulSubsections(subsections: CsepTemplateSubsection[]) {
  return subsections.some((subsection) => subsectionHasContent(subsection));
}

const DEFAULT_CSEP_COVER_LOGO_RELATIVE = ["public", "brand", "safety360docs-logo-crop.png"] as const;

function readDefaultCoverLogoFile(): CsepRenderModel["coverLogo"] {
  try {
    const abs = join(
      /* turbopackIgnore: true */ process.cwd(),
      ...DEFAULT_CSEP_COVER_LOGO_RELATIVE
    );
    if (!existsSync(abs)) {
      return null;
    }
    return { data: readFileSync(abs), type: "png" };
  } catch {
    return null;
  }
}

function getOptionalCoverLogo(
  draft: GeneratedSafetyPlanDraft
): CsepRenderModel["coverLogo"] {
  const builderSnapshot =
    draft.builderSnapshot && typeof draft.builderSnapshot === "object"
      ? (draft.builderSnapshot as Record<string, unknown>)
      : null;
  const rawDataUrl =
    builderSnapshot && typeof builderSnapshot.company_logo_data_url === "string"
      ? builderSnapshot.company_logo_data_url.trim()
      : "";

  if (!rawDataUrl.startsWith("data:image/")) {
    return readDefaultCoverLogoFile();
  }

  const match = rawDataUrl.match(/^data:image\/([a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) {
    return readDefaultCoverLogoFile();
  }

  const mimeSubtype = match[1].toLowerCase();
  const base64Payload = match[2];
  const type =
    mimeSubtype === "jpeg"
      ? "jpg"
      : mimeSubtype === "jpg" || mimeSubtype === "png" || mimeSubtype === "gif" || mimeSubtype === "bmp"
        ? mimeSubtype
        : null;

  if (!type) {
    return readDefaultCoverLogoFile();
  }

  try {
    return {
      data: Uint8Array.from(Buffer.from(base64Payload, "base64")),
      type,
    };
  } catch {
    return readDefaultCoverLogoFile();
  }
}

function createEmptyDraftContext(): GeneratedSafetyPlanDraft {
  return {
    documentType: "csep",
    projectDeliveryType: "ground_up",
    title: "",
    projectOverview: {
      projectName: "",
      projectNumber: "",
      projectAddress: "",
      ownerClient: "",
      gcCm: [],
      contractorCompany: "",
      location: "",
      schedule: "",
    },
    operations: [],
    ruleSummary: {
      permitTriggers: [],
      ppeRequirements: [],
      requiredControls: [],
      hazardCategories: [],
      siteRestrictions: [],
      prohibitedEquipment: [],
      trainingRequirements: [],
      weatherRestrictions: [],
    },
    conflictSummary: {
      total: 0,
      intraDocument: 0,
      external: 0,
      highestSeverity: "none",
      items: [],
    },
    riskSummary: {
      score: 0,
      band: "low",
      priorities: [],
    },
    trainingProgram: {
      rows: [],
      summaryTrainingTitles: [],
    },
    narrativeSections: {
      safetyNarrative: "",
    },
    sectionMap: [],
    provenance: {
      generator: "renderer-fallback",
    },
  };
}

function placeholderParagraphForSection(sectionKey: string) {
  switch (sectionKey) {
    case "top_10_critical_risks":
      return "Project-specific information to be completed.";
    case "trade_interaction_and_coordination":
      return "Project-specific coordination, overlap, access, and handoff information to be completed.";
    case "site_access_security_laydown_traffic_control":
      return "Project-specific information to be completed.";
    case "iipp_incident_reporting_corrective_action":
      return "Project-specific information to be completed.";
    case "training_competency_and_certifications":
      return "Project-specific training, inspection, monitoring, and recordkeeping requirements to be completed.";
    case "project_closeout":
      return "Project-specific close-out and lessons learned requirements to be completed.";
    default:
      return "Project-specific information to be completed.";
  }
}

function synthesizeWorkAttireSubsections(): CsepTemplateSubsection[] {
  return [
    {
      title: "Work Attire Requirements",
      paragraphs: [CSEP_WORK_ATTIRE_SUBSECTION_BODY],
      items: [...CSEP_WORK_ATTIRE_DEFAULT_BULLETS],
    },
  ];
}

function synthesizeTrainingInspectionsMonitoringRecordkeepingSubsections(): CsepTemplateSubsection[] {
  return [
    {
      title: "Training and Competency",
      paragraphs: [
        "Define role-appropriate training and competency verification before work starts and when task conditions change.",
      ],
      items: [
        "For lifting activities, verify lift plan / pick plan communication and crane permit responsibilities before execution.",
      ],
    },
    {
      title: "Inspections and Monitoring",
      paragraphs: [
        "Set inspection cadence, responsible persons, and field monitoring expectations for active work areas and critical controls.",
      ],
    },
    {
      title: "Recordkeeping",
      paragraphs: [
        "Maintain training, inspection, corrective action, and verification records in a review-ready format for project and client requirements.",
      ],
    },
  ];
}

function synthesizeCloseOutLessonsLearnedSubsections(): CsepTemplateSubsection[] {
  return [
    {
      title: "Close-Out and Lessons Learned",
      paragraphs: [
        "At phase or project close-out, capture lessons learned, unresolved risks, and carry-forward actions to improve future planning and execution.",
      ],
    },
  ];
}

const HIGH_RISK_STEEL_PROGRAMS = [
  "Leading Edge and Connector Work Program",
  "Fall Rescue and Suspension Trauma Program",
  "Controlled Decking Zone and Decking Access Program",
  "Hoisting and Rigging Program",
  "Multiple Lift Rigging Program",
  "Structural Stability and Temporary Bracing Program",
  "Column Anchorage and Initial Connection Program",
  "Open Web Joist and Bridging Program",
  "Falling Objects and Drop Zone Control Program",
  "Weather, Wind, Lightning and Site Condition Program",
];

const HAZARD_CONTROL_MODULES = [
  "Fall Exposure",
  "Struck-By / Load Path / Swing Radius",
  "Caught-In / Pinch Points",
  "Crane, Rigging, and Suspended Loads",
  "Structural Instability / Collapse",
  "Column Anchorage",
  "Open Web Joists and Bridging",
  "Falling Objects / Dropped Materials",
  "Hot Work / Welding / Cutting",
  "Fire Prevention",
  "Fumes / Ventilation",
  "Electrical / Temporary Power",
  "Mobile Equipment / Pedestrian Interface",
  "Weather / Wind / Lightning",
  "Heat / Cold Stress",
  "Housekeeping / Slip, Trip, Fall",
  "PPE Hazard Controls",
];

const TASK_EXECUTION_MODULES = [
  "Receiving, Unloading, Inspecting, and Staging Steel",
  "Sorting Members / Shakeout",
  "Rigging and Crane Picks",
  "Column Erection",
  "Beam and Girder Setting",
  "Initial Connections",
  "Plumbing, Temporary Bracing, and Final Bolting",
  "Field Welding, Cutting, and Shear Connectors",
  "Metal Decking Installation",
  "Opening and Perimeter Protection During Decking",
  "Embeds / Plates / Miscellaneous Metals",
  "Punch List / Detail Work",
  "Touch-Up Painting / Coatings",
];

function synthesizeNamedModuleSubsections(names: readonly string[], fallback: string): CsepTemplateSubsection[] {
  return names.map((title) => ({
    title,
    paragraphs: [`${title}: ${fallback}`],
  }));
}

function synthesizeRegulatoryReferenceSubsections(): CsepTemplateSubsection[] {
  return [
    {
      title: "OSHA / CFR Reference List",
      table: {
        columns: ["Reference", "Citation"],
        rows: CSEP_REGULATORY_REFERENCE_INDEX.map((entry) => [entry.code, entry.citation]),
      },
    },
  ];
}

function synthesizeOwnerMessageSubsections(
  projectName: string,
  contractorName: string,
  options?: { steelErection?: boolean }
): CsepTemplateSubsection[] {
  const ownerLabel = contractorName !== "N/A" ? contractorName : "Project leadership";
  const projectLabel = projectName !== "N/A" ? projectName : "this project";
  const baseSecond =
    "Every supervisor and worker is expected to stop work when conditions change, communicate hazards early, and follow this CSEP before proceeding.";
  const steelSecond =
    "For structural steel and decking, do not advance picks, landings, or connection releases when fit-up, temporary bracing, or fall protection no longer match the approved erection and rigging plan; reset controls before the next load moves.";
  return [
    {
      title: "Owner Message",
      paragraphs: [
        `${ownerLabel} expects all work on ${projectLabel} to be planned, coordinated, and executed without injury, property damage, or uncontrolled environmental impact.`,
        options?.steelErection ? `${baseSecond} ${steelSecond}` : baseSecond,
      ],
    },
  ];
}

function synthesizeSignOffSubsections(): CsepTemplateSubsection[] {
  return [
    {
      title: "Sign-Off Requirements",
      paragraphs: [
        "The signatures below confirm that this CSEP has been reviewed against the project scope, site rules, and applicable regulatory requirements prior to field use.",
        "Issue this plan only after the responsible project and contractor representatives have completed the required sign-off.",
      ],
    },
  ];
}

function synthesizePurposeSubsections(
  projectName: string,
  options?: { steelErection?: boolean }
): CsepTemplateSubsection[] {
  const projectLabel = projectName !== "N/A" ? projectName : "this project";
  const second = options?.steelErection
    ? "It aligns field execution, coordination, and hazard controls so crews can perform assigned work in a consistent and reviewable manner, with structural steel and decking tied to pre-planned picks, connection sequencing, and verified stability before workers rely on the frame or deck for support."
    : "It aligns field execution, coordination, and hazard controls so crews can perform assigned work in a consistent and reviewable manner.";
  return [
    {
      title: "Purpose",
      paragraphs: [
        `This CSEP establishes the project-specific safety and environmental requirements that govern work on ${projectLabel}.`,
        second,
      ],
    },
  ];
}

function isStructuralSteelOrDeckingScope(
  draft: GeneratedSafetyPlanDraft,
  tradeLabel: string,
  subTradeLabel: string
) {
  const hay = [
    tradeLabel,
    subTradeLabel,
    ...draft.operations.map((o) => `${o.tradeLabel ?? ""} ${o.subTradeLabel ?? ""} ${o.taskTitle}`),
  ]
    .join(" ")
    .toLowerCase();
  return /(steel|structural|ironwork|ironworker|deck|metal deck|joist|girder|erection|connector)/.test(
    hay
  );
}

function synthesizeScopeSubsections(
  draft: GeneratedSafetyPlanDraft,
  projectName: string,
  contractorName: string,
  tradeLabel: string,
  subTradeLabel: string,
  _taskTitles: string[]
): CsepTemplateSubsection[] {
  const steelErectionScope = isStructuralSteelOrDeckingScope(draft, tradeLabel, subTradeLabel);
  const tradeSummary = [tradeLabel, subTradeLabel].filter((value) => value && value !== "N/A").join(" / ");
  const scopeSummaryParts = [
    contractorName !== "N/A" ? `Contractor: ${contractorName}` : null,
    tradeSummary ? `Covered trade / discipline: ${tradeSummary}` : null,
    steelErectionScope
      ? "Task-level steel erection, rigging, and decking controls are governed in the Hazards and Controls section and the approved plans referenced there—not in this Scope section."
      : null,
  ].filter((value): value is string => Boolean(value));

  const taskLine = _taskTitles.length
    ? `Selected tasks: ${_taskTitles.join("; ")}.`
    : "Selected tasks: confirm against the issued builder snapshot before field use.";

  const scopeParagraphs = [
    ...scopeSummaryParts,
    taskLine,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return [
    {
      title: "Scope summary",
      paragraphs: [scopeParagraphs || "Project-specific information to be completed."],
    },
  ];
}

function riskDedupeKey(value: string) {
  return normalizeCompareToken(value);
}

const SCOPE_NARRATIVE_EXCLUSION =
  /\b(iipp\b|injury\s+and\s+illness|illness prevention|health and wellness|wellness program|incident report|incident reporting|incident investigation|drug[-\s]?|alcohol testing|substance|fit[-\s]?for[-\s]?duty|enforcement program|corrective action accountability|hazard communication|hazcom|\bsds\b|sanitation|housekeeping program|toolbox|audits?\s|monitoring program|sub[-\s]?tier|training record)\b/i;

const SECURITY_NON_OWNER =
  /(\b(?:final|torque|bolt[-\s]?up|weld|shear connector|steel execution|erection release|ncr|shop drawing)\b)/i;

const STRUCTURAL_STEEL_DECKING_TOP_10: string[] = [
  "Falls while decking, leading-edge work, or acting as a connector; incomplete guardrails, CDZ boundaries, or fall-arrest/positioning that is not rigged to an approved plan.",
  "Struck-by or caught-in in the load path, swing radius, or tag-line zone; shifting bundles; rigging that slips, rolls, or releases before a stable landing.",
  "Crane, hoist, and rigging overload or control failure; multiple-lift rigging, capacity limits, or critical lifts performed without a reviewed lift or rigging plan.",
  "Loss of stability from missing or out-of-sequence bracing, guy lines, or temporary supports; members landed before anchor bolts, templates, and bearing surfaces are plumb, level, and fit-up verified.",
  "Collapse, crush, or deck punch-through from shoring or deck that is overloaded, uninspected, or not walked before loads; unguarded floor openings, shaft jumps, and incomplete barriers.",
  "Ignition, burn, fume, and slag exposure from field welding, cutting, grinding, and hot work on steel and deck (fire watch, line clearance, combustibles below the arc).",
  "Dropped hand tools, bolts, and deck bundles through openings or at elevation; poor housekeeping at deck edges and column lines.",
  "Electrical contact, trip hazards from welding leads, and arc flash when temporary power, stingers, or equipment tie-ins are on active steel or deck.",
  "Lightning, high wind, or icing that changes crane and hoist limits, plumb, fall protection, and unsecured deck or bundle exposure.",
  "Congested picks and landings where steel interfaces with other trades, deliveries, and mobile equipment; unclear radio communication, spotter blind spots, or ad hoc staging.",
];

function filterScopeNarrativeParagraph(text: string | null | undefined) {
  const t = (text ?? "").trim();
  if (!t) return null;
  if (SCOPE_NARRATIVE_EXCLUSION.test(t)) return null;
  if (/\bprimary tasks?:/i.test(t)) return null;
  return t;
}

function filterScopeTemplateSubsections(subsections: CsepTemplateSubsection[]): CsepTemplateSubsection[] {
  return subsections
    .map((sub) => ({
      ...sub,
      paragraphs: uniqueItems(
        (sub.paragraphs ?? []).map((p) => filterScopeNarrativeParagraph(p)).filter((p): p is string => Boolean(p))
      ),
      items: uniqueItems(
        (sub.items ?? []).map((i) => filterScopeNarrativeParagraph(i)).filter((p): p is string => Boolean(p))
      ),
    }))
    .filter((sub) => subsectionHasContent(sub));
}

function administrativeScopeBlocksRequired(draft: GeneratedSafetyPlanDraft): boolean {
  const builderSnapshot =
    draft.builderSnapshot && typeof draft.builderSnapshot === "object"
      ? (draft.builderSnapshot as Record<string, unknown>)
      : null;
  const siteContext =
    (draft as GeneratedSafetyPlanDraft & { siteContext?: { metadata?: Record<string, unknown> } }).siteContext
      ?.metadata ?? null;

  const hasEnabledFlag = (value: unknown) => value === true;
  const flagKeys = [
    "include_scope_project_information",
    "include_scope_contractor_information",
    "scope_include_project_information",
    "scope_include_contractor_information",
    "require_scope_project_and_contractor_blocks",
    "requireScopeProjectAndContractorBlocks",
    "includeScopeProjectInformation",
    "includeScopeContractorInformation",
  ];

  return flagKeys.some((key) => {
    const fromBuilder = builderSnapshot ? hasEnabledFlag(builderSnapshot[key]) : false;
    const fromMetadata = siteContext ? hasEnabledFlag(siteContext[key]) : false;
    return fromBuilder || fromMetadata;
  });
}

function pruneScopeAdministrativeSubsections(
  subsections: CsepTemplateSubsection[],
  context: { draft: GeneratedSafetyPlanDraft }
): CsepTemplateSubsection[] {
  if (administrativeScopeBlocksRequired(context.draft)) {
    return subsections;
  }

  return subsections.filter((subsection) => {
    const title = normalizeCompareToken(subsection.title ?? "");
    // Keep scope flow focused on operational context; project/admin identity
    // data already belongs to the title page metadata unless explicitly required.
    if (title === "project information" || title === "contractor information") {
      return false;
    }
    return true;
  });
}

/** §3 Scope: Scope → site notes → project → contractor → trade, then other (stable). Top 10 is §4. */
function sortScopeSubsectionsInProjectSetupOrder(subsections: CsepTemplateSubsection[]): CsepTemplateSubsection[] {
  const rank = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("scope of work") || t.includes("scope summary")) return 1;
    if (
      t.includes("project-specific safety") ||
      t.includes("site specific") ||
      t.includes("site-specific field")
    ) {
      return 2;
    }
    if (t.includes("project information")) return 3;
    if (t.includes("contractor information")) return 4;
    if (t.includes("trade summary")) return 5;
    return 100;
  };
  return subsections
    .map((sub, index) => ({ sub, index, r: rank(sub.title ?? "") }))
    .sort((a, b) => (a.r !== b.r ? a.r - b.r : a.index - b.index))
    .map(({ sub }) => sub);
}

function filterSecurityAtSiteSubsections(subsections: CsepTemplateSubsection[]): CsepTemplateSubsection[] {
  return subsections
    .map((sub) => {
      const keepText = (t: string) => {
        const s = t.trim();
        if (!s) return null;
        if (SECURITY_NON_OWNER.test(s) && !/\b(access|gate|badge|entry|deliver|haul|laydown|traffic|exclusion|vehicle)\b/i.test(s)) {
          return null;
        }
        return s;
      };
      return {
        ...sub,
        paragraphs: uniqueItems((sub.paragraphs ?? []).map(keepText).filter((x): x is string => Boolean(x))),
        items: uniqueItems((sub.items ?? []).map(keepText).filter((x): x is string => Boolean(x))),
      };
    })
    .filter((sub) => subsectionHasContent(sub));
}

const DISCIPLINARY_NON_OWNER_LINE =
  /\b(work\s+attire|sanitation|hygiene|toolbox|audit|close[-\s]?out|checklist|inspection\s+sheet|contractor\s+monitor(ing)?|kpi|training\s+record|sub[-\s]?tier|ppe\s+matrix|hazard\s+module|housekeeping|environmental|stormwater)\b/i;

function filterDisciplinaryLine(text: string) {
  const s = text.trim();
  if (!s) return null;
  if (DISCIPLINARY_NON_OWNER_LINE.test(s) && !/\b(escalat|correct|unsafe|remove|enforcement|violation|disciplin|stop\s*work|restart|warning)\b/i.test(s)) {
    return null;
  }
  return s;
}

function filterDisciplinaryTemplateSubsections(subsections: CsepTemplateSubsection[]): CsepTemplateSubsection[] {
  return subsections
    .map((sub) => ({
      ...sub,
      paragraphs: uniqueItems(
        (sub.paragraphs ?? []).map((p) => filterDisciplinaryLine(p)).filter((p): p is string => Boolean(p))
      ),
      items: uniqueItems(
        (sub.items ?? []).map((i) => filterDisciplinaryLine(i)).filter((p): p is string => Boolean(p))
      ),
    }))
    .filter((sub) => subsectionHasContent(sub));
}

/**
 * Returns up to `max` unique risks; treats capitalization and punctuation variants as the same.
 */
function dedupeRiskLabelsPreservingOrder(values: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const t = (raw ?? "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    const k = riskDedupeKey(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(/[.!?]$/.test(t) ? t : `${t}.`);
    if (out.length >= max) break;
  }
  return out;
}

function flattenTopRiskCandidateStrings(
  subsections: CsepTemplateSubsection[],
  draft: GeneratedSafetyPlanDraft
) {
  const fromSub: string[] = [];
  for (const sub of subsections) {
    for (const item of sub.items ?? []) {
      if (item.trim()) fromSub.push(item);
    }
    for (const para of sub.paragraphs ?? []) {
      for (const piece of para.split(/(?:\n|(?<=[.!?]))\s+/)) {
        const t = piece.replace(/^[\d.]+\s*/, "").trim();
        if (t.length > 2 && /[a-zA-Z]/.test(t)) fromSub.push(t);
      }
    }
  }
  const fromDraft = [
    ...(draft.riskSummary?.priorities ?? []),
    ...(draft.ruleSummary?.hazardCategories ?? []),
    ...draft.operations.flatMap((operation) => operation.hazardCategories ?? []),
  ];
  return [...fromSub, ...fromDraft];
}

function synthesizeTopRiskSubsections(
  draft: GeneratedSafetyPlanDraft,
  tradeLabel: string,
  subTradeLabel: string
): CsepTemplateSubsection[] {
  const useSteel = isStructuralSteelOrDeckingScope(draft, tradeLabel, subTradeLabel);
  const baseFromDraft = useSteel
    ? [
        ...STRUCTURAL_STEEL_DECKING_TOP_10,
        ...(draft.riskSummary?.priorities ?? []),
        ...(draft.ruleSummary?.hazardCategories ?? []),
        ...draft.operations.flatMap((operation) => operation.hazardCategories ?? []),
      ]
    : [
        ...(draft.riskSummary?.priorities ?? []),
        ...(draft.ruleSummary?.hazardCategories ?? []),
        ...draft.operations.flatMap((operation) => operation.hazardCategories ?? []),
      ];
  const items = dedupeRiskLabelsPreservingOrder(baseFromDraft, 10);

  return [
    {
      title: "Top 10 Risks",
        items: items.length ? items : [placeholderParagraphForSection("top_10_critical_risks")],
      plainItemsStyle: "offset_lines",
    },
  ];
}

const STEEL_TRADE_INTERACTION_DEFAULTS: string[] = [
  "Sequence crane time and swing so steel erection, decking, and bundle landings are not in the same airspace and ground zone as other trades' picks, man-lifts, or façade access without a written overlap plan and radioed holds.",
  "Agree on column-line and floor-edge handoffs: who owns deck bundle drops, when openings are left for MEP, and how plumb, bolt-up, and welding tie-ins with other systems are accepted before the area is released.",
  "Coordinate delivery and laydown with hoisting: truck routes, outrigger and crane pad access, and traffic control so other crews are not under live picks or in blind rigging pull paths.",
  "Share shift-level changes (weather, out-of-tolerance field conditions, resequenced steel) with GC, crane, and adjacent trade leads before restarting picks or leading-edge work.",
];

function synthesizeTradeInteractionSubsections(
  draft: GeneratedSafetyPlanDraft,
  options?: { tradeLabel?: string; subTradeLabel?: string }
): CsepTemplateSubsection[] {
  const tradeLabel = options?.tradeLabel ?? "";
  const subTradeLabel = options?.subTradeLabel ?? "";
  const overlaps = uniqueItems([
    ...draft.operations.flatMap((operation) => operation.conflicts ?? []),
    ...draft.conflictSummary.items.flatMap((item) => [
      item.rationale,
      ...item.requiredMitigations,
      item.resequencingSuggestion ?? "",
    ]),
  ]);
  const filtered = overlaps.length ? filterTradeInteractionItems(overlaps) : [];
  const useSteelDefaults =
    !filtered.length &&
    isStructuralSteelOrDeckingScope(draft, tradeLabel, subTradeLabel);

  return [
    {
      title: "Trade Interaction Info",
      items: filtered.length
        ? filtered
        : useSteelDefaults
          ? STEEL_TRADE_INTERACTION_DEFAULTS
          : [placeholderParagraphForSection("trade_interaction_and_coordination")],
    },
  ];
}

function synthesizeRolesAndResponsibilitiesSubsections(context: {
  draft: GeneratedSafetyPlanDraft;
  projectName: string;
  contractorName: string;
  tradeLabel: string;
  subTradeLabel: string;
  taskTitles: string[];
}): CsepTemplateSubsection[] {
  const project =
    context.projectName.trim() && context.projectName !== "N/A"
      ? context.projectName.trim()
      : "this project";
  const contractor =
    context.contractorName.trim() && context.contractorName !== "N/A"
      ? context.contractorName.trim()
      : "the contractor organization";
  const tradePhrase =
    [context.tradeLabel, context.subTradeLabel].filter((t) => t && t !== "N/A").join(" / ") || "the contracted work";

  return [
    {
      title: "Overview",
      paragraphs: [
        `The responsibilities below are baseline expectations for this CSEP issue on ${project}. They do not replace or remove other duties required by employer policy, contract, OSHA, site-specific procedures, or the controlling contractor. Where this CSEP is silent, follow the hierarchy of controls, the site orientation, and the GC/CM direction of the day.`,
      ],
    },
    {
      title: "Superintendent / Project Manager",
      paragraphs: [
        `Aligns ${contractor}'s plan for ${tradePhrase} with the project schedule, permits, and interface agreements. Confirms pre-task plans match current hazards and site rules, authorizes stop-work when conditions change, and ensures competent-person coverage and required equipment are in place before production pressure resumes. Escalates trade-to-trade conflicts and records significant safety decisions for turnover and audits.`,
      ],
    },
    {
      title: "Competent Person",
      paragraphs: [
        `Identifies and predicts hazards for the work in progress, implements and documents the measures needed to control them, and has authority to stop unsafe acts. Conducts or participates in inspections tied to critical lifts, fall protection, access changes, and energy isolation when those exposures are in scope. Communicates conditions and handoffs clearly to crews and the superintendent.`,
      ],
    },
    {
      title: "Foreman / Crew Lead",
      paragraphs: [
        `Runs daily briefings for the assigned crew, verifies tools, PPE, and permits before starting, and enforces the work plan at the face. Keeps the competent person informed of field changes, near misses, and subcontractor overlap. Ensures only trained workers perform specialized tasks assigned to the crew.`,
      ],
    },
    {
      title: "Workers",
      paragraphs: [
        `Follow established safe work procedures, attend briefings, use required PPE, and report hazards and near misses immediately. Exercise stop-work authority when a condition is not controlled. Participate in inspections and drills as directed and do not bypass guards, fall protection, or lockout controls.`,
      ],
    },
    {
      title: "Qualified Rigger",
      paragraphs: [
        `Selects and inspects rigging for the loads and configurations in use, rejects damaged or misapplied gear, and follows the lift plan and qualified signaler communication. Keeps exclusion zones respected during hooking, travel, and landing. Coordinates with the crane operator and competent person when pick conditions change.`,
      ],
    },
    {
      title: "Signal Person",
      paragraphs: [
        `Gives standardized signals or radio commands only when qualified for the equipment and lift in progress, maintains continuous visual or voice contact as required, and stops the load when anyone enters the swing or drop zone. Confirms tag line control and landing clearances before movement resumes.`,
      ],
    },
    {
      title: "Safety Lead / Safety Director",
      paragraphs: [
        `Supports the project team with program interpretation, training records, incident notification, and audit readiness. Tracks corrective actions to closure and helps align contractor procedures with owner and GC/CM expectations. Does not replace line supervision but verifies critical controls are implemented in the field.`,
      ],
    },
    {
      title: "GC / CM / Controlling Contractor Interface",
      paragraphs: [
        `Provides site-wide orientation, hazard communication integration, emergency response coordination, and rules for shared spaces, traffic, and hot work where the GC/CM is the controlling entity. Confirms contractor plans align with the site safety plan and interfaces on multi-employer exposures. Contractor supervision remains responsible for crew execution and subcontractor oversight.`,
      ],
    },
  ];
}

/** Omits HazCom, IIPP, disciplinary, access/security, and recordkeeping from trade overlap bullets. */
function filterTradeInteractionItems(values: string[]): string[] {
  const noise =
    /\b(hazard communication|hazcom|sds|safety data sheet|msds|labeling program|emergency response|iipp|injury and illness|disciplinary|enforcement policy|drug[-\s]?free|alcohol|fit[-\s]?for[-\s]?duty|code of conduct)\b/i;
  const notTradeOwner =
    /\b(visitor|escort|badge|gate|security\s+admin|sub[-\s]?tier|training\s+record|qualification|driver\s+remain|pedestrian\s+exclusion|spotter\s+use|check-?in\s+at\s+the\s+gate)\b/i;
  return values
    .map((v) => v.replace(/\s+/g, " ").trim())
    .filter(
      (v) => v.length > 0 && !noise.test(v) && (!notTradeOwner.test(v) || /overlap|swing|sequence|crane|trade|manlift|other\s+trade/i.test(v))
    );
}

function filterTradeInteractionSubsections(
  subsections: CsepTemplateSubsection[]
): CsepTemplateSubsection[] {
  return subsections
    .map((sub) => ({
      ...sub,
      paragraphs: (sub.paragraphs ?? [])
        .map((value) => {
          const t = value.trim();
          if (!t) return null;
          return filterTradeInteractionItems([t]).length ? t : null;
        })
        .filter((value): value is string => Boolean(value)),
      items: sub.items ? filterTradeInteractionItems(sub.items) : sub.items,
    }))
    .filter((sub) => subsectionHasContent(sub));
}

function applySectionOwnershipFilter(
  sectionKey: string,
  subsections: CsepTemplateSubsection[]
): CsepTemplateSubsection[] {
  if (sectionKey === "hazard_control_modules") {
    return subsections
      .map((sub) => {
        const keep = (value: string) => {
          const t = value.trim();
          if (!t) return null;
          return CSEP_HAZARD_NON_OWNER_POLICY_PATTERN.test(t) ? null : t;
        };
        return {
          ...sub,
          paragraphs: uniqueItems((sub.paragraphs ?? []).map(keep).filter((v): v is string => Boolean(v))),
          items: uniqueItems((sub.items ?? []).map(keep).filter((v): v is string => Boolean(v))),
        };
      })
      .filter((sub) => sectionHasContent(sub));
  }

  const key = sectionKey as keyof typeof CSEP_SECTION_OWNERSHIP_PATTERNS;
  const ownerPattern = CSEP_SECTION_OWNERSHIP_PATTERNS[key];
  if (!ownerPattern) return subsections;

  return subsections
    .map((sub) => {
      const keep = (value: string) => {
        const t = value.trim();
        if (!t) return null;
        return ownerPattern.test(t) ? t : null;
      };

      return {
        ...sub,
        paragraphs: uniqueItems((sub.paragraphs ?? []).map(keep).filter((v): v is string => Boolean(v))),
        items: uniqueItems((sub.items ?? []).map(keep).filter((v): v is string => Boolean(v))),
      };
    })
    .filter((sub) => sectionHasContent(sub));
}

function synthesizeHazcomSubsections(): CsepTemplateSubsection[] {
  return [
    {
      title: "Hazard Communication",
      items: [
        "SDS on site: Keep an SDS for every hazardous chemical in use, in the work area and in the master project library (e.g. trailer binder, GC portal, or site app). Make SDS available to the CM and HSE (or their designee) for verification and audits on request.",
        "Inventory and use communication: A chemical inventory (or other documented process) links introduced products to SDS before first use, including contractor-supplied and owner-supplied materials on multi-employer sites.",
        "Primary and secondary container labeling: Do not work from or transfer into unmarked containers. Secondary and portable containers show product identity, GHS label elements (pictograms, signal word, hazard and precautionary statements) or a site-approved worker-readable equivalent, consistent with the shipped product class.",
        "NFPA / site marking: Post or maintain NFPA 704, HMIS, or other owner-mandated markings at fixed chemical storage, fuel points, and yards where the site plan or AHJ require them; align with the SDS and local emergency response pre-plan.",
        "Worker awareness: Train to label and SDS content at a use level and know how to get help (supervision, site safety, poison control) before non-routine or unfamiliar chemical tasks.",
        "Contractor notification: Employers notify the host employer / GC/CM when bringing new or changed chemicals so incompatible operations, hot-work clearances, and storage limits stay valid.",
        "Damaged, bulging, or leaking containers: Report them immediately, isolate, and manage per the SDS, spill kit, and site/owner release rules. Repackage or decommission containers that are not serviceable; relabel if the label is defaced and the product is verified.",
        "Spill follow-through: For releases beyond a minor, controlled work-face cleanup, follow site emergency, environmental, and agency-reporting programs as applicable—HazCom still owns SDS, labels, and worker communication.",
      ],
    },
  ];
}

function synthesizeIippSubsections(): CsepTemplateSubsection[] {
  return [
    {
      title: "IIPP / Emergency Response",
      items: [
        "Report: Injuries, illnesses, near misses, and significant property or environmental loss to supervision immediately; use recordable and owner/GC notification rules for each type.",
        "Control the scene: Stop the unsafe act or condition, isolate energy when needed, limit access, preserve evidence, support EMS.",
        "Medical / rescue: First aid and EMS per site plan; no improvised fall-arrest rescue outside trained, equipped procedures.",
        "Notify: Workers know how to reach 911 / site medic, give the project address, and use after-hours escalation when required.",
        "Investigate: Document facts, causes, and corrective actions; share lessons with affected crews; track repeat trends.",
        "Close the loop: Assign owners and dates; verify fixes in the field; retain training/visit records as the program requires.",
        "Restart: When hazards are abated, permits revalidated, and the competent person (or owner process) approves in writing if required.",
        "Major events: Muster, roll-call, evacuate or shelter for weather, fire, utility, or structural emergencies; re-enter only when released.",
      ],
    },
  ];
}

function buildHazardCrossReference(value: string) {
  const normalized = normalizeCompareToken(value);
  if (
    normalized.includes("hazard communication") ||
    normalized.includes("hazcom") ||
    normalized.includes("sds") ||
    normalized.includes("chemical")
  ) {
    return "Follow the project Hazard Communication requirements defined in the HazCom section.";
  }
  if (
    normalized.includes("emergency") ||
    normalized.includes("medical") ||
    normalized.includes("incident reporting") ||
    normalized.includes("near miss") ||
    normalized.includes("injury")
  ) {
    return "Follow the project IIPP / Emergency Response requirements defined in the IIPP / Emergency Response section.";
  }
  if (
    normalized.includes("security") ||
    normalized.includes("site entry") ||
    normalized.includes("visitor") ||
    normalized.includes("contraband") ||
    normalized.includes("weapon")
  ) {
    return "Follow the project Security at Site requirements defined in the Security at Site section.";
  }
  if (
    normalized.includes("laydown") ||
    normalized.includes("staging") ||
    normalized.includes("delivery route") ||
    normalized.includes("unloading") ||
    normalized.includes("material area") ||
    normalized.includes("traffic control")
  ) {
    return "Follow the project-wide Site Access, Laydown, and Traffic Control requirements in the Security at Site section.";
  }
  if (normalized.includes("drug") || normalized.includes("alcohol") || normalized.includes("substance") || normalized.includes("fit for duty")) {
    return "Follow the project IIPP / Emergency Response requirements defined in the IIPP / Emergency Response section.";
  }
  if (normalized.includes("discipline") || normalized.includes("enforcement") || normalized.includes("unsafe act")) {
    return "Follow the project Disciplinary Program requirements defined in the Disciplinary Program section.";
  }
  if (
    normalized.includes("overlapping trades") ||
    normalized.includes("trade interaction") ||
    normalized.includes("coordination") ||
    normalized.includes("handoff") ||
    normalized.includes("shared area")
  ) {
    return "Coordinate overlapping operations as required by the Trade Interaction Info section.";
  }
  return null;
}

function sanitizeHazardModuleSubsection(subsection: CsepTemplateSubsection): CsepTemplateSubsection {
  const filteredParagraphs = uniqueItems(
    (subsection.paragraphs ?? [])
      .flatMap((paragraph) => splitNarrativeSentences(paragraph))
      .map((sentence) => buildHazardCrossReference(sentence) ?? sentence)
      .filter((sentence) => {
        const normalized = normalizeCompareToken(sentence);
        return !(
          normalized.includes("message from owner") ||
          normalized.includes("purpose of this csep") ||
          normalized.includes("scope of this plan") ||
          normalized.includes("company mission") ||
          normalized.includes("owner message")
        );
      })
  );

  const filteredItems = uniqueItems(
    (subsection.items ?? [])
      .map((item) => buildHazardCrossReference(item) ?? item)
      .filter((item) => {
        const normalized = normalizeCompareToken(item);
        return !(
          normalized.includes("owner message") ||
          normalized.includes("policy statement") ||
          normalized.includes("scope of this plan")
        );
      })
  );

  return {
    ...subsection,
    paragraphs: filteredParagraphs,
    items: filteredItems,
  };
}

function hazardLinesFromSubsection(subsection: CsepTemplateSubsection): string[] {
  const tableLines =
    subsection.table?.rows.flatMap((row) =>
      row
        .map((cell) => cleanFinalText(cell) ?? "")
        .filter(Boolean)
        .map((cell) => cell.trim())
        .filter(Boolean)
    ) ?? [];
  return uniqueItems([...(subsection.paragraphs ?? []), ...(subsection.items ?? []), ...tableLines]);
}

function splitHazardLinesByType(lines: string[]) {
  const risk: string[] = [];
  const controls: string[] = [];
  const verification: string[] = [];
  const stopWork: string[] = [];
  const references: string[] = [];

  lines.forEach((line) => {
    const t = line.trim();
    if (!t) return;
    if (/\bR\d+\b|\bOSHA\b|\b29\s*CFR\b|subpart\s+[a-z]/i.test(t)) {
      references.push(t);
      return;
    }
    if (/\b(stop work|stop[-\s]?work|escalat|halt|pause work|suspend work)\b/i.test(t)) {
      stopWork.push(t);
      return;
    }
    if (/\b(verify|verification|inspect|inspection|check|checked|document|record|sign[-\s]?off|confirmed by|competent person|superintendent)\b/i.test(t)) {
      verification.push(t);
      return;
    }
    if (/\b(control|barrier|barricade|permit|ppe|required|must|ensure|maintain|protect|use|guard|anchor|tie[-\s]?off)\b/i.test(t)) {
      controls.push(t);
      return;
    }
    risk.push(t);
  });

  return { risk, controls, verification, stopWork, references };
}

function hazardCategoryFromSubsectionTitle(title: string):
  | "risk"
  | "controls"
  | "verification"
  | "stopWork"
  | "references"
  | "other" {
  const t = normalizeCompareToken(stripExistingNumberPrefix(title));
  if (!t) return "other";
  if (/\b(risk|hazard overview|when it applies|primary exposure|secondary exposure|purpose)\b/i.test(t)) {
    return "risk";
  }
  if (/\b(required controls|minimum required controls|pre task setup|task scope and sequence|work execution|permits and ppe)\b/i.test(t)) {
    return "controls";
  }
  if (/\b(how controls are met and verified|how controls are verified|verification and handoff|pre start verification|responsibilities and training)\b/i.test(t)) {
    return "verification";
  }
  if (/\b(stop[-\s]?work hold point triggers|stop[-\s]?work triggers|stop work triggers|stop work escalation)\b/i.test(t)) {
    return "stopWork";
  }
  if (/\b(references|applicable references)\b/i.test(t)) {
    return "references";
  }
  return "other";
}

function normalizeHazardModuleBlueprintSubsections(
  subsections: CsepTemplateSubsection[]
): CsepTemplateSubsection[] {
  const groupedByTitle = new Map<string, CsepTemplateSubsection[]>();
  for (const group of groupSubsectionsForFlatProgramOutline(subsections, "hazard_control_modules")) {
    const hazardName = majorProgramTitleForFlatGroup(group).trim() || "Hazard Module";
    const key = normalizeCompareToken(hazardName);
    groupedByTitle.set(key, [...(groupedByTitle.get(key) ?? []), ...group]);
  }
  const groups = Array.from(groupedByTitle.values());
  const normalized: CsepTemplateSubsection[] = [];

  for (const group of groups) {
    const hazardName = majorProgramTitleForFlatGroup(group).trim() || "Hazard Module";
    const riskLines: string[] = [];
    const controlLines: string[] = [];
    const verificationLines: string[] = [];
    const stopWorkLines: string[] = [];
    const referenceLines: string[] = [];

    for (const subsection of group) {
      const lines = hazardLinesFromSubsection(subsection);
      const split = splitHazardLinesByType(lines);
      const category = hazardCategoryFromSubsectionTitle(subsection.title);

      if (category === "risk") {
        riskLines.push(...lines);
      } else if (category === "controls") {
        controlLines.push(...lines);
      } else if (category === "verification") {
        verificationLines.push(...lines);
      } else if (category === "stopWork") {
        stopWorkLines.push(...lines);
      } else if (category === "references") {
        referenceLines.push(...lines);
      } else {
        riskLines.push(...split.risk);
        controlLines.push(...split.controls);
        verificationLines.push(...split.verification);
        stopWorkLines.push(...split.stopWork);
        referenceLines.push(...split.references);
      }

      if (category !== "references") referenceLines.push(...split.references);
      if (category !== "stopWork") stopWorkLines.push(...split.stopWork);
      if (category !== "verification") verificationLines.push(...split.verification);
      if (category !== "controls") controlLines.push(...split.controls);
      if (category !== "risk") riskLines.push(...split.risk);
    }

    const riskParagraphs = uniqueItems(riskLines).slice(0, 5);
    const requiredControls = uniqueItems(
      controlLines.filter((line) => !/\b(standard ppe|minimum ppe|required ppe reference list)\b/i.test(line))
    ).slice(0, 8);
    const verificationItems = uniqueItems(verificationLines).slice(0, 6);
    const stopWorkItems = uniqueItems(stopWorkLines).slice(0, 6);
    const refs = uniqueItems(referenceLines).filter((line) => /\bR\d+\b|\bOSHA\b|\b29\s*CFR\b|subpart\s+[a-z]/i.test(line));

    normalized.push(
      {
        title: buildHazardSliceTitle(hazardName, CSEP_HAZARD_TEMPLATE_SLICES[0]),
        paragraphs: riskParagraphs.length
          ? riskParagraphs
          : ["Describe the actual field exposure and where workers can be hurt if controls fail."],
      },
      {
        title: buildHazardSliceTitle(hazardName, CSEP_HAZARD_TEMPLATE_SLICES[1]),
        items: requiredControls.length
          ? requiredControls
          : ["List hazard-specific controls required before and during work."],
      },
      {
        title: buildHazardSliceTitle(hazardName, CSEP_HAZARD_TEMPLATE_SLICES[2]),
        items: verificationItems.length
          ? verificationItems
          : ["Identify who verifies controls, when checks occur, and what field confirmation or records are required."],
      },
      {
        title: buildHazardSliceTitle(hazardName, CSEP_HAZARD_TEMPLATE_SLICES[3]),
        items: stopWorkItems.length
          ? stopWorkItems
          : ["Stop work when conditions change or required controls are missing, damaged, or not understood by the crew."],
      },
      {
        title: buildHazardSliceTitle(hazardName, CSEP_HAZARD_TEMPLATE_SLICES[4]),
        items: refs.length ? refs : ["Use applicable R-number and OSHA references for this hazard module."],
      }
    );
  }

  return normalized;
}

function buildSectionSubsections(
  definition: FixedSectionDefinition,
  grouped: Map<string, CsepTemplateSubsection[]>,
  context: {
    draft: GeneratedSafetyPlanDraft;
    projectName: string;
    contractorName: string;
    tradeLabel: string;
    subTradeLabel: string;
    taskTitles: string[];
  }
) {
  let subsections = stripSharedContentAcrossSubsections(
    dedupeTemplateSubsections(grouped.get(definition.key) ?? [])
  );

  if (definition.key === "scope_of_work_section") {
    subsections = sortScopeSubsectionsInProjectSetupOrder(
      pruneScopeAdministrativeSubsections(filterScopeTemplateSubsections(subsections), context)
    );
  }
  if (definition.key === "site_access_security_laydown_traffic_control") {
    subsections = filterSecurityAtSiteSubsections(subsections);
  }

  if (definition.key === "worker_conduct_fit_for_duty_disciplinary_program") {
    subsections = filterDisciplinaryTemplateSubsections(
      stripSharedContentAcrossSubsections(dedupeTemplateSubsections(subsections))
    );
  }

  if (definition.key === "owner_message" && !hasMeaningfulSubsections(subsections)) {
    const steelErection = isStructuralSteelOrDeckingScope(
      context.draft,
      context.tradeLabel,
      context.subTradeLabel
    );
    subsections = synthesizeOwnerMessageSubsections(context.projectName, context.contractorName, {
      steelErection,
    });
  }

  if (definition.key === "sign_off_page" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeSignOffSubsections();
  }

  if (definition.key === "purpose" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizePurposeSubsections(context.projectName, {
      steelErection: isStructuralSteelOrDeckingScope(
        context.draft,
        context.tradeLabel,
        context.subTradeLabel
      ),
    });
  }

  if (definition.key === "regulatory_basis_and_references") {
    const existingText = subsections.flatMap((subsection) => [
      ...(subsection.paragraphs ?? []),
      ...(subsection.items ?? []),
      ...(subsection.table?.rows.flatMap((row) => row) ?? []),
    ]).join(" ");
    if (!/\bR[1-9]\b/.test(existingText) || !/OSHA\s+29\s+CFR/i.test(existingText)) {
      subsections = [
        ...subsections,
        ...synthesizeRegulatoryReferenceSubsections(),
      ];
    }
  }

  if (definition.key === "scope_of_work_section" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeScopeSubsections(
      context.draft,
      context.projectName,
      context.contractorName,
      context.tradeLabel,
      context.subTradeLabel,
      context.taskTitles
    );
  }

  if (definition.key === "top_10_critical_risks") {
    const synthesized = synthesizeTopRiskSubsections(
      context.draft,
      context.tradeLabel,
      context.subTradeLabel
    );
    const seed = hasMeaningfulSubsections(subsections)
      ? stripSharedContentAcrossSubsections(dedupeTemplateSubsections([...synthesized, ...subsections]))
      : synthesized;
    const merged = dedupeRiskLabelsPreservingOrder(
      flattenTopRiskCandidateStrings(seed, context.draft),
      10
    );
    subsections = [
      {
        title: "Top 10 Risks",
        items: merged.length ? merged : [placeholderParagraphForSection("top_10_critical_risks")],
        plainItemsStyle: "offset_lines",
      },
    ];
  }

  if (definition.key === "trade_interaction_and_coordination") {
    const tradeCtx = { tradeLabel: context.tradeLabel, subTradeLabel: context.subTradeLabel };
    if (!hasMeaningfulSubsections(subsections)) {
      subsections = synthesizeTradeInteractionSubsections(context.draft, tradeCtx);
    } else {
      subsections = filterTradeInteractionSubsections(
        stripSharedContentAcrossSubsections(dedupeTemplateSubsections(subsections))
      );
      if (!hasMeaningfulSubsections(subsections)) {
        subsections = synthesizeTradeInteractionSubsections(context.draft, tradeCtx);
      }
    }
    subsections = applySectionOwnershipFilter(definition.key, subsections);
  }

  if (definition.key === "hazard_communication_and_environmental_protection" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeHazcomSubsections();
  }
  if (definition.key === "hazard_communication_and_environmental_protection") {
    subsections = applySectionOwnershipFilter(definition.key, subsections);
  }

  if (definition.key === "iipp_incident_reporting_corrective_action" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeIippSubsections();
  }
  if (definition.key === "iipp_incident_reporting_corrective_action") {
    subsections = applySectionOwnershipFilter(definition.key, subsections);
  }

  if (definition.key === "high_risk_steel_erection_programs" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeNamedModuleSubsections(
      HIGH_RISK_STEEL_PROGRAMS,
      "Apply this program when the activity is part of the active structural steel or decking scope; verify competent-person ownership, access control, permits, and stop-work triggers before work starts."
    );
  }

  if (definition.key === "hazard_control_modules") {
    subsections = stripSharedContentAcrossSubsections(
      dedupeTemplateSubsections(subsections.map((subsection) => sanitizeHazardModuleSubsection(subsection)))
    );
    if (!hasMeaningfulSubsections(subsections)) {
      subsections = synthesizeNamedModuleSubsections(
        HAZARD_CONTROL_MODULES,
        "Document the hazard-specific exposure, required controls, verification method, and stop-work trigger for this module."
      );
    }
    subsections = normalizeHazardModuleBlueprintSubsections(subsections);
    subsections = applySectionOwnershipFilter(definition.key, subsections);
  }

  if (definition.key === "task_execution_modules" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeNamedModuleSubsections(
      TASK_EXECUTION_MODULES,
      "Document the task sequence, required hold points, crew coordination, and field verification for this execution module."
    );
  }

  if (definition.key === "ppe_and_work_attire" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeWorkAttireSubsections();
  }

  if (definition.key === "site_access_security_laydown_traffic_control") {
    subsections = applySectionOwnershipFilter(definition.key, subsections);
  }

  if (definition.key === "training_competency_and_certifications" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeTrainingInspectionsMonitoringRecordkeepingSubsections();
  }
  if (definition.key === "training_competency_and_certifications") {
    const steelScope = isStructuralSteelOrDeckingScope(
      context.draft,
      context.tradeLabel,
      context.subTradeLabel
    );
    const hasLiftPlanCoverage = subsections.some((sub) =>
      /\b(crane permit|lift plan|pick plan|critical lift)\b/i.test(
        `${sub.title} ${(sub.paragraphs ?? []).join(" ")} ${(sub.items ?? []).join(" ")}`
      )
    );
    if (steelScope && !hasLiftPlanCoverage) {
      subsections = [
        ...subsections,
        {
          title: "Lifting Plan Readiness",
          items: [
            "For lifting activities, verify lift plan / pick plan communication and crane permit responsibilities before execution.",
          ],
        },
      ];
    }
  }

  if (definition.key === "project_closeout" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeCloseOutLessonsLearnedSubsections();
  }

  if (!hasMeaningfulSubsections(subsections) && definition.key !== "table_of_contents") {
    subsections = [
      {
        title: stripExistingNumberPrefix(definition.title),
        paragraphs: [placeholderParagraphForSection(definition.key)],
      },
    ];
  }

  return subsections;
}

/** Workspace company name stored on the draft (export API may override). */
function configuredCompanyNameFromDraft(draft: GeneratedSafetyPlanDraft): string | null {
  const snap = draft.builderSnapshot;
  if (snap && typeof snap === "object") {
    const o = snap as Record<string, unknown>;
    const fromSnap =
      typeof o.company_name === "string"
        ? o.company_name.trim()
        : typeof o.companyName === "string"
          ? o.companyName.trim()
          : "";
    if (fromSnap) return fromSnap;
  }
  const prov = draft.provenance;
  if (prov && typeof prov === "object") {
    const o = prov as Record<string, unknown>;
    const fromProv =
      typeof o.companyName === "string"
        ? o.companyName.trim()
        : typeof o.company_name === "string"
          ? o.company_name.trim()
          : "";
    if (fromProv) return fromProv;
  }
  return null;
}

/** Cover metadata rows already shown on the structured title page block. */
const COVER_METADATA_ON_TITLE_PAGE = new Set([
  "Project Name",
  "Project Address",
  "Governing State",
  "Contractor",
  "Date",
]);

export function buildCsepRenderModelFromGeneratedDraft(
  draft: GeneratedSafetyPlanDraft,
  options?: { footerCompanyName?: string | null }
): CsepRenderModel {
  const structuredDraft = buildStructuredCsepDraft(draft, { finalIssueMode: true });
  const draftHasStructuredKinds = draft.sectionMap.some((section) =>
    ["front_matter", "main", "appendix"].includes(section.kind ?? "")
  );
  const contractorName = finalValueOrNA(draft.projectOverview.contractorCompany);
  const tradeLabels = uniqueValues(draft.operations.map((operation) => operation.tradeLabel));
  const subTradeLabels = uniqueValues(draft.operations.map((operation) => operation.subTradeLabel));
  const taskTitles = uniqueValues(draft.operations.map((operation) => operation.taskTitle));
  // Relocate the raw task/hazard/control matrix from the main narrative flow
  // to a clean appendix table so the main body stays readable. Applied to both
  // the structured and legacy source maps so the matrix surfaces as an
  // appendix regardless of which source the main-body pipeline chooses below.
  const relocateMatrixToAppendix = (section: GeneratedSafetyPlanSection): GeneratedSafetyPlanSection => {
    const normalizedKey = normalizeToken(section.key);
    const normalizedTitle = normalizeToken(section.title);
    const looksLikeMatrix =
      normalizedKey.includes("activity hazard matrix") ||
      normalizedKey.includes("task hazard control matrix") ||
      normalizedTitle.includes("activity hazard matrix") ||
      normalizedTitle.includes("task hazard control matrix");
    if (!looksLikeMatrix) return section;
    return {
      ...section,
      key: "appendix_e_task_hazard_control_matrix",
      kind: "appendix",
      title: "Appendix E. Task-Hazard-Control Matrix",
    };
  };
  const legacySanitizedSections = relocateSafetyProgramReferencePacks(
    draft.sectionMap.map(sanitizeGeneratedSection).map(relocateMatrixToAppendix)
  );
  const sanitizedSections = relocateSafetyProgramReferencePacks(
    structuredDraft.sectionMap.map(sanitizeGeneratedSection).map(relocateMatrixToAppendix)
  );
  const issueLabel = structuredDraft.documentControl?.issueDate || todayIssueLabel();
  const preparedBy =
    cleanFinalText(structuredDraft.documentControl?.preparedBy) ||
    cleanFinalText(draft.projectOverview.contractorCompany) ||
    "Authorized Contractor Representative";
  const approvedBy =
    cleanFinalText(structuredDraft.documentControl?.approvedBy) ||
    cleanFinalText(structuredDraft.documentControl?.reviewedBy) ||
    cleanFinalText(draft.projectOverview.contractorCompany) ||
    preparedBy;
  const projectName = finalValueOrNA(draft.projectOverview.projectName);
  const projectAddress = finalValueOrNA(draft.projectOverview.projectAddress);
  const provenanceRecord = draft.provenance as Record<string, unknown>;
  const governingFromProvenance =
    typeof provenanceRecord.governingState === "string" ? provenanceRecord.governingState.trim() : "";
  const builderSnap =
    draft.builderSnapshot && typeof draft.builderSnapshot === "object"
      ? (draft.builderSnapshot as Record<string, unknown>)
      : null;
  const governingFromSnapshot =
    builderSnap && typeof builderSnap.governing_state === "string"
      ? String(builderSnap.governing_state).trim()
      : "";
  const governingStateRaw = governingFromProvenance || governingFromSnapshot;
  const titlePageProjectLocation = finalValueOrNA(
    (draft.projectOverview.projectAddress?.trim() && draft.projectOverview.projectAddress.trim()) ||
      (draft.projectOverview.location?.trim() && draft.projectOverview.location.trim()) ||
      ""
  );
  const titlePageGoverningState = governingStateRaw.trim() ? governingStateRaw.trim() : "N/A";
  const titlePageTaskSummary = taskTitles.length ? taskTitles.join("; ") : "N/A";
  const footerCompanyNameResolved =
    options?.footerCompanyName?.trim() || configuredCompanyNameFromDraft(draft) || "";
  const coverMetadataRows = meaningfulFieldRows([
    { label: "Project Name", value: projectName },
    { label: "Project Number", value: finalValueOrNA(draft.projectOverview.projectNumber) },
    { label: "Project Address", value: projectAddress },
    ...(governingStateRaw ? [{ label: "Governing State", value: governingStateRaw }] : []),
    { label: "Owner / Client", value: finalPartyValueOrNA(draft.projectOverview.ownerClient) },
    {
      label: "GC / CM / program partners (list all with site safety or logistics authority)",
      value: formatGcCmPartnersForExport(normalizeGcCmPartnerEntries(draft.projectOverview.gcCm)),
    },
    { label: "Contractor", value: contractorName },
    { label: "Prepared By", value: preparedBy },
    { label: "Date", value: issueLabel },
    { label: "Revision", value: structuredDraft.documentControl?.revision || "1.0" },
  ]);
  const orderedSections = buildCsepTemplateSections({
    draft,
    projectName,
    contractorName,
    tradeLabel: joinDisplayValues(tradeLabels, "N/A"),
    subTradeLabel: joinDisplayValues(subTradeLabels, "N/A"),
    issueLabel,
    taskTitles,
    sourceSections: draftHasStructuredKinds ? sanitizedSections : legacySanitizedSections,
  });
  const frontMatterSections = orderedSections.filter((section) => section.kind === "front_matter");
  const mainSections = orderedSections.filter((section) => section.kind === "main");
  // Combine appendix-kind sections from both the structured draft and the
  // legacy (raw) draft so relocated items like the Task-Hazard-Control Matrix
  // are never dropped when the structured pipeline omits them. Dedupe by
  // stable section key to avoid duplicate appendix entries.
  const appendixSourceSections: GeneratedSafetyPlanSection[] = [];
  const seenAppendixKeys = new Set<string>();
  for (const section of [...sanitizedSections, ...legacySanitizedSections]) {
    if (section.kind !== "appendix") continue;
    const nk = normalizeToken(section.key ?? "");
    if (
      ![
        "appendix a forms and permit library",
        "appendix b incident and investigation package",
        "appendix c checklists and inspection sheets",
        "appendix d field references maps and contact inserts",
        "appendix e task hazard control matrix",
      ].includes(nk)
    ) {
      continue;
    }
    // End-matter document control is rendered once from `document_control_and_revision_history`;
    // drop legacy keys so revision metadata is not duplicated near the front or twice at the end.
    if (nk === "document control" || nk === "revision history") continue;
    const signature = normalizeToken(section.key) || normalizeToken(section.title);
    if (!signature || seenAppendixKeys.has(signature)) continue;
    seenAppendixKeys.add(signature);
    appendixSourceSections.push(section);
  }
  const appendixSections = appendixSourceSections
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map(toTemplateSection);

  return {
    projectName,
    contractorName,
    footerCompanyName: footerCompanyNameResolved,
    tradeLabel: joinDisplayValues(tradeLabels, "N/A"),
    subTradeLabel: joinDisplayValues(subTradeLabels, "N/A"),
    issueLabel,
    titlePageTaskSummary,
    titlePageProjectLocation,
    titlePageGoverningState,
    statusLabel: "Contractor Issue",
    preparedBy,
    coverSubtitleLines: [],
    coverMetadataRows,
    coverLogo: getOptionalCoverLogo(draft),
    approvalLines: [
      "Project Manager / Competent Person: ___________________________ Signature / Date",
      "Corporate Safety Director: ___________________________ Signature / Date",
    ],
    revisionHistory: [
      {
        revision: structuredDraft.documentControl?.revision || "1.0",
        date: issueLabel,
        description: "Initial issuance for generated CSEP export",
        preparedBy,
        approvedBy,
      },
    ],
    frontMatterSections,
    sections: mainSections,
    appendixSections,
    disclaimerLines: DOCUMENT_DISCLAIMER_LINES,
    filenameProjectPart: safeFilePart(draft.projectOverview.projectName, "Project"),
  };
}

function makeParagraph(children: TextRun[], options?: {
  style?: string;
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  spacing?: { before?: number; after?: number; line?: number };
  keepNext?: boolean;
  heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  indent?: { left?: number; hanging?: number };
}) {
  return new Paragraph({
    style: options?.style,
    alignment: options?.alignment,
    spacing: options?.spacing,
    keepNext: options?.keepNext,
    heading: options?.heading,
    indent: options?.indent,
    children,
  });
}

function bodyParagraph(
  text: string,
  options?: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    style?: string;
    spacing?: { before?: number; after?: number; line?: number };
    indent?: { left?: number; hanging?: number };
  }
) {
  return makeParagraph(
    [
      new TextRun({
        text: polishCsepDocxNarrativeText(text),
        font: "Calibri",
        size: 21,
        color: COLORS.ink,
      }),
    ],
    {
      style: options?.style ?? STYLE_IDS.body,
      alignment: options?.alignment,
      spacing: options?.spacing,
      indent: options?.indent,
    }
  );
}

function sectionHeading(text: string, color: string = COLORS.titleBlue) {
  return makeParagraph(
    [
      new TextRun({
        text,
        font: "Calibri",
        bold: true,
        size: 28,
        color,
      }),
    ],
    {
      style: STYLE_IDS.sectionHeading,
      heading: HeadingLevel.HEADING_1,
      keepNext: true,
    }
  );
}

function sectionDescriptorParagraph(text: string) {
  return makeParagraph(
    [
      new TextRun({
        text: polishCsepDocxNarrativeText(text),
        font: "Calibri",
        italics: true,
        size: 20,
        color: COLORS.gray,
      }),
    ],
    {
      style: STYLE_IDS.sectionDescriptor,
      keepNext: true,
      spacing: { before: 36, after: 140, line: 276 },
    }
  );
}

function sectionHeadingTone(section: CsepTemplateSection) {
  const token = normalizeToken(`${section.title} ${section.key}`);
  if (token.includes("incident") || token.includes("communication")) {
    return COLORS.accentRed;
  }
  return COLORS.titleBlue;
}

function numberedParagraph(
  numberLabel: string,
  text: string,
  options?: {
    indent?: { left?: number; hanging?: number };
    spacing?: { before?: number; after?: number; line?: number };
  }
) {
  return makeParagraph(
    [
      new TextRun({
        text: `${numberLabel} `,
        font: "Calibri",
        size: 21,
        color: COLORS.ink,
      }),
      new TextRun({
        text: polishCsepDocxNarrativeText(text),
        font: "Calibri",
        size: 21,
        color: COLORS.ink,
      }),
    ],
    {
      style: STYLE_IDS.body,
      indent: options?.indent ?? { left: INDENTS.numberedLeft, hanging: INDENTS.numberedHanging },
      spacing: options?.spacing,
    }
  );
}

function termDefinitionParagraph(term: string, definition: string) {
  const polishedTerm = polishCsepDocxNarrativeText(term, { skipTerminalPunctuation: true });
  const polishedDefinition = polishCsepDocxNarrativeText(definition);
  return makeParagraph(
    [
      new TextRun({
        text: `${polishedTerm}: `,
        font: "Calibri",
        bold: true,
        size: 21,
        color: COLORS.ink,
      }),
      new TextRun({
        text: polishedDefinition,
        font: "Calibri",
        size: 21,
        color: COLORS.ink,
      }),
    ],
    {
      style: STYLE_IDS.body,
    }
  );
}

function createRunningFooter(footerCompanyName: string, contractorName: string) {
  return new Footer({
    children: [
      makeParagraph(
        [
          new TextRun({
            text: `${footerCompanyName}  |  ${contractorName}  |  `,
            font: "Calibri",
            size: 18,
            color: COLORS.gray,
          }),
          new TextRun({
            text: "Page ",
            font: "Calibri",
            size: 18,
            color: COLORS.gray,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: "Calibri",
            size: 18,
            color: COLORS.gray,
          }),
          new TextRun({
            text: " of ",
            font: "Calibri",
            size: 18,
            color: COLORS.gray,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            font: "Calibri",
            size: 18,
            color: COLORS.gray,
          }),
        ],
        {
          alignment: AlignmentType.CENTER,
        }
      ),
    ],
  });
}

function subtleDivider() {
  return new Paragraph({
    border: {
      bottom: {
        color: COLORS.titleBlue,
        style: BorderStyle.SINGLE,
        size: 3,
      },
    },
    spacing: { after: 140 },
    children: [],
  });
}

function labeledFieldParagraph(
  label: string,
  value: string,
  options?: {
    indent?: { left?: number; hanging?: number };
    spacing?: { after?: number; line?: number };
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  }
) {
  const trimmed = value?.trim() ? value.trim() : "N/A";
  const lines = trimmed.split("\n");
  const valueRuns: TextRun[] = [];
  lines.forEach((line, index) => {
    if (index > 0) {
      valueRuns.push(new TextRun({ break: 1 }));
    }
    valueRuns.push(
      new TextRun({
        text: polishCsepDocxNarrativeText(line),
        font: "Calibri",
        size: 20,
        color: COLORS.ink,
      })
    );
  });

  return makeParagraph(
    [
      new TextRun({
        text: `${label}: `,
        bold: true,
        font: "Calibri",
        size: 20,
        color: COLORS.deepBlue,
      }),
      ...valueRuns,
    ],
    {
      style: STYLE_IDS.body,
      spacing: options?.spacing ?? { after: 100, line: 276 },
      indent: options?.indent,
      alignment: options?.alignment,
    }
  );
}

function approvalSignatureAsParagraphs(lines: string[]) {
  const out: Paragraph[] = [];

  lines.forEach((line) => {
    const label = line.includes(":") ? line.split(":")[0].trim() : line.trim();
    out.push(
      labeledFieldParagraph(label || "Approver", "________________________________  Date: ________________")
    );
  });

  return out;
}

function createCover(model: CsepRenderModel) {
  const tradeLine = finalValueOrNA(model.tradeLabel ?? "");
  const subTradeLine = finalValueOrNA(model.subTradeLabel ?? "");
  const taskSummary = model.titlePageTaskSummary?.trim() ? model.titlePageTaskSummary.trim() : "N/A";
  const projectLocation = model.titlePageProjectLocation?.trim()
    ? model.titlePageProjectLocation.trim()
    : finalValueOrNA("");
  const governingState =
    model.titlePageGoverningState?.trim() && model.titlePageGoverningState.trim() !== ""
      ? model.titlePageGoverningState.trim()
      : "N/A";

  const titlePageRows: Array<{ label: string; value: string }> = [
    { label: "Document title", value: "Contractor Safety & Environmental Plan (CSEP)" },
    { label: "Project name", value: finalValueOrNA(model.projectName) },
    { label: "Trade", value: tradeLine },
    { label: "Sub-trade", value: subTradeLine },
    { label: "Tasks", value: taskSummary },
    { label: "Issue date", value: finalValueOrNA(model.issueLabel) },
    { label: "Project location", value: projectLocation },
    { label: "Contractor", value: finalValueOrNA(model.contractorName) },
    { label: "Governing state", value: governingState },
  ];

  const coverChildren: Paragraph[] = [
    subtleDivider(),
    bodyParagraph("Title Page", {
      style: STYLE_IDS.subheading,
      alignment: AlignmentType.CENTER,
      spacing: { after: 140 },
    }),
    makeParagraph(
      [
        new TextRun({
          text: "CONTRACTOR SAFETY & ENVIRONMENTAL PLAN (CSEP)",
          font: "Calibri Light",
          bold: true,
          size: 32,
          color: COLORS.titleBlue,
        }),
      ],
      {
        style: STYLE_IDS.coverTitle,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }
    ),
  ];

  titlePageRows.forEach((row) => {
    coverChildren.push(
      labeledFieldParagraph(row.label, row.value, {
        alignment: AlignmentType.CENTER,
        spacing: { after: 88, line: 276 },
      })
    );
  });

  if (model.coverLogo) {
    coverChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 220 },
        children: [
          new ImageRun({
            type: model.coverLogo.type,
            data: model.coverLogo.data,
            transformation: {
              width: 220,
              height: 88,
            },
          }),
        ],
      })
    );
  }

  model.coverSubtitleLines
    .filter(
      (line) =>
        line.trim() &&
        line.trim() !== "N/A" &&
        !/^trade:\s*n\/a$/i.test(line.trim()) &&
        !/^sub-?trade:\s*n\/a$/i.test(line.trim()) &&
        normalizeCompareToken(line) !== normalizeCompareToken(model.contractorName)
    )
    .forEach((line) => {
      coverChildren.push(
        bodyParagraph(line, {
          alignment: AlignmentType.CENTER,
          style: STYLE_IDS.coverMeta,
        })
      );
    });

  const secondaryMetadataRows = meaningfulFieldRows(
    model.coverMetadataRows.filter((row) => !COVER_METADATA_ON_TITLE_PAGE.has(row.label))
  );
  if (secondaryMetadataRows.length) {
    coverChildren.push(
      new Paragraph({
        spacing: { before: 200, after: 120 },
        children: [],
      })
    );
    secondaryMetadataRows.forEach((row) => {
      coverChildren.push(
        labeledFieldParagraph(row.label, row.value, {
          indent: { left: 360 },
          spacing: { after: 90, line: 276 },
        })
      );
    });
  }

  // Approval block. Reframed so it reads as an intentional pre-issue approval
  // placeholder rather than an unresolved draft artifact.
  coverChildren.push(
    bodyParagraph("Approval Block — Required Before Field Issue", {
      style: STYLE_IDS.subheading,
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 90 },
    })
  );
  coverChildren.push(
    bodyParagraph(
      "The signatures below confirm that this CSEP has been reviewed against the project scope, site rules, and applicable regulatory requirements prior to field use.",
      {
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
      }
    )
  );
  coverChildren.push(...approvalSignatureAsParagraphs(model.approvalLines));

  return coverChildren;
}

/**
 * Renders table rows as indented body/labeled content without 5.85.1, 5.85.2-style line numbers.
 */
function appendTableRowsAsOffsetParagraphs(
  children: Paragraph[],
  table: NonNullable<GeneratedSafetyPlanSection["table"]>,
  options: {
    renderMode?: "numbered" | "definitions";
    /** Under a numbered subsection (5.x.y) — deeper indent for matrix rows. */
    nested: boolean;
  }
) {
  if (!table.rows.length) return;

  const titleIndent = options.nested
    ? { left: INDENTS.grandchildLeft, hanging: INDENTS.grandchildHanging }
    : { left: INDENTS.childLeft, hanging: INDENTS.childHanging };
  const fieldIndent = options.nested
    ? { left: INDENTS.grandchildBodyLeft }
    : { left: INDENTS.childBodyLeft };
  const simpleIndent = options.nested
    ? { left: INDENTS.grandchildLeft, hanging: INDENTS.grandchildHanging }
    : { left: INDENTS.childBodyLeft };

  table.rows.forEach((row, rowIndex) => {
    if (options.renderMode === "definitions") {
      const term = row[0]?.trim() || "Term";
      const definition = row[1]?.trim() || "Definition pending";
      children.push(termDefinitionParagraph(term, definition));
      return;
    }

    const structuredRow = buildStructuredTableRow(table, row, rowIndex);
    if (structuredRow) {
      children.push(
        bodyParagraph(structuredRow.title, {
          indent: titleIndent,
          spacing: { before: 60, after: 60, line: 276 },
        })
      );
      structuredRow.fields.forEach((field) => {
        children.push(
          labeledFieldParagraph(field.label, field.value, {
            indent: fieldIndent,
            spacing: { after: 110, line: 276 },
          })
        );
      });
      return;
    }

    const text =
      formatActivityMatrixRow(table, row) ??
      table.columns
        .map((column, columnIndex) => `${column}: ${row[columnIndex]?.trim() || "N/A"}`)
        .join(" ");
    children.push(
      bodyParagraph(text, {
        indent: simpleIndent,
        spacing: { before: 60, after: 90, line: 276 },
      })
    );
  });
}

/**
 * Top-level table rows (no distinct subsection) as offset body — does not advance the outline counter.
 */
function appendTopLevelTableRowsAsOffset(
  children: Paragraph[],
  table: NonNullable<GeneratedSafetyPlanSection["table"]>,
  options?: {
    renderMode?: "numbered" | "definitions";
  }
) {
  appendTableRowsAsOffsetParagraphs(children, table, {
    ...options,
    nested: false,
  });
}

function appendTableRowsAsNumberedParagraphs(
  children: Paragraph[],
  table: NonNullable<GeneratedSafetyPlanSection["table"]>,
  subsectionLabel: string,
  priorItemCount: number,
  options?: {
    renderMode?: "numbered" | "definitions";
  }
) {
  if (!table.rows.length) return;

  table.rows.forEach((row, rowIndex) => {
    if (options?.renderMode === "definitions") {
      const term = row[0]?.trim() || "Term";
      const definition = row[1]?.trim() || "Definition pending";
      children.push(termDefinitionParagraph(term, definition));
      return;
    }

    const num = `${subsectionLabel}.${priorItemCount + rowIndex + 1}`;
    const structuredRow = buildStructuredTableRow(table, row, rowIndex);
    if (structuredRow) {
      children.push(
        numberedParagraph(num, structuredRow.title, {
          indent: { left: INDENTS.grandchildLeft, hanging: INDENTS.grandchildHanging },
          spacing: { before: 60, after: 60, line: 276 },
        })
      );
      structuredRow.fields.forEach((field) => {
        children.push(
          labeledFieldParagraph(field.label, field.value, {
            indent: { left: INDENTS.grandchildBodyLeft },
            spacing: { after: 110, line: 276 },
          })
        );
      });
      return;
    }

    const text =
      formatActivityMatrixRow(table, row) ??
      table.columns
        .map((column, columnIndex) => `${column}: ${row[columnIndex]?.trim() || "N/A"}`)
        .join(" ");
    children.push(numberedParagraph(num, text));
  });
}

function appendTopLevelTableRows(
  children: Paragraph[],
  table: NonNullable<GeneratedSafetyPlanSection["table"]>,
  basePrefix: string,
  startingIndex: number,
  options?: {
    renderMode?: "numbered" | "definitions";
  }
) {
  if (!table.rows.length) return startingIndex;

  if (options?.renderMode === "definitions") {
    table.rows.forEach((row) => {
      const term = row[0]?.trim() || "Term";
      const definition = row[1]?.trim() || "Definition pending";
      children.push(termDefinitionParagraph(term, definition));
    });
    return startingIndex;
  }

  let currentIndex = startingIndex;
  table.rows.forEach((row) => {
    currentIndex += 1;
    const structuredRow = buildStructuredTableRow(table, row, currentIndex - 1);
    if (structuredRow) {
      children.push(
        numberedParagraph(`${basePrefix}.${currentIndex}`, structuredRow.title, {
          spacing: { before: 80, after: 60, line: 276 },
        })
      );
      structuredRow.fields.forEach((field) => {
        children.push(
          labeledFieldParagraph(field.label, field.value, {
            indent: { left: INDENTS.childBodyLeft },
            spacing: { after: 110, line: 276 },
          })
        );
      });
      return;
    }

    const text =
      formatActivityMatrixRow(table, row) ??
      table.columns
        .map((column, columnIndex) => `${column}: ${row[columnIndex]?.trim() || "N/A"}`)
        .join(" ");
    children.push(numberedParagraph(`${basePrefix}.${currentIndex}`, text));
  });

  return currentIndex;
}

function isFieldValueTable(table: NonNullable<GeneratedSafetyPlanSection["table"]>) {
  const columns = table.columns.map(normalizeToken);
  return columns.length === 2 && columns[0] === "field" && columns[1] === "value";
}

function appendFieldValueTableParagraphs(
  children: Paragraph[],
  table: NonNullable<GeneratedSafetyPlanSection["table"]>,
  options?: { indent?: { left?: number; hanging?: number } }
) {
  table.rows.forEach((row) => {
    const label = cleanFinalText(row[0]) ?? "";
    const value = cleanFinalText(row[1]);
    if (!label || !value || normalizeCompareToken(value) === "n a") {
      return;
    }
    children.push(
      labeledFieldParagraph(label, value, {
        indent: options?.indent,
        spacing: { after: 120, line: 276 },
      })
    );
  });
}

function buildStructuredTableRow(
  table: NonNullable<GeneratedSafetyPlanSection["table"]>,
  row: string[],
  rowIndex: number
) {
  if (table.columns.length < 2 || isFieldValueTable(table)) {
    return null;
  }

  const rawTitle =
    cleanFinalText(row[0]) ??
    cleanFinalText(`${cleanFinalText(table.columns[0]) ?? "Item"} ${rowIndex + 1}`);
  if (!rawTitle || normalizeCompareToken(rawTitle) === "n a") {
    return null;
  }
  // Strip any pre-existing "Appendix X.Y" or numbered prefix so the renderer's
  // own numbering is not duplicated (e.g. "Appendix B.1 Appendix B.1 …").
  const title = stripExistingNumberPrefix(rawTitle) || rawTitle;

  const fields = table.columns
    .slice(1)
    .map((column, columnIndex) => ({
      label: cleanFinalText(column) ?? `Detail ${columnIndex + 1}`,
      value: normalizeFinalExportText(row[columnIndex + 1]),
    }))
    .filter(
      (entry): entry is { label: string; value: string } =>
        Boolean(entry.label && entry.value && normalizeCompareToken(entry.value) !== "n a")
    );

  if (!fields.length) {
    return null;
  }

  return { title, fields };
}

/** Strip only numeric outline prefixes; keep "Appendix A. …" titles intact for outline headings. */
function baseTitleForOutlineHeading(section: CsepTemplateSection) {
  return section.title.trim().replace(/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i, "").trim();
}

/** Section heading text using contiguous outline ordinals (same source as TOC). */
function displayOutlineSectionHeading(ordinal: number, section: CsepTemplateSection) {
  const base = baseTitleForOutlineHeading(section);
  return `${ordinal}. ${base}`.trim();
}

export type CsepOutlinePlanEntry =
  | { kind: "title_page"; ordinal: number }
  | { kind: "body_section"; ordinal: number; section: CsepTemplateSection }
  | { kind: "disclaimer"; ordinal: number };

/**
 * Outline order matches `createCsepDocument` after the cover: one contiguous 1..N
 * sequence for the title page line, each body section, attachment/appendix dividers
 * when present, and the disclaimer.
 */
export function buildCsepOutlinePlan(model: CsepRenderModel): CsepOutlinePlanEntry[] {
  let ordinal = 1;
  const entries: CsepOutlinePlanEntry[] = [];
  entries.push({ kind: "title_page", ordinal: ordinal++ });
  model.frontMatterSections.forEach((section) => {
    entries.push({ kind: "body_section", ordinal: ordinal++, section });
  });
  model.sections.forEach((section) => {
    entries.push({ kind: "body_section", ordinal: ordinal++, section });
  });
  model.appendixSections.forEach((section) => {
    entries.push({ kind: "body_section", ordinal: ordinal++, section });
  });
  entries.push({ kind: "disclaimer", ordinal: ordinal++ });
  return entries;
}

function formatOutlineTocLine(entry: CsepOutlinePlanEntry): string {
  switch (entry.kind) {
    case "title_page":
      return `${entry.ordinal}. Title Page`;
    case "body_section":
      return displayOutlineSectionHeading(entry.ordinal, entry.section);
    case "disclaimer":
      return `${entry.ordinal}. Disclaimer`;
  }
}

function outlineOrdinalForSectionKey(plan: CsepOutlinePlanEntry[], sectionKey: string): number {
  const hit = plan.find(
    (e): e is Extract<CsepOutlinePlanEntry, { kind: "body_section" }> =>
      e.kind === "body_section" && e.section.key === sectionKey
  );
  if (!hit) {
    throw new Error(`CSEP outline plan missing section key "${sectionKey}".`);
  }
  return hit.ordinal;
}

function outlineOrdinalForKind(
  plan: CsepOutlinePlanEntry[],
  kind: "disclaimer"
): number {
  const hit = plan.find((e) => e.kind === kind);
  if (!hit) {
    throw new Error(`CSEP outline plan missing entry kind "${kind}".`);
  }
  return hit.ordinal;
}

function sectionPrefix(_section: CsepTemplateSection, outlineOrdinal: number) {
  return String(outlineOrdinal);
}

function isDistinctSubheading(sectionTitle: string, subsectionTitle: string) {
  return normalizeToken(stripExistingNumberPrefix(sectionTitle)) !== normalizeToken(stripExistingNumberPrefix(subsectionTitle));
}

function shouldRenderSubheading(sectionTitle: string, subsection: CsepTemplateSubsection) {
  const title = stripExistingNumberPrefix(subsection.title).trim();
  if (!title) return false;
  if (!isDistinctSubheading(sectionTitle, subsection.title)) return false;
  if (subsection.table?.rows.length) return true;

  const comparableContent = uniqueItems([
    ...(subsection.paragraphs ?? []),
    ...(subsection.items ?? []),
  ]).map((value) => normalizeToken(value));
  const uniqueComparableContent = Array.from(new Set(comparableContent.filter(Boolean)));

  return !(uniqueComparableContent.length === 1 && uniqueComparableContent[0] === normalizeToken(title));
}

const CSEP_SECTION_KEYS_WITH_FLAT_PROGRAM_OUTLINE = new Set<string>([
  "high_risk_steel_erection_programs",
  "hazard_control_modules",
  "task_execution_modules",
  CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY,
]);
const MAX_HAZARD_TOP_LEVEL_NUMBERED_ITEMS = 24;

const EM_DASH_TITLE_SPLIT = /\s*[—]\s*/u;

/**
 * When set, catalog program slices (e.g. "Program: When It Applies") and
 * appendix reference rows ("Program — overview") share one outline number for
 * the program and render inner slices as unnumbered subheadings + body text.
 */
function usesFlatProgramOutline(section: CsepTemplateSection) {
  return CSEP_SECTION_KEYS_WITH_FLAT_PROGRAM_OUTLINE.has(section.key);
}

function programBaseKeyFromSubsectionTitle(
  rawTitle: string,
  sectionKey: string
): string | null {
  const t = stripExistingNumberPrefix(rawTitle).trim();
  if (!t) return null;

  const emParts = t.split(EM_DASH_TITLE_SPLIT);
  if (emParts.length >= 2 && sectionKey === CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY) {
    return normalizeToken(emParts[0]!.trim());
  }

  const colonIdx = t.indexOf(": ");
  if (colonIdx !== -1) {
    const base = t.slice(0, colonIdx).trim();
    const rest = t.slice(colonIdx + 2).trim();
    if (GENERIC_SUBSECTION_TITLES.has(normalizeCompareToken(rest))) {
      return normalizeToken(base);
    }
  }

  return null;
}

function hazardFlatGroupingKey(
  subsections: CsepTemplateSubsection[],
  index: number,
  sectionKey: string
): string {
  const sub = subsections[index]!;
  const fromTitle = programBaseKeyFromSubsectionTitle(sub.title, sectionKey);
  if (fromTitle) return fromTitle;

  const t = stripExistingNumberPrefix(sub.title).trim();
  const next = subsections[index + 1];
  if (next) {
    const nk = programBaseKeyFromSubsectionTitle(next.title, sectionKey);
    if (nk && nk === normalizeToken(t)) return nk;
  }
  const prev = subsections[index - 1];
  if (prev) {
    const pk = programBaseKeyFromSubsectionTitle(prev.title, sectionKey);
    if (pk && pk === normalizeToken(t)) return pk;
  }

  return `_row:${index}:${normalizeToken(t)}`;
}

function groupSubsectionsForFlatProgramOutline(
  subsections: CsepTemplateSubsection[],
  sectionKey: string
): CsepTemplateSubsection[][] {
  if (!subsections.length) return [];
  const keys = subsections.map((_, i) => hazardFlatGroupingKey(subsections, i, sectionKey));
  const groups: CsepTemplateSubsection[][] = [];
  for (let i = 0; i < subsections.length; i++) {
    if (i === 0 || keys[i] !== keys[i - 1]) {
      groups.push([subsections[i]!]);
    } else {
      groups[groups.length - 1]!.push(subsections[i]!);
    }
  }
  return groups;
}

/** Exported for unit tests — groups hazard/reference subsections that share one outline number. */
export function buildHazardFlatProgramGroupsForTest(
  subsections: CsepTemplateSubsection[],
  sectionKey: string
) {
  return groupSubsectionsForFlatProgramOutline(subsections, sectionKey);
}

function majorProgramTitleForFlatGroup(blocks: CsepTemplateSubsection[]): string {
  if (!blocks.length) return "";
  for (const b of blocks) {
    const t = stripExistingNumberPrefix(b.title).trim();
    const emParts = t.split(EM_DASH_TITLE_SPLIT);
    if (emParts.length >= 2) {
      return emParts[0]!.trim();
    }
    const colonIdx = t.indexOf(": ");
    if (colonIdx !== -1) {
      const rest = t.slice(colonIdx + 2).trim();
      if (GENERIC_SUBSECTION_TITLES.has(normalizeCompareToken(rest))) {
        return t.slice(0, colonIdx).trim();
      }
    }
  }
  return stripExistingNumberPrefix(blocks[0]!.title).trim();
}

function sliceLabelWithinProgramGroup(majorTitle: string, subsection: CsepTemplateSubsection): string | null {
  const raw = stripExistingNumberPrefix(subsection.title).trim();
  const major = stripExistingNumberPrefix(majorTitle).trim();
  if (!raw || normalizeCompareToken(raw) === normalizeCompareToken(major)) {
    return null;
  }

  const emParts = raw.split(EM_DASH_TITLE_SPLIT);
  if (emParts.length >= 2 && normalizeCompareToken(emParts[0]!.trim()) === normalizeCompareToken(major)) {
    return emParts.slice(1).join(" — ").trim();
  }

  const colonIdx = raw.indexOf(": ");
  if (colonIdx !== -1) {
    const base = raw.slice(0, colonIdx).trim();
    if (normalizeCompareToken(base) === normalizeCompareToken(major)) {
      return raw.slice(colonIdx + 2).trim();
    }
  }

  return raw;
}

function isNumberedProgramModuleSlice(title: string) {
  const normalized = normalizeCompareToken(canonicalProgramModuleSliceLabel(title));
  return (
    normalized === "required controls" ||
    normalized === "how controls are met and verified" ||
    normalized === "stop work hold point triggers" ||
    normalized === "applicable references"
  );
}

function canonicalProgramModuleSliceLabel(title: string) {
  const normalized = normalizeCompareToken(title);
  if (normalized === "how controls are verified" || normalized === "verification and handoff") {
    return "How controls are met and verified";
  }
  if (
    normalized === "stop work hold point triggers" ||
    normalized === "stop work triggers" ||
    normalized === "stop work escalation"
  ) {
    return "Stop-work / hold-point triggers";
  }
  if (normalized === "references") {
    return "Applicable references";
  }
  if (normalized === "required controls") return "Required controls";
  if (normalized === "risk") return "Risk";
  return title;
}

function appendFlatSubsectionContent(children: Paragraph[], subsection: CsepTemplateSubsection) {
  const paragraphSplit = splitStructuredSourceItems(subsection.paragraphs);
  const itemSplit = splitStructuredSourceItems(subsection.items);
  const structuredEntries = [...paragraphSplit.structured, ...itemSplit.structured];
  const numberedProgramItems = isNumberedProgramModuleSlice(
    stripExistingNumberPrefix(subsection.title).split(EM_DASH_TITLE_SPLIT).pop()?.split(": ").pop() ?? subsection.title
  );

  appendIndentedParagraphs(children, paragraphSplit.plain, { left: INDENTS.childBodyLeft });

  structuredEntries.forEach((entry) => {
    const bodySegments = splitCsepDocxBodyIntoSegments(entry.body);
    const bodyText = bodySegments.join("\n\n").trim();
    const title = entry.title?.trim() ?? "";
    if (title && bodyText) {
      children.push(termDefinitionParagraph(title, bodyText));
    } else if (title) {
      children.push(
        bodyParagraph(title, {
          indent: { left: INDENTS.childBodyLeft },
          spacing: { after: 140, line: 276 },
        })
      );
    } else if (bodyText) {
      children.push(
        bodyParagraph(bodyText, {
          indent: { left: INDENTS.childBodyLeft },
          spacing: { after: 140, line: 276 },
        })
      );
    }
  });

  itemSplit.plain.forEach((item, itemIndex) => {
    children.push(
      bodyParagraph(numberedProgramItems ? `${itemIndex + 1}. ${item}` : item, {
        indent: { left: INDENTS.childBodyLeft },
        spacing: { before: itemIndex === 0 ? 100 : 50, after: 90, line: 276 },
      })
    );
  });

  if (!subsection.table?.rows.length) return;

  if (isFieldValueTable(subsection.table)) {
    appendFieldValueTableParagraphs(children, subsection.table, { indent: { left: INDENTS.childBodyLeft } });
    return;
  }

  appendTableRowsAsOffsetParagraphs(children, subsection.table, {
    renderMode: "numbered",
    nested: true,
  });
}

function renderSectionWithFlatProgramOutline(outlineOrdinal: number, section: CsepTemplateSection) {
  const children: Paragraph[] = [
    sectionHeading(displayOutlineSectionHeading(outlineOrdinal, section), sectionHeadingTone(section)),
  ];
  if (section.descriptor?.trim()) {
    children.push(sectionDescriptorParagraph(section.descriptor.trim()));
  }
  const basePrefix = sectionPrefix(section, outlineOrdinal);
  const groups = groupSubsectionsForFlatProgramOutline(section.subsections, section.key);
  let nextTopLevelNumber = 0;

  for (const group of groups) {
    nextTopLevelNumber += 1;
    const majorTitle = majorProgramTitleForFlatGroup(group);
    const headingText = majorTitle || stripExistingNumberPrefix(group[0]!.title).trim() || "Program";
    const keepFlatNumbering =
      section.key !== "hazard_control_modules" || nextTopLevelNumber <= MAX_HAZARD_TOP_LEVEL_NUMBERED_ITEMS;
    if (keepFlatNumbering) {
      children.push(
        numberedParagraph(`${basePrefix}.${nextTopLevelNumber}`, headingText, {
          indent: { left: INDENTS.childLeft, hanging: INDENTS.childHanging },
          spacing: { before: nextTopLevelNumber === 1 ? 120 : 260, after: 160, line: 276 },
        })
      );
    } else {
      children.push(
        bodyParagraph(headingText, {
          style: STYLE_IDS.subheading,
          indent: { left: INDENTS.childBodyLeft },
          spacing: { before: 220, after: 100, line: 276 },
        })
      );
    }

    for (const subsection of group) {
      const slice = sliceLabelWithinProgramGroup(headingText, subsection);
      if (slice) {
        const label = canonicalProgramModuleSliceLabel(slice);
        children.push(
          bodyParagraph(`${label}:`, {
            style: STYLE_IDS.subheading,
            indent: { left: INDENTS.childBodyLeft },
            spacing: { before: 200, after: 90, line: 276 },
          })
        );
      }
      appendFlatSubsectionContent(children, subsection);
    }
  }

  return children;
}

function renderProgramModuleTemplateSection(outlineOrdinal: number, section: CsepTemplateSection) {
  const children: Paragraph[] = [
    sectionHeading(displayOutlineSectionHeading(outlineOrdinal, section), sectionHeadingTone(section)),
  ];
  if (section.descriptor?.trim()) {
    children.push(sectionDescriptorParagraph(section.descriptor.trim()));
  }

  section.subsections.forEach((subsection) => {
    const label = stripExistingNumberPrefix(subsection.title).trim();
    if (!label) return;
    children.push(
      bodyParagraph(`${label}:`, {
        style: STYLE_IDS.subheading,
        spacing: { before: 180, after: 90, line: 276 },
      })
    );

    if (normalizeCompareToken(label) === "risk") {
      appendParagraphs(children, subsection.paragraphs);
      return;
    }

    const items = uniqueItems([...(subsection.items ?? []), ...(subsection.paragraphs ?? [])]);
    items.forEach((item, index) => {
      children.push(
        bodyParagraph(`${index + 1}. ${stripSourceNumberingLabel(item)}`, {
          indent: { left: INDENTS.childBodyLeft },
          spacing: { before: index === 0 ? 80 : 40, after: 90, line: 276 },
        })
      );
    });
  });

  return children;
}

function appendParagraphs(children: Paragraph[], paragraphs?: string[]) {
  (paragraphs ?? []).forEach((paragraph) => {
    children.push(
      bodyParagraph(stripSourceNumberingLabel(paragraph), {
        spacing: { after: 140, line: 276 },
      })
    );
  });
}

function appendIndentedParagraphs(
  children: Paragraph[],
  paragraphs: string[] | undefined,
  indent: { left?: number; hanging?: number }
) {
  (paragraphs ?? []).forEach((paragraph) => {
    children.push(
      bodyParagraph(stripSourceNumberingLabel(paragraph), {
        indent,
        spacing: { after: 150, line: 276 },
      })
    );
  });
}

function splitStructuredSourceItems(values?: string[]) {
  const structured: ParsedSourceNumberedItem[] = [];
  const plain: string[] = [];

  (values ?? []).forEach((value) => {
    const parsed = parseSourceNumberedItem(value);
    if (parsed) {
      structured.push(parsed);
      return;
    }

    const stripped = stripSourceNumberingLabel(value);
    if (stripped) {
      plain.push(stripped);
    }
  });

  return { structured, plain };
}

function pageBreakParagraph() {
  return new Paragraph({ children: [new PageBreak()] });
}

function createContents(model: CsepRenderModel) {
  const plan = buildCsepOutlinePlan(model);
  const tableOfContentsSection = model.frontMatterSections.find((section) => section.key === "table_of_contents");
  const tocEntry = plan.find(
    (e): e is Extract<CsepOutlinePlanEntry, { kind: "body_section" }> =>
      e.kind === "body_section" && e.section.key === "table_of_contents"
  );
  const tocHeading =
    tableOfContentsSection && tocEntry
      ? displayOutlineSectionHeading(tocEntry.ordinal, tableOfContentsSection)
      : "Table of Contents";
  const entries = plan
    .filter((entry) => !(entry.kind === "body_section" && entry.section.key === "table_of_contents"))
    .map((entry) => formatOutlineTocLine(entry));

  return [
    sectionHeading(tocHeading),
    ...(tableOfContentsSection?.descriptor?.trim()
      ? [sectionDescriptorParagraph(tableOfContentsSection.descriptor.trim())]
      : []),
    ...entries.map((entry) =>
      bodyParagraph(entry, {
        style: STYLE_IDS.contentsEntry,
      })
    ),
  ];
}

function createAttachmentsDivider(ordinal: number) {
  return [
    sectionHeading(`${ordinal}. Attachments`),
    sectionDescriptorParagraph(
      "Forms, checklists, and supporting inserts issued with this CSEP package."
    ),
  ];
}

function createAppendicesDivider(ordinal: number) {
  return [
    sectionHeading(`${ordinal}. Appendices`),
    sectionDescriptorParagraph(
      "Matrices, program reference packs, and library material referenced from the body of this plan."
    ),
  ];
}

function renderSection(outlineOrdinal: number, section: CsepTemplateSection) {
  if (section.key.startsWith("program_")) {
    return renderProgramModuleTemplateSection(outlineOrdinal, section);
  }

  if (usesFlatProgramOutline(section)) {
    return renderSectionWithFlatProgramOutline(outlineOrdinal, section);
  }

  const children: Paragraph[] = [
    sectionHeading(displayOutlineSectionHeading(outlineOrdinal, section), sectionHeadingTone(section)),
  ];
  if (section.descriptor?.trim()) {
    children.push(sectionDescriptorParagraph(section.descriptor.trim()));
  }
  const basePrefix = sectionPrefix(section, outlineOrdinal);
  // Single monotonically-increasing top-level counter so subheadings, items,
  // structured entries, and table rows never share the same X.Y label.
  let nextTopLevelNumber = 0;

  section.subsections.forEach((subsection) => {
    const distinctSubheading = shouldRenderSubheading(section.title, subsection);
    const renderMode =
      section.key === "definitions_and_abbreviations" ? "definitions" : "numbered";
    const paragraphSplit = splitStructuredSourceItems(subsection.paragraphs);
    const itemSplit = splitStructuredSourceItems(subsection.items);

    let subsectionLabel = basePrefix;
    let itemPrefixBase = basePrefix;

    if (distinctSubheading) {
      nextTopLevelNumber += 1;
      subsectionLabel = `${basePrefix}.${nextTopLevelNumber}`;
      itemPrefixBase = subsectionLabel;
      children.push(
        numberedParagraph(subsectionLabel, stripExistingNumberPrefix(subsection.title), {
          indent: { left: INDENTS.childLeft, hanging: INDENTS.childHanging },
          spacing: { before: 240, after: 160, line: 276 },
        })
      );
    }

    if (distinctSubheading) {
      appendIndentedParagraphs(children, paragraphSplit.plain, { left: INDENTS.childBodyLeft });
    } else {
      appendParagraphs(children, paragraphSplit.plain);
    }

    const structuredEntries = [...paragraphSplit.structured, ...itemSplit.structured];

    structuredEntries.forEach((entry, entryIndex) => {
      const bodySegments = splitCsepDocxBodyIntoSegments(entry.body);

      if (distinctSubheading) {
        const childNumber = `${itemPrefixBase}.${entryIndex + 1}`;
        children.push(
          numberedParagraph(childNumber, entry.title, {
            indent: { left: INDENTS.grandchildLeft, hanging: INDENTS.grandchildHanging },
            spacing: { before: 180, after: 90, line: 276 },
          })
        );
        bodySegments.forEach((segment, segmentIndex) => {
          const isLast = segmentIndex === bodySegments.length - 1;
          children.push(
            bodyParagraph(segment, {
              indent: { left: INDENTS.grandchildBodyLeft },
              spacing: { after: isLast ? 260 : 120, line: 276 },
            })
          );
        });
        return;
      }

      nextTopLevelNumber += 1;
      children.push(
        numberedParagraph(`${basePrefix}.${nextTopLevelNumber}`, entry.title, {
          indent: { left: INDENTS.childLeft, hanging: INDENTS.childHanging },
          spacing: { before: 180, after: 100, line: 276 },
        })
      );
      bodySegments.forEach((segment, segmentIndex) => {
        const isLast = segmentIndex === bodySegments.length - 1;
        children.push(
          bodyParagraph(segment, {
            indent: { left: INDENTS.childBodyLeft },
            spacing: { after: isLast ? 260 : 120, line: 276 },
          })
        );
      });
    });

    itemSplit.plain.forEach((item, itemIndex) => {
      if (subsection.plainItemsStyle === "offset_lines") {
        children.push(
          bodyParagraph(item, {
            indent: { left: INDENTS.childBodyLeft },
            spacing: { before: itemIndex === 0 ? 120 : 50, after: 90, line: 276 },
          })
        );
        return;
      }
      if (distinctSubheading) {
        children.push(
          numberedParagraph(`${itemPrefixBase}.${structuredEntries.length + itemIndex + 1}`, item, {
            indent: { left: INDENTS.grandchildLeft, hanging: INDENTS.grandchildHanging },
            spacing: { before: 50, after: 110, line: 276 },
          })
        );
      } else {
        nextTopLevelNumber += 1;
        children.push(
          numberedParagraph(`${basePrefix}.${nextTopLevelNumber}`, item, {
            spacing: { before: 70, after: 130, line: 276 },
          })
        );
      }
    });

    if (subsection.table?.rows.length) {
      if (isFieldValueTable(subsection.table)) {
        appendFieldValueTableParagraphs(
          children,
          subsection.table,
          distinctSubheading ? { indent: { left: INDENTS.childBodyLeft } } : undefined
        );
        return;
      }

      if (subsection.tableRowsStyle === "offset_lines") {
        if (distinctSubheading) {
          appendTableRowsAsOffsetParagraphs(children, subsection.table, {
            renderMode,
            nested: true,
          });
        } else {
          appendTopLevelTableRowsAsOffset(children, subsection.table, { renderMode });
        }
        return;
      }

      if (distinctSubheading) {
        const numberedPlainItemCount =
          subsection.plainItemsStyle === "offset_lines" ? 0 : itemSplit.plain.length;
        appendTableRowsAsNumberedParagraphs(
          children,
          subsection.table,
          itemPrefixBase,
          structuredEntries.length + numberedPlainItemCount,
          { renderMode }
        );
      } else {
        nextTopLevelNumber = appendTopLevelTableRows(
          children,
          subsection.table,
          basePrefix,
          nextTopLevelNumber,
          { renderMode }
        );
      }
    }
  });

  return children;
}

export async function createCsepDocument(model: CsepRenderModel) {
  const children: Paragraph[] = [];
  const plan = buildCsepOutlinePlan(model);

  children.push(...createCover(model));

  const frontMatterKeys = new Set(model.frontMatterSections.map((section) => section.key));

  model.frontMatterSections.forEach((section, index) => {
    if (section.key === "table_of_contents") {
      children.push(pageBreakParagraph());
      children.push(...createContents(model));
      children.push(pageBreakParagraph());
      return;
    }
    if (section.key === "owner_message") {
      children.push(pageBreakParagraph());
    } else if (section.key === "sign_off_page") {
      children.push(pageBreakParagraph());
    } else {
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    }
    children.push(...renderSection(outlineOrdinalForSectionKey(plan, section.key), section));
    if (section.key === "sign_off_page") {
      children.push(new Paragraph({ children: [] }));
      children.push(...approvalSignatureAsParagraphs(model.approvalLines));
    }
  });

  if (model.frontMatterSections.length && !frontMatterKeys.has("table_of_contents")) {
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    children.push(...createContents(model));
  }

  model.sections.forEach((section, index) => {
    if (index === 0) {
      children.push(pageBreakParagraph());
    } else {
      children.push(new Paragraph({ spacing: { before: 160, after: 80 }, children: [] }));
    }
    children.push(...renderSection(outlineOrdinalForSectionKey(plan, section.key), section));
  });

  model.appendixSections.forEach((section) => {
    children.push(pageBreakParagraph());
    children.push(...renderSection(outlineOrdinalForSectionKey(plan, section.key), section));
  });

  children.push(pageBreakParagraph());
  children.push(sectionHeading(formatOutlineTocLine(plan.find((e) => e.kind === "disclaimer")!)));
  model.disclaimerLines.forEach((line) => {
    children.push(bodyParagraph(line));
  });

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 21,
            color: COLORS.ink,
          },
          paragraph: {
            spacing: {
              after: 120,
              line: 276,
            },
          },
        },
      },
      paragraphStyles: [
        {
          id: STYLE_IDS.body,
          name: STYLE_IDS.body,
          paragraph: {
            spacing: {
              after: 120,
              line: 276,
            },
          },
          run: {
            font: "Calibri",
            size: 21,
            color: COLORS.ink,
          },
        },
        {
          id: STYLE_IDS.coverTitle,
          name: STYLE_IDS.coverTitle,
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: {
              before: 720,
              after: 140,
            },
          },
          run: {
            font: "Calibri Light",
            bold: true,
            size: 32,
            color: COLORS.titleBlue,
          },
        },
        {
          id: STYLE_IDS.coverSubtitle,
          name: STYLE_IDS.coverSubtitle,
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 120,
            },
          },
          run: {
            font: "Calibri",
            italics: true,
            size: 21,
            color: COLORS.gray,
          },
        },
        {
          id: STYLE_IDS.coverMeta,
          name: STYLE_IDS.coverMeta,
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 80,
            },
          },
          run: {
            font: "Calibri",
            size: 21,
            color: COLORS.ink,
          },
        },
        {
          id: STYLE_IDS.sectionHeading,
          name: STYLE_IDS.sectionHeading,
          paragraph: {
            spacing: {
              before: 200,
              after: 112,
            },
          },
          run: {
            font: "Calibri",
            bold: true,
            size: 28,
            color: COLORS.titleBlue,
          },
        },
        {
          id: STYLE_IDS.sectionDescriptor,
          name: STYLE_IDS.sectionDescriptor,
          paragraph: {
            spacing: {
              before: 36,
              after: 140,
            },
          },
          run: {
            font: "Calibri",
            italics: true,
            size: 20,
            color: COLORS.gray,
          },
        },
        {
          id: STYLE_IDS.subheading,
          name: STYLE_IDS.subheading,
          paragraph: {
            spacing: {
              before: 160,
              after: 80,
            },
          },
          run: {
            font: "Calibri",
            bold: true,
            size: 24,
            color: COLORS.headingBlue,
          },
        },
        {
          id: STYLE_IDS.contentsEntry,
          name: STYLE_IDS.contentsEntry,
          paragraph: {
            spacing: {
              after: 90,
            },
          },
          run: {
            font: "Calibri",
            size: 21,
            color: COLORS.ink,
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1080,
              left: 1440,
              header: 720,
              footer: 720,
              gutter: 0,
            },
            pageNumbers: {
              start: 1,
            },
          },
        },
        footers: {
          default: createRunningFooter(model.footerCompanyName, model.contractorName),
        },
        children,
      },
    ],
  });
}

export async function renderCsepRenderModel(
  model: CsepRenderModel,
  options?: { draft?: GeneratedSafetyPlanDraft | null }
) {
  const normalizedModel = normalizeRenderModel(model);
  assertCsepExportQuality(normalizedModel, { draft: options?.draft ?? undefined });
  validateCsepRenderModel(normalizedModel);
  const doc = await createCsepDocument(normalizedModel);
  const buffer = await Packer.toBuffer(doc);

  return {
    body: new Uint8Array(buffer),
    filename: getSafetyBlueprintDraftFilename(normalizedModel.filenameProjectPart, "csep").replace(
      "_Draft",
      ""
    ),
  };
}

export async function renderGeneratedCsepDocx(
  draft: GeneratedSafetyPlanDraft,
  options?: { footerCompanyName?: string | null }
) {
  return renderCsepRenderModel(buildCsepRenderModelFromGeneratedDraft(draft, options), { draft });
}
