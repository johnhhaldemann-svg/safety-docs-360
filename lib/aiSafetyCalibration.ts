import type { LeadershipEvidenceRef } from "@/lib/leadershipTrust";

export type AiSafetyCalibrationConfidence = "low" | "medium" | "high";

export type AiSafetyCalibrationRecommendationRow = {
  id?: string | null;
  kind?: string | null;
  title?: string | null;
  body?: string | null;
  status?: string | null;
  priority?: string | null;
  created_at?: string | null;
  due_at?: string | null;
  accepted_at?: string | null;
  field_used_at?: string | null;
  resolved_at?: string | null;
  dismissed_at?: string | null;
  target_module?: string | null;
  target_href?: string | null;
  jobsite_id?: string | null;
  mitigation_state?: string | null;
  risk_reduction_points?: number | null;
  evidence_summary?: unknown;
};

export type AiSafetyCalibrationEventRow = {
  id?: string | null;
  recommendation_id?: string | null;
  event_type?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  metadata?: unknown;
  created_at?: string | null;
};

export type AiSafetyCalibrationOutcomeRow = {
  id?: string | null;
  sourceType: "incident" | "near_miss" | "observation" | "corrective_action";
  title?: string | null;
  category?: string | null;
  hazardCategory?: string | null;
  severity?: string | null;
  status?: string | null;
  jobsiteId?: string | null;
  trade?: string | null;
  createdAt?: string | null;
  href?: string | null;
  predictionValidationStatus?: string | null;
  predictionReviewRating?: number | null;
  predictionReviewTags?: string[];
};

export type PredictiveSafetyCalibrationAdjustment = {
  id: string;
  type: "validated_positive" | "missed_high_risk_outcome" | "false_positive_softening" | "critical_review_required";
  hazardKey: string;
  hazardLabel: string;
  jobsiteId: string | null;
  trade: string | null;
  riskLevel: "high" | "critical";
  weight: number;
  reason: string;
  evidenceRefs: LeadershipEvidenceRef[];
};

export type PredictiveSafetyCalibrationProfile = {
  status: "active" | "insufficient_data";
  confidence: AiSafetyCalibrationConfidence;
  adjustments: PredictiveSafetyCalibrationAdjustment[];
  topHazardPatterns: Array<{
    label: string;
    count: number;
    missedHighRiskCount: number;
    falsePositiveCount: number;
    validatedPositiveCount: number;
  }>;
  missingData: string[];
  evidenceRefs: LeadershipEvidenceRef[];
};

export type AiSafetyExecutiveTrendSummary = AiSafetyCalibrationReport["aiExecutiveTrendSummary"];

export type AiSafetyCalibrationReport = {
  summary: {
    generatedAt: string;
    windowDays: number;
    status: "active" | "insufficient_data";
    predictedHighRiskCount: number;
    predictedCriticalCount: number;
    likelyTruePositiveCount: number;
    falsePositiveCount: number;
    missedHighRiskEventCount: number;
    insufficientDataCount: number;
    confidence: AiSafetyCalibrationConfidence;
  };
  actionOutcomes: {
    totalAiActions: number;
    activeCount: number;
    acceptedCount: number;
    assignedCount: number;
    fieldUsedCount: number;
    resolvedCount: number;
    dismissedCount: number;
    overdueCount: number;
    recommendationAcceptanceRate: number | null;
    fieldUsedControlCount: number;
    riskReductionPoints: number;
  };
  predictionOutcomes: {
    likelyTruePositives: Array<{ id: string; title: string; reason: string; evidenceRefs: LeadershipEvidenceRef[] }>;
    falsePositives: Array<{ id: string; title: string; reason: string; evidenceRefs: LeadershipEvidenceRef[] }>;
    missedHighRiskEvents: Array<{ id: string; title: string; reason: string; evidenceRefs: LeadershipEvidenceRef[] }>;
    insufficientData: Array<{ id: string; title: string; reason: string }>;
    followUpNeeded: Array<{ id: string; title: string; reason: string; evidenceRefs: LeadershipEvidenceRef[] }>;
  };
  trendSummary: {
    topHazards: Array<{ label: string; count: number }>;
    topJobsites: Array<{ jobsiteId: string; count: number }>;
    topTrades: Array<{ trade: string; count: number }>;
    acceptedVsDismissed: { accepted: number; dismissed: number };
  };
  executiveSummary: string;
  aiExecutiveTrendSummary: {
    headline: string;
    bullets: string[];
    recommendedLeadershipActions: string[];
  };
  evidenceRefs: LeadershipEvidenceRef[];
  missingData: string[];
  confidence: AiSafetyCalibrationConfidence;
};

