import type {
  AiReviewContext,
  CsepAiAssemblyDecisions,
  ConflictMatrix,
  GeneratedSafetyPlanDraft,
  GeneratedSafetyPlanSection,
  JsonObject,
  RiskBand,
  SafetyPlanGenerationContext,
  SafetyPlanTrainingProgram,
} from "@/types/safety-intelligence";
import { CSEP_BUILDER_BLOCK_TITLES } from "@/lib/csepBuilder";
import { buildCsepProgramSections } from "@/lib/csepPrograms";
import {
  applyJurisdictionStandardsToCsep,
  applyJurisdictionStandardsToPeshep,
} from "@/lib/jurisdictionStandards/apply";
import { SITE_SAFETY_BLUEPRINT_TITLE } from "@/lib/safetyBlueprintLabels";
import {
  getTradeConflictProfile,
  projectDeliveryTypeLabel,
} from "@/lib/tradeConflictCatalog";
import type {
  CsepBuilderBlockKey,
  CsepBuilderInstructions,
  CsepFormatSectionKey,
} from "@/types/csep-builder";
import type { CSEPProgramDefinition } from "@/types/csep-programs";
import type { JurisdictionStandardsConfig } from "@/types/jurisdiction-standards";

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function bandFromScore(score: number): RiskBand {
  if (score >= 30) return "critical";
  if (score >= 20) return "high";
  if (score >= 10) return "moderate";
  return "low";
}

function sentenceList(values: string[], empty = "None identified.") {
  return values.length ? values.join(", ") : empty;
}

function paragraph(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value.trim() : fallback;
}

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function appendInlineOsha(body: string | null | undefined, refs: string[]) {
  if (!refs.length) return body ?? null;
  const suffix = `Applicable OSHA references: ${refs.join(", ")}.`;
  return body?.trim() ? `${body.trim()} ${suffix}` : suffix;
}

type GeneratedSafetyPlanSubsection = NonNullable<GeneratedSafetyPlanSection["subsections"]>[number];
type DraftOperation = GeneratedSafetyPlanDraft["operations"][number];
type GroupedTradePackage = {
  key: string;
  tradeLabel: string;
  subTradeLabel: string | null;
  label: string;
  taskTitles: string[];
  hazardCategories: string[];
  permitTriggers: string[];
  requiredControls: string[];
  ppeRequirements: string[];
  siteRestrictions: string[];
  locationLabels: string[];
  equipmentUsed: string[];
  workConditions: string[];
  conflicts: string[];
};

const INLINE_OSHA_SUFFIX_PATTERN = /\s*Applicable OSHA references:\s*.+\.\s*$/i;
const CSEP_SOFT_PAGE_BUDGET_UNITS = 42_000;
const CSEP_COMPACTABLE_KEYS = new Set([
  "trade_summary",
  "scope_of_work",
  "site_specific_notes",
  "emergency_procedures",
  "required_ppe",
  "selected_hazards",
  "risk_priority_summary",
  "safety_narrative",
]);
const CSEP_REFERENCE_PACK_KEYS = new Set([
  "task_modules_reference",
  "hazard_modules_reference",
  "steel_task_modules_reference",
  "steel_hazard_modules_reference",
  "steel_program_modules_reference",
]);

