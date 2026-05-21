import { describe, expect, it } from "vitest";
import {
  derivePshsepExportProgramIds,
  getPshsepCatalog,
  getPshsepCatalogOptions,
  normalizePshsepBuilderFormData,
} from "@/lib/pshsepCatalog";

describe("pshsep catalog", () => {
  it("exposes a significantly larger builder catalog than the old inline lists", () => {
    expect(getPshsepCatalogOptions("scope_of_work_selected").length).toBeGreaterThan(20);
    expect(getPshsepCatalogOptions("permits_selected").length).toBeGreaterThan(10);
    expect(getPshsepCatalogOptions("assumed_trades_index").length).toBeGreaterThan(15);
  });

  it("normalizes legacy labels and derives export program flags", () => {
    const normalized = normalizePshsepBuilderFormData({
      scope_of_work_selected: ["Excavation", "Concrete", "Hot Work"],
      permits_selected: ["Groundbreaking/Excavation", "Temporary Power / Energization"],
      high_risk_focus_areas: ["Respiratory / silica / dust exposure"],
      assumed_trades_index: ["Excavation"],
      ancillary_contractors: ["Traffic control"],
    });

    expect(normalized.scope_of_work_selected).toEqual(
      expect.arrayContaining(["Excavation / Trenching", "Concrete / Masonry", "Hot Work"])
    );
    expect(normalized.assumed_trades_index).toEqual(
      expect.arrayContaining(["Excavation / Civil"])
    );

    expect(derivePshsepExportProgramIds(normalized)).toEqual(
      expect.arrayContaining([
        "excavation",
        "concrete_masonry",
        "hot_work",
        "electrical_loto",
        "respiratory_protection",
        "site_traffic",
      ])
    );
  });

  it("maps welfare, housekeeping, tool, and weather selections to explicit programs", () => {
    const derivedPrograms = derivePshsepExportProgramIds({
      scope_of_work_selected: [
        "Mechanical / Piping / Equipment",
        "Hand & Power Tools",
        "Sanitation / Welfare Facilities",
      ],
      high_risk_focus_areas: ["Severe weather / heat / cold stress"],
      ancillary_contractors: [
        "Trash / housekeeping",
        "Bathroom maintenance",
        "Portable toilet service",
        "Testing / inspection agency",
        "Survey / layout",
        "Janitorial / final clean",
      ],
    });

    expect(derivedPrograms).toEqual(
      expect.arrayContaining([
        "line_break_pressure_testing",
        "material_handling_support",
        "tools_equipment_temporary_power",
        "housekeeping_material_storage",
        "sanitation_welfare",
        "subcontractor_safety_requirements",
        "site_traffic",
        "heat_illness_prevention",
        "cold_stress_winter_work",
        "severe_weather_response",
      ])
    );
  });

  it("keeps every selectable scope, risk, permit, and ancillary option tied to at least one program", () => {
    const groups = [
      "scope_of_work_selected",
      "high_risk_focus_areas",
      "permits_selected",
      "ancillary_contractors",
    ] as const;

    for (const group of groups) {
      const uncovered = getPshsepCatalog(group).filter((entry) => !entry.exportPrograms?.length);
      expect(uncovered).toEqual([]);
    }
  });
});