function clean(value: string | number | boolean | null | undefined) {
  return String(value ?? "").trim();
}

function normalize(value: string | number | boolean | null | undefined) {
  return clean(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string, fallback: string) {
  const raw = clean(value) || fallback;
  return raw.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function isHighRisk(value: string | null | undefined) {
  const v = normalize(value);
  return v === "high" || v === "critical" || v.includes("sif") || v.includes("stop work");
}

function isCritical(value: string | null | undefined) {
  return normalize(value) === "critical";
}

function isOverdue(row: AiSafetyCalibrationRecommendationRow, now: Date) {
  const status = recommendationWorkflowStatus(row);
  if (["resolved", "dismissed", "field_used"].includes(status)) return false;
  if (!row.due_at) return false;
  const due = Date.parse(row.due_at);
  return Number.isFinite(due) && due < now.getTime();
}

function recommendationWorkflowStatus(row: AiSafetyCalibrationRecommendationRow) {
  const status = normalize(row.status || row.mitigation_state || "active");
  if (row.dismissed_at || status === "dismissed") return "dismissed";
  if (row.resolved_at || status === "resolved") return "resolved";
  if (row.field_used_at || status === "field used" || status === "field_used") return "field_used";
  if (status === "assigned") return "assigned";
  if (row.accepted_at || status === "accepted") return "accepted";
  return "active";
}

function evidenceSummaryObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function aiSafetyActionObject(row: AiSafetyCalibrationRecommendationRow): Record<string, unknown> {
  const summary = evidenceSummaryObject(row.evidence_summary);
  const action = summary.aiSafetyAction;
  return action && typeof action === "object" && !Array.isArray(action) ? (action as Record<string, unknown>) : {};
}

function evidenceRefsFromSummary(value: unknown): LeadershipEvidenceRef[] {
  const summary = evidenceSummaryObject(value);
  const refs = Array.isArray(summary.evidenceRefs) ? summary.evidenceRefs : [];
  const out: LeadershipEvidenceRef[] = [];
  for (const ref of refs) {
    if (!ref || typeof ref !== "object" || Array.isArray(ref)) continue;
    const item = ref as Record<string, unknown>;
    const id = clean(item.id as string | null | undefined);
    const label = clean(item.label as string | null | undefined);
    if (!id || !label) continue;
    out.push({
      id,
      label,
      href: clean(item.href as string | null | undefined) || "/analytics/predictive-model",
      sourceModule: clean(item.sourceModule as string | null | undefined) || "ai_safety_action",
      sourceId: clean(item.sourceId as string | null | undefined) || null,
      detail: clean(item.detail as string | null | undefined) || undefined,
    });
  }
  return out;
}

function recommendationHazardKey(row: AiSafetyCalibrationRecommendationRow) {
  const action = aiSafetyActionObject(row);
  return normalize(
    [
      action.category as string | undefined,
      action.sourceWorkTitle as string | undefined,
      action.recommendedControl as string | undefined,
      row.title,
      row.body,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function outcomeHazardKey(row: AiSafetyCalibrationOutcomeRow) {
  return normalize([row.hazardCategory, row.category, row.title].filter(Boolean).join(" "));
}

function recommendationTrade(row: AiSafetyCalibrationRecommendationRow) {
  const action = aiSafetyActionObject(row);
  return clean(action.trade as string | null | undefined);
}

function recommendationRiskLevel(row: AiSafetyCalibrationRecommendationRow) {
  const action = aiSafetyActionObject(row);
  return clean(row.priority || (action.riskLevel as string | undefined));
}

function recommendationJobsiteId(row: AiSafetyCalibrationRecommendationRow) {
  const action = aiSafetyActionObject(row);
  return clean(row.jobsite_id) || clean(action.jobsiteId as string | null | undefined) || "unassigned";
}

function evidenceRefForRecommendation(row: AiSafetyCalibrationRecommendationRow): LeadershipEvidenceRef {
  return {
    id: `ai-action-${row.id ?? row.title ?? "unknown"}`,
    label: clean(row.title) || "AI safety action",
    href: clean(row.target_href) || "/analytics/predictive-model",
    sourceModule: clean(row.target_module) || "company_risk_ai_recommendations",
    sourceId: clean(row.id) || null,
    detail: clean(row.status) || undefined,
  };
}

function evidenceRefForOutcome(row: AiSafetyCalibrationOutcomeRow): LeadershipEvidenceRef {
  return {
    id: `${row.sourceType}-${row.id ?? row.title ?? "unknown"}`,
    label: clean(row.title) || titleCase(row.sourceType, "Outcome"),
    href: row.href ?? (row.sourceType === "incident" || row.sourceType === "near_miss" ? "/incidents" : "/field-id-exchange"),
    sourceModule:
      row.sourceType === "incident" || row.sourceType === "near_miss"
        ? "company_incidents"
        : row.sourceType === "observation"
          ? "company_sor_records"
          : "company_corrective_actions",
    sourceId: clean(row.id) || null,
    detail: clean(row.severity || row.category) || undefined,
  };
}

function matchesRecommendationOutcome(rec: AiSafetyCalibrationRecommendationRow, outcome: AiSafetyCalibrationOutcomeRow) {
  if (rec.created_at && outcome.createdAt) {
    const recTime = Date.parse(rec.created_at);
    const outcomeTime = Date.parse(outcome.createdAt);
    if (Number.isFinite(recTime) && Number.isFinite(outcomeTime) && outcomeTime < recTime) return false;
  }
  const recJobsite = recommendationJobsiteId(rec);
  const outcomeJobsite = clean(outcome.jobsiteId) || "unassigned";
  const sameJobsite = recJobsite === "unassigned" || outcomeJobsite === "unassigned" || recJobsite === outcomeJobsite;
  if (!sameJobsite) return false;
  const recHazard = recommendationHazardKey(rec);
  const outcomeHazard = outcomeHazardKey(outcome);
  if (!recHazard || !outcomeHazard) return true;
  const outcomeTokens = outcomeHazard.split(" ").filter((token) => token.length >= 4);
  return outcomeTokens.some((token) => recHazard.includes(token));
}

function increment(map: Map<string, number>, key: string | null | undefined) {
  const cleanKey = clean(key);
  if (!cleanKey) return;
  map.set(cleanKey, (map.get(cleanKey) ?? 0) + 1);
}

function topRows(map: Map<string, number>, label: string, limit = 5) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ label: titleCase(value, label), count }));
}

function recordText(row: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = clean(row[key] as string | number | boolean | null | undefined);
    if (value) return value;
  }
  return fallback;
}

