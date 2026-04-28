import { extractResponsesApiOutputText } from "@/lib/ai/responses";
import {
  CSEP_FORMAT_SECTION_OPTIONS,
  getCsepFormatDefinition,
} from "@/lib/csepBuilder";
import { renderGeneratedCsepDocx } from "@/lib/csep/csep-renderer";
import { normalizeGcCmPartnerEntries } from "@/lib/csepGcCmPartners";
import {
  extractBuilderReviewDocumentText,
  generateBuilderProgramAiReview,
  type BuilderProgramAiReview,
} from "@/lib/builderDocumentAiReview";
import { getOpenAiApiBaseUrl, resolveOpenAiCompatibleModelId } from "@/lib/openaiClient";
import { serverLog } from "@/lib/serverLog";
import type {
  GeneratedSafetyPlanDraft,
  GeneratedSafetyPlanSection,
  RiskBand,
} from "@/types/safety-intelligence";

const DEFAULT_REBUILD_MODEL = "gpt-4o-mini";
const MAX_SOURCE_TEXT = 85000;
const MAX_REFERENCE_TEXT = 45000;

type CompletedCsepRebuildSection = {
  key: (typeof CSEP_FORMAT_SECTION_OPTIONS)[number]["value"];
  body: string;
  bullets: string[];
  subsections: Array<{
    title: string;
    body: string;
    bullets: string[];
  }>;
};

type CompletedCsepRebuildPayload = {
  title: string;
  documentControl: {
    documentNumber: string;
    revision: string;
    preparedBy: string;
    reviewedBy: string;
    approvedBy: string;
  };
  projectOverview: {
    projectName: string;
    projectNumber: string;
    projectAddress: string;
    ownerClient: string;
    gcCm: string | string[];
    contractorCompany: string;
    schedule: string;
    location: string;
  };
  operations: {
    tradeLabel: string;
    subTradeLabel: string;
    taskTitles: string[];
    equipmentUsed: string[];
    workConditions: string[];
    hazardCategories: string[];
    permitTriggers: string[];
    ppeRequirements: string[];
    requiredControls: string[];
    siteRestrictions: string[];
    conflicts: string[];
  };
  trainingRequirements: string[];
  riskBand: RiskBand;
  riskPriorities: string[];
  sections: CompletedCsepRebuildSection[];
};

function compactWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeStructuredText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => compactWhitespace(value)).filter(Boolean))
  );
}

function normalizeToken(value: string | null | undefined) {
  return compactWhitespace(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueByNormalized(values: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const normalized = normalizeToken(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(value);
  }
  return next;
}

function trimTo(value: string, max: number) {
  const normalized = compactWhitespace(value);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3).trim()}...`;
}

function trimStructuredText(value: string, max: number) {
  const normalized = normalizeStructuredText(value);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3).trim()}\n...`;
}

function buildSourceOutline(value: string, maxItems = 30) {
  const lines = normalizeStructuredText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const outline = lines.filter((line) => {
    if (line.length > 140) return false;
    if (/^\d+(?:\.\d+)*\s+/.test(line)) return true;
    if (/^(appendix|section)\b/i.test(line)) return true;
    if (/^[A-Z][A-Za-z/&,\- ]{4,}$/.test(line) && !line.endsWith(".")) return true;
    return false;
  });

  return uniqueStrings(outline).slice(0, maxItems);
}

type SourceSectionBlock = {
  heading: string;
  lines: string[];
};

const SOURCE_SECTION_ALIASES: Partial<
  Record<(typeof CSEP_FORMAT_SECTION_OPTIONS)[number]["value"], string[]>
> = {
  company_overview_and_safety_philosophy: [
    "company overview",
    "safety philosophy",
    "policy statement",
    "goals and objectives",
  ],
  project_scope_and_trade_specific_activities: [
    "scope of work",
    "work scope",
    "trade activities",
    "project scope",
  ],
  roles_and_responsibilities: [
    "roles and responsibilities",
    "responsibilities",
    "project team",
    "contacts",
    "key personnel",
  ],
  regulatory_framework: [
    "regulatory framework",
    "osha references",
    "standards",
    "codes and standards",
  ],
  contractor_safety_meetings_and_engagement: [
    "training",
    "instruction",
    "competency",
    "orientation",
    "certification",
  ],
  emergency_preparedness_and_response: [
    "emergency",
    "incident response",
    "medical response",
    "rescue",
    "evacuation",
  ],
  personal_protective_equipment: [
    "personal protective equipment",
    "ppe",
    "protective equipment",
  ],
  hse_elements_and_site_specific_hazard_analysis: [
    "hazards and controls",
    "hazard controls",
    "hazard mitigation",
    "risk controls",
  ],
  safe_work_practices_and_trade_specific_procedures: [
    "safe work practices",
    "procedures",
    "work practices",
    "trade specific procedures",
  ],
  permits_and_forms: [
    "permits",
    "permit requirements",
    "permit coordination",
    "forms",
    "hot work",
    "lift plan",
  ],
  checklists_and_inspections: [
    "inspections",
    "quality control",
    "inspection process",
    "verification",
  ],
  environmental_execution_requirements: [
    "environmental",
    "environmental controls",
    "spill response",
    "stormwater",
  ],
  contractor_monitoring_audits_and_reporting: [
    "incident reporting",
    "incident investigation",
    "near miss",
    "reporting and investigation",
    "audits",
    "monitoring",
    "reporting",
    "program oversight",
    "recordkeeping",
    "records",
    "retention",
    "documentation",
  ],
  contractor_iipp: [
    "injury and illness prevention",
    "iipp",
    "program requirements",
  ],
};

