import {
  STEEL_ERECTION_TASK_MODULES,
  type GeneratedSteelErectionTaskModule,
} from "@/lib/steelErectionTaskModules.generated";

export type SteelErectionTaskModule = GeneratedSteelErectionTaskModule;

export const STEEL_ERECTION_TASK_MODULE_PACK_KEY = "steel_erection_task_modules_matched_subset";

function normalizeLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function trimPlainText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

/** Removes repeated steel task-module boilerplate from reference-pack text (AI context + readability). */
function stripSteelTaskModulePlainTextBoilerplate(plainText: string) {
  return plainText
    .split("\n")
    .filter(
      (line) =>
        !/this task element supports steel-erection planning, training, and field execution/i.test(
          line
        ) &&
        !/it focuses on the practical steps needed to perform the task safely and hand it off cleanly to the next crew\.?$/i.test(
          line.trim()
        )
    )
    .join("\n");
}

function dedupeByModuleKey(modules: SteelErectionTaskModule[]) {
  const seen = new Set<string>();
  return modules.filter((module) => {
    if (seen.has(module.moduleKey)) return false;
    seen.add(module.moduleKey);
    return true;
  });
}

function matchesTradeContext(
  module: SteelErectionTaskModule,
  tradeLabel?: string | null,
  subTradeLabel?: string | null
) {
  const tradeText = normalizeLabel(tradeLabel ?? "");
  const subTradeText = normalizeLabel(subTradeLabel ?? "");
  const tradeMatch = module.triggerManifest.tradeKeywords.some((keyword) =>
    tradeText.includes(normalizeLabel(keyword))
  );
  const subTradeMatch = module.triggerManifest.subTradeKeywords.some((keyword) =>
    subTradeText.includes(normalizeLabel(keyword))
  );

  return tradeMatch || subTradeMatch;
}

function matchesTaskName(module: SteelErectionTaskModule, taskName: string) {
  const normalizedTask = normalizeLabel(taskName);
  if (!normalizedTask) return false;

  return (
    module.triggerManifest.taskNames.some(
      (candidate) => normalizeLabel(candidate) === normalizedTask
    ) ||
    module.triggerManifest.taskAliases.some((candidate) =>
      normalizedTask.includes(normalizeLabel(candidate))
    ) ||
    module.triggerManifest.taskKeywords.some((candidate) =>
      normalizedTask.includes(normalizeLabel(candidate))
    )
  );
}

export function getSteelErectionTaskModules(): SteelErectionTaskModule[] {
  return STEEL_ERECTION_TASK_MODULES.map((module) => ({
    ...module,
    taskNames: [...module.taskNames],
    sectionHeadings: [...module.sectionHeadings],
    triggerManifest: {
      tradeKeywords: [...module.triggerManifest.tradeKeywords],
      subTradeKeywords: [...module.triggerManifest.subTradeKeywords],
      taskNames: [...module.triggerManifest.taskNames],
      taskKeywords: [...module.triggerManifest.taskKeywords],
      taskAliases: [...module.triggerManifest.taskAliases],
      pshsepScopeKeywords: [...module.triggerManifest.pshsepScopeKeywords],
      highRiskKeywords: [...module.triggerManifest.highRiskKeywords],
      assumedTradeKeywords: [...module.triggerManifest.assumedTradeKeywords],
      exportProgramIds: [...module.triggerManifest.exportProgramIds],
    },
  }));
}

export function getSteelErectionTaskModulesForCsepSelection(params: {
  tradeLabel?: string | null;
  subTradeLabel?: string | null;
  taskNames: string[];
}) {
  const tradeMatchOnly = getSteelErectionTaskModules().filter((module) =>
    matchesTradeContext(module, params.tradeLabel, params.subTradeLabel)
  );

  if (!tradeMatchOnly.length) return [];

  const matched = params.taskNames.flatMap((taskName) =>
    tradeMatchOnly.filter((module) => matchesTaskName(module, taskName))
  );

  return dedupeByModuleKey(matched);
}

export function buildSteelErectionTaskModuleAiContext(
  modules: SteelErectionTaskModule[],
  options?: { plainTextMaxLength?: number }
) {
  const plainTextMaxLength = options?.plainTextMaxLength ?? 1_400;

  return modules.map((module) => ({
    title: module.title,
    moduleKey: module.moduleKey,
    trade: module.trade,
    subTrade: module.subTrade,
    taskNames: [...module.taskNames],
    summary: module.summary,
    sectionHeadings: module.sectionHeadings.slice(0, 12),
    plainText: trimPlainText(
      stripSteelTaskModulePlainTextBoilerplate(module.plainText),
      plainTextMaxLength
    ),
    sourceFilename: module.sourceFilename,
  }));
}
