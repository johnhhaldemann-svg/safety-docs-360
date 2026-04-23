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
  it("builds the CSEP in the required front-matter order before Section 11 hazards", () => {
    const model = buildCsepRenderModelFromGeneratedDraft(createGeneratedDraft());

    expect(model.frontMatterSections.map((section) => section.key)).toEqual([
      "sign_off_page",
      "table_of_contents",
      "message_from_owner",
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
    expect(model.sections[0]?.numberLabel).toBe("11");
  });

  it("renders Top 10 Risks as offset body lines without 4.1, 4.2-style numbering", async () => {
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
    const topSub = sections.find((s) => s.key === "top_10_risks")?.subsections[0];
    expect(topSub?.title).toBe("Top 10 Risks");
    expect(topSub?.plainItemsStyle).toBe("offset_lines");

    const rendered = await renderGeneratedCsepDocx(draft);
    const { documentXml } = await unzipDocx(rendered.body);
    expect(documentXml).toContain("Falls while decking");
    expect(documentXml).not.toMatch(/4\.\d+\s+Falls while decking/);
    expect(documentXml).not.toMatch(/4\.\d+\s+Struck-by or caught-in/);
  });

  it("tags hazard–control style matrices for offset table rows (no 11.x.y.z per row)", () => {
    const draft = createGeneratedDraft();
    draft.sectionMap.push({
      key: "steel_erection_hazard_control_matrix",
      title: "Steel Erection Hazard-Control Matrix",
      table: {
        columns: [
          "Trade",
          "Sub Trade",
          "Activity",
          "Hazards",
          "Required Controls",
          "PPE",
          "Permits",
        ],
        rows: [
          [
            "Steel",
            "Erection",
            "Column set",
            "Struck by, collapse",
            "Lift plan, tag lines",
            "Hard hat, harness",
            "None",
          ],
        ],
      },
    });
    const sections = buildCsepTemplateSections({
      draft,
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      tradeLabel: "Steel Erection",
      subTradeLabel: "Decking",
      taskTitles: ["Deck placement"],
      sourceSections: draft.sectionMap,
    });
    const haz = sections.find((s) => s.key === "hazards_and_controls");
    const matrixSub = haz?.subsections.find((s) => s.table?.rows.length && s.tableRowsStyle);
    expect(matrixSub?.tableRowsStyle).toBe("offset_lines");
  });

  it("renders Scope of Work tasks as offset lines without subsection numbers like 3.1.1", async () => {
    const draft = createGeneratedDraft();
    draft.sectionMap.unshift({
      key: "scope_of_work",
      title: "Scope of Work",
      body: "Self-performed structural steel for this phase.",
      bullets: ["Unload steel", "Rigging", "Crane picks"],
    });

    const sections = buildCsepTemplateSections({
      draft,
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      tradeLabel: "Steel Erection",
      subTradeLabel: "Decking",
      taskTitles: ["Deck placement"],
      sourceSections: draft.sectionMap,
    });
    const scopeSub = sections.find((s) => s.key === "scope")?.subsections.find((sub) => /scope of work/i.test(sub.title));
    expect(scopeSub?.plainItemsStyle).toBe("offset_lines");

    const rendered = await renderGeneratedCsepDocx(draft);
    const { documentXml } = await unzipDocx(rendered.body);
    expect(documentXml).toContain("Unload steel");
    expect(documentXml).not.toContain("3.1.1");
    expect(documentXml).not.toContain("3.2.1");
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
      "sign_off_page",
      "table_of_contents",
      "message_from_owner",
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
    expect(sections.find((section) => section.key === "sign_off_page")?.numberLabel).toBeNull();
    expect(sections.find((section) => section.key === "table_of_contents")?.numberLabel).toBeNull();
  });

  it("replaces repeated policy text inside hazard modules with short cross-references", () => {
    const model = buildCsepRenderModelFromGeneratedDraft(createGeneratedDraft());
    const hazardSection = model.sections.find((section) => section.key === "hazards_and_controls");
    const flattened = (hazardSection?.subsections ?? []).flatMap((subsection) => [
      ...(subsection.paragraphs ?? []),
      ...(subsection.items ?? []),
    ]);
    const hazardText = flattened.join(" ");

    expect(hazardText).toContain("Follow the project Hazard Communication requirements defined in the HazCom section.");
    expect(hazardText).toContain("Follow the project IIPP / Emergency Response requirements defined in the IIPP / Emergency Response section.");
    expect(hazardText).not.toContain("Follow the project Hazard Communication requirements for sealants.");
    expect(hazardText).not.toContain("Follow the project emergency response policy when a rescue is needed.");
  });

  it("renders one table of contents and no duplicate revision-history block", async () => {
    const rendered = await renderGeneratedCsepDocx(createGeneratedDraft());
    const { documentXml, headerXml, footerXml } = await unzipDocx(rendered.body);

    expect(documentXml.match(/Table of Contents/g)?.length ?? 0).toBe(1);
    // Legacy builder used "0.1 Revision History" as a free-standing section; the
    // export may still mention "Revision History" inside combined appendix titles.
    expect(documentXml).not.toContain("0.1 Revision History");

    const orderedHeadings = [
      "Sign-Off Page",
      "Table of Contents",
      "1. Message from Owner",
      "2. Purpose",
      "3. Scope",
      "4. Top 10 Risks",
      "5. Trade Interaction Info",
      "6. Disciplinary Program",
      "7. Union",
      "8. Security at Site",
      "9. HazCom",
      "10. IIPP / Emergency Response",
      "11. Hazards and Controls",
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
