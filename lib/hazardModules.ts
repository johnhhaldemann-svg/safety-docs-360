import {
  HAZARD_MODULES,
  type GeneratedHazardModule,
} from "@/lib/hazardModules.generated";

export type HazardModule = GeneratedHazardModule;

export type HazardModuleMatch = HazardModule & {
  matchedReasons: string[];
};

export const CSEP_HAZARD_MODULE_PACK_KEY = "csep_hazard_modules_matched_subset";

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

export function getHazardModules(): HazardModule[] {
  return HAZARD_MODULES.map((module) => ({
    ...module,
    sectionHeadings: [...module.sectionHeadings],
    matchCriteria: {
      hazardLabels: [...module.matchCriteria.hazardLabels],
      permitLabels: [...module.matchCriteria.permitLabels],
      taskKeywords: [...module.matchCriteria.taskKeywords],
      tradeKeywords: [...module.matchCriteria.tradeKeywords],
      subTradeKeywords: [...module.matchCriteria.subTradeKeywords],
    },
  }));
}

export function getHazardModulesForCsepSelection(params: {
  selectedHazards: string[];
  selectedPermits: string[];
  taskNames: string[];
  tradeLabel?: string | null;
  subTradeLabel?: string | null;
}) {
  const taskText = params.taskNames.join(" | ");
  const tradeText = params.tradeLabel ?? "";
  const subTradeText = params.subTradeLabel ?? "";

  return getHazardModules()
    .map((element): HazardModuleMatch | null => {
      const reasons = dedupe([
        ...findExactMatches(
          element.matchCriteria.hazardLabels,
          params.selectedHazards,
          "Hazard"
        ),
        ...findExactMatches(
          element.matchCriteria.permitLabels,
          params.selectedPermits,
          "Permit"
        ),
        ...findKeywordMatches(
          element.matchCriteria.taskKeywords,
          taskText,
          "Task keyword"
        ),
        ...findKeywordMatches(
          element.matchCriteria.tradeKeywords,
          tradeText,
          "Trade keyword"
        ),
        ...findKeywordMatches(
          element.matchCriteria.subTradeKeywords,
          subTradeText,
          "Sub-trade keyword"
        ),
      ]);

      if (!reasons.length) return null;

      return {
        ...element,
        matchedReasons: reasons,
      };
    })
    .filter((element): element is HazardModuleMatch => Boolean(element));
}

export function buildHazardModuleAiContext(
  modules: HazardModuleMatch[],
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
