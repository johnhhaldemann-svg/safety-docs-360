import { describe, expect, it } from "vitest";
import { assessSafetyRisk } from "@/lib/safety-ai/riskEngine";

describe("assessSafetyRisk", () => {
  it("returns low for a complete low-risk scenario", () => {
    const result = assessSafetyRisk({
      jobsiteName: "North Tower",
      taskType: "Housekeeping walkthrough",
      trade: "General",
      controlEffectiveness: "effective",
      dataCompleteness: 0.95,
      signals: [
        { type: "observation", label: "Positive housekeeping observation", severity: "low", status: "closed" },
        { type: "corrective_action", label: "Closed minor action", severity: "low", status: "closed" },
        { type: "incident", label: "No incident pressure", severity: "low", status: "closed" },
        { type: "high_risk_work", label: "Routine work", severity: "low", highRisk: false, status: "closed" },
      ],
    });

    expect(result.level).toBe("low");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(40);
  });

  it("raises risk when controls are missing", () => {
    const result = assessSafetyRisk({
      jobsiteName: "North Tower",
      taskType: "Elevated work",
      trade: "Steel",
      controlEffectiveness: "missing",
      dataCompleteness: 0.8,
      signals: [
        { type: "observation", label: "Open edge observation", severity: "medium", status: "open", controlGap: 5 },
        { type: "corrective_action", label: "Guardrail action", severity: "medium", status: "open" },
      ],
    });

    expect(["moderate", "high", "critical"]).toContain(result.level);
    expect(result.topDrivers.map((driver) => driver.category)).toContain("controls");
  });

  it("forces critical for fatality potential with missing controls", () => {
    const result = assessSafetyRisk({
      jobsiteName: "North Tower",
      taskType: "Leading edge deck work",
      trade: "Steel",
      controlEffectiveness: "missing",
      dataCompleteness: 0.85,
      fatalityOrCatastrophicPotential: true,
      signals: [{ type: "high_risk_work", label: "Leading edge work", severity: "fatal", highRisk: true }],
    });

    expect(result.level).toBe("critical");
    expect(result.score).toBeGreaterThanOrEqual(81);
    expect(result.escalationRequired).toBe(true);
    expect(result.stopWorkReviewRecommended).toBe(true);
  });

  it("reduces confidence and reports missing data", () => {
    const result = assessSafetyRisk({
      controlEffectiveness: "unknown",
      signals: [],
    });

    expect(result.confidence).toBe("low");
    expect(result.missingData).toEqual(expect.arrayContaining(["jobsite", "task", "trade", "control effectiveness"]));
  });

  it("does not downgrade imminent danger when numeric inputs are low", () => {
    const result = assessSafetyRisk({
      jobsiteName: "North Tower",
      taskType: "Trench entry",
      trade: "Earthwork",
      controlEffectiveness: "effective",
      imminentDanger: true,
      scores: { severity: 1, likelihood: 1, exposureFrequency: 1, controlGap: 1, dataConfidenceConcern: 1 },
      signals: [{ type: "observation", label: "Worker in unsupported trench", imminentDanger: true, severity: "low" }],
    });

    expect(result.level).toBe("critical");
    expect(result.score).toBeGreaterThanOrEqual(81);
    expect(result.escalationRequired).toBe(true);
    expect(result.stopWorkReviewRecommended).toBe(true);
  });

  it("requires escalation for high and critical findings", () => {
    const high = assessSafetyRisk({
      jobsiteName: "North Tower",
      taskType: "Hot work",
      trade: "Mechanical",
      controlEffectiveness: "partial",
      scores: { severity: 4, likelihood: 4, exposureFrequency: 4, controlGap: 4, dataConfidenceConcern: 2 },
      signals: [{ type: "high_risk_work", label: "Hot work", severity: "high", highRisk: true }],
    });
    const critical = assessSafetyRisk({
      imminentDanger: true,
      controlEffectiveness: "ineffective",
      signals: [{ type: "observation", label: "Imminent danger", imminentDanger: true, severity: "critical" }],
    });

    expect(high.level).toBe("high");
    expect(high.escalationRequired).toBe(true);
    expect(critical.level).toBe("critical");
    expect(critical.escalationRequired).toBe(true);
  });

  it("keeps the numeric score inside the final raised level band", () => {
    const result = assessSafetyRisk({
      jobsiteName: "North Tower",
      taskType: "Hot work",
      trade: "Mechanical",
      controlEffectiveness: "partial",
      missingRequiredPermit: true,
      highRiskWorkCategories: ["hot_work"],
      scores: { severity: 3, likelihood: 3, exposureFrequency: 3, controlGap: 3, dataConfidenceConcern: 1 },
      signals: [{ type: "high_risk_work", label: "Hot work", severity: "medium", highRisk: true, missingRequiredPermit: true }],
    });

    expect(result.level).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(61);
    expect(result.score).toBeLessThanOrEqual(80);
  });

  it("orders recommendations by hierarchy of controls", () => {
    const result = assessSafetyRisk({
      jobsiteName: "North Tower",
      taskType: "Critical lift",
      trade: "Crane",
      highRiskWorkCategories: ["critical_lift"],
      controlEffectiveness: "missing",
      fatalityOrCatastrophicPotential: true,
      signals: [{ type: "high_risk_work", label: "Critical lift", highRisk: true, severity: "critical" }],
    });

    expect(result.recommendations.map((item) => item.controlType).slice(0, 6)).toEqual([
      "elimination",
      "substitution",
      "engineering",
      "administrative",
      "ppe",
      "competent_person_review",
    ]);
  });

  it("normalizes scores to 0-100", () => {
    const result = assessSafetyRisk({
      jobsiteName: "North Tower",
      taskType: "General work",
      trade: "General",
      controlEffectiveness: "effective",
      scores: { severity: 99, likelihood: -3, exposureFrequency: 2, controlGap: 1, dataConfidenceConcern: 1 },
      signals: [{ type: "observation", label: "General signal", severity: "low" }],
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("includes the main risk drivers and guarded wording in the explanation", () => {
    const result = assessSafetyRisk({
      jobsiteName: "North Tower",
      taskType: "Electrical tie-in",
      trade: "Electrical",
      controlEffectiveness: "partial",
      missingRequiredPermit: true,
      highRiskWorkCategories: ["energized_electrical"],
      signals: [{ type: "permit_gap", label: "Missing electrical permit", severity: "high", missingRequiredPermit: true }],
    });

    expect(result.explanation).toContain("Based on available data");
    expect(result.explanation).toContain("potential risk");
    expect(result.explanation).toContain("review recommended");
    expect(result.explanation).toContain(result.topDrivers[0]?.label ?? "");
    expect(result.scoreExplanation).toEqual(
      expect.objectContaining({
        score: result.score,
        level: result.level,
        confidence: result.confidence,
        humanApprovalRequired: true,
      })
    );
    expect(result.scoreExplanation.reason).toBeTruthy();
    expect(result.scoreExplanation.dataInputs).toEqual(expect.arrayContaining([expect.stringContaining("Missing electrical permit")]));
    expect(result.scoreExplanation.missingInformation).toEqual(result.missingData);
    expect(result.scoreExplanation.recommendedAction).toBeTruthy();
    expect(result.humanApprovalRequired).toBe(true);
    expect(result.humanApprovalReason).toContain("Permit readiness");
    expect(result.controlRecommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hazardFamily: "energized_electrical",
          humanApprovalRequired: true,
        }),
      ])
    );
  });

  it("escalates high-consequence work when critical controls are not verified", () => {
    const result = assessSafetyRisk({
      jobsiteName: "North Tower",
      taskType: "Trench entry for utility tie-in",
      trade: "Earthwork",
      controlEffectiveness: "partial",
      highRiskWorkCategories: ["excavation", "trenching"],
      signals: [
        {
          type: "high_risk_work",
          label: "Crew scheduled for trench entry",
          hazard: "excavation trenching",
          severity: "high",
          highRisk: true,
          missingCompetentPersonReview: true,
          controlEvidence: "Use caution and wear PPE.",
        },
      ],
    });

    expect(result.level).toBe("critical");
    expect(result.criticalControlGaps[0]).toContain("Excavation or trenching");
    expect(result.topDrivers.map((driver) => driver.category)).toContain("critical_control");
    expect(result.actionTimeframe).toBe("immediate");
    expect(result.stopWorkReviewRecommended).toBe(true);
    expect(result.humanApprovalRequired).toBe(true);
    expect(result.scoreExplanation.humanApprovalReason).toContain("Immediate human review");
    expect(result.controlRecommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Verify competent-person excavation inspection",
          humanApprovalRequired: true,
        }),
      ])
    );
  });

  it("raises likelihood when separate modules converge on the same hazard family", () => {
    const result = assessSafetyRisk({
      jobsiteName: "South Clinic",
      taskType: "Leading edge deck work",
      trade: "Steel",
      controlEffectiveness: "partial",
      highRiskWorkCategories: ["fall protection"],
      signals: [
        { type: "observation", label: "Open edge observed", hazard: "fall protection", severity: "medium", status: "open" },
        { type: "corrective_action", label: "Guardrail gap remains open", hazard: "fall protection", severity: "high", status: "open" },
        { type: "high_risk_work", label: "Roof edge layout starts tomorrow", hazard: "fall exposure", severity: "high", highRisk: true },
      ],
    });

    expect(result.level).toMatch(/high|critical/);
    expect(result.topDrivers.map((driver) => driver.label)).toContain("Converging risk signals");
    expect(result.reviewTriggers).toEqual(expect.arrayContaining(["Multiple signals point to the same high-risk hazard family."]));
  });

  it("does not report a critical-control gap when strong controls are documented", () => {
    const result = assessSafetyRisk({
      jobsiteName: "North Tower",
      taskType: "Leading edge roof work",
      trade: "Roofing",
      controlEffectiveness: "partial",
      highRiskWorkCategories: ["fall protection"],
      signals: [
        {
          type: "high_risk_work",
          label: "Roof edge work",
          hazard: "fall protection",
          severity: "high",
          highRisk: true,
          controls: ["guardrail", "rescue plan", "competent-person inspection"],
          controlEvidence: "Guardrail installed, rescue plan reviewed, competent person inspection signed.",
        },
      ],
    });

    expect(result.criticalControlGaps).toEqual([]);
    expect(result.topDrivers.map((driver) => driver.category)).not.toContain("critical_control");
    expect(result.reviewTriggers.some((trigger) => trigger.includes("Fall exposure"))).toBe(true);
  });
});
