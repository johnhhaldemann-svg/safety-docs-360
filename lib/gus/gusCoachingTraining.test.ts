import { describe, expect, it } from "vitest";
import {
  evaluateGusCoachingPractice,
  gusCoachingLessonPlan,
  gusCoachingQuiz,
  gusCoachingScenarios,
  gusCoachingScript,
  gusCoachingTechniques,
  gusPracticeQuestions,
} from "@/lib/gus/gusCoachingTraining";

describe("Gus coaching training content", () => {
  it("includes the requested beginner coaching materials", () => {
    expect(gusCoachingLessonPlan).toHaveLength(5);
    expect(gusCoachingTechniques).toHaveLength(17);
    expect(gusCoachingScenarios).toHaveLength(5);
    expect(gusPracticeQuestions).toHaveLength(10);
    expect(gusCoachingQuiz.length).toBeGreaterThanOrEqual(5);
    expect(gusCoachingScript.length).toBeGreaterThanOrEqual(6);
  });

  it("keeps Gus inside coaching authority limits", () => {
    const combined = [
      ...gusCoachingTechniques.flatMap((item) => [item.what, item.why, item.example, item.practice]),
      ...gusCoachingLessonPlan.flatMap((item) => [item.title, item.activity]),
      ...gusCoachingScenarios.flatMap((item) => [item.context, item.coachGoal]),
      ...gusCoachingQuiz.flatMap((item) => [item.question, item.answer, item.why]),
      ...gusCoachingScript.map((item) => item.line),
    ].join(" ");

    expect(combined).not.toMatch(/\bGus approves\b|\bapproved to work\b|\bsafe to start\b|\breleased for work\b/i);
    expect(combined).toMatch(/safety lead|responsible safety lead/i);
  });

  it("gives stronger feedback when an answer uses coaching cues", () => {
    const scenario = gusCoachingScenarios[0];
    const weak = evaluateGusCoachingPractice("Move it now.", scenario);
    const strong = evaluateGusCoachingPractice(
      "I see the ladder on uneven ground near the blocked access. What changed, and who can move it before the next climb?",
      scenario,
    );

    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.label).toBe("Strong coaching move");
    expect(weak.nextTry.length).toBeGreaterThan(0);
  });
});
