import type {
  RiskDriver,
  SafetyAiConfidence,
  SafetyAiEvidenceRef,
  SafetyAiInput,
  SafetyAiSignal,
  SafetyControlRecommendation,
  SafetyControlRecommendationBasis,
  SafetyControlType,
  SafetyRiskLevel,
} from "@/lib/safety-ai/types";

type ControlRule = {
  id: string;
  hazardFamily: string;
  keywords: RegExp;
  title: string;
  recommendedAction: string;
  controlCategory: SafetyControlType;
  verificationRequired: string;
  missingInformation: string[];
  humanApprovalReason: string;
  basis?: SafetyControlRecommendationBasis;
};

const CONTROL_RULES: ControlRule[] = [
  {
    id: "hot-work-permit",
    hazardFamily: "hot_work",
    keywords: /\b(hot work|grind|grinding|weld|welding|cutting|torch|spark|fire watch)\b/i,
    title: "Verify hot work permit and fire controls",
    recommendedAction: "Require or verify an active hot work permit, fire watch, extinguisher, and combustible-material control before grinding, welding, cutting, or spark-producing work starts.",
    controlCategory: "administrative",
    verificationRequired: "Confirm permit status, fire watch assignment, extinguisher location, and combustible clearance at the work face.",
    missingInformation: ["active hot work permit", "fire watch assignment", "combustible-material clearance"],
    humanApprovalReason: "Hot work requires human permit and fire-control verification before work proceeds.",
    basis: "platform_rule",
  },
  {
    id: "excavation-competent-person",
    hazardFamily: "excavation_trenching",
    keywords: /\b(excavat|trench|shoring|trench box|bench|slope|cave[- ]?in)\b/i,
    title: "Verify competent-person excavation inspection",
    recommendedAction: "Verify competent-person inspection, protective system, access/egress, spoil placement, and changing-condition review before trench or excavation entry.",
    controlCategory: "competent_person_review",
    verificationRequired: "Document competent-person inspection and protective-system readiness before entry.",
    missingInformation: ["competent-person inspection", "protective system", "safe access or egress"],
    humanApprovalReason: "Excavation or trench entry needs competent-person verification before workers enter.",
    basis: "platform_rule",
  },
  {
    id: "fall-protection-plan",
    hazardFamily: "fall_exposure",
    keywords: /\b(fall|height|elevated|roof|leading edge|open edge|mewp|aerial lift|scaffold|ladder)\b/i,
    title: "Review fall protection and rescue readiness",
    recommendedAction: "Review the fall protection plan, anchor/tie-off method, rescue readiness, and access controls before elevated work starts.",
    controlCategory: "engineering",
    verificationRequired: "Verify guardrail, anchor, tie-off, scaffold/MEWP inspection, and rescue plan readiness at the work area.",
    missingInformation: ["fall protection plan", "anchor or guardrail verification", "rescue plan"],
    humanApprovalReason: "Elevated work needs human verification of fall prevention and rescue controls before work proceeds.",
    basis: "platform_rule",
  },
  {
    id: "energized-loto",
    hazardFamily: "energized_electrical",
    keywords: /\b(energized|electrical|temporary power|loto|lockout|tagout|arc flash|breaker|panel|zero energy)\b/i,
    title: "Confirm LOTO or energized-work controls",
    recommendedAction: "Confirm LOTO steps, zero-energy verification, qualified-worker assignment, and barricades before energized or electrical work proceeds.",
    controlCategory: "administrative",
    verificationRequired: "Verify de-energization/LOTO records, test-before-touch steps, qualified worker status, and arc-flash boundary controls.",
    missingInformation: ["LOTO steps", "zero-energy verification", "qualified-worker assignment"],
    humanApprovalReason: "Energy-control work needs qualified human review before affected work proceeds.",
    basis: "platform_rule",
  },
  {
    id: "mobile-equipment-separation",
    hazardFamily: "mobile_equipment",
    keywords: /\b(forklift|telehandler|loader|skid steer|backing|spotter|traffic|equipment movement|haul road|struck[- ]?by)\b/i,
    title: "Set equipment movement separation controls",
    recommendedAction: "Require a spotter or barricaded exclusion zone, defined route, and pedestrian separation before equipment movement affects workers or shared access.",
    controlCategory: "engineering",
    verificationRequired: "Verify spotter role, communication method, barricades, route control, and pedestrian separation.",
    missingInformation: ["spotter assignment", "equipment route", "pedestrian separation"],
    humanApprovalReason: "Equipment movement near people needs supervisor verification of separation controls before work proceeds.",
    basis: "general_best_practice",
  },
  {
    id: "weather-sensitive-work",
    hazardFamily: "weather_exposure",
    keywords: /\b(wind|gust|lightning|thunderstorm|heat|rain|storm|flood|weather|tornado|hail)\b/i,
    title: "Send weather risk alert and verify thresholds",
    recommendedAction: "Send a weather alert to affected supervisors and verify wind, lightning, heat, rain, or storm thresholds against the planned work before start.",
    controlCategory: "administrative",
    verificationRequired: "Confirm weather threshold, affected crews, task pause criteria, hydration/shelter needs, and communication path.",
    missingInformation: ["weather threshold", "affected crews", "pause or shelter criteria"],
    humanApprovalReason: "Weather-sensitive high-risk work needs human review against jobsite thresholds before work proceeds.",
    basis: "general_best_practice",
  },
];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeText(...values: unknown[]) {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => String(value ?? ""))
    .join(" ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: Array<string | null | undefined>, limit = 10) {
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

function evidenceFromSignals(signals: SafetyAiSignal[]): SafetyAiEvidenceRef[] {
  return signals.slice(0, 6).map((signal, index) => ({
    id: `${signal.type}-${signal.id ?? index}`,
    sourceModule: signal.type,
    sourceId: signal.id ?? signal.label ?? `${index}`,
    label: signal.label || signal.hazard || signal.type.replace(/_/g, " "),
    href: null,
    detail: signal.hazard ?? signal.status ?? null,
  }));
}

function confidenceFor(params: {
  explicit?: SafetyAiConfidence | null;
  evidenceRefs: SafetyAiEvidenceRef[];
  missingInformation: string[];
  level: SafetyRiskLevel;
}) {
  if (params.explicit) return params.explicit;
  if (params.evidenceRefs.length >= 2 && params.missingInformation.length <= 1) return "high";
  if (params.evidenceRefs.length > 0 || params.level === "high" || params.level === "critical") return "medium";
  return "low";
}

function ruleBasisFromEvidence(rule: ControlRule, evidenceRefs: SafetyAiEvidenceRef[]): SafetyControlRecommendationBasis {
  if (evidenceRefs.some((ref) => ref.sourceModule === "company_memory_items")) return "uploaded_document";
  if (evidenceRefs.some((ref) => /jobsite rule/i.test(`${ref.label} ${ref.detail ?? ""}`))) return "jobsite_rule";
  if (evidenceRefs.some((ref) => /company rule|policy/i.test(`${ref.label} ${ref.detail ?? ""}`))) return "company_policy";
  return rule.basis ?? "general_best_practice";
}

function hasReadinessGap(input: SafetyAiInput, signals: SafetyAiSignal[]) {
  return Boolean(
    input.missingRequiredPermit ||
      input.missingRequiredTraining ||
      input.missingCompetentPersonReview ||
      signals.some((signal) =>
        Boolean(signal.missingRequiredPermit || signal.missingRequiredTraining || signal.missingCompetentPersonReview)
      )
  );
}

export function buildSafetyControlRecommendations(params: {
  input: SafetyAiInput;
  level: SafetyRiskLevel;
  drivers?: RiskDriver[];
  signals?: SafetyAiSignal[];
  evidenceRefs?: SafetyAiEvidenceRef[];
  missingInformation?: string[];
  confidence?: SafetyAiConfidence;
}): SafetyControlRecommendation[] {
  const signals = params.signals ?? params.input.signals ?? [];
  const evidenceRefs = params.evidenceRefs?.length ? params.evidenceRefs : evidenceFromSignals(signals);
  const text = normalizeText(
    params.input.taskType,
    params.input.trade,
    params.input.location,
    params.input.equipment,
    params.input.highRiskWorkCategories,
    params.input.observedControls,
    signals.map((signal) => [signal.label, signal.hazard, signal.task, signal.trade, signal.controls, signal.controlEvidence]),
    params.drivers?.map((driver) => [driver.label, driver.explanation])
  );
  const highOrCritical = params.level === "high" || params.level === "critical";
  const approvalRequired = highOrCritical || hasReadinessGap(params.input, signals) || Boolean(params.input.imminentDanger);

  const recommendations = CONTROL_RULES.filter((rule) => rule.keywords.test(text)).map((rule) => {
    const missingInformation = unique([
      ...(params.missingInformation ?? []),
      ...rule.missingInformation.filter((item) => !text.toLowerCase().includes(item.toLowerCase())),
    ], 8);
    const humanApprovalRequired = approvalRequired || rule.controlCategory === "competent_person_review";
    const humanApprovalReason = humanApprovalRequired
      ? rule.humanApprovalReason
      : null;
    return {
      title: rule.title,
      recommendedAction: rule.recommendedAction,
      hazardFamily: rule.hazardFamily,
      controlCategory: rule.controlCategory,
      basis: ruleBasisFromEvidence(rule, evidenceRefs),
      evidenceRefs,
      missingInformation,
      verificationRequired: rule.verificationRequired,
      humanApprovalRequired,
      humanApprovalReason,
      confidence: confidenceFor({
        explicit: params.confidence,
        evidenceRefs,
        missingInformation,
        level: params.level,
      }),
    } satisfies SafetyControlRecommendation;
  });

  if (recommendations.length === 0 && highOrCritical) {
    recommendations.push({
      title: "Verify task-specific critical controls",
      recommendedAction: "Review the high-risk task with the supervisor or competent person and verify task-specific controls before work proceeds.",
      hazardFamily: "unclassified_high_risk_work",
      controlCategory: "competent_person_review",
      basis: evidenceRefs.length > 0 ? "platform_rule" : "unknown",
      evidenceRefs,
      missingInformation: unique([...(params.missingInformation ?? []), "task-specific critical controls"], 8),
      verificationRequired: "Document the controls, owner, and field verification step before treating the work as controlled.",
      humanApprovalRequired: true,
      humanApprovalReason: "High or critical AI Engine risk requires supervisor, safety-manager, or competent-person review before risk is treated as controlled.",
      confidence: confidenceFor({
        explicit: params.confidence,
        evidenceRefs,
        missingInformation: params.missingInformation ?? [],
        level: params.level,
      }),
    });
  }

  const seen = new Set<string>();
  return recommendations.filter((recommendation) => {
    const key = `${recommendation.hazardFamily}:${recommendation.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}
