import { describe, expect, it } from "vitest";
import {
  buildRuleBasedScheduleHazardPrediction,
  mergeScheduleHazardPrediction,
  stableSchedulePredictionInputKey,
} from "@/lib/scheduleHazardPrediction";

describe("schedule hazard prediction", () => {
  it("flags steel decking work as critical with fall and lift controls", () => {
    const prediction = buildRuleBasedScheduleHazardPrediction({
      trade: "Steel Framing / Structural Steel",
      taskType: "Steel erection / decking",
      workArea: "Roof / elevated deck",
      crewSize: 8,
    });

    expect(prediction.riskLevel).toBe("critical");
    expect(prediction.isHighRisk).toBe(true);
    expect(prediction.hazardCategories).toEqual(expect.arrayContaining(["steel_erection", "fall_protection", "crane_rigging"]));
    expect(prediction.permitTriggers).toEqual(expect.arrayContaining(["WAH-005"]));
    expect(prediction.permitTriggers).not.toContain("lift_plan");
    expect(prediction.requiredControls).toEqual(expect.arrayContaining(["fall protection and rescue plan", "crew coordination briefing"]));
  });

  it("predicts hot work permits from welding selections", () => {
    const prediction = buildRuleBasedScheduleHazardPrediction({
      trade: "Welding",
      taskType: "Hot work / welding / cutting",
      workArea: "Interior buildout",
    });

    expect(prediction.riskLevel).toBe("high");
    expect(prediction.hazardCategories).toContain("hot_work");
    expect(prediction.permitTriggers).toContain("HWP-001");
    expect(prediction.requiredControls).toContain("fire watch");
  });

  it("keeps normalized input keys stable across whitespace and casing", () => {
    expect(stableSchedulePredictionInputKey({ trade: " Electrical ", taskType: " LOTO ", workArea: " Panel " })).toBe(
      stableSchedulePredictionInputKey({ trade: "electrical", taskType: "loto", workArea: "panel" })
    );
  });

  it("merges AI enrichment without lowering rule severity", () => {
    const rules = buildRuleBasedScheduleHazardPrediction({
      trade: "Electrical",
      taskType: "Electrical / LOTO",
      workArea: "Electrical room",
    });
    const merged = mergeScheduleHazardPrediction(rules, {
      riskLevel: "medium",
      hazardCategories: ["arc_flash"],
      requiredControls: ["energized work authorization"],
      rationale: "AI rationale",
      confidence: 0.95,
    });

    expect(merged.riskLevel).toBe("critical");
    expect(merged.hazardCategories).toEqual(expect.arrayContaining(["electrical", "arc_flash"]));
    expect(merged.requiredControls).toEqual(expect.arrayContaining(["verified isolation", "energized work authorization"]));
    expect(merged.rationale).toBe("AI rationale");
  });

  it("does not create permit triggers from broad equipment or traffic signals", () => {
    const prediction = buildRuleBasedScheduleHazardPrediction({
      trade: "General trades",
      taskType: "Material delivery and forklift traffic coordination",
      workArea: "Laydown yard",
      crewSize: 10,
    });

    expect(prediction.riskLevel).toBe("high");
    expect(prediction.permitTriggers).toEqual([]);
    expect(prediction.requiredControls).toEqual(expect.arrayContaining(["spotter or traffic control", "crew coordination briefing"]));
  });
});
