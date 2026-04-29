import {
  CONSTRUCTION_TRADE_LABELS,
  getSharedSubTradeDefinition,
  getSelectableSharedTasks,
  getSharedSubTradesForTrade,
  getSharedTradeDefinitionByLabel,
  resolveSharedSubTradeCode,
  type SharedSubTradeDefinition,
  type SharedTaskDefinition,
  type SharedTradeDefinition,
} from "@/lib/sharedTradeTaxonomy";
import { DEFAULT_CONFLICT_SEEDS } from "@/lib/safety-intelligence/conflicts/defaultPairs";
import { csepDefaultPpeForKind, csepOshaRefsForKind, csepSummaryForKind } from "@/lib/csepTradeTemplates";

export type RiskLevel = "Low" | "Medium" | "High";

export type CSEPRiskItem = {
  activity: string;
  hazard: string;
  risk: RiskLevel;
  controls: string[];
  permit: string;
};

export type CSEPTradeSelection = {
  tradeLabel: string;
  tradeCode: string;
  subTradeLabel: string | null;
  subTradeCode: string | null;
  subTradeDescription: string | null;
  sectionTitle: string;
  summary: string;
  oshaRefs: string[];
  defaultPPE: string[];
  items: CSEPRiskItem[];
  availableSubTrades: string[];
  availableTasks: string[];
  referenceTasks: string[];
  derivedHazards: string[];
  derivedPermits: string[];
  commonOverlappingTrades: string[];
  overlapPermitHints: string[];
};

function includesAny(haystack: string, needles: readonly string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

function uniq(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeComparableLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token && token !== "and")
    .join(" ");
}

function looksLikeSteelScope(tradeLabel: string, subTradeLabel?: string | null) {
  const context = `${tradeLabel} ${subTradeLabel ?? ""}`.toLowerCase();
  return (
    /\bsteel\b/.test(context) ||
    /\bironwork/.test(context) ||
    context.includes("metal deck") ||
    context.includes("ornamental metal")
  );
}

function resolveSubTradeSelection(
  trade: SharedTradeDefinition,
  subTradeLabel?: string | null
): SharedSubTradeDefinition | null {
  if (!subTradeLabel) return null;

  const resolvedCode = resolveSharedSubTradeCode(trade.code, subTradeLabel);
  if (resolvedCode) {
    return getSharedSubTradeDefinition(trade.code, resolvedCode);
  }

  const requested = normalizeComparableLabel(subTradeLabel);
  return (
    trade.subTrades.find((row) => normalizeComparableLabel(row.label) === requested) ??
    null
  );
}

function resolveRequestedTaskLabels(
  requestedTaskLabels: readonly string[],
  selectableTasks: readonly SharedTaskDefinition[],
  params: { tradeLabel: string; subTradeLabel: string | null }
) {
  const selectableByLabel = new Map(
    selectableTasks.map((task) => [normalizeComparableLabel(task.label), task.label])
  );
  const selectableLabels = new Set(selectableTasks.map((task) => task.label));
  const selected: string[] = [];

  const pushIfSelectable = (label: string) => {
    if (!selectableLabels.has(label)) return;
    selected.push(label);
  };

  const pushSteelAliases = (rawLabel: string) => {
    if (!looksLikeSteelScope(params.tradeLabel, params.subTradeLabel)) return;
    const normalized = normalizeComparableLabel(rawLabel);

    if (/\b(hoisting rigging|rigging hoisting|crane hoisting|crane rigging)\b/.test(normalized)) {
      ["Rigging", "Crane picks"].forEach(pushIfSelectable);
    }
    if (/\b(steel erection|structural steel erection|ironwork erection|erection work)\b/.test(normalized)) {
      ["Column erection", "Beam setting", "Connecting", "Bolting", "Decking install"].forEach(pushIfSelectable);
    }
    if (/\b(welding cutting|weld cut|hot work)\b/.test(normalized)) {
      ["Welding", "Cutting", "Grinding"].forEach(pushIfSelectable);
    }
    if (/\b(work at heights|work at height|fall protection|leading edge)\b/.test(normalized)) {
      ["Column erection", "Beam setting", "Connecting", "Decking install"].forEach(pushIfSelectable);
    }
  };

  for (const rawLabel of requestedTaskLabels) {
    const direct = selectableByLabel.get(normalizeComparableLabel(rawLabel));
    if (direct) {
      selected.push(direct);
    }
    pushSteelAliases(rawLabel);
  }

  return uniq(selected);
}

