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
  fallbackTitle: string;
  fallbackItems: (context: BuildCsepTemplateSectionsParams) => string[];
};

const STYLE_IDS = {
  body: "CsepBody",
  coverTitle: "CsepCoverTitle",
  coverSubtitle: "CsepCoverSubtitle",
  coverMeta: "CsepCoverMeta",
  sectionHeading: "CsepSectionHeading",
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
} as const;

const FIXED_SECTION_DEFINITIONS: FixedSectionDefinition[] = [
  {
    key: "policy_statement",
    title: "Contractor Safety Policy Statement",
    fallbackTitle: "Purpose and Scope",
    fallbackItems: ({ contractorName, projectName }) => [
      `${contractorName} establishes this CSEP as the governing safety expectation for work performed on ${projectName}.`,
      "Safety is a condition of employment, and work shall not proceed when hazards are uncontrolled.",
    ],
  },
  {
    key: "project_site_information",
    title: "Project & Site Information",
    fallbackTitle: "Project Overview",
    fallbackItems: ({ projectName, tradeLabel, subTradeLabel }) => [
      `${projectName} is the active project addressed by this contractor CSEP.`,
      `Current scope includes ${joinDisplayValues([tradeLabel, subTradeLabel], "the selected contractor work scope")}.`,
    ],
  },
  {
    key: "roles_responsibilities",
    title: "Roles, Responsibilities & Competent Persons",
    fallbackTitle: "Responsible Person",
    fallbackItems: ({ contractorName }) => [
      `${contractorName} shall assign competent supervision to oversee field execution, hazard controls, and coordination requirements.`,
    ],
  },
  {
    key: "safety_organization_chart",
    title: "Safety Organization Chart",
    fallbackTitle: "Reporting Structure",
    fallbackItems: ({ contractorName }) => [
      `${contractorName} shall communicate the project safety reporting chain, escalation path, and stop-work contacts before field work begins.`,
    ],
  },
  {
    key: "hazard_identification",
    title: "Hazard Identification, Risk Assessment & JSAs",
    fallbackTitle: "Hazard Review",
    fallbackItems: () => [
      "Hazards, risk exposures, and activity-specific controls shall be reviewed before work starts and whenever conditions change.",
    ],
  },
  {
    key: "site_controls",
    title: "Site-Specific Controls & Safe Work Procedures",
    fallbackTitle: "Key Requirements and Procedures",
    fallbackItems: () => [
      "Site-specific controls, access restrictions, permit triggers, and sequencing constraints shall be reviewed with affected crews before work begins.",
    ],
  },
  {
    key: "life_saving_rules",
    title: "Life-Saving Rules & Stop-Work Authority",
    fallbackTitle: "Stop-Work Authority",
    fallbackItems: () => [
      "Any worker may stop work when an unsafe condition exists, the work plan changes, or permit requirements are not satisfied.",
    ],
  },
  {
    key: "ppe_matrix",
    title: "Personal Protective Equipment (PPE) Matrix",
    fallbackTitle: "Required PPE",
    fallbackItems: () => [
      "Required PPE shall be identified for each work activity and enforced throughout the active scope.",
    ],
  },
  {
    key: "emergency_response",
    title: "Emergency Response, Incident Reporting & Notification",
    fallbackTitle: "Emergency Coordination",
    fallbackItems: ({ issueLabel }) => [
      `Emergency notification, assembly, and escalation procedures shall remain active for the current issue dated ${issueLabel ?? "the current draft"}.`,
    ],
  },
  {
    key: "training_orientation",
    title: "Training, Safety Orientation & Daily Huddles",
    fallbackTitle: "Training Requirements",
    fallbackItems: () => [
      "Workers shall complete required orientation, training, and pre-task communication before starting work.",
    ],
  },
  {
    key: "weather_requirements",
    title: "Weather Requirements and Severe Weather Response",
    fallbackTitle: "Weather Controls",
    fallbackItems: () => [
      "Weather conditions shall be monitored continuously, and work plans shall be revised when wind, lightning, heat, cold, or storm conditions affect safety.",
    ],
  },
  {
    key: "housekeeping_fire_prevention",
    title: "Housekeeping, Fire Prevention & Hot-Work Permit",
    fallbackTitle: "Housekeeping and Fire Prevention",
    fallbackItems: () => [
      "Housekeeping, ignition-source control, and hot-work permitting requirements shall be maintained throughout the work area.",
    ],
  },
  {
    key: "tool_equipment_inspection",
    title: "Tool & Equipment Inspection Program",
    fallbackTitle: "Inspection Expectations",
    fallbackItems: () => [
      "Tools and equipment shall be inspected before use and removed from service when damaged, defective, or unsuitable for the task.",
    ],
  },
  {
    key: "environmental_protection",
    title: "Environmental Protection & Brownfield Controls",
    fallbackTitle: "Environmental Controls",
    fallbackItems: () => [
      "Environmental controls, contamination-response measures, and waste-handling requirements shall be followed when site conditions warrant.",
    ],
  },
  {
    key: "subcontractor_management",
    title: "Subcontractor Management",
    fallbackTitle: "Coordination Expectations",
    fallbackItems: () => [
      "Subcontractors and overlapping trades shall coordinate work areas, permits, and sequencing before activities begin.",
    ],
  },
  {
    key: "drug_alcohol_workplace",
    title: "Drug & Alcohol-Free Workplace",
    fallbackTitle: "Workplace Requirements",
    fallbackItems: () => [
      "Personnel shall report fit for duty and comply with the project's drug- and alcohol-free workplace requirements.",
    ],
  },
  {
    key: "recordkeeping_inspections",
    title: "Recordkeeping & Inspections",
    fallbackTitle: "Documentation and Records",
    fallbackItems: () => [
      "Inspection records, training verifications, corrective actions, and required documentation shall be maintained for the active work scope.",
    ],
  },
  {
    key: "plan_review_acknowledgement",
    title: "Plan Review, Acknowledgement & Revision Log",
    fallbackTitle: "Plan Review",
    fallbackItems: () => [
      "This CSEP shall be reviewed, acknowledged, and updated whenever scope, conditions, or responsible personnel change.",
    ],
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
  return value
    .replace(/\bContractor Blueprint\b/g, CONTRACTOR_SAFETY_BLUEPRINT_TITLE)
    .replace(/\bSite Blueprint\b/g, CONTRACTOR_SAFETY_BLUEPRINT_TITLE)
    .replace(/\bBlueprint\b/g, CONTRACTOR_SAFETY_BLUEPRINT_TITLE)
    .trim();
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

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function stripExistingNumberPrefix(value: string) {
  return value
    .replace(/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i, "")
    .replace(/^(Appendix\s+[A-Z])\.?\s+/i, "")
    .trim();
}

function normalizeDisplayPrefix(value: string) {
  return value.endsWith(".0") ? value.slice(0, -2) : value;
}

function mapSourceSectionToFixedSection(section: GeneratedSafetyPlanSection) {
  const key = normalizeToken(section.key);
  const title = normalizeToken(section.title);
  const combined = `${key} ${title}`;

  if (
    combined.includes("project information") ||
    combined.includes("contractor information") ||
    combined.includes("project overview") ||
    combined.includes("trade summary")
  ) {
    return "project_site_information";
  }

  if (combined.includes("roles and responsibilities") || combined.includes("competent")) {
    return "roles_responsibilities";
  }

  if (combined.includes("organization chart")) {
    return "safety_organization_chart";
  }

  if (
    combined.includes("hazard") ||
    combined.includes("risk") ||
    combined.includes("jsa") ||
    combined.includes("activity hazard") ||
    combined.includes("task hazard") ||
    combined.includes("selected hazards")
  ) {
    return "hazard_identification";
  }

  if (combined.includes("ppe")) {
    return "ppe_matrix";
  }

  if (combined.includes("emergency") || combined.includes("incident")) {
    return "emergency_response";
  }

  if (
    combined.includes("training") ||
    combined.includes("orientation") ||
    combined.includes("health and wellness") ||
    combined.includes("daily huddle")
  ) {
    return "training_orientation";
  }

  if (combined.includes("weather")) {
    return "weather_requirements";
  }

  if (
    combined.includes("housekeeping") ||
    combined.includes("fire prevention") ||
    combined.includes("hot work")
  ) {
    return "housekeeping_fire_prevention";
  }

  if (combined.includes("tool") || combined.includes("equipment")) {
    return "tool_equipment_inspection";
  }

  if (
    combined.includes("environment") ||
    combined.includes("brownfield") ||
    combined.includes("contamination")
  ) {
    return "environmental_protection";
  }

  if (
    combined.includes("subcontract") ||
    combined.includes("security and access") ||
    combined.includes("overlapping trades") ||
    combined.includes("trade conflict")
  ) {
    return "subcontractor_management";
  }

  if (combined.includes("drug") || combined.includes("alcohol")) {
    return "drug_alcohol_workplace";
  }

  if (
    combined.includes("recordkeeping") ||
    combined.includes("inspection") ||
    combined.includes("continuous improvement")
  ) {
    return "recordkeeping_inspections";
  }

  if (
    combined.includes("acknowledgment") ||
    combined.includes("revision") ||
    combined.includes("review") ||
    combined.includes("disclaimer")
  ) {
    return "plan_review_acknowledgement";
  }

  if (
    combined.includes("stop work") ||
    combined.includes("enforcement") ||
    combined.includes("corrective action") ||
    combined.includes("general safety expectations") ||
    combined.includes("life saving")
  ) {
    return "life_saving_rules";
  }

  if (
    combined.includes("scope of work") ||
    combined.includes("site specific") ||
    combined.includes("permit") ||
    combined.includes("required controls") ||
    combined.includes("program") ||
    combined.includes("safe work")
  ) {
    return "site_controls";
  }

  if (combined.includes("reference")) {
    return "policy_statement";
  }

  return "policy_statement";
}

function toTemplateSubsections(source: GeneratedSafetyPlanSection): CsepTemplateSubsection[] {
  const subsections: CsepTemplateSubsection[] = [];
  const leadingParagraphs = uniqueItems([
    ...splitParagraphs(source.summary),
    ...splitParagraphs(source.body),
  ]);
  const leadingItems = uniqueItems(source.bullets ?? []);

  if (leadingParagraphs.length || leadingItems.length || source.table?.rows.length) {
    subsections.push({
      title: source.title,
      paragraphs: leadingParagraphs,
      items: leadingItems,
      table: source.table ?? null,
    });
  }

  (source.subsections ?? []).forEach((subsection) => {
    subsections.push({
      title: subsection.title,
      paragraphs: uniqueItems(splitParagraphs(subsection.body)),
      items: uniqueItems(subsection.bullets),
    });
  });

  return subsections.length
    ? subsections
    : [
        {
          title: source.title,
          items: ["Project-specific content will be completed during final contractor review."],
        },
      ];
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
  const mainSections = params.sourceSections.filter((section) => section.kind === "main");

  if (mainSections.length > 0) {
    return mainSections.sort((left, right) => (left.order ?? 0) - (right.order ?? 0)).map(toTemplateSection);
  }

  const grouped = new Map<string, CsepTemplateSubsection[]>();

  params.sourceSections.forEach((section) => {
    const mappedKey = mapSourceSectionToFixedSection(section);
    const existing = grouped.get(mappedKey) ?? [];
    existing.push(...toTemplateSubsections(section));
    grouped.set(mappedKey, existing);
  });

  return FIXED_SECTION_DEFINITIONS.map((definition) => {
    const subsections = grouped.get(definition.key) ?? [
      {
        title: definition.fallbackTitle,
        items: definition.fallbackItems(params),
      },
    ];

    return {
      key: definition.key,
      title: definition.title,
      kind: "main",
      subsections,
      closingTagline: null,
    };
  });
}

export function buildCsepRenderModelFromGeneratedDraft(
  draft: GeneratedSafetyPlanDraft
): CsepRenderModel {
  const structuredDraft = buildStructuredCsepDraft(draft);
  const tradeLabels = uniqueValues(draft.operations.map((operation) => operation.tradeLabel));
  const subTradeLabels = uniqueValues(draft.operations.map((operation) => operation.subTradeLabel));
  const taskTitles = uniqueValues(draft.operations.map((operation) => operation.taskTitle));
  const sanitizedSections = structuredDraft.sectionMap.map(sanitizeGeneratedSection);
  const issueLabel = structuredDraft.documentControl?.issueDate || todayIssueLabel();
  const preparedBy = structuredDraft.documentControl?.preparedBy || "SafetyDocs360 AI Draft Builder";
  const projectName = valueOrNA(draft.projectOverview.projectName);
  const projectAddress = valueOrNA(draft.projectOverview.projectAddress);
  const contractorName = valueOrNA(draft.projectOverview.contractorCompany);
  const frontMatterSections = sanitizedSections
    .filter((section) => section.kind === "front_matter")
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map(toTemplateSection);
  const mainSections = buildCsepTemplateSections({
    projectName,
    contractorName,
    tradeLabel: joinDisplayValues(tradeLabels, "N/A"),
    subTradeLabel: joinDisplayValues(subTradeLabels, "N/A"),
    issueLabel,
    sourceSections: sanitizedSections,
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
    statusLabel: "Draft Issue",
    preparedBy,
    coverSubtitleLines: [
      projectAddress,
      `Trade: ${joinDisplayValues(tradeLabels, "N/A")}`,
      ...(subTradeLabels.length ? [`Sub-trade: ${joinDisplayValues(subTradeLabels, "N/A")}`] : []),
      ...(taskTitles.length ? [`Tasks: ${taskTitles.join(", ")}`] : []),
    ],
    coverMetadataRows: [
      { label: "Project Number", value: valueOrNA(draft.projectOverview.projectNumber) },
      { label: "Project Address", value: projectAddress },
      { label: "Owner / Client", value: valueOrNA(draft.projectOverview.ownerClient) },
      { label: "GC / CM", value: valueOrNA(draft.projectOverview.gcCm) },
      { label: "Contractor", value: contractorName },
      { label: "Prepared By", value: preparedBy },
      { label: "Date", value: issueLabel },
      { label: "Revision", value: structuredDraft.documentControl?.revision || "1.0" },
    ],
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
        approvedBy: structuredDraft.documentControl?.approvedBy || "Pending approval",
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
  indent?: { left?: number };
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

function numberedParagraph(numberLabel: string, text: string) {
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
      indent: { left: 180 },
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

function labeledFieldParagraph(label: string, value: string) {
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
      spacing: { after: 100, line: 276 },
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
          preparedBy: "SafetyDocs360 Draft Builder",
          approvedBy: "Pending approval",
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
    bodyParagraph(`${model.contractorName} | Contractor Logo / Letterhead`, {
      alignment: AlignmentType.LEFT,
      style: STYLE_IDS.coverMeta,
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

  model.coverSubtitleLines
    .filter((line) => line.trim() && line.trim() !== "N/A")
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
    bodyParagraph("Project / Document Control", {
      style: STYLE_IDS.subheading,
    })
  );
  coverChildren.push(...metadataMatrixAsParagraphs(model.coverMetadataRows));
  coverChildren.push(
    bodyParagraph("Revision History", {
      style: STYLE_IDS.subheading,
    })
  );
  coverChildren.push(...revisionHistoryAsParagraphs(model.revisionHistory));
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
  priorItemCount: number
) {
  if (!table.rows.length) return;

  table.rows.forEach((row, rowIndex) => {
    const num = `${subsectionLabel}.${priorItemCount + rowIndex + 1}`;
    const text = table.columns
      .map((column, columnIndex) => `${column}: ${row[columnIndex]?.trim() || "N/A"}`)
      .join(" ");
    children.push(numberedParagraph(num, text));
  });
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
    return normalizeDisplayPrefix(section.numberLabel.trim());
  }

  return String(sectionNumber);
}

function isDistinctSubheading(sectionTitle: string, subsectionTitle: string) {
  return normalizeToken(stripExistingNumberPrefix(sectionTitle)) !== normalizeToken(stripExistingNumberPrefix(subsectionTitle));
}

function appendParagraphs(children: Paragraph[], paragraphs?: string[]) {
  (paragraphs ?? []).forEach((paragraph) => {
    children.push(bodyParagraph(paragraph));
  });
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
  const basePrefix = sectionPrefix(section, sectionNumber);

  section.subsections.forEach((subsection, subsectionIndex) => {
    const distinctSubheading = subsection.title.trim()
      ? isDistinctSubheading(section.title, subsection.title)
      : false;
    const subsectionLabel = `${basePrefix}.${subsectionIndex + 1}`;
    const itemPrefixBase = subsectionLabel;

    if (distinctSubheading) {
      children.push(subheading(`${subsectionLabel} ${stripExistingNumberPrefix(subsection.title)}`));
    }

    appendParagraphs(children, subsection.paragraphs);

    (subsection.items ?? []).forEach((item, itemIndex) => {
      children.push(numberedParagraph(`${itemPrefixBase}.${itemIndex + 1}`, item));
    });

    if (subsection.table?.rows.length) {
      appendTableRowsAsNumberedParagraphs(
        children,
        subsection.table,
        subsectionLabel,
        (subsection.items ?? []).length
      );
    }
  });

  return children;
}

export async function createCsepDocument(model: CsepRenderModel) {
  const children: Paragraph[] = [];

  children.push(...createCover(model));

  if (!model.frontMatterSections.length) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(sectionHeading("Revision History"));
    children.push(...revisionHistoryAsParagraphs(model.revisionHistory));
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...createContents(model));
  }

  const frontMatterKeys = new Set(model.frontMatterSections.map((section) => section.key));

  model.frontMatterSections.forEach((section) => {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    if (section.key === "revision_history") {
      children.push(sectionHeading(section.title));
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
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(sectionHeading("Revision History"));
    children.push(...revisionHistoryAsParagraphs(model.revisionHistory));
  }

  if (model.frontMatterSections.length && !frontMatterKeys.has("table_of_contents")) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...createContents(model));
  }

  model.sections.forEach((section, index) => {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...renderSection(index + 1, section));
  });

  model.appendixSections.forEach((section) => {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...renderSection(0, section));
  });

  children.push(new Paragraph({ children: [new PageBreak()] }));
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
              after: 160,
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
              after: 160,
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
              before: 360,
              after: 140,
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
          id: STYLE_IDS.subheading,
          name: STYLE_IDS.subheading,
          paragraph: {
            spacing: {
              before: 220,
              after: 90,
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
  const doc = await createCsepDocument(model);
  const buffer = await Packer.toBuffer(doc);

  return {
    body: new Uint8Array(buffer),
    filename: getSafetyBlueprintDraftFilename(model.filenameProjectPart, "csep").replace(
      "_Draft",
      ""
    ),
  };
}

export async function renderGeneratedCsepDocx(draft: GeneratedSafetyPlanDraft) {
  return renderCsepRenderModel(buildCsepRenderModelFromGeneratedDraft(draft));
}
