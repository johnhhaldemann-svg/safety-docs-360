import { describe, expect, it } from "vitest";
import {
  buildCsepGenerationContext,
  buildPshsepGenerationContext,
  buildRawTaskInputsFromGenerationContext,
} from "@/lib/safety-intelligence/documentIntake";

describe("document intake mappers", () => {
  it("normalizes CSEP and PSHSEP scope into comparable operation inputs", () => {
    const csep = buildCsepGenerationContext({
      project_name: "North Campus",
      project_address: "123 Main St",
      trade: "Mechanical",
      subTrade: "HVAC",
      tasks: ["Install rooftop unit"],
      scope_of_work: "Install rooftop unit",
      site_specific_notes: "No A-frame ladders on this site",
      required_ppe: ["Hard Hat"],
      additional_permits: ["Work at Height"],
      selected_hazards: ["Falls from height"],
    });
    const pshsep = buildPshsepGenerationContext({
      project_name: "North Campus",
      project_address: "123 Main St",
      scope_of_work_selected: ["Install rooftop unit"],
      project_description: "No A-frame ladders on this site",
      permits_selected: ["Work at Height"],
    });

    const csepInputs = buildRawTaskInputsFromGenerationContext(csep, "company-1");
    const pshsepInputs = buildRawTaskInputsFromGenerationContext(pshsep, "company-1");

    expect(csepInputs).toHaveLength(1);
    expect(pshsepInputs).toHaveLength(1);
    expect(csepInputs[0].taskTitle).toBe("Install rooftop unit");
    expect(pshsepInputs[0].taskTitle).toBe("Install rooftop unit");
    expect(csepInputs[0].siteRestrictions).toContain("No A-frame ladders.");
    expect(pshsepInputs[0].siteRestrictions).toContain("No A-frame ladders.");
    expect(csepInputs[0].companyId).toBe(pshsepInputs[0].companyId);
    expect(csep.programSelections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "hazard",
          item: "Falls from height",
        }),
        expect.objectContaining({
          category: "ppe",
          item: "Hard Hat",
        }),
      ])
    );
  });

  it("preserves explicit program selections and subtype choices from the builder payload", () => {
    const context = buildCsepGenerationContext({
      project_name: "South Campus",
      trade: "Electrical",
      subTrade: "Power distribution / feeders / branch power",
      tasks: ["Conduit install"],
      selected_hazards: ["Confined spaces"],
      additional_permits: ["Confined Space Permit"],
      required_ppe: ["Safety Glasses"],
      programSelections: [
        {
          category: "hazard",
          item: "Confined spaces",
          subtype: "permit_required",
          relatedTasks: ["Vault entry"],
          source: "selected",
        },
      ],
    });

    expect(context.programSelections).toEqual([
      expect.objectContaining({
        category: "hazard",
        item: "Confined spaces",
        subtype: "permit_required",
        relatedTasks: ["Vault entry"],
      }),
    ]);
  });
});
