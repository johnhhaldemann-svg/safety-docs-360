import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import {
  CONTRACTOR_SAFETY_BLUEPRINT_TITLE,
  SITE_SAFETY_BLUEPRINT_TITLE,
} from "@/lib/safetyBlueprintLabels";
import { DOCUMENT_DISCLAIMER_LINES } from "@/lib/legal";
import {
  getTradeConflictProfile,
  normalizeProjectDeliveryType,
  projectDeliveryTypeLabel,
} from "@/lib/tradeConflictCatalog";
import { formatGcCmPartnersForExport, normalizeGcCmPartnerEntries } from "@/lib/csepGcCmPartners";
import type {
  GeneratedSafetyPlanDraft,
  GeneratedSafetyPlanSection,
} from "@/types/safety-intelligence";

type DocChild = Paragraph | Table;

type BlueprintDocumentMetadata = {
  title: string;
  shortTitle: string;
  projectName: string;
  contractorName: string;
  issueLabel: string;
  statusLabel: string;
  preparedBy: string;
};

type SummaryField = {
  label: string;
  value: string;
};

type GroupedSnapshotPackage = {
  label: string;
  taskTitles: string[];
  hazardCategories: string[];
  requiredControls: string[];
  ppeRequirements: string[];
  permitTriggers: string[];
  locationLabels: string[];
};

type SectionTable = NonNullable<GeneratedSafetyPlanSection["table"]>;

type SectionDisplayOptions = {
  indexLabel: string;
  title: string;
};

type ContentsEntry = {
  prefix: string;
  title: string;
};

type ContentsGroup = {
  label: string;
  entries: ContentsEntry[];
};

const STYLE_IDS = {
  body: "BlueprintBody",
  coverKicker: "BlueprintCoverKicker",
  coverTitle: "BlueprintCoverTitle",
  coverProject: "BlueprintCoverProject",
  sectionEyebrow: "BlueprintSectionEyebrow",
  sectionHeading: "BlueprintSectionHeading",
  subheading: "BlueprintSubheading",
  calloutTitle: "BlueprintCalloutTitle",
  contentsGroupLabel: "BlueprintContentsGroupLabel",
  contentsEntry: "BlueprintContentsEntry",
  appendixHeading: "BlueprintAppendixHeading",
} as const;

const COLORS = {
  ink: "1F2933",
  muted: "66758A",
  accent: "1F4E78",
  accentDark: "173B63",
  accentSoft: "EAF1F8",
  accentLighter: "F6F9FC",
  border: "C6D4E1",
  borderStrong: "8EA9C1",
  white: "FFFFFF",
} as const;

const cachedLogoAssets = new Map<string, Buffer>();
const cachedTradeConflictAssets = new Map<
  GeneratedSafetyPlanDraft["projectDeliveryType"],
  Buffer
>();
const TRANSPARENT_PNG_FALLBACK = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9p5xGXsAAAAASUVORK5CYII=",
  "base64"
);

function titleForDocumentType(documentType: GeneratedSafetyPlanDraft["documentType"]) {
  if (documentType === "pshsep") {
    return SITE_SAFETY_BLUEPRINT_TITLE;
  }

  return CONTRACTOR_SAFETY_BLUEPRINT_TITLE;
}

function todayIssueLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

async function getOptionalCompanyLogo(draft: GeneratedSafetyPlanDraft) {
  const provenance = (draft.provenance ?? {}) as Record<string, unknown>;
  const rawPath =
    (typeof provenance.companyLogoPath === "string" && provenance.companyLogoPath.trim()) ||
    (typeof provenance.companyLogoPublicPath === "string" && provenance.companyLogoPublicPath.trim()) ||
    "";

  if (!rawPath) return null;

  const normalizedPath = rawPath.startsWith("public\\") || rawPath.startsWith("public/")
    ? rawPath
    : rawPath.startsWith("/") || rawPath.startsWith("\\")
      ? `public${rawPath}`
      : rawPath;
  const resolvedPath = resolve(/* turbopackIgnore: true */ process.cwd(), normalizedPath);

  if (cachedLogoAssets.has(resolvedPath)) {
    return cachedLogoAssets.get(resolvedPath) ?? null;
  }

  try {
    const logo = await readFile(resolvedPath);
    cachedLogoAssets.set(resolvedPath, logo);
    return logo;
  } catch {
    return null;
  }
}

async function getTradeConflictAppendixSvg(
  projectDeliveryType: GeneratedSafetyPlanDraft["projectDeliveryType"]
) {
  const normalizedProjectDeliveryType = normalizeProjectDeliveryType(projectDeliveryType);
  const cached = cachedTradeConflictAssets.get(normalizedProjectDeliveryType);
  if (cached) return cached;

  const profile = getTradeConflictProfile(normalizedProjectDeliveryType);
  const svg = await readFile(
    resolve(/* turbopackIgnore: true */ process.cwd(), profile.appendixAssetPath)
  );
  cachedTradeConflictAssets.set(normalizedProjectDeliveryType, svg);
  return svg;
}

export function safeFilePart(value: string, fallback: string) {
  const cleaned = value.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  return cleaned || fallback;
}

