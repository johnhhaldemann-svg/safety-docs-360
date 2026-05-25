import type { AiSafetyUnifiedContext, AiSafetyUnifiedEvidence } from "@/lib/aiSafetyUnifiedContext";
import type { SafetyAiConfidence, SafetyControlType, SafetyRiskLevel } from "@/lib/safety-ai/types";

export type SafetyDomainBasis =
  | "platform_rule"
  | "company_or_jobsite_memory"
  | "safety_intelligence"
  | "predictive_evidence"
  | "field_evidence";

export type SafetyDomainConcept = {
  id: string;
  label: string;
  discipline: string;
  riskLevel: SafetyRiskLevel;
  confidence: SafetyAiConfidence;
  whyItMatters: string;
  permitOrPlanTriggers: string[];
  competencySignals: string[];
  criticalControls: string[];
  hierarchyCoverage: SafetyControlType[];
  verificationQuestions: string[];
  basis: SafetyDomainBasis[];
  evidenceIds: string[];
  missingInformation: string[];
};

export type SafetyDomainUnderstanding = {
  generatedAt: string;
  headline: string;
  concepts: SafetyDomainConcept[];
  recognizedDisciplines: string[];
  controlHierarchyGaps: string[];
  permitAndPlanFocus: string[];
  competencyFocus: string[];
  fieldVerificationQuestions: string[];
  missingInformation: string[];
  confidence: SafetyAiConfidence;
  doNotClaim: string[];
};

type DomainRule = {
  id: string;
  label: string;
  discipline: string;
  keywords: RegExp;
  baseRisk: SafetyRiskLevel;
  whyItMatters: string;
  permitOrPlanTriggers: string[];
  competencySignals: string[];
  criticalControls: string[];
  hierarchyCoverage: SafetyControlType[];
  verificationQuestions: string[];
};

