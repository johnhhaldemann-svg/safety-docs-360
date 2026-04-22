import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  buildCsepTemplateSections,
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
      {
        key: "life_saving_rules",
        title: "Life-Saving Rules",
        table: {
          columns: ["Rule Domain", "Rule Text"],
          rows: [
            [
              "8.1 Work Stoppage",
              "Stop work when fall protection, access, or rescue conditions are not in place.",
            ],
            [
              "8.2 Permit and Authorization Control",
              "Do not bypass permit, energy-isolation, or authorization requirements.",
            ],
            [
              "8.3 Line-of-Fire and Struck-By Prevention",
              "Stay clear of line-of-fire, suspended-load, and struck-by exposure zones.",
            ],
            [
              "8.4 Emergency Response and Evacuation",
              "Use emergency response, shelter, and evacuation procedures immediately when triggers are met.",
            ],
          ],
        },
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
      preparedBy: "ABC Steel",
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
        { label: "Prepared By", value: "ABC Steel" },
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
          preparedBy: "ABC Steel",
          approvedBy: "ABC Steel",
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
                title: "Company Overview and Safety Philosophy",
                items: [
                  "This section establishes the contractor's commitment to safe work.",
                  "It applies to all field personnel assigned to the project.",
                ],
              },
            {
              title: "Resource Availability",
              paragraphs: [
                "Ensuring access to all necessary regulations and standards for training and compliance review.",
              ],
              items: [
                "Compliance documents readily available on site",
                "Training on regulatory requirements included in orientation",
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
    expect(documentXml).not.toContain("COMPANY LOGO PLACEMENT");
    expect(documentXml).not.toContain("Insert contractor logo or approved company letterhead here");
    expect(documentXml).toContain("0.0 Document Control");
    expect(documentXml).toContain("0.0.1");
    expect(documentXml).not.toContain("0.0.1.1");
    expect(documentXml).toContain("Field: Project Name / Site");
      expect(documentXml).toContain("Revision History");
      expect(documentXml).toContain("Table of Contents");
      expect(documentXml).toContain("1.0 Company Overview and Safety Philosophy");
      expect(documentXml).toContain("This section establishes the contractor");
      expect(documentXml).toContain("1.1");
      expect(documentXml).toContain("1.2");
      expect(documentXml).toMatch(/1\.3[\s\S]*Resource Availability/);
      expect(documentXml).toContain("1.3.1");
      expect(documentXml).toContain("Compliance documents readily available on site");
      expect(documentXml).not.toContain("1.2 Resource Availability");
    expect(documentXml).toContain("Appendix A. Forms and Permit Library");
    expect(documentXml).toContain("Disclaimer");
    expect(documentXml).toMatch(/18\.1[\s\S]*Activity Hazard Analysis Matrix/);
    expect(documentXml).toContain("18.1.1");
    expect(documentXml).toContain("Review lift path before each pick.");
    expect(documentXml).toContain("18.1.2");
    expect(documentXml).toContain("Activity: Deck placement");
    expect(documentXml).toContain("Hazard: Fall exposure");
    expect(documentXml).not.toContain("<w:tbl>");
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
    expect(model.sections[0]?.title).toBe("Contractor Safety Policy Statement");
    expect(model.sections.map((section) => section.title)).toContain(
      "Project & Site Information"
    );
    expect(model.sections.map((section) => section.title)).toContain(
      "Life-Saving Rules & Stop-Work Authority"
    );

    const rendered = await renderGeneratedCsepDocx(draft);
    const { documentXml, headerXml, footerXml } = await unzipDocx(rendered.body);

    expect(documentXml).toContain("0.0 Document Control");
    expect(documentXml).toContain("Definitions and Abbreviations");
    expect(documentXml).toContain("CBA");
    expect(documentXml).toContain("Collective bargaining or labor-agreement language");
    expect(documentXml).not.toContain("0.1.1 Term / Abbreviation:");
    expect(documentXml).not.toContain("Definition / Intended Use:");
    expect(documentXml).toContain("Project &amp; Site Information");
    expect(documentXml).toContain("How to Use This Plan");
    expect(documentXml).not.toContain("Blueprint");
    expect(documentXml).toContain("Life-Saving Rules");
    expect(documentXml).not.toContain("Rule Domain:");
    expect(documentXml).not.toContain("Rule Text:");
    expect(documentXml).not.toContain("8.1 Work Stoppage");
    expect(documentXml).toContain("Table of Contents");
    expect(documentXml).toContain("Appendix A. Forms and Permit Library");
    expect(documentXml).toContain("Disclaimer");
    expect(headerXml).toBe("");
    expect(footerXml).toContain("PAGE");
  });

  it("suppresses repeated subsection headings when they only restate a numbered item", async () => {
    const model: CsepRenderModel = {
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      tradeLabel: "Steel Erection",
      subTradeLabel: "Decking",
      issueLabel: "April 20, 2026",
      statusLabel: "Draft Issue",
      preparedBy: "ABC Steel",
      coverSubtitleLines: [],
      coverMetadataRows: [],
      approvalLines: [],
      revisionHistory: [],
      frontMatterSections: [],
      sections: [
        {
          key: "project_scope_and_trade_specific_activities",
          kind: "main",
          title: "2.0 Project Scope and Trade-Specific Activities",
          numberLabel: "2.0",
          subsections: [
            {
              title: "Unload steel",
              paragraphs: [
                "Receive, inspect, and safely offload delivered steel members and materials.",
              ],
            },
            {
              title: "Sort members",
              paragraphs: [
                "Organize steel by type, mark, sequence, and installation priority.",
              ],
            },
          ],
        },
      ],
      appendixSections: [],
      disclaimerLines: ["Generated draft disclaimer."],
      filenameProjectPart: "Riverfront_Tower",
    };

    const rendered = await renderCsepRenderModel(model);
    const { documentXml } = await unzipDocx(rendered.body);

    expect(documentXml).toContain("2.1 ");
    expect(documentXml).toContain("2.2 ");
    expect(documentXml).toContain("Unload steel");
    expect(documentXml).toContain("Sort members");
    expect(documentXml).toContain("Receive, inspect, and safely offload delivered steel members and materials.");
    expect(documentXml).toContain("Organize steel by type, mark, sequence, and installation priority.");
    expect(documentXml).not.toContain("2.1.1 Unload steel");
    expect(documentXml).not.toContain("2.2.1 Sort members");
    expect(documentXml.match(/Unload steel/g)?.length ?? 0).toBe(1);
    expect(documentXml.match(/Sort members/g)?.length ?? 0).toBe(1);
  });

  it("renders nested source-numbered items as indented child paragraphs instead of inline parent text", async () => {
    const model: CsepRenderModel = {
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      tradeLabel: "Steel Erection",
      subTradeLabel: "Decking",
      issueLabel: "April 20, 2026",
      statusLabel: "Draft Issue",
      preparedBy: "ABC Steel",
      coverSubtitleLines: [],
      coverMetadataRows: [],
      approvalLines: [],
      revisionHistory: [],
      frontMatterSections: [],
      sections: [
        {
          key: "related_considerations",
          kind: "main",
          title: "1.28.9 Related Considerations",
          numberLabel: "1.28.9",
          subsections: [
            {
              title: "Related Considerations",
              paragraphs: [
                "1.1 Task Scope and Work Conditions  Verify the active sequence, work area, support steel, and handoff assumptions before work starts.",
                "1.2 Main Hazards  Review unstable access, shifting loads, changing weather, and interface risk before the crew proceeds.",
              ],
            },
          ],
        },
      ],
      appendixSections: [],
      disclaimerLines: ["Generated draft disclaimer."],
      filenameProjectPart: "Riverfront_Tower",
    };

    const rendered = await renderCsepRenderModel(model);
    const { documentXml } = await unzipDocx(rendered.body);

    expect(documentXml).toContain("1.28.9 Related Considerations");
    expect(documentXml).toMatch(/1\.28\.9\.1[\s\S]*Task Scope and Work Conditions/);
    expect(documentXml).toContain(
      "Verify the active sequence, work area, support steel, and handoff assumptions before work starts."
    );
    expect(documentXml).toMatch(/1\.28\.9\.2[\s\S]*Main Hazards/);
    expect(documentXml).toContain(
      "Review unstable access, shifting loads, changing weather, and interface risk before the crew proceeds."
    );
    expect(documentXml).not.toContain("1.1 Task Scope and Work Conditions");
    expect(documentXml).not.toContain("1.2 Main Hazards");
    expect(documentXml).toContain('w:left="540"');
    expect(documentXml).toContain('w:hanging="240"');
    expect(documentXml).toContain('w:left="780"');
  });

  it("folds main-section lead narrative into numbered fallback formatting when structured content exists", () => {
    const [section] = buildCsepTemplateSections({
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      issueLabel: "April 20, 2026",
      sourceSections: [
        {
          key: "roles_and_responsibilities",
          kind: "main",
          order: 12,
          title: "3.0 Roles and Responsibilities",
          numberLabel: "3.0",
          body: "Custom role narrative from the builder.",
          table: {
            columns: ["Role", "Minimum Responsibilities", "Authority / Hold Point"],
            rows: [["Superintendent", "Lead the crew.", "Approve restart."]],
          },
        },
      ],
    });

    expect(section?.subsections[0]?.paragraphs ?? []).toEqual([]);
    expect(section?.subsections[0]?.items ?? []).toContain("Custom role narrative from the builder.");
    expect(section?.subsections[0]?.table?.rows).toEqual([
      ["Superintendent", "Lead the crew.", "Approve restart."],
    ]);
  });

  it("strips internal drafting notes and raw placeholders from the final DOCX", async () => {
    const draft = createGeneratedDraft();
    draft.documentControl = {
      preparedBy: "SafetyDocs360 AI Draft Builder",
      approvedBy: "Pending approval",
      projectSite: "[Platform Fill Field]",
    };
    draft.aiAssemblyDecisions = {
      frontMatterGuidance:
        "Use the front matter to orient field teams quickly, keep placeholders explicit, and keep gap callouts visible.",
      coverageGuidance: "Keep this section concise, customer-facing, and ready for builder edits.",
      sectionDecisions: {
        company_overview_and_safety_philosophy:
          "Keep this section concise, customer-facing, and ready for builder edits.",
      },
    };
    draft.sectionMap = [
      {
        key: "company_overview_and_safety_philosophy",
        title: "Company Overview",
        body: "Keep this section concise, customer-facing, and ready for builder edits.",
      },
      {
        key: "emergency_procedures",
        title: "Emergency Procedures",
        body: "Call site supervision and move to the designated assembly point.",
      },
    ];

    const rendered = await renderGeneratedCsepDocx(draft);
    const { documentXml } = await unzipDocx(rendered.body);

    expect(documentXml).not.toContain("Keep this section concise");
    expect(documentXml).not.toContain("Use the front matter to orient field teams quickly");
    expect(documentXml).not.toContain("Platform Fill Field");
    expect(documentXml).not.toContain("Pending approval");
    expect(documentXml).not.toContain("SafetyDocs360 AI Draft Builder");
  });

  it("normalizes internal automation labels before validating generated CSEP exports", async () => {
    const draft = createGeneratedDraft();
    draft.sectionMap.push({
      key: "contractor_safety_policy_statement_generated",
      title: "Contractor Safety Policy Statement",
      subsections: [
        {
          title: "Receiving, Unloading, Inspecting and Staging Steel",
          bullets: [
            "Applicability / trigger logic: Apply this module whenever Unload steel, Sort members is in the work plan, when the crew changes phase.",
          ],
        },
      ],
    });

    const rendered = await renderGeneratedCsepDocx(draft);
    const { documentXml } = await unzipDocx(rendered.body);

    expect(documentXml).toContain(
      "This section applies when Unload steel, Sort members is in the work plan, when the crew changes phase."
    );
    expect(documentXml).not.toContain("Applicability / trigger logic");
  });

  it("fails export when duplicate section numbers are present in the final model", async () => {
    const model: CsepRenderModel = {
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      tradeLabel: "Steel Erection",
      subTradeLabel: "Decking",
      issueLabel: "April 20, 2026",
      statusLabel: "Contractor Issue",
      preparedBy: "ABC Steel",
      coverSubtitleLines: [],
      coverMetadataRows: [],
      approvalLines: [],
      revisionHistory: [],
      frontMatterSections: [],
      sections: [
        {
          key: "roles_and_responsibilities",
          kind: "main",
          title: "3.0 Roles and Responsibilities",
          numberLabel: "3.0",
          subsections: [{ title: "Superintendent", paragraphs: ["Lead the crew."], items: [] }],
        },
        {
          key: "security_and_access_control",
          kind: "main",
          title: "3.0 Security and Access Control",
          numberLabel: "3.0",
          subsections: [{ title: "Worker access", paragraphs: ["Use approved gates only."], items: [] }],
        },
      ],
      appendixSections: [],
      disclaimerLines: ["Generated draft disclaimer."],
      filenameProjectPart: "Riverfront_Tower",
    };

    await expect(renderCsepRenderModel(model)).rejects.toThrow("duplicate section number 3.0");
  });

  it("fails export when unresolved placeholder content remains in the final model", async () => {
    const model: CsepRenderModel = {
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      tradeLabel: "Steel Erection",
      subTradeLabel: "Decking",
      issueLabel: "April 20, 2026",
      statusLabel: "Contractor Issue",
      preparedBy: "ABC Steel",
      coverSubtitleLines: [],
      coverMetadataRows: [],
      approvalLines: [],
      revisionHistory: [],
      frontMatterSections: [],
      sections: [
        {
          key: "roles_and_responsibilities",
          kind: "main",
          title: "3.0 Roles and Responsibilities",
          numberLabel: "3.0",
          subsections: [{ title: "Superintendent", paragraphs: ["TBD by contractor before issue"], items: [] }],
        },
      ],
      appendixSections: [],
      disclaimerLines: ["Generated draft disclaimer."],
      filenameProjectPart: "Riverfront_Tower",
    };

    await expect(renderCsepRenderModel(model)).rejects.toThrow(
      'unresolved placeholder content remains in final export. Source: Subsection paragraph: 3.0 Roles and Responsibilities / Superintendent / 1 = "TBD by contractor before issue".'
    );
  });

  it("fails export when internal-only generation terminology remains in the final model", async () => {
    const model: CsepRenderModel = {
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      tradeLabel: "Steel Erection",
      subTradeLabel: "Decking",
      issueLabel: "April 20, 2026",
      statusLabel: "Contractor Issue",
      preparedBy: "ABC Steel",
      coverSubtitleLines: [],
      coverMetadataRows: [],
      approvalLines: [],
      revisionHistory: [],
      frontMatterSections: [],
      sections: [
        {
          key: "site_controls",
          kind: "main",
          title: "1.0 Site Controls",
          numberLabel: "1.0",
          subsections: [
            {
              title: "Access",
              paragraphs: ["Applicability / trigger logic: Apply this module whenever access control changes."],
              items: [],
            },
          ],
        },
      ],
      appendixSections: [],
      disclaimerLines: ["Generated draft disclaimer."],
      filenameProjectPart: "Riverfront_Tower",
    };

    await expect(renderCsepRenderModel(model)).rejects.toThrow(
      'internal-only generation terminology remains in final export. Source: Subsection paragraph: 1.0 Site Controls / Access / 1 = "Applicability / trigger logic: Apply this module whenever access control changes.".'
    );
  });

  it("renders document-control front matter with N/A instead of blocking placeholders when optional fields are blank", async () => {
    const draft = createGeneratedDraft();
    draft.projectOverview.projectName = "";
    draft.projectOverview.projectNumber = "";
    draft.projectOverview.projectAddress = "";
    draft.projectOverview.ownerClient = "";
    draft.projectOverview.gcCm = "";
    draft.projectOverview.contractorCompany = "";
    draft.documentControl = {
      projectSite: "",
      primeContractor: "",
      clientOwner: "",
      documentNumber: "",
      revision: "",
      issueDate: "",
      preparedBy: "",
      reviewedBy: "",
      approvedBy: "",
    };

    const rendered = await renderGeneratedCsepDocx(draft);
    const { documentXml } = await unzipDocx(rendered.body);

    expect(documentXml).toContain("Field: Project Name / Site");
    expect(documentXml).toContain("Value: N/A");
    expect(documentXml).not.toContain("TBD by contractor before issue");
  });
});