export function valueOrNA(value?: string | null) {
  return value?.trim() ? value.trim() : "N/A";
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  );
}

function joinValues(values: string[], fallback = "N/A") {
  return values.length ? values.join(", ") : fallback;
}

function buildMetadata(draft: GeneratedSafetyPlanDraft): BlueprintDocumentMetadata {
  return {
    title: titleForDocumentType(draft.documentType),
    shortTitle: draft.documentType === "pshsep" ? "Site Blueprint" : "Contractor Blueprint",
    projectName: valueOrNA(draft.projectOverview.projectName),
    contractorName: valueOrNA(draft.projectOverview.contractorCompany),
    issueLabel: todayIssueLabel(),
    statusLabel: "Draft Issue",
    preparedBy: "SafetyDocs360 Draft Builder",
  };
}

function buildSummaryFields(draft: GeneratedSafetyPlanDraft): SummaryField[] {
  const tradeLabels = uniqueValues(draft.operations.map((operation) => operation.tradeLabel));
  const subTradeLabels = uniqueValues(draft.operations.map((operation) => operation.subTradeLabel));
  const projectDeliveryType = normalizeProjectDeliveryType(draft.projectDeliveryType);

  return [
    { label: "Project Name", value: valueOrNA(draft.projectOverview.projectName) },
    { label: "Project Number", value: valueOrNA(draft.projectOverview.projectNumber) },
    { label: "Project Address", value: valueOrNA(draft.projectOverview.projectAddress) },
    { label: "Owner / Client", value: valueOrNA(draft.projectOverview.ownerClient) },
    {
      label: "GC / CM / program partners (list all with site safety or logistics authority)",
      value: formatGcCmPartnersForExport(normalizeGcCmPartnerEntries(draft.projectOverview.gcCm)),
    },
    { label: "Location", value: valueOrNA(draft.projectOverview.location) },
    { label: "Contractor", value: valueOrNA(draft.projectOverview.contractorCompany) },
    { label: "Delivery Type", value: projectDeliveryTypeLabel(projectDeliveryType) },
    { label: "Primary Trade", value: joinValues(tradeLabels) },
    { label: "Sub-trade", value: joinValues(subTradeLabels) },
    { label: "Schedule", value: valueOrNA(draft.projectOverview.schedule) },
    { label: "Operations", value: String(draft.operations.length || 0) },
    { label: "Draft Title", value: valueOrNA(draft.title) },
  ];
}