function stripSourceHeadingNumber(value: string) {
  return value
    .replace(/^\s*(?:section\s+)?(?:appendix\s+[A-Z]\.?\s*)?(?:\d+(?:\.\d+)*\.?)\s*/i, "")
    .trim();
}

function isHeadingCandidate(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 140) return false;
  if (/^\d+(?:\.\d+)*\.?\s+[A-Z]/.test(trimmed)) return true;
  if (/^appendix\s+[A-Z]/i.test(trimmed)) return true;
  if (/^[A-Z][A-Za-z/&,\-() ]{4,}$/.test(trimmed) && !trimmed.endsWith(".")) return true;
  return false;
}

function extractSourceSectionBlocks(value: string) {
  const lines = normalizeStructuredText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: SourceSectionBlock[] = [];
  let current: SourceSectionBlock | null = null;

  for (const line of lines) {
    if (isHeadingCandidate(line)) {
      if (current && current.lines.length) {
        blocks.push(current);
      }
      current = { heading: line, lines: [] };
      continue;
    }

    if (!current) continue;
    current.lines.push(line);
  }

  if (current && current.lines.length) {
    blocks.push(current);
  }

  return blocks;
}

function scoreSourceBlockMatch(
  key: (typeof CSEP_FORMAT_SECTION_OPTIONS)[number]["value"],
  heading: string,
  bodyLines: string[]
) {
  const definition = getCsepFormatDefinition(key);
  const headingToken = normalizeToken(stripSourceHeadingNumber(heading));
  const bodyToken = normalizeToken(bodyLines.slice(0, 6).join(" "));
  const titleTokens = uniqueStrings([
    definition?.title,
    definition?.shortTitle,
    ...(SOURCE_SECTION_ALIASES[key] ?? []),
  ]).map((value) => normalizeToken(value));

  let score = 0;
  for (const token of titleTokens) {
    if (!token) continue;
    if (headingToken === token) score += 10;
    else if (headingToken.includes(token) || token.includes(headingToken)) score += 7;
    else if (bodyToken.includes(token)) score += 3;
  }

  return score;
}

function mapSourceBlocksToSections(value: string) {
  const blocks = extractSourceSectionBlocks(value);
  const mapped = new Map<(typeof CSEP_FORMAT_SECTION_OPTIONS)[number]["value"], SourceSectionBlock[]>();

  for (const block of blocks) {
    let bestKey: (typeof CSEP_FORMAT_SECTION_OPTIONS)[number]["value"] | null = null;
    let bestScore = 0;

    for (const option of CSEP_FORMAT_SECTION_OPTIONS) {
      const score = scoreSourceBlockMatch(option.value, block.heading, block.lines);
      if (score > bestScore) {
        bestScore = score;
        bestKey = option.value;
      }
    }

    if (!bestKey || bestScore < 3) continue;
    const existing = mapped.get(bestKey) ?? [];
    existing.push(block);
    mapped.set(bestKey, existing);
  }

  return mapped;
}

function buildNarrativeFromSourceLines(lines: string[], maxParagraphs = 3) {
  return lines
    .filter((line) => !/^[-*•]\s+/.test(line) && !/^[A-Za-z][A-Za-z /&()-]+:\s*$/.test(line))
    .slice(0, maxParagraphs)
    .join(" ")
    .trim();
}

function buildBulletsFromSourceLines(lines: string[], maxItems = 8) {
  const directBullets = lines
    .filter((line) => /^[-*•]\s+/.test(line))
    .map((line) => line.replace(/^[-*•]\s+/, "").trim());

  if (directBullets.length) {
    return uniqueByNormalized(directBullets).slice(0, maxItems);
  }

  const sentenceBullets = lines
    .flatMap((line) => line.split(/(?<=\.)\s+(?=[A-Z])/))
    .map((line) => compactWhitespace(line))
    .filter((line) => line.length > 35 && line.length < 220);

  return uniqueByNormalized(sentenceBullets).slice(0, maxItems);
}

