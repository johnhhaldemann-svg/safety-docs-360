import { describe, expect, it } from "vitest";
import {
  HIGH_RISK_PERMIT_DEFINITIONS,
  matchHighRiskPermits,
  resolveHighRiskPermitDefinition,
} from "@/lib/highRiskPermitBooklet";

describe("high-risk permit booklet rules", () => {
  it("contains exactly the booklet permit templates with 8 checklist controls each", () => {
    expect(HIGH_RISK_PERMIT_DEFINITIONS.map((definition) => definition.code)).toEqual([
      "HWP-001",
      "CSE-002",
      "EXC-003",
      "GDU-004",
      "WAH-005",
      "GRV-006",
      "LFT-007",
      "ELE-008",
      "LOTO-009",
      "MEWP-010",
      "SIL-011",
      "CHEM-012",
      "TMP-013",
      "DEM-014",
    ]);
    expect(HIGH_RISK_PERMIT_DEFINITIONS.every((definition) => definition.checklistItems.length === 8)).toBe(true);
  });

  it.each([
    ["welding steel brackets outside hot work area", "HWP-001"],
    ["entry into a permit-required confined space tank", "CSE-002"],
    ["trenching with cave-in exposure", "EXC-003"],
    ["core drilling near embedded utilities", "GDU-004"],
    ["leading edge roof work with floor openings", "WAH-005"],
    ["overhead work above active crews", "GRV-006"],
    ["critical lift with crane and rigging", "LFT-007"],
    ["energized panel testing with arc flash boundary", "ELE-008"],
    ["lockout tagout and zero-energy verification", "LOTO-009"],
    ["boom lift work from a mobile elevating work platform", "MEWP-010"],
    ["silica dust from jackhammering concrete", "SIL-011"],
    ["chemical line break with hazardous contents", "CHEM-012"],
    ["high wind and lightning weather threshold", "TMP-013"],
    ["demolition wall penetration and structural removal", "DEM-014"],
  ])("matches %s to %s", (title, code) => {
    const result = matchHighRiskPermits({ title });

    expect(result.matches.map((match) => match.definition.code)).toContain(code);
  });

  it("normalizes explicit legacy trigger names to booklet codes", () => {
    expect(resolveHighRiskPermitDefinition("hot_work_permit")?.code).toBe("HWP-001");
    expect(resolveHighRiskPermitDefinition("lift plan")?.code).toBe("LFT-007");
    expect(resolveHighRiskPermitDefinition("elevated_work_notice")?.code).toBe("WAH-005");
  });

  it("ignores broad non-booklet permit triggers instead of creating permits", () => {
    const result = matchHighRiskPermits({
      explicitTriggers: ["traffic_control_plan", "large crew", "mobile equipment"],
      title: "Concrete logistics and material delivery",
    });

    expect(result.matches).toHaveLength(0);
    expect(result.unmappedTriggers).toEqual(["traffic_control_plan", "large crew", "mobile equipment"]);
  });
});
