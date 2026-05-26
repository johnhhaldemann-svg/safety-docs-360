import { describe, expect, it } from "vitest";
import {
  UNSUPPORTED_REQUIREMENT_WARNING,
  buildVerifiedSafetyAnswer,
  rankApprovedKnowledge,
} from "@/lib/gusLearning/answer";
import type { ApprovedKnowledgeRow } from "@/lib/gusLearning/types";

function knowledge(overrides: Partial<ApprovedKnowledgeRow> = {}): ApprovedKnowledgeRow {
  return {
    id: "knowledge-1",
    company_id: "company-1",
    project_id: null,
    approved_source_id: "source-1",
    research_queue_id: "finding-1",
    topic: "Trenching",
    knowledge_title: "Protective systems",
    approved_summary: "Use a protective system for trenching exposure where the verified rule applies.",
    source_url: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.652",
    source_title: "OSHA 1926.652",
    source_type: "OSHA",
    jurisdiction: "Federal",
    regulation_reference: "29 CFR 1926.652",
    applies_to: "Excavations",
    affected_modules: ["trenching"],
    required_control_type: "regulatory_requirement",
    approved_by: "admin-1",
    approved_at: "2026-01-01T00:00:00Z",
    review_due_date: "2027-01-01",
    review_status: "current",
    version: 1,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("Gus verified answer assembly", () => {
  it("refuses to create official guidance without verified knowledge", () => {
    const answer = buildVerifiedSafetyAnswer({
      question: "Is this required by OSHA?",
      companyId: "company-1",
      knowledge: [],
    });
    expect(answer.unsupported).toBe(true);
    expect(answer.text).toContain(UNSUPPORTED_REQUIREMENT_WARNING);
    expect(answer.text).toContain("OSHA / regulatory: None found.");
  });

  it("cites approved knowledge and separates OSHA requirements from best practices", () => {
    const answer = buildVerifiedSafetyAnswer({
      question: "What do we need for trenching?",
      companyId: "company-1",
      knowledge: [
        knowledge(),
        knowledge({
          id: "best-1",
          source_type: "insurance carrier guidance",
          source_url: "https://carrier.example/safety/trenching",
          knowledge_title: "Daily pre-task reminder",
          approved_summary: "Hold a short pre-task conversation before excavation work.",
          required_control_type: "best_practice",
          regulation_reference: null,
        }),
      ],
    });
    expect(answer.unsupported).toBe(false);
    expect(answer.citations).toHaveLength(2);
    expect(answer.text).toContain("OSHA / regulatory requirement");
    expect(answer.text).toContain("best practice");
    expect(answer.text).toContain("29 CFR 1926.652");
  });

  it("prioritizes current site-specific knowledge before expired general knowledge", () => {
    const ranked = rankApprovedKnowledge(
      [
        knowledge({ id: "old", review_due_date: "2025-01-01", review_status: "needs_review" }),
        knowledge({
          id: "site",
          project_id: "jobsite-1",
          source_type: "site safety plan",
          source_url: "https://example.com/site-plan",
          required_control_type: "site_requirement",
          review_due_date: "2027-01-01",
        }),
      ],
      "jobsite-1",
      new Date("2026-05-26T12:00:00Z"),
    );
    expect(ranked[0].id).toBe("site");
  });
});