const UTILITY_SCOPE_TOKENS = [
  "utility",
  "pipe laying",
  "install pipe",
  "storm structures",
  "catch basins",
  "manhole",
  "vault",
  "site drainage",
  "locator wire",
  "duct bank",
  "conduit bank",
  "pull boxes",
  "fire main",
  "sanitary",
  "storm /",
  "water /",
] as const;

const EXCAVATION_SCOPE_TOKENS = [
  "excavat",
  "trench",
  "shoring",
  "bench/shore",
  "backfill",
  "bedding",
  "trench support",
  "dig",
  "groundbreaking",
  "ground breaking",
  "ground disturb",
] as const;

function hasUtilityScope(taskContext: string) {
  return includesAny(taskContext, UTILITY_SCOPE_TOKENS);
}

function hasExcavationScope(taskContext: string) {
  return includesAny(taskContext, EXCAVATION_SCOPE_TOKENS);
}

const TRENCH_SCOPE_TOKENS = [
  "trench",
  "shoring",
  "bench/shore",
  "trench support",
] as const;

function hasTrenchScope(taskContext: string) {
  return includesAny(taskContext, TRENCH_SCOPE_TOKENS);
}

type OverlapRule = {
  hazardMatch?: string[];
  permitMatch?: string[];
  tokenMatch?: string[];
  commonTrades: string[];
  permitHints: string[];
};

const CURATED_OVERLAP_RULES: OverlapRule[] = [
  {
    hazardMatch: ["Excavation collapse"],
    commonTrades: [
      "Underground Utilities",
      "Plumbing",
      "Electrical",
      "Survey / Layout",
      "General Conditions / Site Management",
    ],
    permitHints: ["Ground Disturbance Permit"],
  },
  {
    hazardMatch: ["Hot work / fire"],
    commonTrades: ["Painting / Coatings", "HVAC / Mechanical", "Fire Protection"],
    permitHints: ["Hot Work Permit"],
  },
  {
    hazardMatch: ["Crane lift hazards", "Falling objects"],
    commonTrades: ["Rigging / Crane / Hoisting", "Scaffolding / Access", "General Conditions / Site Management"],
    permitHints: ["Motion Permit", "Gravity Permit"],
  },
  {
    hazardMatch: ["Electrical shock", "Pressure / line break"],
    commonTrades: ["HVAC / Mechanical", "Plumbing", "Pipefitting / Process Piping", "Instrumentation / Controls / Automation"],
    permitHints: ["LOTO Permit"],
  },
];

const CONFLICT_TOKEN_TO_TRADE: Array<{ tokens: string[]; trade: string }> = [
  { tokens: ["painting", "flammables"], trade: "Painting / Coatings" },
  { tokens: ["electrical", "energized"], trade: "Electrical" },
  { tokens: ["mechanical", "startup"], trade: "HVAC / Mechanical" },
  { tokens: ["scaffold", "overhead_work"], trade: "Scaffolding / Access" },
  { tokens: ["welding", "hot_work"], trade: "Welding / Hot Work" },
  { tokens: ["excavation", "pedestrian", "active_work_zone", "shared_area"], trade: "General Conditions / Site Management" },
];

