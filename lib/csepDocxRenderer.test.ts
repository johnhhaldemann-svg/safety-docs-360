import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  buildCsepRenderModelFromGeneratedDraft,
  buildCsepTemplateSections,
  buildHazardFlatProgramGroupsForTest,
  renderGeneratedCsepDocx,
} from "@/lib/csepDocxRenderer";
import { CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY } from "@/lib/csepSafetyProgramReferenceRelocation";
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
  it("builds the Version C CSEP in fixed reviewer-navigation order", () => {
    const model = buildCsepRenderModelFromGeneratedDraft(createGeneratedDraft());

    expect(model.frontMatterSections.map((section) => section.key)).toEqual([
      "owner_message",
      "sign_off_page",
      "table_of_contents",
    ]);
    expect(model.sections.map((section) => section.key)).toEqual([
      "purpose",
      "project_coordination_and_authority",
      "scope_of_work_section",
      "regulatory_basis_and_references",
      "top_10_critical_risks",
      "roles_and_responsibilities",
      "trade_interaction_and_coordination",
      "site_access_security_laydown_traffic_control",
      "hazard_communication_and_environmental_protection",
      "emergency_response_and_rescue",
      "iipp_incident_reporting_corrective_action",
      "worker_conduct_fit_for_duty_disciplinary_program",
      "training_competency_and_certifications",
      "required_permits_and_hold_points",
      "ppe_and_work_attire",
      "scope_specific_policy_evidence_summary",
      "high_risk_programs",
      "excavation_trenching_na_or_program_trigger",
      "inspections_audits_and_records",
      "project_closeout",
      "reviewer_codex_readiness_summary",
      "document_control_and_revision_history",
    ]);
    expect(model.sections.find((s) => s.key === "purpose")?.numberLabel).toBe("1");
    expect(model.sections.find((s) => s.key === "document_control_and_revision_history")?.numberLabel).toBe("22");
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
    const topSub = sections.find((s) => s.key === "top_10_critical_risks")?.subsections[0];
    expect(topSub?.title).toBe("Top 10 Risks");
    expect(topSub?.plainItemsStyle).toBe("offset_lines");

    const rendered = await renderGeneratedCsepDocx(draft);
    const { documentXml } = await unzipDocx(rendered.body);
    expect(documentXml).toContain("Falls while decking");
    expect(documentXml).not.toMatch(/7\.\d+\s+Falls while decking/);
    expect(documentXml).not.toMatch(/7\.\d+\s+Struck-by or caught-in/);
  });

  it("normalizes hazard modules into Risk/Controls/Verification/Stop-Work/References slices", () => {
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
    const haz = sections.find((s) => s.key === "high_risk_programs");
    const titles = (haz?.subsections ?? []).map((s) => s.title);
    expect(titles.some((title) => /\.1 Risk$/i.test(title))).toBe(true);
    expect(titles.some((title) => /\.5 Step-by-step control process$/i.test(title))).toBe(true);
    expect(titles.some((title) => /\.6 How controls are verified$/i.test(title))).toBe(true);
    expect(titles.some((title) => /\.7 Stop-work \/ hold-point triggers$/i.test(title))).toBe(true);
    expect(titles.some((title) => /\.9 Applicable references$/i.test(title))).toBe(true);
  });

  it("renders program module subsections with labels and explicit numbered lines", async () => {
    const draft = createGeneratedDraft();
    draft.sectionMap.push({
      key: "program_falling_objects",
      title: "Falling Objects, Overhead Work, and Gravity Hazards",
      summary: "Tools and material can fall to lower levels during steel erection and material handling.",
      subsections: [
        {
          title: "Risk",
          body:
            "Tools, bolts, deck cutouts, steel pieces, weld slag, banding, material, and debris can fall to lower levels or adjacent areas during steel erection, decking, welding, and material handling.",
          bullets: [],
        },
        {
          title: "Required controls",
          bullets: [
            "Create drop zones, overhead barricades, CAZs, toe boards, debris netting, tool tethering, lanyards, covered walkways, or other controls based on the exposure.",
            "Secure tools, hardware, welding leads, hoses, deck cutouts, loose material, and debris before starting elevated work or moving material.",
          ],
        },
        {
          title: "How controls are met and verified",
          bullets: [
            "Foreman and competent person verify below-work protection before overhead work starts and when the work front moves.",
            "Housekeeping and material control are checked before break, shift end, weather events, and handoff.",
          ],
        },
        {
          title: "Stop-work / hold-point triggers",
          bullets: [
            "Workers are below uncontrolled overhead work, drop zone is not maintained, or material/tools are not secured.",
            "Wind or vibration causes material movement or makes drop control unreliable.",
          ],
        },
        {
          title: "Applicable references",
          bullets: ["R5 OSHA 1926.759; R23 OSHA 1926.25; gravity / overhead work permit if required by site."],
        },
      ],
    });

    const rendered = await renderGeneratedCsepDocx(draft);
    const { documentXml } = await unzipDocx(rendered.body);

    expect(documentXml).toContain("17.1.1 Risk");
    expect(documentXml).toContain("17.1.3 Minimum training / authorization");
    expect(documentXml).toContain("17.1.5 Step-by-step control process");
    expect(documentXml).toContain("17.1.6 How controls are verified");
    expect(documentXml).toMatch(/17\.1\.7 Stop-work[^<]*hold-point triggers/);
    expect(documentXml).toContain("17.1.9 Applicable references");
    const model = buildCsepRenderModelFromGeneratedDraft(draft);
    const firstStepBlock = model.sections
      .find((section) => section.key === "high_risk_programs")
      ?.subsections.find((subsection) => /17\.1\.5 Step-by-step control process/.test(subsection.title));
    expect(firstStepBlock?.items?.length).toBeGreaterThanOrEqual(8);
    expect(firstStepBlock?.items?.length).toBeLessThanOrEqual(12);
    expect(documentXml).toContain("R2, R3, R12, R16");
    expect(documentXml).not.toContain("<w:numPr>");
  });

  it("renders Scope Summary tasks as offset lines without subsection numbers like 3.1.1", async () => {
    const draft = createGeneratedDraft();
    draft.sectionMap.unshift({
      key: "scope_of_work",
      title: "Scope Summary",
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
    const scopeSub = sections
      .find((s) => s.key === "scope_of_work_section")
      ?.subsections.find((sub) => /active tasks/i.test(sub.title));
    expect(scopeSub?.plainItemsStyle).toBe("offset_lines");

    const rendered = await renderGeneratedCsepDocx(draft);
    const { documentXml } = await unzipDocx(rendered.body);
    expect(documentXml).toContain("Deck placement");
    expect(documentXml).not.toContain("3.1.1");
  });

  it("drops generic Project/Contractor Information blocks from Scope when no admin override is set", () => {
    const draft = createGeneratedDraft();
    draft.sectionMap.push(
      {
        key: "scope_project_information",
        title: "Project Information",
        body: "Project Name: Riverfront Tower",
      },
      {
        key: "scope_contractor_information",
        title: "Contractor Information",
        body: "Contractor: ABC Steel",
      }
    );

    const sections = buildCsepTemplateSections({
      draft,
      projectName: "Riverfront Tower",
      contractorName: "ABC Steel",
      tradeLabel: "Steel Erection",
      subTradeLabel: "Decking",
      taskTitles: ["Deck placement"],
      sourceSections: draft.sectionMap,
    });

    const scopeSection = sections.find((section) => section.key === "scope_of_work_section");
    const scopeTitles = (scopeSection?.subsections ?? []).map((sub) => sub.title.toLowerCase());
    expect(scopeTitles.some((title) => title.includes("project information"))).toBe(false);
    expect(scopeTitles.some((title) => title.includes("contractor information"))).toBe(false);
  });

  it("keeps high-risk section numbering controlled and avoids high labels like 17.85", async () => {
    const draft = createGeneratedDraft();
    for (let index = 0; index < 40; index += 1) {
      draft.sectionMap.push({
        key: `task_module_extra_${index + 1}`,
        title: `Task Module: Extra Hazard Program ${index + 1}`,
        subsections: [
          {
            title: "Hazard Overview",
            body: `Exposure narrative ${index + 1}.`,
            bullets: [],
          },
          {
            title: "Required Controls",
            body: `Control narrative ${index + 1}.`,
            bullets: [`Control step ${index + 1}`],
          },
        ],
      });
    }

    const rendered = await renderGeneratedCsepDocx(draft);
    const { documentXml } = await unzipDocx(rendered.body);
    expect(documentXml).toContain("17. High-Risk Programs");
    expect(documentXml).toContain("17.1 Fall Protection and Fall Rescue");
    expect(documentXml).not.toMatch(/17\.(?:8[0-9]|9[0-9]|1[0-9]{2})\s/);
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
      "owner_message",
      "sign_off_page",
      "table_of_contents",
      "purpose",
      "project_coordination_and_authority",
      "scope_of_work_section",
      "regulatory_basis_and_references",
      "top_10_critical_risks",
      "roles_and_responsibilities",
      "trade_interaction_and_coordination",
      "site_access_security_laydown_traffic_control",
      "hazard_communication_and_environmental_protection",
      "emergency_response_and_rescue",
      "iipp_incident_reporting_corrective_action",
      "worker_conduct_fit_for_duty_disciplinary_program",
      "training_competency_and_certifications",
      "required_permits_and_hold_points",
      "ppe_and_work_attire",
      "scope_specific_policy_evidence_summary",
      "high_risk_programs",
      "excavation_trenching_na_or_program_trigger",
      "inspections_audits_and_records",
      "project_closeout",
      "reviewer_codex_readiness_summary",
      "document_control_and_revision_history",
    ]);
    expect(sections.find((section) => section.key === "sign_off_page")?.numberLabel).toBeNull();
    expect(sections.find((section) => section.key === "table_of_contents")?.numberLabel).toBeNull();
  });

  it("groups catalog program subsections so one program maps to one flat outline bucket in hazards", () => {
    const subs = [
      { title: "Fall Protection Program", paragraphs: ["Intro for the program."], items: [] as string[] },
      {
        title: "Fall Protection Program: When It Applies",
        paragraphs: ["Detail A."],
        items: [] as string[],
      },
      {
        title: "Fall Protection Program: Work Execution",
        paragraphs: [],
        items: ["Detail B."],
      },
      { title: "Hot Work Program", paragraphs: ["Hot intro."], items: [] as string[] },
      {
        title: "Hot Work Program: Stop-Work / Escalation",
        paragraphs: [],
        items: ["Stop detail."],
      },
    ];
    const groups = buildHazardFlatProgramGroupsForTest(subs, "hazards_and_controls");
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(3);
    expect(groups[1]).toHaveLength(2);
  });

  it("groups em-dash appendix reference rows by program title prefix", () => {
    const subs = [
      { title: "Alpha Program — overview", paragraphs: ["o"], items: [] as string[] },
      { title: "Alpha Program — narrative", paragraphs: ["n"], items: [] as string[] },
      { title: "Beta Program — overview", paragraphs: ["x"], items: [] as string[] },
    ];
    const groups = buildHazardFlatProgramGroupsForTest(subs, CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(2);
    expect(groups[1]).toHaveLength(1);
  });

  it("replaces repeated policy text inside high-risk modules with short cross-references", () => {
    const model = buildCsepRenderModelFromGeneratedDraft(createGeneratedDraft());
    const hazardSection = model.sections.find((section) => section.key === "high_risk_programs");
    const flattened = (hazardSection?.subsections ?? []).flatMap((subsection) => [
      ...(subsection.paragraphs ?? []),
      ...(subsection.items ?? []),
    ]);
    const hazardText = flattened.join(" ");

    expect(hazardText).not.toContain("Follow the project Hazard Communication requirements for sealants.");
    expect(hazardText).not.toContain("Follow the project emergency response policy when a rescue is needed.");
  });

  it("enforces section ownership boundaries and removes cross-section duplicate policy text", () => {
    const draft = createGeneratedDraft();
    draft.sectionMap.push(
      {
        key: "common_overlapping_trades",
        title: "Common Overlapping Trades",
        bullets: [
          "Coordinate shared work areas and trade interfaces before crews start.",
          "Maintain SDS access in the trailer.",
          "Verify visitor badges at gate 2.",
        ],
      },
      {
        key: "security_and_access",
        title: "Security and Access",
        bullets: [
          "Control worker access, visitors, deliveries, laydown, staging, and end-of-shift security.",
          "Keep chemical inventory current for all products.",
        ],
      },
      {
        key: "hazcom_program",
        title: "HazCom Program",
        bullets: [
          "Maintain SDS and label secondary containers.",
          "Confirm trucking routes are barricaded.",
        ],
      },
      {
        key: "incident_reporting_and_investigation",
        title: "IIPP / Emergency Response",
        bullets: [
          "Report incidents and coordinate emergency medical response.",
          "Keep GHS/NFPA labels updated on all chemicals.",
        ],
      }
    );

    const model = buildCsepRenderModelFromGeneratedDraft(draft);
    const asText = (key: string) =>
      ([...model.frontMatterSections, ...model.sections].find((section) => section.key === key)?.subsections ?? [])
        .flatMap((subsection) => [...(subsection.paragraphs ?? []), ...(subsection.items ?? [])])
        .join(" ");

    const tradeText = asText("trade_interaction_and_coordination");
    expect(tradeText.length).toBeGreaterThan(0);
    expect(tradeText).not.toMatch(/\bSDS\b/i);
    expect(tradeText).not.toMatch(/\bbadge|visitor\b/i);

    const securityText = asText("site_access_security_laydown_traffic_control");
    expect(securityText.length).toBeGreaterThan(0);
    expect(securityText).not.toMatch(/\bchemical inventory|GHS|NFPA|SDS\b/i);

    const hazcomText = asText("hazard_communication_and_environmental_protection");
    expect(hazcomText.length).toBeGreaterThan(0);
    expect(hazcomText).not.toMatch(/\btrucking|traffic control|laydown\b/i);

    const iippText = asText("emergency_response_and_rescue");
    expect(iippText.length).toBeGreaterThan(0);
    expect(iippText).not.toMatch(/\bSDS|GHS|NFPA|chemical inventory\b/i);
  });

  it("renders one table of contents and no duplicate revision-history block", async () => {
    const rendered = await renderGeneratedCsepDocx(createGeneratedDraft());
    const { documentXml, headerXml, footerXml } = await unzipDocx(rendered.body);

    expect(documentXml).toContain("Title Page");
    expect(documentXml.match(/Table of Contents/g)?.length ?? 0).toBe(2);
    // Legacy builder used "0.1 Revision History" as a free-standing section; the
    // export may still mention "Revision History" inside combined appendix titles.
    expect(documentXml).not.toContain("0.1 Revision History");

    const tocBlockStart = documentXml.indexOf("Table of Contents");
    expect(tocBlockStart).toBeGreaterThan(-1);
    const tocBlockEnd = documentXml.indexOf("1. Purpose", tocBlockStart);
    expect(tocBlockEnd).toBeGreaterThan(tocBlockStart);
    const tocSlice = documentXml.slice(tocBlockStart, tocBlockEnd);
    expect(tocSlice.indexOf("Title Page")).toBeLessThan(tocSlice.indexOf("Owner Safety Message"));

    const orderedHeadings = [
      "Owner Safety Message",
      "Sign-Off Page",
      "Table of Contents",
      "1. Purpose",
      "2. Project Coordination and Authority",
      "3. Scope of Work",
      "4. Regulatory Basis and References",
      "5. Top 10 Critical Risks",
      "6. Roles and Responsibilities",
      "7. Trade Interaction and Coordination",
      "8. Site Access, Security, Laydown, and Traffic Control",
      "9. Hazard Communication and Environmental Protection",
      "10. Emergency Response and Rescue",
      "11. IIPP / Incident Reporting / Corrective Action",
      "12. Worker Conduct, Fit-for-Duty, and Disciplinary Program",
      "13. Training, Competency, and Certifications",
      "14. Required Permits and Hold Points",
      "15. PPE and Work Attire",
      "16. Scope-Specific Policy Evidence Summary",
      "17. High-Risk Programs",
      "18. Excavation / Trenching N/A or Program Trigger",
      "19. Inspections, Audits, and Records",
      "20. Project Closeout",
      "21. Reviewer / CODEX Readiness Summary",
      "22. Document Control and Revision History",
      "Disclaimer",
    ];

    let lastIndex = -1;
    for (const heading of orderedHeadings) {
      const nextIndex = documentXml.indexOf(heading);
      expect(nextIndex).toBeGreaterThan(lastIndex);
      lastIndex = nextIndex;
    }

    expect(headerXml).toBe("");
    expect(footerXml).toContain("Version C - Reviewer / CODEX Evidence CSEP");
    expect(footerXml).toContain("Page");
  });

  it("mirrors the reviewer evidence visual style for fonts, tables, and callouts", async () => {
    const rendered = await renderGeneratedCsepDocx(createGeneratedDraft());
    const zip = await JSZip.loadAsync(rendered.body);
    const documentXml = await zip.file("word/document.xml")!.async("string");
    const stylesXml = await zip.file("word/styles.xml")!.async("string");
    const footerXml = zip.file("word/footer1.xml")
      ? await zip.file("word/footer1.xml")!.async("string")
      : "";

    expect(stylesXml).toContain("Aptos");
    expect(stylesXml).toContain('w:styleId="CsepSectionHeading"');
    expect(documentXml).toContain("Version C - Reviewer / CODEX Evidence Format");
    expect(documentXml).toContain("Uses policy mapping, evidence language, and selective matrices for qualification review.");
    expect(documentXml).toContain('w:fill="D9EAF7"');
    expect(documentXml).toContain('w:fill="FCE4D6"');
    expect(documentXml).toContain('w:fill="FFF2CC"');
    expect(documentXml).toContain("Stop-Work Authority");
    expect(footerXml).toContain("Version C - Reviewer / CODEX Evidence CSEP");
  });
});
