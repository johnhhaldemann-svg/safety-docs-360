import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  buildCsepOutlinePlan,
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
  it("builds the CSEP in fixed order with hazards as the last narrative front-matter block before appendices", () => {
    const model = buildCsepRenderModelFromGeneratedDraft(createGeneratedDraft());

    expect(model.frontMatterSections.map((section) => section.key)).toEqual([
      "message_from_owner",
      "sign_off_page",
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
      "training_inspections_monitoring_recordkeeping",
      "close_out_lessons_learned",
    ]);
    expect(model.sections.map((section) => section.key)).toEqual([]);
    expect(model.frontMatterSections.find((s) => s.key === "hazards_and_controls")?.numberLabel).toBeUndefined();
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
    const haz = sections.find((s) => s.key === "hazards_and_controls");
    const titles = (haz?.subsections ?? []).map((s) => s.title);
    expect(titles.some((title) => /: Risk$/i.test(title))).toBe(true);
    expect(titles.some((title) => /: Required Controls$/i.test(title))).toBe(true);
    expect(titles.some((title) => /: How Controls Are Verified$/i.test(title))).toBe(true);
    expect(titles.some((title) => /: Stop-Work Triggers$/i.test(title))).toBe(true);
    expect(titles.some((title) => /: References$/i.test(title))).toBe(true);
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
    const scopeSub = sections.find((s) => s.key === "scope")?.subsections.find((sub) => /scope summary/i.test(sub.title));
    expect(scopeSub?.plainItemsStyle).toBe("offset_lines");

    const rendered = await renderGeneratedCsepDocx(draft);
    const { documentXml } = await unzipDocx(rendered.body);
    expect(documentXml).toContain("Unload steel");
    expect(documentXml).not.toContain("6.1.1");
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

    const scopeSection = sections.find((section) => section.key === "scope");
    const scopeTitles = (scopeSection?.subsections ?? []).map((sub) => sub.title.toLowerCase());
    expect(scopeTitles.some((title) => title.includes("project information"))).toBe(false);
    expect(scopeTitles.some((title) => title.includes("contractor information"))).toBe(false);
  });

  it("keeps hazard section numbering controlled and avoids high labels like 14.85", async () => {
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
    expect(documentXml).toContain("14. Hazards and Controls");
    expect(documentXml).toContain("Extra Hazard Program 40");
    expect(documentXml).not.toMatch(/14\.(?:8[0-9]|9[0-9]|1[0-9]{2})\s/);
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
      "sign_off_page",
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
      "training_inspections_monitoring_recordkeeping",
      "close_out_lessons_learned",
    ]);
    expect(
      sections.find((section) => section.key === "union")?.subsections[0]?.paragraphs?.[0]
    ).toContain("No craft-specific union");
    expect(sections.find((section) => section.key === "sign_off_page")?.numberLabel).toBeUndefined();
    expect(sections.find((section) => section.key === "table_of_contents")?.numberLabel).toBeUndefined();
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

  it("replaces repeated policy text inside hazard modules with short cross-references", () => {
    const model = buildCsepRenderModelFromGeneratedDraft(createGeneratedDraft());
    const hazardSection = model.frontMatterSections.find((section) => section.key === "hazards_and_controls");
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
      (model.frontMatterSections.find((section) => section.key === key)?.subsections ?? [])
        .flatMap((subsection) => [...(subsection.paragraphs ?? []), ...(subsection.items ?? [])])
        .join(" ");

    const tradeText = asText("trade_interaction_info");
    expect(tradeText.length).toBeGreaterThan(0);
    expect(tradeText).not.toMatch(/\bSDS\b/i);
    expect(tradeText).not.toMatch(/\bbadge|visitor\b/i);

    const securityText = asText("security_at_site");
    expect(securityText.length).toBeGreaterThan(0);
    expect(securityText).not.toMatch(/\bchemical inventory|GHS|NFPA|SDS\b/i);

    const hazcomText = asText("hazcom");
    expect(hazcomText.length).toBeGreaterThan(0);
    expect(hazcomText).not.toMatch(/\btrucking|traffic control|laydown\b/i);

    const iippText = asText("iipp_emergency_response");
    expect(iippText.length).toBeGreaterThan(0);
    expect(iippText).not.toMatch(/\bSDS|GHS|NFPA|chemical inventory\b/i);
  });

  it("renders one table of contents and no duplicate revision-history block", async () => {
    const rendered = await renderGeneratedCsepDocx(createGeneratedDraft());
    const { documentXml, headerXml, footerXml } = await unzipDocx(rendered.body);

    expect(documentXml).toContain("Title Page");
    expect(documentXml.match(/Table of Contents/g)?.length ?? 0).toBe(1);
    // Legacy builder used "0.1 Revision History" as a free-standing section; the
    // export may still mention "Revision History" inside combined appendix titles.
    expect(documentXml).not.toContain("0.1 Revision History");

    const tocBlockStart = documentXml.indexOf("4. Table of Contents");
    expect(tocBlockStart).toBeGreaterThan(-1);
    const tocBlockEnd = documentXml.indexOf("5. Purpose", tocBlockStart);
    expect(tocBlockEnd).toBeGreaterThan(tocBlockStart);
    const tocSlice = documentXml.slice(tocBlockStart, tocBlockEnd);
    expect(tocSlice.indexOf("1. Title Page")).toBeLessThan(tocSlice.indexOf("2. Message from Owner"));

    const outlineModel = buildCsepRenderModelFromGeneratedDraft(createGeneratedDraft());
    const disclaimerOrdinal = buildCsepOutlinePlan(outlineModel).find((e) => e.kind === "disclaimer")!.ordinal;
    const orderedHeadings = [
      "2. Message from Owner",
      "3. Sign-Off Page",
      "4. Table of Contents",
      "5. Purpose",
      "6. Scope",
      "7. Top 10 Risks",
      "8. Trade Interaction Info",
      "9. Disciplinary Program",
      "10. Union",
      "11. Security at Site",
      "12. HazCom",
      "13. IIPP / Emergency Response",
      "14. Hazards and Controls",
      "15. Training, Inspections, Monitoring &amp; Recordkeeping",
      "16. Close-Out / Lessons Learned",
      `${disclaimerOrdinal}. Disclaimer`,
    ];

    let lastIndex = -1;
    for (const heading of orderedHeadings) {
      const nextIndex = documentXml.indexOf(heading);
      expect(nextIndex).toBeGreaterThan(lastIndex);
      lastIndex = nextIndex;
    }

    expect(headerXml).toBe("");
    expect(footerXml).toContain("Safety360Docs");
    expect(footerXml).toContain("ABC Steel");
    expect(footerXml).toContain("PAGE");
  });
});