function deriveOverlapInsights(params: {
  tradeLabel: string;
  subTradeLabel: string | null;
  taskLabels: readonly string[];
  items: readonly CSEPRiskItem[];
  derivedPermits: readonly string[];
}) {
  const overlapTrades = new Set<string>();
  const permitHints = new Set<string>();
  const seedText = [
    params.tradeLabel,
    params.subTradeLabel ?? "",
    ...params.taskLabels,
    ...params.items.map((item) => `${item.hazard} ${item.permit} ${item.controls.join(" ")}`),
  ]
    .join(" ")
    .toLowerCase();

  for (const rule of CURATED_OVERLAP_RULES) {
    const hazardHit =
      rule.hazardMatch?.some((hazard) => params.items.some((item) => item.hazard === hazard)) ?? false;
    const permitHit =
      rule.permitMatch?.some((permit) => params.derivedPermits.includes(permit)) ?? false;
    const tokenHit = rule.tokenMatch?.some((token) => seedText.includes(token.toLowerCase())) ?? false;
    if (!hazardHit && !permitHit && !tokenHit) continue;
    rule.commonTrades.forEach((trade) => overlapTrades.add(trade));
    rule.permitHints.forEach((permit) => permitHints.add(permit));
  }

  for (const seed of DEFAULT_CONFLICT_SEEDS) {
    const leftHit = seed.leftMatch.some((token) => seedText.includes(token.toLowerCase()));
    if (!leftHit) continue;
    for (const mapping of CONFLICT_TOKEN_TO_TRADE) {
      const tokenMatch =
        mapping.tokens.some((token) => seed.rightMatch.some((right) => right.toLowerCase().includes(token))) ||
        mapping.tokens.some((token) => seed.rationale.toLowerCase().includes(token));
      if (tokenMatch) {
        overlapTrades.add(mapping.trade);
      }
    }
  }

  overlapTrades.delete(params.tradeLabel);
  return {
    commonOverlappingTrades: uniq([...overlapTrades]).sort((a, b) => a.localeCompare(b)),
    overlapPermitHints: uniq([...permitHints]).sort((a, b) => a.localeCompare(b)),
  };
}

function deriveAdditionalOshaRefs(items: readonly CSEPRiskItem[]) {
  const refs = new Set<string>();

  for (const item of items) {
    switch (item.hazard) {
      case "Excavation collapse":
        refs.add("OSHA 1926 Subpart P – Excavations");
        break;
      case "Crane lift hazards":
        refs.add("OSHA 1926 Subpart CC – Cranes and Derricks in Construction");
        break;
      case "Falling objects":
        refs.add("OSHA 1926.759 - Falling Object Protection");
        break;
      case "Structural instability and collapse":
        refs.add("OSHA 1926 Subpart R - Steel Erection");
        break;
      case "Electrical shock":
        refs.add("OSHA 1926 Subpart K – Electrical");
        break;
      case "Falls from height":
        refs.add("OSHA 1926 Subpart M – Fall Protection");
        break;
      case "Hot work / fire":
        refs.add("OSHA 1926 Subpart J – Fire Protection and Prevention");
        break;
      case "Confined spaces":
        refs.add("OSHA 1926 Subpart AA – Confined Spaces in Construction");
        break;
      case "Struck by equipment":
        refs.add("OSHA 1926 Subpart O – Motor Vehicles, Mechanized Equipment, and Marine Operations");
        break;
      default:
        break;
    }
  }

  return [...refs];
}

function buildDerivedSummary(items: readonly CSEPRiskItem[]) {
  const activityText = items.map((item) => `${item.activity} (${item.hazard})`).slice(0, 4).join(", ");
  const excavationActive = items.some((item) => item.hazard === "Excavation collapse");
  const utilityActive = items.some((item) => item.hazard === "Excavation collapse" && hasUtilityScope(item.activity.toLowerCase()));
  const craneActive = items.some((item) => item.hazard === "Crane lift hazards");
  const equipmentActive = items.some((item) => item.hazard === "Struck by equipment");

  const parts: string[] = [];
  if (activityText) {
    parts.push(`Selected work includes ${activityText}.`);
  }
  if (excavationActive) {
    parts.push("Excavation controls should stay tied to the actual earth-disturbance scope, competent person review, and access/egress planning.");
  }
  if (utilityActive) {
    parts.push("Underground utility coordination is required because the selected tasks include direct utility or structure work.");
  }
  if (craneActive) {
    parts.push("Lift planning and suspended-load controls are required for the selected material-handling scope.");
  }
  if (!excavationActive && equipmentActive) {
    parts.push("This selection emphasizes equipment movement and haul-route exposure rather than trenching or underground utility work.");
  }
  return parts.join(" ");
}

function steelRiskItem(
  activity: string,
  hazard: string,
  risk: RiskLevel,
  controls: string[],
  permit = "None"
): CSEPRiskItem {
  return {
    activity,
    hazard,
    risk,
    controls,
    permit,
  };
}

