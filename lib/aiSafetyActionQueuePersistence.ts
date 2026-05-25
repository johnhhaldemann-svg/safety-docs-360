import type {
  AiSafetyActionCategory,
  AiSafetyActionQueueItem,
  AiSafetyApprovalState,
} from "@/lib/aiSafetyActionQueue";
import type {
  RiskActionMitigationState,
  RiskActionRecommendationStatus,
  RiskActionTargetModule,
  RiskActionType,
} from "@/types/risk-action-plan";

export type AiSafetyActionRecommendationInsert = {
  company_id: string;
  jobsite_id: string | null;
  kind: "ai_safety_action";
  title: string;
  body: string;
  confidence: number;
  context_snapshot: Record<string, unknown>;
  created_by: string;
  status: RiskActionRecommendationStatus;
  priority: "low" | "medium" | "high" | "critical";
  action_type: RiskActionType;
  due_at: string | null;
  target_module: RiskActionTargetModule;
  target_href: string | null;
  verification_required: boolean;
  mitigation_state: RiskActionMitigationState;
  risk_reduction_points: number;
  evidence_summary: {
    evidenceRefs: AiSafetyActionQueueItem["evidenceRefs"];
    aiSafetyAction: {
      id: string;
      sourceKey: string;
      category: AiSafetyActionCategory;
      approvalState: AiSafetyApprovalState;
      riskLevel: AiSafetyActionQueueItem["riskLevel"];
      ownerRole: AiSafetyActionQueueItem["ownerRole"];
      recommendedControl: string;
      missingInformation: string[];
      humanApprovalRequired: boolean;
      humanApprovalReason: string | null;
      sourceWorkItemId: string | null;
      sourceWorkTitle: string | null;
      jobsiteId: string | null;
      jobsiteName: string | null;
      trade: string | null;
      area: string | null;
      feedbackInfluence: string[];
      feedbackConfidenceAdjustment: AiSafetyActionQueueItem["feedbackConfidenceAdjustment"];
      memoryInfluence: string[];
      reasoningMetadata?: AiSafetyActionQueueItem["reasoningMetadata"];
    };
  };
};

export type ExistingAiSafetyRecommendationRow = {
  id?: string | null;
  status?: string | null;
  evidence_summary?: unknown;
};

export type AiSafetyActionSyncCandidate = {
  item: AiSafetyActionQueueItem;
  sourceKey: string;
  row: AiSafetyActionRecommendationInsert;
};

const ACTIVE_DUPLICATE_STATUSES = new Set(["active", "accepted", "assigned", "field_used"]);

