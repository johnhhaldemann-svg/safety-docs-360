import type {
  DailyRiskBriefing,
  PredictiveSafetyEvidenceRef,
  PredictiveSafetyReadinessBlocker,
  PredictiveSafetyWeatherAlertRow,
  PredictiveSafetyWorkItem,
} from "@/lib/predictiveSafetyEngine";
import type {
  PredictiveRiskCorrectiveActionRow,
  PredictiveRiskIncidentRow,
} from "@/lib/predictiveRisk";
import type { BehaviorRiskObservationRow } from "@/lib/predictive/behaviorRisk";
import type { SafetyAiConfidence, SafetyRiskLevel } from "@/lib/safety-ai/types";

export type AiSafetyConflictType =
  | "readiness_conflict"
  | "adjacent_work_conflict"
  | "weather_task_conflict"
  | "open_action_conflict"
  | "repeated_pattern_conflict";

export type AiSafetyConflictFinding = {
  id: string;
  type: AiSafetyConflictType;
  riskLevel: SafetyRiskLevel;
  confidence: SafetyAiConfidence;
  title: string;
  reason: string;
  dataUsed: string[];
  missingInformation: string[];
  recommendedAction: string;
  requiredVerification: string;
  humanApprovalRequired: boolean;
  humanApprovalReason: string | null;
  evidenceRefs: PredictiveSafetyEvidenceRef[];
  affectedWorkItemIds: string[];
  jobsiteId: string | null;
  jobsiteName: string | null;
  trade: string | null;
  area: string | null;
  sourceKey: string;
};

export type AiSafetyConflictMap = {
  generatedAt: string;
  summary: string;
  findings: AiSafetyConflictFinding[];
  highConflictCount: number;
  criticalConflictCount: number;
  missingData: string[];
  confidence: SafetyAiConfidence;
};

export type BuildAiSafetyConflictMapInput = {
  dailyBriefing: DailyRiskBriefing;
  correctiveActions?: PredictiveRiskCorrectiveActionRow[];
  incidents?: PredictiveRiskIncidentRow[];
  observations?: BehaviorRiskObservationRow[];
  weatherAlerts?: PredictiveSafetyWeatherAlertRow[];
  now?: Date;
};

const RISK_RANK: Record<SafetyRiskLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

const ADJACENCY_RULES: Array<{
  id: string;
  left: RegExp;
  right: RegExp;
  title: string;
  reason: string;
  verification: string;
}> = [
  {
    id: "hot-work-flammable",
    left: /\b(hot work|grind|weld|cutting|torch|spark|fire watch)\b/i,
    right: /\b(flammable|combustible|fuel|solvent|paint|chemical|storage|material)\b/i,
    title: "Hot work overlaps combustible or flammable exposure",
    reason: "Spark-producing work is planned near material or chemical exposure signals.",
    verification: "Verify hot work permit, fire watch, extinguisher, and combustible-material clearance before work proceeds.",
  },
  {
    id: "equipment-pedestrian",
    left: /\b(forklift|telehandler|loader|skid steer|equipment movement|backing|haul road|struck by)\b/i,
    right: /\b(access|pedestrian|walkway|egress|traffic|public|crew|layout|survey)\b/i,
    title: "Equipment movement overlaps pedestrian or shared-access work",
    reason: "Mobile equipment and people or shared access appear in the same work window.",
    verification: "Verify route control, spotter assignment, barricades, and pedestrian separation before movement starts.",
  },
  {
    id: "excavation-utility-electrical",
    left: /\b(excavat|trench|dig|shoring|trench box)\b/i,
    right: /\b(utility|electrical|energized|temporary power|gas|line|underground)\b/i,
    title: "Excavation overlaps utility or electrical exposure",
    reason: "Excavation/trenching work overlaps utility, electrical, or line-exposure signals.",
    verification: "Verify utility locate, competent-person inspection, protective system, and isolation controls before entry or digging.",
  },
  {
    id: "elevated-over-access",
    left: /\b(roof|elevated|scaffold|ladder|mewp|aerial lift|leading edge|fall)\b/i,
    right: /\b(access|walkway|egress|traffic|equipment movement|haul|public|below)\b/i,
    title: "Elevated work overlaps active access below",
    reason: "Elevated work and active access or movement below appear in the same work window.",
    verification: "Verify fall protection, dropped-object controls, exclusion zone, and rescue readiness before work proceeds.",
  },
];

