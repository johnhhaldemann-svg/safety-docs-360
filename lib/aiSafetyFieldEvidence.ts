import type { AiSafetyFieldEvidenceSignal } from "@/lib/aiSafetyReasoningFrame";
import type { AiSafetyConflictMap } from "@/lib/aiSafetyConflictMap";
import type { GusPhotoReviewOutput } from "@/lib/gus/gusTypes";
import type { DailyRiskBriefing, PredictiveSafetyWorkItem } from "@/lib/predictiveSafetyEngine";
import type { SafetyAiConfidence, SafetyRiskLevel } from "@/lib/safety-ai/types";

export type AiSafetyFieldEvidenceRecommendationRow = {
  id?: string | null;
  jobsite_id?: string | null;
  title?: string | null;
  body?: string | null;
  confidence?: number | null;
  status?: string | null;
  evidence_summary?: unknown;
  created_at?: string | null;
};

export type GusPhotoReviewEvidenceSummary = {
  source: "gus_photo_review";
  sourceKey: string;
  riskLevel: SafetyRiskLevel | "unknown";
  concerns: string[];
  criticalFlags: string[];
  missingInformation: string[];
  recommendedControls: string[];
  nextActions: string[];
  limitations: string[];
  jobsiteId: string | null;
  userNote: string | null;
  needsFieldVerification: true;
};

export type AiSafetyFieldEvidenceInsert = {
  company_id: string;
  jobsite_id: string | null;
  kind: "ai_safety_field_evidence";
  title: string;
  body: string;
  confidence: number;
  context_snapshot: Record<string, unknown>;
  created_by: string;
  status: "active";
  priority: "low" | "medium" | "high" | "critical";
  action_type: "request_inspection" | "stop_work_review";
  target_module: "command_center";
  target_href: string;
  verification_required: true;
  mitigation_state: "unverified";
  risk_reduction_points: 0;
  evidence_summary: {
    gusPhotoReview: GusPhotoReviewEvidenceSummary;
  };
};

function clean(value: unknown, max = 220) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanArray(value: unknown, limit: number, max = 220) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const text = clean(item, max);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function normalizeRiskLevel(value: unknown): SafetyRiskLevel | "unknown" {
  if (value === "critical" || value === "high" || value === "moderate" || value === "low") return value;
  return "unknown";
}

function confidenceFromNumber(value: number | null | undefined): SafetyAiConfidence {
  const normalized = Number(value ?? 0);
  if (normalized >= 0.78) return "high";
  if (normalized >= 0.48) return "medium";
  return "low";
}

function priorityForRisk(level: SafetyRiskLevel | "unknown"): AiSafetyFieldEvidenceInsert["priority"] {
  if (level === "critical") return "critical";
  if (level === "high") return "high";
  if (level === "moderate") return "medium";
  return "low";
}

function actionTypeForRisk(level: SafetyRiskLevel | "unknown"): AiSafetyFieldEvidenceInsert["action_type"] {
  return level === "critical" ? "stop_work_review" : "request_inspection";
}

function summaryObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalize(value: unknown) {
  return clean(value, 5000)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function signalText(signal: AiSafetyFieldEvidenceSignal) {
  return normalize([
    signal.userNote,
    signal.concerns.join(" "),
    signal.criticalFlags.join(" "),
    signal.missingInformation.join(" "),
    signal.recommendedControls.join(" "),
    signal.nextActions.join(" "),
  ].join(" "));
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

function matchScore(left: string, right: string) {
  if (!left || !right) return 0;
  const tokens = left.split(" ").filter((token) => token.length >= 4);
  if (tokens.length === 0) return 0;
  return tokens.reduce((score, token) => score + (right.includes(token) ? 1 : 0), 0);
}

function lowerConfidenceForUnlinked(signal: AiSafetyFieldEvidenceSignal): SafetyAiConfidence {
  if (signal.riskLevel === "critical" || signal.criticalFlags.length > 0) return signal.confidence;
  return signal.confidence === "high" ? "medium" : "low";
}

export function buildGusPhotoReviewSourceKey(params: {
  companyId: string;
  jobsiteId?: string | null;
  userId: string;
  createdAt?: string;
}) {
  const time = params.createdAt ?? new Date().toISOString();
  return [
    "gus-photo-review",
    params.companyId,
    params.jobsiteId || "all-jobsites",
    params.userId,
    time.replace(/[^0-9a-z]/gi, "").slice(0, 18),
  ].join(":");
}

export function fieldEvidenceSignalFromGusPhotoReview(
  review: GusPhotoReviewOutput,
  params: {
    id: string;
    sourceKey: string;
    jobsiteId?: string | null;
    userNote?: string | null;
  },
): AiSafetyFieldEvidenceSignal {
  const riskLevel = normalizeRiskLevel(review.riskLevel);
  return {
    id: params.id,
    source: "gus_photo_review",
    sourceKey: params.sourceKey,
    jobsiteId: params.jobsiteId ?? null,
    riskLevel,
    confidence: confidenceFromNumber(review.confidence),
    concerns: cleanArray(review.concerns, 10),
    criticalFlags: cleanArray(review.criticalFlags, 8),
    missingInformation: [
      ...cleanArray(review.missingInformation, 10),
      ...cleanArray(review.limitations, 8),
      "Field verification is required before treating photo-review concerns as field-verified conditions.",
    ].slice(0, 12),
    recommendedControls: cleanArray(review.recommendedControls, 12),
    nextActions: cleanArray(review.nextActions, 8),
    limitations: cleanArray(review.limitations, 8),
    evidenceRefs: [],
    needsFieldVerification: true,
    userNote: clean(params.userNote, 500) || null,
  };
}

export function gusPhotoReviewEvidenceSummaryFromSignal(signal: AiSafetyFieldEvidenceSignal): GusPhotoReviewEvidenceSummary {
  return {
    source: "gus_photo_review",
    sourceKey: signal.sourceKey ?? signal.id,
    riskLevel: normalizeRiskLevel(signal.riskLevel),
    concerns: cleanArray(signal.concerns, 10),
    criticalFlags: cleanArray(signal.criticalFlags, 8),
    missingInformation: cleanArray(signal.missingInformation, 12),
    recommendedControls: cleanArray(signal.recommendedControls, 12),
    nextActions: cleanArray(signal.nextActions, 8),
    limitations: cleanArray(signal.limitations, 8),
    jobsiteId: signal.jobsiteId ?? null,
    userNote: clean(signal.userNote, 500) || null,
    needsFieldVerification: true,
  };
}

export function buildFieldEvidenceInsertForGusPhotoReview(params: {
  companyId: string;
  actorUserId: string;
  jobsiteId?: string | null;
  review: GusPhotoReviewOutput;
  userNote?: string | null;
  sourceKey: string;
}): { row: AiSafetyFieldEvidenceInsert; signal: AiSafetyFieldEvidenceSignal } {
  const signal = fieldEvidenceSignalFromGusPhotoReview(params.review, {
    id: params.sourceKey,
    sourceKey: params.sourceKey,
    jobsiteId: params.jobsiteId,
    userNote: params.userNote,
  });
  const risk = normalizeRiskLevel(signal.riskLevel);
  const headline = signal.criticalFlags[0] ?? signal.concerns[0] ?? "Photo review field evidence needs verification";
  const body = [
    `Gus photo review found: ${headline}`,
    signal.recommendedControls.length > 0 ? `Recommended control: ${signal.recommendedControls[0]}` : null,
    "Needs field verification before work proceeds. This photo review is advisory evidence only.",
    signal.missingInformation.length > 0 ? `Missing information: ${signal.missingInformation.slice(0, 4).join("; ")}` : null,
  ].filter(Boolean).join("\n\n");

  return {
    signal,
    row: {
      company_id: params.companyId,
      jobsite_id: params.jobsiteId ?? null,
      kind: "ai_safety_field_evidence",
      title: clean(`Field evidence review - ${headline}`, 220) || "Field evidence review",
      body,
      confidence: Math.max(0, Math.min(1, Number(params.review.confidence ?? 0))),
      context_snapshot: {
        source: "gus.photo-review",
        sourceKey: params.sourceKey,
        riskLevel: risk,
        needsFieldVerification: true,
      },
      created_by: params.actorUserId,
      status: "active",
      priority: priorityForRisk(risk),
      action_type: actionTypeForRisk(risk),
      target_module: "command_center",
      target_href: "/command-center",
      verification_required: true,
      mitigation_state: "unverified",
      risk_reduction_points: 0,
      evidence_summary: {
        gusPhotoReview: gusPhotoReviewEvidenceSummaryFromSignal(signal),
      },
    },
  };
}

export function fieldEvidenceSignalFromRecommendation(row: AiSafetyFieldEvidenceRecommendationRow): AiSafetyFieldEvidenceSignal | null {
  const summary = summaryObject(row.evidence_summary);
  const review = summaryObject(summary?.gusPhotoReview);
  if (!review || review.source !== "gus_photo_review") return null;
  const sourceKey = clean(review.sourceKey, 240) || `field-evidence:${row.id ?? "unknown"}`;
  const riskLevel = normalizeRiskLevel(review.riskLevel);
  return {
    id: row.id ?? sourceKey,
    source: "gus_photo_review",
    sourceKey,
    persistedRecommendationId: row.id ?? null,
    jobsiteId: clean(review.jobsiteId, 80) || row.jobsite_id || null,
    riskLevel,
    confidence: confidenceFromNumber(row.confidence ?? null),
    concerns: cleanArray(review.concerns, 10),
    criticalFlags: cleanArray(review.criticalFlags, 8),
    missingInformation: cleanArray(review.missingInformation, 12),
    recommendedControls: cleanArray(review.recommendedControls, 12),
    nextActions: cleanArray(review.nextActions, 8),
    limitations: cleanArray(review.limitations, 8),
    evidenceRefs: [
      {
        id: `field-evidence-${row.id ?? sourceKey}`,
        sourceModule: "company_risk_ai_recommendations",
        sourceId: row.id ?? sourceKey,
        label: row.title ?? "Gus photo review field evidence",
        href: "/command-center",
        detail: row.body ?? "Summary-only photo review evidence needs field verification.",
      },
    ],
    needsFieldVerification: true,
    userNote: clean(review.userNote, 500) || null,
  };
}

export function fieldEvidenceSignalsFromRecommendations(rows: AiSafetyFieldEvidenceRecommendationRow[]): AiSafetyFieldEvidenceSignal[] {
  return rows
    .map(fieldEvidenceSignalFromRecommendation)
    .filter((signal): signal is AiSafetyFieldEvidenceSignal => Boolean(signal));
}

export function linkFieldEvidenceSignalsToPredictiveContext(params: {
  signals: AiSafetyFieldEvidenceSignal[];
  dailyBriefing: DailyRiskBriefing;
  conflictMap: AiSafetyConflictMap;
}): AiSafetyFieldEvidenceSignal[] {
  return params.signals.map((signal) => {
    const text = signalText(signal);
    let bestWork: { work: PredictiveSafetyWorkItem; score: number } | null = null;
    for (const work of params.dailyBriefing.highRiskWork) {
      if (signal.jobsiteId && work.jobsiteId && signal.jobsiteId !== work.jobsiteId) continue;
      const score = matchScore(text, workText(work));
      if (!bestWork || score > bestWork.score) bestWork = { work, score };
    }
    const bestConflict = params.conflictMap.findings
      .filter((conflict) => !signal.jobsiteId || !conflict.jobsiteId || signal.jobsiteId === conflict.jobsiteId)
      .map((conflict) => ({
        conflict,
        score: matchScore(text, normalize(`${conflict.title} ${conflict.reason} ${conflict.dataUsed.join(" ")} ${conflict.requiredVerification}`)),
      }))
      .sort((a, b) => b.score - a.score)[0] ?? null;
    const linkedWork = bestWork && bestWork.score >= 1 ? bestWork.work : null;
    const linkedConflict = bestConflict && bestConflict.score >= 1 ? bestConflict.conflict : null;
    const linked = Boolean(linkedWork || linkedConflict);
    return {
      ...signal,
      confidence: linked ? signal.confidence : lowerConfidenceForUnlinked(signal),
      linkedWorkItemId: linkedWork?.id ?? null,
      linkedWorkTitle: linkedWork?.title ?? null,
      linkedConflictId: linkedConflict?.id ?? null,
      linkedConflictTitle: linkedConflict?.title ?? null,
      missingInformation: linked
        ? signal.missingInformation
        : [
            ...signal.missingInformation,
            "No matching scheduled work or conflict was linked; verify jobsite, area, task, and crew context.",
          ].slice(0, 12),
    };
  });
}
