import type { AiSafetyActionQueue } from "@/lib/aiSafetyActionQueue";
import type { AiSafetyConflictFinding, AiSafetyConflictMap } from "@/lib/aiSafetyConflictMap";
import type { AiSafetyFeedbackSignal } from "@/lib/aiSafetyFeedbackInfluence";
import type { AiSafetyFieldEvidenceSignal, AiSafetyReasoningFrame } from "@/lib/aiSafetyReasoningFrame";
import type {
  DailyRiskBriefing,
  PredictiveSafetyEvidenceRef,
  PredictiveSafetyMemoryItemRow,
  PredictiveSafetyWorkItem,
} from "@/lib/predictiveSafetyEngine";
import type { SafetyAiAssessment, SafetyAiConfidence, SafetyRiskLevel } from "@/lib/safety-ai/types";
import type { BucketedWorkItem, ConflictMatrixItem, RulesEvaluation } from "@/types/safety-intelligence";

export type AiSafetyUnifiedSourceSystem =
  | "predictive_risk"
  | "safety_intelligence"
  | "gus_photo_review"
  | "risk_memory"
  | "recommendation_event";

export type AiSafetyUnifiedEvidence = {
  id: string;
  sourceSystem: AiSafetyUnifiedSourceSystem;
  sourceModule: string;
  sourceId: string | null;
  label: string;
  detail: string;
  riskLevel: SafetyRiskLevel | "unknown";
  confidence: SafetyAiConfidence;
  jobsiteId: string | null;
  trade: string | null;
  area: string | null;
  date: string | null;
  evidenceRefs: PredictiveSafetyEvidenceRef[];
};

export type AiSafetyUnifiedConflict = {
  id: string;
  sourceSystem: AiSafetyUnifiedSourceSystem;
  sourceKey: string;
  type: string;
  riskLevel: SafetyRiskLevel;
  confidence: SafetyAiConfidence;
  title: string;
  reason: string;
  recommendedAction: string;
  requiredVerification: string;
  humanApprovalRequired: boolean;
  evidenceRefs: PredictiveSafetyEvidenceRef[];
  jobsiteId: string | null;
  trade: string | null;
  area: string | null;
  duplicateOf: string | null;
};

export type AiSafetyUnifiedSourceCoverage = {
  sourceSystem: AiSafetyUnifiedSourceSystem;
  label: string;
  evidenceCount: number;
  conflictCount: number;
  status: "available" | "partial" | "missing";
};

export type AiSafetyUnifiedNextBestAction = {
  id: string;
  title: string;
  detail: string;
  sourceSystem: AiSafetyUnifiedSourceSystem;
  humanReviewRequired: boolean;
};

export type AiSafetyUnifiedContext = {
  generatedAt: string;
  sourceCoverage: AiSafetyUnifiedSourceCoverage[];
  evidence: AiSafetyUnifiedEvidence[];
  conflicts: AiSafetyUnifiedConflict[];
  missingInformation: string[];
  conflictingSignals: string[];
  nextBestActions: AiSafetyUnifiedNextBestAction[];
  confidence: SafetyAiConfidence;
  doNotClaim: string[];
};

