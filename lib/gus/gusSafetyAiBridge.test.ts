import { describe, expect, it } from "vitest";
import {
  buildGusContextFromSafetyAiAssessment,
  buildSafetyAiAssessmentForSafePredict,
} from "@/lib/gus/gusSafetyAiBridge";
import { demoSafePredictDataset } from "@/lib/safePredictData";

describe("Gus Safety AI Engine bridge", () => {
  it("builds a Safety AI assessment from SafePredict context", () => {
    const assessment = buildSafetyAiAssessmentForSafePredict(demoSafePredictDataset, "all");

    expect(assessment.score).toBeGreaterThanOrEqual(0);
    expect(assessment.topDrivers.length + assessment.reviewTriggers.length + assessment.criticalControlGaps.length).toBeGreaterThan(0);
    expect(assessment.actionTimeframe).toMatch(/routine|same_shift|before_work_continues|immediate/);
  });

  it("maps Safety AI assessment fields into Gus context", () => {
    const assessment = buildSafetyAiAssessmentForSafePredict(demoSafePredictDataset, "all");
    const context = buildGusContextFromSafetyAiAssessment(assessment);

    expect(context.aiEngineLinked).toBe(true);
    expect(context.safetyAiAssessment).toBe(assessment);
    expect(context.riskLevel).toMatch(/low|moderate|high|severe/);
    expect(context.aiEngineActionTimeframe).toBe(assessment.actionTimeframe);
    expect(context.aiEngineCriticalControlGaps).toEqual(assessment.criticalControlGaps);
    expect(context.aiEngineReviewTriggers).toEqual(assessment.reviewTriggers);
  });

  it("keeps Safety AI Engine context draft-only and review-oriented for Gus", () => {
    const assessment = buildSafetyAiAssessmentForSafePredict(demoSafePredictDataset, "all");
    const context = buildGusContextFromSafetyAiAssessment(assessment);
    const combined = [
      ...(context.riskDrivers ?? []),
      ...(context.aiEngineRecommendations ?? []),
      ...(context.aiEngineCriticalControlGaps ?? []),
      ...(context.aiEngineReviewTriggers ?? []),
    ].join(" ");

    expect(combined).not.toMatch(/approved|safe to start|released for work|osha compliant/i);
  });
});
