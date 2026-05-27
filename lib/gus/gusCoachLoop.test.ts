import { describe, expect, it } from "vitest";
import { buildGusCoachDirective, updateGusCoachLoopState } from "@/lib/gus/gusCoachLoop";
import type { GusContext } from "@/lib/gus/gusContext";
import type { GusDecision } from "@/lib/gus/gusTypes";
import type { SafetyAiAssessment } from "@/lib/safety-ai/types";

const baseContext: GusContext = {
  currentPage: "SafePredict",
  route: "/safe-predict/predictive-risk",
  riskLevel: "severe",
  riskDrivers: ["Drop Hazard 3rd Floor", "Open incident review"],
  missingPermitTypes: ["Hot Work"],
  expiredTrainingCount: 2,
  openHighPriorityActionCount: 1,
};

const baseDecision: GusDecision = {
  decisionId: "decision-1",
  kind: "warning",
  botState: "warning",
  attentionLevel: "critical",
  message: {
    messageId: "message-1",
    category: "warning",
    priority: 1,
    message: "Severe risk is showing. Safety lead check is needed.",
    reason: "Top drivers need a field check.",
    actionLabel: "Review risk",
    actionHref: "/safe-predict/predictive-risk",
    actionKey: "guide_to_risk",
  },
  signals: [],
  actions: [{ label: "Review risk", href: "/safe-predict/predictive-risk", actionKey: "guide_to_risk" }],
  shouldOpen: true,
  shouldSpeak: true,
};

const criticalSafetyAiAssessment: SafetyAiAssessment = {
  score: 95,
  level: "critical",
  confidence: "high",
  scoreExplanation: {
    score: 95,
    level: "critical",
    confidence: "high",
    reason: "Critical controls need verification.",
    dataInputs: ["high-risk work"],
    missingInformation: [],
    recommendedAction: "Pause and verify critical controls.",
    humanApprovalRequired: true,
    humanApprovalReason: "Critical-risk work needs safety lead check.",
    driverSummary: ["Critical controls need verification."],
  },
  topDrivers: [],
  recommendations: [],
  controlRecommendations: [],
  escalationRequired: true,
  stopWorkReviewRecommended: true,
  humanApprovalRequired: true,
  humanApprovalReason: "Critical-risk work needs safety lead check.",
  explanation: "Critical controls need verification.",
  missingData: [],
  criticalControlGaps: ["Fall exposure"],
  reviewTriggers: ["Energized electrical or LOTO"],
  actionTimeframe: "immediate",
};

describe("Gus coach loop", () => {
  it("turns severe risk into a firm advisory coach directive", () => {
    const directive = buildGusCoachDirective(baseDecision, baseContext);

    expect(directive.priority).toBe("critical");
    expect(directive.title).toBe("Walk risk drivers now");
    expect(directive.instruction).toContain("safety lead");
    expect(directive.whyItMatters).toContain("Drop Hazard 3rd Floor");
    expect(directive.teachingMethod).toBe("field_coach");
    expect(directive.teachingMoment.notice).toContain("risk drivers");
    expect(directive.teachingMoment.why).toContain("field walk");
    expect(directive.teachingMoment.fieldQuestion).toContain("site");
    expect(directive.teachingMoment.nextStep).toContain("safety lead");
    expect(directive.humanReviewRequired).toBe(true);
    expect(directive.followUps.some((item) => item.prompt.includes("safety lead"))).toBe(true);
  });

  it("creates permit and training follow-ups when context includes gaps", () => {
    const directive = buildGusCoachDirective(
      {
        ...baseDecision,
        message: {
          ...baseDecision.message,
          category: "permit_alert",
        },
      },
      baseContext,
    );

    expect(directive.title).toBe("Permit check comes first");
    expect(directive.followUps.map((item) => item.followUpId)).toContain("draft-permit-review");
    expect(directive.followUps.map((item) => item.followUpId)).toContain("training-readiness");
  });

  it("does not allow approval, release, compliance, or human identity language", () => {
    const directive = buildGusCoachDirective(baseDecision, baseContext);
    const combined = [
      directive.title,
      directive.instruction,
      directive.whyItMatters,
      directive.teachingMoment.notice,
      directive.teachingMoment.why,
      directive.teachingMoment.fieldQuestion,
      directive.teachingMoment.nextStep,
      ...directive.followUps.map((item) => item.prompt),
    ].join(" ");

    expect(combined).not.toMatch(
      /approved|compliant|safe to start|released for work|I am human|I'm human|\bhuman safety check\b|\bverify\b|\bconfirm\b|\baction\b/i,
    );
  });

  it("uses direct coach voice for Safety AI review directives", () => {
    const directive = buildGusCoachDirective(baseDecision, {
      ...baseContext,
      aiEngineLinked: true,
      safetyAiAssessment: criticalSafetyAiAssessment,
      aiEngineActionTimeframe: "immediate",
      aiEngineCriticalControlGaps: ["Fall exposure"],
      aiEngineReviewTriggers: ["Energized electrical or LOTO"],
    });

    expect(directive.title).toBe("Walk critical controls now");
    expect(directive.title).not.toMatch(/Gus says|Gus recommends/i);
    expect(directive.instruction).toContain("safety lead walks the critical controls now");
    expect(directive.whyItMatters).toContain("Fall exposure");
    expect(directive.teachingMoment.fieldQuestion).toContain("walking the controls");
  });

  it("tracks unresolved coach items without duplicating the active directive", () => {
    const directive = buildGusCoachDirective(baseDecision, baseContext);
    const first = updateGusCoachLoopState({ unresolvedDirectives: [] }, directive);
    const second = updateGusCoachLoopState(first, directive);

    expect(first.unresolvedDirectives).toHaveLength(1);
    expect(second.unresolvedDirectives).toHaveLength(1);
    expect(second.activeDirective?.directiveId).toBe(directive.directiveId);
  });
});
