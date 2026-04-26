import { describe, expect, it } from "vitest";
import {
  buildCsepProgramSection,
  buildCsepProgramSections,
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
      section.subsections.find((subsection) => subsection.title === "Planning / Release for Work")
        ?.body
    ).toContain("Custom pre-task procedure");
    expect(
      section.subsections.find((subsection) => subsection.title === "Site-Specific")?.bullets
    ).toEqual(expect.arrayContaining(["Custom control 1", "Custom control 2"]));
  });

  it("renders a consolidated hot work program with governing subsections in order", () => {
    const section = buildCsepProgramSection({
      category: "hazard",
      item: "Hot work / fire",
      relatedTasks: ["Weld handrail"],
      source: "selected",
    });

    expect(section.title).toBe("Hot Work Program");
    expect(section.subsections.map((s) => s.title)).toEqual([
      "Applicable References",
      "Purpose / When Required",
      "Core Requirements",
      "Pre-Task Verification",
      "Work Controls",
      "Fire Watch / Closeout",
      "Stop-Work / Reassessment",
      "Related Tasks",
    ]);
    expect(section.subsections.find((s) => s.title === "Purpose / When Required")?.body).toMatch(
      /spark|welding|fire/i
    );
    expect(section.subsections.find((s) => s.title === "Core Requirements")?.bullets.length).toBeGreaterThan(5);
  });

  it("renders a consolidated fall-protection program with applicability subsections in order", () => {
    const section = buildCsepProgramSection({
      category: "hazard",
      item: "Falls from height",
      relatedTasks: ["Roof work"],
      source: "selected",
    });

    expect(section.subsections.map((subsection) => subsection.title)).toEqual([
      "Applicable References",
      "When Required",
      "When Not Required",
      "Planning / Release for Work",
      "Inspection",
      "Anchorage and Compatibility",
      "Tie-Off",
      "Fall Clearance",
      "Leading Edge / Access Conditions",
      "Protection from Damage",
      "Training",
      "Stop-Work",
      "Related Tasks",
    ]);
  });

  it("lists related tasks in a Related Tasks subsection for the fall program", () => {
    const section = buildCsepProgramSection({
      category: "hazard",
      item: "Falls from height",
      relatedTasks: ["Unload steel", "Sort members", "Rigging"],
      source: "selected",
    });

    expect(
      section.subsections.find((subsection) => subsection.title === "Related Tasks")?.body
    ).toContain("Related tasks: Unload steel, Sort members, Rigging.");
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
          title: "Applicable References",
          bullets: expect.arrayContaining(["R2"]),
        }),
        expect.objectContaining({
          title: "When Not Required",
          body: expect.stringMatching(/fully protected|ground-level/),
        }),
        expect.objectContaining({
          title: "Inspection",
          body: expect.stringMatching(/harness|Remove damaged/i),
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
          bullets: ["R10"],
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

  it("omits the separate Fall Protection Harness PPE program when the falls hazard program is selected", () => {
    const sections = buildCsepProgramSections([
      {
        category: "hazard",
        item: "Falls from height",
        relatedTasks: ["Edge work"],
        source: "selected",
      },
      {
        category: "ppe",
        item: "Fall Protection Harness",
        relatedTasks: ["Edge work"],
        source: "selected",
      },
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe("Fall Protection Program");
  });

  it("omits the ladder-hazard program when a Ladder Permit program is also selected", () => {
    const withBoth = buildCsepProgramSections([
      {
        category: "hazard",
        item: "Ladder misuse",
        relatedTasks: ["Touch-up at height"],
        source: "selected",
      },
      {
        category: "permit",
        item: "Ladder Permit",
        relatedTasks: ["Touch-up at height"],
        source: "selected",
      },
    ]);
    expect(withBoth).toHaveLength(1);
    expect(withBoth[0]?.item).toBe("Ladder Permit");
    expect(withBoth[0]?.title).toBe("Ladder Use Controls");
  });

  it("keeps a compact ladder-hazard program when no ladder permit is selected", () => {
    const onlyHazard = buildCsepProgramSections([
      {
        category: "hazard",
        item: "Ladder misuse",
        relatedTasks: ["Short task"],
        source: "selected",
      },
    ]);
    expect(onlyHazard).toHaveLength(1);
    expect(onlyHazard[0]?.subsections.map((s) => s.title)).toEqual([
      "Program controls — Ladder Use Controls",
    ]);
  });

  it("fills missing procedure arrays from the default catalog when normalizing older configs", () => {
    const config = normalizeCsepProgramConfig({
      definitions: [
        {
          category: "hazard",
          item: "Electrical shock",
          title: "Legacy Electrical Program",
          summary: "Legacy summary",
          controls: ["Legacy control"],
        },
      ],
    });

    const electricalProgram = config.definitions.find(
      (definition) =>
        definition.category === "hazard" && definition.item === "Electrical shock"
    );

    expect(electricalProgram?.title).toBe("Legacy Electrical Program");
    expect(electricalProgram?.preTaskProcedures.length).toBeGreaterThan(0);
    expect(electricalProgram?.workProcedures.length).toBeGreaterThan(0);
    expect(electricalProgram?.stopWorkProcedures.length).toBeGreaterThan(0);
    expect(electricalProgram?.closeoutProcedures.length).toBeGreaterThan(0);
  });
});