function buildSteelRiskItems(
  tradeLabel: string,
  subTradeLabel: string | null,
  taskLabels: readonly string[]
) {
  if (!looksLikeSteelScope(tradeLabel, subTradeLabel)) return [];

  const items: CSEPRiskItem[] = [];
  const push = (item: CSEPRiskItem) => items.push(item);

  for (const taskLabel of taskLabels) {
    const task = normalizeComparableLabel(taskLabel);
    const isHoistingOrRigging =
      /\b(rigging|crane picks|crane pick|hoist|pick)\b/.test(task);
    const isColumnBeamOrConnecting =
      /\b(column erection|beam setting|connecting|bolting)\b/.test(task);
    const isDecking = /\b(decking install|deck install|decking)\b/.test(task);
    const isReceiving = /\b(unload steel|sort members|receiving|staging)\b/.test(task);

    if (isReceiving) {
      push(
        steelRiskItem(taskLabel, "Struck by equipment", "High", [
          "Spotters",
          "Controlled laydown routes",
          "Equipment exclusion zones",
        ], "Motion Permit")
      );
      push(
        steelRiskItem(taskLabel, "Pinch / caught between and struck by", "High", [
          "Hands clear of pinch points",
          "Tag lines",
          "Stable dunnage and blocking",
        ], "Motion Permit")
      );
    }

    if (isHoistingOrRigging || isColumnBeamOrConnecting) {
      push(
        steelRiskItem(taskLabel, "Crane lift hazards", "High", [
          "Lift plan",
          "Qualified rigger and signal person",
          "Barricaded load path",
        ], "Motion Permit")
      );
    }

    if (isColumnBeamOrConnecting || isDecking) {
      push(
        steelRiskItem(taskLabel, "Falls from height", "High", [
          "PFAS",
          "Controlled decking zone controls",
          "Rescue planning",
        ], "Gravity Permit")
      );
      push(
        steelRiskItem(taskLabel, "Structural instability and collapse", "High", [
          "Erection sequence verification",
          "Temporary bracing",
          "Do not release hoisting gear until stability is verified",
        ])
      );
    }

    if (isHoistingOrRigging || isColumnBeamOrConnecting || isDecking || isReceiving) {
      push(
        steelRiskItem(taskLabel, "Falling objects", "High", [
          "Drop zone control",
          "Tool tethering",
          "Secure loose material before release",
        ], "Gravity Permit")
      );
      push(
        steelRiskItem(taskLabel, "Environmental and site condition", "Medium", [
          "Wind and lightning review",
          "Stable crane and laydown support",
          "Clear access routes",
        ])
      );
    }

    if (isColumnBeamOrConnecting) {
      push(
        steelRiskItem(taskLabel, "Pinch / caught between and struck by", "High", [
          "Controlled landing",
          "Hands clear during fit-up",
          "Communication between connectors and operator",
        ], "Motion Permit")
      );
    }
  }

  return items;
}