function recordNumber(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function recordStringArray(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (Array.isArray(value)) {
      return value.map((item) => clean(item as string | number | boolean | null | undefined)).filter(Boolean);
    }
    const text = clean(value as string | number | boolean | null | undefined);
    if (text) return [text];
  }
  return [];
}

function sourceTypeForIncident(row: Record<string, unknown>): AiSafetyCalibrationOutcomeRow["sourceType"] {
  const text = normalize([row.incident_type, row.category, row.title].filter(Boolean).join(" "));
  return text.includes("near") ? "near_miss" : "incident";
}

function sourceTypeForAction(row: Record<string, unknown>): AiSafetyCalibrationOutcomeRow["sourceType"] {
  const text = normalize([row.observation_type, row.category, row.title].filter(Boolean).join(" "));
  return text.includes("near") || text.includes("observation") ? "observation" : "corrective_action";
}

export function buildAiSafetyCalibrationOutcomeRows(input: {
  correctiveActions?: Array<Record<string, unknown>>;
  incidents?: Array<Record<string, unknown>>;
  observations?: Array<Record<string, unknown>>;
}): AiSafetyCalibrationOutcomeRow[] {
  const correctiveActions = input.correctiveActions ?? [];
  const incidents = input.incidents ?? [];
  const observations = input.observations ?? [];

  return [
    ...correctiveActions.map((row) => ({
      id: recordText(row, ["id"], "corrective-action"),
      sourceType: sourceTypeForAction(row),
      title: recordText(row, ["title", "description", "category"], "Corrective action"),
      category: recordText(row, ["category", "observation_type"], null as never),
      hazardCategory: recordText(row, ["sif_category", "hazard_category", "hazard_category_code", "category"], null as never),
      severity: recordText(row, ["severity", "priority"], null as never),
      status: recordText(row, ["status"], null as never),
      jobsiteId: recordText(row, ["jobsite_id", "jobsiteId"], null as never),
      trade: recordText(row, ["trade", "crew_trade"], null as never),
      createdAt: recordText(row, ["created_at", "closed_at"], null as never),
      href: "/field-id-exchange",
      predictionValidationStatus: recordText(row, ["prediction_validation_status", "predictionValidationStatus"], null as never),
      predictionReviewRating: recordNumber(row, ["prediction_review_rating", "predictionReviewRating"]),
      predictionReviewTags: recordStringArray(row, ["prediction_review_tags", "predictionReviewTags"]),
    })),
    ...incidents.map((row) => ({
      id: recordText(row, ["id"], "incident"),
      sourceType: sourceTypeForIncident(row),
      title: recordText(row, ["title", "description", "category", "incident_type"], "Incident or near miss"),
      category: recordText(row, ["incident_type", "category"], null as never),
      hazardCategory: recordText(row, ["hazard_category", "sif_category", "category"], null as never),
      severity: recordText(row, ["severity", "escalation_level"], null as never),
      status: recordText(row, ["status"], null as never),
      jobsiteId: recordText(row, ["jobsite_id", "jobsiteId"], null as never),
      trade: recordText(row, ["trade", "crew_trade"], null as never),
      createdAt: recordText(row, ["created_at", "incident_date"], null as never),
      href: "/incidents",
      predictionValidationStatus: recordText(row, ["prediction_validation_status", "predictionValidationStatus"], null as never),
      predictionReviewRating: recordNumber(row, ["prediction_review_rating", "predictionReviewRating"]),
      predictionReviewTags: recordStringArray(row, ["prediction_review_tags", "predictionReviewTags"]),
    })),
    ...observations.map((row) => ({
      id: recordText(row, ["id"], "observation"),
      sourceType: "observation" as const,
      title: recordText(row, ["description", "title", "subcategory", "category"], "Field observation"),
      category: recordText(row, ["category", "subcategory"], null as never),
      hazardCategory: recordText(row, ["hazard_category_code", "hazard_category", "category"], null as never),
      severity: recordText(row, ["severity"], null as never),
      status: recordText(row, ["status"], null as never),
      jobsiteId: recordText(row, ["jobsite_id", "jobsiteId"], null as never),
      trade: recordText(row, ["trade", "crew_trade"], null as never),
      createdAt: recordText(row, ["date", "created_at"], null as never),
      href: "/field-id-exchange",
      predictionValidationStatus: recordText(row, ["prediction_validation_status", "predictionValidationStatus"], null as never),
      predictionReviewRating: recordNumber(row, ["prediction_review_rating", "predictionReviewRating"]),
      predictionReviewTags: recordStringArray(row, ["prediction_review_tags", "predictionReviewTags"]),
    })),
  ];
}

