import { describe, expect, it } from "vitest";
import { generateBuilderProgramAiReview } from "@/lib/builderDocumentAiReview";

describe("generateBuilderProgramAiReview", () => {
  it("surfaces document quality issues and note coverage in deterministic mode", async () => {
    const { review } = await generateBuilderProgramAiReview({
      documentText: [
        "TEST CSEP",
        "Prepared by safety_plan_deterministic_assembler",
        "Risk Score 672 (critical)",
        "16.5 Related Task Triggers",
      ].join("\n"),
      programLabel: "CSEP",
      projectName: "TEST",
      annotations: [
        {
          id: "5",
          author: "john haldemann",
          date: "2026-04-16T14:38:00Z",
          anchorText: "16.5 Related Task Triggers",
          note: "For all of these lets find a way to just list the task and not name them triggers",
        },
      ],
    });

    const qualitySummary = review.documentQualityIssues?.join("\n") ?? "";
    const noteSummary = review.noteCoverage?.join("\n") ?? "";

    expect(qualitySummary).toContain("Placeholder values");
    expect(qualitySummary).toContain("Internal generator wording");
    expect(qualitySummary).toContain("raw risk score");
    expect(qualitySummary).toContain("lists the tasks directly");
    expect(noteSummary).toContain("list the task");
  });
});
