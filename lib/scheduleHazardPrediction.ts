export type SchedulePredictionRiskLevel = "low" | "medium" | "high" | "critical";

export type ScheduleHazardPredictionInput = {
  title?: string | null;
  trade?: string | null;
  taskType?: string | null;
  workArea?: string | null;
  crewSize?: number | string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  notes?: string | null;
};

export type ScheduleHazardPrediction = {
  riskLevel: SchedulePredictionRiskLevel;
  isHighRisk: boolean;
  hazardCategories: string[];
  permitTriggers: string[];
  requiredControls: string[];
  rationale: string;
  confidence: number;
  matchedSignals: string[];
};

export type ScheduleHazardPredictionResponse = ScheduleHazardPrediction & {
  source: "rules" | "ai_updated_today" | "ai_cached" | "rules_fallback";
  aiMeta?: Record<string, unknown> | null;
  inputFingerprint?: string;
};

type Rule = {
  id: string;
  riskLevel: SchedulePredictionRiskLevel;
  labels: string[];
  patterns: RegExp[];
  hazards: string[];
  permits: string[];
  controls: string[];
  rationale: string;
  confidence: number;
};

const RISK_WEIGHT: Record<SchedulePredictionRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const RULES: readonly Rule[] = [
  {
    id: "work_at_height",
    riskLevel: "critical",
    labels: ["work at height", "fall exposure"],
    patterns: [/fall|height|roof|edge|deck|aerial|lift|scaffold|ladder|mezzanine/i],
    hazards: ["fall_protection", "dropped_objects"],
    permits: ["elevated_work_notice"],
    controls: ["guardrails or approved PFAS", "fall rescue plan", "controlled access below", "pre-use access inspection"],
    rationale: "Work at height can create fall and dropped-object exposure before the crew begins.",
    confidence: 0.86,
  },
  {
    id: "hot_work",
    riskLevel: "high",
    labels: ["hot work", "welding/cutting"],
    patterns: [/hot work|weld|cutting|torch|grind|spark|burn/i],
    hazards: ["hot_work", "fire_watch"],
    permits: ["hot_work_permit"],
    controls: ["hot work permit", "fire watch", "combustible material removal", "extinguisher staged"],
    rationale: "Spark-producing work needs fire prevention, authorization, and post-work watch controls.",
    confidence: 0.84,
  },
  {
    id: "excavation",
    riskLevel: "critical",
    labels: ["excavation", "trenching"],
    patterns: [/excavat|trench|cut slope|shoring|utility locate|underground/i],
    hazards: ["excavation", "struck_by", "underground_utilities"],
    permits: ["excavation_permit", "utility_locate"],
    controls: ["competent person inspection", "protective system review", "utility locate verification", "spoil setback"],
    rationale: "Excavation work can combine cave-in, utility strike, and access/egress exposure.",
    confidence: 0.88,
  },
  {
    id: "confined_space",
    riskLevel: "critical",
    labels: ["confined space"],
    patterns: [/confined|vessel|tank|manhole|vault|pit|crawl space/i],
    hazards: ["confined_space", "atmospheric"],
    permits: ["confined_space_permit"],
    controls: ["entry permit", "atmospheric testing", "attendant and rescue plan", "ventilation plan"],
    rationale: "Confined spaces need entry controls, monitoring, and rescue readiness before access.",
    confidence: 0.9,
  },
  {
    id: "energized_electrical",
    riskLevel: "critical",
    labels: ["electrical", "LOTO"],
    patterns: [/electrical|energized|loto|lockout|tagout|panel|switchgear|arc flash|temporary power/i],
    hazards: ["electrical", "stored_energy"],
    permits: ["energized_electrical_or_loto"],
    controls: ["verified isolation", "test before touch", "arc-flash boundary", "qualified worker verification"],
    rationale: "Electrical and stored-energy work needs verified isolation or energized-work authorization.",
    confidence: 0.86,
  },
  {
    id: "crane_rigging",
    riskLevel: "critical",
    labels: ["crane", "rigging", "lifting"],
    patterns: [/crane|rigging|critical lift|hoist|pick|suspended load|forklift lift|telehandler/i],
    hazards: ["crane_rigging", "line_of_fire", "dropped_objects"],
    permits: ["lift_plan"],
    controls: ["lift plan", "qualified rigger", "exclusion zone", "tag line and communication plan"],
    rationale: "Lifting work can expose crews to suspended loads, line-of-fire positions, and dropped objects.",
    confidence: 0.87,
  },
  {
    id: "steel_erection",
    riskLevel: "critical",
    labels: ["steel erection", "decking"],
    patterns: [/steel|ironwork|decking|beam|column|connector|bolt-up|joist/i],
    hazards: ["steel_erection", "fall_protection", "crane_rigging"],
    permits: ["lift_plan", "elevated_work_notice"],
    controls: ["erection sequence review", "fall protection and rescue plan", "controlled decking zone review", "connection release criteria"],
    rationale: "Steel work often combines fall exposure, lifting, incomplete connections, and sequence-dependent stability.",
    confidence: 0.88,
  },
  {
    id: "demolition",
    riskLevel: "high",
    labels: ["demolition"],
    patterns: [/demolition|demo|sawcut|removal|tear out|strip out/i],
    hazards: ["demolition", "struck_by", "dust"],
    permits: ["demolition_release"],
    controls: ["utility isolation confirmation", "exclusion zone", "dust control", "debris handling plan"],
    rationale: "Demolition can uncover hidden utilities, unstable material, dust, and struck-by exposure.",
    confidence: 0.8,
  },
  {
    id: "concrete_formwork",
    riskLevel: "high",
    labels: ["concrete", "formwork"],
    patterns: [/concrete|formwork|rebar|pour|pump|slab|deck pour/i],
    hazards: ["concrete", "line_of_fire", "chemical_exposure"],
    permits: [],
    controls: ["pump hose control", "rebar cap/impalement protection", "washout plan", "pour area access control"],
    rationale: "Concrete work can create hose whip, impalement, chemical exposure, and access-control issues.",
    confidence: 0.72,
  },
  {
    id: "mobile_equipment",
    riskLevel: "high",
    labels: ["mobile equipment", "traffic"],
    patterns: [/forklift|equipment|loader|excavator|skid steer|traffic|haul|delivery|truck|logistics/i],
    hazards: ["mobile_equipment", "struck_by", "pedestrian_interface"],
    permits: ["traffic_control_plan"],
    controls: ["spotter or traffic control", "pedestrian separation", "equipment inspection", "defined travel path"],
    rationale: "Mobile equipment and deliveries need traffic separation and line-of-fire controls.",
    confidence: 0.78,
  },
];