function buildSourceSections(value: string) {
  const mappedBlocks = mapSourceBlocksToSections(value);
  const sections: GeneratedSafetyPlanSection[] = [];

  for (const option of CSEP_FORMAT_SECTION_OPTIONS) {
    const blocks = mappedBlocks.get(option.value) ?? [];
    if (!blocks.length) continue;
    const definition = getCsepFormatDefinition(option.value);
    if (!definition) continue;

    const paragraphs = uniqueByNormalized(
      blocks
        .map((block) => buildNarrativeFromSourceLines(block.lines))
        .filter(Boolean)
    );

    const bullets = uniqueByNormalized(
      blocks.flatMap((block) => buildBulletsFromSourceLines(block.lines))
    );

    const subsections = blocks
      .map((block) => ({
        title: stripSourceHeadingNumber(block.heading) || definition.title,
        body: buildNarrativeFromSourceLines(block.lines, 2) || null,
        bullets: buildBulletsFromSourceLines(block.lines, 6),
      }))
      .filter((subsection) => subsection.body || subsection.bullets.length > 0);

    sections.push({
      key: option.value,
      kind: "main",
      order: definition.order,
      title: definition.title,
      numberLabel: definition.numberLabel ?? null,
      layoutKey: option.value,
      body: paragraphs.slice(0, 2).join(" ").trim(),
      bullets: bullets.slice(0, 10),
      subsections,
    });
  }

  return sections;
}

function mergeDraftWithSourceSections(
  draft: GeneratedSafetyPlanDraft,
  sourceSections: GeneratedSafetyPlanSection[]
) {
  const byKey = new Map(sourceSections.map((section) => [section.key, section]));
  const mergedSectionMap = draft.sectionMap.map((section) => {
    const source = byKey.get(section.key);
    if (!source) return section;

    const mergedBody = uniqueStrings([section.body, source.body]).join(" ").trim();
    const mergedBullets = uniqueByNormalized([
      ...(section.bullets ?? []),
      ...(source.bullets ?? []),
    ]);
    const mergedSubsections = [
      ...(section.subsections ?? []),
      ...((source.subsections ?? []).filter((candidate) => {
        const candidateTitle = normalizeToken(candidate.title);
        return !(
          section.subsections ?? []
        ).some((existing) => normalizeToken(existing.title) === candidateTitle);
      }) ?? []),
    ];

    return {
      ...section,
      body: mergedBody || section.body,
      bullets: mergedBullets,
      subsections: mergedSubsections,
    };
  });

  for (const sourceSection of sourceSections) {
    if (mergedSectionMap.some((section) => section.key === sourceSection.key)) continue;
    mergedSectionMap.push(sourceSection);
  }

  return {
    ...draft,
    sectionMap: mergedSectionMap.sort((left, right) => (left.order ?? 0) - (right.order ?? 0)),
    builderSnapshot: {
      ...(draft.builderSnapshot ?? {}),
      selected_format_sections: uniqueStrings(
        mergedSectionMap.map((section) => section.key)
      ),
    },
  } satisfies GeneratedSafetyPlanDraft;
}

function fileStem(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim() || "Rebuilt CSEP";
}

function allowedSectionList() {
  return CSEP_FORMAT_SECTION_OPTIONS.map((section) => `${section.value}: ${section.label}`).join("\n");
}