const DOMAIN_RULES: DomainRule[] = [
  {
    id: "fall_protection",
    label: "Fall protection and elevated work",
    discipline: "fall_protection",
    keywords: /\b(fall|height|roof|leading edge|open edge|scaffold|ladder|mewp|aerial lift|anchor|tie off|guardrail)\b/i,
    baseRisk: "high",
    whyItMatters: "Falls are high-consequence exposures; prevention, rescue readiness, and dropped-object controls need field verification.",
    permitOrPlanTriggers: ["fall protection plan", "scaffold or MEWP inspection", "rescue plan"],
    competencySignals: ["competent person for scaffold/working surface review", "trained authorized user for fall protection equipment"],
    criticalControls: ["guardrails or verified tie-off", "anchorage method", "rescue plan", "exclusion zone below"],
    hierarchyCoverage: ["engineering", "administrative", "ppe"],
    verificationQuestions: [
      "What prevents a worker from reaching the fall edge?",
      "Who verified anchorage, scaffold, ladder, or MEWP condition today?",
      "How would rescue be performed if a fall occurs?",
    ],
  },
  {
    id: "excavation_trenching",
    label: "Excavation, trenching, and ground disturbance",
    discipline: "excavation",
    keywords: /\b(excavat|trench|dig|shoring|trench box|bench|slope|cave in|cave-in|utility locate|spoils)\b/i,
    baseRisk: "critical",
    whyItMatters: "Excavation can change quickly; cave-in, utility strike, water, access, and atmospheric conditions require competent-person review.",
    permitOrPlanTriggers: ["excavation permit", "utility locate", "protective-system plan"],
    competencySignals: ["competent person inspection before entry and after changing conditions"],
    criticalControls: ["protective system", "safe access or egress", "spoil setback", "utility isolation/locate", "water control"],
    hierarchyCoverage: ["engineering", "administrative", "competent_person_review"],
    verificationQuestions: [
      "Has the competent person inspected the excavation today?",
      "What protective system is being used and does it match the soil/depth condition?",
      "Are utilities located, exposed, isolated, or otherwise controlled?",
    ],
  },
  {
    id: "energized_electrical_loto",
    label: "Electrical energy and LOTO",
    discipline: "electrical_energy_control",
    keywords: /\b(energized|electrical|temporary power|loto|lockout|tagout|arc flash|breaker|panel|zero energy|test before touch)\b/i,
    baseRisk: "critical",
    whyItMatters: "Energy-control failures can create fatal shock, arc-flash, or unexpected-startup exposure.",
    permitOrPlanTriggers: ["energized electrical permit or task authorization", "LOTO plan", "arc-flash boundary plan"],
    competencySignals: ["qualified electrical worker", "authorized LOTO employee"],
    criticalControls: ["de-energization where feasible", "LOTO verification", "test before touch", "arc-flash boundary", "barricades"],
    hierarchyCoverage: ["elimination", "administrative", "ppe"],
    verificationQuestions: [
      "Can the work be de-energized before proceeding?",
      "Who verified zero energy and how was it documented?",
      "Are qualified-worker status, boundaries, and PPE matched to the task?",
    ],
  },
  {
    id: "hot_work_fire",
    label: "Hot work and fire prevention",
    discipline: "hot_work_fire_prevention",
    keywords: /\b(hot work|weld|welding|grind|grinding|cutting|torch|spark|fire watch|flammable|combustible)\b/i,
    baseRisk: "high",
    whyItMatters: "Spark-producing work can ignite hidden or nearby combustibles; controls must be verified at the work face.",
    permitOrPlanTriggers: ["hot work permit", "fire watch assignment"],
    competencySignals: ["supervisor or permit issuer review", "fire watch briefed on duties"],
    criticalControls: ["combustible clearance", "extinguisher readiness", "spark containment", "fire watch", "post-work fire check"],
    hierarchyCoverage: ["engineering", "administrative"],
    verificationQuestions: [
      "What combustibles are inside the spark path or adjacent spaces?",
      "Who is assigned as fire watch and when does post-work monitoring end?",
      "Where is the extinguisher and is it appropriate for the exposure?",
    ],
  },
  {
    id: "mobile_equipment",
    label: "Mobile equipment and line-of-fire exposure",
    discipline: "mobile_equipment_line_of_fire",
    keywords: /\b(forklift|telehandler|loader|skid steer|backing|spotter|equipment movement|haul road|struck by|line of fire|pedestrian)\b/i,
    baseRisk: "high",
    whyItMatters: "Equipment and people sharing space creates struck-by and caught-between exposure unless separation is actively controlled.",
    permitOrPlanTriggers: ["traffic control plan", "lift or movement plan when applicable"],
    competencySignals: ["equipment operator authorization", "spotter briefing"],
    criticalControls: ["pedestrian separation", "exclusion zone", "spotter or signal method", "defined route", "barricades"],
    hierarchyCoverage: ["engineering", "administrative"],
    verificationQuestions: [
      "How are workers physically separated from the equipment route?",
      "Who is the spotter and what communication method is being used?",
      "Are backing, blind spots, public access, and shared routes controlled?",
    ],
  },
  {
    id: "crane_rigging",
    label: "Crane, rigging, and suspended loads",
    discipline: "lifting_rigging",
    keywords: /\b(crane|rigging|critical lift|suspended load|hoist|tag line|signal person|rigger|load chart)\b/i,
    baseRisk: "critical",
    whyItMatters: "Lifting operations can expose crews to dropped loads, line-of-fire, equipment instability, and weather-sensitive conditions.",
    permitOrPlanTriggers: ["lift plan", "critical lift review when applicable"],
    competencySignals: ["qualified rigger", "signal person", "operator authorization"],
    criticalControls: ["lift plan", "load chart review", "rigging inspection", "exclusion zone", "weather threshold"],
    hierarchyCoverage: ["engineering", "administrative", "competent_person_review"],
    verificationQuestions: [
      "Has the lift plan been reviewed against load, radius, ground, and weather conditions?",
      "Who is the qualified rigger or signal person?",
      "How is the suspended-load exclusion zone controlled?",
    ],
  },
  {
    id: "weather_exposure",
    label: "Weather-sensitive work",
    discipline: "weather_exposure",
    keywords: /\b(wind|gust|lightning|thunderstorm|heat|rain|storm|flood|weather|hail)\b/i,
    baseRisk: "high",
    whyItMatters: "Weather can change the risk profile for elevated work, lifting, excavation, electrical work, hot work, and heat exposure.",
    permitOrPlanTriggers: ["weather threshold or pause criteria", "heat illness prevention plan when applicable"],
    competencySignals: ["supervisor review of task-specific weather limits"],
    criticalControls: ["wind/lightning/heat/rain thresholds", "shelter or hydration plan", "communication path", "pause criteria"],
    hierarchyCoverage: ["administrative", "substitution"],
    verificationQuestions: [
      "What weather threshold stops or changes the task?",
      "Who is monitoring changes and how will crews be notified?",
      "Does weather affect access, ground stability, electrical exposure, or heat stress?",
    ],
  },
  {
    id: "confined_space",
    label: "Confined space and atmospheric hazards",
    discipline: "confined_space",
    keywords: /\b(confined space|permit space|tank|vessel|manhole|atmosphere|oxygen|entrant|attendant|air monitor)\b/i,
    baseRisk: "critical",
    whyItMatters: "Confined spaces can create atmospheric, engulfment, configuration, and rescue hazards that require strict pre-entry controls.",
    permitOrPlanTriggers: ["confined space entry permit", "rescue plan"],
    competencySignals: ["entrant/attendant/supervisor roles verified"],
    criticalControls: ["atmospheric testing", "ventilation", "attendant", "retrieval or rescue plan", "entry permit"],
    hierarchyCoverage: ["engineering", "administrative", "competent_person_review"],
    verificationQuestions: [
      "Is this a permit-required confined space?",
      "What atmospheric testing and ventilation are documented?",
      "Who is the attendant and what rescue method is ready?",
    ],
  },
];