function confidenceFor(params: {
  totalAiActions: number;
  outcomes: number;
  missingData: string[];
}): AiSafetyCalibrationConfidence {
  if (params.totalAiActions >= 5 && params.outcomes >= 5 && params.missingData.length === 0) return "high";
  if (params.totalAiActions >= 2 || params.outcomes >= 2) return "medium";
  return "low";
}

function normalizedHazardLabel(value: string, fallback: string) {
  const raw = clean(value) || fallback;
  return titleCase(raw, fallback);
}

function hazardLabelForOutcome(row: AiSafetyCalibrationOutcomeRow) {
  return normalizedHazardLabel(row.hazardCategory || row.category || row.title || row.sourceType, "Outcome");
}

function hazardLabelForRecommendation(row: AiSafetyCalibrationRecommendationRow) {
  const action = aiSafetyActionObject(row);
  return normalizedHazardLabel(
    clean(action.category as string | null | undefined) ||
      clean(action.sourceWorkTitle as string | null | undefined) ||
      clean(row.title),
    "AI Safety Action"
  );
}

function calibrationHazardKey(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 4)
    .slice(0, 5)
    .join(" ");
}

function outcomeValidationWeight(row: AiSafetyCalibrationOutcomeRow) {
  const status = normalize(row.predictionValidationStatus);
  if (status === "rejected") return 0;
  const rating = Number(row.predictionReviewRating ?? 0);
  const statusWeight = status === "approved" ? 1.25 : status === "pending" || !status ? 0.75 : 1;
  const ratingWeight = rating >= 4 ? 0.25 : rating > 0 && rating <= 2 ? -0.25 : 0;
  return Math.max(0.25, statusWeight + ratingWeight);
}

function riskLevelForOutcome(row: AiSafetyCalibrationOutcomeRow): "high" | "critical" {
  return isCritical(row.severity) || normalize(row.severity).includes("fatal") ? "critical" : "high";
}

function riskLevelForRecommendation(row: AiSafetyCalibrationRecommendationRow): "high" | "critical" {
  return isCritical(recommendationRiskLevel(row)) ? "critical" : "high";
}

