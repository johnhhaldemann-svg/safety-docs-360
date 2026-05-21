import {
  STEEL_ERECTION_HAZARD_MODULES,
  type GeneratedSteelErectionHazardModule,
} from "@/lib/steelErectionHazardModules.generated";

export type SteelErectionHazardModule = GeneratedSteelErectionHazardModule;

export type SteelErectionHazardModuleMatch = SteelErectionHazardModule & {
  matchedReasons: string[];
};

export const STEEL_ERECTION_HAZARD_MODULE_PACK_KEY =
  "steel_erection_hazard_modules_matched_subset";

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

export function getSteelErectionHazardModules(): SteelErectionHazardModule[] {
  return STEEL_ERECTION_HAZARD_MODULES.map((module) => ({
    ...module,
    sectionHeadings: [...module.sectionHeadings],
    triggerManifest: {
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

export function getSteelErectionHazardModulesForCsepSelection(params: {
  selectedHazards: string[];
  selectedPermits: string[];
  taskNames: string[];
  tradeLabel?: string | null;
  subTradeLabel?: string | null;
}) {
  const taskText = params.taskNames.join(" | ");
  const tradeText = params.tradeLabel ?? "";
  const subTradeText = params.subTradeLabel ?? "";

  return getSteelErectionHazardModules()
    .map((module): SteelErectionHazardModuleMatch | null => {
      const reasons = dedupe([
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
    .filter((module): module is SteelErectionHazardModuleMatch => Boolean(module));
}

export function buildSteelErectionHazardModuleAiContext(
  modules: SteelErectionHazardModuleMatch[],
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
