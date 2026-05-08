import { describe, expect, it } from "vitest";
import { calculateBehaviorRisk, classifyBehaviorRisk } from "@/lib/predictive/behaviorRisk";

const now = new Date("2026-05-08T12:00:00.000Z");

function tomorrow() {
  return "2026-05-09";
}

describe("classifyBehaviorRisk", () => {
  it("classifies the configured score bands", () => {
    expect(classifyBehaviorRisk(0)).toBe("Low");
    expect(classifyBehaviorRisk(21)).toBe("Moderate");
    expect(classifyBehaviorRisk(41)).toBe("Elevated");
    expect(classifyBehaviorRisk(61)).toBe("High");
    expect(classifyBehaviorRisk(81)).toBe("Critical");
  });
});

describe("calculateBehaviorRisk", () => {
  it("flags weak JSA language without task-specific controls", () => {
    const result = calculateBehaviorRisk({
      now,
      jsaActivities: [
        {
          id: "jsa-1",
          work_date: tomorrow(),
          activity_name: "Roof edge work",
          hazard_category: "fall_protection",
          mitigation: "Use PPE and be careful.",
          planned_risk_level: "high",
          status: "planned",
        },
      ],
    });

    expect(result.topDrivers.map((driver) => driver.driver)).toContain("weak_jsa_language");
    expect(result.topDrivers.map((driver) => driver.driver)).toContain("control_dependency");
    expect(result.recommendedActions).toContain("Return JSA for revision with task-specific controls.");
  });

  it("flags missing permits for scheduled permit-required work", () => {
    const result = calculateBehaviorRisk({
      now,
      jsaActivities: [
        {
          id: "jsa-1",
          jobsite_id: "site-1",
          work_date: tomorrow(),
          activity_name: "Welding embeds",
          mitigation: "Fire watch and extinguisher staged.",
          permit_required: true,
          permit_type: "Hot Work Permit",
          planned_risk_level: "high",
          status: "planned",
        },
      ],
      permits: [{ id: "permit-1", jobsite_id: "site-1", permit_type: "Hot Work", status: "expired" }],
    });

    expect(result.topDrivers.map((driver) => driver.driver)).toContain("permit_mismatch");
    expect(result.topDrivers.map((driver) => driver.driver)).toContain("schedule_pressure");
    expect(result.recommendedActions).toContain("Link or create required permit before task approval.");
  });

  it("flags overdue corrective actions and repeated observations", () => {
    const result = calculateBehaviorRisk({
      now,
      correctiveActions: [
        {
          id: "ca-1",
          category: "housekeeping",
          title: "Clear access route",
          status: "open",
          due_at: "2026-05-01T00:00:00.000Z",
        },
      ],
      observations: [
        { id: "sor-1", hazard_category_code: "housekeeping", created_at: "2026-05-05T00:00:00.000Z", severity: "medium" },
        { id: "sor-2", hazard_category_code: "housekeeping", created_at: "2026-05-06T00:00:00.000Z", severity: "medium" },
      ],
    });

    expect(result.topDrivers.map((driver) => driver.driver)).toContain("open_corrective_action");
    expect(result.topDrivers.map((driver) => driver.driver)).toContain("repeat_observation");
  });

  it("flags trade overlap and weekend schedule pressure", () => {
    const result = calculateBehaviorRisk({
      now,
      jsaActivities: [
        {
          id: "jsa-1",
          jobsite_id: "site-1",
          work_date: "2026-05-09",
          trade: "Electrical",
          activity_name: "Panel verification",
          area: "Level 2 east",
          mitigation: "Supervisor verify LOTO and tester confirmation.",
          planned_risk_level: "medium",
          status: "planned",
        },
        {
          id: "jsa-2",
          jobsite_id: "site-1",
          work_date: "2026-05-09",
          trade: "Mechanical",
          activity_name: "Overhead piping",
          area: "Level 2 east",
          crew_size: 9,
          mitigation: "Barricade overhead work zone and inspect supports.",
          planned_risk_level: "medium",
          status: "planned",
        },
      ],
    });

    expect(result.topDrivers.map((driver) => driver.driver)).toContain("trade_overlap");
    expect(result.topDrivers.map((driver) => driver.driver)).toContain("schedule_pressure");
    expect(result.byTrade.length).toBeGreaterThan(0);
  });

  it("flags training gaps and prior incident patterns", () => {
    const result = calculateBehaviorRisk({
      now,
      jsaActivities: [
        {
          id: "jsa-1",
          jobsite_id: "site-1",
          work_date: tomorrow(),
          trade: "Electrical",
          activity_name: "LOTO panel work",
          hazard_category: "electrical",
          mitigation: "Supervisor verify LOTO and tester confirmation.",
          planned_risk_level: "high",
          status: "planned",
        },
      ],
      trainingGaps: [
        {
          id: "gap-1",
          worker_name: "Avery",
          trade: "Electrical",
          task_name: "LOTO panel work",
          status: "expired",
        },
      ],
      incidents: [
        {
          id: "inc-1",
          jobsite_id: "site-1",
          category: "electrical",
          title: "Near miss electrical panel",
          created_at: "2026-04-20T00:00:00.000Z",
        },
      ],
    });

    expect(result.topDrivers.map((driver) => driver.driver)).toContain("training_gap");
    expect(result.topDrivers.map((driver) => driver.driver)).toContain("prior_incident_pattern");
  });

  it("caps the final behavior risk score at 100", () => {
    const result = calculateBehaviorRisk({
      now,
      jsaActivities: Array.from({ length: 12 }, (_, index) => ({
        id: `jsa-${index}`,
        work_date: tomorrow(),
        trade: "Steel",
        activity_name: "Leading edge steel erection",
        hazard_category: "fall_protection",
        mitigation: "Use PPE and pay attention.",
        planned_risk_level: "critical",
        status: "planned",
      })),
    });

    expect(result.behaviorRiskScore).toBe(100);
    expect(result.riskLevel).toBe("Critical");
    expect(result.recommendedActions[0]).toBe("Stop-work recommendation until safety manager review is complete.");
  });
});
