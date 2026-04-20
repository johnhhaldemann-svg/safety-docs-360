import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  buildCsepRenderModelFromGeneratedDraft,
  renderCsepRenderModel,
  renderGeneratedCsepDocx,
  type CsepRenderModel,
} from "@/lib/csepDocxRenderer";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

async function unzipDocx(body: Uint8Array | ArrayBuffer) {
  const zip = await JSZip.loadAsync(body);
  return {
    documentXml: await zip.file("word/document.xml")!.async("string"),
    stylesXml: await zip.file("word/styles.xml")!.async("string"),
    headerXml: zip.file("word/header1.xml")
      ? await zip.file("word/header1.xml")!.async("string")
      : "",
    footerXml: zip.file("word/footer1.xml")
      ? await zip.file("word/footer1.xml")!.async("string")
      : "",
    relationshipsXml: await zip.file("word/_rels/document.xml.rels")!.async("string"),
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
        hazardCategories: ["Fall exposure"],
        permitTriggers: ["lift plan"],
        ppeRequirements: ["Hard Hat", "Harness"],
        requiredControls: ["Controlled decking zone"],
        siteRestrictions: ["Maintain exclusion zone."],
        prohibitedEquipment: [],
        conflicts: [],
      },
    ],
    ruleSummary: {
      permitTriggers: ["lift plan"],
      ppeRequirements: ["Hard Hat", "Harness"],
      requiredControls: ["Controlled decking zone"],
      hazardCategories: ["Fall exposure"],
      siteRestrictions: ["Maintain exclusion zone."],
      prohibitedEquipment: [],
      trainingRequirements: ["Qualified connector"],
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
      score: 12,
      band: "moderate",
      priorities: ["Review lift path and maintain deck-edge protection."],
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
        key: "purpose",
        title: "Purpose & How to Use This Blueprint",
        body: "Use this Blueprint during daily planning and permit coordination.",
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
        key: "emergency_procedures",
        title: "Emergency Procedures",
        body: "Notify site supervision and move to the designated assembly point.",
      },
    ],
    provenance: {
      generator: "test",
    },
  };
}

