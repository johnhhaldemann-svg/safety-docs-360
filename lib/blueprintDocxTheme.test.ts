import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import { createBlueprintDocument } from "@/lib/blueprintDocxTheme";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

// @ts-expect-error mammoth's internal unzip helper is untyped
import { openZip } from "mammoth/lib/unzip";

function createDraft(): GeneratedSafetyPlanDraft {
  return {
    documentType: "csep",
    projectDeliveryType: "ground_up",
    title: "Refinery Turnaround CSEP",
    projectOverview: {
      projectName: "Refinery Turnaround",
      projectNumber: "RT-100",
      projectAddress: "500 Plant Rd",
      ownerClient: "Owner",
      gcCm: "GC",
      contractorCompany: "Contractor",
      location: "Unit 4",
      schedule: "Q3 2026",
    },
    operations: [
      {
        operationId: "op-1",
        tradeLabel: "Electrical",
        subTradeLabel: "Shutdown and turnaround",
        taskTitle: "Cable pull",
        equipmentUsed: ["Cable tugger"],
        workConditions: ["Indoor"],
        hazardCategories: ["Electrical"],
        permitTriggers: ["energized electrical permit"],
        ppeRequirements: ["Arc-rated PPE"],
        requiredControls: ["verified isolation"],
        siteRestrictions: ["No energized work without approval."],
        prohibitedEquipment: [],
        conflicts: [],
      },
      {
        operationId: "op-2",
        tradeLabel: "Electrical",
        subTradeLabel: "Shutdown and turnaround",
        taskTitle: "Lockout verification",
        equipmentUsed: ["Meter"],
        workConditions: ["Indoor"],
        hazardCategories: ["Arc flash"],
        permitTriggers: ["energized electrical permit"],
        ppeRequirements: ["Arc-rated PPE"],
        requiredControls: ["verified isolation", "test before touch"],
        siteRestrictions: ["No energized work without approval."],
        prohibitedEquipment: [],
        conflicts: [],
      },
    ],
    ruleSummary: {
      permitTriggers: ["energized electrical permit"],
      ppeRequirements: ["Arc-rated PPE"],
      requiredControls: ["verified isolation"],
      hazardCategories: ["Electrical"],
      siteRestrictions: ["No energized work without approval."],
      prohibitedEquipment: [],
      trainingRequirements: ["Qualified electrical worker"],
      weatherRestrictions: [],
    },
    conflictSummary: {
      total: 0,
      intraDocument: 0,
      external: 0,
      highestSeverity: "none",
      items: [],
    },
    riskSummary: {
      score: 8,
      band: "low",
      priorities: ["Maintain electrical isolation discipline."],
    },
    trainingProgram: {
      rows: [],
      summaryTrainingTitles: [],
    },
    narrativeSections: {
      safetyNarrative: "Narrative",
    },
    sectionMap: [
      {
        key: "definitions",
        title: "Definitions",
        body: "Define competent person and ancillary contractor terms.",
        bullets: ["Competent person", "Stop-work authority"],
      },
      {
        key: "references",
        title: "References",
        body: "Collected OSHA references for the generated plan.",
        bullets: ["29 CFR 1926 Subpart K", "29 CFR 1926 Subpart M"],
      },
      {
        key: "safety_narrative",
        title: "Safety Narrative",
        body: "Narrative body for the generated plan.",
      },
      {
        key: "program_hazard__falls_from_height__base",
        title: "Fall Protection Program",
        summary: "This program establishes controls for elevated work and fall exposures.",
        body: "Program intro body.",
        subsections: [
          {
            title: "When It Applies",
            bullets: [
              "Selected work or site conditions create fall exposure.",
              "Ladders, scaffolds, or aerial lifts are used for access.",
            ],
          },
          {
            title: "Applicable References",
            bullets: ["OSHA 1926 Subpart M - Fall Protection"],
          },
          {
            title: "Responsibilities and Training",
            bullets: ["Workers must inspect gear before use."],
          },
        ],
      },
      {
        key: "risk_priority_summary",
        title: "Risk Priority Summary",
        body: "Priority summary body.",
      },
      {
        key: "project_overview",
        title: "Project Overview",
        table: {
          columns: ["Field", "Value"],
          rows: [["Project Name", "Refinery Turnaround"]],
        },
      },
      {
        key: "training_program",
        title: "Training Program",
        table: {
          columns: ["Trade", "Subtrade", "Task", "Required Training", "Why / Source"],
          rows: [
            [
              "Electrical",
              "Shutdown and turnaround",
              "Cable pull",
              "Qualified electrical worker",
              "Rule evaluation",
            ],
          ],
        },
      },
      {
        key: "permit_matrix",
        title: "Permit Matrix",
        table: {
          columns: ["Task", "Permits", "Site Restrictions"],
          rows: [["Cable pull", "energized electrical permit", "No energized work without approval."]],
        },
      },
      {
        key: "program_permit__hot_work_permit__base",
        title: "Hot Work Permit Program",
        summary: "This permit program controls authorization for spark-producing tasks.",
        subsections: [
          {
            title: "When It Applies",
            bullets: ["Selected work includes welding or cutting."],
          },
        ],
      },
    ],
    provenance: {
      generator: "test",
    },
  };
}