function clean(value: string | null | undefined, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function confidenceForItem(item: AiSafetyActionQueueItem) {
  if (item.priority === "critical") return 0.9;
  if (item.priority === "high") return 0.82;
  if (item.priority === "medium") return 0.68;
  return 0.55;
}

export function actionTypeForAiSafetyAction(item: AiSafetyActionQueueItem): RiskActionType {
  if (item.category === "missing_permit") return "request_permit";
  if (item.category === "open_corrective_action") return "create_corrective_action";
  if ((item.category === "high_risk_work" || item.category === "workface_conflict_review") && item.riskLevel === "critical") return "stop_work_review";
  if (
    item.category === "missing_or_expired_training" ||
    item.category === "competent_person_review" ||
    item.category === "weak_jsa_or_control_gap" ||
    item.category === "weather_sensitive_work" ||
    item.category === "repeated_observation_pattern" ||
    item.category === "workface_conflict_review"
  ) {
    return "request_inspection";
  }
  return "assign";
}

export function statusForAiSafetyApprovalState(state: AiSafetyApprovalState): RiskActionRecommendationStatus {
  if (state === "assigned") return "assigned";
  if (state === "reviewed") return "accepted";
  if (state === "verified_in_field") return "field_used";
  if (state === "resolved") return "resolved";
  if (state === "dismissed_with_reason") return "dismissed";
  return "active";
}

export function mitigationStateForAiSafetyApprovalState(state: AiSafetyApprovalState): RiskActionMitigationState {
  if (state === "assigned") return "assigned";
  if (state === "verified_in_field") return "field_verified";
  if (state === "resolved") return "resolved";
  if (state === "dismissed_with_reason") return "dismissed";
  return "unverified";
}

export function targetModuleForAiSafetyAction(item: AiSafetyActionQueueItem): RiskActionTargetModule {
  if (item.targetModule === "weather") return "command_center";
  return item.targetModule;
}

export function buildAiSafetyActionRecommendationCandidate(params: {
  companyId: string;
  actorUserId: string;
  generatedAt: string;
  item: AiSafetyActionQueueItem;
}): AiSafetyActionSyncCandidate {
  const { item } = params;
  const status = statusForAiSafetyApprovalState(item.approvalState);
  const mitigationState = mitigationStateForAiSafetyApprovalState(item.approvalState);
  const body = [
    clean(item.detail, 700),
    `Recommended control: ${clean(item.recommendedControl, 700)}`,
    item.humanApprovalRequired
      ? `Human review required before work proceeds: ${clean(item.humanApprovalReason ?? "Review and field verification are required.", 500)}`
      : "AI recommendation remains advisory and should be reviewed by the responsible supervisor.",
    item.missingInformation.length > 0 ? `Missing information: ${item.missingInformation.slice(0, 4).join("; ")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    item,
    sourceKey: item.sourceKey,
    row: {
      company_id: params.companyId,
      jobsite_id: item.jobsiteId,
      kind: "ai_safety_action",
      title: clean(item.title, 220) || "AI safety action",
      body,
      confidence: confidenceForItem(item),
      context_snapshot: {
        generatedAt: params.generatedAt,
        source: "predictive-risk.aiSafetyActionQueue",
        sourceKey: item.sourceKey,
        approvalState: item.approvalState,
      },
      created_by: params.actorUserId,
      status,
      priority: item.priority,
      action_type: actionTypeForAiSafetyAction(item),
      due_at: item.dueAt,
      target_module: targetModuleForAiSafetyAction(item),
      target_href: item.targetHref,
      verification_required: item.humanApprovalRequired || item.approvalState === "review_required",
      mitigation_state: mitigationState,
      risk_reduction_points: 0,
      evidence_summary: {
        evidenceRefs: item.evidenceRefs,
        aiSafetyAction: {
          id: item.id,
          sourceKey: item.sourceKey,
          category: item.category,
          approvalState: item.approvalState,
          riskLevel: item.riskLevel,
          ownerRole: item.ownerRole,
          recommendedControl: item.recommendedControl,
          missingInformation: item.missingInformation,
          humanApprovalRequired: item.humanApprovalRequired,
          humanApprovalReason: item.humanApprovalReason,
          sourceWorkItemId: item.sourceWorkItemId,
          sourceWorkTitle: item.sourceWorkTitle,
          jobsiteId: item.jobsiteId,
          jobsiteName: item.jobsiteName,
          trade: item.trade,
          area: item.area,
          feedbackInfluence: item.feedbackInfluence,
          feedbackConfidenceAdjustment: item.feedbackConfidenceAdjustment,
          memoryInfluence: item.memoryInfluence,
          ...(item.reasoningMetadata ? { reasoningMetadata: item.reasoningMetadata } : {}),
        },
      },
    },
  };
}

export function aiSafetyActionSourceKeyFromRecommendation(row: ExistingAiSafetyRecommendationRow): string | null {
  const summary = row.evidence_summary;
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return null;
  const aiSafetyAction = (summary as { aiSafetyAction?: unknown }).aiSafetyAction;
  if (!aiSafetyAction || typeof aiSafetyAction !== "object" || Array.isArray(aiSafetyAction)) return null;
  const sourceKey = (aiSafetyAction as { sourceKey?: unknown }).sourceKey;
  return typeof sourceKey === "string" && sourceKey.trim() ? sourceKey.trim() : null;
}

export function isActiveAiSafetyDuplicate(row: ExistingAiSafetyRecommendationRow) {
  return ACTIVE_DUPLICATE_STATUSES.has(String(row.status ?? "active").toLowerCase());
}
