import { describe, expect, it } from "vitest";
import * as mammoth from "mammoth";
import { renderSafetyPlanDocx } from "@/lib/safety-intelligence/documents/render";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

function createDraft(documentType: "csep" | "pshsep"): GeneratedSafetyPlanDraft {
  return {
    documentType,
    projectDeliveryType: documentType === "pshsep" ? "renovation" : "ground_up",
    title:
      documentType === "csep"
        ? "Refinery Turnaround CSEP"
        : "Refinery Turnaround PSHSEP",
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
        taskTitle: "Isolation planning",
        equipmentUsed: ["Voltage tester"],
        workConditions: ["Indoor"],
        hazardCategories: ["Arc flash"],
        permitTriggers: ["energized electrical permit"],
        ppeRequirements: ["Arc-rated PPE"],
        requiredControls: ["test before touch"],
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
      rows: [
        {
          operationId: "op-1",
          tradeCode: "electrical",
          tradeLabel: "Electrical",
          subTradeCode: "shutdown_and_turnaround",
          subTradeLabel: "Shutdown and turnaround",
          taskCode: "cable_pull",
          taskTitle: "Cable pull",
          trainingCode: "qualified_electrical_worker",
          trainingTitle: "Qualified electrical worker",
          matchKeywords: ["Qualified electrical worker"],
          sourceLabels: ["Rule evaluation"],
          whySource: "Rule evaluation",
        },
      ],
      summaryTrainingTitles: ["Qualified electrical worker"],
    },
    narrativeSections: {
      safetyNarrative: "Narrative",
    },
    sectionMap: [
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
        key: "definitions",
        title: "Definitions",
        summary: "Shared terminology and roles used throughout the document.",
        body: "Define competent person and ancillary contractor terms.",
        bullets: [
          "Competent person: An individual capable of identifying existing and predictable hazards and authorized to take prompt corrective measures.",
          "Stop-work authority: Any worker or supervisor may pause work when conditions become unsafe.",
        ],
      },
      {
        key: "high_risk_loto",
        title: "LOTO & Stored Energy Isolation",
        body: "Cover all energy sources and zero-energy verification.",
        subsections: [
          {
            title: "Shift Change Controls",
            body: "Document continuity between crews before locks are transferred.",
            bullets: ["Verify isolation before work restarts."],
          },
        ],
        table: {
          columns: ["Activity", "Hazard", "Controls"],
          rows: [["Cable pull", "Electrical exposure", "Verified isolation"]],
        },
      },
    ],
    provenance: {
      generator: "test",
    },
  };
}

async function renderedHtml(documentType: "csep" | "pshsep") {
  const rendered = await renderSafetyPlanDocx(createDraft(documentType));
  const html = await mammoth.convertToHtml({
    buffer: Buffer.from(rendered.body),
  });

  return {
    rendered,
    html: html.value,
  };
}