export type AiSafetyUnifiedBucketItemRow = {
  id?: string | null;
  jobsite_id?: string | null;
  bucket_key?: string | null;
  bucket_type?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  bucket_payload?: unknown;
  rule_results?: unknown;
  conflict_results?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AiSafetyUnifiedConflictPairRow = {
  id?: string | null;
  jobsite_id?: string | null;
  bucket_run_id?: string | null;
  left_operation_id?: string | null;
  right_operation_id?: string | null;
  conflict_code?: string | null;
  conflict_type?: string | null;
  severity?: string | null;
  status?: string | null;
  rationale?: string | null;
  recommended_controls?: string[] | null;
  overlap_scope?: unknown;
  updated_at?: string | null;
};

export type BuildAiSafetyUnifiedContextInput = {
  safetyAiAssessment: SafetyAiAssessment;
  dailyBriefing: DailyRiskBriefing;
  conflictMap: AiSafetyConflictMap;
  actionQueue: AiSafetyActionQueue;
  reasoningFrame: AiSafetyReasoningFrame;
  fieldEvidenceSignals?: AiSafetyFieldEvidenceSignal[];
  memoryItems?: PredictiveSafetyMemoryItemRow[];
  feedbackSignals?: AiSafetyFeedbackSignal[];
  safetyIntelligenceBucketItems?: AiSafetyUnifiedBucketItemRow[];
  safetyIntelligenceConflictPairs?: AiSafetyUnifiedConflictPairRow[];
  now?: Date;
};

const DO_NOT_CLAIM = [
  "Do not approve permits or release work.",
  "Do not declare final OSHA compliance.",
  "Do not provide legal advice.",
  "Do not claim work is safe, cleared, or guaranteed.",
  "Do not replace safety-manager, supervisor, or competent-person judgment.",
];

const RISK_RANK: Record<SafetyRiskLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

function clean(value: unknown, max = 700) {
  return String(value ?? "").trim().slice(0, max);
}

function normalize(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function uniqueRefs(refs: PredictiveSafetyEvidenceRef[], limit = 10) {
  const seen = new Set<string>();
  const out: PredictiveSafetyEvidenceRef[] = [];
  for (const ref of refs) {
    const key = `${ref.sourceModule}:${ref.sourceId}:${ref.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
    if (out.length >= limit) break;
  }
  return out;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function riskFromSeverity(value: unknown, fallback: SafetyRiskLevel = "moderate"): SafetyRiskLevel {
  const text = normalize(value);
  if (text.includes("critical") || text.includes("severe") || text.includes("stop work") || text.includes("sif")) return "critical";
  if (text.includes("high") || text.includes("major")) return "high";
  if (text.includes("medium") || text.includes("moderate")) return "moderate";
  if (text.includes("low") || text.includes("minor")) return "low";
  return fallback;
}

function confidenceFor(missing: string[], evidenceCount: number, strong = false): SafetyAiConfidence {
  if (missing.length >= 3 || evidenceCount === 0) return "low";
  if (strong && missing.length === 0 && evidenceCount >= 2) return "high";
  return "medium";
}

function riskMax(values: SafetyRiskLevel[]): SafetyRiskLevel {
  return values.reduce<SafetyRiskLevel>((max, value) => (RISK_RANK[value] > RISK_RANK[max] ? value : max), "low");
}

function evidenceRef(params: {
  id: string;
  label: string;
  href: string | null;
  sourceModule: string;
  sourceId?: string | null;
  detail?: string | null;
}): PredictiveSafetyEvidenceRef {
  return {
    id: params.id,
    label: params.label,
    href: params.href,
    sourceModule: params.sourceModule,
    sourceId: params.sourceId ?? params.id,
    detail: params.detail ?? null,
  };
}

function verificationText(value: string | null | undefined, fallback: string) {
  const base = clean(value) || fallback;
  return /before work proceeds/i.test(base) ? base : `${base} Verify before work proceeds.`;
}

function workEvidence(work: PredictiveSafetyWorkItem): AiSafetyUnifiedEvidence {
  return {
    id: `unified-work-${work.id}`,
    sourceSystem: "predictive_risk",
    sourceModule: "daily_briefing.high_risk_work",
    sourceId: work.id,
    label: work.title,
    detail: work.scoreExplanation.reason || work.whyItMatters,
    riskLevel: work.riskLevel,
    confidence: work.assessment.confidence,
    jobsiteId: work.jobsiteId,
    trade: work.trade,
    area: work.area,
    date: work.date,
    evidenceRefs: work.evidenceRefs,
  };
}

function predictiveConflict(conflict: AiSafetyConflictFinding): AiSafetyUnifiedConflict {
  return {
    id: `unified-${conflict.id}`,
    sourceSystem: "predictive_risk",
    sourceKey: conflict.sourceKey,
    type: conflict.type,
    riskLevel: conflict.riskLevel,
    confidence: conflict.confidence,
    title: conflict.title,
    reason: conflict.reason,
    recommendedAction: conflict.recommendedAction,
    requiredVerification: conflict.requiredVerification,
    humanApprovalRequired: conflict.humanApprovalRequired,
    evidenceRefs: conflict.evidenceRefs,
    jobsiteId: conflict.jobsiteId,
    trade: conflict.trade,
    area: conflict.area,
    duplicateOf: null,
  };
}

function bucketPayload(row: AiSafetyUnifiedBucketItemRow): BucketedWorkItem | null {
  const payload = row.bucket_payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const item = payload as Partial<BucketedWorkItem>;
  if (!item.bucketKey && !row.bucket_key) return null;
  return item as BucketedWorkItem;
}

function rulesPayload(row: AiSafetyUnifiedBucketItemRow): RulesEvaluation | null {
  const payload = row.rule_results;
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as RulesEvaluation) : null;
}

function conflictResults(row: AiSafetyUnifiedBucketItemRow): ConflictMatrixItem[] {
  return Array.isArray(row.conflict_results) ? (row.conflict_results as ConflictMatrixItem[]) : [];
}

function bucketEvidence(row: AiSafetyUnifiedBucketItemRow): AiSafetyUnifiedEvidence | null {
  const bucket = bucketPayload(row);
  const rules = rulesPayload(row);
  const bucketKey = clean(bucket?.bucketKey ?? row.bucket_key);
  if (!bucketKey) return null;
  const hazards = Array.isArray(rules?.hazardFamilies) ? rules?.hazardFamilies : bucket?.hazardFamilies ?? [];
  const controls = Array.isArray(rules?.requiredControls) ? rules?.requiredControls : bucket?.requiredControls ?? [];
  const permits = Array.isArray(rules?.permitTriggers) ? rules?.permitTriggers : bucket?.permitTriggers ?? [];
  const missing = unique([
    !bucket?.workAreaLabel ? "work area" : null,
    !bucket?.startsAt && !row.starts_at ? "work start time" : null,
    !bucket?.tradeCode ? "trade code" : null,
  ], 4);
  const detail = unique([
    hazards.length ? `Hazards: ${hazards.slice(0, 4).join(", ")}` : null,
    permits.length ? `Permit triggers: ${permits.slice(0, 3).join(", ")}` : null,
    controls.length ? `Controls: ${controls.slice(0, 3).join(", ")}` : null,
  ], 3).join(". ");
  return {
    id: `unified-si-bucket-${clean(row.id) || bucketKey}`,
    sourceSystem: "safety_intelligence",
    sourceModule: "company_bucket_items",
    sourceId: clean(row.id) || bucketKey,
    label: clean(bucket?.taskTitle, 160) || "Safety Intelligence work bucket",
    detail: detail || "Safety Intelligence bucket and rule results are available.",
    riskLevel: riskFromSeverity(rules?.band ?? "moderate", "moderate"),
    confidence: confidenceFor(missing, 1, true),
    jobsiteId: clean(row.jobsite_id ?? bucket?.jobsiteId) || null,
    trade: clean(bucket?.tradeCode) || null,
    area: clean(bucket?.workAreaLabel) || null,
    date: clean(bucket?.startsAt ?? row.starts_at).slice(0, 10) || null,
    evidenceRefs: [
      evidenceRef({
        id: `si-bucket-${clean(row.id) || bucketKey}`,
        label: clean(bucket?.taskTitle, 160) || "Safety Intelligence bucket",
        href: "/safety-intelligence",
        sourceModule: "company_bucket_items",
        sourceId: clean(row.id) || bucketKey,
        detail: detail || null,
      }),
    ],
  };
}

function conflictFromBucket(row: AiSafetyUnifiedBucketItemRow, item: ConflictMatrixItem): AiSafetyUnifiedConflict {
  const sourceKey = [
    "si-bucket-conflict",
    clean(row.id) || clean(row.bucket_key),
    item.code,
    item.relatedBucketKeys.join("-"),
  ].join(":");
  const missing = unique([
    !row.jobsite_id ? "jobsite" : null,
    !objectValue(item.metadata).workAreaLabel ? "work area" : null,
    item.operationIds.length < 2 ? "paired operation" : null,
  ], 4);
  return {
    id: `unified-${normalize(sourceKey).replace(/\s+/g, "-").slice(0, 96)}`,
    sourceSystem: "safety_intelligence",
    sourceKey,
    type: item.type,
    riskLevel: riskFromSeverity(item.severity, "high"),
    confidence: confidenceFor(missing, item.relatedBucketKeys.length, true),
    title: item.code.replace(/[_-]+/g, " "),
    reason: item.rationale,
    recommendedAction: item.requiredMitigations.length
      ? `Verify ${item.requiredMitigations.slice(0, 3).join(", ")} before work proceeds.`
      : "Review this Safety Intelligence conflict before work proceeds.",
    requiredVerification: verificationText(item.resequencingSuggestion, "Verify sequencing, separation, permits, and controls before work proceeds."),
    humanApprovalRequired: riskFromSeverity(item.severity, "high") === "critical" || riskFromSeverity(item.severity, "high") === "high",
    evidenceRefs: [
      evidenceRef({
        id: `si-conflict-${clean(row.id) || item.code}`,
        label: item.code.replace(/[_-]+/g, " "),
        href: "/safety-intelligence",
        sourceModule: "company_bucket_items.conflict_results",
        sourceId: clean(row.id) || item.code,
        detail: item.rationale,
      }),
    ],
    jobsiteId: clean(row.jobsite_id) || null,
    trade: null,
    area: clean(objectValue(item.metadata).workAreaLabel) || null,
    duplicateOf: null,
  };
}

function conflictFromPair(row: AiSafetyUnifiedConflictPairRow): AiSafetyUnifiedConflict {
  const sourceKey = [
    "si-conflict-pair",
    clean(row.id) || clean(row.conflict_code),
    clean(row.left_operation_id),
    clean(row.right_operation_id),
  ].join(":");
  const overlap = objectValue(row.overlap_scope);
  const riskLevel = riskFromSeverity(row.severity, "high");
  const controls = Array.isArray(row.recommended_controls) ? row.recommended_controls : [];
  const missing = unique([
    !row.jobsite_id ? "jobsite" : null,
    !clean(overlap.workAreaLabel) ? "work area" : null,
    !row.left_operation_id || !row.right_operation_id ? "paired operations" : null,
  ], 4);
  return {
    id: `unified-${normalize(sourceKey).replace(/\s+/g, "-").slice(0, 96)}`,
    sourceSystem: "safety_intelligence",
    sourceKey,
    type: clean(row.conflict_type) || "safety_intelligence_conflict",
    riskLevel,
    confidence: confidenceFor(missing, controls.length || 1, true),
    title: clean(row.conflict_code).replace(/[_-]+/g, " ") || "Safety Intelligence open conflict",
    reason: clean(row.rationale) || "Open Safety Intelligence conflict is present for this jobsite.",
    recommendedAction: controls.length
      ? `Verify ${controls.slice(0, 3).join(", ")} before work proceeds.`
      : "Review this open Safety Intelligence conflict before work proceeds.",
    requiredVerification: verificationText(
      clean(overlap.resequencingSuggestion),
      "Verify sequencing, separation, permits, and controls before work proceeds.",
    ),
    humanApprovalRequired: riskLevel === "critical" || riskLevel === "high",
    evidenceRefs: [
      evidenceRef({
        id: `si-open-conflict-${clean(row.id) || clean(row.conflict_code) || "open"}`,
        label: clean(row.conflict_code).replace(/[_-]+/g, " ") || "Safety Intelligence conflict",
        href: "/safety-intelligence",
        sourceModule: "company_conflict_pairs",
        sourceId: clean(row.id) || null,
        detail: clean(row.status) || null,
      }),
    ],
    jobsiteId: clean(row.jobsite_id) || null,
    trade: null,
    area: clean(overlap.workAreaLabel) || null,
    duplicateOf: null,
  };
}

function fieldEvidence(signal: AiSafetyFieldEvidenceSignal): AiSafetyUnifiedEvidence {
  const riskLevel = signal.riskLevel === "unknown" ? "moderate" : signal.riskLevel;
  return {
    id: `unified-field-${signal.id}`,
    sourceSystem: "gus_photo_review",
    sourceModule: signal.source,
    sourceId: signal.persistedRecommendationId ?? signal.id,
    label: signal.linkedWorkTitle ?? signal.linkedConflictTitle ?? "Field evidence needing verification",
    detail: unique([...signal.criticalFlags, ...signal.concerns, ...signal.limitations], 4).join("; ") || "Field/photo evidence needs verification.",
    riskLevel,
    confidence: signal.confidence,
    jobsiteId: signal.jobsiteId ?? null,
    trade: null,
    area: null,
    date: null,
    evidenceRefs: signal.evidenceRefs,
  };
}

function memoryEvidence(row: PredictiveSafetyMemoryItemRow): AiSafetyUnifiedEvidence | null {
  const id = clean(row.id);
  const label = clean(row.title, 160);
  const detail = clean(row.summary || row.content || row.body, 500);
  if (!id && !label && !detail) return null;
  return {
    id: `unified-memory-${id || normalize(label).slice(0, 48)}`,
    sourceSystem: "risk_memory",
    sourceModule: "company_memory_items",
    sourceId: id || null,
    label: label || "Company memory item",
    detail: detail || "Company/jobsite memory item is available.",
    riskLevel: "unknown",
    confidence: "medium",
    jobsiteId: null,
    trade: null,
    area: null,
    date: clean(row.created_at).slice(0, 10) || null,
    evidenceRefs: [
      evidenceRef({
        id: `memory-${id || label || "item"}`,
        label: label || "Company memory item",
        href: "/settings/risk-memory",
        sourceModule: "company_memory_items",
        sourceId: id || null,
        detail: clean(row.source_type || row.source) || null,
      }),
    ],
  };
}

function feedbackEvidence(signal: AiSafetyFeedbackSignal): AiSafetyUnifiedEvidence {
  return {
    id: `unified-feedback-${signal.id}`,
    sourceSystem: "recommendation_event",
    sourceModule: "ai_safety_feedback",
    sourceId: signal.sourceId,
    label: signal.kind.replace(/_/g, " "),
    detail: signal.reason,
    riskLevel: "unknown",
    confidence: "medium",
    jobsiteId: signal.jobsiteId,
    trade: null,
    area: null,
    date: clean(signal.createdAt).slice(0, 10) || null,
    evidenceRefs: [],
  };
}

function dedupeConflicts(conflicts: AiSafetyUnifiedConflict[]) {
  const seen = new Map<string, AiSafetyUnifiedConflict>();
  const out: AiSafetyUnifiedConflict[] = [];
  for (const conflict of conflicts) {
    const key = [
      normalize(conflict.jobsiteId),
      normalize(conflict.area),
      normalize(conflict.type),
      normalize(conflict.title)
        .split(" ")
        .filter((part) => part.length >= 4)
        .slice(0, 5)
        .join(" "),
    ].join("|");
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, conflict);
      out.push(conflict);
      continue;
    }
    const preferred = RISK_RANK[conflict.riskLevel] > RISK_RANK[existing.riskLevel] ? conflict : existing;
    const duplicate = preferred === conflict ? existing : conflict;
    const merged: AiSafetyUnifiedConflict = {
      ...preferred,
      evidenceRefs: uniqueRefs([...preferred.evidenceRefs, ...duplicate.evidenceRefs], 10),
      duplicateOf: duplicate.id,
    };
    const index = out.findIndex((item) => item.id === existing.id);
    if (index >= 0) out[index] = merged;
    seen.set(key, merged);
  }
  return out;
}

function coverage(
  sourceSystem: AiSafetyUnifiedSourceSystem,
  label: string,
  evidence: AiSafetyUnifiedEvidence[],
  conflicts: AiSafetyUnifiedConflict[],
): AiSafetyUnifiedSourceCoverage {
  const evidenceCount = evidence.filter((item) => item.sourceSystem === sourceSystem).length;
  const conflictCount = conflicts.filter((item) => item.sourceSystem === sourceSystem).length;
  return {
    sourceSystem,
    label,
    evidenceCount,
    conflictCount,
    status: evidenceCount + conflictCount > 0 ? "available" : "missing",
  };
}

function buildNextActions(params: {
  actionQueue: AiSafetyActionQueue;
  conflicts: AiSafetyUnifiedConflict[];
  missingInformation: string[];
}): AiSafetyUnifiedNextBestAction[] {
  return [
    ...params.actionQueue.items.slice(0, 4).map((item): AiSafetyUnifiedNextBestAction => ({
      id: `queue-${item.id}`,
      title: item.title,
      detail: item.recommendedControl,
      sourceSystem: item.category === "field_evidence_review" ? "gus_photo_review" : "predictive_risk",
      humanReviewRequired: item.humanApprovalRequired,
    })),
    ...params.conflicts
      .filter((conflict) => conflict.sourceSystem === "safety_intelligence")
      .slice(0, 3)
      .map((conflict): AiSafetyUnifiedNextBestAction => ({
        id: `conflict-${conflict.id}`,
        title: `Review ${conflict.title}`,
        detail: conflict.requiredVerification,
        sourceSystem: "safety_intelligence",
        humanReviewRequired: conflict.humanApprovalRequired,
      })),
    ...(params.missingInformation.length > 0
      ? [{
          id: "missing-unified-context",
          title: "Fill missing AI safety context",
          detail: `Verify ${params.missingInformation.slice(0, 3).join(", ")} before relying on the unified view.`,
          sourceSystem: "predictive_risk" as const,
          humanReviewRequired: false,
        }]
      : []),
  ].slice(0, 8);
}

export function buildAiSafetyUnifiedContext(input: BuildAiSafetyUnifiedContextInput): AiSafetyUnifiedContext {
  const bucketEvidenceRows = (input.safetyIntelligenceBucketItems ?? [])
    .map(bucketEvidence)
    .filter((item): item is AiSafetyUnifiedEvidence => Boolean(item));
  const bucketConflicts = (input.safetyIntelligenceBucketItems ?? []).flatMap((row) =>
    conflictResults(row).map((item) => conflictFromBucket(row, item))
  );
  const pairConflicts = (input.safetyIntelligenceConflictPairs ?? []).map(conflictFromPair);
  const memoryRows = (input.memoryItems ?? [])
    .slice(0, 8)
    .map(memoryEvidence)
    .filter((item): item is AiSafetyUnifiedEvidence => Boolean(item));
  const evidence = [
    ...input.dailyBriefing.highRiskWork.slice(0, 8).map(workEvidence),
    ...input.reasoningFrame.supportingEvidence.slice(0, 6).map((item, index): AiSafetyUnifiedEvidence => ({
      id: `unified-reasoning-${index}-${normalize(item.label).slice(0, 40)}`,
      sourceSystem: "predictive_risk",
      sourceModule: item.source,
      sourceId: null,
      label: item.label,
      detail: item.detail,
      riskLevel: input.safetyAiAssessment.level,
      confidence: input.safetyAiAssessment.confidence,
      jobsiteId: input.dailyBriefing.highRiskWork[0]?.jobsiteId ?? null,
      trade: null,
      area: null,
      date: null,
      evidenceRefs: item.evidenceRefs,
    })),
    ...bucketEvidenceRows,
    ...(input.fieldEvidenceSignals ?? []).map(fieldEvidence),
    ...memoryRows,
    ...(input.feedbackSignals ?? []).slice(0, 6).map(feedbackEvidence),
  ].slice(0, 28);

  const conflicts = dedupeConflicts([
    ...input.conflictMap.findings.map(predictiveConflict),
    ...bucketConflicts,
    ...pairConflicts,
  ]).sort((a, b) => RISK_RANK[b.riskLevel] - RISK_RANK[a.riskLevel]);

  const missingInformation = unique([
    ...input.dailyBriefing.missingData,
    ...input.reasoningFrame.missingInformation,
    ...input.safetyAiAssessment.missingData,
    ...evidence.filter((item) => item.sourceSystem === "safety_intelligence" && !item.area).map(() => "Safety Intelligence work area"),
    ...conflicts.filter((item) => !item.jobsiteId).map(() => "conflict jobsite"),
    ...(bucketEvidenceRows.length === 0 ? ["Safety Intelligence bucket/rule context"] : []),
  ], 12);
  const conflictingSignals = unique([
    ...input.reasoningFrame.conflictingEvidence.map((item) => `${item.label}: ${item.detail}`),
    ...conflicts.filter((item) => item.duplicateOf).map((item) => `Duplicate conflict evidence merged from ${item.sourceSystem}: ${item.title}`),
    ...((input.feedbackSignals ?? []).some((signal) => signal.confidenceAdjustment === "decrease")
      ? ["Reviewer feedback lowered confidence for a similar AI recommendation pattern."]
      : []),
  ], 8);
  const sourceCoverage = [
    coverage("predictive_risk", "Predictive Risk", evidence, conflicts),
    coverage("safety_intelligence", "Safety Intelligence", evidence, conflicts),
    coverage("gus_photo_review", "Gus field evidence", evidence, conflicts),
    coverage("risk_memory", "Risk memory", evidence, conflicts),
    coverage("recommendation_event", "Recommendation feedback", evidence, conflicts),
  ];
  const highestRisk = riskMax([
    input.safetyAiAssessment.level,
    ...input.dailyBriefing.highRiskWork.map((work) => work.riskLevel),
    ...conflicts.map((conflict) => conflict.riskLevel),
  ]);
  const confidence = confidenceFor(
    missingInformation,
    evidence.length + conflicts.length,
    sourceCoverage.filter((item) => item.status === "available").length >= 3 && highestRisk !== "critical",
  );
  return {
    generatedAt: input.now?.toISOString() ?? input.dailyBriefing.generatedAt,
    sourceCoverage,
    evidence,
    conflicts,
    missingInformation,
    conflictingSignals,
    nextBestActions: buildNextActions({ actionQueue: input.actionQueue, conflicts, missingInformation }),
    confidence,
    doNotClaim: DO_NOT_CLAIM,
  };
}