function mergeRiskItems(items: readonly CSEPRiskItem[]) {
  const seen = new Set<string>();
  const merged: CSEPRiskItem[] = [];

  for (const item of items) {
    const key = `${normalizeComparableLabel(item.activity)}|${normalizeComparableLabel(item.hazard)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

function profileForTask(
  tradeLabel: string,
  subTradeLabel: string,
  taskLabel: string
): Omit<CSEPRiskItem, "activity"> {
  const taskContext = taskLabel.toLowerCase();
  const context = `${tradeLabel} ${subTradeLabel} ${taskLabel}`.toLowerCase();

  if (
    includesAny(context, [
      "conduit",
      "wire",
      "termination",
      "panel",
      "switchgear",
      "lighting",
      "grounding",
      "energization",
      "megger",
      "control wiring",
      "sensor install",
      "network connection",
      "inverter",
      "ev charging",
      "backup power",
    ])
  ) {
    return {
      hazard: "Electrical shock",
      risk: "High",
      controls: ["LOTO", "GFCI protection", "Qualified workers only"],
      permit: "LOTO Permit",
    };
  }

  if (
    includesAny(context, [
      "weld",
      "braz",
      "torch",
      "grind",
      "cut",
      "saw cutting",
      "hot work",
      "spark",
      "fire watch",
      "orbital weld",
    ])
  ) {
    return {
      hazard: "Hot work / fire",
      risk: "High",
      controls: ["Fire watch", "Remove combustibles", "Spark containment"],
      permit: "Hot Work Permit",
    };
  }

  if (hasExcavationScope(taskContext) || hasUtilityScope(taskContext)) {
    return {
      hazard: "Excavation collapse",
      risk: "High",
      controls: hasUtilityScope(taskContext)
        ? [
            "Competent person review",
            "Protective systems",
            "Safe access and egress",
            "Verify utility locate / exposure controls",
          ]
        : ["Competent person review", "Protective systems", "Safe access and egress"],
      permit: hasTrenchScope(taskContext) ? "Trench Inspection Permit" : "Ground Disturbance Permit",
    };
  }

  if (
    includesAny(context, [
      "confined",
      "manhole",
      "vault",
      "negative air",
      "sanitized tie",
      "tank",
      "entry support",
    ])
  ) {
    return {
      hazard: "Confined spaces",
      risk: "High",
      controls: ["Air monitoring", "Entry review", "Rescue planning"],
      permit: "Confined Space Permit",
    };
  }

  if (
    includesAny(context, [
      "roof",
      "curtain wall",
      "window",
      "glazing",
      "aerial lift",
      "mewp",
      "ladder",
      "scaffold",
      "decking",
      "column erection",
      "beam setting",
      "fall protection",
      "suspended access",
    ])
  ) {
    return {
      hazard: "Falls from height",
      risk: "High",
      controls: ["Guardrails", "PFAS", "Pre-task planning"],
      permit: includesAny(context, ["aerial lift", "mewp"]) ? "AWP/MEWP Permit" : "Ladder Permit",
    };
  }

  if (
    includesAny(context, [
      "crane",
      "rigging",
      "pick",
      "outrigger",
      "tag line",
      "hoist",
      "signal person",
      "load path",
      "telehandler",
      "forklift",
      "loading/unloading",
    ])
  ) {
    return {
      hazard: "Crane lift hazards",
      risk: "High",
      controls: ["Lift plan", "Signal persons", "Exclusion zone"],
      permit: "Motion Permit",
    };
  }

  if (
    includesAny(context, [
      "coat",
      "paint",
      "sealant",
      "primer",
      "epoxy",
      "resinous",
      "abatement",
      "asbestos",
      "lead",
      "mold",
      "fireproofing",
      "caulking",
      "membrane",
      "passivation",
    ])
  ) {
    return {
      hazard: "Chemical exposure",
      risk: "Medium",
      controls: ["PPE", "SDS review", "Ventilation / containment"],
      permit: "Chemical Permit",
    };
  }

  if (includesAny(context, ["saw cutting", "chipping", "grinding", "mortar", "grout", "surface prep"])) {
    return {
      hazard: "Silica / dust exposure",
      risk: "Medium",
      controls: ["Dust control", "Respiratory protection", "Housekeeping"],
      permit: "None",
    };
  }

  if (
    includesAny(context, [
      "pressure testing",
      "hydro",
      "flushing",
      "tie-in",
      "valve install",
      "startup",
      "commissioning",
      "calibration",
      "loop checks",
    ])
  ) {
    return {
      hazard: "Pressure / line break",
      risk: "Medium",
      controls: ["Verify isolation", "Controlled release", "Communication / boundaries"],
      permit: "None",
    };
  }

  if (
    includesAny(context, [
      "deliveries",
      "material",
      "hauling",
      "grading",
      "compaction",
      "staging",
      "waste handling",
      "traffic control",
      "material movement",
      "equipment setting",
    ])
  ) {
    return {
      hazard: "Struck by equipment",
      risk: "High",
      controls: ["Spotters", "Equipment alarms", "Exclusion zones"],
      permit: "Motion Permit",
    };
  }

  return {
    hazard: "Slips trips falls",
    risk: "Medium",
    controls: ["Housekeeping", "Maintain clear access", "Daily walkdown"],
    permit: "None",
  };
}

/** Exported for CSEP document assembly (task-hazard matrix rows). */
export function buildRiskItem(tradeLabel: string, subTradeLabel: string, taskLabel: string): CSEPRiskItem {
  const profile = profileForTask(tradeLabel, subTradeLabel, taskLabel);
  return {
    activity: taskLabel,
    ...profile,
  };
}

export function buildCsepTradeSelection(
  tradeLabel: string,
  subTradeLabel?: string | null,
  taskLabels?: readonly string[]
): CSEPTradeSelection | null {
  const trade = getSharedTradeDefinitionByLabel(tradeLabel);
  if (!trade) return null;

  const subTrade = resolveSubTradeSelection(trade, subTradeLabel);
  const selectableTasks = subTrade ? getSelectableSharedTasks(trade.code, subTrade.code) : [];
  const requestedTaskLabels = uniq(taskLabels ?? []);
  const activeTaskLabels =
    subTrade && requestedTaskLabels.length > 0
      ? resolveRequestedTaskLabels(requestedTaskLabels, selectableTasks, {
          tradeLabel: trade.label,
          subTradeLabel: subTrade.label,
        })
      : [];

  const items = subTrade
    ? mergeRiskItems([
        ...activeTaskLabels.map((taskLabel) => buildRiskItem(trade.label, subTrade.label, taskLabel)),
        ...buildSteelRiskItems(trade.label, subTrade.label, activeTaskLabels),
      ])
    : [];
  const derivedHazards = uniq(items.map((item) => item.hazard));
  const derivedPermitSet = new Set(items.map((item) => item.permit).filter((permit) => permit !== "None"));
  const hasExcavation = items.some((item) => item.hazard === "Excavation collapse");
  const hasTrench = items.some(
    (item) => item.hazard === "Excavation collapse" && hasTrenchScope(item.activity.toLowerCase())
  );
  if (hasExcavation) {
    derivedPermitSet.add("Ground Disturbance Permit");
  }
  if (hasTrench) {
    derivedPermitSet.add("Trench Inspection Permit");
  }
  const derivedPermits = uniq([...derivedPermitSet]);
  const overlapInsights = deriveOverlapInsights({
    tradeLabel: trade.label,
    subTradeLabel: subTrade?.label ?? null,
    taskLabels: activeTaskLabels,
    items,
    derivedPermits,
  });
  const additionalOshaRefs = deriveAdditionalOshaRefs(items);
  const summaryParts = [csepSummaryForKind(trade.csepKind)];
  if (subTrade) summaryParts.push(subTrade.description);
  if (activeTaskLabels.length > 0) {
    summaryParts.push(`Selected tasks include ${activeTaskLabels.slice(0, 5).join(", ")}.`);
    const derivedSummary = buildDerivedSummary(items);
    if (derivedSummary) {
      summaryParts.push(derivedSummary);
    }
  } else if (subTrade) {
    summaryParts.push("Select one or more tasks to generate hazards, permit triggers, and matrix rows.");
  }

  return {
    tradeLabel: trade.label,
    tradeCode: trade.code,
    subTradeLabel: subTrade?.label ?? null,
    subTradeCode: subTrade?.code ?? null,
    subTradeDescription: subTrade?.description ?? null,
    sectionTitle: `Site-Specific Safety Requirements - ${trade.label}`,
    summary: summaryParts.join(" "),
    oshaRefs: uniq([...csepOshaRefsForKind(trade.csepKind), ...additionalOshaRefs]),
    defaultPPE: csepDefaultPpeForKind(trade.csepKind),
    items,
    availableSubTrades: trade.subTrades.map((row) => row.label),
    availableTasks: selectableTasks.map((task) => task.label),
    referenceTasks: subTrade?.referenceTasks.map((task) => task.label) ?? [],
    derivedHazards,
    derivedPermits,
    commonOverlappingTrades: overlapInsights.commonOverlappingTrades,
    overlapPermitHints: overlapInsights.overlapPermitHints,
  };
}

export function getCsepTradeOptions(): string[] {
  return [...CONSTRUCTION_TRADE_LABELS];
}

export function getCsepSubTradeOptions(tradeLabel: string): string[] {
  const trade = getSharedTradeDefinitionByLabel(tradeLabel);
  if (!trade) return [];
  return getSharedSubTradesForTrade(trade.code).map((subTrade) => subTrade.label);
}

export function getCsepTaskOptions(
  tradeLabel: string,
  subTradeLabel: string
): { selectable: string[]; reference: string[] } {
  const trade = getSharedTradeDefinitionByLabel(tradeLabel);
  if (!trade) return { selectable: [], reference: [] };
  const subTrade = trade.subTrades.find((row) => row.label === subTradeLabel);
  if (!subTrade) return { selectable: [], reference: [] };
  return {
    selectable: getSelectableSharedTasks(trade.code, subTrade.code).map(
      (task) => task.label
    ),
    reference: subTrade.referenceTasks.map((task) => task.label),
  };
}