function adjustmentWeight(level: "high" | "critical", validationWeight = 1) {
  return Math.round((level === "critical" ? 5 : 4) * validationWeight * 10) / 10;
}

function calibrationConfidence(params: {
  recommendationCount: number;
  outcomeCount: number;
  adjustmentCount: number;
  missingData: string[];
}): AiSafetyCalibrationConfidence {
  if (params.recommendationCount >= 5 && params.outcomeCount >= 5 && params.adjustmentCount >= 3 && params.missingData.length === 0) return "high";
  if (params.recommendationCount >= 2 || params.outcomeCount >= 2 || params.adjustmentCount > 0) return "medium";
  return "low";
}

function topHazardPatterns(adjustments: PredictiveSafetyCalibrationAdjustment[]) {
  const map = new Map<
    string,
    {
      label: string;
      count: number;
      missedHighRiskCount: number;
      falsePositiveCount: number;
      validatedPositiveCount: number;
    }
  >();
  for (const adjustment of adjustments) {
    const key = adjustment.hazardKey || adjustment.hazardLabel.toLowerCase();
    const existing = map.get(key) ?? {
      label: adjustment.hazardLabel,
      count: 0,
      missedHighRiskCount: 0,
      falsePositiveCount: 0,
      validatedPositiveCount: 0,
    };
    existing.count += 1;
    if (adjustment.type === "missed_high_risk_outcome") existing.missedHighRiskCount += 1;
    if (adjustment.type === "false_positive_softening") existing.falsePositiveCount += 1;
    if (adjustment.type === "validated_positive") existing.validatedPositiveCount += 1;
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 6);
}

export function buildPredictiveSafetyCalibrationProfile(input: {
  recommendations?: AiSafetyCalibrationRecommendationRow[];
  events?: AiSafetyCalibrationEventRow[];
  outcomes?: AiSafetyCalibrationOutcomeRow[];
  now?: Date;
}): PredictiveSafetyCalibrationProfile {
  const recommendations = (input.recommendations ?? []).filter(
    (row) => normalize(row.kind) === "ai safety action" || normalize(row.kind) === "ai_safety_action"
  );
  const outcomes = (input.outcomes ?? []).filter((row) => normalize(row.predictionValidationStatus) !== "rejected");
  const highRiskRecommendations = recommendations.filter((row) => isHighRisk(recommendationRiskLevel(row)));
  const highRiskOutcomes = outcomes.filter((row) => isHighRisk(row.severity) || row.sourceType === "incident" || row.sourceType === "near_miss");
  const adjustments: PredictiveSafetyCalibrationAdjustment[] = [];

  for (const outcome of highRiskOutcomes) {
    const match = highRiskRecommendations.find((rec) => matchesRecommendationOutcome(rec, outcome));
    const outcomeId = clean(outcome.id) || clean(outcome.title) || `${outcome.sourceType}-${adjustments.length}`;
    const hazardLabel = hazardLabelForOutcome(outcome);
    const riskLevel = riskLevelForOutcome(outcome);
    if (match) {
      adjustments.push({
        id: `validated-${outcomeId}`,
        type: "validated_positive",
        hazardKey: calibrationHazardKey(`${hazardLabel} ${recommendationHazardKey(match)}`),
        hazardLabel,
        jobsiteId: clean(outcome.jobsiteId) || recommendationJobsiteId(match) || null,
        trade: clean(outcome.trade) || recommendationTrade(match) || null,
        riskLevel,
        weight: adjustmentWeight(riskLevel, outcomeValidationWeight(outcome)),
        reason: "A later high-risk outcome matched an AI safety action pattern, so future similar work should preserve or increase review pressure.",
        evidenceRefs: [evidenceRefForRecommendation(match), evidenceRefForOutcome(outcome)].slice(0, 4),
      });
      continue;
    }
    adjustments.push({
      id: `missed-${outcomeId}`,
      type: "missed_high_risk_outcome",
      hazardKey: calibrationHazardKey(`${outcome.hazardCategory ?? ""} ${outcome.category ?? ""} ${outcome.title ?? ""}`),
      hazardLabel,
      jobsiteId: clean(outcome.jobsiteId) || null,
      trade: clean(outcome.trade) || null,
      riskLevel,
      weight: adjustmentWeight(riskLevel, outcomeValidationWeight(outcome)),
      reason: "A later high-risk outcome did not match a loaded AI safety action; future similar work should be treated more conservatively.",
      evidenceRefs: [evidenceRefForOutcome(outcome)],
    });
  }

  for (const rec of recommendations) {
    const status = recommendationWorkflowStatus(rec);
    if (status !== "dismissed") continue;
    const riskLevel = riskLevelForRecommendation(rec);
    const id = clean(rec.id) || clean(rec.title) || `dismissed-${adjustments.length}`;
    const hazardLabel = hazardLabelForRecommendation(rec);
    if (riskLevel === "critical") {
      adjustments.push({
        id: `critical-review-${id}`,
        type: "critical_review_required",
        hazardKey: calibrationHazardKey(`${hazardLabel} ${recommendationHazardKey(rec)}`),
        hazardLabel,
        jobsiteId: recommendationJobsiteId(rec) || null,
        trade: recommendationTrade(rec) || null,
        riskLevel,
        weight: adjustmentWeight(riskLevel),
        reason: "A dismissed critical AI safety action still requires leadership review and cannot be hidden by false-positive logic.",
        evidenceRefs: [evidenceRefForRecommendation(rec), ...evidenceRefsFromSummary(rec.evidence_summary)].slice(0, 4),
      });
      continue;
    }
    adjustments.push({
      id: `false-positive-${id}`,
      type: "false_positive_softening",
      hazardKey: calibrationHazardKey(`${hazardLabel} ${recommendationHazardKey(rec)}`),
      hazardLabel,
      jobsiteId: recommendationJobsiteId(rec) || null,
      trade: recommendationTrade(rec) || null,
      riskLevel,
      weight: -1,
      reason: "A similar non-critical AI safety action was dismissed; duplicate non-critical actions should require stronger evidence.",
      evidenceRefs: [evidenceRefForRecommendation(rec), ...evidenceRefsFromSummary(rec.evidence_summary)].slice(0, 4),
    });
  }

  const missingData = [
    ...(recommendations.length === 0 ? ["No persisted AI safety actions were available for calibration in this window."] : []),
    ...(outcomes.length === 0 ? ["No later incident, near-miss, observation, or corrective-action outcomes were available for calibration."] : []),
    ...(input.events && input.events.length === 0 ? ["No recommendation event history was available for calibration timing."] : []),
  ];
  const confidence = calibrationConfidence({
    recommendationCount: recommendations.length,
    outcomeCount: outcomes.length,
    adjustmentCount: adjustments.length,
    missingData,
  });

  return {
    status: recommendations.length > 0 && outcomes.length > 0 ? "active" : "insufficient_data",
    confidence,
    adjustments: adjustments.slice(0, 24),
    topHazardPatterns: topHazardPatterns(adjustments),
    missingData,
    evidenceRefs: [
      ...adjustments.flatMap((adjustment) => adjustment.evidenceRefs),
      ...recommendations.slice(0, 3).map(evidenceRefForRecommendation),
      ...outcomes.slice(0, 3).map(evidenceRefForOutcome),
    ].slice(0, 10),
  };
}

