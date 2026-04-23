import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  buildCsepRenderModelFromGeneratedDraft,
  buildCsepTemplateSections,
  renderGeneratedCsepDocx,
} from "@/lib/csepDocxRenderer";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

async function unzipDocx(body: Uint8Array | ArrayBuffer) {
  const zip = await JSZip.loadAsync(body);
  return {
    documentXml: await zip.file("word/document.xml")!.async("string"),
    footerXml: zip.file("word/footer1.xml")
      ? await zip.file("word/footer1.xml")!.async("string")
      : "",
    headerXml: zip.file("word/header1.xml")
      ? await zip.file("word/header1.xml")!.async("string")
      : "",
  };
}

function createGeneratedDraft(): GeneratedSafetyPlanDraft {
  return {
    documentType: "csep",
    projectDeliveryType: "ground_up",
    title: "Riverfront Tower CSEP",
    projectOverview: {
      projectName: "Riverfront Tower",
      projectNumber: "RT-100",
      projectAddress: "100 River Rd",
      ownerClient: "Owner Group",
      gcCm: "GC Partners",
      contractorCompany: "ABC Steel",
      location: "North Campus",
      schedule: "Q2 2026",
    },
    operations: [
      {
        operationId: "op-1",
        tradeLabel: "Steel Erection",
        subTradeLabel: "Decking",
        taskTitle: "Deck placement",
        workAreaLabel: "Level 4",
        locationGrid: "B4",
        equipmentUsed: ["Crane"],
        workConditions: ["Exterior"],
        hazardCategories: ["Fall exposure", "Suspended loads"],
        permitTriggers: ["Lift plan", "Hot work permit"],
        ppeRequirements: ["Hard hat", "Harness"],
        requiredControls: ["Controlled decking zone", "Tag lines"],
        siteRestrictions: ["Maintain exclusion zone."],
        prohibitedEquipment: [],
        conflicts: ["Coordinate crane picks with adjacent facade crews."],
      },
    ],
    ruleSummary: {
      permitTriggers: ["Lift plan", "Hot work permit"],
      ppeRequirements: ["Hard hat", "Harness"],
      requiredControls: ["Controlled decking zone", "Tag lines"],
      hazardCategories: ["Fall exposure", "Suspended loads"],
      siteRestrictions: ["Maintain exclusion zone."],
      prohibitedEquipment: [],
      trainingRequirements: ["Qualified connector"],
      weatherRestrictions: [],
    },
    conflictSummary: {
      total: 1,
      intraDocument: 1,
      external: 0,
      highestSeverity: "medium",
      items: [
        {
          code: "trade-conflict-1",
          type: "trade_vs_trade",
          severity: "medium",
          sourceScope: "intra_document",
          rationale: "Decking crews share swing radius with facade installation.",
          operationIds: ["op-1", "op-2"],
          relatedBucketKeys: ["steel", "facade"],
          requiredMitigations: ["Sequence deliveries before active picks."],
          permitDependencies: [],
          resequencingSuggestion: "Use staggered access windows for shared elevations.",
        },
      ],
    },
    riskSummary: {
      score: 12,
      band: "moderate",
      priorities: [
        "Review lift path and maintain deck-edge protection.",
        "Keep facade crews outside the crane swing radius.",
      ],
    },
    trainingProgram: {
      rows: [],
      summaryTrainingTitles: [],
    },
    narrativeSections: {
      safetyNarrative: "Narrative body",
    },
    sectionMap: [
      {
        key: "company_overview",
        title: "Company Overview and Safety Philosophy",
        body: "ABC Steel expects all work to be planned, communicated, and stopped when conditions change.",
      },
      {
        key: "purpose",
        title: "Purpose",
        body: "This plan defines how project work will be executed safely on the site.",
      },
      {
        key: "project_information",
        title: "Project Information",
        table: {
          columns: ["Field", "Value"],
          rows: [["Project Name", "Riverfront Tower"]],
        },
      },
      {
        key: "common_overlapping_trades",
        title: "Common Overlapping Trades",
        bullets: ["Coordinate crane picks with facade crews.", "Restrict shared access during decking lifts."],
      },
      {
        key: "enforcement_and_corrective_action",
        title: "Enforcement and Corrective Action",
        body: "Unsafe acts may result in removal from the site.",
      },
      {
        key: "security_and_access",
        title: "Security and Access",
        body: "All workers must use controlled entry points and follow restricted-item rules.",
      },
      {
        key: "hazcom_program",
        title: "Hazard Communication Program",
        bullets: ["Maintain SDS access.", "Ensure containers are labeled."],
      },
      {
        key: "incident_reporting_and_investigation",
        title: "Incident Reporting and Investigation",
        bullets: ["Report injuries, near misses, and hazards immediately."],
      },
      {
        key: "task_module_fall_protection",
        title: "Task Module: Fall Protection",
        subsections: [
          {
            title: "Hazard Overview",
            body: "Falls remain the primary exposure during deck placement.",
            bullets: [],
          },
          {
            title: "Required Controls",
            body: "Use perimeter cables, controlled decking zones, and approved anchor points.",
            bullets: [
              "Follow the project Hazard Communication requirements for sealants.",
              "Follow the project emergency response policy when a rescue is needed.",
            ],
          },
        ],
      },
    ],
    provenance: {
      generator: "test",
    },
  };
}

