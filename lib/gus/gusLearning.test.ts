import { describe, expect, it } from "vitest";
import { detectGusLearningPatterns } from "@/lib/gus/gusLearning";
import { recordGusFeedback, resetGusMemoryForTests } from "@/lib/gus/gusMemory";
import { scoreGusFeedback } from "@/lib/gus/gusScoring";

describe("Gus learning and feedback scoring", () => {
  it("scores helpful and not helpful feedback with expected weights", () => {
    expect(
      scoreGusFeedback({
        interactionId: "123e4567-e89b-12d3-a456-426614174000",
        helpful: true,
        clicked: true,
        audioReplayed: true,
      }),
    ).toBe(0.33);

    expect(
      scoreGusFeedback({
        interactionId: "123e4567-e89b-12d3-a456-426614174001",
        helpful: false,
        dismissed: true,
        mutedAfterMessage: true,
      }),
    ).toBe(-0.3);
  });

  it("updates memory scores when helpfulness changes", () => {
    resetGusMemoryForTests();
    const scope = { companyId: "company-1", userId: "user-1" };
    const interactionId = "123e4567-e89b-12d3-a456-426614174002";

    const helpful = recordGusFeedback(scope, {
      interactionId,
      helpful: true,
    });
    const notHelpful = recordGusFeedback(scope, {
      interactionId,
      helpful: false,
    });

    expect(helpful.totalScore).toBe(0.15);
    expect(notHelpful.totalScore).toBe(-0.15);
  });

  it("detects repeated safety learning patterns without allowing safety overrides", () => {
    const patterns = detectGusLearningPatterns(
      {
        observations: [
          { type: "housekeeping", createdAt: "2026-05-01T00:00:00.000Z" },
          { category: "housekeeping issue", createdAt: "2026-05-02T00:00:00.000Z" },
          { type: "poor housekeeping", createdAt: "2026-05-03T00:00:00.000Z" },
        ],
        permits: [
          { missingSignature: true, createdAt: "2026-05-01T00:00:00.000Z" },
          { missingSignature: true, createdAt: "2026-05-02T00:00:00.000Z" },
          { signatureMissing: true, createdAt: "2026-05-03T00:00:00.000Z" },
        ],
        trainings: [
          { expired: true, critical: true },
          { expired: true, critical: true },
        ],
        jsas: [
          { incomplete: true, createdAt: "2026-05-01T00:00:00.000Z" },
          { missingFields: ["hazards"], createdAt: "2026-05-02T00:00:00.000Z" },
          { incomplete: true, createdAt: "2026-05-03T00:00:00.000Z" },
        ],
        weather: [
          { stoppage: true, createdAt: "2026-05-01T00:00:00.000Z" },
          { stoppedWork: true, createdAt: "2026-05-02T00:00:00.000Z" },
        ],
      },
      new Date("2026-05-22T00:00:00.000Z"),
    );

    expect(patterns.map((pattern) => pattern.key)).toEqual([
      "housekeeping_trend",
      "permit_completion_trend",
      "training_readiness_issue",
      "jsa_quality_trend",
      "weather_planning_trend",
    ]);
    expect(patterns.every((pattern) => pattern.safetyOverrideAllowed === false)).toBe(true);
    expect(patterns.every((pattern) => pattern.maySuppressCriticalWarnings === false)).toBe(true);
  });
});

