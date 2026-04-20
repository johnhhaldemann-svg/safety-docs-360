import type { CSEPProgramSelection } from "@/types/csep-programs";
import {
  STEEL_ERECTION_PROGRAM_MODULES,
  type GeneratedSteelErectionProgramModule,
} from "@/lib/steelErectionProgramModules.generated";

export type SteelErectionProgramModule = GeneratedSteelErectionProgramModule;

export type SteelErectionProgramModuleMatch = SteelErectionProgramModule & {
  matchedReasons: string[];
};

export const STEEL_ERECTION_PROGRAM_MODULE_PACK_KEY =
  "steel_erection_program_modules_matched_subset";

function normalizeLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimPlainText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function findExactMatches(criteria: string[], selectedValues: string[], label: string) {
  const normalizedCriteria = new Set(criteria.map((value) => normalizeLabel(value)));
  return selectedValues
    .filter((value) => normalizedCriteria.has(normalizeLabel(value)))
    .map((value) => `${label}: ${value}`);
}

function findKeywordMatches(criteria: string[], haystack: string, label: string) {
  const normalizedHaystack = normalizeLabel(haystack);
  return criteria
    .filter((value) => normalizedHaystack.includes(normalizeLabel(value)))
    .map((value) => `${label}: ${value}`);
}

export function getSteelErectionProgramModules(): SteelErectionProgramModule[] {
  return STEEL_ERECTION_PROGRAM_MODULES.map((module) => ({
    ...module,
    sectionHeadings: [...module.sectionHeadings],
    triggerManifest: {
      csepSelections: module.triggerManifest.csepSelections.map((selection) => ({
        category: selection.category,
        item: selection.item,
      })),
      hazardLabels: [...module.triggerManifest.hazardLabels],
      permitLabels: [...module.triggerManifest.permitLabels],
      taskKeywords: [...module.triggerManifest.taskKeywords],
      tradeKeywords: [...module.triggerManifest.tradeKeywords],
      subTradeKeywords: [...module.triggerManifest.subTradeKeywords],
      pshsepScopeKeywords: [...module.triggerManifest.pshsepScopeKeywords],
      highRiskKeywords: [...module.triggerManifest.highRiskKeywords],
      assumedTradeKeywords: [...module.triggerManifest.assumedTradeKeywords],
      exportProgramIds: [...module.triggerManifest.exportProgramIds],
    },
  }));
}

export function getSteelErectionProgramModulesForCsepSelection(params: {
  programSelections: CSEPProgramSelection[];
  selectedHazards: string[];
  selectedPermits: string[];
  taskNames: string[];
  tradeLabel?: string | null;
  subTradeLabel?: string | null;
}) {
  const taskText = params.taskNames.join(" | ");
  const tradeText = params.tradeLabel ?? "";
  const subTradeText = params.subTradeLabel ?? "";

  return getSteelErectionProgramModules()
    .map((module): SteelErectionProgramModuleMatch | null => {
      const selectionReasons = module.triggerManifest.csepSelections
        .filter((selection) =>
          params.programSelections.some(
            (candidate) =>
              candidate.category === selection.category &&
              normalizeLabel(candidate.item) === normalizeLabel(selection.item)
          )
        )
        .map((selection) => `Program selection: ${selection.category} / ${selection.item}`);

      const reasons = dedupe([
        ...selectionReasons,
        ...findExactMatches(
          module.triggerManifest.hazardLabels,
          params.selectedHazards,
          "Hazard"
        ),
        ...findExactMatches(
          module.triggerManifest.permitLabels,
          params.selectedPermits,
          "Permit"
        ),
        ...findKeywordMatches(module.triggerManifest.taskKeywords, taskText, "Task keyword"),
        ...findKeywordMatches(module.triggerManifest.tradeKeywords, tradeText, "Trade keyword"),
        ...findKeywordMatches(
          module.triggerManifest.subTradeKeywords,
          subTradeText,
          "Sub-trade keyword"
        ),
      ]);

      if (!reasons.length) return null;

      return {
        ...module,
        matchedReasons: reasons,
      };
    })
    .filter((module): module is SteelErectionProgramModuleMatch => Boolean(module));
}

export function buildSteelErectionProgramModuleAiContext(
  modules: SteelErectionProgramModuleMatch[],
  options?: { plainTextMaxLength?: number }
) {
  const plainTextMaxLength = options?.plainTextMaxLength ?? 1_400;

  return modules.map((module) => ({
    title: module.title,
    moduleKey: module.moduleKey,
    summary: module.summary,
    sectionHeadings: module.sectionHeadings.slice(0, 12),
    plainText: trimPlainText(module.plainText, plainTextMaxLength),
    sourceFilename: module.sourceFilename,
    matchedReasons: [...module.matchedReasons],
  }));
}