function normalizeToken(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tradePackageLabelForOperation(operation: DraftOperation) {
  const tradeLabel = operation.tradeLabel ?? operation.tradeCode ?? "Unassigned Trade";
  const subTradeLabel = operation.subTradeLabel ?? operation.subTradeCode ?? null;

  return {
    tradeLabel,
    subTradeLabel,
    label: subTradeLabel ? `${tradeLabel} / ${subTradeLabel}` : tradeLabel,
  };
}

function locationLabelForOperation(operation: DraftOperation) {
  const parts = [
    operation.workAreaLabel?.trim(),
    operation.locationGrid?.trim() ? `Grid ${operation.locationGrid.trim()}` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length ? parts.join(" | ") : null;
}

function groupOperationsByTradePackage(operations: DraftOperation[]) {
  const grouped: GroupedTradePackage[] = [];
  const indexByKey = new Map<string, number>();

  for (const operation of operations) {
    const packageLabel = tradePackageLabelForOperation(operation);
    const key = [normalizeToken(packageLabel.tradeLabel), normalizeToken(packageLabel.subTradeLabel)]
      .filter(Boolean)
      .join("__");
    const existingIndex = indexByKey.get(key);
    const locationLabel = locationLabelForOperation(operation);

    if (existingIndex === undefined) {
      indexByKey.set(key, grouped.length);
      grouped.push({
        key,
        tradeLabel: packageLabel.tradeLabel,
        subTradeLabel: packageLabel.subTradeLabel,
        label: packageLabel.label,
        taskTitles: dedupe([operation.taskTitle]),
        hazardCategories: dedupe(operation.hazardCategories),
        permitTriggers: dedupe(operation.permitTriggers),
        requiredControls: dedupe(operation.requiredControls),
        ppeRequirements: dedupe(operation.ppeRequirements),
        siteRestrictions: dedupe(operation.siteRestrictions),
        locationLabels: dedupe(locationLabel ? [locationLabel] : []),
        equipmentUsed: dedupe(operation.equipmentUsed),
        workConditions: dedupe(operation.workConditions),
        conflicts: dedupe(operation.conflicts),
      });
      continue;
    }

    const current = grouped[existingIndex];
    grouped[existingIndex] = {
      ...current,
      taskTitles: dedupe([...current.taskTitles, operation.taskTitle]),
      hazardCategories: dedupe([...current.hazardCategories, ...operation.hazardCategories]),
      permitTriggers: dedupe([...current.permitTriggers, ...operation.permitTriggers]),
      requiredControls: dedupe([...current.requiredControls, ...operation.requiredControls]),
      ppeRequirements: dedupe([...current.ppeRequirements, ...operation.ppeRequirements]),
      siteRestrictions: dedupe([...current.siteRestrictions, ...operation.siteRestrictions]),
      locationLabels: dedupe([
        ...current.locationLabels,
        ...(locationLabel ? [locationLabel] : []),
      ]),
      equipmentUsed: dedupe([...current.equipmentUsed, ...operation.equipmentUsed]),
      workConditions: dedupe([...current.workConditions, ...operation.workConditions]),
      conflicts: dedupe([...current.conflicts, ...operation.conflicts]),
    };
  }

  return grouped;
}

function buildGroupedHazardSubsections(packages: GroupedTradePackage[]) {
  return packages.map<GeneratedSafetyPlanSubsection>((pkg) => ({
    title: pkg.label,
    body: pkg.locationLabels.length
      ? `Primary work areas: ${sentenceList(pkg.locationLabels, "N/A")}.`
      : null,
    bullets: pkg.hazardCategories.length
      ? pkg.hazardCategories
      : ["No specific hazards identified for this trade package."],
  }));
}

function uniqueTextParts(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const part of parts) {
    const text = stripInlineOshaSuffix(part);
    if (!text) continue;
    const token = normalizeToken(text);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    next.push(text);
  }

  return next;
}

function combineUniqueText(...parts: Array<string | null | undefined>) {
  const next = uniqueTextParts(parts);
  return next.length ? next.join(" ") : null;
}

function stripInlineOshaSuffix(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const stripped = value.replace(INLINE_OSHA_SUFFIX_PATTERN, "").replace(/\s+/g, " ").trim();
  return stripped || null;
}

function extractInlineOshaSuffix(value: string | null | undefined) {
  if (!value?.trim()) return null;

  const match = value.match(/^(.*?)(?:\s*Applicable OSHA references:\s*(.+?)\.\s*)$/i);
  if (!match) return null;

  return {
    body: match[1]?.replace(/\s+/g, " ").trim() || null,
    referencesText: match[2]?.trim() || "",
  };
}

function formatReferenceTokenList(tokens: string[]) {
  if (!tokens.length) return null;
  return `(${tokens.join(", ")})`;
}

function applyInlineReferenceTokens(
  value: string | null | undefined,
  orderedReferences: string[],
  referenceTokenMap: Map<string, string>
) {
  if (!value?.trim()) return value;

  const extracted = extractInlineOshaSuffix(value);
  if (!extracted) return value.replace(/\s+/g, " ").trim();

  const matchedTokens = orderedReferences
    .filter((reference) => extracted.referencesText.includes(reference))
    .map((reference) => referenceTokenMap.get(reference))
    .filter((token): token is string => Boolean(token));

  const tokenText = formatReferenceTokenList(matchedTokens);
  if (!tokenText) return extracted.body;
  if (!extracted.body) return tokenText;

  return `${extracted.body} ${tokenText}`;
}

function applyOshaReferenceTokensToSections(
  sections: GeneratedSafetyPlanSection[],
  oshaReferences: string[]
) {
  if (!oshaReferences.length) return sections;

  const orderedReferences = dedupe(oshaReferences.map((reference) => reference.trim()).filter(Boolean));
  const referenceTokenMap = new Map(
    orderedReferences.map((reference, index) => [reference, `R${index + 1}`])
  );

  return sections.map((section) => {
    const isReferenceSection =
      section.key === "references" ||
      section.key === "osha_references" ||
      section.key === "osha_reference_appendix";

    return {
      ...section,
      summary: applyInlineReferenceTokens(section.summary, orderedReferences, referenceTokenMap),
      body: applyInlineReferenceTokens(section.body, orderedReferences, referenceTokenMap),
      bullets: isReferenceSection
        ? orderedReferences.map((reference) => `${referenceTokenMap.get(reference)} ${reference}`)
        : section.bullets?.map((bullet) =>
            applyInlineReferenceTokens(bullet, orderedReferences, referenceTokenMap) ?? bullet
          ),
      subsections: section.subsections?.map((subsection) => ({
        ...subsection,
        body: applyInlineReferenceTokens(subsection.body, orderedReferences, referenceTokenMap),
        bullets:
          isReferenceSection && subsection.title.toLowerCase().includes("reference")
            ? orderedReferences.map((reference) => `${referenceTokenMap.get(reference)} ${reference}`)
            : subsection.bullets.map(
                (bullet) =>
                  applyInlineReferenceTokens(bullet, orderedReferences, referenceTokenMap) ?? bullet
              ),
      })),
      table: section.table
        ? {
            ...section.table,
            columns: section.table.columns.map(
              (column) =>
                applyInlineReferenceTokens(column, orderedReferences, referenceTokenMap) ?? column
            ),
            rows: section.table.rows.map((row) =>
              row.map(
                (cell) =>
                  applyInlineReferenceTokens(cell, orderedReferences, referenceTokenMap) ?? cell
              )
            ),
          }
        : section.table,
    };
  });
}

function compactText(value: string | null | undefined, maxLength = 220) {
  const stripped = stripInlineOshaSuffix(value);
  if (!stripped) return null;

  const sentences = stripped
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const uniqueSentences = uniqueTextParts(sentences);
  const nextParts: string[] = [];

  for (const sentence of uniqueSentences) {
    const candidate = [...nextParts, sentence].join(" ");
    if (candidate.length > maxLength && nextParts.length > 0) break;
    nextParts.push(sentence);
    if (candidate.length >= maxLength) break;
  }

  const compacted = nextParts.join(" ").trim();
  if (compacted) return compacted;
  if (stripped.length <= maxLength) return stripped;
  return `${stripped.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function tableNarrativeSnippets(table: GeneratedSafetyPlanSection["table"]) {
  if (!table) return [];

  return table.rows.flatMap((row) => {
    const values = row
      .map((cell) => stripInlineOshaSuffix(cell))
      .filter((cell): cell is string => Boolean(cell));
    if (!values.length) return [];

    if (table.columns.length === 2) {
      return [combineUniqueText(values[0], values[1])];
    }

    return [
      combineUniqueText(values[0], values.slice(1).join(" ")),
      ...values.slice(1),
    ];
  }).filter((value): value is string => Boolean(value));
}

function sectionStructuredNarrativeSnippets(section: GeneratedSafetyPlanSection) {
  return uniqueTextParts([
    ...(section.bullets ?? []),
    ...(section.subsections ?? []).flatMap((subsection) => [
      subsection.title,
      subsection.body,
      ...subsection.bullets,
    ]),
    ...tableNarrativeSnippets(section.table),
  ]);
}

function isNarrativeRedundant(
  value: string | null | undefined,
  details: string[]
) {
  const normalizedValue = normalizeToken(value);
  if (!normalizedValue) return false;

  return details.some((detail) => {
    const normalizedDetail = normalizeToken(detail);
    if (!normalizedDetail) return false;

    return (
      normalizedDetail === normalizedValue ||
      normalizedDetail.includes(normalizedValue) ||
      (normalizedValue.length > 48 && normalizedValue.includes(normalizedDetail))
    );
  });
}

function mergeBullets(
  left: string[] | undefined,
  right: string[] | undefined
) {
  const bullets = dedupe([...(left ?? []), ...(right ?? [])].map((item) => item.trim()).filter(Boolean));
  return bullets.length ? bullets : undefined;
}

function mergeSubsections(
  left: GeneratedSafetyPlanSubsection[] | undefined,
  right: GeneratedSafetyPlanSubsection[] | undefined
) {
  const merged: GeneratedSafetyPlanSubsection[] = [];
  const indexByTitle = new Map<string, number>();

  for (const subsection of [...(left ?? []), ...(right ?? [])]) {
    const normalizedTitle = normalizeToken(subsection.title);
    const existingIndex = indexByTitle.get(normalizedTitle);
    const nextSubsection: GeneratedSafetyPlanSubsection = {
      title: subsection.title,
      body: stripInlineOshaSuffix(subsection.body),
      bullets: dedupe(subsection.bullets.map((item) => item.trim()).filter(Boolean)),
    };

    if (existingIndex === undefined) {
      indexByTitle.set(normalizedTitle, merged.length);
      merged.push(nextSubsection);
      continue;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      title: existing.title,
      body: combineUniqueText(existing.body, nextSubsection.body),
      bullets: dedupe([...(existing.bullets ?? []), ...(nextSubsection.bullets ?? [])]),
    };
  }

  return merged.length ? merged : undefined;
}

function tableWeight(table: GeneratedSafetyPlanSection["table"]) {
  if (!table) return 0;
  const columnWeight = table.columns.join(" ").length;
  const rowWeight = table.rows.reduce(
    (sum, row) => sum + row.join(" ").length + row.length * 16,
    0
  );
  return columnWeight + rowWeight;
}

function sectionWeight(section: GeneratedSafetyPlanSection) {
  return [
    section.title.length,
    section.summary?.length ?? 0,
    section.body?.length ?? 0,
    (section.bullets ?? []).join(" ").length,
    (section.subsections ?? []).reduce(
      (sum, subsection) =>
        sum +
        subsection.title.length +
        (subsection.body?.length ?? 0) +
        subsection.bullets.join(" ").length,
      0
    ),
    tableWeight(section.table),
  ].reduce((sum, value) => sum + value, 0);
}

function mergeTables(
  left: GeneratedSafetyPlanSection["table"],
  right: GeneratedSafetyPlanSection["table"]
) {
  if (!left) return right ?? null;
  if (!right) return left;
  return tableWeight(right) > tableWeight(left) ? right : left;
}

function mergeSections(
  left: GeneratedSafetyPlanSection,
  right: GeneratedSafetyPlanSection
): GeneratedSafetyPlanSection {
  const preferred =
    sectionWeight(right) > sectionWeight(left) ? right : left;
  const secondary = preferred === left ? right : left;

  return {
    ...preferred,
    summary: combineUniqueText(preferred.summary, secondary.summary),
    body: combineUniqueText(preferred.body, secondary.body),
    bullets: mergeBullets(preferred.bullets, secondary.bullets),
    subsections: mergeSubsections(preferred.subsections, secondary.subsections),
    table: mergeTables(preferred.table, secondary.table),
  };
}

function normalizeSectionContent(section: GeneratedSafetyPlanSection): GeneratedSafetyPlanSection {
  const summary = stripInlineOshaSuffix(section.summary);
  const body = stripInlineOshaSuffix(section.body);
  const bullets = mergeBullets(section.bullets, undefined);
  const subsections = mergeSubsections(section.subsections, undefined);

  return {
    ...section,
    summary:
      summary && normalizeToken(summary) !== normalizeToken(body ?? "")
        ? summary
        : undefined,
    body,
    bullets,
    subsections,
  };
}

function dedupeSectionsByKeyAndTitle(sections: GeneratedSafetyPlanSection[]) {
  const merged: GeneratedSafetyPlanSection[] = [];
  const indexByKey = new Map<string, number>();
  const indexByTitle = new Map<string, number>();

  for (const section of sections.map(normalizeSectionContent)) {
    const keyToken = normalizeToken(section.key);
    const titleToken = normalizeToken(section.title);
    const existingIndex = indexByKey.get(keyToken) ?? indexByTitle.get(titleToken);

    if (existingIndex === undefined) {
      indexByKey.set(keyToken, merged.length);
      indexByTitle.set(titleToken, merged.length);
      merged.push(section);
      continue;
    }

    merged[existingIndex] = mergeSections(merged[existingIndex], section);
  }

  return merged;
}

function mergeCsepFallProtectionSections(sections: GeneratedSafetyPlanSection[]) {
  const primaryIndex = sections.findIndex(
    (section) => normalizeToken(section.title) === normalizeToken("Fall Protection Program")
  );
  const secondaryIndex = sections.findIndex(
    (section) =>
      normalizeToken(section.title) ===
      normalizeToken("Personal Fall Arrest Equipment Program")
  );

  if (primaryIndex === -1 || secondaryIndex === -1) {
    return sections;
  }

  const next = [...sections];
  next[primaryIndex] = {
    ...mergeSections(next[primaryIndex], next[secondaryIndex]),
    title: next[primaryIndex].title,
    key: next[primaryIndex].key,
  };
  next.splice(secondaryIndex, 1);
  return next;
}

function suppressRedundantCsepNarrative(section: GeneratedSafetyPlanSection) {
  const hasStructuredDetail = Boolean(
    section.table || section.bullets?.length || section.subsections?.length
  );
  if (!hasStructuredDetail) return section;

  const structuredSnippets = sectionStructuredNarrativeSnippets(section);
  const nextSummary = isNarrativeRedundant(section.summary, structuredSnippets)
    ? undefined
    : section.summary;
  const nextBody = isNarrativeRedundant(section.body, structuredSnippets)
    ? undefined
    : section.body;

  if (CSEP_REFERENCE_PACK_KEYS.has(section.key)) {
    return {
      ...section,
      summary: nextSummary,
      body: compactText(nextBody, 160),
      bullets: undefined,
    };
  }

  if (section.key === "required_ppe" || section.key === "selected_hazards") {
    return {
      ...section,
      summary: undefined,
      body: undefined,
    };
  }

  if (section.key === "trade_summary") {
    return {
      ...section,
      summary: undefined,
      body: compactText(nextBody, 180),
    };
  }

  return {
    ...section,
    summary: nextSummary,
    body: nextBody,
  };
}

function estimateCsepDraftUnits(sections: GeneratedSafetyPlanSection[]) {
  return sections.reduce((sum, section) => sum + sectionWeight(section), 0);
}

function compactCsepSections(sections: GeneratedSafetyPlanSection[]) {
  let next = sections.map(suppressRedundantCsepNarrative);

  if (estimateCsepDraftUnits(next) <= CSEP_SOFT_PAGE_BUDGET_UNITS) {
    return next;
  }

  next = next.map((section) => {
    if (!CSEP_COMPACTABLE_KEYS.has(section.key)) return section;
    const hasStructuredDetail = Boolean(
      section.table || section.bullets?.length || section.subsections?.length
    );

    return {
      ...section,
      summary: undefined,
      body: compactText(section.body, hasStructuredDetail ? 160 : 220),
    };
  });

  if (estimateCsepDraftUnits(next) <= CSEP_SOFT_PAGE_BUDGET_UNITS) {
    return next;
  }

  next = next.map((section) =>
    CSEP_REFERENCE_PACK_KEYS.has(section.key)
      ? {
          ...section,
          body: compactText(section.body, 160),
          bullets: undefined,
        }
      : section
  );

  if (estimateCsepDraftUnits(next) <= CSEP_SOFT_PAGE_BUDGET_UNITS) {
    return next;
  }

  return next.map((section) => {
    if (!CSEP_COMPACTABLE_KEYS.has(section.key)) return section;
    const hasStructuredDetail = Boolean(
      section.table || section.bullets?.length || section.subsections?.length
    );

    return hasStructuredDetail
      ? {
          ...section,
          summary: undefined,
          body: undefined,
        }
      : {
          ...section,
          summary: undefined,
          body: compactText(section.body, 140),
        };
  });
}

function normalizeCsepSections(sections: GeneratedSafetyPlanSection[]) {
  const mergedSections = mergeCsepFallProtectionSections(
    dedupeSectionsByKeyAndTitle(sections)
  );
  return compactCsepSections(mergedSections);
}

function buildDefinitionsSection(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection {
  if (generationContext.documentProfile.documentType === "pshsep") {
    const structured = getPshsepStructuredInputs(generationContext);
    return {
      key: "definitions",
      title: "Definitions",
      body: appendInlineOsha(
        structured.definitionsText ??
          "Define critical project terms early in the plan, including competent person, ancillary contractor, IDLH conditions, high-risk work, and owner-specific severe-event terminology before field execution begins.",
        inlineOshaRefs
      ),
    };
  }

  return {
    key: "definitions",
    title: "Definitions",
    body:
      "These definitions establish the baseline field language used throughout this CSEP.",
    bullets: [
      "Competent person: An individual capable of identifying existing and predictable hazards and authorized to take prompt corrective measures.",
      "Qualified person: An individual with recognized training, knowledge, or experience related to the assigned work scope.",
      "High-risk work: Work activities with elevated exposure potential requiring added review, controls, coordination, or authorization before execution.",
      "Permit-required work: Work that requires documented authorization, verification, or owner / site approval before starting.",
      "Simultaneous operations: Multiple trades, crews, or activities working in overlapping areas or time windows that can affect one another's risk profile.",
      "Stop-work authority: The responsibility and authority of any worker or supervisor to pause work when conditions become unsafe or controls are not adequate.",
    ],
  };
}

function buildReferencesSection(oshaReferences: string[]): GeneratedSafetyPlanSection {
  return {
    key: "references",
    title: "References",
    body: "The following OSHA references were identified from selected scopes, permits, and generated program content. Inline section citations use the numbered reference tags shown below.",
    bullets: oshaReferences.length
      ? oshaReferences.map((reference, index) => `R${index + 1} ${reference}`)
      : ["No OSHA references were identified from the current plan inputs."],
  };
}

function getCsepBuilderInstructions(generationContext: SafetyPlanGenerationContext) {
  return generationContext.builderInstructions ?? null;
}

type TaskModuleContextRow = {
  title: string;
  moduleKey: string;
  subTrade: string;
  taskNames: string[];
  summary: string;
  sectionHeadings: string[];
  plainText: string;
  sourceFilename: string;
};

type HazardModuleContextRow = {
  title: string;
  moduleKey: string;
  summary: string;
  sectionHeadings: string[];
  plainText: string;
  sourceFilename: string;
  matchedReasons: string[];
};

type SteelTaskModuleContextRow = {
  title: string;
  moduleKey: string;
  trade: string | null;
  subTrade: string | null;
  taskNames: string[];
  summary: string;
  sectionHeadings: string[];
  plainText: string;
  sourceFilename: string;
};

type SteelHazardModuleContextRow = {
  title: string;
  moduleKey: string;
  summary: string;
  sectionHeadings: string[];
  plainText: string;
  sourceFilename: string;
  matchedReasons: string[];
};

type SteelProgramModuleContextRow = {
  title: string;
  moduleKey: string;
  summary: string;
  sectionHeadings: string[];
  plainText: string;
  sourceFilename: string;
  matchedReasons: string[];
};

function referencePackKeySections(sectionHeadings: string[]) {
  return sentenceList(sectionHeadings.slice(0, 3), "Section headings not parsed");
}

function referencePackInterfacesWith(taskNames: string[], fallback: string) {
  const interfaces = sentenceList(taskNames, fallback);
  return `Interfaces With: This module interfaces with other site management activities including ${interfaces}. Coordination between these activities is necessary to maintain safe and efficient site operations.`;
}

function buildReferencePackSubsections<
  T extends {
    title: string;
    summary: string;
    sourceFilename: string;
    sectionHeadings: string[];
  },
>(items: T[], detailLines: (item: T) => string[]): GeneratedSafetyPlanSubsection[] {
  return items.map((item) => ({
    title: item.title,
    body: item.summary,
    bullets: [...detailLines(item), `Source document: ${item.sourceFilename}`],
  }));
}

function getTaskModulesFromGenerationContext(
  generationContext: SafetyPlanGenerationContext
): TaskModuleContextRow[] {
  const metadata = (generationContext.siteContext.metadata ?? {}) as Record<string, unknown>;
  if (!Array.isArray(metadata.taskModules)) return [];

  return metadata.taskModules
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
    )
    .map((item) => ({
      title: textOrNull(item.title) ?? "Task module",
      moduleKey:
        textOrNull(item.moduleKey) ??
        "task_module",
      subTrade: textOrNull(item.subTrade) ?? "Unspecified",
      taskNames: stringList(item.taskNames),
      summary: textOrNull(item.summary) ?? "No summary provided.",
      sectionHeadings: stringList(item.sectionHeadings),
      plainText: textOrNull(item.plainText) ?? "",
      sourceFilename: textOrNull(item.sourceFilename) ?? "Unknown source",
    }))
    .filter((item) => item.title && item.summary);
}

function buildTaskModulesReferenceSection(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection | null {
  const taskModules = getTaskModulesFromGenerationContext(generationContext);
  if (!taskModules.length) return null;

  return {
    key: "task_modules_reference",
    title: "Task Modules Reference Pack",
    body: appendInlineOsha(
      "Task modules attached for the selected scope. This pack auto-applies when Site setup is selected in General Conditions / Site Management.",
      inlineOshaRefs
    ),
    subsections: buildReferencePackSubsections(taskModules, (item) => [
      referencePackInterfacesWith(item.taskNames, "Site setup"),
      `Key sections: ${referencePackKeySections(item.sectionHeadings)}`,
    ]),
  };
}

function getHazardModulesFromGenerationContext(
  generationContext: SafetyPlanGenerationContext
): HazardModuleContextRow[] {
  const metadata = (generationContext.siteContext.metadata ?? {}) as Record<string, unknown>;
  if (!Array.isArray(metadata.hazardModules)) return [];

  return metadata.hazardModules
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
    )
    .map((item) => ({
      title: textOrNull(item.title) ?? "Hazard module",
      moduleKey:
        textOrNull(item.moduleKey) ??
        "hazard_module",
      summary: textOrNull(item.summary) ?? "No summary provided.",
      sectionHeadings: stringList(item.sectionHeadings),
      plainText: textOrNull(item.plainText) ?? "",
      sourceFilename: textOrNull(item.sourceFilename) ?? "Unknown source",
      matchedReasons: stringList(item.matchedReasons),
    }))
    .filter((item) => item.title && item.summary);
}

function buildHazardModulesReferenceSection(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection | null {
  const hazardModules = getHazardModulesFromGenerationContext(generationContext);
  if (!hazardModules.length) return null;

  return {
    key: "hazard_modules_reference",
    title: "Hazard Modules Reference Pack",
    body: appendInlineOsha(
      "Matched hazard modules attached for the current CSEP hazards, permits, tasks, and trade selection.",
      inlineOshaRefs
    ),
    subsections: buildReferencePackSubsections(hazardModules, (item) => [
      `Why attached: ${sentenceList(item.matchedReasons, "Matched to current CSEP selection")}`,
      `Key sections: ${referencePackKeySections(item.sectionHeadings)}`,
    ]),
  };
}

function getSteelTaskModulesFromGenerationContext(
  generationContext: SafetyPlanGenerationContext
): SteelTaskModuleContextRow[] {
  const metadata = (generationContext.siteContext.metadata ?? {}) as Record<string, unknown>;
  if (!Array.isArray(metadata.steelTaskModules)) return [];

  return metadata.steelTaskModules
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
    )
    .map((item) => ({
      title: textOrNull(item.title) ?? "Steel task module",
      moduleKey: textOrNull(item.moduleKey) ?? "steel_task_module",
      trade: textOrNull(item.trade),
      subTrade: textOrNull(item.subTrade),
      taskNames: stringList(item.taskNames),
      summary: textOrNull(item.summary) ?? "No summary provided.",
      sectionHeadings: stringList(item.sectionHeadings),
      plainText: textOrNull(item.plainText) ?? "",
      sourceFilename: textOrNull(item.sourceFilename) ?? "Unknown source",
    }))
    .filter((item) => item.title && item.summary);
}

function buildSteelTaskModulesReferenceSection(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection | null {
  const taskModules = getSteelTaskModulesFromGenerationContext(generationContext);
  if (!taskModules.length) return null;

  return {
    key: "steel_task_modules_reference",
    title: "Steel Erection Task Modules Reference Pack",
    body: appendInlineOsha(
      "Steel-erection task modules attached for the active sequence, pre-task planning, access, and handoff guidance.",
      inlineOshaRefs
    ),
    subsections: buildReferencePackSubsections(taskModules, (item) => [
      referencePackInterfacesWith(item.taskNames, "Steel erection sequence"),
      `Key sections: ${referencePackKeySections(item.sectionHeadings)}`,
    ]),
  };
}

function getSteelHazardModulesFromGenerationContext(
  generationContext: SafetyPlanGenerationContext
): SteelHazardModuleContextRow[] {
  const metadata = (generationContext.siteContext.metadata ?? {}) as Record<string, unknown>;
  if (!Array.isArray(metadata.steelHazardModules)) return [];

  return metadata.steelHazardModules
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
    )
    .map((item) => ({
      title: textOrNull(item.title) ?? "Steel hazard module",
      moduleKey: textOrNull(item.moduleKey) ?? "steel_hazard_module",
      summary: textOrNull(item.summary) ?? "No summary provided.",
      sectionHeadings: stringList(item.sectionHeadings),
      plainText: textOrNull(item.plainText) ?? "",
      sourceFilename: textOrNull(item.sourceFilename) ?? "Unknown source",
      matchedReasons: stringList(item.matchedReasons),
    }))
    .filter((item) => item.title && item.summary);
}

function buildSteelHazardModulesReferenceSection(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection | null {
  const hazardModules = getSteelHazardModulesFromGenerationContext(generationContext);
  if (!hazardModules.length) return null;

  return {
    key: "steel_hazard_modules_reference",
    title: "Steel Erection Hazard Modules Reference Pack",
    body: appendInlineOsha(
      "Matched steel-erection hazard modules attached for the current scope, hazards, permits, and high-risk focus areas.",
      inlineOshaRefs
    ),
    subsections: buildReferencePackSubsections(hazardModules, (item) => [
      `Why attached: ${sentenceList(item.matchedReasons, "Matched to current steel work selection")}`,
      `Key sections: ${referencePackKeySections(item.sectionHeadings)}`,
    ]),
  };
}

function getSteelProgramModulesFromGenerationContext(
  generationContext: SafetyPlanGenerationContext
): SteelProgramModuleContextRow[] {
  const metadata = (generationContext.siteContext.metadata ?? {}) as Record<string, unknown>;
  if (!Array.isArray(metadata.steelProgramModules)) return [];

  return metadata.steelProgramModules
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
    )
    .map((item) => ({
      title: textOrNull(item.title) ?? "Steel program module",
      moduleKey: textOrNull(item.moduleKey) ?? "steel_program_module",
      summary: textOrNull(item.summary) ?? "No summary provided.",
      sectionHeadings: stringList(item.sectionHeadings),
      plainText: textOrNull(item.plainText) ?? "",
      sourceFilename: textOrNull(item.sourceFilename) ?? "Unknown source",
      matchedReasons: stringList(item.matchedReasons),
    }))
    .filter((item) => item.title && item.summary);
}

function buildSteelProgramModulesReferenceSection(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection | null {
  const programModules = getSteelProgramModulesFromGenerationContext(generationContext);
  if (!programModules.length) return null;

  return {
    key: "steel_program_modules_reference",
    title: "Steel Erection High-Risk Programs Reference Pack",
    body: appendInlineOsha(
      "Steel-erection high-risk program modules attached to supplement, not replace, the authored CSEP or PSHSEP program text.",
      inlineOshaRefs
    ),
    subsections: buildReferencePackSubsections(programModules, (item) => [
      `Why attached: ${sentenceList(item.matchedReasons, "Matched to current steel work selection")}`,
      `Key sections: ${referencePackKeySections(item.sectionHeadings)}`,
    ]),
  };
}

function hasSelectedCsepBlock(
  instructions: CsepBuilderInstructions | null,
  key: CsepBuilderBlockKey
) {
  if (!instructions) return true;
  return instructions.selectedBlockKeys.includes(key);
}

function getCsepBlockInput(
  instructions: CsepBuilderInstructions | null,
  key: CsepBuilderBlockKey
) {
  if (!instructions) return null;
  return instructions.blockInputs[key] ?? null;
}

function asTextList(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.map((entry) => entry.trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function asTextValue(value: string | string[] | null | undefined) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function combineParagraphs(parts: Array<string | null | undefined>, fallback?: string) {
  const value = parts.map((part) => part?.trim()).filter(Boolean).join(" ");
  return value || fallback || null;
}

function splitBuilderTextToBullets(value: string | null | undefined) {
  if (!value?.trim()) return [];

  const lines = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((item) =>
      item
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/__(.+?)__/g, "$1")
        .trim()
    )
    .filter(Boolean);

  const bulletLines = lines
    .filter((item) => /^[-*•]\s+/.test(item))
    .map((item) => item.replace(/^[-*•]\s+/, "").trim())
    .filter(Boolean);

  if (bulletLines.length > 0) {
    const hasNarrativeOrHeadings = lines.some((item) => !/^[-*•]\s+/.test(item));
    return hasNarrativeOrHeadings ? [] : dedupe(bulletLines);
  }

  if (lines.length === 1 && lines[0].includes(";")) {
    const segments = lines[0]
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);

    const looksLikeSimpleList =
      segments.length > 1 && segments.every((item) => item.length <= 160 && !/[.!?]\s+[A-Z]/.test(item));

    return looksLikeSimpleList ? dedupe(segments) : [];
  }

  return [];
}

function prefixedInstructionBullets(values: string[], prefix: string) {
  const normalizedPrefix = prefix.toLowerCase();
  return dedupe(
    values
      .filter((item) => item.toLowerCase().startsWith(normalizedPrefix))
      .map((item) => item.slice(prefix.length).trim())
      .filter(Boolean)
  );
}

function humanizeCode(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function orderGeneratedSections(
  sections: GeneratedSafetyPlanSection[]
): GeneratedSafetyPlanSection[] {
  const isPshsep = sections.some((section) =>
    [
      "project_oversight_roles",
      "contractor_coordination",
      "incident_injury_response",
      "inspections_recurring_events",
    ].includes(section.key)
  );
  const definitionsSection = sections.find((section) => section.key === "definitions");
  const referencesSection = sections.find(
    (section) =>
      section.key === "references" ||
      section.key === "osha_references" ||
      section.key === "osha_reference_appendix"
  );
  const jurisdictionProfileSection = sections.find(
    (section) => section.key === "jurisdiction_profile"
  );
  const remainingSections = sections.filter(
    (section) =>
      section.key !== definitionsSection?.key &&
      section.key !== referencesSection?.key &&
      section.key !== jurisdictionProfileSection?.key
  );
  const narrativeSections = remainingSections.filter(
    (section) => !section.table && !section.key.startsWith("program_permit__")
  );
  const tableSections = remainingSections.filter((section) => Boolean(section.table));
  const permitProgramSections = remainingSections.filter((section) =>
    section.key.startsWith("program_permit__")
  );

  return [
    ...(definitionsSection ? [definitionsSection] : []),
    ...(isPshsep
      ? [...(referencesSection ? [referencesSection] : []), ...(jurisdictionProfileSection ? [jurisdictionProfileSection] : [])]
      : [...(jurisdictionProfileSection ? [jurisdictionProfileSection] : []), ...(referencesSection ? [referencesSection] : [])]),
    ...narrativeSections,
    ...tableSections,
    ...permitProgramSections,
  ];
}

function orderCsepReferencePacksBeforePrograms(
  sections: GeneratedSafetyPlanSection[]
): GeneratedSafetyPlanSection[] {
  const referencePackKeys = new Set([
    "task_modules_reference",
    "hazard_modules_reference",
    "steel_task_modules_reference",
    "steel_hazard_modules_reference",
    "steel_program_modules_reference",
  ]);
  const referencePacks = sections.filter((section) => referencePackKeys.has(section.key));

  if (!referencePacks.length) return sections;

  const withoutReferencePacks = sections.filter((section) => !referencePackKeys.has(section.key));
  const firstProgramIndex = withoutReferencePacks.findIndex((section) =>
    section.key.startsWith("program_")
  );

  if (firstProgramIndex === -1) {
    return [...withoutReferencePacks, ...referencePacks];
  }

  return [
    ...withoutReferencePacks.slice(0, firstProgramIndex),
    ...referencePacks,
    ...withoutReferencePacks.slice(firstProgramIndex),
  ];
}

function buildPshsepAdminSections(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection[] {
  const structured = getPshsepStructuredInputs(generationContext);
  const disciplinaryPolicy =
    structured.disciplinaryPolicyText ??
    "Each employer must enforce progressive discipline for noncompliance with plan requirements, including stop-work and removal where needed.";
  const ownerLetter =
    structured.ownerLetterText ??
    `Owner leadership affirms that all contractors must plan work safely, comply with this ${SITE_SAFETY_BLUEPRINT_TITLE}, and immediately report hazards and incidents.`;
  const specialConditionsPermit =
    structured.specialConditionsPermitText ??
    `Any variation from this ${SITE_SAFETY_BLUEPRINT_TITLE} requires documented review, approval authority, temporary controls, and expiration criteria.`;

  return [
    {
      key: "admin_disciplinary_policy",
      title: "Disciplinary Policy",
      body: appendInlineOsha(disciplinaryPolicy, inlineOshaRefs),
    },
    {
      key: "admin_owner_letter",
      title: "Letter from Owner",
      body: appendInlineOsha(ownerLetter, inlineOshaRefs),
    },
    {
      key: "admin_special_conditions_permit",
      title: "Special Conditions Permit (Variations)",
      body: appendInlineOsha(specialConditionsPermit, inlineOshaRefs),
    },
    {
      key: "admin_assumed_trades_index",
      title: "Assumed Trades Index",
      body: appendInlineOsha(
        structured.assumedTrades.length
          ? "The following trades are assumed to participate and must coordinate pre-task planning."
          : "No assumed trades were provided in the current draft.",
        inlineOshaRefs
      ),
      bullets: structured.assumedTrades.length
        ? structured.assumedTrades
        : ["No assumed trades were listed."],
    },
  ];
}

function hasAnyToken(values: string[], tokens: string[]) {
  const haystack = values.join(" | ").toLowerCase();
  return tokens.some((token) => haystack.includes(token));
}

function appendSentence(base: string | null | undefined, addition: string | null | undefined) {
  const parts = [base?.trim(), addition?.trim()].filter(Boolean);
  return parts.join(" ");
}

function buildTextFromParts(parts: Array<string | null | undefined>, fallback: string) {
  const text = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return text || fallback;
}

function getPshsepStructuredInputs(generationContext: SafetyPlanGenerationContext) {
  const metadata = (generationContext.siteContext.metadata ?? {}) as Record<string, unknown>;
  const starterSections = (metadata.starterSections ?? {}) as Record<string, unknown>;
  const legacy = generationContext.legacyFormSnapshot as Record<string, unknown>;
  const emergencyMap = (metadata.emergencyMap ?? {}) as Record<string, unknown>;

  return {
    ownerSpecificRequirementsText: textOrNull(
      starterSections.ownerSpecificRequirementsText ?? legacy.owner_specific_requirements_text
    ),
    definitionsText: textOrNull(starterSections.definitionsText ?? legacy.definitions_text),
    oversightRolesText: textOrNull(starterSections.oversightRolesText ?? legacy.oversight_roles_text),
    competentPersonRequirementsText: textOrNull(
      starterSections.competentPersonRequirementsText ??
        legacy.competent_person_requirements_text
    ),
    staffingRequirementsText: textOrNull(
      starterSections.staffingRequirementsText ?? legacy.staffing_requirements_text
    ),
    tradeTrainingRequirementsText: textOrNull(
      starterSections.tradeTrainingRequirementsText ??
        legacy.trade_training_requirements_text
    ),
    certificationRequirementsText: textOrNull(
      starterSections.certificationRequirementsText ??
        legacy.certification_requirements_text
    ),
    contractorCoordinationText: textOrNull(
      starterSections.contractorCoordinationText ?? legacy.contractor_coordination_text
    ),
    ancillaryContractors: stringList(
      starterSections.ancillaryContractors ?? legacy.ancillary_contractors
    ),
    ancillaryContractorsNotes: textOrNull(
      starterSections.ancillaryContractorsNotes ?? legacy.ancillary_contractors_notes
    ),
    disciplinaryPolicyText: textOrNull(
      starterSections.disciplinaryPolicyText ?? legacy.disciplinary_policy_text
    ),
    ownerLetterText: textOrNull(starterSections.ownerLetterText ?? legacy.owner_letter_text),
    incidentReportingProcessText: textOrNull(
      starterSections.incidentReportingProcessText ??
        legacy.incident_reporting_process_text
    ),
    incidentInvestigationText: textOrNull(
      starterSections.incidentInvestigationText ?? legacy.incident_investigation_text
    ),
    specialConditionsPermitText: textOrNull(
      starterSections.specialConditionsPermitText ??
        legacy.special_conditions_permit_text
    ),
    assumedTrades: stringList(starterSections.assumedTradesIndex ?? legacy.assumed_trades_index),
    highRiskFocusAreas: stringList(
      starterSections.highRiskFocusAreas ?? legacy.high_risk_focus_areas
    ),
    clinicName: textOrNull(starterSections.clinicName ?? legacy.clinic_name),
    clinicAddress: textOrNull(starterSections.clinicAddress ?? legacy.clinic_address),
    clinicHours: textOrNull(starterSections.clinicHours ?? legacy.clinic_hours),
    postedEmergencyContactsText: textOrNull(
      starterSections.postedEmergencyContactsText ??
        legacy.posted_emergency_contacts_text
    ),
    emergencyPostingLocation: textOrNull(
      starterSections.emergencyPostingLocation ?? legacy.emergency_posting_location
    ),
    inspectionProcessText: textOrNull(
      starterSections.inspectionProcessText ?? legacy.inspection_process_text
    ),
    eventCalendarItems: stringList(
      starterSections.eventCalendarItems ?? legacy.event_calendar_items
    ),
    eventCalendarNotesText: textOrNull(
      starterSections.eventCalendarNotesText ?? legacy.event_calendar_notes_text
    ),
    weatherSopText: textOrNull(starterSections.weatherSopText ?? legacy.weather_sop_text),
    environmentalControlsText: textOrNull(
      starterSections.environmentalControlsText ?? legacy.environmental_controls_text
    ),
    ppeSpecificsText: textOrNull(starterSections.ppeSpecificsText ?? legacy.ppe_specifics_text),
    equipmentControlsText: textOrNull(
      starterSections.equipmentControlsText ?? legacy.equipment_controls_text
    ),
    chemicalStorageText: textOrNull(
      starterSections.chemicalStorageText ?? legacy.chemical_storage_text
    ),
    aedLocation: textOrNull(emergencyMap.aed_location),
    firstAidLocation: textOrNull(emergencyMap.first_aid_location),
    assemblyPoint: textOrNull(emergencyMap.assembly_point),
    nearestHospital: textOrNull(emergencyMap.nearest_hospital),
    emergencyContact: textOrNull(emergencyMap.emergency_contact),
    emergencyMapAttached: Boolean(textOrNull(emergencyMap.site_map)),
  };
}

function buildPshsepCoreSections(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[],
  ruleSummary: {
    permitTriggers: string[];
    ppeRequirements: string[];
    requiredControls: string[];
    hazardCategories: string[];
    siteRestrictions: string[];
    prohibitedEquipment: string[];
    trainingRequirements: string[];
    weatherRestrictions: string[];
  }
): GeneratedSafetyPlanSection[] {
  const structured = getPshsepStructuredInputs(generationContext);
  const trainingRows = [
    [
      "OSHA 10",
      generationContext.legacyFormSnapshot.requires_osha10 ? "Required" : "Not specified",
    ],
    [
      "OSHA 30 (PM / Superintendent)",
      generationContext.legacyFormSnapshot.requires_osha30_pm_super_within_5yrs
        ? "Required within the stated refresh window"
        : "Not specified",
    ],
    [
      "On-site OSHA 30 supervision",
      generationContext.legacyFormSnapshot.requires_osha30_supervisor_on_site
        ? "Required"
        : "Not specified",
    ],
    [
      "Orientation / access",
      generationContext.legacyFormSnapshot.orientation_required
        ? "Orientation required before work starts"
        : "Orientation requirement not specified",
    ],
    [
      "Trade / certification notes",
      sentenceList(
        [
          structured.tradeTrainingRequirementsText ?? "",
          structured.certificationRequirementsText ?? "",
        ].filter(Boolean),
        "No project-specific trade or certification notes were provided."
      ),
    ],
  ];

  return [
    {
      key: "project_oversight_roles",
      title: "Project Oversight, Roles & Staffing",
      body: appendInlineOsha(
        buildTextFromParts(
          [
            structured.oversightRolesText,
            structured.competentPersonRequirementsText,
            structured.staffingRequirementsText,
          ],
          "Describe how owner, GC / CM, contractor supervision, and designated competent persons oversee the work and adjust staffing as the project scales."
        ),
        inlineOshaRefs
      ),
      bullets: dedupe(
        [
          generationContext.project.ownerClient
            ? `Owner / client: ${generationContext.project.ownerClient}`
            : "",
          generationContext.project.gcCm ? `GC / CM: ${generationContext.project.gcCm}` : "",
          generationContext.project.contractorCompany
            ? `Contractor: ${generationContext.project.contractorCompany}`
            : "",
          structured.ownerSpecificRequirementsText
            ? `Owner-specific requirements captured for this project.`
            : "",
        ].filter(Boolean)
      ),
    },
    {
      key: "contractor_coordination",
      title: "Contractor Coordination & Ancillary Contractors",
      body: appendInlineOsha(
        buildTextFromParts(
          [structured.contractorCoordinationText, structured.ancillaryContractorsNotes],
          "Coordinate primary trades and ancillary service providers before startup so access, housekeeping, waste removal, and shared-area controls are defined in advance."
        ),
        inlineOshaRefs
      ),
      bullets: dedupe([
        ...(structured.assumedTrades.length
          ? structured.assumedTrades.map((trade) => `Assumed trade: ${trade}`)
          : ["Assumed trade list not yet provided."]),
        ...(structured.ancillaryContractors.length
          ? structured.ancillaryContractors.map(
              (contractor) => `Ancillary contractor: ${contractor}`
            )
          : ["No ancillary contractor list provided."]),
      ]),
    },
    {
      key: "training_certifications",
      title: "Training & Certification Requirements",
      body: appendInlineOsha(
        buildTextFromParts(
          [
            structured.tradeTrainingRequirementsText,
            structured.certificationRequirementsText,
          ],
          "Document trade-specific training, equipment qualifications, and certification expectations before mobilization rather than waiting for the safety team to request missing records."
        ),
        inlineOshaRefs
      ),
      table: {
        columns: ["Requirement", "Expectation"],
        rows: trainingRows,
      },
    },
    {
      key: "incident_injury_response",
      title: "Incident, Injury & Investigation Response",
      body: appendInlineOsha(
        buildTextFromParts(
          [
            structured.incidentReportingProcessText,
            structured.incidentInvestigationText,
          ],
          `This section applies to every ${SITE_SAFETY_BLUEPRINT_TITLE} and must explain who reports injuries, when escalation occurs, where treatment is obtained, and how investigations and corrective actions are documented.`
        ),
        inlineOshaRefs
      ),
      bullets: dedupe([
        structured.emergencyContact
          ? `Emergency contact number: ${structured.emergencyContact}`
          : "",
        structured.nearestHospital
          ? `Nearest hospital: ${structured.nearestHospital}`
          : "",
      ]),
    },
    {
      key: "emergency_facilities_contacts",
      title: "Emergency Facilities, Posting & Site Contacts",
      body: appendInlineOsha(
        buildTextFromParts(
          [
            structured.postedEmergencyContactsText,
            structured.emergencyPostingLocation,
          ],
          "Identify treatment resources, emergency equipment, posted contacts, and the addendum or posting locations crews will use in the field."
        ),
        inlineOshaRefs
      ),
      table: {
        columns: ["Field", "Value"],
        rows: [
          ["Clinic / occupational health provider", structured.clinicName ?? "N/A"],
          ["Clinic address", structured.clinicAddress ?? "N/A"],
          ["Clinic hours", structured.clinicHours ?? "N/A"],
          ["AED location", structured.aedLocation ?? "N/A"],
          ["First aid location", structured.firstAidLocation ?? "N/A"],
          ["Assembly point", structured.assemblyPoint ?? "N/A"],
          ["Nearest hospital", structured.nearestHospital ?? "N/A"],
          ["Emergency contact", structured.emergencyContact ?? "N/A"],
          ["Emergency map attached", structured.emergencyMapAttached ? "Yes" : "No"],
        ],
      },
    },
    {
      key: "inspections_recurring_events",
      title: "Inspections & Recurring Event Calendar",
      body: appendInlineOsha(
        buildTextFromParts(
          [structured.inspectionProcessText, structured.eventCalendarNotesText],
          `Define routine inspections, trigger-based inspections, agency walk-throughs, and recurring event cadence so the ${SITE_SAFETY_BLUEPRINT_TITLE} becomes an operating calendar instead of a static narrative.`
        ),
        inlineOshaRefs
      ),
      bullets: structured.eventCalendarItems.length
        ? structured.eventCalendarItems
        : ["No recurring event calendar items were listed."],
    },
    {
      key: "weather_environmental_controls",
      title: "Weather & Environmental Controls",
      body: appendInlineOsha(
        buildTextFromParts(
          [structured.weatherSopText, structured.environmentalControlsText],
          "Address weather-triggered stop-work or review conditions, stormwater controls, waste-stream handling, and environmental walk expectations in terms crews can apply in the field."
        ),
        inlineOshaRefs
      ),
      bullets: dedupe([
        ...ruleSummary.weatherRestrictions,
        structured.chemicalStorageText
          ? "Chemical and gas storage expectations are defined for compatibility, labeling, and separation."
          : "",
      ]),
    },
    {
      key: "ppe_work_access_controls",
      title: "PPE, Access & Work Access Controls",
      body: appendInlineOsha(
        buildTextFromParts(
          [structured.ppeSpecificsText, structured.equipmentControlsText],
          "Clarify PPE expectations, access equipment rules, tag systems, and charging / staging controls so the document addresses common field execution gaps directly."
        ),
        inlineOshaRefs
      ),
      table: {
        columns: ["Category", "Expectation"],
        rows: [
          ["PPE", sentenceList(ruleSummary.ppeRequirements, "See project-specific PPE text.")],
          ["Required controls", sentenceList(ruleSummary.requiredControls)],
          ["Site restrictions", sentenceList(ruleSummary.siteRestrictions, "None listed.")],
          [
            "Prohibited equipment",
            sentenceList(ruleSummary.prohibitedEquipment, "None listed."),
          ],
        ],
      },
    },
  ];
}

function buildPshsepHighRiskSections(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection[] {
  const structured = getPshsepStructuredInputs(generationContext);
  const tokenSource = [
    ...generationContext.scope.trades,
    ...generationContext.scope.tasks,
    ...structured.highRiskFocusAreas,
    ...(generationContext.operations.flatMap((operation) =>
      stringList((operation.metadata as Record<string, unknown> | undefined)?.permitLabels)
    ) ?? []),
  ];

  const sectionConfigs = [
    {
      key: "high_risk_excavation",
      title: "Excavation & Ground Disturbance",
      tokens: ["excavat", "trench", "groundbreaking"],
      body:
        "Address competent-person oversight, utility verification, ingress / egress, spoil management, adjacent loads, water intrusion, and atmospheric evaluation where trench conditions warrant it.",
      bullets: [
        "Define when excavation permits or notifications are required before breaking ground.",
        "Describe trench access, inspections, and escalation for changing soil or water conditions.",
      ],
    },
    {
      key: "high_risk_confined_space",
      title: "Confined Space Entry",
      tokens: ["confined", "tank entry", "entry"],
      body:
        "Separate permit-required and non-permit evaluations, define entrant / attendant / supervisor responsibilities, and explain monitoring, rescue planning, and retrieval equipment expectations.",
      bullets: [
        "Clarify how trench, vault, or tank entries are evaluated before work begins.",
        "Document attendant, rescue, first-aid, and atmospheric monitoring expectations.",
      ],
    },
    {
      key: "high_risk_loto",
      title: "LOTO & Stored Energy Isolation",
      tokens: ["loto", "electrical", "stored energy", "isolation"],
      body:
        "Cover all energy sources, zero-energy verification, group lockout, shift change continuity, and any owner or project-specific energized-work escalation process.",
      bullets: [
        "Do not limit this section to electrical isolation when hydraulic, pneumatic, thermal, or other stored energy exists.",
        "Explain how verification is documented before crews begin work.",
      ],
    },
    {
      key: "high_risk_hot_work",
      title: "Hot Work & Fire Watch",
      tokens: ["hot work", "fire watch", "welding"],
      body:
        "Define how hot work permits are issued, what changes require revalidation, where fire watches are stationed, and how long monitoring continues based on project and governing requirements.",
      bullets: [
        "State who may issue permits and how shift, floor, wall, or barrier changes are handled.",
        "Require extinguishing equipment and dedicated fire-watch coverage without assigning unrelated duties.",
      ],
    },
    {
      key: "high_risk_access",
      title: "Ladders, Scaffolds & Work Access",
      tokens: ["ladder", "scaffold", "access", "mewp", "roof"],
      body:
        "Address approved ladder types, scaffold tag conditions, fall-protection triggers for access changes, and restrictions on unsuitable or improvised access equipment.",
      bullets: [
        "Explain tag colors or site status indicators where those are used on the project.",
        "Clarify access expectations for elevated scaffold ladders, MEWPs, and temporary access points.",
      ],
    },
    {
      key: "high_risk_equipment",
      title: "Heavy Equipment, Travel Paths & Spotters",
      tokens: ["equipment", "forklift", "crane", "spotter", "material handling"],
      body:
        "Define travel paths, exclusion zones, backing / blind-spot support, charging or fueling housekeeping, and when spotters are required or may only be downgraded by project-specific decision.",
      bullets: [
        "Prevent cords, hoses, or fuel lines from blocking egress and walking surfaces.",
        "Describe communication expectations between operators and spotters during movement and setup.",
      ],
    },
    {
      key: "high_risk_hand_power_tools",
      title: "Hand & Power Tools",
      tokens: ["hand", "power tool", "tool"],
      body:
        "Expand beyond generic tool language by addressing hand placement, line-of-fire exposure, guards and grips, hose / air connection integrity, and maintenance expectations.",
      bullets: [
        "Use task examples where needed so tool requirements are not confused with equipment sections.",
        "Address compressed air use, fittings, and reduction requirements based on tool design and manufacturer instructions.",
      ],
    },
    {
      key: "high_risk_steel_erection",
      title: "Steel Erection, Rigging & Related Hot Work",
      tokens: ["steel", "rigging", "ironworker", "crane"],
      body:
        "Describe sequencing, fall protection, rigging review, crane coordination, connector and ironworker qualifications, and related welding or panel work that occurs during steel operations.",
      bullets: [
        "Order the section to match how steel work occurs on site rather than leaving it as a late generic add-on.",
        "Cross-reference common issues such as crane, hot work, and line-of-fire controls where applicable.",
      ],
    },
    {
      key: "high_risk_concrete_masonry",
      title: "Concrete, Masonry & Washout Controls",
      tokens: ["concrete", "masonry", "cmu"],
      body:
        "Address boom or placement equipment, washout locations, ground protection, material storage, slurry handling, and labeling or environmental controls tied to concrete and masonry work.",
      bullets: [
        "Include storage and stacking expectations where material stability matters.",
        "Define washout and slurry containment before work starts.",
      ],
    },
    {
      key: "high_risk_hazardous_waste",
      title: "Hazardous Waste & Environmental Release Prevention",
      tokens: ["hazardous waste", "environmental", "stormwater", "waste"],
      body:
        "Define waste-stream labeling, spill prevention, release response, stormwater checks, and environmental event walk expectations so field teams understand the site-specific environmental program.",
      bullets: [
        "Identify how liquid and solid waste streams are labeled and separated.",
        "Add routine environmental walks or stormwater checks to the event calendar where required.",
      ],
    },
    {
      key: "high_risk_chemical_storage",
      title: "Gases, Chemicals & Storage Compatibility",
      tokens: ["gas", "chemical", "storage", "oxygen", "cylinder"],
      body: appendSentence(
        "Document compatibility / incompatibility, storage locations, labeling, separation expectations, and handling requirements for gases and chemicals used or stored on site.",
        structured.chemicalStorageText
      ),
      bullets: [
        "Do not leave this section at 'where applicable'; explain how location, distance, or barrier decisions are made on the project.",
        "Address container labeling and storage segregation for chemicals, oxidizers, and compressed gases.",
      ],
    },
  ];

  return sectionConfigs
    .filter((config) => hasAnyToken(tokenSource, config.tokens))
    .map((config) => ({
      key: config.key,
      title: config.title,
      body: appendInlineOsha(config.body, inlineOshaRefs),
      bullets: config.bullets,
    }));
}

function collectOshaReferences(
  generationContext: SafetyPlanGenerationContext,
  programSections: GeneratedSafetyPlanSection[],
  narrativeSections?: Record<string, string>
) {
  const refs = new Set<string>();
  for (const operation of generationContext.operations) {
    const operationRefs = stringList((operation.metadata as Record<string, unknown> | undefined)?.oshaRefs);
    operationRefs.forEach((ref) => refs.add(ref));
  }
  for (const section of programSections) {
    const refsSection = section.subsections?.find((subsection) => subsection.title === "Applicable References");
    refsSection?.bullets.forEach((ref) => refs.add(ref));
  }
  Object.values(narrativeSections ?? {}).forEach((value) => {
    const extracted = extractInlineOshaSuffix(value);
    if (!extracted?.referencesText) return;

    extracted.referencesText
      .split(/\s*,\s*/)
      .map((reference) => reference.trim())
      .filter(Boolean)
      .forEach((reference) => refs.add(reference));
  });
  return [...refs];
}

type DraftParams = {
  generationContext: SafetyPlanGenerationContext;
  reviewContext: AiReviewContext;
  conflictMatrix: ConflictMatrix;
  programDefinitions?: CSEPProgramDefinition[];
  jurisdictionStandardsConfig?: JurisdictionStandardsConfig;
  trainingProgram?: SafetyPlanTrainingProgram;
  narrativeSections?: Record<string, string>;
  aiAssemblyDecisions?: CsepAiAssemblyDecisions | null;
  riskMemorySummary?: JsonObject | null;
};

function buildTrainingProgramSection(
  trainingProgram: SafetyPlanTrainingProgram
): GeneratedSafetyPlanSection {
  return {
    key: "training_program",
    title: "Training Program",
    body: trainingProgram.rows.length
      ? "Training requirements were derived from the selected trade scope, task templates, and rule evaluation outputs for the current contractor plan."
      : "No task-based training requirements were derived from the current contractor plan inputs.",
    table: {
      columns: ["Trade", "Subtrade", "Task", "Required Training", "Why / Source"],
      rows: trainingProgram.rows.length
        ? trainingProgram.rows.map((row) => [
            row.tradeLabel ?? row.tradeCode ?? "N/A",
            row.subTradeLabel ?? row.subTradeCode ?? "N/A",
            row.taskTitle,
            row.trainingTitle,
            row.whySource,
          ])
        : [["N/A", "N/A", "N/A", "No task-based training derived", "N/A"]],
    },
  };
}

function buildTradeConflictCoordinationSection(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection {
  const profile = getTradeConflictProfile(
    generationContext.documentProfile.projectDeliveryType
  );

  return {
    key: "trade_conflict_coordination_framework",
    title: "Trade Conflict Coordination Framework",
    body: appendInlineOsha(
      `This baseline trade coordination map reflects the ${projectDeliveryTypeLabel(
        generationContext.documentProfile.projectDeliveryType
      )} delivery profile. Use it alongside the current simultaneous-operations findings: the baseline framework highlights typical phase-to-trade interfaces, while the conflict engine identifies project-specific overlaps that are active in the current plan.`,
      inlineOshaRefs
    ),
    table: {
      columns: ["Phase", "Trade / Function", "Typical Conflicts", "Mitigation Focus"],
      rows: profile.rows.map((row) => [
        row.phaseTitle,
        row.tradeFunctionLabel,
        row.conflictSummary,
        row.mitigationFocus,
      ]),
    },
  };
}

export function buildFallbackNarratives(params: DraftParams) {
  const trades = dedupe(
    params.generationContext.operations.map(
      (operation) => operation.tradeLabel ?? operation.tradeCode ?? "Unspecified trade"
    )
  );
  const controls = dedupe(
    params.reviewContext.rulesEvaluations.flatMap((row) => row.requiredControls)
  );
  const conflictCount = params.conflictMatrix.items.length;
  const siteRestrictions = dedupe(
    params.reviewContext.rulesEvaluations.flatMap((row) => row.siteRestrictions)
  );

  return {
    tradeBreakdownSummary: `Active work covers ${trades.join(", ")} with controls aligned to the current scope, equipment, and site conditions.`,
    riskPrioritySummary: `The highest priorities are enforcing ${sentenceList(
      controls.slice(0, 5),
      "required controls"
    )} while managing ${conflictCount} simultaneous-operation conflict(s).`,
    requiredControlsSummary: `Required controls are driven by the rules engine before AI drafting and must be verified in the field before work starts.`,
    safetyNarrative: `This ${params.generationContext.documentProfile.documentType.toUpperCase()} is assembled from normalized project scope, deterministic rules, and conflict detection. Current planning emphasizes ${sentenceList(
      controls.slice(0, 4),
      "site controls"
    )}. ${
      conflictCount > 0
        ? `Simultaneous-operation risks require active coordination across crews.`
        : `No active simultaneous-operation conflicts were identified in the current planning set.`
    } ${
      siteRestrictions.length
        ? `Site restrictions in force include ${sentenceList(siteRestrictions)}.`
        : ""
    }`.trim(),
  };
}

function buildCsepSelectedSections(params: {
  generationContext: SafetyPlanGenerationContext;
  operations: GeneratedSafetyPlanDraft["operations"];
  ruleSummary: GeneratedSafetyPlanDraft["ruleSummary"];
  conflictMatrix: ConflictMatrix;
  trainingProgram: SafetyPlanTrainingProgram;
  narrativeSections: Record<string, string>;
  oshaReferences: string[];
  inlineOshaRefs: string[];
}) {
  const instructions = getCsepBuilderInstructions(params.generationContext);
  const selectedSectionOrder = instructions?.selectedBlockKeys ?? [];
  const groupedTradePackages = groupOperationsByTradePackage(params.operations);
  const project = params.generationContext.project;
  const scope = params.generationContext.scope;
  const tradeSummaryInput = asTextValue(getCsepBlockInput(instructions, "trade_summary"));
  const scopeOfWorkInput = asTextValue(getCsepBlockInput(instructions, "scope_of_work"));
  const siteNotesInput = asTextValue(getCsepBlockInput(instructions, "site_specific_notes"));
  const emergencyInput = asTextValue(getCsepBlockInput(instructions, "emergency_procedures"));
  const weatherInput = asTextList(
    getCsepBlockInput(instructions, "weather_requirements_and_severe_weather_response")
  );
  const ppeInput = asTextList(getCsepBlockInput(instructions, "required_ppe"));
  const permitInput = asTextList(getCsepBlockInput(instructions, "additional_permits"));
  const overlapInput = asTextList(getCsepBlockInput(instructions, "common_overlapping_trades"));
  const oshaInput = asTextList(getCsepBlockInput(instructions, "osha_references"));
  const hazardInput = asTextList(getCsepBlockInput(instructions, "selected_hazards"));
  const rolesInput = asTextValue(getCsepBlockInput(instructions, "roles_and_responsibilities"));
  const securityInput = asTextValue(getCsepBlockInput(instructions, "security_and_access"));
  const healthInput = asTextValue(getCsepBlockInput(instructions, "health_and_wellness"));
  const incidentInput = asTextValue(
    getCsepBlockInput(instructions, "incident_reporting_and_investigation")
  );
  const trainingInput = asTextValue(getCsepBlockInput(instructions, "training_and_instruction"));
  const drugAlcoholInput = asTextValue(
    getCsepBlockInput(instructions, "drug_and_alcohol_testing")
  );
  const enforcementInput = asTextValue(
    getCsepBlockInput(instructions, "enforcement_and_corrective_action")
  );
  const recordkeepingInput = asTextValue(getCsepBlockInput(instructions, "recordkeeping"));
  const continuousImprovementInput = asTextValue(
    getCsepBlockInput(instructions, "continuous_improvement")
  );
  const selectedFormatSections = new Set<CsepFormatSectionKey>(
    instructions?.selectedFormatSectionKeys ?? []
  );
  const taskModulesSection = buildTaskModulesReferenceSection(
    params.generationContext,
    params.inlineOshaRefs
  );
  const hazardModulesSection = buildHazardModulesReferenceSection(
    params.generationContext,
    params.inlineOshaRefs
  );
  const steelTaskModulesSection = buildSteelTaskModulesReferenceSection(
    params.generationContext,
    params.inlineOshaRefs
  );
  const steelHazardModulesSection = buildSteelHazardModulesReferenceSection(
    params.generationContext,
    params.inlineOshaRefs
  );
  const steelProgramModulesSection = buildSteelProgramModulesReferenceSection(
    params.generationContext,
    params.inlineOshaRefs
  );
  const hasRequiredPpeSectionContent =
    ppeInput.length > 0 || params.ruleSummary.ppeRequirements.length > 0;
  const hasPermitSectionContent =
    permitInput.length > 0 ||
    params.ruleSummary.permitTriggers.length > 0 ||
    groupedTradePackages.some((pkg) => pkg.permitTriggers.length > 0);
  const hasOverlapSectionContent =
    overlapInput.length > 0 ||
    params.generationContext.siteContext.simultaneousOperations.length > 0 ||
    params.conflictMatrix.items.length > 0;
  const hasOshaSectionContent =
    oshaInput.length > 0 || params.oshaReferences.length > 0;
  const hasSelectedHazardsSectionContent =
    hazardInput.length > 0 ||
    params.ruleSummary.hazardCategories.length > 0 ||
    groupedTradePackages.some((pkg) => pkg.hazardCategories.length > 0) ||
    params.operations.some((operation) => operation.hazardCategories.length > 0);

  const sectionsByKey: Partial<Record<CsepBuilderBlockKey, GeneratedSafetyPlanSection>> = {
    project_information: {
      key: "project_information",
      title: CSEP_BUILDER_BLOCK_TITLES.project_information,
      body: appendInlineOsha(
        combineParagraphs(
          [
            project.projectName
              ? `Project ${project.projectName} is the active contractor planning record for this scope.`
              : null,
            project.projectAddress ? `Work location: ${project.projectAddress}.` : null,
          ],
          "Project details were not fully provided in the current builder payload."
        ),
        params.inlineOshaRefs
      ),
      table: {
        columns: ["Field", "Value"],
        rows: [
          ["Project Name", project.projectName || "N/A"],
          ["Project Number", project.projectNumber ?? "N/A"],
          ["Project Address", project.projectAddress ?? "N/A"],
          ["Owner / Client", project.ownerClient ?? "N/A"],
          ["GC / CM", project.gcCm ?? "N/A"],
          ["Governing State", params.generationContext.documentProfile.governingState ?? "N/A"],
        ],
      },
    },
    contractor_information: {
      key: "contractor_information",
      title: CSEP_BUILDER_BLOCK_TITLES.contractor_information,
      body: combineParagraphs(
        [
          project.contractorCompany
            ? `${project.contractorCompany} is the submitting contractor for this CSEP.`
            : null,
          project.contractorContact ? `Primary contact: ${project.contractorContact}.` : null,
        ],
        "Contractor contact details were not fully provided in the current builder payload."
      ),
      table: {
        columns: ["Field", "Value"],
        rows: [
          ["Contractor Company", project.contractorCompany ?? "N/A"],
          ["Contractor Contact", project.contractorContact ?? "N/A"],
          ["Contractor Phone", project.contractorPhone ?? "N/A"],
          ["Contractor Email", project.contractorEmail ?? "N/A"],
        ],
      },
    },
    trade_summary: {
      key: "trade_summary",
      title: CSEP_BUILDER_BLOCK_TITLES.trade_summary,
      body: appendInlineOsha(
        combineParagraphs(
          [
            tradeSummaryInput,
            params.narrativeSections.tradeBreakdownSummary,
          ],
          "Trade summary details were not entered for this contractor scope."
        ),
        params.inlineOshaRefs
      ),
      table: {
        columns: ["Trade", "Sub-trade", "Tasks", "Hazards", "Permits"],
        rows: params.operations.length
          ? params.operations.map((operation) => [
              operation.tradeLabel ?? operation.tradeCode ?? "N/A",
              operation.subTradeLabel ?? operation.subTradeCode ?? "N/A",
              operation.taskTitle,
              sentenceList(operation.hazardCategories),
              sentenceList(operation.permitTriggers, "None"),
            ])
          : [[
              scope.trades[0] ?? "N/A",
              scope.subTrades[0] ?? "N/A",
              sentenceList(scope.tasks, "N/A"),
              sentenceList(params.ruleSummary.hazardCategories),
              sentenceList(params.ruleSummary.permitTriggers, "None"),
            ]],
      },
    },
    scope_of_work: {
      key: "scope_of_work",
      title: CSEP_BUILDER_BLOCK_TITLES.scope_of_work,
      body: appendInlineOsha(
        combineParagraphs(
          [
            scopeOfWorkInput,
            !scopeOfWorkInput && scope.tasks.length
              ? `Planned work includes ${scope.tasks.join(", ")}.`
              : null,
          ],
          "Scope of work details were not entered in the current builder payload."
        ),
        params.inlineOshaRefs
      ),
      bullets: scope.tasks.length ? scope.tasks : undefined,
    },
    site_specific_notes: {
      key: "site_specific_notes",
      title: CSEP_BUILDER_BLOCK_TITLES.site_specific_notes,
      body: appendInlineOsha(
        combineParagraphs(
          [
            siteNotesInput,
            params.conflictMatrix.items.length
              ? `Simultaneous operations require coordination across ${params.conflictMatrix.items.length} identified conflict point(s).`
              : null,
          ],
          "No additional site-specific notes were supplied."
        ),
        params.inlineOshaRefs
      ),
      bullets: params.ruleSummary.siteRestrictions.length
        ? params.ruleSummary.siteRestrictions
        : undefined,
    },
    emergency_procedures: {
      key: "emergency_procedures",
      title: CSEP_BUILDER_BLOCK_TITLES.emergency_procedures,
      body: appendInlineOsha(
        combineParagraphs(
          [
            emergencyInput,
            project.projectAddress ? `Emergency response location: ${project.projectAddress}.` : null,
          ],
          "Emergency procedures were not entered in the current builder payload."
        ),
        params.inlineOshaRefs
      ),
    },
    required_ppe: hasRequiredPpeSectionContent
      ? {
          key: "required_ppe",
          title: CSEP_BUILDER_BLOCK_TITLES.required_ppe,
          body: appendInlineOsha(
            params.narrativeSections.requiredControlsSummary,
            params.inlineOshaRefs
          ),
          bullets: ppeInput.length ? ppeInput : params.ruleSummary.ppeRequirements,
        }
      : undefined,
    additional_permits: hasPermitSectionContent
      ? {
          key: "additional_permits",
          title: CSEP_BUILDER_BLOCK_TITLES.additional_permits,
          body: appendInlineOsha(
            "The following permit requirements were selected or derived for this CSEP scope.",
            params.inlineOshaRefs
          ),
          bullets: permitInput.length ? permitInput : undefined,
          table: {
            columns: ["Trade / Subtrade", "Areas", "Tasks", "Permits", "Site Restrictions"],
            rows: groupedTradePackages.length
              ? groupedTradePackages.map((pkg) => [
                  pkg.label,
                  sentenceList(pkg.locationLabels, "N/A"),
                  sentenceList(pkg.taskTitles, "N/A"),
                  sentenceList(pkg.permitTriggers, "None"),
                  sentenceList(pkg.siteRestrictions, "None"),
                ])
              : [[
                  sentenceList(scope.trades, "N/A"),
                  sentenceList(
                    [scope.location ?? params.generationContext.siteContext.location ?? "N/A"],
                    "N/A"
                  ),
                  sentenceList(scope.tasks, "N/A"),
                  sentenceList(params.ruleSummary.permitTriggers, "None"),
                  sentenceList(params.ruleSummary.siteRestrictions, "None"),
                ]],
          },
        }
      : undefined,
    common_overlapping_trades: hasOverlapSectionContent
      ? {
          key: "common_overlapping_trades",
          title: CSEP_BUILDER_BLOCK_TITLES.common_overlapping_trades,
          body: appendInlineOsha(
            params.conflictMatrix.items.length
              ? `The conflict engine identified ${params.conflictMatrix.items.length} simultaneous-operation issue(s) that should be coordinated before work starts.`
              : undefined,
            params.inlineOshaRefs
          ),
          bullets: overlapInput.length
            ? overlapInput
            : params.generationContext.siteContext.simultaneousOperations.length
              ? params.generationContext.siteContext.simultaneousOperations
              : undefined,
          table: params.conflictMatrix.items.length
            ? {
                columns: ["Severity", "Type", "Scope", "Required Mitigations"],
                rows: params.conflictMatrix.items.map((item) => [
                  item.severity,
                  item.type.replace(/_/g, " "),
                  item.sourceScope.replace(/_/g, " "),
                  sentenceList(item.requiredMitigations),
                ]),
              }
            : null,
        }
      : undefined,
    osha_references: hasOshaSectionContent
      ? {
          key: "osha_references",
          title: CSEP_BUILDER_BLOCK_TITLES.osha_references,
          body: "The following OSHA references were identified from the selected trade scope, builder inputs, and generated program content.",
          bullets: oshaInput.length ? oshaInput : params.oshaReferences,
        }
      : undefined,
    selected_hazards: hasSelectedHazardsSectionContent
      ? {
          key: "selected_hazards",
          title: CSEP_BUILDER_BLOCK_TITLES.selected_hazards,
          body: appendInlineOsha(
            params.narrativeSections.riskPrioritySummary,
            params.inlineOshaRefs
          ),
          subsections: groupedTradePackages.length
            ? buildGroupedHazardSubsections(groupedTradePackages)
            : undefined,
          bullets: groupedTradePackages.length
            ? undefined
            : hazardInput.length
              ? hazardInput
              : params.ruleSummary.hazardCategories.length
                ? params.ruleSummary.hazardCategories
                : params.operations.flatMap((operation) => operation.hazardCategories),
        }
      : undefined,
    activity_hazard_matrix: {
      key: "activity_hazard_matrix",
      title: CSEP_BUILDER_BLOCK_TITLES.activity_hazard_matrix,
      table: {
        columns: ["Trade / Subtrade", "Areas", "Tasks", "Hazards", "Controls", "PPE"],
        rows: groupedTradePackages.length
          ? groupedTradePackages.map((pkg) => [
              pkg.label,
              sentenceList(pkg.locationLabels, "N/A"),
              sentenceList(pkg.taskTitles, "N/A"),
              sentenceList(pkg.hazardCategories),
              sentenceList(pkg.requiredControls),
              sentenceList(pkg.ppeRequirements),
            ])
          : [[
              sentenceList(scope.trades, "N/A"),
              sentenceList([scope.location ?? params.generationContext.siteContext.location ?? "N/A"], "N/A"),
              sentenceList(scope.tasks, "N/A"),
              sentenceList(params.ruleSummary.hazardCategories),
              sentenceList(params.ruleSummary.requiredControls),
              sentenceList(params.ruleSummary.ppeRequirements),
            ]],
      },
    },
  };

  const derivedFormatSections: GeneratedSafetyPlanSection[] = [];

  if (selectedFormatSections.has("roles_and_responsibilities")) {
    derivedFormatSections.push({
      key: "roles_and_responsibilities",
      title: "Roles and Responsibilities",
      body: combineParagraphs(
        [
          rolesInput,
          project.contractorCompany
            ? `${project.contractorCompany} must assign accountable supervision and a competent person for the selected work scope before work starts.`
            : null,
        ],
        "Accountable supervision, competent-person oversight, and worker stop-work authority apply to the active contractor scope."
      ),
      table: {
        columns: ["Role", "Minimum Responsibilities", "Authority / Hold Point"],
        rows: [
          [
            project.contractorContact ? `${project.contractorContact} / Superintendent` : "Superintendent",
            "Own implementation of this CSEP, staffing, sequencing, permit readiness, and coordination with the GC/CM and affected trades.",
            "Authorize work start, stop work when controls fail, and approve restart after corrective action.",
          ],
          [
            "Competent Person",
            "Inspect the work area, verify required controls, monitor changing conditions, and correct hazards before and during work.",
            "Hold work when access, protection, rescue, or permit conditions are incomplete.",
          ],
          [
            "Foreman / Crew Lead",
            "Run pre-task planning, verify crew understanding, maintain housekeeping, and confirm inspections and permits are in place.",
            "Do not release the crew to start until controls, PPE, and authorizations are verified.",
          ],
          [
            "Workers",
            "Follow the CSEP, participate in pre-task planning, inspect assigned tools/PPE, and report hazards, incidents, and changing conditions immediately.",
            "Exercise stop-work authority when conditions are unsafe or instructions conflict with field conditions.",
          ],
        ],
      },
    });
  }

  if (selectedFormatSections.has("security_and_access_control")) {
    derivedFormatSections.push({
      key: "security_and_access_control",
      title: "Security and Access Control",
      body: combineParagraphs(
        [securityInput],
        "Access to active work areas is restricted to authorized personnel who have completed required orientation, badging, and task-specific review."
      ),
      table: {
        columns: ["Access Topic", "Minimum Requirement", "Responsible Party"],
        rows: [
          ["Worker access", "Verify orientation, badging, and daily work assignment before entry.", "Superintendent / Foreman"],
          ["Visitors and deliveries", "Escort non-crew personnel and control delivery routes, staging, and unloading areas.", "Foreman / Receiving Lead"],
          ["Restricted areas", "Barricade, sign, and control permit-required or high-hazard areas.", "Competent Person"],
          ["End-of-shift security", "Secure tools, materials, permits, and access points before turnover.", "Crew Lead"],
        ],
      },
    });
  }

  if (selectedFormatSections.has("contractor_iipp")) {
    derivedFormatSections.push({
      key: "contractor_iipp",
      title: "Contractor Injury & Illness Prevention Program",
      body: combineParagraphs(
        [
          healthInput,
          incidentInput,
          drugAlcoholInput,
          enforcementInput,
        ],
        "The contractor shall maintain an active injury and illness prevention workflow covering fit-for-duty expectations, incident response, testing where required, corrective action, and worker accountability."
      ),
      subsections: [
        {
          title: "Health and Wellness Expectations",
          body: healthInput ?? "Maintain fit-for-duty expectations, sanitation, hydration, first-aid access, and prompt reporting of symptoms, exposures, and restricted-work concerns.",
          bullets: splitBuilderTextToBullets(healthInput).length
            ? splitBuilderTextToBullets(healthInput)
            : [
                "Confirm workers are fit for duty before starting work.",
                "Provide access to water, sanitation, and recovery measures appropriate to conditions.",
                "Report symptoms, exposures, and medical restrictions immediately.",
              ],
        },
        {
          title: "Incident Reporting and Investigation",
          body: incidentInput ?? "All incidents, near misses, injuries, property damage, environmental releases, and permit breaches must be reported immediately and investigated to closure.",
          bullets: splitBuilderTextToBullets(incidentInput).length
            ? splitBuilderTextToBullets(incidentInput)
            : [
                "Stop work, stabilize the scene, and notify supervision immediately.",
                "Preserve evidence, collect statements, and document contributing factors.",
                "Track corrective actions to completion before restart where required.",
              ],
        },
        {
          title: "Drug, Alcohol, and Fit-for-Duty Controls",
          body: drugAlcoholInput ?? "Workers must report fit-for-duty concerns and comply with owner, GC/CM, employer, and post-incident testing requirements where applicable.",
          bullets: splitBuilderTextToBullets(drugAlcoholInput).length
            ? splitBuilderTextToBullets(drugAlcoholInput)
            : [
                "Do not report to work impaired or unfit for duty.",
                "Follow site and employer testing triggers, including post-incident requirements where applicable.",
                "Remove workers from the task when impairment or unsafe behavior is suspected.",
              ],
        },
        {
          title: "Enforcement and Corrective Action",
          body: enforcementInput ?? "Noncompliance with plan requirements requires immediate correction, supervisory intervention, and documented follow-up proportional to the risk.",
          bullets: splitBuilderTextToBullets(enforcementInput).length
            ? splitBuilderTextToBullets(enforcementInput)
            : [
                "Correct unsafe conditions immediately when feasible.",
                "Escalate repeated or high-risk violations to supervision and safety leadership.",
                "Document corrective actions, retraining, and restart conditions.",
              ],
        },
      ],
    });
  }

  if (selectedFormatSections.has("weather_requirements_and_severe_weather_response")) {
    derivedFormatSections.push({
      key: "weather_requirements_and_severe_weather_response",
      title: "Weather Requirements and Severe Weather Response",
      body: combineParagraphs(
        [
          params.generationContext.siteContext.weather?.summary ?? null,
          params.ruleSummary.weatherRestrictions.length
            ? `Weather-sensitive restrictions in force: ${params.ruleSummary.weatherRestrictions
                .map(humanizeCode)
                .join(", ")}.`
            : null,
        ],
        "Monitor forecast changes, communicate trigger thresholds, and stop or modify work when weather conditions defeat the planned controls."
      ),
      subsections: [
        {
          title: "Monitoring and Communication",
          body: prefixedInstructionBullets(weatherInput, "Monitoring source:").length
            ? null
            : "Use designated forecast sources, communicate trigger changes before work starts, and brief crews when conditions change.",
          bullets:
            prefixedInstructionBullets(weatherInput, "Monitoring source:").length ||
            prefixedInstructionBullets(weatherInput, "Communication method:").length
              ? [
                  ...prefixedInstructionBullets(weatherInput, "Monitoring source:").map(
                    (item) => `Monitoring source: ${item}`
                  ),
                  ...prefixedInstructionBullets(weatherInput, "Communication method:").map(
                    (item) => `Communication method: ${item}`
                  ),
                ]
              : [
                  "Review forecast and site conditions before shift start and as conditions change.",
                  "Communicate stop-work and restart decisions through supervision and field leads.",
                ],
        },
        {
          title: "Stop-Work Triggers and Protective Actions",
          body: null,
          bullets:
            weatherInput.length > 0
              ? weatherInput
              : [
                  "Suspend exposed work when wind, lightning, storm, heat, or cold conditions defeat planned controls.",
                  "Move crews to approved shelter or protected areas when severe-weather triggers are met.",
                ],
        },
      ],
    });
  }

  if (selectedFormatSections.has("environmental_execution_requirements")) {
    derivedFormatSections.push({
      key: "environmental_execution_requirements",
      title: "Environmental Execution Requirements",
      body: combineParagraphs(
        [
          siteNotesInput,
          prefixedInstructionBullets(weatherInput, "Environmental control:").length
            ? `Environmental controls include ${prefixedInstructionBullets(
                weatherInput,
                "Environmental control:"
              ).join(", ")}.`
            : null,
        ],
        "Maintain housekeeping, protect drains and adjacent property, and control waste, spills, dust, and other environmental impacts during execution."
      ),
      table: {
        columns: ["Environmental Topic", "Minimum Control", "Responsible Party"],
        rows: [
          ["Housekeeping and waste", "Keep work areas orderly, contain debris, and dispose of waste in designated containers.", "Foreman / Crew"],
          ["Stormwater / drain protection", "Protect drains, inlets, and exposed surfaces from debris or releases.", "Competent Person / Crew Lead"],
          ["Spill and chemical control", "Store materials properly, maintain spill-response materials, and report releases immediately.", "Superintendent / Material Handler"],
          ["Dust / noise / nuisance control", "Use project-required suppression and timing controls to limit impacts to adjacent operations.", "Foreman / Superintendent"],
        ],
      },
    });
  }

  if (selectedFormatSections.has("contractor_monitoring_audits_and_reporting")) {
    derivedFormatSections.push({
      key: "contractor_monitoring_audits_and_reporting",
      title: "Contractor Monitoring, Audits & Reporting",
      body: combineParagraphs(
        [recordkeepingInput],
        "The contractor shall monitor field execution, document inspections and corrective actions, and maintain reporting records that demonstrate ongoing compliance."
      ),
      table: {
        columns: ["Monitoring Activity", "Minimum Frequency", "Responsible Party", "Required Record"],
        rows: [
          ["Pre-task plan / JHA review", "Each shift and when the task changes", "Foreman / Crew Lead", "Daily pre-task record"],
          ["Field safety inspection", "Daily or as triggered by conditions", "Competent Person / Superintendent", "Inspection log"],
          ["Permit status review", "Before start and when conditions change", "Superintendent / Permit Holder", "Permit register"],
          ["Corrective action tracking", "Until closed", "Supervisor / Safety Lead", "Corrective action log"],
          ["Incident and trend reporting", "Immediately and during weekly review", "Superintendent / Safety Lead", "Incident report and follow-up notes"],
        ],
      },
    });
  }

  if (selectedFormatSections.has("contractor_safety_meetings_and_engagement")) {
    derivedFormatSections.push({
      key: "contractor_safety_meetings_and_engagement",
      title: "Contractor Safety Meetings and Engagement",
      body: combineParagraphs(
        [trainingInput],
        "Daily field communication, toolbox meetings, coordination huddles, and worker engagement are required to keep the CSEP active and current."
      ),
      table: {
        columns: ["Meeting / Engagement Activity", "Minimum Cadence", "Led By", "Required Output"],
        rows: [
          ["Pre-task planning / JHA", "Each shift and before new work phases", "Foreman / Crew Lead", "Task plan, hazards, controls, permits, and PPE reviewed with the crew"],
          ["Toolbox / safety meeting", "Weekly or as required by site policy", "Superintendent / Safety Lead", "Attendance and topic record"],
          ["Coordination meeting", "Before overlapping or high-risk work", "Superintendent / GC/CM Interface", "Interface controls, sequencing, and hold points confirmed"],
          ["Stand-down / re-brief", "After incidents, near misses, or major plan changes", "Leadership / Supervision", "Restart conditions and revised controls documented"],
        ],
      },
      subsections:
        params.trainingProgram.summaryTrainingTitles.length > 0
          ? [
              {
                title: "Training Focus for the Active Scope",
                body: null,
                bullets: params.trainingProgram.summaryTrainingTitles.map(
                  (item: string) => `Required training / competency: ${item}`
                ),
              },
            ]
          : undefined,
    });
  }

  if (selectedFormatSections.has("sub_tier_contractor_management")) {
    const overlapRows = dedupe([
      ...overlapInput,
      ...params.generationContext.siteContext.simultaneousOperations,
    ]);
    derivedFormatSections.push({
      key: "sub_tier_contractor_management",
      title: "Sub-Tier Contractor Management",
      body: combineParagraphs(
        [
          overlapInput.length
            ? `Trade interfaces requiring coordination include ${overlapInput.join(", ")}.`
            : null,
          rolesInput,
        ],
        "Lower-tier crews and overlapping trades must be onboarded, briefed on interfaces, and monitored so their work does not break the controls in this CSEP."
      ),
      table: {
        columns: ["Oversight Topic", "Minimum Requirement", "Responsible Party"],
        rows: overlapRows.length
          ? overlapRows.map((item) => [
              item,
              "Review interfaces, sequencing, shared permits, barricades, and stop-work triggers before work starts.",
              "Superintendent / Foreman",
            ])
          : [
              ["Onboarding", "Verify orientation, scope review, permits, training, and emergency expectations before work starts.", "Superintendent"],
              ["Interface control", "Coordinate shared areas, sequencing, and work-zone ownership with adjacent trades.", "Superintendent / Foreman"],
              ["Documentation turnover", "Maintain current permits, JHAs, inspections, and corrective actions for lower-tier crews.", "Foreman / Safety Lead"],
            ],
      },
    });
  }

  if (selectedFormatSections.has("project_close_out")) {
    derivedFormatSections.push({
      key: "project_close_out",
      title: "Project Close-Out",
      body: combineParagraphs(
        [continuousImprovementInput],
        "Before demobilization, the contractor shall close open actions, complete turnover items, capture lessons learned, and verify that no temporary controls or permits remain unresolved."
      ),
      table: {
        columns: ["Close-Out Item", "Minimum Requirement", "Responsible Party"],
        rows: [
          ["Open corrective actions", "Verify all required actions are closed or transferred with documented ownership.", "Superintendent / Safety Lead"],
          ["Permit and form closeout", "Close permits, archive required forms, and remove expired postings.", "Permit Holder / Foreman"],
          ["Environmental and housekeeping turnover", "Remove waste, temporary protections, and outstanding environmental controls as required.", "Foreman / Crew Lead"],
          ["Lessons learned", "Capture scope-specific issues, improvements, and retraining opportunities before final turnover.", "Leadership / Supervision"],
        ],
      },
    });
  }

  if (selectedFormatSections.has("checklists_and_inspections")) {
    derivedFormatSections.push({
      key: "checklists_and_inspections",
      title: "Checklists and Inspections",
      body:
        "Inspection and checklist tools shall be used at the listed frequencies to confirm conditions stay aligned with this CSEP.",
      table: {
        columns: ["Checklist / Inspection", "Minimum Frequency", "Responsible Party", "Record / Trigger"],
        rows: [
          ["Pre-task plan / JHA", "Each shift and before task changes", "Foreman / Crew", "Required before starting new or changed work"],
          ["PPE and tool inspection", "Prior to use", "Each user / Operator", "Remove damaged gear or equipment from service"],
          ["Permit-required work verification", "Before start and when conditions change", "Permit Holder / Competent Person", "Confirm permit conditions remain valid"],
          ["Area housekeeping and barricade inspection", "Daily", "Foreman / Competent Person", "Correct before turnover or restart"],
          ["Program / high-risk work inspection", "Weekly or per program trigger", "Superintendent / Safety Lead", "Track findings to corrective action closure"],
        ],
      },
    });
  }

  if (selectedFormatSections.has("regulatory_framework") && !(oshaInput.length || params.oshaReferences.length)) {
    derivedFormatSections.push({
      key: "regulatory_framework",
      title: "Regulatory Framework",
      body:
        "This CSEP shall be executed in alignment with the governing OSHA jurisdiction, owner requirements, project rules, and any labor or local conditions applicable to the selected scope.",
      table: {
        columns: ["Requirement Source", "Application to This CSEP"],
        rows: [
          [
            params.generationContext.documentProfile.jurisdictionLabel ?? "Governing OSHA jurisdiction",
            "Use the governing jurisdiction as the baseline compliance framework for the active work scope.",
          ],
          ["Owner / client requirements", "Apply project-specific safety, security, permit, and reporting requirements in addition to OSHA minimums."],
          ["GC / CM coordination rules", "Follow project logistics, sequencing, access, and interface requirements that affect field execution."],
        ],
      },
    });
  }

  const selectedSections = selectedSectionOrder
    .filter((key) => hasSelectedCsepBlock(instructions, key))
    .map((key) => sectionsByKey[key])
    .filter((section): section is GeneratedSafetyPlanSection => Boolean(section));

  if (selectedSections.length > 0) {
    return [
      ...selectedSections,
      ...derivedFormatSections,
      taskModulesSection,
      hazardModulesSection,
      steelTaskModulesSection,
      steelHazardModulesSection,
      steelProgramModulesSection,
    ].filter((section): section is GeneratedSafetyPlanSection => Boolean(section));
  }

  return [
    sectionsByKey.scope_of_work,
    sectionsByKey.selected_hazards,
    sectionsByKey.activity_hazard_matrix,
    ...derivedFormatSections,
    taskModulesSection,
    hazardModulesSection,
    steelTaskModulesSection,
    steelHazardModulesSection,
    steelProgramModulesSection,
  ].filter((section): section is GeneratedSafetyPlanSection => Boolean(section));
}

export function buildGeneratedSafetyPlanDraft(params: DraftParams): GeneratedSafetyPlanDraft {
  const fallbackNarratives = buildFallbackNarratives(params);
  const narrativeSections = {
    ...fallbackNarratives,
    ...(params.narrativeSections ?? {}),
  };
  const projectName = params.generationContext.project.projectName || "Project";
  const operations = params.generationContext.operations.map((operation) => {
    const bucket = params.reviewContext.buckets.find(
      (row) => row.operationId === operation.operationId
    );
    const rules = params.reviewContext.rulesEvaluations.find(
      (row) =>
        row.operationId === operation.operationId ||
        row.bucketKey === bucket?.bucketKey
    );
    const conflicts = params.conflictMatrix.items.filter((item) =>
      item.operationIds.includes(operation.operationId)
    );

    return {
      operationId: operation.operationId,
      tradeCode: operation.tradeCode ?? null,
      tradeLabel: operation.tradeLabel ?? operation.tradeCode ?? null,
      subTradeCode: operation.subTradeCode ?? null,
      subTradeLabel: operation.subTradeLabel ?? operation.subTradeCode ?? null,
      taskTitle: operation.taskTitle,
      workAreaLabel: operation.workAreaLabel ?? null,
      locationGrid: operation.locationGrid ?? null,
      equipmentUsed: dedupe(bucket?.equipmentUsed ?? operation.equipmentUsed),
      workConditions: dedupe(bucket?.workConditions ?? operation.workConditions),
      hazardCategories: dedupe(rules?.hazardCategories ?? []),
      permitTriggers: dedupe((rules?.permitTriggers ?? []).filter((item) => item !== "none")),
      ppeRequirements: dedupe(rules?.ppeRequirements ?? []),
      requiredControls: dedupe(rules?.requiredControls ?? []),
      siteRestrictions: dedupe(rules?.siteRestrictions ?? []),
      prohibitedEquipment: dedupe(rules?.prohibitedEquipment ?? []),
      conflicts: dedupe(conflicts.map((item) => item.rationale)),
    };
  });
  const groupedTradePackages = groupOperationsByTradePackage(operations);

  const ruleSummary = {
    permitTriggers: dedupe(
      params.reviewContext.rulesEvaluations.flatMap((row) =>
        row.permitTriggers.filter((item) => item !== "none")
      )
    ),
    ppeRequirements: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.ppeRequirements)),
    requiredControls: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.requiredControls)),
    hazardCategories: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.hazardCategories)),
    siteRestrictions: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.siteRestrictions)),
    prohibitedEquipment: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.prohibitedEquipment)),
    trainingRequirements: dedupe([
      ...params.reviewContext.rulesEvaluations.flatMap((row) => row.trainingRequirements),
      ...(params.trainingProgram?.summaryTrainingTitles ?? []),
    ]),
    weatherRestrictions: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.weatherRestrictions)),
  };
  const trainingProgram = params.trainingProgram ?? {
    rows: [],
    summaryTrainingTitles: ruleSummary.trainingRequirements,
  };

  const highestSeverity = params.conflictMatrix.items.reduce<GeneratedSafetyPlanDraft["conflictSummary"]["highestSeverity"]>(
    (current, item) => {
      const ranking = ["none", "low", "medium", "high", "critical"];
      return ranking.indexOf(item.severity) > ranking.indexOf(current) ? item.severity : current;
    },
    "none"
  );

  const riskScore =
    params.reviewContext.rulesEvaluations.reduce((sum, row) => sum + row.score, 0) +
    params.conflictMatrix.score;
  const riskSummary = {
    score: riskScore,
    band: bandFromScore(riskScore),
    priorities: dedupe([
      ...params.conflictMatrix.items
        .filter((item) => item.severity === "critical" || item.severity === "high")
        .map((item) => item.rationale),
      ...ruleSummary.siteRestrictions,
      ...ruleSummary.prohibitedEquipment.map((item) => `${item.replace(/_/g, " ")} prohibited`),
    ]).slice(0, 8),
  };

  const isPshsep = params.generationContext.documentProfile.documentType === "pshsep";
  const programSections: GeneratedSafetyPlanSection[] = buildCsepProgramSections(
    params.generationContext.programSelections ?? [],
    {
      definitions: params.programDefinitions,
    }
  ).map((section) => ({
    key: section.key,
    title: section.title,
    summary: section.summary,
    subsections: section.subsections.map((subsection) => ({
      title: subsection.title,
      body: subsection.body,
      bullets: subsection.bullets,
    })),
  }));
  const oshaReferences = collectOshaReferences(
    params.generationContext,
    programSections,
    narrativeSections
  );
  const inlineOshaRefs = oshaReferences.slice(0, 4);
  const pshsepCoreSections = isPshsep
    ? buildPshsepCoreSections(params.generationContext, inlineOshaRefs, ruleSummary)
    : [];
  const pshsepHighRiskSections = isPshsep
    ? buildPshsepHighRiskSections(params.generationContext, inlineOshaRefs)
    : [];

  const definitionsSection = buildDefinitionsSection(
    params.generationContext,
    inlineOshaRefs
  );
  const referencesSection = buildReferencesSection(oshaReferences);
  const tradeConflictCoordinationSection = buildTradeConflictCoordinationSection(
    params.generationContext,
    inlineOshaRefs
  );
  const sharedSections: GeneratedSafetyPlanSection[] = [
    {
      key: "project_overview",
      title: "Project Overview",
      body: appendInlineOsha(
        `Project ${projectName} covers ${sentenceList(params.generationContext.scope.trades, "defined trades")} at ${paragraph(
          params.generationContext.project.projectAddress,
          "the specified location"
        )}.`,
        inlineOshaRefs
      ),
      table: {
        columns: ["Field", "Value"],
        rows: [
          ["Project Name", projectName],
          ["Project Number", params.generationContext.project.projectNumber ?? "N/A"],
          ["Location", params.generationContext.project.projectAddress ?? "N/A"],
          ["Owner / Client", params.generationContext.project.ownerClient ?? "N/A"],
          ["GC / CM", params.generationContext.project.gcCm ?? "N/A"],
          ["Contractor", params.generationContext.project.contractorCompany ?? "N/A"],
        ],
      },
    },
    {
      key: "trade_risk_breakdown",
      title: "Trade-Based Risk Breakdown",
      body: appendInlineOsha(narrativeSections.tradeBreakdownSummary, inlineOshaRefs),
      table: {
        columns: ["Trade / Subtrade", "Areas", "Tasks", "Hazards", "Permits"],
        rows: groupedTradePackages.length
          ? groupedTradePackages.map((pkg) => [
              pkg.label,
              sentenceList(pkg.locationLabels, "N/A"),
              sentenceList(pkg.taskTitles, "N/A"),
              sentenceList(pkg.hazardCategories),
              sentenceList(pkg.permitTriggers, "None"),
            ])
          : [[
              sentenceList(params.generationContext.scope.trades, "N/A"),
              sentenceList(
                [params.generationContext.scope.location ?? params.generationContext.siteContext.location ?? "N/A"],
                "N/A"
              ),
              sentenceList(params.generationContext.scope.tasks, "N/A"),
              sentenceList(ruleSummary.hazardCategories),
              sentenceList(ruleSummary.permitTriggers, "None"),
            ]],
      },
    },
    {
      key: "task_hazard_analysis",
      title: "Task-Level Hazard Analysis",
      table: {
        columns: ["Trade / Subtrade", "Areas", "Tasks", "Hazards", "Controls", "PPE"],
        rows: groupedTradePackages.length
          ? groupedTradePackages.map((pkg) => [
              pkg.label,
              sentenceList(pkg.locationLabels, "N/A"),
              sentenceList(pkg.taskTitles, "N/A"),
              sentenceList(pkg.hazardCategories),
              sentenceList(pkg.requiredControls),
              sentenceList(pkg.ppeRequirements),
            ])
          : [[
              sentenceList(params.generationContext.scope.trades, "N/A"),
              sentenceList(
                [params.generationContext.scope.location ?? params.generationContext.siteContext.location ?? "N/A"],
                "N/A"
              ),
              sentenceList(params.generationContext.scope.tasks, "N/A"),
              sentenceList(ruleSummary.hazardCategories),
              sentenceList(ruleSummary.requiredControls),
              sentenceList(ruleSummary.ppeRequirements),
            ]],
      },
    },
    {
      key: "permit_matrix",
      title: "Permit Matrix",
      table: {
        columns: ["Trade / Subtrade", "Areas", "Tasks", "Permits", "Site Restrictions"],
        rows: groupedTradePackages.length
          ? groupedTradePackages.map((pkg) => [
              pkg.label,
              sentenceList(pkg.locationLabels, "N/A"),
              sentenceList(pkg.taskTitles, "N/A"),
              sentenceList(pkg.permitTriggers, "None"),
              sentenceList(pkg.siteRestrictions, "None"),
            ])
          : [[
              sentenceList(params.generationContext.scope.trades, "N/A"),
              sentenceList(
                [params.generationContext.scope.location ?? params.generationContext.siteContext.location ?? "N/A"],
                "N/A"
              ),
              sentenceList(params.generationContext.scope.tasks, "N/A"),
              sentenceList(ruleSummary.permitTriggers, "None"),
              sentenceList(ruleSummary.siteRestrictions, "None"),
            ]],
      },
    },
    buildTrainingProgramSection(trainingProgram),
    {
      key: "simultaneous_operations",
      title: "Simultaneous Operations & Trade Interaction Risks",
      body: appendInlineOsha(
        params.conflictMatrix.items.length
          ? `The conflict engine identified ${params.conflictMatrix.items.length} trade-interaction risk(s) that must be coordinated before work starts.`
          : "No simultaneous-operation conflicts were identified in the current planning set.",
        inlineOshaRefs
      ),
      table: {
        columns: ["Severity", "Type", "Scope", "Required Mitigations"],
        rows: params.conflictMatrix.items.length
          ? params.conflictMatrix.items.map((item) => [
              item.severity,
              item.type.replace(/_/g, " "),
              item.sourceScope.replace(/_/g, " "),
              sentenceList(item.requiredMitigations),
            ])
          : [["none", "none", "none", "No simultaneous-operation conflicts identified."]],
      },
    },
    tradeConflictCoordinationSection,
    {
      key: "equipment_conditions",
      title: "Equipment & Work Condition Risks",
      subsections: groupedTradePackages.map((pkg) => {
        const equipment = pkg.equipmentUsed.length
          ? `Equipment: ${pkg.equipmentUsed.join(", ")}.`
          : "Equipment: not specified.";
        const conditions = pkg.workConditions.length
          ? `Conditions: ${pkg.workConditions.join(", ")}.`
          : "Conditions: no additional work conditions listed.";
        return {
          title: pkg.label,
          body: pkg.locationLabels.length
            ? `Primary work areas: ${sentenceList(pkg.locationLabels, "N/A")}.`
            : null,
          bullets: [
            `Tasks: ${sentenceList(pkg.taskTitles, "N/A")}.`,
            equipment,
            conditions,
          ],
        };
      }),
    },
    {
      key: "weather_integration",
      title: "Weather Risk Integration",
      body: appendInlineOsha(
        params.generationContext.siteContext.weather?.summary
          ? params.generationContext.siteContext.weather.summary
          : paragraph(
              ruleSummary.weatherRestrictions.length
                ? `Weather-sensitive restrictions apply: ${ruleSummary.weatherRestrictions.join(", ")}.`
                : null,
              "No project-specific weather restriction has been recorded in the current planning set."
            ),
        inlineOshaRefs
      ),
      bullets: ruleSummary.weatherRestrictions,
    },
    {
      key: "required_controls",
      title: "Required Controls & Mitigation Measures",
      body: appendInlineOsha(narrativeSections.requiredControlsSummary, inlineOshaRefs),
      table: {
        columns: ["Control Type", "Requirements"],
        rows: [
          ["Required Controls", sentenceList(ruleSummary.requiredControls)],
          ["PPE", sentenceList(ruleSummary.ppeRequirements)],
          ["Training", sentenceList(ruleSummary.trainingRequirements)],
          ["Prohibited Equipment", sentenceList(ruleSummary.prohibitedEquipment, "None")],
        ],
      },
    },
    {
      key: "risk_priority_summary",
      title: "Risk Priority Summary",
      body: appendInlineOsha(narrativeSections.riskPrioritySummary, inlineOshaRefs),
      bullets: riskSummary.priorities.length ? riskSummary.priorities : ["No elevated priorities were identified."],
    },
    {
      key: "safety_narrative",
      title: "Safety Narrative",
      body: appendInlineOsha(narrativeSections.safetyNarrative, inlineOshaRefs),
    },
  ];
  const [
    projectOverviewSection,
    tradeRiskBreakdownSection,
    taskHazardAnalysisSection,
    permitMatrixSection,
    trainingProgramSection,
    simultaneousOperationsSection,
    tradeConflictFrameworkSection,
    equipmentConditionsSection,
    weatherIntegrationSection,
    requiredControlsSection,
    riskPrioritySummarySection,
    safetyNarrativeSection,
  ] = sharedSections;
  const csepSelectedSections = buildCsepSelectedSections({
    generationContext: params.generationContext,
    operations,
    ruleSummary,
    conflictMatrix: params.conflictMatrix,
    trainingProgram,
    narrativeSections,
    oshaReferences,
    inlineOshaRefs,
  });
  const steelTaskModulesSection = buildSteelTaskModulesReferenceSection(
    params.generationContext,
    inlineOshaRefs
  );
  const steelHazardModulesSection = buildSteelHazardModulesReferenceSection(
    params.generationContext,
    inlineOshaRefs
  );
  const steelProgramModulesSection = buildSteelProgramModulesReferenceSection(
    params.generationContext,
    inlineOshaRefs
  );
  const unorderedSections: GeneratedSafetyPlanSection[] = isPshsep
    ? [
        definitionsSection,
        referencesSection,
        projectOverviewSection,
        ...pshsepCoreSections,
        tradeRiskBreakdownSection,
        taskHazardAnalysisSection,
        permitMatrixSection,
        trainingProgramSection,
        simultaneousOperationsSection,
        tradeConflictFrameworkSection,
        equipmentConditionsSection,
        ...pshsepHighRiskSections,
        ...(steelTaskModulesSection ? [steelTaskModulesSection] : []),
        ...(steelHazardModulesSection ? [steelHazardModulesSection] : []),
        ...(steelProgramModulesSection ? [steelProgramModulesSection] : []),
        ...programSections,
        ...buildPshsepAdminSections(params.generationContext, inlineOshaRefs),
        weatherIntegrationSection,
        requiredControlsSection,
        riskPrioritySummarySection,
        safetyNarrativeSection,
      ]
    : [
        definitionsSection,
        ...(!csepSelectedSections.some(
          (section) =>
            section.key === "references" ||
            section.key === "osha_references" ||
            section.key === "osha_reference_appendix"
        )
          ? [referencesSection]
          : []),
        ...csepSelectedSections,
        ...programSections,
      ];
  const jurisdictionProfile = {
    governingState: params.generationContext.documentProfile.governingState ?? null,
    jurisdictionCode: params.generationContext.documentProfile.jurisdictionCode ?? "federal",
    jurisdictionName:
      params.generationContext.documentProfile.jurisdictionCode === "federal"
        ? "Federal OSHA"
        : params.generationContext.documentProfile.jurisdictionCode?.toUpperCase() ??
          "Federal OSHA",
    jurisdictionLabel: params.generationContext.documentProfile.jurisdictionLabel ?? "Federal OSHA",
    jurisdictionPlanType:
      params.generationContext.documentProfile.jurisdictionPlanType ?? "federal_osha",
    coversPrivateSector: true,
    source: "document_override" as const,
  };
  const jurisdictionApplied = isPshsep
    ? applyJurisdictionStandardsToPeshep({
        sections: unorderedSections,
        profile: jurisdictionProfile,
        config: params.jurisdictionStandardsConfig,
      })
    : applyJurisdictionStandardsToCsep({
        sections: unorderedSections,
        selections: params.generationContext.programSelections ?? [],
        profile: jurisdictionProfile,
        config: params.jurisdictionStandardsConfig,
      });
  const referenceTaggedSections = applyOshaReferenceTokensToSections(
    jurisdictionApplied.sections,
    oshaReferences
  );
  const normalizedSections = isPshsep
    ? referenceTaggedSections
    : normalizeCsepSections(referenceTaggedSections);
  const orderedSections = orderGeneratedSections(normalizedSections);
  const sections = orderCsepReferencePacksBeforePrograms(orderedSections);

  return {
    documentType: params.generationContext.documentProfile.documentType,
    projectDeliveryType: params.generationContext.documentProfile.projectDeliveryType,
    title:
      params.generationContext.documentProfile.title ??
      `${projectName} ${params.generationContext.documentProfile.documentType.toUpperCase()}`,
    documentControl: {
      projectSite: params.generationContext.project.projectName ?? null,
      primeContractor: params.generationContext.project.contractorCompany ?? null,
      clientOwner: params.generationContext.project.ownerClient ?? null,
      documentNumber:
        typeof params.generationContext.legacyFormSnapshot.document_number === "string"
          ? params.generationContext.legacyFormSnapshot.document_number
          : null,
      revision:
        typeof params.generationContext.legacyFormSnapshot.document_revision === "string"
          ? params.generationContext.legacyFormSnapshot.document_revision
          : "1.0",
      issueDate: null,
      preparedBy:
        typeof params.generationContext.legacyFormSnapshot.prepared_by === "string"
          ? params.generationContext.legacyFormSnapshot.prepared_by
          : params.generationContext.project.contractorContact ?? null,
      reviewedBy:
        typeof params.generationContext.legacyFormSnapshot.reviewed_by === "string"
          ? params.generationContext.legacyFormSnapshot.reviewed_by
          : null,
      approvedBy:
        typeof params.generationContext.legacyFormSnapshot.approved_by === "string"
          ? params.generationContext.legacyFormSnapshot.approved_by
          : null,
    },
    aiAssemblyDecisions: params.aiAssemblyDecisions ?? null,
    projectOverview: {
      projectName,
      projectNumber: params.generationContext.project.projectNumber ?? null,
      projectAddress: params.generationContext.project.projectAddress ?? null,
      ownerClient: params.generationContext.project.ownerClient ?? null,
      gcCm: params.generationContext.project.gcCm ?? null,
      contractorCompany: params.generationContext.project.contractorCompany ?? null,
      schedule: params.generationContext.scope.schedule?.label ?? null,
      location: params.generationContext.siteContext.location ?? null,
    },
    operations,
    ruleSummary,
    conflictSummary: {
      total: params.conflictMatrix.items.length,
      intraDocument: params.conflictMatrix.intraDocumentConflictCount,
      external: params.conflictMatrix.externalConflictCount,
      highestSeverity,
      items: params.conflictMatrix.items,
    },
    riskSummary,
    trainingProgram,
    narrativeSections,
    sectionMap: sections,
    coverageAudit: null,
    builderSnapshot: params.generationContext.legacyFormSnapshot,
    provenance: {
      generator: "safety_plan_deterministic_assembler",
      documentType: params.generationContext.documentProfile.documentType,
      projectDeliveryType: params.generationContext.documentProfile.projectDeliveryType,
      projectName,
      bucketCount: params.reviewContext.buckets.length,
      rulesCount: params.reviewContext.rulesEvaluations.length,
      conflictCount: params.conflictMatrix.items.length,
      governingState: params.generationContext.documentProfile.governingState ?? null,
      jurisdictionCode: params.generationContext.documentProfile.jurisdictionCode ?? "federal",
      jurisdictionLabel: params.generationContext.documentProfile.jurisdictionLabel ?? "Federal OSHA",
      jurisdictionPlanType:
        params.generationContext.documentProfile.jurisdictionPlanType ?? "federal_osha",
      jurisdictionStandardsApplied:
        params.generationContext.documentProfile.jurisdictionStandardsApplied?.length
          ? params.generationContext.documentProfile.jurisdictionStandardsApplied
          : jurisdictionApplied.appliedStandards.map((standard) => standard.id),
      source: params.generationContext.documentProfile.source,
      builderInputHash: params.generationContext.builderInstructions?.builderInputHash ?? null,
      selectedBlockKeys: params.generationContext.builderInstructions?.selectedBlockKeys ?? [],
      riskMemorySummary: params.riskMemorySummary ?? null,
    },
  };
}
