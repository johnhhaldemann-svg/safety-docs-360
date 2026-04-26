import { describe, expect, it } from "vitest";
import { assertCsepExportQuality } from "@/lib/csepExportQualityCheck";
import { buildCsepRenderModelFromGeneratedDraft } from "@/lib/csepDocxRenderer";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

describe("assertCsepExportQuality", () => {
  it("passes for the standard renderer fixture draft", () => {
    const draft = minimalSteelDraft();
    const model = buildCsepRenderModelFromGeneratedDraft(draft);
    expect(() => assertCsepExportQuality(model, { draft })).not.toThrow();
  });

  it("blocks export when a task module subsection has no safety content", () => {
    const draft = minimalSteelDraft();
    const model = buildCsepRenderModelFromGeneratedDraft(draft);
    model.frontMatterSections.push({
      key: "steel_task_modules_reference",
      title: "Steel Erection Task Modules Reference Pack",
      subsections: [
        {
          title: "Receiving, Unloading — Required safety controls",
          paragraphs: [],
          items: [],
        },
      ],
    });
    expect(() => assertCsepExportQuality(model, { draft })).toThrow(/task_module_empty/i);
  });

  it("blocks export when Document Control is placed in front matter", () => {
    const draft = minimalSteelDraft();
    const model = buildCsepRenderModelFromGeneratedDraft(draft);
    model.frontMatterSections.unshift({
      key: "document_control_and_revision_history",
      title: "Document Control and Revision History",
      subsections: [{ title: "Revisions", paragraphs: ["Keep on file."], items: [] }],
    });
    expect(() => assertCsepExportQuality(model, { draft })).toThrow(/document_control_placement/i);
  });
});

function minimalSteelDraft(): GeneratedSafetyPlanDraft {
  return {
    documentType: "csep",
    projectDeliveryType: "ground_up",
    title: "QC Test CSEP",
    projectOverview: {
      projectName: "QC Tower",
      projectNumber: "QC-1",
      projectAddress: "1 Test Way",
      ownerClient: "Owner",
      gcCm: "GC",
      contractorCompany: "Contractor",
      location: "Site",
      schedule: "2026",
    },
    operations: [
      {
        operationId: "op-qc",
        tradeLabel: "Steel Erection",
        subTradeLabel: "Steel erection / decking",
        taskTitle: "Decking install",
        workAreaLabel: "L4",
        locationGrid: "A1",
        equipmentUsed: ["Crane"],
        workConditions: ["Wind"],
        hazardCategories: ["Fall exposure", "Suspended loads"],
        permitTriggers: ["Lift plan"],
        ppeRequirements: ["Harness", "Hard hat"],
        requiredControls: ["Controlled decking zone", "Tag lines"],
        siteRestrictions: [],
        prohibitedEquipment: [],
        conflicts: [],
      },
    ],
    ruleSummary: {
      permitTriggers: ["Lift plan"],
      ppeRequirements: ["Harness"],
      requiredControls: ["CDZ"],
      hazardCategories: ["Fall exposure"],
      siteRestrictions: [],
      prohibitedEquipment: [],
      trainingRequirements: [],
      weatherRestrictions: [],
    },
    conflictSummary: {
      total: 0,
      intraDocument: 0,
      external: 0,
      highestSeverity: "low",
      items: [],
    },
    riskSummary: {
      score: 1,
      band: "low",
      priorities: ["Plan picks."],
    },
    trainingProgram: { rows: [], summaryTrainingTitles: [] },
    narrativeSections: { safetyNarrative: "Site narrative." },
    sectionMap: [
      {
        key: "purpose",
        title: "Purpose",
        body: "Purpose text for the project.",
      },
      {
        key: "hazcom_program",
        title: "Hazard Communication Program",
        bullets: ["Maintain SDS access on site.", "Label secondary containers."],
      },
      {
        key: "incident_reporting_and_investigation",
        title: "Incident Reporting",
        bullets: ["Report incidents to supervision.", "Call 911 for medical emergencies and initiate rescue as trained."],
      },
    ],
    provenance: { generator: "test" },
  };
}