describe("csepDocxRenderer", () => {
  it("builds the CSEP in the required front-matter order before Section 13 hazards", () => {
    const model = buildCsepRenderModelFromGeneratedDraft(createGeneratedDraft());

    expect(model.frontMatterSections.map((section) => section.key)).toEqual([
      "message_from_owner",
      "table_of_contents",
      "purpose",
      "scope",
      "top_10_risks",
      "trade_interaction_info",
      "disciplinary_program",
      "union",
      "security_at_site",
      "hazcom",
      "iipp_emergency_response",
    ]);
    expect(model.sections.map((section) => section.key)).toEqual(["hazards_and_controls"]);
    expect(model.sections[0]?.numberLabel).toBe("13");
  });

  it("keeps one instance of each required section and supplies placeholders where needed", () => {
    const draft = createGeneratedDraft();
    const sections = buildCsepTemplateSections({
      draft,
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      tradeLabel: "Steel Erection",
      subTradeLabel: "Decking",
      taskTitles: ["Deck placement"],
      sourceSections: draft.sectionMap,
    });

    expect(sections.map((section) => section.key)).toEqual([
      "message_from_owner",
      "table_of_contents",
      "purpose",
      "scope",
      "top_10_risks",
      "trade_interaction_info",
      "disciplinary_program",
      "union",
      "security_at_site",
      "hazcom",
      "iipp_emergency_response",
      "hazards_and_controls",
    ]);
    expect(
      sections.find((section) => section.key === "union")?.subsections[0]?.paragraphs?.[0]
    ).toContain("Project-specific information to be completed");
  });

  it("replaces repeated policy text inside hazard modules with short cross-references", () => {
    const model = buildCsepRenderModelFromGeneratedDraft(createGeneratedDraft());
    const hazardSection = model.sections.find((section) => section.key === "hazards_and_controls");
    const flattened = (hazardSection?.subsections ?? []).flatMap((subsection) => [
      ...(subsection.paragraphs ?? []),
      ...(subsection.items ?? []),
    ]);
    const hazardText = flattened.join(" ");

    expect(hazardText).toContain("Follow the project Hazard Communication requirements defined in Section 11.");
    expect(hazardText).toContain("Follow the project IIPP / Emergency Response requirements defined in Section 12.");
    expect(hazardText).not.toContain("Follow the project Hazard Communication requirements for sealants.");
    expect(hazardText).not.toContain("Follow the project emergency response policy when a rescue is needed.");
  });

  it("renders one table of contents and no standalone revision-history section", async () => {
    const rendered = await renderGeneratedCsepDocx(createGeneratedDraft());
    const { documentXml, headerXml, footerXml } = await unzipDocx(rendered.body);

    expect(documentXml.match(/Table of Contents/g)?.length ?? 0).toBe(1);
    expect(documentXml).not.toContain("Revision History");

    const orderedHeadings = [
      "2. Message from Owner",
      "3. Table of Contents",
      "4. Purpose",
      "5. Scope",
      "6. Top 10 Risks",
      "7. Trade Interaction Info",
      "8. Disciplinary Program",
      "9. Union",
      "10. Security at Site",
      "11. HazCom",
      "12. IIPP / Emergency Response",
      "13. Hazards and Controls",
    ];

    let lastIndex = -1;
    for (const heading of orderedHeadings) {
      const nextIndex = documentXml.indexOf(heading);
      expect(nextIndex).toBeGreaterThan(lastIndex);
      lastIndex = nextIndex;
    }

    expect(headerXml).toBe("");
    expect(footerXml).toContain("ABC Steel");
    expect(footerXml).toContain("PAGE");
  });
});
