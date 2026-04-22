import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
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
import { buildStructuredCsepDraft } from "@/lib/csepBuilder";
import {
  cleanFinalText,
  controlledTbd,
  normalizeFinalExportText,
  normalizeHazardList,
  normalizePermitList,
  normalizePpeList,
} from "@/lib/csepFinalization";
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
  tradeLabel?: string | null;
  subTradeLabel?: string | null;
  issueLabel: string;
  statusLabel: string;
  preparedBy: string;
  coverSubtitleLines: string[];
  coverMetadataRows: CsepCoverMetadataRow[];
  approvalLines: string[];
  revisionHistory: CsepRevisionEntry[];
  frontMatterSections: CsepTemplateSection[];
  sections: CsepTemplateSection[];
  appendixSections: CsepTemplateSection[];
  disclaimerLines: readonly string[];
  filenameProjectPart: string;
};

type BuildCsepTemplateSectionsParams = {
  projectName: string;
  contractorName: string;
  tradeLabel?: string | null;
  subTradeLabel?: string | null;
  issueLabel?: string;
  sourceSections: GeneratedSafetyPlanSection[];
};

type FixedSectionDefinition = {
  key: string;
  title: string;
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

const FIXED_SECTION_DEFINITIONS: FixedSectionDefinition[] = [
  {
    key: "project_contractor_information",
    title: "Project & Contractor Information",
    descriptor:
      "Project identification, governing-state details, and primary contractor contacts for the current issue.",
  },
  {
    key: "scope_summary",
    title: "Scope Summary",
    descriptor:
      "Active trade scope, selected tasks, major hazards, permits, and work-area assumptions for this phase.",
  },
  {
    key: "roles_responsibilities",
    title: "Roles and Responsibilities",
    descriptor:
      "Field leadership, competent-person authority, and responsibility assignments for safe execution and stop-work decisions.",
  },
  {
    key: "task_execution_modules",
    title: "Task Execution Modules",
    descriptor:
      "Task-specific planning, access, controls, permits, PPE, stop-work triggers, and handoff expectations for the active work face.",
  },
  {
    key: "hazard_control_sections",
    title: "Hazard Control Sections",
    descriptor:
      "Hazard-specific control guidance, exposure verification, permit triggers, and release criteria for the current phase.",
  },
  {
    key: "high_risk_work_programs",
    title: "High-Risk Work Programs",
    descriptor:
      "Program-level requirements for high-risk operations, specialty approvals, rescue readiness, and exposed-work boundaries.",
  },
  {
    key: "emergency_weather_housekeeping",
    title: "Emergency, Weather, Fire Prevention & Housekeeping",
    descriptor:
      "Emergency coordination, severe-weather response, fire prevention, housekeeping, and field-condition controls that remain active across the site.",
  },
  {
    key: "training_inspections_monitoring",
    title: "Training, Inspections, Monitoring & Recordkeeping",
    descriptor:
      "Training expectations, inspection routines, meetings, monitoring steps, and recordkeeping requirements needed to support field execution.",
  },
  {
    key: "close_out_appendices",
    title: "Close-Out, Lessons Learned & Appendices",
    descriptor:
      "Close-out expectations, handoff records, lessons learned, acknowledgements, and supporting appendix materials for the final issue.",
  },
];

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

function valueOrNA(value?: string | null) {
  return value?.trim() ? value.trim() : "N/A";
}

function finalValueOrNA(value?: string | null) {
  return normalizeFinalExportText(value) ?? "N/A";
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
    .replace(/^(Appendix\s+[A-Z])\.?\s+/i, "")
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
  const ppe = normalizePpeList(splitSentenceValues(valueAt(row, indexes.ppe)));
  const permits = normalizePermitList(splitSentenceValues(valueAt(row, indexes.permits)));
  const competency = splitSentenceValues(valueAt(row, indexes.competency));

  const scope = joinDisplayValues([trade, subTrade], "");
  const subject = activity || scope || "This work activity";
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
    "when it applies",
    "purpose",
    "hazard overview",
    "task scope and sequence",
    "program scope",
    "pre start verification",
    "required controls",
    "permits and ppe",
    "stop work triggers",
    "verification and handoff",
    "related interfaces",
    "applicable references",
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
      table: subsection.table
        ? {
            columns: subsection.table.columns.map(normalizeCompareToken),
            rows: subsection.table.rows.map((row) => row.map(normalizeCompareToken)),
          }
        : null,
    });

    if (seen.has(key)) return false;
    seen.add(key);
    return subsectionHasContent(subsection);
    });
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