function summarizeReview(review: BuilderProgramAiReview) {
  return [
    `Overall assessment: ${review.overallAssessment}`,
    `Executive summary: ${compactWhitespace(review.executiveSummary)}`,
    review.missingItemsChecklist.length
      ? `Missing items:\n- ${review.missingItemsChecklist.join("\n- ")}`
      : null,
    review.recommendedEditsBeforeApproval.length
      ? `Recommended edits:\n- ${review.recommendedEditsBeforeApproval.join("\n- ")}`
      : null,
    review.detailedFindings.length
      ? `Detailed findings:\n${review.detailedFindings
          .slice(0, 12)
          .map(
            (finding, index) =>
              `${index + 1}. ${finding.sectionLabel}: ${compactWhitespace(
                [finding.issue, finding.reviewerNote, finding.referenceSupport, finding.whyItMatters]
                  .filter(Boolean)
                  .join(" ")
              )}`
          )
          .join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildFallbackSections(
  review: BuilderProgramAiReview,
  builderExpectationSummary: string[],
  sourceText: string
): GeneratedSafetyPlanSection[] {
  const fallbackKeys: Array<(typeof CSEP_FORMAT_SECTION_OPTIONS)[number]["value"]> = [
    "company_overview_and_safety_philosophy",
    "project_scope_and_trade_specific_activities",
    "roles_and_responsibilities",
    "emergency_preparedness_and_response",
    "personal_protective_equipment",
    "safe_work_practices_and_trade_specific_procedures",
    "permits_and_forms",
    "checklists_and_inspections",
  ];

  return fallbackKeys.map((key, index) => {
    const definition = getCsepFormatDefinition(key);
    const matchingFinding = review.detailedFindings.find((item) =>
      compactWhitespace(item.sectionLabel).toLowerCase().includes(
        definition?.title.toLowerCase().split(" ").slice(1, 3).join(" ") ?? ""
      )
    );
    const matchingExpectation =
      builderExpectationSummary.find((item) =>
        item.toLowerCase().includes((definition?.shortTitle ?? definition?.title ?? "").toLowerCase())
      ) ?? builderExpectationSummary[index] ?? "";
    const body = compactWhitespace(
      [
        matchingFinding?.preferredExample,
        matchingExpectation,
        sourceText ? `Source reference: ${trimTo(sourceText, 220)}` : "",
      ]
        .filter(Boolean)
        .join(" ")
    );

    const subsections =
      key === "emergency_preparedness_and_response"
        ? [
            {
              title: "Emergency Procedures",
              body: body || null,
              bullets: uniqueStrings([
                "Notify the superintendent and project supervision immediately.",
                "Move crews to the primary assembly point when evacuation or shelter instructions are issued.",
              ]),
            },
          ]
        : key === "permits_and_forms"
          ? [
              {
                title: "Permits",
                body: body || null,
                bullets: uniqueStrings([
                  "Confirm required permits before work starts.",
                  "Keep permits available for field verification and closeout.",
                ]),
              },
            ]
          : undefined;

    return {
      key,
      kind: "main",
      order: definition?.order ?? index + 1,
      title: definition?.title ?? key,
      numberLabel: definition?.numberLabel ?? null,
      layoutKey: key,
      body,
      bullets: uniqueStrings([
        ...(matchingFinding?.whyItMatters ? [matchingFinding.whyItMatters] : []),
        ...(matchingFinding?.referenceSupport ? [matchingFinding.referenceSupport] : []),
      ]),
      subsections,
    };
  });
}

function buildFallbackDraft(params: {
  fileName: string;
  review: BuilderProgramAiReview;
  builderExpectationSummary: string[];
  documentText: string;
}): GeneratedSafetyPlanDraft {
  const projectName = fileStem(params.fileName);
  const sectionMap = buildFallbackSections(
    params.review,
    params.builderExpectationSummary,
    params.documentText
  );
  const selectedSectionKeys = sectionMap.map((section) => section.key);
  const contractorCompany =
    compactWhitespace(
      params.review.builderAlignmentNotes.find((note) =>
        note.toLowerCase().includes("contractor")
      )
    ) || "TBD by contractor before issue";

  return {
    documentType: "csep",
    projectDeliveryType: "ground_up",
    title: `${projectName} Rebuilt CSEP`,
    documentControl: {
      issueDate: new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
      documentNumber: "",
      revision: "1.0",
      preparedBy: contractorCompany,
      reviewedBy: "",
      approvedBy: "TBD by contractor before issue",
    },
    projectOverview: {
      projectName,
      projectNumber: "",
      projectAddress: "",
      ownerClient: "",
      gcCm: "",
      contractorCompany,
      schedule: "",
      location: "",
    },
    operations: [
      {
        operationId: "rebuild-op-1",
        tradeLabel: "Contractor Work Scope",
        subTradeLabel: "",
        taskTitle: "Rebuilt external CSEP scope",
        workAreaLabel: "",
        locationGrid: "",
        equipmentUsed: [],
        workConditions: [],
        hazardCategories: [],
        permitTriggers: [],
        ppeRequirements: [],
        requiredControls: [],
        siteRestrictions: [],
        prohibitedEquipment: [],
        conflicts: [],
      },
    ],
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
      score: params.review.overallAssessment === "sufficient" ? 20 : 55,
      band:
        params.review.overallAssessment === "sufficient"
          ? "low"
          : params.review.overallAssessment === "needs_work"
            ? "moderate"
            : "high",
      priorities: uniqueStrings([
        ...params.review.missingItemsChecklist,
        ...params.review.recommendedEditsBeforeApproval,
      ]).slice(0, 8),
    },
    trainingProgram: {
      rows: [],
      summaryTrainingTitles: [],
    },
    narrativeSections: {},
    sectionMap,
    builderSnapshot: {
      selected_format_sections: selectedSectionKeys,
    },
    provenance: {
      source: "superadmin_completed_csep_rebuild_fallback",
      rebuiltFrom: params.fileName,
    },
  };
}

function withCoreSectionsFilled(params: {
  draft: GeneratedSafetyPlanDraft;
  review: BuilderProgramAiReview;
  builderExpectationSummary: string[];
  documentText: string;
  fileName: string;
}) {
  const fallbackSections = buildFallbackSections(
    params.review,
    params.builderExpectationSummary,
    params.documentText
  );
  const mergedSectionMap = [...params.draft.sectionMap];

  fallbackSections.forEach((section) => {
    if (!mergedSectionMap.some((existing) => existing.key === section.key)) {
      mergedSectionMap.push(section);
    }
  });

  const selectedSectionKeys = uniqueStrings(
    mergedSectionMap.map((section) => section.key)
  );
  const contractorCompany =
    compactWhitespace(params.draft.projectOverview.contractorCompany) ||
    fileStem(params.fileName);

  return {
    ...params.draft,
    projectOverview: {
      ...params.draft.projectOverview,
      contractorCompany,
    },
    documentControl: {
      ...params.draft.documentControl,
      preparedBy:
        compactWhitespace(params.draft.documentControl?.preparedBy) || contractorCompany,
      approvedBy:
        compactWhitespace(params.draft.documentControl?.approvedBy) ||
        "TBD by contractor before issue",
    },
    sectionMap: mergedSectionMap.sort(
      (left, right) => (left.order ?? 0) - (right.order ?? 0)
    ),
    builderSnapshot: {
      ...(params.draft.builderSnapshot ?? {}),
      selected_format_sections: selectedSectionKeys,
    },
  } satisfies GeneratedSafetyPlanDraft;
}

function buildDraftFromPayload(
  payload: CompletedCsepRebuildPayload,
  fileName: string
): GeneratedSafetyPlanDraft {
  const sectionMap = payload.sections.reduce<GeneratedSafetyPlanSection[]>((sections, section) => {
      const definition = getCsepFormatDefinition(section.key);
      const body = compactWhitespace(section.body);
      const bullets = uniqueStrings(section.bullets);
      const subsections = (section.subsections ?? [])
        .map((subsection) => ({
          title: compactWhitespace(subsection.title),
          body: compactWhitespace(subsection.body),
          bullets: uniqueStrings(subsection.bullets),
        }))
        .filter(
          (subsection) =>
            subsection.title &&
            (subsection.body || subsection.bullets.length > 0)
        );

      if (!definition) {
        return sections;
      }

      if (!body && !bullets.length && !subsections.length) {
        return sections;
      }

      sections.push({
        key: section.key,
        kind: "main" as const,
        order: definition.order,
        title: definition.title,
        numberLabel: definition.numberLabel ?? null,
        layoutKey: section.key,
        body,
        bullets,
        subsections,
      });
      return sections;
    }, []);

  const selectedSectionKeys = sectionMap.map((section) => section.key);
  const taskTitles = uniqueStrings(payload.operations.taskTitles);
  const tradeLabel = compactWhitespace(payload.operations.tradeLabel) || "Contractor Work Scope";
  const subTradeLabel = compactWhitespace(payload.operations.subTradeLabel);
  const priorities = uniqueStrings(payload.riskPriorities);

  return {
    documentType: "csep",
    projectDeliveryType: "ground_up",
    title: compactWhitespace(payload.title) || `${fileStem(fileName)} Rebuilt CSEP`,
    documentControl: {
      issueDate: new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
      documentNumber: compactWhitespace(payload.documentControl.documentNumber),
      revision: compactWhitespace(payload.documentControl.revision) || "1.0",
      preparedBy:
        compactWhitespace(payload.documentControl.preparedBy) ||
        compactWhitespace(payload.projectOverview.contractorCompany) ||
        "TBD by contractor before issue",
      reviewedBy: compactWhitespace(payload.documentControl.reviewedBy),
      approvedBy:
        compactWhitespace(payload.documentControl.approvedBy) ||
        "TBD by contractor before issue",
    },
    projectOverview: {
      projectName: compactWhitespace(payload.projectOverview.projectName) || fileStem(fileName),
      projectNumber: compactWhitespace(payload.projectOverview.projectNumber),
      projectAddress: compactWhitespace(payload.projectOverview.projectAddress),
      ownerClient: compactWhitespace(payload.projectOverview.ownerClient),
      gcCm: normalizeGcCmPartnerEntries(payload.projectOverview.gcCm).map((entry) =>
        compactWhitespace(entry)
      ),
      contractorCompany: compactWhitespace(payload.projectOverview.contractorCompany),
      schedule: compactWhitespace(payload.projectOverview.schedule),
      location: compactWhitespace(payload.projectOverview.location),
    },
    operations: (taskTitles.length ? taskTitles : ["Rebuilt external CSEP scope"]).map(
      (taskTitle, index) => ({
        operationId: `rebuild-op-${index + 1}`,
        tradeLabel,
        subTradeLabel,
        taskTitle,
        workAreaLabel: "",
        locationGrid: "",
        equipmentUsed: uniqueStrings(payload.operations.equipmentUsed),
        workConditions: uniqueStrings(payload.operations.workConditions),
        hazardCategories: uniqueStrings(payload.operations.hazardCategories),
        permitTriggers: uniqueStrings(payload.operations.permitTriggers),
        ppeRequirements: uniqueStrings(payload.operations.ppeRequirements),
        requiredControls: uniqueStrings(payload.operations.requiredControls),
        siteRestrictions: uniqueStrings(payload.operations.siteRestrictions),
        prohibitedEquipment: [],
        conflicts: uniqueStrings(payload.operations.conflicts),
      })
    ),
    ruleSummary: {
      permitTriggers: uniqueStrings(payload.operations.permitTriggers),
      ppeRequirements: uniqueStrings(payload.operations.ppeRequirements),
      requiredControls: uniqueStrings(payload.operations.requiredControls),
      hazardCategories: uniqueStrings(payload.operations.hazardCategories),
      siteRestrictions: uniqueStrings(payload.operations.siteRestrictions),
      prohibitedEquipment: [],
      trainingRequirements: uniqueStrings(payload.trainingRequirements),
      weatherRestrictions: [],
    },
    conflictSummary: {
      total: uniqueStrings(payload.operations.conflicts).length,
      intraDocument: 0,
      external: uniqueStrings(payload.operations.conflicts).length,
      highestSeverity: uniqueStrings(payload.operations.conflicts).length ? "medium" : "none",
      items: [],
    },
    riskSummary: {
      score:
        payload.riskBand === "critical"
          ? 90
          : payload.riskBand === "high"
            ? 75
            : payload.riskBand === "moderate"
              ? 55
              : 25,
      band: payload.riskBand,
      priorities,
    },
    trainingProgram: {
      rows: [],
      summaryTrainingTitles: uniqueStrings(payload.trainingRequirements),
    },
    narrativeSections: {},
    sectionMap,
    builderSnapshot: {
      selected_format_sections: selectedSectionKeys,
    },
    provenance: {
      source: "superadmin_completed_csep_rebuild",
      rebuiltFrom: fileName,
    },
  };
}

async function generateCompletedCsepRebuildDraft(params: {
  fileName: string;
  documentText: string;
  siteReferenceText: string;
  builderExpectationSummary: string[];
  review: BuilderProgramAiReview;
}) {
  const buildLocalFallback = () =>
    buildFallbackDraft({
      fileName: params.fileName,
      review: params.review,
      builderExpectationSummary: params.builderExpectationSummary,
      documentText: normalizedDocumentText,
    });
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const normalizedDocumentText = normalizeStructuredText(params.documentText);
  const normalizedReferenceText = normalizeStructuredText(params.siteReferenceText);
  if (!apiKey || normalizedDocumentText.length < 120) {
    return buildLocalFallback();
  }

  const sourceOutline = buildSourceOutline(normalizedDocumentText);
  const referenceOutline = buildSourceOutline(normalizedReferenceText);

  const prompt = [
    "You are rebuilding an uploaded external contractor CSEP into the Safety360 CSEP format.",
    "This is a true document conversion task, not a short summary.",
    "Use the uploaded completed CSEP as the main source of project facts, scope, procedures, contacts, emergency content, PPE, permits, inspections, responsibilities, and other field controls.",
    "Transfer as much usable source content as possible into the matching Safety360 format sections, even when the original headings are different.",
    "Use the review findings to fix weak, missing, duplicated, or unclear content so the rebuilt result reads like a complete contractor-issued document.",
    "Use the live builder expectations as the target structure and tone for the rebuilt document.",
    "Important output rules:",
    "- Rewrite into final issued-document language, not review-note language.",
    "- Preserve project-specific facts, names, addresses, emergency instructions, phone/contact details, scope details, permits, PPE, and inspection requirements when they appear in the uploaded CSEP.",
    "- Do not collapse the source into generic summaries if the uploaded CSEP already contains usable detail.",
    "- Keep self-performed scope separate from adjacent interface trades.",
    "- Prefer project-specific facts from the uploaded document and uploaded reference documents.",
    "- If a project fact is not available, leave the project field blank instead of inventing it.",
    "- Never output internal drafting notes, AI notes, placeholders like test/null/undefined, or raw labels such as [Platform Fill Field].",
    "- Rebuild a complete Safety360 CSEP body. Include every relevant main section you can support from the source, the references, and reasonable builder-based completion logic.",
    "- Do not create empty section stubs. If a section is included, it should contain meaningful final content.",
    "- If source content is weak but the section is needed for a complete issued CSEP, write a short but complete project-specific version using the available facts plus the review corrections.",
    "- Use only these allowed Safety360 section keys and titles:",
    allowedSectionList(),
    "",
    "--- Live builder expectations ---",
    params.builderExpectationSummary.join("\n"),
    "",
    sourceOutline.length ? `--- Uploaded CSEP source outline ---\n${sourceOutline.join("\n")}` : "",
    "",
    "--- Completed-CSEP review findings to fix during rebuild ---",
    summarizeReview(params.review),
    "",
    referenceOutline.length
      ? `--- Uploaded reference document outline ---\n${referenceOutline.join("\n")}`
      : "",
    "",
    params.siteReferenceText
      ? `--- Uploaded reference documents ---\n${trimStructuredText(
          normalizedReferenceText,
          MAX_REFERENCE_TEXT
        )}`
      : "",
    "",
    `--- Uploaded completed CSEP source (${params.fileName}) ---`,
    trimStructuredText(normalizedDocumentText, MAX_SOURCE_TEXT),
    "",
    "Return strict JSON matching the schema.",
  ]
    .filter(Boolean)
    .join("\n");

  const sectionEnum = CSEP_FORMAT_SECTION_OPTIONS.map((section) => section.value);
  const preferredModel = (
    process.env.COMPANY_AI_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_REBUILD_MODEL
  ).trim();
  const modelCandidates = [preferredModel, DEFAULT_REBUILD_MODEL].filter(
    (model, index, list) => Boolean(model) && list.indexOf(model) === index
  );

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
            name: "completed_csep_rebuild",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                documentControl: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    documentNumber: { type: "string" },
                    revision: { type: "string" },
                    preparedBy: { type: "string" },
                    reviewedBy: { type: "string" },
                    approvedBy: { type: "string" },
                  },
                  required: [
                    "documentNumber",
                    "revision",
                    "preparedBy",
                    "reviewedBy",
                    "approvedBy",
                  ],
                },
                projectOverview: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    projectName: { type: "string" },
                    projectNumber: { type: "string" },
                    projectAddress: { type: "string" },
                    ownerClient: { type: "string" },
                    gcCm: {
                      oneOf: [{ type: "string" }, { type: "array", items: { type: "string" }, maxItems: 24 }],
                    },
                    contractorCompany: { type: "string" },
                    schedule: { type: "string" },
                    location: { type: "string" },
                  },
                  required: [
                    "projectName",
                    "projectNumber",
                    "projectAddress",
                    "ownerClient",
                    "gcCm",
                    "contractorCompany",
                    "schedule",
                    "location",
                  ],
                },
                operations: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    tradeLabel: { type: "string" },
                    subTradeLabel: { type: "string" },
                    taskTitles: { type: "array", items: { type: "string" }, maxItems: 12 },
                    equipmentUsed: { type: "array", items: { type: "string" }, maxItems: 16 },
                    workConditions: { type: "array", items: { type: "string" }, maxItems: 12 },
                    hazardCategories: { type: "array", items: { type: "string" }, maxItems: 16 },
                    permitTriggers: { type: "array", items: { type: "string" }, maxItems: 12 },
                    ppeRequirements: { type: "array", items: { type: "string" }, maxItems: 16 },
                    requiredControls: { type: "array", items: { type: "string" }, maxItems: 16 },
                    siteRestrictions: { type: "array", items: { type: "string" }, maxItems: 16 },
                    conflicts: { type: "array", items: { type: "string" }, maxItems: 12 },
                  },
                  required: [
                    "tradeLabel",
                    "subTradeLabel",
                    "taskTitles",
                    "equipmentUsed",
                    "workConditions",
                    "hazardCategories",
                    "permitTriggers",
                    "ppeRequirements",
                    "requiredControls",
                    "siteRestrictions",
                    "conflicts",
                  ],
                },
                trainingRequirements: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 16,
                },
                riskBand: {
                  type: "string",
                  enum: ["low", "moderate", "high", "critical"],
                },
                riskPriorities: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 10,
                },
                sections: {
                  type: "array",
                  minItems: 10,
                  maxItems: 19,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      key: {
                        type: "string",
                        enum: sectionEnum,
                      },
                      body: { type: "string" },
                      bullets: {
                        type: "array",
                        items: { type: "string" },
                        maxItems: 10,
                      },
                      subsections: {
                        type: "array",
                        maxItems: 8,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            title: { type: "string" },
                            body: { type: "string" },
                            bullets: {
                              type: "array",
                              items: { type: "string" },
                              maxItems: 8,
                            },
                          },
                          required: ["title", "body", "bullets"],
                        },
                      },
                    },
                    required: ["key", "body", "bullets", "subsections"],
                  },
                },
              },
              required: [
                "title",
                "documentControl",
                "projectOverview",
                "operations",
                "trainingRequirements",
                "riskBand",
                "riskPriorities",
                "sections",
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
      candidate !== DEFAULT_REBUILD_MODEL &&
      (errText.includes("model_not_found") ||
        errText.includes("does not have access to model") ||
        errText.includes("invalid_request_error"));
    if (!shouldRetryOnFallback) {
      break;
    }
  }

  if (!res || !res.ok) {
    serverLog("warn", "ad_hoc_completed_csep_rebuild_model_fallback", {
      fileName: params.fileName,
      reason: `OpenAI request failed (${res?.status ?? 502})`,
    });
    return buildLocalFallback();
  }

  const json: unknown = await res.json();
  const rawText = extractResponsesApiOutputText(json);
  if (!rawText) {
    throw new Error("Empty model output.");
  }

  let parsed: CompletedCsepRebuildPayload;
  try {
    parsed = JSON.parse(rawText) as CompletedCsepRebuildPayload;
  } catch {
    serverLog("warn", "ad_hoc_completed_csep_rebuild_parse_fallback", {
      fileName: params.fileName,
      reason: "Could not parse rebuilt CSEP JSON.",
    });
    return buildLocalFallback();
  }

  return withCoreSectionsFilled({
    draft: buildDraftFromPayload(parsed, params.fileName),
    review: params.review,
    builderExpectationSummary: params.builderExpectationSummary,
    documentText: normalizedDocumentText,
    fileName: params.fileName,
  });
}

export async function runAdHocCompletedCsepRebuild(params: {
  document: { buffer: Buffer; fileName: string };
  additionalReviewerContext: string;
  siteDocuments?: Array<{ buffer: Buffer; fileName: string }> | null;
  builderExpectationSummary?: string[] | null;
}) {
  try {
    const extracted = await extractBuilderReviewDocumentText(
      params.document.buffer,
      params.document.fileName
    );
    if (!extracted.ok) {
      return {
        ok: false as const,
        status: 400,
        error: extracted.error,
      };
    }

    const siteReferenceBlocks: string[] = [];
    for (const siteDocument of params.siteDocuments ?? []) {
      if (!siteDocument?.buffer?.length) {
        continue;
      }

      const extractedReference = await extractBuilderReviewDocumentText(
        siteDocument.buffer,
        siteDocument.fileName
      );
      if (!extractedReference.ok) {
        return {
          ok: false as const,
          status: 400,
          error: `Site reference file "${siteDocument.fileName}": ${extractedReference.error}`,
        };
      }

      siteReferenceBlocks.push(
        [`Reference file: ${siteDocument.fileName}`, extractedReference.text.trim()]
          .filter(Boolean)
          .join("\n")
      );
    }

    const { review } = await generateBuilderProgramAiReview({
      documentText: extracted.text,
      programLabel: "CSEP",
      projectName: fileStem(params.document.fileName),
      documentTitle: params.document.fileName,
      additionalReviewerContext: params.additionalReviewerContext,
      annotations: extracted.annotations,
      siteReferenceText: siteReferenceBlocks.length ? siteReferenceBlocks.join("\n\n---\n\n") : null,
      siteReferenceFileName: siteReferenceBlocks.length
        ? (params.siteDocuments ?? []).map((item) => item.fileName).join(", ")
        : null,
      reviewMode: "csep_completeness",
      builderExpectationSummary: params.builderExpectationSummary,
    });

    const draft = await generateCompletedCsepRebuildDraft({
      fileName: params.document.fileName,
      documentText: extracted.text,
      siteReferenceText: siteReferenceBlocks.join("\n\n---\n\n"),
      builderExpectationSummary: params.builderExpectationSummary ?? [],
      review,
    });
    const sourceSections = buildSourceSections(extracted.text);
    const referenceSections = buildSourceSections(siteReferenceBlocks.join("\n\n"));
    const finalDraft = mergeDraftWithSourceSections(
      mergeDraftWithSourceSections(draft, sourceSections),
      referenceSections
    );
    const rendered = await renderGeneratedCsepDocx(finalDraft);

    return {
      ok: true as const,
      filename: rendered.filename.replace(/\.docx$/i, "_rebuilt.docx"),
      body: rendered.body,
      draft: finalDraft,
      review,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "CSEP rebuild failed.";
    const isConfig = message.includes("OPENAI_API_KEY");
    serverLog("error", "ad_hoc_completed_csep_rebuild_failed", {
      fileName: params.document.fileName,
      status: isConfig ? 503 : 502,
      errorKind: e instanceof Error ? e.name : "unknown",
    });
    return {
      ok: false as const,
      status: isConfig ? 503 : 502,
      error: message,
    };
  }
}