function locationLabelForOperation(operation: GeneratedSafetyPlanDraft["operations"][number]) {
  const parts = [
    operation.workAreaLabel?.trim(),
    operation.locationGrid?.trim() ? `Grid ${operation.locationGrid.trim()}` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length ? parts.join(" | ") : null;
}

function groupOperationsForSnapshot(draft: GeneratedSafetyPlanDraft) {
  const grouped = new Map<string, GroupedSnapshotPackage>();

  draft.operations.forEach((operation) => {
    const tradeLabel = operation.tradeLabel?.trim() || operation.tradeCode?.trim() || "Unassigned Trade";
    const subTradeLabel = operation.subTradeLabel?.trim() || operation.subTradeCode?.trim() || null;
    const key = `${tradeLabel}__${subTradeLabel ?? ""}`;
    const current = grouped.get(key) ?? {
      label: subTradeLabel ? `${tradeLabel} / ${subTradeLabel}` : tradeLabel,
      taskTitles: [],
      hazardCategories: [],
      requiredControls: [],
      ppeRequirements: [],
      permitTriggers: [],
      locationLabels: [],
    };
    const locationLabel = locationLabelForOperation(operation);

    grouped.set(key, {
      ...current,
      taskTitles: uniqueValues([...current.taskTitles, operation.taskTitle]),
      hazardCategories: uniqueValues([...current.hazardCategories, ...operation.hazardCategories]),
      requiredControls: uniqueValues([...current.requiredControls, ...operation.requiredControls]),
      ppeRequirements: uniqueValues([...current.ppeRequirements, ...operation.ppeRequirements]),
      permitTriggers: uniqueValues([...current.permitTriggers, ...operation.permitTriggers]),
      locationLabels: uniqueValues([
        ...current.locationLabels,
        ...(locationLabel ? [locationLabel] : []),
      ]),
    });
  });

  return Array.from(grouped.values());
}

function buildHighRiskSnapshotPackages(draft: GeneratedSafetyPlanDraft) {
  const groupedPackages = groupOperationsForSnapshot(draft);

  if (groupedPackages.length) {
    return groupedPackages;
  }

  return [
    {
      label: `Overall Risk Focus | ${draft.riskSummary.band.toUpperCase()}`,
      taskTitles: uniqueValues(draft.operations.map((operation) => operation.taskTitle)),
      hazardCategories: draft.ruleSummary.hazardCategories.length
        ? draft.ruleSummary.hazardCategories
        : ["No explicit hazard categories captured in the draft."],
      requiredControls: draft.ruleSummary.requiredControls.length
        ? draft.ruleSummary.requiredControls
        : ["No additional required controls were captured."],
      ppeRequirements: draft.ruleSummary.ppeRequirements.length
        ? draft.ruleSummary.ppeRequirements
        : ["Standard project PPE applies."],
      permitTriggers: draft.ruleSummary.permitTriggers,
      locationLabels: [],
    },
  ];
}

function buildRevisionFields(metadata: BlueprintDocumentMetadata, draft: GeneratedSafetyPlanDraft) {
  return [
    { label: "Prepared By", value: metadata.preparedBy },
    { label: "Issued", value: metadata.issueLabel },
    { label: "Status", value: metadata.statusLabel },
    { label: "Conflict Summary", value: `${draft.conflictSummary.total} tracked conflicts` },
    {
      label: "Priority Focus",
      value: joinValues(draft.riskSummary.priorities, "No priority notes were captured."),
    },
    {
      label: "Training Focus",
      value: joinValues(draft.ruleSummary.trainingRequirements, "No special training flags captured."),
    },
  ];
}

function buildTradePackageOverviewFields(draft: GeneratedSafetyPlanDraft) {
  return buildHighRiskSnapshotPackages(draft).map((pkg) => ({
    label: pkg.label,
    value: [
      pkg.locationLabels.length ? `Areas: ${joinValues(pkg.locationLabels)}` : null,
      `Tasks: ${joinValues(pkg.taskTitles, "N/A")}`,
      `Permits: ${joinValues(pkg.permitTriggers, "None")}`,
    ]
      .filter(Boolean)
      .join(" | "),
  }));
}

function prefixDepth(prefix: string) {
  return Math.max(1, prefix.split(".").length);
}

function splitStructuredParagraphs(text: string | null | undefined) {
  if (!text?.trim()) return [];

  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function makeBodyParagraph(
  text: string,
  alignment = AlignmentType.LEFT,
  options: {
    prefix?: string;
    keepNext?: boolean;
    keepLines?: boolean;
    indentLeft?: number;
    spacingAfter?: number;
  } = {}
) {
  return new Paragraph({
    style: STYLE_IDS.body,
    alignment,
    keepNext: options.keepNext,
    keepLines: options.keepLines,
    spacing: { after: options.spacingAfter ?? 90 },
    indent: options.indentLeft ? { left: options.indentLeft } : undefined,
    children: [
      ...(options.prefix ? [new TextRun({ text: `${options.prefix} ` })] : []),
      new TextRun({ text }),
    ],
  });
}

function makeLabeledParagraph(
  label: string,
  value: string,
  options: {
    prefix?: string;
    indentLeft?: number;
    spacingAfter?: number;
    keepNext?: boolean;
  } = {}
) {
  return new Paragraph({
    style: STYLE_IDS.body,
    keepNext: options.keepNext,
    keepLines: true,
    indent: options.indentLeft ? { left: options.indentLeft } : undefined,
    spacing: { after: options.spacingAfter ?? 50 },
    children: [
      ...(options.prefix ? [new TextRun({ text: `${options.prefix} ` })] : []),
      new TextRun({
        text: `${label}: `,
        bold: true,
      }),
      new TextRun({
        text: value.trim() ? value.trim() : "N/A",
      }),
    ],
  });
}

function makeNumberedItem(prefix: string, text: string) {
  const depth = prefixDepth(prefix);

  return new Paragraph({
    style: STYLE_IDS.body,
    keepLines: true,
    indent: {
      left: 180 * (depth + 1),
      hanging: 0,
    },
    spacing: { after: 35 },
    children: [new TextRun({ text: `${prefix} ${text}` })],
  });
}

function isProgramSection(section: GeneratedSafetyPlanSection) {
  return section.key.startsWith("program_");
}

function makeSectionDivider(options: SectionDisplayOptions) {
  return [
    new Paragraph({
      style: STYLE_IDS.sectionEyebrow,
      keepNext: true,
      children: [new TextRun({ text: options.indexLabel })],
    }),
    new Paragraph({
      style: STYLE_IDS.sectionHeading,
      heading: HeadingLevel.HEADING_1,
      keepNext: true,
      children: [new TextRun({ text: options.title })],
    }),
  ];
}

function makeSubheading(text: string) {
  return new Paragraph({
    style: STYLE_IDS.subheading,
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
    children: [new TextRun({ text })],
  });
}

function makeRuleParagraph() {
  return new Paragraph({
    spacing: { after: 120 },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        color: COLORS.borderStrong,
        size: 4,
      },
    },
    children: [new TextRun({ text: "" })],
  });
}

function createSectionIntroCallout(text: string) {
  return new Paragraph({
    style: STYLE_IDS.body,
    keepNext: true,
    spacing: { after: 100 },
    indent: { left: 120, right: 120 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      left: { style: BorderStyle.SINGLE, size: 12, color: COLORS.accent },
      right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
    },
    shading: {
      type: ShadingType.CLEAR,
      color: "auto",
      fill: COLORS.accentLighter,
    },
    children: [
      new TextRun({
        text: "Section Summary: ",
        bold: true,
        color: COLORS.accentDark,
      }),
      new TextRun({ text }),
    ],
  });
}

