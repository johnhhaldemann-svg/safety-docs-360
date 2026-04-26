import {
  SITE_MANAGEMENT_TASK_MODULES,
  type GeneratedSiteManagementTaskModule,
} from "@/lib/siteManagementTaskModules.generated";

export type SiteManagementTaskModule = GeneratedSiteManagementTaskModule;

export const SITE_MANAGEMENT_TRADE_LABEL = "General Conditions / Site Management";
export const SITE_SETUP_TASK_NAME = "Site setup";
export const SITE_MANAGEMENT_TASK_MODULE_PACK_KEY =
  "general_conditions_site_management_site_setup_modules";

function normalizeLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function dedupeByModuleKey(modules: SiteManagementTaskModule[]) {
  const seen = new Set<string>();
  return modules.filter((module) => {
    if (seen.has(module.moduleKey)) return false;
    seen.add(module.moduleKey);
    return true;
  });
}

function trimPlainText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

/** Same line filters as steel task modules; no-op for typical site-management packs. */
function stripSiteTaskModulePlainTextBoilerplate(plainText: string) {
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

export function getSiteManagementTaskModules(): SiteManagementTaskModule[] {
  return SITE_MANAGEMENT_TASK_MODULES.map((module) => ({
    ...module,
    taskNames: [...module.taskNames],
    sectionHeadings: [...module.sectionHeadings],
  }));
}

export function getTaskModulesForTask(taskName: string): SiteManagementTaskModule[] {
  const normalizedTask = normalizeLabel(taskName);

  if (!normalizedTask) return [];
  if (normalizedTask === normalizeLabel(SITE_SETUP_TASK_NAME)) {
    return getSiteManagementTaskModules();
  }

  return getSiteManagementTaskModules().filter((module) =>
    module.taskNames.some((candidate) => normalizeLabel(candidate) === normalizedTask)
  );
}

export function getTaskModulesForCsepSelection(params: {
  tradeLabel: string;
  taskNames: string[];
}): SiteManagementTaskModule[] {
  if (normalizeLabel(params.tradeLabel) !== normalizeLabel(SITE_MANAGEMENT_TRADE_LABEL)) {
    return [];
  }

  const matched = params.taskNames.flatMap((taskName) => getTaskModulesForTask(taskName));
  return dedupeByModuleKey(matched);
}

export function buildTaskModuleAiContext(
  modules: SiteManagementTaskModule[],
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
      stripSiteTaskModulePlainTextBoilerplate(module.plainText),
      plainTextMaxLength
    ),
    sourceFilename: module.sourceFilename,
  }));
}