const DO_NOT_CLAIM = [
  "Do not approve work, permits, or safety-critical actions.",
  "Do not declare final compliance.",
  "Do not provide legal advice.",
  "Do not replace competent-person, supervisor, or safety-manager judgment.",
];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function unique(values: Array<string | null | undefined>, limit = 12) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const item = clean(value);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function evidenceText(evidence: AiSafetyUnifiedEvidence[]) {
  return evidence
    .map((item) => [item.label, item.detail, item.trade, item.area, item.riskLevel].filter(Boolean).join(" "))
    .join(" ");
}

function basisForEvidence(evidence: AiSafetyUnifiedEvidence[]): SafetyDomainBasis[] {
  return unique(
    evidence.map((item) => {
      if (item.sourceSystem === "risk_memory") return "company_or_jobsite_memory";
      if (item.sourceSystem === "safety_intelligence") return "safety_intelligence";
      if (item.sourceSystem === "gus_photo_review") return "field_evidence";
      if (item.sourceSystem === "predictive_risk") return "predictive_evidence";
      return "platform_rule";
    }),
    5,
  ) as SafetyDomainBasis[];
}

function rank(level: SafetyRiskLevel) {
  if (level === "critical") return 4;
  if (level === "high") return 3;
  if (level === "moderate") return 2;
  return 1;
}

function maxRisk(levels: SafetyRiskLevel[]) {
  return levels.reduce<SafetyRiskLevel>((max, level) => (rank(level) > rank(max) ? level : max), "low");
}

function confidenceFor(matchCount: number, missingCount: number, hasCrossSourceEvidence: boolean): SafetyAiConfidence {
  if (missingCount >= 4 || matchCount === 0) return "low";
  if (hasCrossSourceEvidence && missingCount <= 1) return "high";
  return "medium";
}