describe("renderSafetyPlanDocx", () => {
  it("renders the redesigned site blueprint with front matter and section content", async () => {
    const { rendered, html } = await renderedHtml("pshsep");

    expect(rendered.filename).toBe(
      "Refinery_Turnaround_PSHSEP_Draft.docx"
    );
    expect(html).toContain("PSHSEP");
    expect(html).toContain("Document Summary");
    expect(html).toContain("High-Risk Work Snapshot");
    expect(html).toContain("Revision / Prepared By");
    expect(html).toContain("Trade Package Overview");
    expect(html).toContain("SafetyDocs360 Draft Builder");
    expect(html).toContain("Contents");
    expect(html).toContain("FRONT MATTER");
    expect(html).toContain("DETAILED SECTIONS");
    expect(html).toContain("APPENDICES");
    expect(html).toContain("Purpose &amp; How to Use This Blueprint");
    expect(html).toContain("Field Execution Snapshot");
    expect(html).toContain("Definitions");
    expect(html).toContain("LOTO &amp; Stored Energy Isolation");
    expect(html).toContain("Trade Conflict Coordination Tree");
    expect(html).toContain("Building Refurbishment / Renovation profile.");
    expect(html).toContain("Electrical / Shutdown and turnaround");
    expect(html).toContain("Tasks:");
    expect(html).toContain("Key Tasks:");
    expect(html).toContain("Cable pull, Isolation planning");
    expect(html).toContain("5.1 Shift Change Controls");
    expect(html).toContain("5.1.1 Verify isolation before work restarts.");
    expect(html).toContain("Document continuity between crews before locks are transferred.");
    expect(html).toContain("Define competent person and ancillary contractor terms.");
    expect(html).toContain(
      "4.1 Competent person: An individual capable of identifying existing and predictable hazards and authorized to take prompt corrective measures."
    );
    expect(html).toContain(
      "4.2 Stop-work authority: Any worker or supervisor may pause work when conditions become unsafe."
    );
    expect(html).toContain("Leadership Review &amp; Continuous Improvement");
    expect(html).toContain("Appendix A. Disclaimer");
    expect(html).not.toContain("<ul>");
    expect(html).toContain("<table");
    expect(html).not.toContain("Permit Triggers");
    expect(html).not.toContain("Risk Score");

    expect(html.indexOf("Document Summary")).toBeLessThan(html.indexOf("Definitions"));
    expect(html.indexOf("High-Risk Work Snapshot")).toBeLessThan(
      html.indexOf("LOTO &amp; Stored Energy Isolation")
    );
    expect(html.indexOf("FRONT MATTER")).toBeLessThan(html.indexOf("DETAILED SECTIONS"));
    expect(html.indexOf("DETAILED SECTIONS")).toBeLessThan(html.indexOf("APPENDICES"));
    expect(html.indexOf("APPENDICES")).toBeLessThan(html.indexOf("Appendix A. "));
  });

  it("renders the redesigned contractor blueprint with the shared formal layout", async () => {
    const { rendered, html } = await renderedHtml("csep");

    expect(rendered.filename).toBe(
      "Refinery_Turnaround_CSEP_Draft.docx"
    );
    expect(html).toContain("CSEP");
    expect(html).toContain("Contractor");
    expect(html).toContain("Prepared By");
    expect(html).toContain("SafetyDocs360 Draft Builder");
    expect(html).toContain("Trade Package Overview");
    expect(html).toContain("FRONT MATTER");
    expect(html).toContain("DETAILED SECTIONS");
    expect(html).toContain("APPENDICES");
    expect(html).toContain("Electrical / Shutdown and turnaround");
    expect(html).toContain("Purpose &amp; How to Use This Blueprint");
    expect(html).toContain("Field Execution Snapshot");
    expect(html).toContain("Training Program");
    expect(html).toContain("Project Name:");
    expect(html).toContain("Refinery Turnaround");
    expect(html).toContain("Qualified electrical worker");
    expect(html).toContain("Required PPE");
    expect(html).toContain("Ground-Up New Build");
    expect(html).toContain("2.1 Electrical / Shutdown and turnaround");
    expect(html).toContain("1.2 <strong>Scope Covered: </strong>");
    expect(html).toContain("Hazard");
    expect(html).toContain("Controls:");
    expect(html).toContain("Electrical exposure");
    expect(html).toContain("Verified isolation");
    expect(html).toContain("Define competent person and ancillary contractor terms.");
    expect(html).toContain(
      "4.1 Competent person: An individual capable of identifying existing and predictable hazards and authorized to take prompt corrective measures."
    );
    expect(html).toContain(
      "5.1.1 Verify isolation before work restarts."
    );
    expect(html).toContain("6. Leadership Review &amp; Continuous Improvement");
    expect(html).not.toContain("<ul>");
    expect(html).toContain("<table");
    expect(html).not.toContain("Permit Triggers");
    expect(html).not.toContain("Risk Score");
    expect(html.indexOf("FRONT MATTER")).toBeLessThan(html.indexOf("DETAILED SECTIONS"));
    expect(html.indexOf("DETAILED SECTIONS")).toBeLessThan(html.indexOf("APPENDICES"));
  });
});