describe("csepDocxRenderer", () => {
  it("renders the dedicated CSEP document in the calmer steel-erection-inspired style", async () => {
    const model: CsepRenderModel = {
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      tradeLabel: "Steel Erection",
      subTradeLabel: "Decking",
      issueLabel: "April 20, 2026",
      statusLabel: "Draft Issue",
      preparedBy: "SafetyDocs360 Draft Builder",
      coverSubtitleLines: [
        "Trade: Steel Erection",
        "100 River Rd",
        "Sub-trade: Decking",
        "Tasks: Deck placement",
      ],
      coverMetadataRows: [
        { label: "Project Number", value: "RT-100" },
        { label: "Project Address", value: "100 River Rd" },
        { label: "Owner / Client", value: "Owner Group" },
        { label: "GC / CM", value: "GC Partners" },
        { label: "Contractor", value: "ABC Steel" },
        { label: "Prepared By", value: "SafetyDocs360 Draft Builder" },
        { label: "Date", value: "April 20, 2026" },
        { label: "Revision", value: "1.0" },
      ],
      approvalLines: [
        "Project Manager / Competent Person: ___________________________ Signature / Date",
        "Corporate Safety Director: ___________________________ Signature / Date",
      ],
      revisionHistory: [
        {
          revision: "1.0",
          date: "April 20, 2026",
          description: "Initial issuance for contractor CSEP export",
          preparedBy: "SafetyDocs360 Draft Builder",
          approvedBy: "Pending approval",
        },
      ],
      frontMatterSections: [
        {
          key: "document_control",
          kind: "front_matter",
          title: "0.0 Document Control",
          numberLabel: "0.0",
          subsections: [
            {
              title: "Document Control",
              table: {
                columns: ["Field", "Value"],
                rows: [["Project Name / Site", "Riverfront Tower"]],
              },
            },
          ],
        },
      ],
      sections: [
        {
          key: "company_overview_and_safety_philosophy",
          kind: "main",
          title: "1.0 Company Overview and Safety Philosophy",
          numberLabel: "1.0",
          closingTagline:
            '"If we cannot perform the work safely and in full compliance with this CSEP and project requirements, we do not do it at all."',
          subsections: [
            {
              title: "Purpose and Scope",
              items: [
                "This section establishes the contractor's commitment to safe work.",
                "It applies to all field personnel assigned to the project.",
              ],
            },
          ],
        },
        {
          key: "hse_elements_and_site_specific_hazard_analysis",
          kind: "main",
          title: "18.0 HSE Elements / Site-Specific Hazard Analysis",
          numberLabel: "18.0",
          closingTagline:
            '"If we cannot perform the work safely and in full compliance with this CSEP and project requirements, we do not do it at all."',
          subsections: [
            {
              title: "Activity Hazard Analysis Matrix",
              items: ["Review lift path before each pick."],
              table: {
                columns: ["Activity", "Hazard", "Controls"],
                rows: [["Deck placement", "Fall exposure", "Controlled decking zone"]],
              },
            },
          ],
        },
      ],
      appendixSections: [
        {
          key: "appendix_a_forms_and_permit_library",
          kind: "appendix",
          title: "Appendix A. Forms and Permit Library",
          numberLabel: "Appendix A",
          subsections: [
            {
              title: "Library",
              items: ["Permit templates and structured placeholders."],
            },
          ],
        },
      ],
      disclaimerLines: ["Generated draft disclaimer."],
      filenameProjectPart: "Riverfront_Tower",
    };

    const rendered = await renderCsepRenderModel(model);
    const { documentXml, stylesXml, headerXml, footerXml, relationshipsXml } = await unzipDocx(
      rendered.body
    );

    expect(documentXml).toContain("CONTRACTOR SAFETY &amp; ENVIRONMENTAL PLAN (CSEP)");
    expect(documentXml).toContain(
      "Project-specific safety, environmental, and permit requirements for field execution"
    );
    expect(documentXml).toContain("0.0 Document Control");
    expect(documentXml).toContain("Revision History");
    expect(documentXml).toContain("Table of Contents");
    expect(documentXml).toContain("1.0 Company Overview and Safety Philosophy");
    expect(documentXml).toContain("Purpose and Scope");
    expect(documentXml).toContain("This section establishes the contractor");
    expect(documentXml).toContain("Appendix A. Forms and Permit Library");
    expect(documentXml).toContain("Disclaimer");
    expect(documentXml).toContain("18.1 Activity Hazard Analysis Matrix");
    expect(documentXml).toContain("18.1.1");
    expect(documentXml).toContain("Review lift path before each pick.");
    expect(documentXml).toContain("<w:tbl>");
    expect(documentXml.indexOf("1.0 Company Overview and Safety Philosophy")).toBeLessThan(
      documentXml.indexOf("18.0 HSE Elements / Site-Specific Hazard Analysis")
    );
    expect(stylesXml).toContain('w:styleId="CsepSectionHeading"');
    expect(stylesXml).toContain('w:styleId="CsepBody"');
    expect(stylesXml).toContain("Calibri");
    expect(stylesXml).toContain("365F91");
    expect(stylesXml).toContain("4F81BD");
    expect(headerXml).toBe("");
    expect(footerXml).toContain("PAGE");
    expect(footerXml).toContain("NUMPAGES");
    expect(relationshipsXml).toContain("relationships/footer");
    expect(relationshipsXml).not.toContain("relationships/header");
  });

  it("adapts generated drafts into CSEP language instead of blueprint language", async () => {
    const draft = createGeneratedDraft();
    const model = buildCsepRenderModelFromGeneratedDraft(draft);

    expect(model.frontMatterSections[0]?.title).toBe("0.0 Document Control");
    expect(model.sections[0]?.title).toBe("1.0 Company Overview and Safety Philosophy");

    const rendered = await renderGeneratedCsepDocx(draft);
    const { documentXml, headerXml, footerXml } = await unzipDocx(rendered.body);

    expect(documentXml).toContain("0.0 Document Control");
    expect(documentXml).toContain("1.0 Company Overview and Safety Philosophy");
    expect(documentXml).toContain("How to Use This Plan");
    expect(documentXml).not.toContain("Blueprint");
    expect(documentXml).toContain("Table of Contents");
    expect(documentXml).toContain("Appendix A. Forms and Permit Library");
    expect(documentXml).toContain("Disclaimer");
    expect(headerXml).toBe("");
    expect(footerXml).toContain("PAGE");
  });
});
