import { describe, expect, it } from "vitest";
import {
  buildCsepProgramSection,
  buildCsepProgramSelections,
  findMissingProgramSubtypeGroups,
  getDefaultProgramDefinitions,
  listProgramTitles,
  normalizeCsepProgramConfig,
} from "@/lib/csepPrograms";

describe("csepPrograms", () => {
  it("creates one unique program per category/item/subtype and preserves related tasks", () => {
    const result = buildCsepProgramSelections({
      selectedHazards: ["Falls from height", "Falls from height"],
      selectedPermits: ["Motion Permit", "Motion Permit"],
      selectedPpe: ["Safety Glasses", "Safety Glasses"],
      tradeItems: [
        {
          activity: "Aerial work",
          hazard: "Falls from height",
          risk: "High",
          controls: ["PFAS"],
          permit: "Motion Permit",
        },
        {
          activity: "Material staging",
          hazard: "Falls from height",
          risk: "High",
          controls: ["PFAS"],
          permit: "Motion Permit",
        },
      ],
      selectedTasks: ["Aerial work", "Material staging"],
    });

    expect(result.selections).toHaveLength(3);
    expect(result.selections.find((item) => item.category === "hazard")?.relatedTasks).toEqual([
      "Aerial work",
      "Material staging",
    ]);
    expect(listProgramTitles(result.selections)).toEqual(
      expect.arrayContaining([
        "Fall Protection Program",
        "Equipment Motion and Traffic Control Program",
        "Eye Protection Program",
      ])
    );
  });

  it("flags missing subtype selections for confined-space programs", () => {
    const result = buildCsepProgramSelections({
      selectedHazards: ["Confined spaces"],
      selectedPermits: ["Confined Space Permit"],
      selectedPpe: [],
      tradeItems: [
        {
          activity: "Vault entry",
          hazard: "Confined spaces",
          risk: "High",
          controls: ["Air monitoring"],
          permit: "Confined Space Permit",
        },
      ],
      selectedTasks: ["Vault entry"],
    });

    expect(findMissingProgramSubtypeGroups(result.selections)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group: "confined_space_classification",
        }),
      ])
    );
  });

  it("uses subtype-specific content for permit-required and non-permit confined space", () => {
    const permitRequiredSection = buildCsepProgramSection({
      category: "hazard",
      item: "Confined spaces",
      subtype: "permit_required",
      relatedTasks: ["Vault entry"],
      source: "selected",
    });
    const nonPermitSection = buildCsepProgramSection({
      category: "hazard",
      item: "Confined spaces",
      subtype: "non_permit",
      relatedTasks: ["Tank inspection"],
      source: "selected",
    });

    expect(permitRequiredSection.title).toBe("Permit-Required Confined Space Entry Program");
    expect(nonPermitSection.title).toBe("Non-Permit Confined Space Entry Program");
    expect(
      permitRequiredSection.subsections.find((section) => section.title === "Pre-Task Setup")?.bullets
    ).toContain("Complete the permit-required entry review, verify hazard isolation, and confirm attendant, entrant, and supervisor roles before entry begins.");
    expect(
      nonPermitSection.subsections.find((section) => section.title === "Stop-Work / Escalation")?.bullets
    ).toContain("Stop work immediately if atmospheric concerns, engulfment potential, hazardous energy, or other permit-required conditions develop.");
    expect(
      permitRequiredSection.subsections
        .find((section) => section.title === "Minimum Required Controls")
        ?.body
    ).toContain("permit-required");
    expect(
      nonPermitSection.subsections
        .find((section) => section.title === "Minimum Required Controls")
        ?.body
    ).toContain("non-permit");
  });

  it("provides explicit catalog definitions for all derived hazards and permit triggers", () => {
    const derivedHazards = [
      "Electrical shock",
      "Hot work / fire",
      "Excavation collapse",
      "Confined spaces",
      "Falls from height",
      "Crane lift hazards",
      "Chemical exposure",
      "Silica / dust exposure",
      "Pressure / line break",
      "Struck by equipment",
      "Slips trips falls",
    ];
    const derivedPermits = [
      "LOTO Permit",
      "Hot Work Permit",
      "Ground Disturbance Permit",
      "Trench Inspection Permit",
      "Confined Space Permit",
      "Ladder Permit",
      "AWP/MEWP Permit",
      "Motion Permit",
      "Chemical Permit",
    ];

    for (const hazard of derivedHazards) {
      const section = buildCsepProgramSection({
        category: "hazard",
        item: hazard,
        relatedTasks: ["Coverage test task"],
        source: "derived",
      });
      expect(section.summary).not.toContain("This program establishes minimum controls for");
    }

    for (const permit of derivedPermits) {
      const section = buildCsepProgramSection({
        category: "permit",
        item: permit,
        relatedTasks: ["Coverage test task"],
        source: "derived",
      });
      expect(section.summary).not.toContain("This program establishes the minimum authorization, review, and field controls required for");
    }
  });

  it("uses injected definitions when super-admin settings override a program block", () => {
    const definitions = getDefaultProgramDefinitions();
    const fallProtection = definitions.find(
      (definition) =>
        definition.category === "hazard" && definition.item === "Falls from height"
    );

    if (!fallProtection) {
      throw new Error("Expected default fall protection program definition.");
    }

    fallProtection.title = "Custom Fall Program";
    fallProtection.summary = "Custom summary for review.";
    fallProtection.preTaskProcedures = ["Custom pre-task procedure"];
    fallProtection.controls = ["Custom control 1", "Custom control 2"];

    const section = buildCsepProgramSection(
      {
        category: "hazard",
        item: "Falls from height",
        relatedTasks: ["Roof access"],
        source: "selected",
      },
      {
        definitions,
      }
    );

    expect(section.title).toBe("Custom Fall Program");
    expect(section.summary).toBe("Custom summary for review.");
    expect(
      section.subsections.find((subsection) => subsection.title === "Pre-Task Setup")?.bullets
    ).toEqual(["Custom pre-task procedure"]);
    expect(
      section.subsections.find((subsection) => subsection.title === "Minimum Required Controls")
        ?.body
    ).toBe("Custom control 1. Custom control 2.");
  });

  it("renders first-class procedure subsections in the expected order for hazard programs", () => {
    const section = buildCsepProgramSection({
      category: "hazard",
      item: "Falls from height",
      relatedTasks: ["Roof work"],
      source: "selected",
    });

    expect(section.subsections.map((subsection) => subsection.title)).toEqual([
      "When It Applies",
      "Applicable References",
      "Responsibilities and Training",
      "Pre-Task Setup",
      "Work Execution",
      "Stop-Work / Escalation",
      "Post-Task / Closeout",
      "Minimum Required Controls",
      "Related Tasks",
    ]);
  });

  it("renders related tasks as one paragraph instead of bullet items", () => {
    const section = buildCsepProgramSection({
      category: "hazard",
      item: "Falls from height",
      relatedTasks: ["Unload steel", "Sort members", "Rigging"],
      source: "selected",
    });

    expect(section.subsections.find((subsection) => subsection.title === "Related Tasks")).toEqual(
      expect.objectContaining({
        body: "These related tasks apply to this program scope: Unload steel, Sort members, Rigging.",
        bullets: [],
      })
    );
  });

  it("renders program metadata subsections as paragraph bodies across the CSEP", () => {
    const hazardSection = buildCsepProgramSection({
      category: "hazard",
      item: "Falls from height",
      relatedTasks: ["Unload steel", "Sort members", "Rigging"],
      source: "selected",
    });
    const section = buildCsepProgramSection({
      category: "ppe",
      item: "High Visibility Vest",
      relatedTasks: ["Unload steel", "Sort members", "Rigging"],
      source: "selected",
    });

    expect(hazardSection.subsections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "When It Applies",
          body:
            "Work is performed at height where fall exposure exists. Ladders, scaffolds, aerial lifts, or elevated platforms are part of the selected scope.",
          bullets: [],
        }),
        expect.objectContaining({
          title: "Applicable References",
          body: expect.stringContaining("R1 OSHA 1926 Subpart M - Fall Protection."),
          bullets: [],
        }),
        expect.objectContaining({
          title: "Responsibilities and Training",
          body:
            "Supervision shall verify fall protection systems are planned, inspected, and compatible with the work area. Workers shall stop work when anchor points, access, or edge protection are not adequate for the task. Workers shall be trained on fall protection selection, inspection, use, and rescue notification procedures.",
          bullets: [],
        }),
        expect.objectContaining({
          title: "Minimum Required Controls",
          body:
            "Use approved fall protection systems when site rules or OSHA criteria require them. Inspect harnesses, lanyards, SRLs, anchors, and connectors before each use. Maintain guardrails, covers, warning lines, and exclusion zones where applicable. Control dropped-object exposure below elevated work with barricades and housekeeping.",
          bullets: [],
        }),
        expect.objectContaining({
          title: "Related Tasks",
          body: "These related tasks apply to this program scope: Unload steel, Sort members, Rigging.",
          bullets: [],
        }),
      ])
    );

    expect(section.subsections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "When It Applies",
          body:
            "Selected work occurs around moving equipment, haul routes, or active traffic interfaces.",
          bullets: [],
        }),
        expect.objectContaining({
          title: "Applicable References",
          body: "R1 OSHA 1926 Subpart E - PPE.",
          bullets: [],
        }),
        expect.objectContaining({
          title: "Responsibilities and Training",
          body:
            "Supervision shall verify high-visibility apparel is worn in traffic-exposed work areas. Workers shall be trained on site traffic-control expectations and high-visibility requirements.",
          bullets: [],
        }),
        expect.objectContaining({
          title: "Minimum Required Controls",
          body:
            "Wear high-visibility garments that remain visible, clean, and in good condition. Replace garments that no longer provide effective visibility. Do not enter active traffic or equipment zones without the required visibility controls.",
          bullets: [],
        }),
        expect.objectContaining({
          title: "Related Tasks",
          body: "These related tasks apply to this program scope: Unload steel, Sort members, Rigging.",
          bullets: [],
        }),
      ])
    );
  });

  it("fills missing procedure arrays from the default catalog when normalizing older configs", () => {
    const config = normalizeCsepProgramConfig({
      definitions: [
        {
          category: "hazard",
          item: "Falls from height",
          title: "Legacy Fall Program",
          summary: "Legacy summary",
          controls: ["Legacy control"],
        },
      ],
    });

    const fallProgram = config.definitions.find(
      (definition) =>
        definition.category === "hazard" && definition.item === "Falls from height"
    );

    expect(fallProgram?.title).toBe("Legacy Fall Program");
    expect(fallProgram?.preTaskProcedures.length).toBeGreaterThan(0);
    expect(fallProgram?.workProcedures.length).toBeGreaterThan(0);
    expect(fallProgram?.stopWorkProcedures.length).toBeGreaterThan(0);
    expect(fallProgram?.closeoutProcedures.length).toBeGreaterThan(0);
  });
});
