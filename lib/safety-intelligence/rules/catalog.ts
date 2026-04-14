import type { BucketedWorkItem, RawTaskInput, RuleSelector, RuleTemplateRecord } from "@/types/safety-intelligence";

export const STATIC_PLATFORM_RULE_TEMPLATES: RuleTemplateRecord[] = [
  {
    code: "platform_hot_work",
    label: "Platform hot work defaults",
    sourceType: "platform",
    precedence: 100,
    version: "2026-04-14",
    mergeBehavior: "extend",
    selectors: {
      taskKeywords: ["weld", "hot work", "torch", "cutting", "grinding"],
    },
    outputs: {
      hazardFamilies: ["hot_work", "fire", "fumes"],
      hazardCategories: ["Hot work", "Fire", "Fumes"],
      permitTriggers: ["hot_work_permit"],
      requiredControls: ["fire_watch", "spark_containment", "flammable_clearance"],
      trainingRequirements: ["hot_work_training"],
      ppeRequirements: ["welding_hood", "face_shield", "gloves"],
      equipmentChecks: ["welder_inspection", "fire_extinguisher_present"],
    },
  },
  {
    code: "platform_electrical",
    label: "Platform electrical defaults",
    sourceType: "platform",
    precedence: 100,
    version: "2026-04-14",
    mergeBehavior: "extend",
    selectors: {
      taskKeywords: ["energized", "electrical", "switchgear", "troubleshoot", "panel"],
    },
    outputs: {
      hazardFamilies: ["electrical", "arc_flash"],
      hazardCategories: ["Electrical", "Arc flash"],
      permitTriggers: ["energized_electrical_permit"],
      requiredControls: ["loto", "qualified_worker", "shock_boundaries"],
      trainingRequirements: ["qualified_electrical_worker", "nfpa70e"],
      ppeRequirements: ["arc_flash_ppe", "electrical_gloves"],
      equipmentChecks: ["meter_calibration", "ppe_inspection"],
    },
  },
  {
    code: "platform_excavation",
    label: "Platform excavation defaults",
    sourceType: "platform",
    precedence: 100,
    version: "2026-04-14",
    mergeBehavior: "extend",
    selectors: {
      taskKeywords: ["excavat", "trench", "dig", "groundbreaking", "shoring", "bench/shore", "backfill"],
    },
    outputs: {
      hazardFamilies: ["excavation", "collapse"],
      hazardCategories: ["Excavation", "Collapse"],
      permitTriggers: ["excavation_permit"],
      requiredControls: ["competent_person", "barricade", "access_egress"],
      trainingRequirements: ["competent_person_excavation"],
      ppeRequirements: ["high_visibility_vest", "hard_hat"],
      equipmentChecks: ["excavation_inspection", "soil_classification"],
      weatherRestrictions: ["stop_for_heavy_rain", "reinspect_after_weather_change"],
    },
  },
  {
    code: "platform_underground_utility",
    label: "Platform underground utility defaults",
    sourceType: "platform",
    precedence: 100,
    version: "2026-04-14",
    mergeBehavior: "extend",
    selectors: {
      taskKeywords: ["utility crossing", "locator wire", "manhole", "vault", "duct bank", "catch basin", "storm structure", "site drainage", "pipe laying", "install pipe"],
    },
    outputs: {
      hazardFamilies: ["utility_strike"],
      hazardCategories: ["Utility strike"],
      permitTriggers: ["excavation_permit"],
      requiredControls: ["locate_utilities"],
      trainingRequirements: ["competent_person_excavation"],
      ppeRequirements: ["high_visibility_vest", "hard_hat"],
      equipmentChecks: ["utility_locate_verification"],
    },
  },
  {
    code: "platform_crane_lift",
    label: "Platform crane lift defaults",
    sourceType: "platform",
    precedence: 100,
    version: "2026-04-14",
    mergeBehavior: "extend",
    selectors: {
      taskKeywords: ["crane", "lift", "pick", "rigging"],
    },
    outputs: {
      hazardFamilies: ["struck_by", "overhead_work"],
      hazardCategories: ["Crane and lift", "Overhead work"],
      permitTriggers: ["lift_plan"],
      requiredControls: ["signal_person", "exclusion_zone", "lift_plan_review"],
      trainingRequirements: ["qualified_rigger", "signal_person_training"],
      ppeRequirements: ["hard_hat", "high_visibility_vest"],
      equipmentChecks: ["crane_daily_inspection", "rigging_inspection"],
      weatherRestrictions: ["wind_limit_check"],
    },
  },
  {
    code: "platform_elevated_work",
    label: "Platform elevated work defaults",
    sourceType: "platform",
    precedence: 100,
    version: "2026-04-14",
    mergeBehavior: "extend",
    selectors: {
      taskKeywords: ["scaffold", "elevated", "overhead", "ladder", "mewp", "roof"],
    },
    outputs: {
      hazardFamilies: ["fall", "overhead_work"],
      hazardCategories: ["Fall", "Overhead work"],
      permitTriggers: ["elevated_work_notice"],
      requiredControls: ["toe_boards", "drop_zone_control", "fall_protection"],
      trainingRequirements: ["scaffold_user_training"],
      ppeRequirements: ["fall_protection", "hard_hat"],
      equipmentChecks: ["scaffold_tag_check", "fall_gear_inspection"],
      weatherRestrictions: ["high_wind_pause"],
    },
  },
];

function includesAny(text: string, tokens?: string[]) {
  if (!tokens?.length) return false;
  return tokens.some((token) => text.includes(token.toLowerCase()));
}

function selectorMatches(selector: RuleSelector, raw: RawTaskInput, bucket: BucketedWorkItem) {
  const haystack = [
    raw.tradeCode,
    raw.subTradeCode,
    raw.taskCode,
    raw.taskTitle,
    raw.description,
    bucket.workAreaLabel,
    bucket.locationGrid,
    ...bucket.equipmentUsed,
    ...bucket.workConditions,
    bucket.weatherConditionCode,
    ...bucket.siteRestrictions,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (selector.tradeCodes?.length && !selector.tradeCodes.includes(raw.tradeCode ?? "")) {
    return false;
  }
  if (selector.subTradeCodes?.length && !selector.subTradeCodes.includes(raw.subTradeCode ?? "")) {
    return false;
  }
  if (selector.taskCodes?.length && !selector.taskCodes.includes(raw.taskCode ?? "")) {
    return false;
  }
  if (selector.taskKeywords?.length && !includesAny(haystack, selector.taskKeywords)) {
    return false;
  }
  if (selector.equipmentTokens?.length && !includesAny(haystack, selector.equipmentTokens)) {
    return false;
  }
  if (selector.workConditionTokens?.length && !includesAny(haystack, selector.workConditionTokens)) {
    return false;
  }
  if (selector.locationTokens?.length && !includesAny(haystack, selector.locationTokens)) {
    return false;
  }
  if (selector.weatherTokens?.length && !includesAny(haystack, selector.weatherTokens)) {
    return false;
  }
  if (selector.scheduleLabels?.length) {
    const scheduleLabel = String(raw.metadata?.scheduleLabel ?? "").toLowerCase();
    if (!selector.scheduleLabels.some((label) => scheduleLabel.includes(label.toLowerCase()))) {
      return false;
    }
  }
  return true;
}

export function findCatalogMatches(
  task: RawTaskInput,
  bucket: BucketedWorkItem,
  templates: RuleTemplateRecord[] = STATIC_PLATFORM_RULE_TEMPLATES
) {
  return templates.filter((template) => selectorMatches(template.selectors, task, bucket));
}