function clean(value?: string | null) {
  return String(value ?? "").trim();
}

function cleanList(values: Array<string | null | undefined>, limit = 16) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const item = clean(value);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, limit);
}

function maxRisk(a: SchedulePredictionRiskLevel, b: SchedulePredictionRiskLevel) {
  return RISK_WEIGHT[b] > RISK_WEIGHT[a] ? b : a;
}

export function normalizeSchedulePredictionInput(input: ScheduleHazardPredictionInput) {
  const crew = input.crewSize == null || input.crewSize === "" ? null : Number(input.crewSize);
  const crewSize = typeof crew === "number" && Number.isFinite(crew) ? Math.max(0, Math.floor(crew)) : null;
  return {
    title: clean(input.title).toLowerCase(),
    trade: clean(input.trade).toLowerCase(),
    taskType: clean(input.taskType).toLowerCase(),
    workArea: clean(input.workArea).toLowerCase(),
    crewSize,
    shiftStartTime: clean(input.shiftStartTime),
    shiftEndTime: clean(input.shiftEndTime),
    notes: clean(input.notes).toLowerCase(),
  };
}

export function stableSchedulePredictionInputKey(input: ScheduleHazardPredictionInput) {
  return JSON.stringify(normalizeSchedulePredictionInput(input));
}

