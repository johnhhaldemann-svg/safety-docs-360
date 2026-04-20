import { describe, expect, it } from "vitest";
import { mapChecklistEvidence } from "@/lib/compliance/checklistMapping";

describe("checklist mapping", () => {
  it("flags missing required baseline fields for CSEP", () => {
    const rows = mapChecklistEvidence("csep", {
      project_name: "North Campus",
      trade: "Excavation",
      tasks: ["Ground breaking"],
      emergency_procedures: "Call 911 and stage at gate 2.",
      selected_hazards: ["Excavation collapse"],
      additional_permits: ["Ground Disturbance Permit"],
      required_ppe: ["Hard Hat"],
    });

    const corrective = rows.find((row) => row.item.id === "baseline-corrective-disciplinary");
    expect(corrective).toBeDefined();
    expect(corrective?.applies).toBe(true);
    expect(corrective?.missingFields).toContain("corrective_action_policy_text");
  });

  it("activates trenching checklist rules from scope keywords", () => {
    const rows = mapChecklistEvidence("peshep", {
      project_name: "Plant Upgrade",
      scope_of_work_selected: ["Excavation", "Mechanical"],
      permits_selected: ["Groundbreaking/Excavation"],
      project_description: "Open trench work for utility relocation.",
    });

    const trenching = rows.find((row) => row.item.id === "work-hse-trenching");
    expect(trenching?.applies).toBe(true);
  });

  it("does not trigger keyword rules from unrelated metadata fields", () => {
    const rows = mapChecklistEvidence("peshep", {
      project_name: "Plant Upgrade",
      metadata: {
        debug_note: "asbestos removal keyword should not trigger checklist rule from metadata",
      },
      scope_of_work_selected: ["Mechanical"],
      permits_selected: [],
    });

    const asbestosRemoval = rows.find((row) => row.item.id === "work-hse-asbestos-handling");
    expect(asbestosRemoval?.applies).toBe(false);
  });

  it("captures new PESHEP admin starter section requirements", () => {
    const rows = mapChecklistEvidence("peshep", {
      project_name: "Plant Upgrade",
      scope_of_work_selected: ["Electrical"],
      disciplinary_policy_text: "Progressive discipline policy.",
      owner_letter_text: "Owner commitment letter.",
      incident_reporting_process_text: "Report immediately.",
      special_conditions_permit_text: "Permit required for variations.",
      assumed_trades_index: ["Electrical", "Mechanical"],
    });

    expect(
      rows.find((row) => row.item.id === "baseline-owner-letter")?.missingFields
    ).toEqual([]);
    expect(
      rows.find((row) => row.item.id === "baseline-special-conditions-permit")?.missingFields
    ).toEqual([]);
    expect(
      rows.find((row) => row.item.id === "baseline-assumed-trades-index")?.missingFields
    ).toEqual([]);
  });
});
