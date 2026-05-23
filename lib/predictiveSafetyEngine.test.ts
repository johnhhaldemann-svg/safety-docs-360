import { describe, expect, it } from "vitest";
import { buildPredictiveSafetyEngineBriefing } from "@/lib/predictiveSafetyEngine";

const NOW = new Date("2026-05-22T12:00:00.000Z");
const TODAY = "2026-05-22";
const TOMORROW = "2026-05-23";

function baseInput(overrides: Partial<Parameters<typeof buildPredictiveSafetyEngineBriefing>[0]> = {}) {
  return {
    days: 7,
    now: NOW,
    jobsites: [{ id: "j1", name: "North Tower", location: "Austin", status: "active" }],
    correctiveActions: [],
    incidents: [],
    permits: [],
    jsaActivities: [],
    scheduleItems: [],
    observations: [],
    trainingGaps: [],
    weatherAlerts: [],
    memoryItems: [],
    ...overrides,
  };
}

describe("buildPredictiveSafetyEngineBriefing", () => {
  it("flags tomorrow high-risk schedule work when no active permit exists", () => {
    const briefing = buildPredictiveSafetyEngineBriefing(
      baseInput({
        scheduleItems: [
          {
            id: "s1",
            jobsite_id: "j1",
            title: "Critical lift over active access route",
            work_start_date: TOMORROW,
            trade: "Steel",
            work_area: "Level 4 east",
            crew_size: 10,
            risk_level: "critical",
            is_high_risk: true,
            hazard_categories: ["crane_rigging"],
            permit_triggers: ["lift_plan"],
            required_controls: [],
            status: "planned",
          },
        ],
      })
    );

    expect(briefing.highRiskWork[0]).toMatchObject({
      title: "Critical lift over active access route",
      timing: "tomorrow",
      riskLevel: "critical",
    });
    expect(briefing.readinessBlockers.some((item) => item.type === "permit")).toBe(true);
    expect(briefing.controlsToVerify.some((item) => item.text.toLowerCase().includes("lift plan"))).toBe(true);
    expect(briefing.highRiskWork[0]?.scoreExplanation).toEqual(
      expect.objectContaining({
        level: "critical",
        humanApprovalRequired: true,
      })
    );
    expect(briefing.highRiskWork[0]?.scoreExplanation.dataInputs.length).toBeGreaterThan(0);
  });

  it("flags JSA high-risk work with weak generic controls", () => {
    const briefing = buildPredictiveSafetyEngineBriefing(
      baseInput({
        jsaActivities: [
          {
            id: "j1-jsa",
            jobsite_id: "j1",
            work_date: TODAY,
            trade: "Steel",
            activity_name: "Leading edge deck work",
            area: "Level 4",
            crew_size: 8,
            hazard_category: "fall_protection",
            mitigation: "Use PPE and watch your surroundings.",
            planned_risk_level: "high",
            status: "planned",
          },
        ],
      })
    );

    expect(briefing.highRiskWork[0]?.riskLevel).toMatch(/high|critical/);
    expect(briefing.readinessBlockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "control", label: "Critical controls are missing or too generic" })])
    );
    expect(briefing.highRiskWork[0]?.scoreExplanation.humanApprovalRequired).toBe(true);
  });

  it("connects expired training to permit-controlled work", () => {
    const briefing = buildPredictiveSafetyEngineBriefing(
      baseInput({
        scheduleItems: [
          {
            id: "s1",
            jobsite_id: "j1",
            title: "Critical crane rigging pick",
            work_start_date: TOMORROW,
            trade: "Rigging",
            risk_level: "critical",
            is_high_risk: true,
            permit_triggers: ["lift_plan"],
          },
        ],
        trainingGaps: [
          {
            id: "t1",
            worker_id: "w1",
            worker_name: "Crew member",
            trade: "Rigging",
            requirement: "Rigging qualification",
            status: "expired",
            expires_at: "2026-05-01",
          },
        ],
      })
    );

    expect(briefing.readinessBlockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "training", label: "Training readiness gap" })])
    );
    expect(briefing.highRiskWork[0]?.scoreExplanation.humanApprovalReason).toContain("Training readiness");
  });

  it("raises weather blockers for crane or elevated work", () => {
    const briefing = buildPredictiveSafetyEngineBriefing(
      baseInput({
        scheduleItems: [
          {
            id: "s1",
            jobsite_id: "j1",
            title: "Tower crane pick",
            work_start_date: TODAY,
            trade: "Steel",
            risk_level: "high",
            is_high_risk: true,
          },
        ],
        weatherAlerts: [
          {
            id: "w1",
            jobsite_id: "j1",
            event_name: "High wind warning",
            headline: "High wind warning",
            severity: "severe",
          },
        ],
      })
    );

    expect(briefing.readinessBlockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "weather", label: "Weather affects planned high-risk work" })])
    );
  });

  it("surfaces repeated SOR, incident, and corrective-action patterns in the same hazard family", () => {
    const briefing = buildPredictiveSafetyEngineBriefing(
      baseInput({
        scheduleItems: [
          {
            id: "s1",
            jobsite_id: "j1",
            title: "Fall protection work at open edge",
            work_start_date: TODAY,
            risk_level: "high",
            is_high_risk: true,
          },
        ],
        observations: [
          { id: "o1", hazard_category_code: "fall_protection", description: "Fall protection gap", severity: "medium" },
        ],
        incidents: [
          { id: "i1", title: "Fall protection near miss", category: "fall_protection", severity: "high" },
        ],
        correctiveActions: [
          { id: "c1", title: "Fall protection corrective action", category: "fall_protection", status: "open", severity: "high" },
        ],
      })
    );

    expect(briefing.readinessBlockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Repeated hazard pattern near planned work" })])
    );
  });

  it("uses uploaded safety document memory to add required controls", () => {
    const briefing = buildPredictiveSafetyEngineBriefing(
      baseInput({
        scheduleItems: [
          {
            id: "s1",
            jobsite_id: "j1",
            title: "Roof edge layout",
            work_start_date: TODAY,
            risk_level: "high",
            is_high_risk: true,
          },
        ],
        memoryItems: [
          {
            id: "m1",
            title: "Site fall protection rule",
            summary: "Rescue plan required for elevated work.",
          },
        ],
      })
    );

    expect(briefing.controlsToVerify.some((item) => item.text.toLowerCase().includes("uploaded rule requirement"))).toBe(true);
  });

  it("keeps sparse data conservative instead of defaulting to low risk", () => {
    const briefing = buildPredictiveSafetyEngineBriefing(
      baseInput({
        scheduleItems: [],
        jsaActivities: [],
        permits: [],
        trainingGaps: undefined,
        observations: undefined,
        weatherAlerts: undefined,
        memoryItems: undefined,
      })
    );

    expect(briefing.confidence).toBe("low");
    expect(briefing.headline).toContain("review missing data");
    expect(briefing.missingData).toContain("Sparse data: do not interpret this as low risk by default.");
  });
});
