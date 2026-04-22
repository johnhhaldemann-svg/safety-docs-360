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
    expect(documentXml).not.toContain("0.0.1");
    expect(documentXml).toContain("Project Name / Site");
    expect(documentXml).not.toContain("Field:");
    expect(documentXml).not.toContain("Value:");
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
    expect(documentXml).toContain("Deck placement");
    expect(documentXml).toContain("Hazard:");
    expect(documentXml).toContain("Fall exposure");
    expect(documentXml).toContain("Controls:");
    expect(documentXml).toContain("Controlled decking zone");
    expect(documentXml).not.toContain("Activity: Deck placement");
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

    expect(model.frontMatterSections[0]?.title).toBe("Document Control");
    expect(model.sections.map((section) => section.title)).toContain(
      "Project & Contractor Information"
    );
    expect(model.sections.map((section) => section.title)).toContain(
      "Scope Summary"
    );
    expect(model.sections.map((section) => section.title)).toContain(
      "Hazard Control Sections"
    );

    const rendered = await renderGeneratedCsepDocx(draft);
    const { documentXml, headerXml, footerXml } = await unzipDocx(rendered.body);

    expect(documentXml).toContain("Document Control");
    expect(documentXml).not.toContain("Definitions and Abbreviations");
    expect(documentXml).not.toContain("How to Use This Plan");
    expect(documentXml).not.toContain("CBA");
    expect(documentXml).not.toContain("Collective bargaining or labor-agreement language");
    expect(documentXml).not.toContain("0.1.1 Term / Abbreviation:");
    expect(documentXml).not.toContain("Definition / Intended Use:");
    expect(documentXml).toContain("Project &amp; Contractor Information");
    expect(documentXml).toContain("Scope Summary");
    expect(documentXml).not.toContain("Blueprint");
    expect(documentXml).toContain("Hazard Control Sections");
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

  it("renders numbered source items from subsection bullets as true child sections", async () => {
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
          key: "steel_task_modules_reference",
          kind: "main",
          title: "1.25.9 Steel Erection Task Modules Reference Pack",
          numberLabel: "1.25.9",
          subsections: [
            {
              title: "Receiving, Unloading, Inspecting and Staging Steel",
              items: [
                "Required controls during the work: Establish the work zone, maintain the sequence, control access, protect workers below, and keep the task stable for the next step before release.",
                "3.1 Core equipment  Typical equipment includes lifting equipment, approved rigging, tag lines, dunnage, radios, inspection paperwork, and access-control devices for the unloading zone.",
                "7.1 Typical approvals  This task may require traffic-control, road-use, or site-access approvals when unloading affects shared routes or occupied facilities.",
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

    expect(documentXml).toContain(
      "Required controls during the work: Establish the work zone, maintain the sequence, control access, protect workers below, and keep the task stable for the next step before release."
    );
    expect(documentXml).toMatch(
      /1\.25\.9\.1[\s\S]*Receiving, Unloading, Inspecting and Staging Steel/
    );
    expect(documentXml).toMatch(/1\.25\.9\.1\.1[\s\S]*Core equipment/);
    expect(documentXml).toContain(
      "Typical equipment includes lifting equipment, approved rigging, tag lines, dunnage, radios, inspection paperwork, and access-control devices for the unloading zone."
    );
    expect(documentXml).toMatch(/1\.25\.9\.1\.2[\s\S]*Typical approvals/);
    expect(documentXml).not.toContain("3.1 Core equipment");
    expect(documentXml).not.toContain("7.1 Typical approvals");
  });

  it("promotes inline numbered narrative fragments into clean items and drops orphaned partial fragments", () => {
    const [section] = buildCsepTemplateSections({
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      issueLabel: "April 20, 2026",
      sourceSections: [
        {
          key: "training_orientation",
          kind: "main",
          title: "6.0 Training, Permit, and PPE",
          numberLabel: "6.0",
          body:
            "The crew shall review training, permit ownership, and PPE readiness before starting exposed work. 1. Confirm active permit coverage and posting at the work face. 2. Training relevant to steel erection, rigging, and welding. 3. Verify required PPE is inspected and available for each assigned worker.",
        },
      ],
    });

    expect(section.subsections).toEqual([
      {
        title: "",
        paragraphs: [
          "The crew shall review training, permit ownership, and PPE readiness before starting exposed work.",
        ],
        items: [
          "Confirm active permit coverage and posting at the work face.",
          "Verify required PPE is inspected and available for each assigned worker.",
        ],
        table: null,
      },
    ]);
  });

  it("keeps security and access subsections out of subcontractor management in fallback grouping", () => {
    const sections = buildCsepTemplateSections({
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      issueLabel: "April 20, 2026",
      sourceSections: [
        {
          key: "common_overlapping_trades",
          title: "Common Overlapping Trades",
          bullets: ["Fire Protection", "HVAC / Mechanical"],
        },
        {
          key: "security_and_access_control",
          title: "Security and Access Control",
          subsections: [
            {
              title: "Worker access",
              body: "Minimum Requirement: Verify orientation, badging, and daily work assignment before entry. Responsible Party: Superintendent / Foreman",
              bullets: [],
            },
            {
              title: "Restricted areas",
              body: "Minimum Requirement: Barricade and control permit-required or high-hazard areas.",
              bullets: [],
            },
          ],
        },
      ],
    });

    const taskExecutionModules = sections.find(
      (section) => section.key === "task_execution_modules"
    );

    expect(taskExecutionModules?.subsections).toEqual(
      expect.arrayContaining([
      {
        title: "",
        paragraphs: [],
        items: ["Fire Protection", "HVAC / Mechanical"],
        table: null,
      },
      expect.objectContaining({ title: "Worker access" }),
      expect.objectContaining({ title: "Restricted areas" }),
    ]));
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

    expect(documentXml).not.toContain("Applicability / trigger logic");
    expect(documentXml).not.toContain("Apply this module whenever");
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

  it("normalizes lowercase lead narrative in unnamed subsections before validation", async () => {
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
          key: "project_contractor_information",
          kind: "main",
          title: "1.0 Project & Contractor Information",
          numberLabel: "1.0",
          subsections: [
            {
              title: "",
              paragraphs: ["project-specific contact and governing-state details are confirmed before issue."],
              items: [],
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

    expect(documentXml).toContain(
      "Project-specific contact and governing-state details are confirmed before issue."
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

    expect(documentXml).toContain("Document Control");
    expect(documentXml).toContain("Prepared By:");
    expect(documentXml).toContain("Date:");
    expect(documentXml).toContain("Revision:");
    expect(documentXml).not.toContain("Document-control details were not provided for this issue.");
    expect(documentXml).not.toContain("Project Name / Site");
    expect(documentXml).not.toContain("Field:");
    expect(documentXml).not.toContain("Value:");
    expect(documentXml).not.toContain("TBD by contractor before issue");
  });

  it("collapses trade-summary task rows into a single scope-summary subsection", () => {
    const [section] = buildCsepTemplateSections({
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      issueLabel: "April 20, 2026",
      sourceSections: [
        {
          key: "trade_summary",
          kind: "main",
          title: "Trade Summary",
          table: {
            columns: ["Trade", "Sub-trade", "Tasks", "Hazards", "Permits"],
            rows: [
              ["Steel Erection", "Decking", "Deck placement", "Fall exposure", "Lift plan"],
              ["Steel Erection", "Decking", "Material staging", "Struck-by", "None"],
            ],
          },
        },
      ],
    });

    expect(section.subsections).toEqual([
      {
        title: "Scope Summary",
        paragraphs: [
          "Current contractor scope includes Deck placement, Material staging for Steel Erection / Decking. Primary hazards include Fall exposure, Struck-by. Anticipated permit triggers include Lift plan.",
        ],
        items: [],
      },
    ]);
  });

  it("prefixes generic child headings with their source module title when grouping sections", () => {
    const sections = buildCsepTemplateSections({
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      issueLabel: "April 20, 2026",
      sourceSections: [
        {
          key: "steel_task_module_a",
          kind: "main",
          title: "Receiving and Staging Steel",
          subsections: [
            {
              title: "When It Applies",
              body: "Use this module when unloading and staging members at the work face.",
              bullets: [],
            },
          ],
        },
        {
          key: "steel_task_module_b",
          kind: "main",
          title: "Deck Placement",
          subsections: [
            {
              title: "When It Applies",
              body: "Use this module when metal deck is being landed, aligned, and released.",
              bullets: [],
            },
            {
              title: "Responsibilities and Training",
              body: "Qualified connectors, deck installers, and signal personnel are assigned before work begins.",
              bullets: [],
            },
            {
              title: "Minimum Required Controls",
              body: "Maintain controlled access, verified staging, and protected routes before the task starts.",
              bullets: [],
            },
          ],
        },
      ],
    });

    const taskExecutionSection = sections.find((section) => section.key === "task_execution_modules");

    expect(taskExecutionSection?.subsections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Receiving and Staging Steel: When It Applies" }),
        expect.objectContaining({ title: "Deck Placement: When It Applies" }),
        expect.objectContaining({ title: "Deck Placement: Responsibilities and Training" }),
        expect.objectContaining({ title: "Deck Placement: Minimum Required Controls" }),
      ])
    );
  });

  it("prefixes per-program procedure headings (Related Tasks etc.) when multiple programs bucket into the same fixed section", () => {
    const sections = buildCsepTemplateSections({
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      issueLabel: "April 20, 2026",
      sourceSections: [
        {
          key: "task_module_steel_erection",
          kind: "main",
          title: "Task Module: Steel Erection",
          subsections: [
            {
              title: "When It Applies",
              body: "Applies whenever working six feet or higher above a lower level.",
              bullets: [],
            },
            {
              title: "Pre-Task Setup",
              body: "Anchor points verified and rescue plan reviewed before work.",
              bullets: [],
            },
            {
              title: "Work Execution",
              body: "Maintain 100% tie-off while exposed to fall hazards.",
              bullets: [],
            },
            {
              title: "Stop-Work / Escalation",
              body: "Stop work and escalate if any anchor, lanyard, or harness is compromised.",
              bullets: [],
            },
            {
              title: "Post-Task / Closeout",
              body: "Inspect and stow fall-arrest equipment; log any damage.",
              bullets: [],
            },
            {
              title: "Minimum Required Controls",
              body: "Personal fall arrest, guardrails, and covers as applicable.",
              bullets: [],
            },
            {
              title: "Related Tasks",
              body: "These related tasks apply to this program scope: Roof work, Decking install.",
              bullets: [],
            },
          ],
        },
        {
          key: "task_module_confined_space_entry",
          kind: "main",
          title: "Task Module: Confined Space Entry",
          subsections: [
            {
              title: "When It Applies",
              body: "Applies to entries into permit-required confined spaces.",
              bullets: [],
            },
            {
              title: "Pre-Task Setup",
              body: "Permit issued, atmospheric testing complete, rescue stationed.",
              bullets: [],
            },
            {
              title: "Work Execution",
              body: "Entrant, attendant, and supervisor roles are filled and verified.",
              bullets: [],
            },
            {
              title: "Stop-Work / Escalation",
              body: "Evacuate and stop work on any atmospheric alarm or communication loss.",
              bullets: [],
            },
            {
              title: "Post-Task / Closeout",
              body: "Close permit, log entry duration, and reset the space.",
              bullets: [],
            },
            {
              title: "Minimum Required Controls",
              body: "Continuous atmospheric monitoring and permit controls in place.",
              bullets: [],
            },
            {
              title: "Related Tasks",
              body: "These related tasks apply to this program scope: Vault entry, Tank inspection.",
              bullets: [],
            },
          ],
        },
      ],
    });

    const taskExecutionSection = sections.find(
      (section) => section.key === "task_execution_modules"
    );

    expect(taskExecutionSection).toBeTruthy();

    const titles = (taskExecutionSection?.subsections ?? []).map((subsection) => subsection.title);

    const titleCounts = titles.reduce<Record<string, number>>((acc, title) => {
      acc[title] = (acc[title] ?? 0) + 1;
      return acc;
    }, {});
    for (const [title, count] of Object.entries(titleCounts)) {
      expect(count, `duplicate subsection title "${title}" under Task Execution Modules`).toBe(1);
    }

    expect(titles).toEqual(
      expect.arrayContaining([
        "Task Module: Steel Erection: Related Tasks",
        "Task Module: Confined Space Entry: Related Tasks",
        "Task Module: Steel Erection: Pre-Task Setup",
        "Task Module: Confined Space Entry: Pre-Task Setup",
        "Task Module: Steel Erection: Work Execution",
        "Task Module: Confined Space Entry: Work Execution",
        "Task Module: Steel Erection: Stop-Work / Escalation",
        "Task Module: Confined Space Entry: Stop-Work / Escalation",
        "Task Module: Steel Erection: Post-Task / Closeout",
        "Task Module: Confined Space Entry: Post-Task / Closeout",
      ])
    );
  });

  it("prefixes repeated applicable-reference headings with their source module title when grouping sections", () => {
    const sections = buildCsepTemplateSections({
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      issueLabel: "April 20, 2026",
      sourceSections: [
        {
          key: "high_risk_program_a",
          kind: "main",
          title: "Fall Protection Program Module",
          subsections: [
            {
              title: "Applicable References",
              body: "29 CFR 1926 Subpart M and the project fall-protection plan apply.",
              bullets: [],
            },
          ],
        },
        {
          key: "high_risk_program_b",
          kind: "main",
          title: "Hoisting and Rigging Program Module",
          subsections: [
            {
              title: "Applicable References",
              body: "Project lift planning requirements and manufacturer instructions apply.",
              bullets: [],
            },
          ],
        },
      ],
    });

    const subsectionTitles = sections.flatMap((section) =>
      (section.subsections ?? []).map((subsection) => subsection.title)
    );

    expect(subsectionTitles).toEqual(
      expect.arrayContaining([
        "Fall Protection Program Module: Applicable References",
        "Hoisting and Rigging Program Module: Applicable References",
      ])
    );
  });
});
