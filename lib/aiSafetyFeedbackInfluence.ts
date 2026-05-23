import type { AiSafetyActionCategory, AiSafetyActionQueueItem } from "@/lib/aiSafetyActionQueue";
import type { SafetyRiskLevel } from "@/lib/safety-ai/types";

export type AiSafetyFeedbackKind =
  | "correct"
  | "partially_correct"
  | "not_correct"
  | "already_resolved"
  | "missing_information"
  | "escalate"
  | "ignore_for_project";

export type AiSafetyFeedbackConfidenceAdjustment = "increase" | "neutral" | "decrease";

export type AiSafetyFeedbackSignal = {
  id: string;
  kind: AiSafetyFeedbackKind;
  confidenceAdjustment: AiSafetyFeedbackConfidenceAdjustment;
  reason: string;
  sourceId: string | null;
  sourceKey: string | null;
  jobsiteId: string | null;
  category: string | null;
  hazardFamily: string | null;
  sourceWorkTitle: string | null;
  missingInformation: string[];
  suppressNonCritical: boolean;
  forceHumanReview: boolean;
  createdAt: string | null;
};

export type AiSafetyFeedbackRecommendationRow = {
  id?: string | null;
  title?: string | null;
  status?: string | null;
  priority?: string | null;
  jobsite_id?: string | null;
  evidence_summary?: unknown;
};

export type AiSafetyFeedbackEventRow = {
  id?: string | null;
  recommendation_id?: string | null;
  event_type?: string | null;
  to_status?: string | null;
  metadata?: unknown;
  created_at?: string | null;
};

export type AiOutputFeedbackSignalRow = {
  id?: string | number | null;
  created_at?: string | null;
  surface?: string | null;
  source_id?: string | null;
  outcome?: string | null;
  reason?: string | null;
  signal_metadata?: unknown;
};

