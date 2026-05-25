import { describe, expect, it } from "vitest";
import { buildTopJobsiteRisks } from "./jobsiteTopRisks";

describe("jobsite top risks", () => {
  it("returns the baseline Top 10 watchlist when no live evidence exists", () => {
    const risks = buildTopJobsiteRisks([], { now: new Date("2026-05-25T12:00:00.000Z") });

    expect(risks).toHaveLength(10);
    expect(risks.map((risk) => risk.title)).toEqual([
      "Falls from elevation",
      "Mobile equipment / struck-by",
      "Electrical exposure",
      "Excavation / trenching",
      "Hot work / fire risk",
      "Crane and rigging",
      "Poor housekeeping / access-egress",
      "Falling objects / overhead work",
      "Chemical / hazcom exposure",
      "Confined space / atmospheric exposure",
    ]);
    expect(risks.every((risk) => risk.evidenceCount === 0 && risk.riskLevel === "low")).toBe(true);
    expect(risks[0].topDrivers).toEqual(["No active signal yet."]);
  });

  it("maps common jobsite hazard examples into the taxonomy", () => {
    const risks = buildTopJobsiteRisks(
      [
        { source: "scheduled_work", title: "Roof edge work", hazardCategories: ["fall_protection"], riskLevel: "high" },
        { source: "scheduled_work", title: "Mobile equipment struck-by controls", riskLevel: "high" },
        { source: "permit", title: "Energized electrical LOTO boundary", permitTriggers: ["energized_electrical_or_loto"], riskLevel: "critical" },
        { source: "scheduled_work", title: "Excavation and trench entry", hazardCategories: ["excavation"], riskLevel: "critical" },
        { source: "permit", title: "Hot work welding permit", permitType: "hot_work_permit", riskLevel: "high" },
        { source: "scheduled_work", title: "Crane rigging lift plan", permitTriggers: ["lift_plan"], riskLevel: "high" },
        { source: "corrective_action", title: "Poor housekeeping blocking access and egress", severity: "medium" },
        { source: "corrective_action", title: "Overhead work falling object exposure", severity: "high" },
        { source: "incident", title: "Chemical solvent exposure", severity: "high" },
        { source: "permit", title: "Confined space atmospheric testing", permitType: "confined_space_permit", riskLevel: "critical" },
      ],
      { now: new Date("2026-05-25T12:00:00.000Z") }
    );

    expect(risks.map((risk) => risk.id)).toEqual(
      expect.arrayContaining([
        "falls_from_elevation",
        "mobile_equipment_struck_by",
        "electrical_exposure",
        "excavation_trenching",
        "hot_work_fire",
        "crane_rigging",
        "housekeeping_access_egress",
        "falling_objects_overhead",
        "chemical_hazcom_exposure",
        "confined_space_atmospheric",
      ])
    );
  });

  it("ranks SIF and stop-work evidence above count-only moderate risks", () => {
    const risks = buildTopJobsiteRisks(
      [
        { source: "corrective_action", title: "Housekeeping debris in walkway", severity: "medium" },
        { source: "corrective_action", title: "Housekeeping access issue near stairs", severity: "medium" },
        { source: "incident", title: "Roof edge fall exposure", severity: "low", sifFlag: true },
        { source: "permit", title: "Electrical panel work stopped", permitType: "electrical", stopWorkStatus: "stop_work" },
      ],
      { now: new Date("2026-05-25T12:00:00.000Z") }
    );

    expect(risks[0].id).toBe("electrical_exposure");
    expect(risks[0].riskLevel).toBe("critical");
    expect(risks[1].id).toBe("falls_from_elevation");
    expect(risks[1].riskLevel).toBe("critical");
    expect(risks.find((risk) => risk.id === "housekeeping_access_egress")?.riskLevel).toBe("moderate");
  });

  it("incorporates schedule hazard categories and permit triggers", () => {
    const risks = buildTopJobsiteRisks(
      [
        {
          source: "scheduled_work",
          title: "Morning work package",
          riskLevel: "high",
          hazardCategories: ["crane_rigging"],
          permitTriggers: ["lift_plan"],
        },
      ],
      { now: new Date("2026-05-25T12:00:00.000Z") }
    );

    const craneRisk = risks.find((risk) => risk.id === "crane_rigging");
    expect(craneRisk).toMatchObject({
      riskLevel: "high",
      evidenceCount: 1,
    });
    expect(craneRisk?.sources).toEqual([{ type: "scheduled_work", count: 1 }]);
  });
});