export function buildRuleBasedScheduleHazardPrediction(input: ScheduleHazardPredictionInput): ScheduleHazardPrediction {
  const normalized = normalizeSchedulePredictionInput(input);
  const text = [
    normalized.title,
    normalized.trade,
    normalized.taskType,
    normalized.workArea,
    normalized.notes,
  ].join(" ");
  const matches = RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(text)));
  let riskLevel: SchedulePredictionRiskLevel = matches.length > 0 ? "medium" : "low";
  let confidence = matches.length > 0 ? 0.62 : 0.48;
  const hazards: string[] = [];
  const permits: string[] = [];
  const controls: string[] = [];
  const rationale: string[] = [];
  const signals: string[] = [];

  for (const rule of matches) {
    riskLevel = maxRisk(riskLevel, rule.riskLevel);
    confidence = Math.max(confidence, rule.confidence);
    hazards.push(...rule.hazards);
    permits.push(...rule.permits);
    controls.push(...rule.controls);
    rationale.push(rule.rationale);
    signals.push(...rule.labels);
  }

  if ((normalized.crewSize ?? 0) >= 8) {
    riskLevel = maxRisk(riskLevel, "high");
    controls.push("crew coordination briefing");
    signals.push("large crew");
    rationale.push("Crew size increases coordination and communication pressure.");
    confidence = Math.max(confidence, 0.7);
  }

  if (/night|off[-\s]?hours|shutdown|weekend/.test(text)) {
    riskLevel = maxRisk(riskLevel, "high");
    controls.push("off-hours supervision plan");
    signals.push("off-hours work");
    rationale.push("Off-hours work can reduce supervision, support coverage, and response speed.");
    confidence = Math.max(confidence, 0.68);
  }

  const finalHazards = cleanList(hazards);
  const finalPermits = cleanList(permits);
  const finalControls = cleanList(controls.length ? controls : ["pre-task brief", "supervisor verification"]);
  const finalRationale = cleanList(rationale, 4).join(" ") || "No high-risk dropdown pattern matched yet; keep a supervisor review before release.";

  return {
    riskLevel,
    isHighRisk: riskLevel === "high" || riskLevel === "critical",
    hazardCategories: finalHazards,
    permitTriggers: finalPermits,
    requiredControls: finalControls,
    rationale: finalRationale,
    confidence,
    matchedSignals: cleanList(signals),
  };
}

export function mergeScheduleHazardPrediction(
  rulePrediction: ScheduleHazardPrediction,
  aiPrediction: Partial<ScheduleHazardPrediction> | null | undefined
): ScheduleHazardPrediction {
  if (!aiPrediction || typeof aiPrediction !== "object") return rulePrediction;
  const aiRisk = clean(aiPrediction.riskLevel) as SchedulePredictionRiskLevel;
  const riskLevel =
    aiRisk === "low" || aiRisk === "medium" || aiRisk === "high" || aiRisk === "critical"
      ? maxRisk(rulePrediction.riskLevel, aiRisk)
      : rulePrediction.riskLevel;
  const confidence =
    typeof aiPrediction.confidence === "number" && Number.isFinite(aiPrediction.confidence)
      ? Math.max(rulePrediction.confidence, Math.max(0, Math.min(1, aiPrediction.confidence)))
      : rulePrediction.confidence;

  return {
    riskLevel,
    isHighRisk: riskLevel === "high" || riskLevel === "critical",
    hazardCategories: cleanList([...rulePrediction.hazardCategories, ...(aiPrediction.hazardCategories ?? [])]),
    permitTriggers: cleanList([...rulePrediction.permitTriggers, ...(aiPrediction.permitTriggers ?? [])]),
    requiredControls: cleanList([...rulePrediction.requiredControls, ...(aiPrediction.requiredControls ?? [])]),
    rationale: clean(aiPrediction.rationale) || rulePrediction.rationale,
    confidence,
    matchedSignals: cleanList([...rulePrediction.matchedSignals, ...(aiPrediction.matchedSignals ?? [])]),
  };
}
