import { describe, expect, it } from "vitest";
import {
  actionTypeForAiSafetyAction,
  buildAiSafetyActionRecommendationCandidate,
  mitigationStateForAiSafetyApprovalState,
  statusForAiSafetyApprovalState,
  targetModuleForAiSafetyAction,
} from "@/lib/aiSafetyActionQueuePersistence";
import type { AiSafetyActionCategory, AiSafetyActionQueueItem } from "@/lib/aiSafetyActionQueue";

function item(category: AiSafetyActionCategory, overrides: Partial<AiSafetyActionQueueItem> = {}): AiSafetyActionQueueItem {
  return {
    id: `item-${category}`,
    sourceKey: `ai-safety-action:${category}:j1:work-1:blocker-1:2026-05-22`,
    title: `${category} action`,
    detail: "Verify the hazard before work proceeds.",
    category,
    riskLevel: "high",
    priority: "high",
    ownerRole: "safety_manager",
    dueAt: "2026-05-22T07:00:00.000Z",
    approvalState: "review_required",
    recommendedControl: "Verify critical controls before work proceeds.",
    evidenceRefs: [{ id: "e1", sourceModule: "company_permits", sourceId: "p1", label: "Permit", href: "/permits", detail: "Missing permit" }],
    missingInformation: ["assigned reviewer"],
    humanApprovalRequired: true,
    humanApprovalReason: "High-risk work requires review.",
    sourceWorkItemId: "work-1",
    sourceWorkTitle: "High-risk work",
    jobsiteId: "j1",
    jobsiteName: "North Tower",
    trade: "Steel",
    area: "Level 4",
    targetModule: "predictive_risk",
    targetHref: "/analytics/predictive-model",
    feedbackInfluence: [],
    feedbackConfidenceAdjustment: "neutral",
    memoryInfluence: [],
    ...overrides,
  };
}

describe("AI safety action queue persistence mapping", () => {
  it("maps queue categories to existing recommendation action types", () => {
    expect(actionTypeForAiSafetyAction(item("missing_permit"))).toBe("request_permit");
    expect(actionTypeForAiSafetyAction(item("missing_or_expired_training"))).toBe("request_inspection");
    expect(actionTypeForAiSafetyAction(item("competent_person_review"))).toBe("request_inspection");
    expect(actionTypeForAiSafetyAction(item("weak_jsa_or_control_gap"))).toBe("request_inspection");
    expect(actionTypeForAiSafetyAction(item("weather_sensitive_work"))).toBe("request_inspection");
    expect(actionTypeForAiSafetyAction(item("open_corrective_action"))).toBe("create_corrective_action");
    expect(actionTypeForAiSafetyAction(item("repeated_observation_pattern"))).toBe("request_inspection");
    expect(actionTypeForAiSafetyAction(item("workface_conflict_review"))).toBe("request_inspection");
    expect(actionTypeForAiSafetyAction(item("workface_conflict_review", { riskLevel: "critical", priority: "critical" }))).toBe("stop_work_review");
    expect(actionTypeForAiSafetyAction(item("high_risk_work", { riskLevel: "critical", priority: "critical" }))).toBe("stop_work_review");
  });

  it("maps approval states onto existing status and mitigation fields", () => {
    expect(statusForAiSafetyApprovalState("review_required")).toBe("active");
    expect(statusForAiSafetyApprovalState("assigned")).toBe("assigned");
    expect(statusForAiSafetyApprovalState("reviewed")).toBe("accepted");
    expect(statusForAiSafetyApprovalState("verified_in_field")).toBe("field_used");
    expect(statusForAiSafetyApprovalState("resolved")).toBe("resolved");
    expect(statusForAiSafetyApprovalState("dismissed_with_reason")).toBe("dismissed");

    expect(mitigationStateForAiSafetyApprovalState("review_required")).toBe("unverified");
    expect(mitigationStateForAiSafetyApprovalState("assigned")).toBe("assigned");
    expect(mitigationStateForAiSafetyApprovalState("verified_in_field")).toBe("field_verified");
    expect(mitigationStateForAiSafetyApprovalState("resolved")).toBe("resolved");
    expect(mitigationStateForAiSafetyApprovalState("dismissed_with_reason")).toBe("dismissed");
  });

  it("stores evidence, source key, review language, and weather-safe target modules", () => {
    const candidate = buildAiSafetyActionRecommendationCandidate({
      companyId: "co1",
      actorUserId: "u1",
      generatedAt: "2026-05-22T12:00:00.000Z",
      item: item("weather_sensitive_work", {
        targetModule: "weather",
        humanApprovalReason: "Weather-sensitive elevated work requires supervisor review.",
      }),
    });

    expect(targetModuleForAiSafetyAction(candidate.item)).toBe("command_center");
    expect(candidate.row).toEqual(
      expect.objectContaining({
        kind: "ai_safety_action",
        action_type: "request_inspection",
        target_module: "command_center",
        verification_required: true,
        mitigation_state: "unverified",
        risk_reduction_points: 0,
      }),
    );
    expect(candidate.row.body).toContain("Human review required before work proceeds");
    expect(candidate.row.evidence_summary.aiSafetyAction).toEqual(
      expect.objectContaining({
        sourceKey: candidate.sourceKey,
        approvalState: "review_required",
        recommendedControl: "Verify critical controls before work proceeds.",
      }),
    );
  });
});