function createSummaryParagraphs(sectionNumber: string, fields: SummaryField[]) {
  return fields.map((field, index) =>
    makeLabeledParagraph(field.label, field.value, {
      prefix: `${sectionNumber}.${index + 1}`,
      indentLeft: 240,
    })
  );
}

function createSnapshotNarrative(sectionNumber: string, draft: GeneratedSafetyPlanDraft) {
  return buildHighRiskSnapshotPackages(draft).flatMap((pkg, index) => {
    const prefix = `${sectionNumber}.${index + 1}`;
    const rows: Array<{ label: string; value: string }> = [
      { label: "Tasks", value: joinValues(pkg.taskTitles, "N/A") },
      { label: "Primary Hazards", value: joinValues(pkg.hazardCategories, "N/A") },
      { label: "Key Controls", value: joinValues(pkg.requiredControls, "N/A") },
      { label: "Required PPE", value: joinValues(pkg.ppeRequirements, "N/A") },
    ];

    if (pkg.permitTriggers.length) {
      rows.push({ label: "Permits", value: joinValues(pkg.permitTriggers, "None") });
    }

    if (pkg.locationLabels.length) {
      rows.splice(1, 0, { label: "Primary Work Areas", value: joinValues(pkg.locationLabels) });
    }

    return [
      makeSubheading(`${prefix} ${pkg.label}`),
      ...rows.map((row, rowIndex) =>
        makeLabeledParagraph(row.label, row.value, {
          prefix: `${prefix}.${rowIndex + 1}`,
          indentLeft: 240,
        })
      ),
    ];
  });
}

function createTradePackageOverview(sectionNumber: string, draft: GeneratedSafetyPlanDraft) {
  return buildTradePackageOverviewFields(draft).flatMap((field, index) => [
    makeLabeledParagraph(field.label, field.value, {
      prefix: `${sectionNumber}.${index + 1}`,
      indentLeft: 240,
    }),
  ]);
}

function createExecutionSnapshotNarrative(
  sectionNumber: string,
  draft: GeneratedSafetyPlanDraft
) {
  return buildHighRiskSnapshotPackages(draft).flatMap((pkg, index) => {
    const prefix = `${sectionNumber}.${index + 1}`;
    const rows: Array<{ label: string; value: string }> = [
      { label: "Key Tasks", value: joinValues(pkg.taskTitles, "N/A") },
      { label: "Primary Hazards", value: joinValues(pkg.hazardCategories, "N/A") },
      { label: "Required Controls", value: joinValues(pkg.requiredControls, "N/A") },
      { label: "Required PPE", value: joinValues(pkg.ppeRequirements, "N/A") },
    ];

    if (pkg.permitTriggers.length) {
      rows.push({ label: "Permits", value: joinValues(pkg.permitTriggers, "None") });
    }

    if (pkg.locationLabels.length) {
      rows.splice(1, 0, {
        label: "Primary Work Areas",
        value: joinValues(pkg.locationLabels),
      });
    }

    return [
      makeSubheading(`${prefix} ${pkg.label}`),
      ...rows.map((row, rowIndex) =>
        makeLabeledParagraph(row.label, row.value, {
          prefix: `${prefix}.${rowIndex + 1}`,
          indentLeft: 240,
        })
      ),
    ];
  });
}

function buildContentsGroups(draft: GeneratedSafetyPlanDraft): ContentsGroup[] {
  return [
    {
      label: "FRONT MATTER",
      entries: [
        { prefix: "1.", title: "Purpose & How to Use This Blueprint" },
        { prefix: "2.", title: "Field Execution Snapshot" },
      ],
    },
    {
      label: "DETAILED SECTIONS",
      entries: [
        ...draft.sectionMap.map((section, index) => ({
          prefix: `${index + 3}.`,
          title: section.title,
        })),
        {
          prefix: `${draft.sectionMap.length + 3}.`,
          title: "Leadership Review & Continuous Improvement",
        },
      ],
    },
    {
      label: "APPENDICES",
      entries: [
        { prefix: "Appendix A.", title: "Disclaimer" },
        { prefix: "Appendix B.", title: "Trade Conflict Coordination Tree" },
      ],
    },
  ];
}

function createContentsEntry(entry: ContentsEntry) {
  return new Paragraph({
    style: STYLE_IDS.contentsEntry,
    keepLines: true,
    indent: {
      left: 1620,
      hanging: 1020,
    },
    children: [
      new TextRun({
        text: `${entry.prefix} `,
        bold: true,
        color: COLORS.accentDark,
      }),
      new TextRun({
        text: entry.title,
        color: COLORS.ink,
      }),
    ],
  });
}

function createContentsGroup(group: ContentsGroup) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderStrong },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderStrong },
      left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: {
              type: ShadingType.CLEAR,
              color: "auto",
              fill: COLORS.accentLighter,
            },
            margins: {
              top: 120,
              bottom: 120,
              left: 160,
              right: 160,
            },
            children: [
              new Paragraph({
                style: STYLE_IDS.contentsGroupLabel,
                children: [new TextRun({ text: group.label })],
              }),
              ...group.entries.map(createContentsEntry),
            ],
          }),
        ],
      }),
    ],
  });
}

