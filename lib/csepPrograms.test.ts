import { describe, expect, it } from "vitest";
import {
  buildCsepProgramSection,
  buildCsepProgramSelections,
  findMissingProgramSubtypeGroups,
  listProgramTitles,
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
      permitRequiredSection.subsections
        .find((section) => section.title === "Minimum Required Controls")
        ?.bullets.join(" ")
    ).toContain("permit-required");
    expect(
      nonPermitSection.subsections
        .find((section) => section.title === "Minimum Required Controls")
        ?.bullets.join(" ")
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
});
