import { describe, expect, it } from "vitest";
import { buildGeneratedDocumentRecordFromDraft } from "@/lib/safety-intelligence/documents/pipeline";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

describe("buildGeneratedDocumentRecordFromDraft", () => {
  it("renders HTML preview with document numbering and tables preserved", () => {
    const draft: GeneratedSafetyPlanDraft = {
      documentType: "csep",
      projectDeliveryType: "ground_up",
      title: "Preview Test CSEP",
      projectOverview: {
        projectName: "Preview Test",
        contractorCompany: "Example Contractor",
      },
      operations: [],
      ruleSummary: {
        permitTriggers: [],
        ppeRequirements: [],
        requiredControls: [],
        hazardCategories: [],
        siteRestrictions: [],
        prohibitedEquipment: [],
        trainingRequirements: [],
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
        score: 0,
        band: "low",
        priorities: [],
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      narrativeSections: {},
      sectionMap: [
        {
          key: "document_control",
          title: "Document Control",
          kind: "front_matter",
          numberLabel: "0.0",
          table: {
            columns: ["Field", "Value"],
            rows: [["Project Name", "Preview Test"]],
          },
        },
        {
          key: "definitions",
          title: "Definitions",
          kind: "main",
          numberLabel: "1.0",
          summary: "Shared terminology used in the plan.",
          subsections: [
            {
              title: "When It Applies",
              body: "Use this subsection for hot-work planning.",
              bullets: ["Selected work includes welding or cutting."],
            },
          ],
        },
      ],
      provenance: {
        generator: "test",
      },
    };

    const record = buildGeneratedDocumentRecordFromDraft(draft as any, {});

    expect(record.htmlPreview).toContain("<h2>0.0 Document Control</h2>");
    expect(record.htmlPreview).toContain("<table>");
    expect(record.htmlPreview).toContain("<h2>1.0 Definitions</h2>");
    expect(record.htmlPreview).toContain("<h3>1.1 When It Applies</h3>");
    expect(record.htmlPreview).toContain("<p>1.1.1 Selected work includes welding or cutting.</p>");
    expect(record.htmlPreview).not.toContain("<h2>2. Definitions</h2>");
  });
});