function validateCsepRenderModel(model: CsepRenderModel) {
  const numberedSections = model.sections.map((section, index) => ({
    ...section,
    numberLabel: section.numberLabel?.trim() || String(index + 1),
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
    if (seenNumbers.has(numberLabel)) {
      throw new Error(`CSEP export validation failed: duplicate section number ${numberLabel}.`);
    }
    seenNumbers.add(numberLabel);

    const seenTitles = new Set<string>();
    section.subsections.forEach((subsection) => {
      const normalizedTitle = normalizeCompareToken(subsection.title);
      if (normalizedTitle) {
        if (seenTitles.has(normalizedTitle)) {
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

    validateNoRepeatedSentences(section);
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
        parts.push(`Minimum Responsibilities: ${responsibilitySentences.join(" ")}`);
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
        title: "Scope Summary",
        paragraphs,
        items,
      },
    ];
  }

  const columns = table.columns.map(normalizeToken);
  const tradeIndex = columns.findIndex((column) => column === "trade");
  const subTradeIndex = columns.findIndex((column) => column === "sub trade");
  const taskIndex = columns.findIndex((column) => column === "tasks");
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
  const taskTitles = uniqueItems(table.rows.map((row) => cleanFinalText(row[taskIndex] ?? "")));
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
      taskTitles.length
        ? `Current contractor scope includes ${taskTitles.join(", ")} for ${tradePackages.join(", ") || "the assigned trade package"}.`
        : null,
      hazards.length ? `Primary hazards include ${hazards.join(", ")}.` : null,
      permits.length ? `Anticipated permit triggers include ${permits.join(", ")}.` : null,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return [
    {
      title: "Scope Summary",
      paragraphs: uniqueItems([...paragraphs, synthesizedParagraph]),
      items,
    },
  ];
}

function mapSourceSectionToFixedSection(section: GeneratedSafetyPlanSection) {
  const key = normalizeToken(section.key);
  const title = normalizeToken(section.title);
  const combined = `${key} ${title}`;

  if (
    combined.includes("project information") ||
    combined.includes("contractor information") ||
    combined.includes("project overview") ||
    combined.includes("project site information")
  ) {
    return "project_contractor_information";
  }

  if (
    combined.includes("trade summary") ||
    combined.includes("scope of work") ||
    combined.includes("scope summary") ||
    combined.includes("project scope") ||
    combined.includes("purpose") ||
    combined.includes("how to use") ||
    combined.includes("company overview")
  ) {
    return "scope_summary";
  }

  if (
    combined.includes("roles and responsibilities") ||
    combined.includes("competent") ||
    combined.includes("organization chart")
  ) {
    return "roles_responsibilities";
  }

  if (
    combined.includes("task module") ||
    combined.includes("task execution") ||
    combined.includes("site controls") ||
    combined.includes("safe work") ||
    combined.includes("security and access") ||
    combined.includes("worker access") ||
    combined.includes("restricted area") ||
    combined.includes("visitor") ||
    combined.includes("delivery") ||
    combined.includes("subcontract") ||
    combined.includes("overlapping trades") ||
    combined.includes("trade conflict") ||
    combined.includes("permit") ||
    combined.includes("required controls")
  ) {
    return "task_execution_modules";
  }

  if (
    combined.includes("hazard module") ||
    combined.includes("hazard") ||
    combined.includes("risk") ||
    combined.includes("jsa") ||
    combined.includes("activity hazard") ||
    combined.includes("task hazard") ||
    combined.includes("selected hazards") ||
    combined.includes("life saving") ||
    combined.includes("ppe")
  ) {
    return "hazard_control_sections";
  }

  if (combined.includes("emergency") || combined.includes("incident")) {
    return "emergency_weather_housekeeping";
  }

  if (
    combined.includes("training") ||
    combined.includes("orientation") ||
    combined.includes("health and wellness") ||
    combined.includes("daily huddle") ||
    combined.includes("inspection") ||
    combined.includes("recordkeeping") ||
    combined.includes("continuous improvement") ||
    combined.includes("monitoring") ||
    combined.includes("oversight") ||
    combined.includes("meeting") ||
    combined.includes("drug") ||
    combined.includes("alcohol")
  ) {
    return "training_inspections_monitoring";
  }

  if (
    combined.includes("housekeeping") ||
    combined.includes("fire prevention") ||
    combined.includes("hot work")
  ) {
    return "emergency_weather_housekeeping";
  }

  if (
    combined.includes("program") ||
    combined.includes("environment") ||
    combined.includes("brownfield") ||
    combined.includes("contamination") ||
    combined.includes("rescue")
  ) {
    return "high_risk_work_programs";
  }

  if (
    combined.includes("acknowledgment") ||
    combined.includes("revision") ||
    combined.includes("review") ||
    combined.includes("disclaimer") ||
    combined.includes("lessons learned") ||
    combined.includes("closeout") ||
    combined.includes("close out")
  ) {
    return "close_out_appendices";
  }

  return null;
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
        paragraphs: uniqueItems(splitParagraphs(subsection.body)),
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

  if (leadingNarrativeParagraphs.length || initialItems.length || source.table?.rows.length) {
    subsections.push({
      title: "",
      paragraphs: leadingNarrativeParagraphs,
      items: initialItems,
      table: source.table ?? null,
    });
  }

  (source.subsections ?? []).forEach((subsection) => {
    const splitSubsectionParagraphs = splitInlineEnumeratedParagraphs(
      uniqueItems(splitParagraphs(subsection.body))
    );
    subsections.push({
      title: contextualizeSubsectionTitle(source.title, subsection.title),
      paragraphs: splitSubsectionParagraphs.paragraphs,
      items: uniqueItems([...splitSubsectionParagraphs.items, ...uniqueItems(subsection.bullets)]),
    });
  });

  return subsections.length ? dedupeTemplateSubsections(subsections) : [];
}

function toTemplateSection(source: GeneratedSafetyPlanSection): CsepTemplateSection {
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

  params.sourceSections
    .filter((section) => section.kind !== "front_matter")
    .forEach((section) => {
    const mappedKey = mapSourceSectionToFixedSection(section);
    if (!mappedKey) return;
    const existing = grouped.get(mappedKey) ?? [];
    existing.push(...toTemplateSubsections(section));
    grouped.set(mappedKey, existing);
    });

  return FIXED_SECTION_DEFINITIONS.flatMap((definition) => {
    const subsections = dedupeTemplateSubsections(grouped.get(definition.key) ?? []);
    if (!subsections.length) return [];

    return [
      {
        key: definition.key,
        title: definition.title,
        descriptor: definition.descriptor,
        kind: "main",
        subsections,
        closingTagline: null,
      },
    ];
  });
}

function meaningfulFieldRows(rows: CsepCoverMetadataRow[]) {
  return rows.filter((row) => normalizeCompareToken(row.value) !== "n a");
}

export function buildCsepRenderModelFromGeneratedDraft(
  draft: GeneratedSafetyPlanDraft
): CsepRenderModel {
  const structuredDraft = buildStructuredCsepDraft(draft, { finalIssueMode: true });
  const draftHasStructuredKinds = draft.sectionMap.some((section) =>
    ["front_matter", "main", "appendix"].includes(section.kind ?? "")
  );
  const contractorName = finalValueOrNA(draft.projectOverview.contractorCompany);
  const tradeLabels = uniqueValues(draft.operations.map((operation) => operation.tradeLabel));
  const subTradeLabels = uniqueValues(draft.operations.map((operation) => operation.subTradeLabel));
  const taskTitles = uniqueValues(draft.operations.map((operation) => operation.taskTitle));
  const legacySanitizedSections = draft.sectionMap.map(sanitizeGeneratedSection);
  const sanitizedSections = structuredDraft.sectionMap.map(sanitizeGeneratedSection);
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
  const coverMetadataRows = meaningfulFieldRows([
    { label: "Project Number", value: finalValueOrNA(draft.projectOverview.projectNumber) },
    { label: "Project Address", value: projectAddress },
    { label: "Owner / Client", value: finalValueOrNA(draft.projectOverview.ownerClient) },
    { label: "GC / CM", value: finalValueOrNA(draft.projectOverview.gcCm) },
    { label: "Contractor", value: contractorName },
    { label: "Prepared By", value: preparedBy },
    { label: "Date", value: issueLabel },
    { label: "Revision", value: structuredDraft.documentControl?.revision || "1.0" },
  ]);
  const frontMatterSections: CsepTemplateSection[] = [
    {
      key: "document_control",
      kind: "front_matter",
      title: "Document Control",
      descriptor: "Current issue information, project identifiers, and release metadata for this document.",
      subsections: coverMetadataRows.length
        ? [
            {
              title: "Document Control",
              table: {
                columns: ["Field", "Value"],
                rows: coverMetadataRows.map((row) => [row.label, row.value]),
              },
            },
          ]
        : [
            {
              title: "Document Control",
              paragraphs: ["Document-control details were not provided for this issue."],
            },
          ],
    },
    {
      key: "revision_history",
      kind: "front_matter",
      title: "Revision History",
      descriptor: "Issue history and approval record for the current CSEP release.",
      subsections: [
        {
          title: "Revision History",
          paragraphs: [],
        },
      ],
    },
    {
      key: "table_of_contents",
      kind: "front_matter",
      title: "Table of Contents",
      subsections: [],
    },
  ];
  const mainSections = buildCsepTemplateSections({
    projectName,
    contractorName,
    tradeLabel: joinDisplayValues(tradeLabels, "N/A"),
    subTradeLabel: joinDisplayValues(subTradeLabels, "N/A"),
    issueLabel,
    sourceSections: draftHasStructuredKinds ? sanitizedSections : legacySanitizedSections,
  });
  const appendixSections = sanitizedSections
    .filter((section) => section.kind === "appendix")
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map(toTemplateSection);

  return {
    projectName,
    contractorName,
    tradeLabel: joinDisplayValues(tradeLabels, "N/A"),
    subTradeLabel: joinDisplayValues(subTradeLabels, "N/A"),
    issueLabel,
    statusLabel: "Contractor Issue",
    preparedBy,
    coverSubtitleLines: [
      contractorName !== "N/A" ? contractorName : null,
      projectAddress !== "N/A" ? projectAddress : null,
      tradeLabels.length ? `Trade: ${joinDisplayValues(tradeLabels, "N/A")}` : null,
      ...(subTradeLabels.length ? [`Sub-trade: ${joinDisplayValues(subTradeLabels, "N/A")}`] : []),
      ...(taskTitles.length ? [`Tasks: ${taskTitles.join(", ")}`] : []),
      issueLabel ? `Issue Date: ${issueLabel}` : null,
    ].filter((line): line is string => Boolean(line)),
    coverMetadataRows,
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
        text,
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
        text,
        font: "Calibri",
        italics: true,
        size: 20,
        color: COLORS.gray,
      }),
    ],
    {
      style: STYLE_IDS.sectionDescriptor,
      keepNext: true,
      spacing: { before: 40, after: 180, line: 276 },
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

function subheading(text: string) {
  return makeParagraph(
    [
      new TextRun({
        text,
        font: "Calibri",
        bold: true,
        size: 24,
        color: COLORS.headingBlue,
      }),
    ],
    {
      style: STYLE_IDS.subheading,
      heading: HeadingLevel.HEADING_2,
      keepNext: true,
    }
  );
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
        text,
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
  return makeParagraph(
    [
      new TextRun({
        text: `${term}: `,
        font: "Calibri",
        bold: true,
        size: 21,
        color: COLORS.ink,
      }),
      new TextRun({
        text: definition,
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

function createRunningFooter() {
  return new Footer({
    children: [
      makeParagraph(
        [
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
  options?: { indent?: { left?: number; hanging?: number }; spacing?: { after?: number; line?: number } }
) {
  return makeParagraph(
    [
      new TextRun({
        text: `${label}: `,
        bold: true,
        font: "Calibri",
        size: 20,
        color: COLORS.deepBlue,
      }),
      new TextRun({
        text: value?.trim() ? value.trim() : "N/A",
        font: "Calibri",
        size: 20,
        color: COLORS.ink,
      }),
    ],
    {
      style: STYLE_IDS.body,
      spacing: options?.spacing ?? { after: 100, line: 276 },
      indent: options?.indent,
    }
  );
}

function metadataMatrixAsParagraphs(rows: CsepCoverMetadataRow[]) {
  return rows.map((row) => labeledFieldParagraph(row.label, row.value));
}

function revisionHistoryAsParagraphs(rows: CsepRevisionEntry[]) {
  const data = rows.length
    ? rows
    : [
        {
          revision: "1.0",
          date: todayIssueLabel(),
          description: "Initial issuance",
          preparedBy: "Authorized Contractor Representative",
          approvedBy: "Authorized Contractor Representative",
        },
      ];

  return data.map((row, index) =>
    bodyParagraph(
      [
        `${index + 1}. Rev. ${row.revision} (${row.date}). `,
        `${row.description} `,
        `Prepared by: ${row.preparedBy}. Approved by: ${row.approvedBy}.`,
      ].join(""),
      { spacing: { after: 140, line: 276 } }
    )
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
  const coverChildren: Paragraph[] = [
    subtleDivider(),
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
      }
    ),
    makeParagraph(
      [
        new TextRun({
          text: "Project-specific safety, environmental, and permit requirements for field execution",
          italics: true,
          font: "Calibri",
          size: 21,
          color: COLORS.gray,
        }),
      ],
      {
        style: STYLE_IDS.coverSubtitle,
        alignment: AlignmentType.CENTER,
      }
    ),
  ];

  if (model.projectName.trim() && model.projectName !== "N/A") {
    coverChildren.push(
      makeParagraph(
        [
          new TextRun({
            text: model.projectName,
            font: "Calibri",
            bold: true,
            size: 26,
            color: COLORS.ink,
          }),
        ],
        {
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
        }
      )
    );
  }

  if (model.contractorName.trim() && model.contractorName !== "N/A") {
    coverChildren.push(
      bodyParagraph(model.contractorName, {
        alignment: AlignmentType.CENTER,
        style: STYLE_IDS.coverMeta,
      })
    );
  }

  model.coverSubtitleLines
    .filter(
      (line) =>
        line.trim() &&
        line.trim() !== "N/A" &&
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

  coverChildren.push(new Paragraph({ children: [] }));
  coverChildren.push(
    bodyParagraph(
      "Approvals",
      {
        style: STYLE_IDS.subheading,
      }
    )
  );
  coverChildren.push(...approvalSignatureAsParagraphs(model.approvalLines));

  return coverChildren;
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

  const title =
    cleanFinalText(row[0]) ??
    cleanFinalText(`${cleanFinalText(table.columns[0]) ?? "Item"} ${rowIndex + 1}`);
  if (!title || normalizeCompareToken(title) === "n a") {
    return null;
  }

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

function displayHeadingForSection(section: CsepTemplateSection, sectionNumber: number) {
  if (section.title.trim() && section.numberLabel && section.title.trim().startsWith(section.numberLabel)) {
    return section.title.trim();
  }

  const title = stripExistingNumberPrefix(section.title);

  if (section.numberLabel?.trim()) {
    return `${section.numberLabel} ${title}`.trim();
  }

  if (section.kind === "main") {
    return `${sectionNumber}. ${title}`.trim();
  }

  return section.title.trim();
}

function sectionPrefix(section: CsepTemplateSection, sectionNumber: number) {
  if (section.numberLabel?.trim()) {
    return section.kind === "front_matter"
      ? section.numberLabel.trim()
      : normalizeDisplayPrefix(section.numberLabel.trim());
  }

  return String(sectionNumber);
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
  const entries = [
    ...model.frontMatterSections
      .filter((section) => section.key !== "table_of_contents")
      .map((section) => displayHeadingForSection(section, 0)),
    ...model.sections.map((section, index) => displayHeadingForSection(section, index + 1)),
    ...model.appendixSections.map((section) => displayHeadingForSection(section, 0)),
    "Disclaimer",
  ];

  return [
    sectionHeading("Table of Contents"),
    ...entries.map((entry) =>
      bodyParagraph(entry, {
        style: STYLE_IDS.contentsEntry,
      })
    ),
  ];
}

function renderSection(sectionNumber: number, section: CsepTemplateSection) {
  const children: Paragraph[] = [
    sectionHeading(displayHeadingForSection(section, sectionNumber), sectionHeadingTone(section)),
  ];
  if (section.descriptor?.trim()) {
    children.push(sectionDescriptorParagraph(section.descriptor.trim()));
  }
  const basePrefix = sectionPrefix(section, sectionNumber);
  let topLevelItemIndex = 0;
  let nestedSubsectionCount = 0;

  section.subsections.forEach((subsection) => {
    const distinctSubheading = shouldRenderSubheading(section.title, subsection);
    const renderMode =
      section.key === "definitions_and_abbreviations" ? "definitions" : "numbered";
    const paragraphSplit = splitStructuredSourceItems(subsection.paragraphs);
    const itemSplit = splitStructuredSourceItems(subsection.items);

    let subsectionLabel = basePrefix;
    let itemPrefixBase = basePrefix;

    if (distinctSubheading) {
      nestedSubsectionCount += 1;
      subsectionLabel = `${basePrefix}.${topLevelItemIndex + nestedSubsectionCount}`;
      itemPrefixBase = subsectionLabel;
      children.push(
        numberedParagraph(subsectionLabel, stripExistingNumberPrefix(subsection.title), {
          indent: { left: INDENTS.childLeft, hanging: INDENTS.childHanging },
          spacing: { before: 120, after: 90, line: 276 },
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
      if (distinctSubheading) {
        const childNumber = `${itemPrefixBase}.${entryIndex + 1}`;
        children.push(
          numberedParagraph(childNumber, entry.title, {
            indent: { left: INDENTS.grandchildLeft, hanging: INDENTS.grandchildHanging },
            spacing: { before: 60, after: 60, line: 276 },
          })
        );
        children.push(
          bodyParagraph(entry.body, {
            indent: { left: INDENTS.grandchildBodyLeft },
            spacing: { after: 170, line: 276 },
          })
        );
        return;
      }

      topLevelItemIndex += 1;
      children.push(
        numberedParagraph(`${basePrefix}.${topLevelItemIndex}`, entry.title, {
          indent: { left: INDENTS.childLeft, hanging: INDENTS.childHanging },
          spacing: { before: 90, after: 70, line: 276 },
        })
      );
      children.push(
        bodyParagraph(entry.body, {
          indent: { left: INDENTS.childBodyLeft },
          spacing: { after: 180, line: 276 },
        })
      );
    });

    itemSplit.plain.forEach((item, itemIndex) => {
      if (distinctSubheading) {
        children.push(
          numberedParagraph(`${itemPrefixBase}.${structuredEntries.length + itemIndex + 1}`, item, {
            indent: { left: INDENTS.grandchildLeft, hanging: INDENTS.grandchildHanging },
            spacing: { before: 50, after: 110, line: 276 },
          })
        );
      } else {
        topLevelItemIndex += 1;
        children.push(
          numberedParagraph(`${basePrefix}.${topLevelItemIndex}`, item, {
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

      if (distinctSubheading) {
        appendTableRowsAsNumberedParagraphs(
          children,
          subsection.table,
          itemPrefixBase,
          structuredEntries.length + itemSplit.plain.length,
          { renderMode }
        );
      } else {
        topLevelItemIndex = appendTopLevelTableRows(
          children,
          subsection.table,
          basePrefix,
          topLevelItemIndex,
          { renderMode }
        );
      }
    }
  });

  return children;
}

export async function createCsepDocument(model: CsepRenderModel) {
  const children: Paragraph[] = [];

  children.push(...createCover(model));

  if (!model.frontMatterSections.length) {
    children.push(pageBreakParagraph());
    children.push(sectionHeading("Revision History"));
    children.push(...revisionHistoryAsParagraphs(model.revisionHistory));
    children.push(pageBreakParagraph());
    children.push(...createContents(model));
  }

  const frontMatterKeys = new Set(model.frontMatterSections.map((section) => section.key));

  model.frontMatterSections.forEach((section, index) => {
    if (index === 0) {
      children.push(pageBreakParagraph());
    } else {
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    }
    if (section.key === "revision_history") {
      children.push(sectionHeading(section.title));
      if (section.descriptor?.trim()) {
        children.push(sectionDescriptorParagraph(section.descriptor.trim()));
      }
      children.push(...revisionHistoryAsParagraphs(model.revisionHistory));
      return;
    }
    if (section.key === "table_of_contents") {
      children.push(...createContents(model));
      return;
    }
    children.push(...renderSection(0, section));
  });

  if (model.frontMatterSections.length && !frontMatterKeys.has("revision_history")) {
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    children.push(sectionHeading("Revision History"));
    children.push(...revisionHistoryAsParagraphs(model.revisionHistory));
  }

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
    children.push(...renderSection(index + 1, section));
  });

  model.appendixSections.forEach((section) => {
    children.push(pageBreakParagraph());
    children.push(...renderSection(0, section));
  });

  children.push(pageBreakParagraph());
  children.push(sectionHeading("Disclaimer"));
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
              before: 220,
              after: 100,
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
              before: 40,
              after: 180,
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
              before: 140,
              after: 70,
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
          default: createRunningFooter(),
        },
        children,
      },
    ],
  });
}

export async function renderCsepRenderModel(model: CsepRenderModel) {
  const normalizedModel = normalizeRenderModel(model);
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

export async function renderGeneratedCsepDocx(draft: GeneratedSafetyPlanDraft) {
  return renderCsepRenderModel(buildCsepRenderModelFromGeneratedDraft(draft));
}