export function buildSafetyDomainUnderstanding(params: {
  unifiedContext: AiSafetyUnifiedContext;
  now?: Date;
}): SafetyDomainUnderstanding {
  const text = evidenceText(params.unifiedContext.evidence);
  const concepts = DOMAIN_RULES.flatMap((rule): SafetyDomainConcept[] => {
    if (!rule.keywords.test(text)) return [];
    const evidence = params.unifiedContext.evidence.filter((item) =>
      rule.keywords.test([item.label, item.detail, item.trade, item.area].filter(Boolean).join(" "))
    );
    const missingInformation = unique([
      ...params.unifiedContext.missingInformation.filter((item) => rule.keywords.test(item)),
      ...rule.permitOrPlanTriggers.filter((item) => !new RegExp(item.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i").test(text)),
      ...rule.competencySignals.filter((item) => !/competent|qualified|authorized|supervisor|spotter|fire watch|attendant/i.test(text) && item),
    ], 8);
    const sources = new Set(evidence.map((item) => item.sourceSystem));
    const riskLevel = maxRisk([rule.baseRisk, ...evidence.flatMap((item) => (item.riskLevel === "unknown" ? [] : [item.riskLevel]))]);
    return [{
      id: rule.id,
      label: rule.label,
      discipline: rule.discipline,
      riskLevel,
      confidence: confidenceFor(evidence.length, missingInformation.length, sources.size >= 2),
      whyItMatters: rule.whyItMatters,
      permitOrPlanTriggers: rule.permitOrPlanTriggers,
      competencySignals: rule.competencySignals,
      criticalControls: rule.criticalControls,
      hierarchyCoverage: rule.hierarchyCoverage,
      verificationQuestions: rule.verificationQuestions,
      basis: unique(["platform_rule", ...basisForEvidence(evidence)], 5) as SafetyDomainBasis[],
      evidenceIds: evidence.map((item) => item.id).slice(0, 8),
      missingInformation,
    }];
  }).sort((a, b) => rank(b.riskLevel) - rank(a.riskLevel));

  const coveredControls = new Set(concepts.flatMap((concept) => concept.hierarchyCoverage));
  const controlHierarchyGaps = unique([
    !coveredControls.has("elimination") ? "Consider whether exposure can be removed or work resequenced before relying on administrative controls or PPE." : null,
    !coveredControls.has("engineering") ? "Verify physical/engineering controls, not only paperwork or PPE." : null,
    !coveredControls.has("competent_person_review") && concepts.some((concept) => concept.riskLevel === "critical")
      ? "Critical work should identify the competent person, qualified worker, or safety manager responsible for review."
      : null,
    !coveredControls.has("ppe") ? "Confirm task-specific PPE as the final layer of defense." : null,
  ], 6);
  const missingInformation = unique([
    ...params.unifiedContext.missingInformation,
    ...concepts.flatMap((concept) => concept.missingInformation.slice(0, 2)),
    ...(concepts.length === 0 ? ["No safety-domain concept was confidently recognized from the loaded evidence."] : []),
  ], 14);
  const fieldVerificationQuestions = unique(concepts.flatMap((concept) => concept.verificationQuestions), 10);
  const confidence = confidenceFor(
    concepts.length,
    missingInformation.length,
    params.unifiedContext.sourceCoverage.filter((item) => item.status === "available").length >= 3,
  );

  return {
    generatedAt: params.now?.toISOString() ?? params.unifiedContext.generatedAt,
    headline: concepts.length
      ? `Recognized ${concepts.length} safety discipline${concepts.length === 1 ? "" : "s"} needing field understanding.`
      : "Safety-domain understanding needs more task, hazard, and control evidence.",
    concepts: concepts.slice(0, 8),
    recognizedDisciplines: unique(concepts.map((concept) => concept.discipline), 8),
    controlHierarchyGaps,
    permitAndPlanFocus: unique(concepts.flatMap((concept) => concept.permitOrPlanTriggers), 10),
    competencyFocus: unique(concepts.flatMap((concept) => concept.competencySignals), 10),
    fieldVerificationQuestions,
    missingInformation,
    confidence,
    doNotClaim: DO_NOT_CLAIM,
  };
}
