import type { CSEPProgramSelection } from "@/types/csep-programs";
import {
  buildSteelErectionHazardModuleAiContext,
  getSteelErectionHazardModules,
} from "@/lib/steelErectionHazardModules";
import {
  buildSteelErectionProgramModuleAiContext,
  getSteelErectionProgramModules,
} from "@/lib/steelErectionProgramModules";
import {
  buildSteelErectionTaskModuleAiContext,
  getSteelErectionTaskModules,
} from "@/lib/steelErectionTaskModules";

function normalizeLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeByModuleKey<T extends { moduleKey: string }>(modules: T[]) {
  const seen = new Set<string>();
  return modules.filter((module) => {
    if (seen.has(module.moduleKey)) return false;
    seen.add(module.moduleKey);
    return true;
  });
}

function matchesKeywordSet(criteria: string[], values: string[]) {
  const haystack = normalizeLabel(values.join(" | "));
  return criteria.some((keyword) => haystack.includes(normalizeLabel(keyword)));
}

function matchesExportPrograms(criteria: string[], exportProgramIds: string[]) {
  const normalizedCriteria = new Set(criteria.map((value) => normalizeLabel(value)));
  return exportProgramIds.some((value) => normalizedCriteria.has(normalizeLabel(value)));
}

export function getSteelErectionReferencePacksForPshsepSelection(params: {
  scopeOfWorkSelected: string[];
  highRiskFocusAreas: string[];
  assumedTradesIndex: string[];
  exportProgramIds: string[];
  programSelections?: CSEPProgramSelection[];
}) {
  const hazardModules = dedupeByModuleKey(
    getSteelErectionHazardModules()
      .filter(
        (module) =>
          matchesKeywordSet(module.triggerManifest.pshsepScopeKeywords, params.scopeOfWorkSelected) ||
          matchesKeywordSet(module.triggerManifest.highRiskKeywords, params.highRiskFocusAreas) ||
          matchesKeywordSet(module.triggerManifest.assumedTradeKeywords, params.assumedTradesIndex) ||
          matchesExportPrograms(module.triggerManifest.exportProgramIds, params.exportProgramIds)
      )
      .map((module) => ({
        ...module,
        matchedReasons: [
          ...(matchesKeywordSet(module.triggerManifest.pshsepScopeKeywords, params.scopeOfWorkSelected)
            ? ["PSHSEP scope matched steel work."]
            : []),
          ...(matchesKeywordSet(module.triggerManifest.highRiskKeywords, params.highRiskFocusAreas)
            ? ["High-risk focus area matched steel work."]
            : []),
          ...(matchesKeywordSet(module.triggerManifest.assumedTradeKeywords, params.assumedTradesIndex)
            ? ["Assumed trade matched steel work."]
            : []),
          ...(matchesExportPrograms(module.triggerManifest.exportProgramIds, params.exportProgramIds)
            ? ["PSHSEP export program matched steel work."]
            : []),
        ],
      }))
  );

  const taskModules = dedupeByModuleKey(
    getSteelErectionTaskModules().filter(
      (module) =>
        matchesKeywordSet(module.triggerManifest.pshsepScopeKeywords, params.scopeOfWorkSelected) ||
        matchesKeywordSet(module.triggerManifest.highRiskKeywords, params.highRiskFocusAreas) ||
        matchesKeywordSet(module.triggerManifest.assumedTradeKeywords, params.assumedTradesIndex) ||
        matchesExportPrograms(module.triggerManifest.exportProgramIds, params.exportProgramIds)
    )
  );

  const programModules = dedupeByModuleKey(
    getSteelErectionProgramModules()
      .filter(
        (module) =>
          matchesKeywordSet(module.triggerManifest.pshsepScopeKeywords, params.scopeOfWorkSelected) ||
          matchesKeywordSet(module.triggerManifest.highRiskKeywords, params.highRiskFocusAreas) ||
          matchesKeywordSet(module.triggerManifest.assumedTradeKeywords, params.assumedTradesIndex) ||
          matchesExportPrograms(module.triggerManifest.exportProgramIds, params.exportProgramIds) ||
          module.triggerManifest.csepSelections.some((selection) =>
            (params.programSelections ?? []).some(
              (candidate) =>
                candidate.category === selection.category &&
                normalizeLabel(candidate.item) === normalizeLabel(selection.item)
            )
          )
      )
      .map((module) => ({
        ...module,
        matchedReasons: [
          ...(matchesKeywordSet(module.triggerManifest.pshsepScopeKeywords, params.scopeOfWorkSelected)
            ? ["PSHSEP scope matched steel work."]
            : []),
          ...(matchesKeywordSet(module.triggerManifest.highRiskKeywords, params.highRiskFocusAreas)
            ? ["High-risk focus area matched steel work."]
            : []),
          ...(matchesKeywordSet(module.triggerManifest.assumedTradeKeywords, params.assumedTradesIndex)
            ? ["Assumed trade matched steel work."]
            : []),
          ...(matchesExportPrograms(module.triggerManifest.exportProgramIds, params.exportProgramIds)
            ? ["PSHSEP export program matched steel work."]
            : []),
          ...module.triggerManifest.csepSelections
            .filter((selection) =>
              (params.programSelections ?? []).some(
                (candidate) =>
                  candidate.category === selection.category &&
                  normalizeLabel(candidate.item) === normalizeLabel(selection.item)
              )
            )
            .map((selection) => `Program selection: ${selection.category} / ${selection.item}`),
        ],
      }))
  );

  return {
    hazardModules,
    taskModules,
    programModules,
    hazardModuleAiContext: buildSteelErectionHazardModuleAiContext(hazardModules),
    taskModuleAiContext: buildSteelErectionTaskModuleAiContext(taskModules),
    programModuleAiContext: buildSteelErectionProgramModuleAiContext(programModules),
  };
}