function createContentsList(draft: GeneratedSafetyPlanDraft) {
  const groups = buildContentsGroups(draft);

  return groups.flatMap((group, index) => [
    createContentsGroup(group),
    ...(index < groups.length - 1
      ? [
          new Paragraph({
            spacing: { after: 140 },
            children: [new TextRun({ text: "" })],
          }),
        ]
      : []),
  ]);
}

function createStructuredTable(
  table: SectionTable
) {
  const width = Math.max(15, Math.floor(100 / Math.max(1, table.columns.length)));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderStrong },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderStrong },
      left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
    },
    rows: [
      new TableRow({
        children: table.columns.map((column) =>
          new TableCell({
            width: { size: width, type: WidthType.PERCENTAGE },
            shading: {
              type: ShadingType.CLEAR,
              color: "auto",
              fill: COLORS.accentSoft,
            },
            margins: { top: 80, bottom: 80, left: 90, right: 90 },
            children: [
              new Paragraph({
                keepNext: true,
                children: [
                  new TextRun({
                    text: column,
                    bold: true,
                    color: COLORS.accentDark,
                    font: "Aptos",
                  }),
                ],
              }),
            ],
          })
        ),
      }),
      ...table.rows.map((row) =>
        new TableRow({
          children: table.columns.map((_, columnIndex) =>
            new TableCell({
              width: { size: width, type: WidthType.PERCENTAGE },
              margins: { top: 80, bottom: 80, left: 90, right: 90 },
              children: [
                new Paragraph({
                  style: STYLE_IDS.body,
                  children: [new TextRun({ text: row[columnIndex]?.trim() || "N/A" })],
                }),
              ],
            })
          ),
        })
      ),
    ],
  });
}

function renderSectionTable(
  sectionNumber: string,
  table: SectionTable,
  startIndex = 1
) {
  const populatedRows = table.rows.filter((row) =>
    row.some((value) => typeof value === "string" && value.trim().length > 0)
  );
  if (!populatedRows.length) {
    return [makeBodyParagraph("No structured detail was captured for this section.")];
  }

  const fieldValueTable =
    table.columns.length === 2 &&
    table.columns.every((column) => Boolean(column?.trim())) &&
    ["field", "label"].includes(table.columns[0].trim().toLowerCase()) &&
    table.columns[1].trim().toLowerCase() === "value";

  if (fieldValueTable) {
    return populatedRows.map((row, rowIndex) =>
      makeLabeledParagraph(row[0] || "Field", row[1] || "N/A", {
        prefix: `${sectionNumber}.${startIndex + rowIndex}`,
        indentLeft: 240,
      })
    );
  }

  return [createStructuredTable({ ...table, rows: populatedRows })];
}

function createRunningHeader(metadata: BlueprintDocumentMetadata) {
  return new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderStrong },
          left: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
          right: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
        },
        rows: [
          new TableRow({
            children: [
              headerCell(`${metadata.title} | ${metadata.shortTitle}`, AlignmentType.LEFT),
              headerCell(metadata.projectName, AlignmentType.RIGHT),
            ],
          }),
        ],
      }),
    ],
  });
}

function headerCell(text: string, alignment: (typeof AlignmentType)[keyof typeof AlignmentType]) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      bottom: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      left: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      right: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
    },
    margins: {
      top: 0,
      bottom: 60,
      left: 0,
      right: 0,
    },
    children: [
      new Paragraph({
        alignment,
        children: [
          new TextRun({
            text,
            size: 16,
            color: COLORS.muted,
            font: "Aptos",
          }),
        ],
      }),
    ],
  });
}

function createRunningFooter(metadata: BlueprintDocumentMetadata) {
  return new Footer({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderStrong },
          bottom: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
          left: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
          right: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
        },
        rows: [
          new TableRow({
            children: [
              footerCell("SafetyDocs360", AlignmentType.LEFT),
              footerCellWithPageNumbers(metadata.statusLabel),
            ],
          }),
        ],
      }),
    ],
  });
}

function footerCell(text: string, alignment: (typeof AlignmentType)[keyof typeof AlignmentType]) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      bottom: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      left: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      right: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
    },
    margins: {
      top: 60,
      bottom: 0,
      left: 0,
      right: 0,
    },
    children: [
      new Paragraph({
        alignment,
        children: [
          new TextRun({
            text,
            size: 16,
            color: COLORS.muted,
            font: "Aptos",
          }),
        ],
      }),
    ],
  });
}

function footerCellWithPageNumbers(statusLabel: string) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      bottom: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      left: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      right: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
    },
    margins: {
      top: 60,
      bottom: 0,
      left: 0,
      right: 0,
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: `${statusLabel} | Page `,
            size: 16,
            color: COLORS.muted,
            font: "Aptos",
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 16,
            color: COLORS.muted,
            font: "Aptos",
          }),
          new TextRun({
            text: " of ",
            size: 16,
            color: COLORS.muted,
            font: "Aptos",
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 16,
            color: COLORS.muted,
            font: "Aptos",
          }),
        ],
      }),
    ],
  });
}