function clean(value: unknown, max = 500) {
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

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function aiSafetyAction(value: unknown): Record<string, unknown> {
  const summary = objectValue(value);
  return objectValue(summary.aiSafetyAction);
}

function feedbackKindFrom(value: unknown, outcome?: unknown): AiSafetyFeedbackKind | null {
  const reason = normalize(value);
  const normalizedOutcome = normalize(outcome);
  if (reason === "correct" || normalizedOutcome === "accepted") return "correct";
  if (reason === "partially correct") return "partially_correct";
  if (reason === "not correct" || normalizedOutcome === "rejected") return "not_correct";
  if (reason === "already resolved" || normalizedOutcome === "field used") return "already_resolved";
  if (reason === "missing information") return "missing_information";
  if (reason === "escalate") return "escalate";
  if (reason === "ignore for project") return "ignore_for_project";
  return null;
}

function confidenceForKind(kind: AiSafetyFeedbackKind): AiSafetyFeedbackConfidenceAdjustment {
  if (kind === "correct" || kind === "already_resolved") return "increase";
  if (kind === "partially_correct" || kind === "not_correct" || kind === "ignore_for_project") return "decrease";
  return "neutral";
}

function reasonForKind(kind: AiSafetyFeedbackKind) {
  if (kind === "correct") return "Reviewer feedback marked a similar recommendation correct.";
  if (kind === "partially_correct") return "Reviewer feedback marked a similar recommendation partially correct; keep it active but ask for more context.";
  if (kind === "not_correct") return "Reviewer feedback marked a similar recommendation not correct; require stronger evidence for non-critical repeats.";
  if (kind === "already_resolved") return "Reviewer feedback marked a similar recommendation already resolved; suppress duplicate non-critical actions when scope matches.";
  if (kind === "missing_information") return "Reviewer feedback said similar recommendations were missing information.";
  if (kind === "escalate") return "Reviewer feedback requested escalation for a similar recommendation.";
  return "Reviewer feedback asked to ignore similar non-critical recommendations for this project.";
}

function signalFromRecommendation(
  row: AiSafetyFeedbackRecommendationRow,
  kind: AiSafetyFeedbackKind,
  source: { id: string; createdAt?: string | null; metadata?: unknown },
): AiSafetyFeedbackSignal {
  const action = aiSafetyAction(row.evidence_summary);
  const metadata = objectValue(source.metadata);
  return {
    id: source.id,
    kind,
    confidenceAdjustment: confidenceForKind(kind),
    reason: reasonForKind(kind),
    sourceId: clean(row.id) || null,
    sourceKey: clean(action.sourceKey) || clean(metadata.sourceKey) || null,
    jobsiteId: clean(row.jobsite_id) || clean(action.jobsiteId) || clean(metadata.jobsiteId) || null,
    category: clean(action.category) || clean(metadata.category) || null,
    hazardFamily: clean(metadata.hazardFamily) || clean(action.category) || null,
    sourceWorkTitle: clean(action.sourceWorkTitle) || clean(row.title) || null,
    missingInformation: kind === "missing_information" || kind === "partially_correct" ? ["Reviewer feedback flagged missing context for similar recommendations."] : [],
    suppressNonCritical: kind === "already_resolved" || kind === "ignore_for_project",
    forceHumanReview: kind === "escalate",
    createdAt: source.createdAt ?? null,
  };
}

function signalFromAiFeedback(row: AiOutputFeedbackSignalRow): AiSafetyFeedbackSignal | null {
  const metadata = objectValue(row.signal_metadata);
  const kind = feedbackKindFrom(metadata.recommendationFeedback ?? row.reason, row.outcome);
  if (!kind) return null;
  return {
    id: `ai-feedback-${row.id ?? row.source_id ?? row.created_at ?? kind}`,
    kind,
    confidenceAdjustment: confidenceForKind(kind),
    reason: reasonForKind(kind),
    sourceId: clean(row.source_id) || null,
    sourceKey: clean(metadata.sourceKey) || null,
    jobsiteId: clean(metadata.jobsiteId) || null,
    category: clean(metadata.category) || clean(metadata.hazardFamily) || null,
    hazardFamily: clean(metadata.hazardFamily) || clean(metadata.category) || null,
    sourceWorkTitle: clean(metadata.sourceWorkTitle) || null,
    missingInformation: kind === "missing_information" || kind === "partially_correct" ? ["Reviewer feedback flagged missing context for similar recommendations."] : [],
    suppressNonCritical: kind === "already_resolved" || kind === "ignore_for_project",
    forceHumanReview: kind === "escalate",
    createdAt: row.created_at ?? null,
  };
}

function eventKind(event: AiSafetyFeedbackEventRow): AiSafetyFeedbackKind | null {
  const eventType = normalize(event.event_type);
  const toStatus = normalize(event.to_status);
  if (eventType === "field used" || toStatus === "field used" || toStatus === "field_used") return "already_resolved";
  if (eventType === "resolved" || toStatus === "resolved") return "already_resolved";
  if (eventType === "accepted" || toStatus === "accepted" || eventType === "assigned" || toStatus === "assigned") return "correct";
  if (eventType === "dismissed" || toStatus === "dismissed") return "not_correct";
  return null;
}

export function buildAiSafetyFeedbackSignals(input: {
  recommendations?: AiSafetyFeedbackRecommendationRow[];
  events?: AiSafetyFeedbackEventRow[];
  aiOutputFeedback?: AiOutputFeedbackSignalRow[];
}): AiSafetyFeedbackSignal[] {
  const recommendationById = new Map<string, AiSafetyFeedbackRecommendationRow>();
  for (const row of input.recommendations ?? []) {
    const id = clean(row.id);
    if (id) recommendationById.set(id, row);
  }

  const signals: AiSafetyFeedbackSignal[] = [];
  for (const event of input.events ?? []) {
    const kind = eventKind(event);
    const rec = recommendationById.get(clean(event.recommendation_id));
    if (!kind || !rec) continue;
    signals.push(
      signalFromRecommendation(rec, kind, {
        id: `recommendation-event-${event.id ?? event.recommendation_id ?? event.created_at ?? kind}`,
        createdAt: event.created_at,
        metadata: event.metadata,
      }),
    );
  }

  for (const row of input.aiOutputFeedback ?? []) {
    const surface = normalize(row.surface);
    if (!surface.startsWith("ai engine") && !surface.startsWith("risk action plan")) continue;
    const signal = signalFromAiFeedback(row);
    if (signal) signals.push(signal);
  }

  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = [signal.kind, signal.sourceId, signal.sourceKey, signal.jobsiteId, signal.category, signal.hazardFamily].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function signalText(signal: AiSafetyFeedbackSignal) {
  return normalize([signal.category, signal.hazardFamily, signal.sourceWorkTitle, signal.sourceId].filter(Boolean).join(" "));
}

function itemText(item: Pick<AiSafetyActionQueueItem, "category" | "sourceWorkTitle" | "title" | "recommendedControl" | "sourceWorkItemId">) {
  return normalize([item.category, item.sourceWorkTitle, item.title, item.recommendedControl, item.sourceWorkItemId].filter(Boolean).join(" "));
}

function categoryMatches(signal: AiSafetyFeedbackSignal, category: AiSafetyActionCategory) {
  const signalCategory = normalize(signal.category ?? signal.hazardFamily);
  const itemCategory = normalize(category);
  if (!signalCategory) return true;
  return itemCategory.includes(signalCategory) || signalCategory.includes(itemCategory) || itemText({ category, sourceWorkTitle: null, title: "", recommendedControl: "", sourceWorkItemId: null }).includes(signalCategory);
}

export function feedbackSignalsForAction(
  item: Pick<AiSafetyActionQueueItem, "sourceKey" | "sourceWorkItemId" | "jobsiteId" | "category" | "sourceWorkTitle" | "title" | "recommendedControl">,
  signals: AiSafetyFeedbackSignal[] = [],
) {
  const itemDescriptor = itemText(item);
  return signals.filter((signal) => {
    if (signal.sourceKey && signal.sourceKey === item.sourceKey) return true;
    if (signal.sourceId && item.sourceWorkItemId && signal.sourceId.startsWith(item.sourceWorkItemId)) return true;
    if (signal.jobsiteId && item.jobsiteId && signal.jobsiteId !== item.jobsiteId) return false;
    if (!categoryMatches(signal, item.category)) return false;
    const descriptor = signalText(signal);
    if (!descriptor) return true;
    return descriptor
      .split(" ")
      .filter((token) => token.length >= 4)
      .some((token) => itemDescriptor.includes(token));
  });
}

export function canSuppressAiSafetyActionByFeedback(
  riskLevel: SafetyRiskLevel,
  category: AiSafetyActionCategory,
  humanApprovalRequired: boolean,
) {
  if (riskLevel === "critical") return false;
  if (riskLevel === "high" && humanApprovalRequired) {
    return !["missing_permit", "missing_or_expired_training", "competent_person_review", "weather_sensitive_work", "high_risk_work"].includes(category);
  }
  return true;
}