describe("createBlueprintDocument", () => {
  it("writes the shared formal theme with headers, footer pagination, and embedded media", async () => {
    const draft = createDraft();
    const doc = await createBlueprintDocument(draft);
    const buffer = await Packer.toBuffer(doc);
    const zip = await openZip({ buffer });

    const [documentXml, stylesXml, relationshipsXml, headerXml, footerXml] = await Promise.all([
      zip.read("word/document.xml", "utf-8"),
      zip.read("word/styles.xml", "utf-8"),
      zip.read("word/_rels/document.xml.rels", "utf-8"),
      zip.read("word/header1.xml", "utf-8"),
      zip.read("word/footer1.xml", "utf-8"),
    ]);

    expect(relationshipsXml).toContain("relationships/header");
    expect(relationshipsXml).toContain("relationships/footer");
    expect(relationshipsXml).toContain("relationships/image");
    expect(headerXml).toContain("CSEP");
    expect(footerXml).toContain("PAGE");
    expect(footerXml).toContain("NUMPAGES");
    expect(documentXml).toContain('w:pStyle w:val="BlueprintSectionHeading"');
    expect(documentXml).toContain("<w:tbl>");
    expect(documentXml).toContain("2.1 Electrical / Shutdown and turnaround");
    expect(documentXml).toContain("2.1.1 ");
    expect(documentXml).toContain("Tasks: ");
    expect(documentXml).toContain("Cable pull, Lockout verification");
    expect(documentXml).toContain("1. Purpose &amp; How to Use This Blueprint");
    expect(documentXml).toContain("1.3 ");
    expect(documentXml).toContain("Use During: ");
    expect(documentXml).toContain(
      "Mobilization, site orientation, daily coordination, permit review, and supervision updates."
    );
    expect(documentXml).toContain("2. Field Execution Snapshot");
    expect(documentXml).toContain("Key Tasks: ");
    expect(documentXml).toContain("2.1.2 ");
    expect(documentXml).toContain("Primary Hazards: ");
    expect(documentXml).toContain("Electrical, Arc flash");
    expect(documentXml).toContain("Trade Package Overview");
    expect(documentXml).toContain("4.1 ");
    expect(documentXml).toContain("Electrical / Shutdown and turnaround: ");
    expect(documentXml).toContain("3. Definitions");
    expect(documentXml).toContain("3.1 Competent person");
    expect(documentXml).toContain("3.2 Stop-work authority");
    expect(documentXml).toContain("4. References");
    expect(documentXml).toContain("6.1 When It Applies");
    expect(documentXml).toContain("Prepared by SafetyDocs360 Draft Builder");
    expect(documentXml).toContain("6.1.1 Selected work or site conditions create fall exposure.");
    expect(documentXml).toContain("6.1.2 Ladders, scaffolds, or aerial lifts are used for access.");
    expect(documentXml).toContain("6.2.1 OSHA 1926 Subpart M - Fall Protection");
    expect(documentXml).toContain("12. Leadership Review &amp; Continuous Improvement");
    expect(documentXml).toContain("12.1 ");
    expect(documentXml).toContain("Priority Focus: ");
    expect(documentXml).toContain("Maintain electrical isolation discipline.");
    expect(documentXml).not.toContain("Section Summary");
    expect(documentXml).not.toContain("Permit Triggers");
    expect(documentXml).not.toContain("Risk Score");
    expect(documentXml).not.toContain("safety_plan_deterministic_assembler");
    expect(documentXml).not.toContain("<w:numPr>");
    expect((documentXml.match(/w:type="page"/g) ?? []).length).toBeGreaterThanOrEqual(
      draft.sectionMap.length + 8
    );
    expect(documentXml.indexOf("1. Purpose & How to Use This Blueprint")).toBeLessThan(
      documentXml.indexOf("2. Field Execution Snapshot")
    );
    expect(documentXml.indexOf("3. Definitions")).toBeLessThan(documentXml.indexOf("4. References"));
    expect(documentXml.indexOf("4. References")).toBeLessThan(
      documentXml.indexOf("5. Safety Narrative")
    );
    expect(documentXml.indexOf("8. Project Overview")).toBeLessThan(
      documentXml.indexOf("11. Hot Work Permit Program")
    );
    expect(documentXml.indexOf("9. Training Program")).toBeLessThan(
      documentXml.indexOf("11. Hot Work Permit Program")
    );
    expect(documentXml.indexOf("10. Permit Matrix")).toBeLessThan(
      documentXml.indexOf("11. Hot Work Permit Program")
    );
    expect(documentXml).toContain("Appendix B. Trade Conflict Coordination Tree");
    expect(stylesXml.match(/w:styleId="BlueprintSectionHeading"/g)).toHaveLength(1);
    expect(stylesXml.match(/w:styleId="BlueprintBody"/g)).toHaveLength(1);
  });

  it("renders reference-pack subsections as stacked briefs without structured table headings", async () => {
    const draft = createDraft();
    draft.sectionMap.splice(5, 0, {
      key: "task_modules_reference",
      title: "Task Modules Reference Pack",
      body: "Task modules attached for the selected scope.",
      subsections: [
        {
          title: "Access Control",
          body: "Controlled entry and movement measures for workers, visitors, and deliveries.",
          bullets: [
            "Mapped tasks: Access control, Site setup",
            "Key sections: 1.1 Unauthorized entry, 1.2 Misrouted movement",
            "Source document: 01_Access_Control.docx",
          ],
        },
      ],
    });

    const doc = await createBlueprintDocument(draft);
    const buffer = await Packer.toBuffer(doc);
    const zip = await openZip({ buffer });
    const documentXml = await zip.read("word/document.xml", "utf-8");

    expect(documentXml).toContain("Task Modules Reference Pack");
    expect(documentXml).toContain("Access Control");
    expect(documentXml).toContain("Controlled entry and movement measures for workers, visitors, and deliveries.");
    expect(documentXml).toContain("Mapped tasks: Access control, Site setup");
    expect(documentXml).toContain("Key sections: 1.1 Unauthorized entry, 1.2 Misrouted movement");
    expect(documentXml).toContain("Source document: 01_Access_Control.docx");
    expect(documentXml).not.toContain("Structured Details");
    expect(documentXml).not.toContain("<w:t>Task Module</w:t>");
  });
});
