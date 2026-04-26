import { describe, expect, it } from "vitest";
import { assertCsepExportQuality } from "@/lib/csepExportQualityCheck";
import { buildCsepRenderModelFromGeneratedDraft } from "@/lib/csepDocxRenderer";
import type { CsepTemplateSection } from "@/lib/csepDocxRenderer";
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

  it("allows Appendix E when hot work / fire watch boilerplate repeats across many tasks", () => {
    const draft = minimalSteelDraft();
    const model = buildCsepRenderModelFromGeneratedDraft(draft);
    const boilerplate =
      "Hot work permit active and posted where required; fire watch where required; maintain extinguisher access and combustible clearance for welding, cutting, or grinding.";
    model.appendixSections.push(appendixETaskHazardMatrixSectionWithControlColumn(boilerplate));
    expect(() => assertCsepExportQuality(model, { draft })).not.toThrow(/appendix_e_duplicate_controls/i);
  });

  it("blocks Appendix E when the same long non-boilerplate control appears across many tasks", () => {
    const draft = minimalSteelDraft();
    const model = buildCsepRenderModelFromGeneratedDraft(draft);
    const unique =
      "Project-specific temporary anchor system design must be signed by the qualified person for tower crane picks on this deck phase marker-unique-xyz-991122.";
    model.appendixSections.push(appendixETaskHazardMatrixSectionWithControlColumn(unique));
    expect(() => assertCsepExportQuality(model, { draft })).toThrow(/appendix_e_duplicate_controls/i);
  });
});

function appendixETaskHazardMatrixSectionWithControlColumn(controlCell: string): CsepTemplateSection {
  const rows = [
    ["Receiving / unloading", "Struck-by", controlCell],
    ["Column setting", "Crush", controlCell],
    ["Field welding", "Ignition", controlCell],
    ["Touch-up painting", "Ignition", controlCell],
  ];
  return {
    key: "appendix_e_task_hazard_control_matrix",
    title: "Appendix E. Task-Hazard-Control Matrix",
    kind: "appendix",
    subsections: [
      {
        title: "Consolidated matrix",
        paragraphs: [],
        items: [],
        table: {
          columns: ["Activity", "Hazard", "Required Controls"],
          rows,
        },
      },
    ],
  };
}

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