async function createCoverChildren(
  metadata: BlueprintDocumentMetadata,
  draft: GeneratedSafetyPlanDraft
) {
  const companyLogo = await getOptionalCompanyLogo(draft);
  const tradeLabels = uniqueValues(draft.operations.map((operation) => operation.tradeLabel));
  const subTradeLabels = uniqueValues(draft.operations.map((operation) => operation.subTradeLabel));
  const scopeLine = [joinValues(tradeLabels, ""), joinValues(subTradeLabels, "")]
    .filter(Boolean)
    .join(" | ");

  const children: DocChild[] = [];

  if (companyLogo) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 220 },
        children: [
          new ImageRun({
            type: "png",
            data: companyLogo,
            transformation: {
              width: 220,
              height: 88,
            },
          }),
        ],
      })
    );
  }

  children.push(
    new Paragraph({
      style: STYLE_IDS.coverKicker,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "PROJECT-SPECIFIC SAFETY DOCUMENT" })],
    }),
    new Paragraph({
      style: STYLE_IDS.coverTitle,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: metadata.title })],
    }),
    new Paragraph({
      style: STYLE_IDS.coverProject,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: metadata.projectName })],
    }),
    makeRuleParagraph(),
    new Paragraph({
      style: STYLE_IDS.body,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Contractor: ${metadata.contractorName}` })],
    }),
  );

  if (scopeLine) {
    children.push(
      new Paragraph({
        style: STYLE_IDS.body,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: scopeLine })],
      })
    );
  }

  children.push(
    new Paragraph({
      style: STYLE_IDS.body,
      alignment: AlignmentType.CENTER,
      spacing: { before: 260 },
      children: [
        new TextRun({
          text: `${metadata.statusLabel} | Issued ${metadata.issueLabel} | Prepared by ${metadata.preparedBy}`,
        }),
      ],
    })
  );

  return children;
}

function createFrontMatterChildren(
  metadata: BlueprintDocumentMetadata,
  draft: GeneratedSafetyPlanDraft
) {
  const children: DocChild[] = [];
  const frontMatterSections = [
    {
      title: "Document Summary",
      children: createSummaryParagraphs("1", buildSummaryFields(draft)),
    },
    {
      title: "High-Risk Work Snapshot",
      children: createSnapshotNarrative("2", draft),
    },
    {
      title: "Revision / Prepared By",
      children: createSummaryParagraphs("3", buildRevisionFields(metadata, draft)),
    },
    ...(draft.operations.length
      ? [
          {
            title: "Trade Package Overview",
            children: createTradePackageOverview("4", draft),
          },
        ]
      : []),
    {
      title: "Contents",
      children: createContentsList(draft),
    },
  ];

  frontMatterSections.forEach((section, index) => {
    const sectionNumber = index + 1;
    children.push(
      ...makeSectionDivider({
        indexLabel: String(sectionNumber).padStart(2, "0"),
        title: section.title,
      })
    );
    children.push(...section.children);

    if (index < frontMatterSections.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });
  children.push(new Paragraph({ children: [new PageBreak()] }));

  return children;
}

function createAppendixHeading(text: string) {
  return new Paragraph({
    style: STYLE_IDS.appendixHeading,
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text })],
  });
}

async function createBodyChildren(draft: GeneratedSafetyPlanDraft) {
  const children: DocChild[] = [];
  const groupedPackages = buildHighRiskSnapshotPackages(draft);
  const projectName = valueOrNA(draft.projectOverview.projectName);
  const contractorName = valueOrNA(draft.projectOverview.contractorCompany);
  const operationCountLabel = `${draft.operations.length} selected operation${
    draft.operations.length === 1 ? "" : "s"
  }`;
  const groupedPackageCountLabel = `${groupedPackages.length} grouped trade package${
    groupedPackages.length === 1 ? "" : "s"
  }`;

  children.push(
    ...makeSectionDivider({
      indexLabel: "01",
      title: "1. Purpose & How to Use This Blueprint",
    })
  );
  children.push(
    makeBodyParagraph(
      `This blueprint consolidates the selected operations, hazards, required controls, permit needs, and training expectations for ${projectName}. Use it as the field-ready reference for mobilization, orientation, pre-task planning, permit review, and supervisory walkdowns.`
    ),
    makeLabeledParagraph("Project", projectName, {
      prefix: "1.1",
      indentLeft: 240,
    }),
    makeLabeledParagraph("Scope Covered", `${operationCountLabel} across ${groupedPackageCountLabel}.`, {
      prefix: "1.2",
      indentLeft: 240,
    }),
    makeLabeledParagraph(
      "Use During",
      "Mobilization, site orientation, daily coordination, permit review, and supervision updates.",
      {
        prefix: "1.3",
        indentLeft: 240,
      }
    ),
    makeLabeledParagraph(
      "Update Trigger",
      "Revise this blueprint whenever scope, sequencing, work areas, site restrictions, or governing requirements change.",
      {
        prefix: "1.4",
        indentLeft: 240,
      }
    )
  );

  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(
    ...makeSectionDivider({
      indexLabel: "02",
      title: "2. Field Execution Snapshot",
    })
  );
  children.push(
    makeBodyParagraph(
      `The active work packages below summarize the selected scope for ${contractorName}. Use this section as the operational bridge between the front-matter overview and the detailed requirements that follow in the body of the document.`
    )
  );
  children.push(...createExecutionSnapshotNarrative("2", draft));

  draft.sectionMap.forEach((section, index) => {
    const programSection = isProgramSection(section);
    const sectionNumber = String(index + 3);
    const hasPreTableContent = Boolean(
      section.summary || section.body || section.bullets?.length || section.subsections?.length
    );

    children.push(new Paragraph({ children: [new PageBreak()] }));

    children.push(
      ...makeSectionDivider({
        indexLabel: sectionNumber.padStart(2, "0"),
        title: `${sectionNumber}. ${section.title}`,
      })
    );

    if (section.summary) {
      children.push(
        programSection
          ? makeBodyParagraph(section.summary, AlignmentType.LEFT, { keepNext: true })
          : createSectionIntroCallout(section.summary)
      );
    }

    if (section.body) {
      splitStructuredParagraphs(section.body).forEach((paragraph, paragraphIndex, paragraphs) => {
        children.push(
          makeBodyParagraph(paragraph, AlignmentType.LEFT, {
            keepNext: paragraphIndex < paragraphs.length - 1,
          })
        );
      });
    }

    if (section.bullets?.length) {
      section.bullets.forEach((item, bulletIndex) =>
        children.push(makeNumberedItem(`${sectionNumber}.${bulletIndex + 1}`, item))
      );
    }

    if (section.subsections?.length) {
      section.subsections.forEach((subsection, subsectionIndex) => {
        const subsectionPrefix = `${sectionNumber}.${subsectionIndex + 1}`;
        children.push(makeSubheading(`${subsectionPrefix} ${subsection.title}`));

        if (subsection.body) {
          splitStructuredParagraphs(subsection.body).forEach((paragraph, paragraphIndex, paragraphs) => {
            children.push(
              makeBodyParagraph(paragraph, AlignmentType.LEFT, {
                keepNext:
                  paragraphIndex < paragraphs.length - 1 || subsection.bullets.length > 0,
              })
            );
          });
        }

        subsection.bullets.forEach((item, bulletIndex) => {
          children.push(makeNumberedItem(`${subsectionPrefix}.${bulletIndex + 1}`, item));
        });
      });
    }

    if (section.table) {
      if (section.table.columns.length > 2 && hasPreTableContent) {
        const tableIndex = `${sectionNumber}.${(section.subsections?.length ?? 0) + 1}`;
        children.push(makeSubheading(`${tableIndex} Structured Details`));
      }
      children.push(
        ...renderSectionTable(
          sectionNumber,
          section.table,
          (section.subsections?.length ?? 0) + 1
        )
      );
    }
  });

  const closingSectionNumber = String(draft.sectionMap.length + 3);
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(
    ...makeSectionDivider({
      indexLabel: closingSectionNumber.padStart(2, "0"),
      title: `${closingSectionNumber}. Leadership Review & Continuous Improvement`,
    })
  );
  children.push(
    makeBodyParagraph(
      "Use this closing section to confirm that priorities, coordination risks, training expectations, and document-control updates remain aligned with the selected work before issue or revision."
    ),
    makeLabeledParagraph(
      "Priority Focus",
      joinValues(draft.riskSummary.priorities, "No priority notes were captured."),
      {
        prefix: `${closingSectionNumber}.1`,
        indentLeft: 240,
      }
    ),
    makeLabeledParagraph(
      "Conflict Tracking",
      `${draft.conflictSummary.total} tracked conflict${
        draft.conflictSummary.total === 1 ? "" : "s"
      } | Highest severity: ${draft.conflictSummary.highestSeverity}`,
      {
        prefix: `${closingSectionNumber}.2`,
        indentLeft: 240,
      }
    ),
    makeLabeledParagraph(
      "Training Focus",
      joinValues(
        draft.ruleSummary.trainingRequirements,
        "No special training flags were captured."
      ),
      {
        prefix: `${closingSectionNumber}.3`,
        indentLeft: 240,
      }
    ),
    makeLabeledParagraph(
      "Update Trigger",
      "Reissue this blueprint after a major incident, a change in sequencing, a scope revision, or a material change to site controls or governing requirements.",
      {
        prefix: `${closingSectionNumber}.4`,
        indentLeft: 240,
      }
    )
  );

  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(createAppendixHeading("Appendix A. Disclaimer"));
  DOCUMENT_DISCLAIMER_LINES.forEach((line) => {
    children.push(makeBodyParagraph(line));
  });

  const projectDeliveryType = normalizeProjectDeliveryType(draft.projectDeliveryType);
  const profile = getTradeConflictProfile(projectDeliveryType);
  const svg = await getTradeConflictAppendixSvg(projectDeliveryType);

  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(createAppendixHeading("Appendix B. Trade Conflict Coordination Tree"));
  children.push(
    makeBodyParagraph(
      `${projectDeliveryTypeLabel(projectDeliveryType)} profile. Use this visual with the Trade Conflict Coordination Framework section to compare the baseline coordination map against the project-specific simultaneous-operations findings.`
    )
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 160 },
      children: [
        new ImageRun({
          type: "svg",
          data: svg,
          fallback: {
            type: "png",
            data: TRANSPARENT_PNG_FALLBACK,
          },
          transformation: {
            width: 430,
            height: projectDeliveryType === "renovation" ? 920 : 920,
          },
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      style: STYLE_IDS.body,
      children: [new TextRun({ text: `${profile.title} | ${profile.subtitle}` })],
    })
  );

  return children;
}

function createBlueprintStyles() {
  return {
    default: {
      document: {
        run: {
          font: "Aptos",
          size: 21,
          color: COLORS.ink,
        },
        paragraph: {
          spacing: {
            after: 90,
            line: 280,
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
            after: 90,
            line: 280,
          },
        },
        run: {
          font: "Aptos",
          size: 21,
          color: COLORS.ink,
        },
      },
      {
        id: STYLE_IDS.coverKicker,
        name: STYLE_IDS.coverKicker,
        paragraph: {
          spacing: {
            after: 120,
          },
        },
        run: {
          font: "Aptos",
          size: 18,
          color: COLORS.muted,
          bold: true,
          allCaps: true,
        },
      },
      {
        id: STYLE_IDS.coverTitle,
        name: STYLE_IDS.coverTitle,
        paragraph: {
          spacing: {
            after: 220,
          },
        },
        run: {
          font: "Aptos Display",
          size: 44,
          color: COLORS.accentDark,
          bold: true,
        },
      },
      {
        id: STYLE_IDS.coverProject,
        name: STYLE_IDS.coverProject,
        paragraph: {
          spacing: {
            after: 140,
          },
        },
        run: {
          font: "Aptos",
          size: 25,
          color: COLORS.ink,
          bold: true,
        },
      },
      {
        id: STYLE_IDS.sectionEyebrow,
        name: STYLE_IDS.sectionEyebrow,
        paragraph: {
          spacing: {
            before: 140,
            after: 10,
          },
        },
        run: {
          font: "Aptos",
          size: 16,
          color: COLORS.muted,
          bold: true,
          allCaps: true,
        },
      },
      {
        id: STYLE_IDS.sectionHeading,
        name: STYLE_IDS.sectionHeading,
        paragraph: {
          spacing: {
            after: 90,
          },
        },
        run: {
          font: "Aptos Display",
          size: 30,
          color: COLORS.accent,
          bold: true,
        },
      },
      {
        id: STYLE_IDS.subheading,
        name: STYLE_IDS.subheading,
        paragraph: {
          spacing: {
            before: 85,
            after: 65,
          },
        },
        run: {
          font: "Aptos",
          size: 22,
          color: COLORS.accentDark,
          bold: true,
        },
      },
      {
        id: STYLE_IDS.calloutTitle,
        name: STYLE_IDS.calloutTitle,
        paragraph: {
          spacing: {
            after: 35,
          },
        },
        run: {
          font: "Aptos",
          size: 18,
          color: COLORS.accentDark,
          bold: true,
        },
      },
      {
        id: STYLE_IDS.contentsGroupLabel,
        name: STYLE_IDS.contentsGroupLabel,
        paragraph: {
          spacing: {
            after: 80,
          },
        },
        run: {
          font: "Aptos",
          size: 16,
          color: COLORS.muted,
          bold: true,
          allCaps: true,
        },
      },
      {
        id: STYLE_IDS.contentsEntry,
        name: STYLE_IDS.contentsEntry,
        paragraph: {
          spacing: {
            after: 35,
          },
        },
        run: {
          font: "Aptos",
          size: 20,
          color: COLORS.ink,
        },
      },
      {
        id: STYLE_IDS.appendixHeading,
        name: STYLE_IDS.appendixHeading,
        paragraph: {
          spacing: {
            after: 120,
          },
        },
        run: {
          font: "Aptos Display",
          size: 28,
          color: COLORS.accentDark,
          bold: true,
        },
      },
    ],
  } as const;
}

export async function createBlueprintDocument(draft: GeneratedSafetyPlanDraft) {
  const metadata = buildMetadata(draft);
  const coverChildren = await createCoverChildren(metadata, draft);
  const renderedBodyChildren = await createBodyChildren(draft);
  const bodyChildren = [
    ...createFrontMatterChildren(metadata, draft),
    ...renderedBodyChildren,
  ];

  return new Document({
    styles: createBlueprintStyles(),
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1800,
              right: 1260,
              bottom: 1260,
              left: 1260,
              header: 540,
              footer: 240,
              gutter: 0,
            },
          },
        },
        children: coverChildren,
      },
      {
        properties: {
          page: {
            margin: {
              top: 1008,
              right: 972,
              bottom: 864,
              left: 972,
              header: 540,
              footer: 240,
              gutter: 0,
            },
            pageNumbers: {
              start: 1,
            },
          },
        },
        headers: {
          default: createRunningHeader(metadata),
        },
        footers: {
          default: createRunningFooter(metadata),
        },
        children: bodyChildren,
      },
    ],
  });
}