function clean(value: unknown, fallback = "") {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function normalize(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: Array<string | null | undefined>, limit = 8) {
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

function riskMax(a: SafetyRiskLevel, b: SafetyRiskLevel): SafetyRiskLevel {
  return RISK_RANK[b] > RISK_RANK[a] ? b : a;
}

function riskFromText(value: unknown, fallback: SafetyRiskLevel): SafetyRiskLevel {
  const text = normalize(value);
  if (text.includes("critical") || text.includes("severe") || text.includes("stop work") || text.includes("sif")) return "critical";
  if (text.includes("high") || text.includes("major")) return "high";
  if (text.includes("moderate") || text.includes("medium")) return "moderate";
  if (text.includes("low") || text.includes("minor")) return "low";
  return fallback;
}

function workText(work: PredictiveSafetyWorkItem) {
  return normalize([
    work.title,
    work.trade,
    work.area,
    work.drivers.join(" "),
    work.controlsToVerify.join(" "),
    work.blockers.map((blocker) => `${blocker.label} ${blocker.detail}`).join(" "),
    work.recommendedControls.map((control) => `${control.title} ${control.hazardFamily} ${control.recommendedAction}`).join(" "),
  ].join(" "));
}

function sameWorkWindow(a: PredictiveSafetyWorkItem, b: PredictiveSafetyWorkItem) {
  if (!a.jobsiteId || !b.jobsiteId || a.jobsiteId !== b.jobsiteId) return false;
  if (a.date && b.date && a.date !== b.date) return false;
  const aArea = normalize(a.area);
  const bArea = normalize(b.area);
  if (aArea && bArea) return aArea === bArea;
  const aTrade = normalize(a.trade);
  const bTrade = normalize(b.trade);
  return Boolean(aTrade && bTrade && aTrade === bTrade) || !aArea || !bArea;
}

function confidenceFor(missingInformation: string[], evidenceRefs: PredictiveSafetyEvidenceRef[], weakScope = false): SafetyAiConfidence {
  if (weakScope || missingInformation.length >= 2) return "low";
  if (evidenceRefs.length >= 3 && missingInformation.length === 0) return "high";
  return "medium";
}

function finding(params: Omit<AiSafetyConflictFinding, "id" | "sourceKey"> & { sourceKey: string }): AiSafetyConflictFinding {
  const sourceKey = params.sourceKey;
  return {
    ...params,
    id: `conflict-${normalize(sourceKey).replace(/\s+/g, "-").slice(0, 96)}`,
    sourceKey,
  };
}

function readinessFindings(work: PredictiveSafetyWorkItem[]): AiSafetyConflictFinding[] {
  const findings: AiSafetyConflictFinding[] = [];
  for (const item of work) {
    const blockers = item.blockers.filter((blocker) =>
      ["permit", "training", "competent_person", "control"].includes(blocker.type)
    );
    if (blockers.length === 0 || RISK_RANK[item.riskLevel] < RISK_RANK.high) continue;
    const riskLevel = blockers.reduce((level, blocker) => riskMax(level, blocker.severity), item.riskLevel);
    const evidenceRefs = uniqueRefs([...item.evidenceRefs, ...blockers.flatMap((blocker) => blocker.evidenceRefs)], 8);
    const missingInformation = unique([
      ...item.scoreExplanation.missingInformation,
      ...blockers.flatMap((blocker) => missingForBlocker(blocker)),
    ], 6);
    findings.push(finding({
      type: "readiness_conflict",
      riskLevel,
      confidence: confidenceFor(missingInformation, evidenceRefs),
      title: `Readiness conflict before ${item.title}`,
      reason: `${item.title} is ${item.riskLevel} risk and has unresolved readiness blockers before work starts.`,
      dataUsed: unique([item.title, ...blockers.map((blocker) => blocker.label)], 6),
      missingInformation,
      recommendedAction: "Assign human review and verify the missing readiness items before work proceeds.",
      requiredVerification: "Confirm required permits, training, competent-person review, and critical controls are documented and verified in the field.",
      humanApprovalRequired: true,
      humanApprovalReason: "High or critical work with missing readiness items requires safety-manager, supervisor, or competent-person review before work proceeds.",
      evidenceRefs,
      affectedWorkItemIds: [item.id],
      jobsiteId: item.jobsiteId,
      jobsiteName: item.jobsiteName,
      trade: item.trade,
      area: item.area,
      sourceKey: `readiness:${item.jobsiteId ?? "jobsite"}:${item.id}:${blockers.map((blocker) => blocker.type).sort().join("-")}`,
    }));
  }
  return findings;
}

function adjacentFindings(work: PredictiveSafetyWorkItem[]): AiSafetyConflictFinding[] {
  const findings: AiSafetyConflictFinding[] = [];
  for (let i = 0; i < work.length; i += 1) {
    for (let j = i + 1; j < work.length; j += 1) {
      const left = work[i];
      const right = work[j];
      if (!sameWorkWindow(left, right)) continue;
      const leftText = workText(left);
      const rightText = workText(right);
      const rule = ADJACENCY_RULES.find((candidate) =>
        (candidate.left.test(leftText) && candidate.right.test(rightText)) ||
        (candidate.left.test(rightText) && candidate.right.test(leftText))
      );
      if (!rule) continue;
      const weakScope = !normalize(left.area) || !normalize(right.area);
      const missingInformation = unique([
        weakScope ? "exact work area overlap" : null,
        !left.date || !right.date ? "exact work date overlap" : null,
        !left.trade || !right.trade ? "trade or crew ownership" : null,
      ], 4);
      const evidenceRefs = uniqueRefs([...left.evidenceRefs, ...right.evidenceRefs], 8);
      const riskLevel = left.riskLevel === "critical" || right.riskLevel === "critical" ? "critical" : "high";
      findings.push(finding({
        type: "adjacent_work_conflict",
        riskLevel,
        confidence: confidenceFor(missingInformation, evidenceRefs, weakScope),
        title: rule.title,
        reason: `${rule.reason} Affected work: ${left.title} and ${right.title}.`,
        dataUsed: unique([left.title, right.title, left.area, right.area, left.trade, right.trade], 8),
        missingInformation,
        recommendedAction: "Review the work sequence, separate the exposures, and verify the listed controls before either task proceeds in the shared workface.",
        requiredVerification: rule.verification,
        humanApprovalRequired: true,
        humanApprovalReason: "Potentially incompatible work in the same workface requires supervisor or safety-manager review before work proceeds.",
        evidenceRefs,
        affectedWorkItemIds: [left.id, right.id],
        jobsiteId: left.jobsiteId,
        jobsiteName: left.jobsiteName,
        trade: left.trade ?? right.trade,
        area: left.area ?? right.area,
        sourceKey: `adjacent:${rule.id}:${left.jobsiteId ?? "jobsite"}:${left.date ?? "date"}:${left.id}:${right.id}`,
      }));
    }
  }
  return findings;
}

function weatherFindings(work: PredictiveSafetyWorkItem[], alerts: PredictiveSafetyWeatherAlertRow[] = []): AiSafetyConflictFinding[] {
  const findings: AiSafetyConflictFinding[] = [];
  for (const item of work) {
    const weatherBlockers = item.blockers.filter((blocker) => blocker.type === "weather");
    if (weatherBlockers.length === 0) continue;
    const affectedByTask = /\b(wind|lightning|rain|heat|storm|crane|rigging|roof|scaffold|excavat|trench|electrical|hot work|equipment)\b/i.test(workText(item));
    const matchingAlerts = alerts.filter((alert) => !alert.jobsite_id || !item.jobsiteId || alert.jobsite_id === item.jobsiteId).slice(0, 2);
    const evidenceRefs = uniqueRefs([...item.evidenceRefs, ...weatherBlockers.flatMap((blocker) => blocker.evidenceRefs)], 8);
    const initialRiskLevel: SafetyRiskLevel = affectedByTask && item.riskLevel === "critical" ? "critical" : "high";
    const riskLevel = weatherBlockers.reduce<SafetyRiskLevel>((level, blocker) => riskMax(level, blocker.severity), initialRiskLevel);
    const missingInformation = unique([
      ...weatherBlockers.flatMap((blocker) => missingForBlocker(blocker)),
      matchingAlerts.length === 0 ? "current weather alert threshold" : null,
      !affectedByTask ? "task-specific weather sensitivity" : null,
    ], 6);
    findings.push(finding({
      type: "weather_task_conflict",
      riskLevel,
      confidence: confidenceFor(missingInformation, evidenceRefs, !affectedByTask),
      title: `Weather-sensitive work conflict - ${item.title}`,
      reason: `Weather alert signals overlap with ${item.title}; thresholds should be checked against the planned task before start.`,
      dataUsed: unique([item.title, ...weatherBlockers.map((blocker) => blocker.label), ...matchingAlerts.map((alert) => alert.headline ?? alert.event_name)], 8),
      missingInformation,
      recommendedAction: "Send or review the weather alert with affected supervisors and verify pause, shelter, wind, lightning, heat, or rain criteria before work proceeds.",
      requiredVerification: "Confirm current weather threshold, affected crews, pause criteria, communication path, and task-specific controls.",
      humanApprovalRequired: true,
      humanApprovalReason: "Weather-sensitive high-risk work requires human review against current jobsite conditions before work proceeds.",
      evidenceRefs,
      affectedWorkItemIds: [item.id],
      jobsiteId: item.jobsiteId,
      jobsiteName: item.jobsiteName,
      trade: item.trade,
      area: item.area,
      sourceKey: `weather:${item.jobsiteId ?? "jobsite"}:${item.id}:${weatherBlockers.map((blocker) => blocker.id).join("-")}`,
    }));
  }
  return findings;
}

function blockerConflictFindings(work: PredictiveSafetyWorkItem[]): AiSafetyConflictFinding[] {
  const findings: AiSafetyConflictFinding[] = [];
  for (const item of work) {
    for (const blocker of item.blockers) {
      if (blocker.type !== "corrective_action") continue;
      const repeated = /repeated/i.test(`${blocker.label} ${blocker.detail}`);
      const riskLevel = riskMax(blocker.severity, repeated ? "high" : "moderate");
      const evidenceRefs = uniqueRefs([...item.evidenceRefs, ...blocker.evidenceRefs], 8);
      findings.push(finding({
        type: repeated ? "repeated_pattern_conflict" : "open_action_conflict",
        riskLevel,
        confidence: confidenceFor(missingForBlocker(blocker), evidenceRefs),
        title: repeated ? `Repeated hazard pattern before ${item.title}` : `Open corrective action conflicts with ${item.title}`,
        reason: blocker.detail,
        dataUsed: unique([item.title, blocker.label, item.trade, item.area], 6),
        missingInformation: missingForBlocker(blocker),
        recommendedAction: repeated
          ? "Brief the crew on the repeated pattern and verify corrective controls before work proceeds."
          : "Review the open corrective action and verify related controls before the planned work proceeds.",
        requiredVerification: repeated
          ? "Confirm the repeated hazard controls are assigned, field-visible, and understood by the affected crew."
          : "Confirm the corrective action status, field control, owner, and due date before related work starts.",
        humanApprovalRequired: riskLevel === "high" || riskLevel === "critical",
        humanApprovalReason:
          riskLevel === "high" || riskLevel === "critical"
            ? "Open or repeated safety signals tied to planned work require human review before work proceeds."
            : null,
        evidenceRefs,
        affectedWorkItemIds: [item.id],
        jobsiteId: item.jobsiteId,
        jobsiteName: item.jobsiteName,
        trade: item.trade,
        area: item.area,
        sourceKey: `${repeated ? "repeated" : "open-action"}:${item.jobsiteId ?? "jobsite"}:${item.id}:${blocker.id}`,
      }));
    }
  }
  return findings;
}

function outcomePatternFindings(input: BuildAiSafetyConflictMapInput): AiSafetyConflictFinding[] {
  const findings: AiSafetyConflictFinding[] = [];
  const outcomeRows = [
    ...(input.incidents ?? []).map((row) => ({
      id: row.id ?? row.title ?? "incident",
      sourceModule: "company_incidents",
      label: row.title ?? row.category ?? "Incident or near miss",
      jobsiteId: row.jobsite_id ?? null,
      text: normalize(`${row.title ?? ""} ${row.category ?? ""} ${row.description ?? ""}`),
      riskLevel: riskFromText(row.severity, row.sif_flag ? "critical" : "moderate"),
      href: "/incidents",
    })),
    ...(input.observations ?? []).map((row) => ({
      id: row.id ?? row.description ?? "observation",
      sourceModule: "company_sor_records",
      label: row.description ?? row.category ?? "Safety observation",
      jobsiteId: row.jobsite_id ?? null,
      text: normalize(`${row.description ?? ""} ${row.category ?? ""} ${row.hazard_category_code ?? ""} ${row.subcategory ?? ""}`),
      riskLevel: riskFromText(row.severity, "moderate"),
      href: "/observations",
    })),
    ...(input.correctiveActions ?? []).map((row) => ({
      id: row.id ?? row.title ?? "corrective-action",
      sourceModule: "company_corrective_actions",
      label: row.title ?? row.category ?? "Corrective action",
      jobsiteId: row.jobsite_id ?? null,
      text: normalize(`${row.title ?? ""} ${row.category ?? ""}`),
      riskLevel: riskFromText(row.severity ?? row.priority, row.sif_potential ? "critical" : "moderate"),
      href: "/field-id-exchange",
    })),
  ];

  for (const item of input.dailyBriefing.highRiskWork) {
    const text = workText(item);
    const matches = outcomeRows.filter((row) => {
      if (row.jobsiteId && item.jobsiteId && row.jobsiteId !== item.jobsiteId) return false;
      return row.text.split(/\s+/).some((token) => token.length > 4 && text.includes(token));
    });
    if (matches.length < 3) continue;
    const riskLevel = matches.reduce((level, row) => riskMax(level, row.riskLevel), "high" as SafetyRiskLevel);
    const evidenceRefs = uniqueRefs([
      ...item.evidenceRefs,
      ...matches.slice(0, 4).map((match) => ({
        id: `${match.sourceModule}-${match.id}`,
        sourceModule: match.sourceModule,
        sourceId: match.id,
        label: match.label,
        href: match.href,
        detail: match.riskLevel,
      })),
    ], 8);
    findings.push(finding({
      type: "repeated_pattern_conflict",
      riskLevel,
      confidence: confidenceFor([], evidenceRefs),
      title: `Repeated hazard history overlaps ${item.title}`,
      reason: `${matches.length} recent incident, observation, or corrective-action signals share hazard language with planned work.`,
      dataUsed: unique([item.title, ...matches.map((match) => match.label)], 8),
      missingInformation: [],
      recommendedAction: "Review the repeated hazard history during the pre-task briefing and verify controls with the responsible supervisor.",
      requiredVerification: "Confirm the crew understands the repeated hazard pattern and that controls are present at the workface.",
      humanApprovalRequired: true,
      humanApprovalReason: "Repeated hazard history tied to upcoming work requires supervisor or safety-manager review before work proceeds.",
      evidenceRefs,
      affectedWorkItemIds: [item.id],
      jobsiteId: item.jobsiteId,
      jobsiteName: item.jobsiteName,
      trade: item.trade,
      area: item.area,
      sourceKey: `history:${item.jobsiteId ?? "jobsite"}:${item.id}:${matches.slice(0, 3).map((match) => match.id).join("-")}`,
    }));
  }
  return findings;
}

function missingForBlocker(blocker: PredictiveSafetyReadinessBlocker) {
  if (blocker.type === "permit") return ["active permit status"];
  if (blocker.type === "training") return ["training readiness"];
  if (blocker.type === "competent_person") return ["competent-person inspection"];
  if (blocker.type === "weather") return ["weather threshold or pause criteria"];
  if (blocker.type === "control") return ["critical control verification"];
  if (blocker.type === "corrective_action") return ["corrective action field verification"];
  return ["source data needed for conflict review"];
}

function uniqueRefs(refs: PredictiveSafetyEvidenceRef[], limit = 8) {
  const seen = new Set<string>();
  const out: PredictiveSafetyEvidenceRef[] = [];
  for (const ref of refs) {
    const key = `${ref.sourceModule}:${ref.sourceId ?? ref.id}:${ref.label}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
    if (out.length >= limit) break;
  }
  return out;
}

export function buildAiSafetyConflictMap(input: BuildAiSafetyConflictMapInput): AiSafetyConflictMap {
  const findings = [
    ...readinessFindings(input.dailyBriefing.highRiskWork),
    ...adjacentFindings(input.dailyBriefing.highRiskWork),
    ...weatherFindings(input.dailyBriefing.highRiskWork, input.weatherAlerts),
    ...blockerConflictFindings(input.dailyBriefing.highRiskWork),
    ...outcomePatternFindings(input),
  ];
  const deduped = new Map<string, AiSafetyConflictFinding>();
  for (const item of findings) {
    const existing = deduped.get(item.sourceKey);
    if (!existing || RISK_RANK[item.riskLevel] > RISK_RANK[existing.riskLevel]) deduped.set(item.sourceKey, item);
  }
  const sorted = [...deduped.values()]
    .sort((a, b) => RISK_RANK[b.riskLevel] - RISK_RANK[a.riskLevel] || b.evidenceRefs.length - a.evidenceRefs.length)
    .slice(0, 16);
  const highConflictCount = sorted.filter((item) => item.riskLevel === "high" || item.riskLevel === "critical").length;
  const criticalConflictCount = sorted.filter((item) => item.riskLevel === "critical").length;
  const missingData = unique([
    ...(input.dailyBriefing.missingData ?? []),
    sorted.some((item) => item.missingInformation.length > 0) ? "Some conflict findings are lower confidence because work area, crew, permit, training, weather threshold, or control data is incomplete." : null,
  ], 8);
  const confidence: SafetyAiConfidence =
    sorted.length === 0 || sorted.some((item) => item.confidence === "low") ? "low" : sorted.some((item) => item.confidence === "medium") ? "medium" : "high";

  return {
    generatedAt: input.now?.toISOString() ?? input.dailyBriefing.generatedAt,
    summary:
      sorted.length > 0
        ? `${sorted.length} predicted workface conflict${sorted.length === 1 ? "" : "s"} need review before work proceeds.`
        : "No workface conflicts were detected from the loaded data; review missing data before treating the day as low risk.",
    findings: sorted,
    highConflictCount,
    criticalConflictCount,
    missingData,
    confidence,
  };
}
