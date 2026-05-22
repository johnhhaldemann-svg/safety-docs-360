import { describe, expect, it } from "vitest";
import {
  buildGusDraftJsa,
  buildGusDraftPermitChecklist,
  buildGusPreTaskBriefing,
  GUS_DRAFT_REVIEW_NOTICE,
  type GusDraftRecordContent,
  type GusPlanningSessionRecord,
} from "@/lib/gus/gusDraftRecordBuilder";

const session: GusPlanningSessionRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  company_id: "22222222-2222-4222-8222-222222222222",
  jobsite_id: "33333333-3333-4333-8333-333333333333",
  user_id: "44444444-4444-4444-8444-444444444444",
  work_type: "hotWork",
  task_description: "Grinding steel brackets near stored materials",
  status: "draft_incomplete",
  plan_data: {
    sections: [
      { title: "Task Summary", items: ["Grinding steel brackets near stored materials"] },
      { title: "Primary Hazards", items: ["Fire exposure", "Hot surfaces"] },
      { title: "Required Controls", items: ["Remove combustible materials", "Verify fire watch coverage"] },
      { title: "Required Permits / Reviews", items: ["Hot work permit review may be required"] },
      { title: "Required Training / Qualifications", items: ["Hot work training may be required"] },
      { title: "Inspection Requirements", items: ["Inspect nearby stored materials before work"] },
      { title: "PPE", items: ["Eye and face protection review"] },
      { title: "Emergency Response Considerations", items: ["Confirm fire extinguisher access"] },
      { title: "Stop-Work Triggers", items: ["Combustible material cannot be controlled"] },
      { title: "Human Review Required", items: ["Supervisor review required"] },
    ],
    missingInformation: ["Fire watch name"],
  },
  missing_items: ["Exact work area"],
  risk_flags: ["Combustible storage nearby"],
  human_review_required: true,
};

function expectDraftOnly(content: GusDraftRecordContent) {
  const serialized = JSON.stringify(content).toLowerCase();

  expect(content.notice).toBe(GUS_DRAFT_REVIEW_NOTICE);
  expect(content.planningSessionId).toBe(session.id);
  expect(content.draftOnly).toBe(true);
  expect(content.humanReviewRequired).toBe(true);
  expect(content.officialRecordCreated).toBe(false);
  expect(content.status).not.toBe("complete");
  expect(serialized).not.toContain("submitted");
  expect(serialized).not.toContain("approved");
  expect(serialized).not.toContain("released");
}

describe("Gus draft record builder", () => {
  it("builds a draft JSA with carried-over missing information", () => {
    const result = buildGusDraftJsa(session);

    expect(result.planType).toBe("jsa");
    expect(result.status).toBe("draft_incomplete");
    expectDraftOnly(result.content);
    if (result.content.status !== "draft_incomplete" || !("reviewerRequired" in result.content)) {
      throw new Error("Expected draft JSA content.");
    }
    expect(result.content.missingInformation).toEqual(["Exact work area", "Fire watch name"]);
    expect(result.content.reviewerRequired).toContain("Supervisor review required");
  });

  it("builds a draft permit checklist with review items and reviewers", () => {
    const result = buildGusDraftPermitChecklist(session, { permitType: "Hot work" });

    expect(result.planType).toBe("permit_checklist");
    expectDraftOnly(result.content);
    if (!("permitType" in result.content)) {
      throw new Error("Expected draft permit checklist content.");
    }
    expect(result.content.permitType).toBe("Hot work");
    expect(result.content.requiredReviewItems).toContain("Hot work permit review may be required");
    expect(result.content.requiredSignaturesReviewers).toContain("Supervisor review required");
  });

  it("builds a pre-task briefing as a draft-only artifact", () => {
    const result = buildGusPreTaskBriefing(session);

    expect(result.planType).toBe("pretask_briefing");
    expectDraftOnly(result.content);
    if (!("taskSummary" in result.content)) {
      throw new Error("Expected pre-task briefing content.");
    }
    expect(result.content.taskSummary).toBe("Grinding steel brackets near stored materials");
    expect(result.content.crewQuestions.length).toBeGreaterThan(0);
  });
});