export function buildAiSafetyCalibrationReport(input: {
  windowDays: number;
  recommendations: AiSafetyCalibrationRecommendationRow[];
  events?: AiSafetyCalibrationEventRow[];
  outcomes: AiSafetyCalibrationOutcomeRow[];
  now?: Date;
}): AiSafetyCalibrationReport {
  const now = input.now ?? new Date();
  const recommendations = input.recommendations.filter((row) => normalize(row.kind) === "ai safety action" || normalize(row.kind) === "ai_safety_action");
  const totalAiActions = recommendations.length;
  const statusCounts = {
    active: 0,
    accepted: 0,
    assigned: 0,
    fieldUsed: 0,
    resolved: 0,
    dismissed: 0,
    overdue: 0,
  };
  let riskReductionPoints = 0;
  let predictedHighRiskCount = 0;
  let predictedCriticalCount = 0;
  const highRiskRecommendations: AiSafetyCalibrationRecommendationRow[] = [];
  const topHazardsMap = new Map<string, number>();
  const topJobsitesMap = new Map<string, number>();
  const topTradesMap = new Map<string, number>();

  for (const row of recommendations) {
    const status = recommendationWorkflowStatus(row);
    if (status === "accepted") statusCounts.accepted += 1;
    else if (status === "assigned") statusCounts.assigned += 1;
    else if (status === "field_used") statusCounts.fieldUsed += 1;
    else if (status === "resolved") statusCounts.resolved += 1;
    else if (status === "dismissed") statusCounts.dismissed += 1;
    else statusCounts.active += 1;
    if (isOverdue(row, now)) statusCounts.overdue += 1;
    const priority = recommendationRiskLevel(row);
    if (isHighRisk(priority)) {
      predictedHighRiskCount += 1;
      highRiskRecommendations.push(row);
    }
    if (isCritical(priority)) predictedCriticalCount += 1;
    const action = aiSafetyActionObject(row);
    increment(topHazardsMap, action.category as string | undefined);
    increment(topJobsitesMap, recommendationJobsiteId(row));
    increment(topTradesMap, recommendationTrade(row));
    if (status === "field_used" || status === "resolved") {
      riskReductionPoints += Math.max(0, Number(row.risk_reduction_points ?? 0));
    }
  }

  const reviewedPositive = statusCounts.accepted + statusCounts.assigned + statusCounts.fieldUsed + statusCounts.resolved;
  const reviewedTotal = reviewedPositive + statusCounts.dismissed;
  const recommendationAcceptanceRate = reviewedTotal > 0 ? Number(((reviewedPositive / reviewedTotal) * 100).toFixed(1)) : null;

  const highRiskOutcomes = input.outcomes.filter((row) => isHighRisk(row.severity) || row.sourceType === "incident" || row.sourceType === "near_miss");
  const matchedOutcomeIds = new Set<string>();
  const likelyTruePositives = recommendations
    .filter((row) => {
      const status = recommendationWorkflowStatus(row);
      return status === "field_used" || status === "resolved";
    })
    .slice(0, 12)
    .map((row) => ({
      id: clean(row.id) || clean(row.title) || "ai-action",
      title: clean(row.title) || "AI safety action",
      reason: "The recommendation was field-used or resolved with verification, so it counts as positive follow-through rather than proof of causation.",
      evidenceRefs: [evidenceRefForRecommendation(row), ...evidenceRefsFromSummary(row.evidence_summary)].slice(0, 4),
    }));

  const falsePositives = recommendations
    .filter((row) => recommendationWorkflowStatus(row) === "dismissed" && !isCritical(recommendationRiskLevel(row)))
    .slice(0, 12)
    .map((row) => ({
      id: clean(row.id) || clean(row.title) || "dismissed-action",
      title: clean(row.title) || "Dismissed AI safety action",
      reason: "The recommendation was dismissed, so it lowers acceptance and receives no mitigation credit.",
      evidenceRefs: [evidenceRefForRecommendation(row), ...evidenceRefsFromSummary(row.evidence_summary)].slice(0, 4),
    }));

  const followUpNeeded: AiSafetyCalibrationReport["predictionOutcomes"]["followUpNeeded"] = [];
  for (const outcome of highRiskOutcomes) {
    const match = highRiskRecommendations.find((rec) => matchesRecommendationOutcome(rec, outcome));
    if (!match) continue;
    const outcomeId = clean(outcome.id) || clean(outcome.title) || `${outcome.sourceType}-${followUpNeeded.length}`;
    matchedOutcomeIds.add(outcomeId);
    followUpNeeded.push({
      id: outcomeId,
      title: clean(outcome.title) || titleCase(outcome.sourceType, "Outcome"),
      reason: "A later high-risk outcome appeared near an AI prediction/action pattern; leadership should review whether controls were verified in the field.",
      evidenceRefs: [evidenceRefForRecommendation(match), evidenceRefForOutcome(outcome)].slice(0, 4),
    });
    if (followUpNeeded.length >= 12) break;
  }

  const missedHighRiskEvents = highRiskOutcomes
    .filter((outcome) => {
      const id = clean(outcome.id) || clean(outcome.title) || `${outcome.sourceType}`;
      return !matchedOutcomeIds.has(id) && !highRiskRecommendations.some((rec) => matchesRecommendationOutcome(rec, outcome));
    })
    .slice(0, 12)
    .map((outcome) => ({
      id: clean(outcome.id) || clean(outcome.title) || "missed-outcome",
      title: clean(outcome.title) || titleCase(outcome.sourceType, "Outcome"),
      reason: "This high-risk outcome did not match a loaded AI safety action by jobsite/hazard in the selected window.",
      evidenceRefs: [evidenceRefForOutcome(outcome)],
    }));

  const insufficientData = [
    ...(totalAiActions === 0
      ? [{ id: "no-ai-actions", title: "No AI safety actions", reason: "No persisted AI safety actions were available for calibration in this window." }]
      : []),
    ...(input.outcomes.length === 0
      ? [{ id: "no-outcomes", title: "No later outcomes", reason: "No incident, near-miss, observation, or corrective-action outcomes were available in this window." }]
      : []),
    ...(input.events && input.events.length === 0
      ? [{ id: "no-events", title: "No recommendation events", reason: "Recommendation event history was not available, so workflow timing could not be calibrated." }]
      : []),
    ...recommendations
      .filter((row) => recommendationWorkflowStatus(row) === "dismissed" && isCritical(recommendationRiskLevel(row)))
      .slice(0, 6)
      .map((row) => ({
        id: clean(row.id) || clean(row.title) || "dismissed-critical-action",
        title: clean(row.title) || "Dismissed critical AI action",
        reason: "A dismissed critical AI action still requires leadership review; false-positive logic must not hide critical risk.",
      })),
  ];

  const missingData = insufficientData.map((item) => item.reason);
  const confidence = confidenceFor({ totalAiActions, outcomes: input.outcomes.length, missingData });
  const status: AiSafetyCalibrationReport["summary"]["status"] =
    totalAiActions > 0 && input.outcomes.length > 0 ? "active" : "insufficient_data";
  const executiveSummary =
    status === "insufficient_data"
      ? "AI Engine calibration needs more persisted AI actions and later field outcomes before leadership should treat trend results as stable."
      : `${totalAiActions} AI safety action${totalAiActions === 1 ? "" : "s"} were reviewed against ${input.outcomes.length} field outcome${input.outcomes.length === 1 ? "" : "s"}; use this as a follow-up signal, not proof of causation.`;
  const bullets = [
    `${predictedHighRiskCount} high/critical AI action${predictedHighRiskCount === 1 ? "" : "s"} in the window.`,
    `${statusCounts.fieldUsed + statusCounts.resolved} action${statusCounts.fieldUsed + statusCounts.resolved === 1 ? "" : "s"} field-used or resolved.`,
    `${statusCounts.dismissed} dismissed recommendation${statusCounts.dismissed === 1 ? "" : "s"} with no mitigation credit.`,
    `${missedHighRiskEvents.length} missed high-risk event candidate${missedHighRiskEvents.length === 1 ? "" : "s"} to review.`,
  ];

  return {
    summary: {
      generatedAt: now.toISOString(),
      windowDays: input.windowDays,
      status,
      predictedHighRiskCount,
      predictedCriticalCount,
      likelyTruePositiveCount: likelyTruePositives.length,
      falsePositiveCount: falsePositives.length,
      missedHighRiskEventCount: missedHighRiskEvents.length,
      insufficientDataCount: insufficientData.length,
      confidence,
    },
    actionOutcomes: {
      totalAiActions,
      activeCount: statusCounts.active,
      acceptedCount: statusCounts.accepted,
      assignedCount: statusCounts.assigned,
      fieldUsedCount: statusCounts.fieldUsed,
      resolvedCount: statusCounts.resolved,
      dismissedCount: statusCounts.dismissed,
      overdueCount: statusCounts.overdue,
      recommendationAcceptanceRate,
      fieldUsedControlCount: statusCounts.fieldUsed,
      riskReductionPoints,
    },
    predictionOutcomes: {
      likelyTruePositives,
      falsePositives,
      missedHighRiskEvents,
      insufficientData,
      followUpNeeded,
    },
    trendSummary: {
      topHazards: topRows(topHazardsMap, "Hazard"),
      topJobsites: [...topJobsitesMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([jobsiteId, count]) => ({ jobsiteId, count })),
      topTrades: [...topTradesMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([trade, count]) => ({ trade, count })),
      acceptedVsDismissed: { accepted: reviewedPositive, dismissed: statusCounts.dismissed },
    },
    executiveSummary,
    aiExecutiveTrendSummary: {
      headline: status === "active" ? "AI Engine calibration is active for this reporting window." : "AI Engine calibration needs more outcome data.",
      bullets,
      recommendedLeadershipActions: [
        statusCounts.overdue > 0 ? "Assign owners to overdue AI safety actions before the next briefing." : null,
        missedHighRiskEvents.length > 0 ? "Review missed high-risk event candidates for missing schedule, JSA, permit, training, or observation signals." : null,
        followUpNeeded.length > 0 ? "Review follow-up-needed matches to confirm whether recommended controls were verified in the field." : null,
        confidence === "low" ? "Improve calibration confidence by syncing AI safety actions and recording field-used/resolved outcomes." : null,
      ].filter((item): item is string => Boolean(item)),
    },
    evidenceRefs: [
      ...recommendations.slice(0, 4).map(evidenceRefForRecommendation),
      ...input.outcomes.slice(0, 4).map(evidenceRefForOutcome),
    ],
    missingData,
    confidence,
  };
}
